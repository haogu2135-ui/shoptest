package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class RuntimeConfigServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/RuntimeConfigService.java");

    @Test
    void runtimeConfigServiceKeepsTypedEnvironmentFallbackContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("private final Environment environment;"));
        assertTrue(source.contains("environment.getProperty(key, defaultValue)"));
        assertTrue(source.contains("environment.getProperty(key, Integer.class, defaultValue)"));
        assertTrue(source.contains("environment.getProperty(key, Long.class, defaultValue)"));
        assertTrue(source.contains("environment.getProperty(key, Boolean.class, defaultValue)"));
    }

    @Test
    void runtimeConfigServiceKeepsBigDecimalParsingSafe() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("String value = environment.getProperty(key);"));
        assertTrue(source.contains("if (value == null || value.trim().isEmpty())"));
        assertTrue(source.contains("return new BigDecimal(value.trim());"));
        assertTrue(source.contains("catch (NumberFormatException e)"));
        assertTrue(source.contains("return defaultValue;"));
    }
}
