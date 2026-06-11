package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;

import org.junit.jupiter.api.Test;

class AdminAuthenticationSourceContractTest {
    @Test
    void adminRequestsAuthenticateThroughSingleBearerJwtSource() throws Exception {
        String securityConfig = Files.readString(Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));
        String jwtFilter = Files.readString(Paths.get("src/main/java/com/example/shop/security/JwtAuthenticationFilter.java"));

        assertTrue(securityConfig.contains(".antMatchers(\"/admin/**\").hasRole(\"ADMIN\")"));
        assertTrue(securityConfig.contains("addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)"));
        assertTrue(jwtFilter.contains("request.getHeader(\"Authorization\")"));
        assertTrue(jwtFilter.contains("authHeader.startsWith(\"Bearer \")"));

        assertFalse(securityConfig.contains("adminJwtFilter"));
        assertFalse(jwtFilter.contains("adminJwtFilter"));
        assertFalse(jwtFilter.contains("getCookies()"));
        assertFalse(jwtFilter.contains("Sec-WebSocket-Protocol"));
        assertFalse(jwtFilter.contains("admin_token"));
        assertFalse(jwtFilter.contains("adminToken"));
    }
}
