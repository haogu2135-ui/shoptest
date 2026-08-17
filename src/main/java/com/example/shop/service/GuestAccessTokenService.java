package com.example.shop.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Issues short-lived, order-bound guest access tokens. The token contains an
 * email fingerprint rather than the raw email so a decoded JWT does not leak
 * the guest's contact address.
 */
@Service
public class GuestAccessTokenService {
    public static final String HEADER_NAME = "X-Guest-Access-Token";
    private static final String TOKEN_TYPE = "guest-access";
    private static final String TYPE_CLAIM = "typ";
    private static final String ORDER_NO_CLAIM = "guestOrderNo";
    private static final String EMAIL_FINGERPRINT_CLAIM = "guestEmailFingerprint";
    private static final long DEFAULT_TTL_MINUTES = 30;

    private final RuntimeConfigService runtimeConfig;
    private final String jwtSecret;

    public GuestAccessTokenService(RuntimeConfigService runtimeConfig,
                                   @Value("${app.jwtSecret:}") String jwtSecret) {
        this.runtimeConfig = runtimeConfig;
        this.jwtSecret = jwtSecret == null ? "" : jwtSecret.trim();
    }

    public String issue(String orderNo, String email) {
        String normalizedOrderNo = normalizeOrderNo(orderNo);
        String normalizedEmail = normalizeEmail(email);
        if (normalizedOrderNo == null || normalizedEmail == null) {
            throw new IllegalArgumentException("Guest order credentials are required");
        }
        ensureSecretConfigured();
        long now = System.currentTimeMillis();
        long ttl = ttlMillis();
        Map<String, Object> claims = new HashMap<>();
        claims.put(TYPE_CLAIM, TOKEN_TYPE);
        claims.put(ORDER_NO_CLAIM, normalizedOrderNo);
        claims.put(EMAIL_FINGERPRINT_CLAIM, fingerprint(normalizedEmail));
        return Jwts.builder()
                .claims(claims)
                .id(UUID.randomUUID().toString())
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttl))
                .signWith(signingKey(), Jwts.SIG.HS256)
                .compact();
    }

    public Access validate(String token) {
        if (token == null || token.trim().isEmpty()) {
            return null;
        }
        try {
            ensureSecretConfigured();
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey())
                    .build()
                    .parseSignedClaims(token.trim())
                    .getPayload();
            if (!TOKEN_TYPE.equals(String.valueOf(claims.get(TYPE_CLAIM)))) {
                return null;
            }
            String orderNo = normalizeOrderNo(claims.get(ORDER_NO_CLAIM));
            String emailFingerprint = normalizeFingerprint(claims.get(EMAIL_FINGERPRINT_CLAIM));
            if (orderNo == null || emailFingerprint == null || claims.getExpiration() == null
                    || claims.getExpiration().before(new Date())) {
                return null;
            }
            return new Access(orderNo, emailFingerprint, claims.getId());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    public boolean matches(String token, String orderNo, String email) {
        Access access = validate(token);
        String normalizedEmail = normalizeEmail(email);
        return access != null
                && access.getOrderNo().equalsIgnoreCase(normalizeOrderNo(orderNo))
                && access.getEmailFingerprint().equals(fingerprint(normalizedEmail));
    }

    public boolean matchesFingerprint(String token, String orderNo, String emailFingerprint) {
        Access access = validate(token);
        String normalizedFingerprint = normalizeFingerprint(emailFingerprint);
        return access != null
                && access.getOrderNo().equalsIgnoreCase(normalizeOrderNo(orderNo))
                && access.getEmailFingerprint().equals(normalizedFingerprint);
    }

    public long ttlMinutes() {
        return Math.max(5, Math.min(1440,
                runtimeConfig.getLong("security.guest-access-token.ttl-minutes", DEFAULT_TTL_MINUTES)));
    }

    public String fingerprint(String email) {
        String normalized = normalizeEmail(email);
        if (normalized == null) {
            return null;
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                result.append(String.format(Locale.ROOT, "%02x", value));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private long ttlMillis() {
        return Duration.ofMinutes(ttlMinutes()).toMillis();
    }

    private String normalizeOrderNo(Object value) {
        if (value == null) return null;
        String normalized = String.valueOf(value).trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeEmail(String value) {
        if (value == null) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeFingerprint(Object value) {
        if (value == null) return null;
        String normalized = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        return normalized.matches("[0-9a-f]{64}") ? normalized : null;
    }

    private void ensureSecretConfigured() {
        if (jwtSecret.isEmpty()
                || "your-secret-key".equals(jwtSecret)
                || "your-secret-key-here".equals(jwtSecret)
                || jwtSecret.length() < 32) {
            throw new IllegalStateException("JWT secret is not configured; set JWT_SECRET to at least 32 characters");
        }
    }

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public static final class Access {
        private final String orderNo;
        private final String emailFingerprint;
        private final String tokenId;

        public Access(String orderNo, String emailFingerprint, String tokenId) {
            this.orderNo = orderNo;
            this.emailFingerprint = emailFingerprint;
            this.tokenId = tokenId;
        }

        public String getOrderNo() {
            return orderNo;
        }

        public String getEmailFingerprint() {
            return emailFingerprint;
        }

        public String getTokenId() {
            return tokenId;
        }
    }
}
