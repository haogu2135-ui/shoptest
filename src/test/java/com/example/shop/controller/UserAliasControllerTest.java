package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UserAliasControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/UserAliasController.java");

    @Test
    void userAliasControllerKeepsMeScopedProfileCompatibilityRoute() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@GetMapping(\"/user/profile\")"));
        assertTrue(source.contains("UserDetailsImpl userDetails = SecurityUtils.requireUser(authentication);"));
        assertTrue(source.contains("UserProfileResponse.from(userService.findById(userDetails.getId()))"));
    }
}
