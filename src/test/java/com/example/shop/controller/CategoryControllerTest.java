package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CategoryControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/CategoryController.java");

    @Test
    void categoryControllerKeepsPublicTreeAndAdminAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/categories\")"));
        assertTrue(source.contains("categoryService.findByParentId(parentId)"));
        assertTrue(source.contains("categoryService.findByLevel(level)"));
        assertTrue(source.contains("categoryService.findTopLevel()"));
        assertTrue(source.contains("findByIdWithProductCount(id)"));
        assertTrue(source.contains("CategoryPublicResponse::from"));
        assertTrue(source.contains("AdminRoleService.CATEGORIES_WRITE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.CATEGORIES_DELETE_PERMISSION"));
        assertTrue(source.contains("auditLogService.record(\"CATEGORY_CREATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"CATEGORY_UPDATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"CATEGORY_DELETE\", \"SUCCESS\""));
    }
}
