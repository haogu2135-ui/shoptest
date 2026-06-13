package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class BrandControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/BrandController.java");

    @Test
    void brandControllerKeepsPublicLimitAndAdminAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/brands\")"));
        assertTrue(source.contains("private static final int DEFAULT_PUBLIC_BRAND_LIMIT = 120;"));
        assertTrue(source.contains("private static final int HARD_PUBLIC_BRAND_LIMIT = 500;"));
        assertTrue(source.contains("brandService.findAll(true, publicBrandLimit())"));
        assertTrue(source.contains("Math.max(1, Math.min(configured, HARD_PUBLIC_BRAND_LIMIT))"));
        assertTrue(source.contains("AdminRoleService.BRANDS_WRITE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.BRANDS_DELETE_PERMISSION"));
        assertTrue(source.contains("auditLogService.record(\"BRAND_CREATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"BRAND_UPDATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"BRAND_DELETE\", \"SUCCESS\""));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.FORBIDDEN, \"Missing admin action permission\")"));
    }
}
