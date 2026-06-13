package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductQuestionControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/ProductQuestionController.java");

    @Test
    void productQuestionControllerKeepsPublicReadAndAuthenticatedAskContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/product-questions\")"));
        assertTrue(source.contains("@GetMapping(\"/product/{productId}\")"));
        assertTrue(source.contains("questionService.getPublicByProductId(productId)"));
        assertTrue(source.contains("@PostMapping(\"/product/{productId}\")"));
        assertTrue(source.contains("@RequestBody(required = false) Map<String, String> body"));
        assertTrue(source.contains("SecurityUtils.requireUser(authentication).getId()"));
        assertTrue(source.contains("body == null ? null : body.get(\"question\")"));
        assertTrue(source.contains("ProductQuestionPublicResponse.from(question, productId)"));
    }
}
