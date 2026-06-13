package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminBugReportControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/AdminBugReportController.java");

    @Test
    void adminBugReportControllerKeepsPermissionedWorkflowAndAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/admin/bugs\")"));
        assertTrue(source.contains("@PreAuthorize(\"hasRole('ADMIN')\")"));
        assertTrue(source.contains("bugReportService.search(page, size, status, severity, module, keyword, scanQueueOnly)"));
        assertTrue(source.contains("bugReportService.summary()"));
        assertTrue(source.contains("AdminRoleService.BUGS_WRITE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.BUGS_STATUS_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.BUGS_SCAN_PERMISSION"));
        assertTrue(source.contains("adminRoleService.hasAnyBugPermission(user.getId())"));
        assertTrue(source.contains("auditLogService.record(\"BUG_CREATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"BUG_UPDATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"BUG_SCAN\", \"SUCCESS\""));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.FORBIDDEN, \"Missing admin read permission\")"));
    }
}
