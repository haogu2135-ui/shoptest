package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class HomeControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/HomeController.java");

    @Test
    void homeControllerKeepsAuthenticatedRedirectAndGuestLoginView() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@GetMapping(\"/\")"));
        assertTrue(source.contains("authentication != null && authentication.isAuthenticated()"));
        assertTrue(source.contains("return \"redirect:/api/products\";"));
        assertTrue(source.contains("return \"login\";"));
    }
}
