package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ProductFeaturedQueryContractTest {
    @Test
    void legacyFeaturedProductPathUsesConfiguredBoundedPage() throws IOException {
        String service = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String method = methodBlock(service, "public List<Product> findByIsFeaturedTrueOrderByIdAsc()");

        assertTrue(method.contains("legacyProductListLimit(\"product.legacy-list-max-rows\", 500, HARD_LEGACY_PRODUCT_LIST_LIMIT)"));
        assertTrue(method.contains("productRepository.findByIsFeaturedTrueOrderByIdAsc(PageRequest.of(0, limit))"));
        assertFalse(method.contains("productRepository.findByIsFeaturedTrueOrderByIdAsc()"));
        assertFalse(Files.readString(Path.of("src/main/java/com/example/shop/repository/ProductRepository.java"),
                StandardCharsets.UTF_8).contains("findByIsFeaturedTrueOrderByIdAsc();"));
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
