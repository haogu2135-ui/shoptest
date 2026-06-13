package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductReviewAliasControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/ProductReviewAliasController.java");

    @Test
    void productReviewAliasControllerKeepsSafePaginationAndSummaryContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@GetMapping(\"/products/{productId}/reviews\")"));
        assertTrue(source.contains("currentUserId = ((UserDetailsImpl) authentication.getPrincipal()).getId();"));
        assertTrue(source.contains("int safePage = safePublicReviewPage(page);"));
        assertTrue(source.contains("int safeSize = safePublicReviewSize(size);"));
        assertTrue(source.contains("reviewService.getPublicReviewsByProductId(productId, currentUserId, safePage, safeSize)"));
        assertTrue(source.contains("reviewService.getAverageRating(productId)"));
        assertTrue(source.contains("reviewService.countPublicReviewsByProductId(productId, currentUserId)"));
        assertTrue(source.contains("page must be greater than or equal to 0"));
        assertTrue(source.contains("size must be less than or equal to 100"));
    }
}
