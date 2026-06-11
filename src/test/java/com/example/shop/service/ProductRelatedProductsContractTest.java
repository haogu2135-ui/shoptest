package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductRelatedProductsContractTest {

    @Test
    void relatedProductsUseBoundedCategoryCandidateWindow() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String method = methodBlock(source, "public List<Product> findRelatedProducts(Long productId, Long categoryId)");

        assertTrue(method.contains("productRepository\n"
                + "                .findActiveByCategoryId(categoryId, PageRequest.of(0, 14))"),
                "related products should fetch a bounded category window from the repository");
        assertTrue(method.contains(".filter(product -> !productId.equals(product.getId()))"),
                "related products should exclude the current product from the bounded candidate window");
        assertTrue(method.contains(".filter(this::isPublicCatalogProduct)"));
        assertTrue(method.contains(".filter(this::hasSellableStock)"));
        assertTrue(method.contains(".limit(8)"),
                "related product responses should remain capped after defensive current-window filtering");
        assertFalse(method.contains("productRepository.findByCategoryId(categoryId)"),
                "related products must not load every product in the category");
        assertFalse(method.contains("productRepository.findAll("),
                "related products must not scan the whole product table");
    }

    @Test
    void repositoryRelatedCategoryQueryAcceptsPageableAndFiltersPublicSellableProducts() throws IOException {
        String repository = read("src/main/java/com/example/shop/repository/ProductRepository.java");

        assertTrue(repository.contains("List<Product> findActiveByCategoryId(@Param(\"categoryId\") Long categoryId, Pageable pageable);"));
        assertTrue(repository.contains("select p from Product p where p.categoryId = :categoryId"));
        assertTrue(repository.contains("and (p.status is null or upper(p.status) = 'ACTIVE')"));
        assertTrue(repository.contains("and p.name is not null and p.name <> ''"));
        assertTrue(repository.contains("and p.price is not null and p.price > 0"));
        assertTrue(repository.contains("and (p.stock is null or p.stock > 0)"));
        assertTrue(repository.contains("order by p.id asc"),
                "repository should provide stable ordering before the SQL LIMIT/OFFSET generated from Pageable");
    }

    @Test
    void productRecommendationsEndpointUsesCurrentBoundedRelatedPath() throws IOException {
        String controller = read("src/main/java/com/example/shop/controller/ProductController.java");
        String endpoint = methodBlock(controller, "public ResponseEntity<List<ProductPublicResponse>> getRecommendations(@PathVariable Long id)");

        assertTrue(endpoint.contains("productService.findPublicById(id)"));
        assertTrue(endpoint.contains("productService.findRelatedProducts(id, product.getCategoryId())"));
        assertFalse(endpoint.contains("getSimilarProducts"));
        assertFalse(endpoint.contains("findByCategoryId"));
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }
}
