package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PetGalleryControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/PetGalleryController.java");

    @Test
    void petGalleryControllerKeepsPublicPaginationAndAuthenticatedMutationContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/pet-gallery\")"));
        assertTrue(source.contains("petGalleryService.findPublicPhotos(viewerId, clientIp, page - 1, size)"));
        assertTrue(source.contains("response.put(\"items\", publicPhotos(result.getContent()))"));
        assertTrue(source.contains("response.put(\"pages\", result.getTotalPages())"));
        assertTrue(source.contains("@GetMapping(\"/quota\")"));
        assertTrue(source.contains("petGalleryService.getQuota(userDetails.getId(), resolveClientIp(request))"));
        assertTrue(source.contains("@RequestParam(\"file\") MultipartFile file"));
        assertTrue(source.contains("petGalleryService.upload("));
        assertTrue(source.contains("petGalleryService.like(id, userId, resolveClientIp(request))"));
        assertTrue(source.contains("petGalleryService.deleteOwnUpload(id, userDetails.getId())"));
        assertTrue(source.contains("throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, \"Unauthorized\")"));
    }
}
