package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductDiscountQueryContractTest {
    @Test
    void discountProductListDelegatesToBoundedPublicPageQuery() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String discountProducts = methodBlock(source, "public List<Product> findDiscountProducts()");

        assertTrue(discountProducts.contains(
                "legacyProductListLimit(\"product.discount-list-max-rows\", 100, HARD_PUBLIC_PRODUCT_PAGE_SIZE_LIMIT)"));
        assertTrue(discountProducts.contains("query.setPage(0);"));
        assertTrue(discountProducts.contains("query.setSize(limit);"));
        assertTrue(discountProducts.contains("query.setDiscount(true);"));
        assertTrue(discountProducts.contains("query.setSort(\"discount,desc\");"));
        assertTrue(discountProducts.contains("findPublicProductPage(query).getContent()"),
                "Discount products must reuse the bounded public page query");
        assertFalse(discountProducts.contains("productRepository.findAll("),
                "findDiscountProducts must not call the repository directly");
        assertFalse(discountProducts.contains(".stream().filter("),
                "findDiscountProducts must not load a broad result set and filter it in memory");
    }

    @Test
    void publicProductPageAppliesDiscountFilterInJpaSpecification() throws IOException {
        String source = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String pageQuery = methodBlock(source,
                "private Page<Product> findPublicProductPageUncached(ProductListQuery normalizedQuery, String normalizedKeyword)");
        String specification = methodBlock(source,
                "private Specification<Product> publicProductSpecification(ProductListQuery query,");

        assertTrue(pageQuery.contains(
                "PageRequest.of(normalizedPage, normalizedSize, productPageSort(normalizedQuery.getSort()))"));
        assertTrue(pageQuery.contains("productRepository.findAll(publicProductSpecification("),
                "Public products must be fetched through the JPA specification and Pageable");
        assertTrue(pageQuery.contains(", pageRequest)"));
        assertTrue(specification.contains("Boolean.TRUE.equals(query.getDiscount())"));
        assertTrue(specification.contains("criteriaBuilder.greaterThan(root.get(\"discount\"), 0)"));
        assertTrue(specification.contains("criteriaBuilder.greaterThan(root.get(\"limitedTimePrice\"), BigDecimal.ZERO)"));
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
