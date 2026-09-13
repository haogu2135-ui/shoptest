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
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

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
    private static final char[] HEX_DIGITS = "0123456789abcdef".toCharArray();
    private static final Pattern HEX_FINGERPRINT_PATTERN = Pattern.compile("[0-9a-f]{64}");
    private static final ThreadLocal<MessageDigest> SHA_256 = ThreadLocal.withInitial(
            GuestAccessTokenService::newSha256Digest);

    private final RuntimeConfigService runtimeConfig;
    private final String jwtSecret;
    private final SecretKey configuredSigningKey;

    public GuestAccessTokenService(RuntimeConfigService runtimeConfig,
                                   @Value("${app.jwtSecret:}") String jwtSecret) {
        this.runtimeConfig = runtimeConfig;
        this.jwtSecret = jwtSecret == null ? "" : jwtSecret.trim();
        this.configuredSigningKey = hasUsableSecret(this.jwtSecret)
                ? Keys.hmacShaKeyFor(this.jwtSecret.getBytes(StandardCharsets.UTF_8))
                : null;
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
        String normalizedToken = token == null ? "" : token.trim();
        if (normalizedToken.isEmpty()) {
            return null;
        }
        try {
            ensureSecretConfigured();
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey())
                    .build()
                    .parseSignedClaims(normalizedToken)
                    .getPayload();
            if (!TOKEN_TYPE.equals(String.valueOf(claims.get(TYPE_CLAIM)))) {
                return null;
            }
            String orderNo = normalizeOrderNo(claims.get(ORDER_NO_CLAIM));
            String emailFingerprint = normalizeFingerprint(claims.get(EMAIL_FINGERPRINT_CLAIM));
            Date expiration = claims.getExpiration();
            if (orderNo == null || emailFingerprint == null || expiration == null
                    || expiration.before(new Date())) {
                return null;
            }
            return new Access(orderNo, emailFingerprint, claims.getId());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    public boolean matches(String token, String orderNo, String email) {
        Access access = validate(token);
        String normalizedOrderNo = normalizeOrderNo(orderNo);
        String normalizedEmail = normalizeEmail(email);
        return access != null && normalizedOrderNo != null && normalizedEmail != null
                && access.getOrderNo().equalsIgnoreCase(normalizedOrderNo)
                && access.getEmailFingerprint().equals(fingerprintNormalized(normalizedEmail));
    }

    public boolean matchesFingerprint(String token, String orderNo, String emailFingerprint) {
        Access access = validate(token);
        String normalizedOrderNo = normalizeOrderNo(orderNo);
        String normalizedFingerprint = normalizeFingerprint(emailFingerprint);
        return access != null && normalizedOrderNo != null
                && normalizedFingerprint != null
                && access.getOrderNo().equalsIgnoreCase(normalizedOrderNo)
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
        return fingerprintNormalized(normalized);
    }

    private String fingerprintNormalized(String normalized) {
        byte[] digest = SHA_256.get().digest(normalized.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder(digest.length * 2);
        for (byte value : digest) {
            int unsigned = value & 0xff;
            result.append(HEX_DIGITS[unsigned >>> 4]);
            result.append(HEX_DIGITS[unsigned & 0x0f]);
        }
        return result.toString();
    }

    private static MessageDigest newSha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private long ttlMillis() {
        return TimeUnit.MINUTES.toMillis(ttlMinutes());
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
        return HEX_FINGERPRINT_PATTERN.matcher(normalized).matches() ? normalized : null;
    }

    private void ensureSecretConfigured() {
        if (configuredSigningKey == null) {
            throw new IllegalStateException("JWT secret is not configured; set JWT_SECRET to at least 32 characters");
        }
    }

    private SecretKey signingKey() {
        return configuredSigningKey;
    }

    private static boolean hasUsableSecret(String value) {
        return value.length() >= 32
                && !"your-secret-key".equals(value)
                && !"your-secret-key-here".equals(value);
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
