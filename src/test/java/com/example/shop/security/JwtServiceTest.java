package com.example.shop.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import com.example.shop.service.RuntimeConfigService;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
        Date issuedAt = service.extractClaim(token, claims -> claims.getIssuedAt());
        UserDetailsImpl changedPasswordUser = new UserDetailsImpl(
                7L,
                "buyer@example.com",
                "buyer@example.com",
                "ACTIVE",
                "encoded-password",
                LocalDateTime.ofInstant(issuedAt.toInstant().plusMillis(1500), ZoneId.systemDefault()),
                List.of(new SimpleGrantedAuthority("ROLE_USER")));

        assertFalse(service.isTokenValid(token, changedPasswordUser));
    }

    @Test
    void acceptsTokensIssuedInSameSecondAsPasswordChange() {
        JwtService service = jwtService("production", "0123456789abcdef0123456789abcdef");
        String token = service.generateToken(userDetails);
        Date issuedAt = service.extractClaim(token, claims -> claims.getIssuedAt());
        UserDetailsImpl justRegisteredUser = new UserDetailsImpl(
                7L,
                "buyer@example.com",
                "buyer@example.com",
                "ACTIVE",
                "encoded-password",
                LocalDateTime.ofInstant(issuedAt.toInstant().plusMillis(900), ZoneId.systemDefault()),
                List.of(new SimpleGrantedAuthority("ROLE_USER")));

        assertTrue(service.isTokenValid(token, justRegisteredUser));
    }

    @Test
    void rejectsDefaultSecretOutsideProduction() {
        JwtService service = jwtService("dev", "your-secret-key-here");

        assertThrows(IllegalStateException.class, () -> service.generateToken(userDetails));
    }

    @Test
    void signingSecretIsCapturedAtConstructionInsteadOfRuntimeConfig() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getInt("app.jwtExpirationInMs", 7200000)).thenReturn(86400000);
        JwtService service = new JwtService(runtimeConfig, "0123456789abcdef0123456789abcdef");

        String token = service.generateToken(userDetails);

        assertEquals("buyer@example.com", service.extractUsername(token));
        verify(runtimeConfig, never()).getString("app.jwtSecret", "");
    }

    @Test
    void usesCurrentJjwtParserAndKeyApis() throws Exception {
        String source = Files.readString(Path.of("src/main/java/com/example/shop/security/JwtService.java"));
        String pom = Files.readString(Path.of("pom.xml"));

        assertFalse(source.contains("SignatureAlgorithm"));
        assertFalse(source.contains(".setSigningKey("));
        assertFalse(source.contains(".parseClaimsJws("));
        assertTrue(source.contains("Keys.hmacShaKeyFor"));
        assertTrue(source.contains(".verifyWith(signingKey())"));
        assertTrue(source.contains(".parseSignedClaims(token)"));
        assertFalse(source.contains("runtimeConfig.getString(\"app.jwtSecret\""));
        assertFalse(source.contains("security.jwt.secret"));
        assertFalse(source.contains("admin123456"));
        assertFalse(pom.contains("<artifactId>jjwt</artifactId>"));
        assertTrue(pom.contains("<artifactId>jjwt-api</artifactId>"));
        assertTrue(pom.contains("<artifactId>jjwt-impl</artifactId>"));
        assertTrue(pom.contains("<artifactId>jjwt-jackson</artifactId>"));
    }

    private JwtService jwtService(String runtimeMode, String secret) {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn(runtimeMode);
        when(runtimeConfig.getInt("app.jwtExpirationInMs", 7200000)).thenReturn(86400000);
        return new JwtService(runtimeConfig, secret);
    }
}
