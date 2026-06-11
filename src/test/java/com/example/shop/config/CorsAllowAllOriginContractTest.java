package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.shop.service.RuntimeConfigService;

class CorsAllowAllOriginContractTest {
    @Test
    void exactAllowAllOriginIsRejectedEvenOutsideProductionMode() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString(eq("app.cors.allowed-origin-patterns"), anyString()))
                .thenReturn("*,http://localhost:*");

        List<String> origins = new CorsOriginProperties(runtimeConfig).getCorsAllowedOriginPatterns();

        assertFalse(origins.contains("*"));
        assertTrue(origins.contains("http://localhost:*"));
    }

    @Test
    void corsConfigurationDoesNotHardcodeAllowAllOriginWithCredentials() throws Exception {
        String configSources = Files.readString(
                Path.of("src/main/java/com/example/shop/config/CorsOriginProperties.java"),
                StandardCharsets.UTF_8)
                + "\n"
                + Files.readString(
                Path.of("src/main/java/com/example/shop/config/SecurityConfig.java"),
                StandardCharsets.UTF_8)
                + "\n"
                + Files.readString(
                Path.of("src/main/java/com/example/shop/config/WebConfig.java"),
                StandardCharsets.UTF_8);

        assertFalse(configSources.contains("setAllowedOriginPatterns(List.of(\"*\"))"));
        assertFalse(configSources.contains("allowedOriginPatterns(\"*\")"));
        assertFalse(configSources.contains("addAllowedOriginPattern(\"*\")"));
        assertFalse(configSources.contains("setAllowedOrigins(List.of(\"*\"))"));
        assertFalse(configSources.contains("allowedOrigins(\"*\")"));
    }
}
