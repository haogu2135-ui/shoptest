package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductImportVariantSkuOwnerScanContractTest {
    private static final Path PRODUCT_SERVICE =
            Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
    private static final Path PRODUCT_REPOSITORY =
            Path.of("src/main/java/com/example/shop/repository/ProductRepository.java");

    @Test
    void importVariantSkuOwnerLookupUsesPagedIdVariantProjection() throws IOException {
        String service = Files.readString(PRODUCT_SERVICE);
        String repository = Files.readString(PRODUCT_REPOSITORY);
        String lookup = methodBlock(service, "private Map<String, Set<Long>> loadExistingVariantSkuOwners()");

        assertFalse(lookup.contains("productRepository.findAll()"),
                "CSV variant SKU preflight must not load full Product entities");
        assertTrue(lookup.contains("productRepository.findVariantSkuOwnerRows(PageRequest.of(page, pageSize))"),
                "CSV variant SKU preflight should page through lightweight owner rows");
        assertTrue(service.contains("product.import.variant-sku-scan-page-size"),
                "CSV variant SKU preflight page size should be runtime configurable");
        assertTrue(service.contains("product.import.variant-sku-scan-max-rows"),
                "CSV variant SKU preflight scan limit should be runtime configurable");
        assertTrue(service.contains("private void registerVariantSkuOwnerRow(Object[] row, Map<String, Set<Long>> owners)"),
                "CSV variant SKU owner parsing should operate on projection rows");
        assertTrue(repository.contains("List<Object[]> findVariantSkuOwnerRows(Pageable pageable)"),
                "ProductRepository should expose a lightweight projection query");
        assertTrue(repository.contains("select p.id, p.variants from Product p"),
                "Projection query should select only id and variants");
    }

    private String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method: " + signature);
        int brace = source.indexOf('{', start);
        assertTrue(brace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int i = brace; i < source.length(); i++) {
            char ch = source.charAt(i);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, i + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method: " + signature);
    }
}
