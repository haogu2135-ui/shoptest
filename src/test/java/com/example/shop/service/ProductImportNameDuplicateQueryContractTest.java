package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductImportNameDuplicateQueryContractTest {
    private static final Path PRODUCT_SERVICE =
            Path.of("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
    private static final Path PRODUCT_REPOSITORY =
            Path.of("src/main/java/com/example/shop/repository/ProductRepository.java");

    @Test
    void importNameDuplicateCheckUsesExistsQueriesInsteadOfLoadingCategoryProducts() throws IOException {
        String service = Files.readString(PRODUCT_SERVICE);
        String repository = Files.readString(PRODUCT_REPOSITORY);
        String duplicateCheck = methodBlock(service,
                "private void validateImportProductNameDoesNotDuplicateExisting(Product existing, Product imported, Set<String> updateFields)");

        assertFalse(duplicateCheck.contains("productRepository.findByCategoryId("),
                "CSV import duplicate-name preflight must not load all products in a category");
        assertFalse(duplicateCheck.contains("List<Product> matches"),
                "CSV import duplicate-name preflight should avoid in-memory category scans");
        assertTrue(duplicateCheck.contains("existsByCategoryIdAndNameIgnoreCase(categoryId, normalizedName)"),
                "new imported rows should use a direct duplicate-exists query");
        assertTrue(duplicateCheck.contains("existsByCategoryIdAndNameIgnoreCaseAndIdNot(categoryId, normalizedName, currentId)"),
                "updated imported rows should use a duplicate-exists query that excludes the current product");
        assertTrue(repository.contains("boolean existsByCategoryIdAndNameIgnoreCase(Long categoryId, String name)"),
                "ProductRepository should expose the create-time exists query");
        assertTrue(repository.contains("boolean existsByCategoryIdAndNameIgnoreCaseAndIdNot(Long categoryId, String name, Long id)"),
                "ProductRepository should expose the update-time exists query");
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
