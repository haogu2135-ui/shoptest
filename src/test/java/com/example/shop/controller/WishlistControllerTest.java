package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class WishlistControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/WishlistController.java");

    @Test
    void wishlistControllerKeepsMeScopedWishlistContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/wishlist\")"));
        assertTrue(source.contains("resolveWishlistUserId(userId, authentication)"));
        assertTrue(source.contains("@GetMapping(\"/me\")"));
        assertTrue(source.contains("@GetMapping(\"/me/check\")"));
        assertTrue(source.contains("@GetMapping(\"/me/count\")"));
        assertTrue(source.contains("@PostMapping(\"/me/toggle\")"));
        assertTrue(source.contains("@DeleteMapping(\"/me\")"));
        assertTrue(source.contains("SecurityUtils.assertSelf(authentication, requestedUserId);"));
        assertTrue(source.contains("wishlistService.toggleWishlist(userId, productId);"));
        assertTrue(source.contains("WishlistItemResponse::from"));
    }
}
