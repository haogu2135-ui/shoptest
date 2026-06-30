package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminConfigCenterControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/AdminConfigCenterController.java");

    @Test
    void adminConfigCenterControllerKeepsPermissionedPublishApplyAndAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/admin/config-center\")"));
        assertTrue(source.contains("@PreAuthorize(\"hasRole('ADMIN')\")"));
        assertTrue(source.contains("configCenterService.snapshot(dataId, group, namespace)"));
        assertTrue(source.contains("configCenterService.health(dataId, group, namespace)"));
        assertTrue(source.contains("AdminRoleService.CONFIG_CENTER_PUBLISH_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.CONFIG_CENTER_APPLY_PERMISSION"));
        assertTrue(source.contains("if (request != null && request.isApplyRuntime())"));
        assertTrue(source.contains("ConfigCenterSnapshotResponse response = configCenterService.publish(request)"));
        assertTrue(source.contains("ConfigCenterSnapshotResponse response = configCenterService.apply(request)"));
        assertTrue(source.contains("auditLogService.record(\"CONFIG_PUBLISH\", result"));
        assertTrue(source.contains("auditLogService.record(\"CONFIG_APPLY_RUNTIME\", result"));
        assertTrue(source.contains("namespace=\" + normalizeNamespace(response.getNamespace())"));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.FORBIDDEN, \"Missing admin action permission\")"));
    }
}
