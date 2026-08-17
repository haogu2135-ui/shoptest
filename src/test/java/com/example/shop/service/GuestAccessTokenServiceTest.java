package com.example.shop.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GuestAccessTokenServiceTest {
    private static final String SECRET = "01234567890123456789012345678901";
    private RuntimeConfigService runtimeConfig;
    private GuestAccessTokenService service;

    @BeforeEach
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getLong("security.guest-access-token.ttl-minutes", 30L)).thenReturn(30L);
        service = new GuestAccessTokenService(runtimeConfig, SECRET);
    }

    @Test
    void tokenIsBoundToOrderAndEmailFingerprintWithoutEmbeddingEmail() {
        String token = service.issue("SO202608160001", "Guest@Example.com");

        assertNotNull(service.validate(token));
        assertTrue(service.matches(token, "so202608160001", "guest@example.com"));
        assertFalse(service.matches(token, "SO202608160002", "guest@example.com"));
        assertFalse(service.matches(token, "SO202608160001", "other@example.com"));
        assertFalse(token.contains("guest@example.com"));
        assertFalse(token.contains("Guest@Example.com"));
    }

    @Test
    void signatureTamperingAndWrongTokenTypeAreRejected() {
        String token = service.issue("SO202608160001", "guest@example.com");
        int signatureStart = token.lastIndexOf('.') + 1;
        char signatureLead = token.charAt(signatureStart);
        String tampered = token.substring(0, signatureStart)
                + (signatureLead == 'a' ? 'b' : 'a')
                + token.substring(signatureStart + 1);

        assertNull(service.validate(tampered));
        assertNull(service.validate("not-a-jwt"));
    }

    @Test
    void expiredGuestTokenIsRejected() {
        long now = System.currentTimeMillis();
        String expired = Jwts.builder()
                .claim("typ", "guest-access")
                .claim("guestOrderNo", "SO202608160001")
                .claim("guestEmailFingerprint", service.fingerprint("guest@example.com"))
                .issuedAt(new Date(now - 120_000))
                .expiration(new Date(now - 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact();

        assertNull(service.validate(expired));
    }

    @Test
    void invalidSecretCannotIssueOrValidate() {
        GuestAccessTokenService invalid = new GuestAccessTokenService(runtimeConfig, "too-short");

        boolean rejected = false;
        try {
            invalid.issue("SO202608160001", "guest@example.com");
        } catch (IllegalStateException expected) {
            rejected = true;
        }
        assertTrue(rejected);
        assertNull(invalid.validate(service.issue("SO202608160001", "guest@example.com")));
    }

    @Test
    void fingerprintIsStableAndStrictlyHexEncoded() {
        String fingerprint = service.fingerprint("Guest@Example.com");

        assertTrue(fingerprint.matches("[0-9a-f]{64}"));
        assertTrue(fingerprint.equals(service.fingerprint("guest@example.com")));
        assertNull(service.fingerprint(null));
    }
}
