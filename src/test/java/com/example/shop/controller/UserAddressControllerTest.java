package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class UserAddressControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/UserAddressController.java");

    @Test
    void userAddressControllerKeepsOwnerScopedAddressCrudContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/addresses\")"));
        assertTrue(source.contains("resolveAddressUserId(userId, authentication)"));
        assertTrue(source.contains("SecurityUtils.assertSelf(authentication, address.getUserId());"));
        assertTrue(source.contains("@Valid @RequestBody(required = false) UserAddressRequest request"));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.BAD_REQUEST, \"Address is required\")"));
        assertTrue(source.contains("request.toEntity(user.getId())"));
        assertTrue(source.contains("address.setIsDefault(existing.getIsDefault());"));
        assertTrue(source.contains("userAddressService.setDefault(id);"));
        assertTrue(source.contains("UserAddressResponse::from"));
    }
}
