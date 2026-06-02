package com.example.shop.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import com.example.shop.service.RuntimeConfigService;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
        assertFalse(service.extractJti(token).isBlank());
        assertTrue(service.getExpirationMs(token) > 0);
    }

    @Test
    void rejectsTokensIssuedBeforePasswordChange() {
        JwtService service = jwtService("production", "0123456789abcdef0123456789abcdef");
        String token = service.generateToken(userDetails);
        UserDetailsImpl changedPasswordUser = new UserDetailsImpl(
                7L,
                "buyer@example.com",
                "buyer@example.com",
                "ACTIVE",
                "encoded-password",
                LocalDateTime.now().plusSeconds(1),
                List.of(new SimpleGrantedAuthority("ROLE_USER")));

        assertFalse(service.isTokenValid(token, changedPasswordUser));
    }

    @Test
    void rejectsDefaultSecretOutsideProduction() {
        JwtService service = jwtService("dev", "your-secret-key-here");

        assertThrows(IllegalStateException.class, () -> service.generateToken(userDetails));
    }

    private JwtService jwtService(String runtimeMode, String secret) {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn(runtimeMode);
        when(runtimeConfig.getString("app.jwtSecret", "")).thenReturn(secret);
        when(runtimeConfig.getInt("app.jwtExpirationInMs", 7200000)).thenReturn(86400000);
        return new JwtService(runtimeConfig);
    }
}
