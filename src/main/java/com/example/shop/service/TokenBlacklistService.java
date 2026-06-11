package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class TokenBlacklistService {
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final RuntimeConfigService runtimeConfig;
    private final SecureRandom secureRandom = new SecureRandom();

    private static final String REFRESH_TOKEN_PREFIX = "refresh:";
    private static final String BLACKLIST_PREFIX = "blacklist:";
    private static final String LOGIN_ATTEMPT_PREFIX = "login:ip:";
    private static final String ACCOUNT_LOCK_PREFIX = "login:account:";
    private static final long REFRESH_TOKEN_EXPIRE_DAYS = 7;
    private static final int MAX_LOGIN_ATTEMPTS_PER_IP = 5;
    private static final int MAX_LOGIN_ATTEMPTS_PER_ACCOUNT = 10;
    private static final long IP_LOCKOUT_MINUTES = 15;
    private static final long ACCOUNT_LOCKOUT_MINUTES = 30;

    public TokenBlacklistService(ObjectProvider<StringRedisTemplate> redisTemplateProvider,
                                 RuntimeConfigService runtimeConfig) {
        this.redisTemplateProvider = redisTemplateProvider;
        this.runtimeConfig = runtimeConfig;
    }

    public String generateRefreshToken() {
        byte[] bytes = new byte[64];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public void storeRefreshToken(String refreshToken, String username) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;
        redis.opsForValue().set(
                REFRESH_TOKEN_PREFIX + refreshToken,
                username,
                REFRESH_TOKEN_EXPIRE_DAYS,
                TimeUnit.DAYS
        );
    }

    public String consumeRefreshToken(String refreshToken) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return null;
        String key = REFRESH_TOKEN_PREFIX + refreshToken;
        String username = redis.opsForValue().get(key);
        if (username != null) {
            redis.delete(key);
        }
        return username;
    }

    public void revokeRefreshToken(String refreshToken) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;
        redis.delete(REFRESH_TOKEN_PREFIX + refreshToken);
    }

    public void blacklistAccessToken(String tokenJti, long expirationMs) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;
        if (expirationMs <= 0) return;
        redis.opsForValue().set(
                BLACKLIST_PREFIX + tokenJti,
                "1",
                expirationMs,
                TimeUnit.MILLISECONDS
        );
    }

    public boolean isAccessTokenBlacklisted(String tokenJti) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return false;
        return Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + tokenJti));
    }

    public boolean isLoginRateLimited(String clientIp) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return false;
        String key = LOGIN_ATTEMPT_PREFIX + clientIp;
        String count = redis.opsForValue().get(key);
        if (count == null) return false;
        return parseCounter(count) >= maxLoginAttemptsPerIp();
    }

    public void recordLoginFailure(String clientIp, String username) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;

        // Per-IP rate limiting
        String ipKey = LOGIN_ATTEMPT_PREFIX + clientIp;
        Long ipCount = redis.opsForValue().increment(ipKey);
        if (ipCount != null && ipCount == 1) {
            redis.expire(ipKey, ipFailureWindowMinutes(), TimeUnit.MINUTES);
        }

        // Per-account lockout
        String normalizedUsername = normalizeAccountKey(username);
        if (normalizedUsername != null) {
            String accountKey = ACCOUNT_LOCK_PREFIX + normalizedUsername;
            Long accountCount = redis.opsForValue().increment(accountKey);
            if (accountCount != null && accountCount == 1) {
                redis.expire(accountKey, accountLockoutMinutes(), TimeUnit.MINUTES);
            }
        }
    }

    public void clearLoginFailures(String clientIp) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;
        redis.delete(LOGIN_ATTEMPT_PREFIX + clientIp);
    }

    public List<LoginIpFailureSnapshot> findLoginIpFailures() {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return List.of();
        Set<String> keys = redis.keys(LOGIN_ATTEMPT_PREFIX + "*");
        if (keys == null || keys.isEmpty()) return List.of();
        List<LoginIpFailureSnapshot> snapshots = new ArrayList<>();
        for (String key : keys) {
            if (key == null || !key.startsWith(LOGIN_ATTEMPT_PREFIX)) {
                continue;
            }
            String ipAddress = key.substring(LOGIN_ATTEMPT_PREFIX.length());
            int failureCount = parseCounter(redis.opsForValue().get(key));
            if (ipAddress.isBlank() || failureCount <= 0) {
                continue;
            }
            Long ttlSeconds = redis.getExpire(key, TimeUnit.SECONDS);
            snapshots.add(new LoginIpFailureSnapshot(
                    ipAddress,
                    failureCount,
                    ttlSeconds == null ? -1 : ttlSeconds,
                    failureCount >= maxLoginAttemptsPerIp()));
        }
        return snapshots;
    }

    public static class LoginIpFailureSnapshot {
        private final String ipAddress;
        private final int failureCount;
        private final long ttlSeconds;
        private final boolean locked;

        public LoginIpFailureSnapshot(String ipAddress, int failureCount, long ttlSeconds, boolean locked) {
            this.ipAddress = ipAddress;
            this.failureCount = failureCount;
            this.ttlSeconds = ttlSeconds;
            this.locked = locked;
        }

        public String getIpAddress() {
            return ipAddress;
        }

        public int getFailureCount() {
            return failureCount;
        }

        public long getTtlSeconds() {
            return ttlSeconds;
        }

        public boolean isLocked() {
            return locked;
        }
    }

    public void clearAccountFailures(String username) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;
        String normalizedUsername = normalizeAccountKey(username);
        if (normalizedUsername == null) return;
        redis.delete(ACCOUNT_LOCK_PREFIX + normalizedUsername);
    }

    public boolean isAccountLocked(String username) {
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return false;
        String normalizedUsername = normalizeAccountKey(username);
        if (normalizedUsername == null) return false;
        String key = ACCOUNT_LOCK_PREFIX + normalizedUsername;
        String count = redis.opsForValue().get(key);
        if (count == null) return false;
        return parseCounter(count) >= maxLoginAttemptsPerAccount();
    }

    public long getLoginAttemptsRemaining(String clientIp) {
        StringRedisTemplate redis = redisTemplate();
        int maxAttempts = maxLoginAttemptsPerIp();
        if (redis == null) return maxAttempts;
        String key = LOGIN_ATTEMPT_PREFIX + clientIp;
        String count = redis.opsForValue().get(key);
        if (count == null) return maxAttempts;
        return Math.max(0, maxAttempts - parseCounter(count));
    }

    private StringRedisTemplate redisTemplate() {
        return redisTemplateProvider.getIfAvailable();
    }

    private String normalizeAccountKey(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        String normalized = username.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

    private int parseCounter(String value) {
        try {
            return Integer.parseInt(value);
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private int maxLoginAttemptsPerIp() {
        return Math.max(1, runtimeConfig.getInt("security.ip-blacklist.login-failure-threshold", MAX_LOGIN_ATTEMPTS_PER_IP));
    }

    private int maxLoginAttemptsPerAccount() {
        return Math.max(1, runtimeConfig.getInt("security.login.account-failure-threshold", MAX_LOGIN_ATTEMPTS_PER_ACCOUNT));
    }

    private long ipFailureWindowMinutes() {
        return Math.max(1L, runtimeConfig.getLong("security.ip-blacklist.window-minutes", IP_LOCKOUT_MINUTES));
    }

    private long accountLockoutMinutes() {
        return Math.max(1L, runtimeConfig.getLong("security.login.account-lockout-minutes", ACCOUNT_LOCKOUT_MINUTES));
    }
}
