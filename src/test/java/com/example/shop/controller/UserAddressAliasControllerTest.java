package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UserAddressAliasControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/UserAddressAliasController.java");

    @Test
    void userAddressAliasControllerKeepsMeScopedCompatibilityRoute() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@GetMapping(\"/user/addresses\")"));
        assertTrue(source.contains("userAddressService.getAddresses(SecurityUtils.requireUser(authentication).getId())"));
        assertTrue(source.contains("UserAddressResponse::from"));
    }
}
