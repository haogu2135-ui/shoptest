package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminBootstrapTokenContractTest {

    @Test
    void userControllerUsesStrongBootstrapTokenPolicy() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/controller/UserController.java"));

        assertTrue(source.contains("AdminBootstrapTokenPolicy.isStrongConfiguredToken(normalizedConfiguredToken)"));
        assertTrue(source.contains("Admin bootstrap token is not strong enough"));
        assertTrue(source.contains("AdminBootstrapTokenPolicy.normalize(bootstrapToken)"));
    }
}
