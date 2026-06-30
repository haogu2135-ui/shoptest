package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminTrafficControlControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/AdminTrafficControlController.java");

    @Test
    void adminTrafficControlControllerKeepsStatusPermissionAndAuditContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/admin/traffic-control\")"));
        assertTrue(source.contains("@PreAuthorize(\"hasRole('ADMIN')\")"));
        assertTrue(source.contains("response.setRateLimit(rateLimitService.status())"));
        assertTrue(source.contains("response.setCircuitBreakerConfig(circuitBreakerService.configStatus())"));
        assertTrue(source.contains("response.setCircuits(circuitBreakerService.status())"));
        assertTrue(source.contains("AdminRoleService.TRAFFIC_CONTROL_RATE_LIMIT_CLEAR_PERMISSION"));
        assertTrue(source.contains("AdminRoleService.TRAFFIC_CONTROL_CIRCUIT_RESET_PERMISSION"));
        assertTrue(source.contains("rateLimitService.clear()"));
        assertTrue(source.contains("circuitBreakerService.reset(name)"));
        assertTrue(source.contains("circuitBreakerService.normalizeName(name)"));
        assertTrue(source.contains("auditLogService.record(\"TRAFFIC_RATE_LIMIT_CLEAR\", \"SUCCESS\""));
        assertTrue(source.contains("auditLogService.record(\"TRAFFIC_CIRCUIT_RESET\", \"SUCCESS\""));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.FORBIDDEN, \"Missing admin action permission\")"));
    }
}
