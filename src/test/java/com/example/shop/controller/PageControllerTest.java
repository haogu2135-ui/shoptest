package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PageControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/PageController.java");

    @Test
    void pageControllerKeepsBoundedHomeProductContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@GetMapping(\"/home/products\")"));
        assertTrue(source.contains("query.setPage(0);"));
        assertTrue(source.contains("query.setSize(24);"));
        assertTrue(source.contains("productService.findPublicProducts(query)"));
        assertTrue(source.contains("ProductPublicResponse::from"));
        assertTrue(source.contains("@GetMapping(\"/home/products/{id}\")"));
        assertTrue(source.contains("productService.findPublicById(id)"));
        assertTrue(source.contains("ResponseEntity.notFound().build()"));
    }
}
