package com.example.shop.controller;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class FavoritesControllerContractTest {

    @Test
    void favoritesControllerUsesStableWishlistedPayloadInsteadOfLegacyResultWrapper() throws IOException {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/controller/FavoritesController.java"), StandardCharsets.UTF_8);
        String frontendApi = Files.readString(Path.of("frontend/src/api/index.ts"), StandardCharsets.UTF_8);

        assertTrue(source.contains("@Deprecated(since = \"2026-06-13\", forRemoval = false)"),
                "favorites should remain only as an explicitly deprecated compatibility alias");
        assertTrue(source.contains("@RequestMapping(\"/favorites\")"),
                "favorites should keep the legacy route at the controller boundary");
        assertTrue(source.contains("public Map<String, Object> addFavorite("),
                "favorite add should return the current object payload contract");
        assertTrue(source.contains("return Map.of(\"wishlisted\", wishlistService.isWishlisted(userId, effectiveProductId));"),
                "favorite add should return the current wishlisted boolean payload");
        assertTrue(source.contains("public Map<String, String> removeFavorite("),
                "favorite removal should return the current message payload contract");
        assertFalse(source.contains("Result<Boolean>"),
                "favorites should not reintroduce the stale Result<Boolean> response shape");
        assertFalse(frontendApi.contains("favoritesApi"),
                "frontend should use the canonical wishlistApi instead of a parallel favorites client");
        assertFalse(frontendApi.contains("'/favorites"),
                "frontend API client should not call the deprecated favorites alias");
    }
}
