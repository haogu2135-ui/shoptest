package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminAlertControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/AdminAlertController.java");

    @Test
    void adminAlertControllerKeepsPermissionedActionAndAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/admin/alerts\")"));
        assertTrue(source.contains("@PreAuthorize(\"hasRole('ADMIN')\")"));
        assertTrue(source.contains("systemAlertService.search(status, severity, category, limit)"));
        assertTrue(source.contains("systemAlertService.summary()"));
        assertTrue(source.contains("AdminRoleService.ALERTS_SELF_CHECK_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.ALERTS_ACKNOWLEDGE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.ALERTS_RESOLVE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.ALERTS_PURGE_PERMISSION"));
        assertTrue(source.contains("auditLogService.record(\"ALERT_SELF_CHECK\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"ALERT_BATCH_ACKNOWLEDGE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"ALERT_PURGE_RESOLVED\", \"SUCCESS\""));
    }
}
