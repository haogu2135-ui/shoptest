package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminIpBlacklistControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/AdminIpBlacklistController.java");

    @Test
    void adminIpBlacklistControllerKeepsPermissionedActionAuditAndMaskingContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/admin/ip-blacklist\")"));
        assertTrue(source.contains("@PreAuthorize(\"hasRole('ADMIN')\")"));
        assertTrue(source.contains("ipBlacklistService.search(status, source, ipAddress, limit)"));
        assertTrue(source.contains("return ipBlacklistService.status()"));
        assertTrue(source.contains("AdminRoleService.IP_BLACKLIST_BLOCK_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.IP_BLACKLIST_RELEASE_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.IP_BLACKLIST_RECORD_FAILURE_PERMISSION"));
        assertTrue(source.contains("auditLogService.record(\"IP_BLACKLIST_BLOCK\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"IP_BLACKLIST_RELEASE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"IP_BLACKLIST_BATCH_RELEASE\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"IP_BLACKLIST_RECORD_LOGIN_FAILURE\", \"SUCCESS\""));
        assertTrue(source.contains("SensitiveDataMasker.mask(value)"));
        assertTrue(source.contains("return normalized.length() > 200 ? normalized.substring(0, 200) : normalized"));
    }
}
