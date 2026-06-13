package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SiteAnnouncementControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/SiteAnnouncementController.java");

    @Test
    void siteAnnouncementControllerKeepsPublicActiveAndAdminAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@GetMapping(\"/announcements/active\")"));
        assertTrue(source.contains("announcementService.findActive(limit)"));
        assertTrue(source.contains("@GetMapping(\"/admin/announcements\")"));
        assertTrue(source.contains("announcementService.findAdminPage(page, size, status, keyword)"));
        assertTrue(source.contains("@GetMapping(\"/admin/announcements/summary\")"));
        assertTrue(source.contains("AdminRoleService.ANNOUNCEMENTS_WRITE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.ANNOUNCEMENTS_DELETE_PERMISSION"));
        assertTrue(source.contains("announcement.setId(null);"));
        assertTrue(source.contains("auditLogService.record(\"ANNOUNCEMENT_CREATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"ANNOUNCEMENT_UPDATE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"ANNOUNCEMENT_DELETE\", \"SUCCESS\""));
    }
}
