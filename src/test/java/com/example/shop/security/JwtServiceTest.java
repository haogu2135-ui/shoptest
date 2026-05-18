package com.example.shop.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtServiceTest {
    private final UserDetails userDetails = User.withUsername("buyer@example.com")
            .password("secret")
            .roles("USER")
            .build();

    @Test
    void rejectsDefaultSecretInProduction() {
        JwtService service = jwtService("production", "your-secret-key-here");

        assertThrows(IllegalStateException.class, () -> service.generateToken(userDetails));
    }

    @Test
    void rejectsShortSecretInProduction() {
        JwtService service = jwtService("prod", "short-secret");

        assertThrows(IllegalStateException.class, () -> service.generateToken(userDetails));
    }

    @Test
    void signsAndReadsTokenWhenProductionSecretIsStrong() {
        JwtService service = jwtService("production", "0123456789abcdef0123456789abcdef");

        String token = service.generateToken(userDetails);

        assertEquals("buyer@example.com", service.extractUsername(token));
    }

    @Test
    void allowsDevModeDefaultSecretForLocalTesting() {
        JwtService service = jwtService("dev", "your-secret-key-here");

        String token = service.generateToken(userDetails);

        assertEquals("buyer@example.com", service.extractUsername(token));
    }

    private JwtService jwtService(String runtimeMode, String secret) {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "runtimeMode", runtimeMode);
        ReflectionTestUtils.setField(service, "jwtSecret", secret);
        ReflectionTestUtils.setField(service, "jwtExpirationInMs", 86400000);
        return service;
    }
}
