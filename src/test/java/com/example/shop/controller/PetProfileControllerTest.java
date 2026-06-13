package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PetProfileControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/PetProfileController.java");

    @Test
    void petProfileControllerKeepsOwnerScopedCrudAndConflictContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/pet-profiles\")"));
        assertTrue(source.contains("SecurityUtils.requireUser(authentication)"));
        assertTrue(source.contains("petProfileService.findByUserId(userDetails.getId())"));
        assertTrue(source.contains("@Valid @RequestBody(required = false) PetProfile request"));
        assertTrue(source.contains("petProfileService.save(userDetails.getId(), request, null)"));
        assertTrue(source.contains("petProfileService.save(userDetails.getId(), request, id)"));
        assertTrue(source.contains("ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(\"error\", e.getMessage()))"));
        assertTrue(source.contains("petProfileService.delete(userDetails.getId(), id);"));
        assertTrue(source.contains("PetProfileResponse::from"));
    }
}
