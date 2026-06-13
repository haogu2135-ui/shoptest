package com.example.shop.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
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
    private static final String TRUSTED_IPS_KEY = "security.ip-blacklist.trusted-ips";
    private static final String DEFAULT_TRUSTED_IPS = "127.0.0.1,::1,0:0:0:0:0:0:0:1";
    private static final long REFRESH_TOKEN_EXPIRE_DAYS = 7;
    private static final int MAX_LOGIN_ATTEMPTS_PER_IP = 5;
    private static final int MAX_LOGIN_ATTEMPTS_PER_ACCOUNT = 10;
    private static final int MAX_ACCOUNT_KEY_CHARS = 255;
    private static final long IP_LOCKOUT_MINUTES = 15;
    private static final long ACCOUNT_LOCKOUT_MINUTES = 30;
    private static final int DEFAULT_LOGIN_FAILURE_SCAN_COUNT = 500;
    private static final int MAX_LOCAL_REVOCATION_ENTRIES = 10_000;
    private static final RedisScript<String> CONSUME_REFRESH_TOKEN_SCRIPT = consumeRefreshTokenScript();
    private static final RedisScript<Long> LOGIN_FAILURE_INCREMENT_SCRIPT = loginFailureIncrementScript();
    private final ConcurrentMap<String, Long> localAccessTokenBlacklist = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> localRefreshTokenRevocations = new ConcurrentHashMap<>();

    public TokenBlacklistService(ObjectProvider<StringRedisTemplate> redisTemplateProvider,
                                 RuntimeConfigService runtimeConfig,
                                 ClientIpResolver clientIpResolver) {
        this.redisTemplateProvider = redisTemplateProvider;
        this.runtimeConfig = runtimeConfig;
        this.clientIpResolver = clientIpResolver;
    }

    private final ClientIpResolver clientIpResolver;

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
        if (isLocallyRevokedRefreshToken(refreshToken)) {
            return null;
        }
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return null;
        String key = REFRESH_TOKEN_PREFIX + refreshToken;
        try {
            return redis.execute(CONSUME_REFRESH_TOKEN_SCRIPT, List.of(key));
        } catch (RuntimeException ex) {
            log.warn("Redis refresh token consume failed; refresh is failing closed", ex);
            return null;
        }
    }

    public void revokeRefreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        rememberLocalRefreshTokenRevocation(refreshToken);
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;
        try {
            redis.delete(REFRESH_TOKEN_PREFIX + refreshToken);
        } catch (RuntimeException ex) {
            log.warn("Redis refresh token revoke failed; local revocation fallback is active", ex);
            // Local revocation above keeps this instance fail-closed until Redis recovers.
        }
    }

    public void blacklistAccessToken(String tokenJti, long expirationMs) {
        if (tokenJti == null || tokenJti.isBlank()) return;
        if (expirationMs <= 0) return;
        long expiresAt = System.currentTimeMillis() + expirationMs;
        rememberLocalAccessTokenBlacklist(tokenJti, expiresAt);
        StringRedisTemplate redis = redisTemplate();
        if (redis != null) {
            try {
                redis.opsForValue().set(
                        BLACKLIST_PREFIX + tokenJti,
                        "1",
                        expirationMs,
                        TimeUnit.MILLISECONDS
                );
            } catch (RuntimeException ex) {
                log.warn("Redis access-token blacklist write failed; local blacklist fallback is active", ex);
                // Local blacklist above keeps this instance fail-closed until Redis recovers.
            }
        }
    }

    public boolean isAccessTokenBlacklisted(String tokenJti) {
        if (isLocallyBlacklistedAccessToken(tokenJti)) {
            return true;
        }
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return false;
        try {
            return Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + tokenJti));
        } catch (RuntimeException ex) {
            log.warn("Redis access-token blacklist lookup failed; local blacklist fallback is active", ex);
            return isLocallyBlacklistedAccessToken(tokenJti);
        }
    }

    public boolean isLoginRateLimited(String clientIp) {
        if (isTrustedClientIp(clientIp)) {
            return false;
        }
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return false;
        String key = LOGIN_ATTEMPT_PREFIX + clientIp;
        String count = redis.opsForValue().get(key);
        if (count == null) return false;
        return parseCounter(count) >= maxLoginAttemptsPerIp();
    }

    public void recordLoginFailure(String clientIp, String username) {
        if (isTrustedClientIp(clientIp)) {
            return;
        }
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return;

        // Per-IP rate limiting
        String ipKey = LOGIN_ATTEMPT_PREFIX + clientIp;
        incrementLoginFailureCounter(redis, ipKey, TimeUnit.MINUTES.toSeconds(ipFailureWindowMinutes()));

        // Per-account lockout
        String normalizedUsername = normalizeAccountKey(username);
        if (normalizedUsername != null) {
            String accountKey = ACCOUNT_LOCK_PREFIX + normalizedUsername;
            incrementLoginFailureCounter(redis, accountKey, TimeUnit.MINUTES.toSeconds(accountLockoutMinutes()));
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
        List<String> keys = scanLoginFailureKeys(redis);
        if (keys.isEmpty()) return List.of();
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
            if (isTrustedClientIp(ipAddress)) {
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

    private List<String> scanLoginFailureKeys(StringRedisTemplate redis) {
        int batchSize = Math.max(1, runtimeConfig.getInt("security.ip-blacklist.redis-scan-count", DEFAULT_LOGIN_FAILURE_SCAN_COUNT));
        try {
            List<String> keys = redis.execute((RedisCallback<List<String>>) connection -> {
                List<String> matches = new ArrayList<>();
                ScanOptions options = ScanOptions.scanOptions()
                        .match(LOGIN_ATTEMPT_PREFIX + "*")
                        .count(batchSize)
                        .build();
                try (Cursor<byte[]> cursor = connection.scan(options)) {
                    while (cursor.hasNext()) {
                        matches.add(new String(cursor.next(), StandardCharsets.UTF_8));
                    }
                }
                return matches;
            });
            return keys == null ? List.of() : keys;
        } catch (RuntimeException ex) {
            log.warn("Redis login failure scan failed; returning no login failure snapshots", ex);
            return List.of();
        }
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
        int maxAttempts = maxLoginAttemptsPerIp();
        if (isTrustedClientIp(clientIp)) {
            return maxAttempts;
        }
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) return maxAttempts;
        String key = LOGIN_ATTEMPT_PREFIX + clientIp;
        String count = redis.opsForValue().get(key);
        if (count == null) return maxAttempts;
        return Math.max(0, maxAttempts - parseCounter(count));
    }

    private StringRedisTemplate redisTemplate() {
        return redisTemplateProvider.getIfAvailable();
    }

    private static RedisScript<String> consumeRefreshTokenScript() {
        DefaultRedisScript<String> script = new DefaultRedisScript<>();
        script.setScriptText("local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value");
        script.setResultType(String.class);
        return script;
    }

    private Long incrementLoginFailureCounter(StringRedisTemplate redis, String key, long ttlSeconds) {
        return redis.execute(LOGIN_FAILURE_INCREMENT_SCRIPT, List.of(key), String.valueOf(ttlSeconds));
    }

    private static RedisScript<Long> loginFailureIncrementScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText("local count = redis.call('INCR', KEYS[1]); "
                + "local ttl = redis.call('TTL', KEYS[1]); "
                + "if ttl < 0 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])); end; "
                + "return count");
        script.setResultType(Long.class);
        return script;
    }

    private boolean isTrustedClientIp(String clientIp) {
        if (clientIpResolver == null) {
            return false;
        }
        String normalizedIp = clientIpResolver.normalizeIpAddress(clientIp);
        if (normalizedIp == null || normalizedIp.isBlank()) {
            return false;
        }
        String configured = runtimeConfig.getString(TRUSTED_IPS_KEY, DEFAULT_TRUSTED_IPS);
        return clientIpResolver.matchesAny(normalizedIp, configured);
    }

    private void rememberLocalAccessTokenBlacklist(String tokenJti, long expiresAt) {
        localAccessTokenBlacklist.put(tokenJti, expiresAt);
        pruneLocalExpirations(localAccessTokenBlacklist);
    }

    private boolean isLocallyBlacklistedAccessToken(String tokenJti) {
        if (tokenJti == null || tokenJti.isBlank()) {
            return false;
        }
        Long expiresAt = localAccessTokenBlacklist.get(tokenJti);
        return expiresAt != null && isLocalEntryActive(localAccessTokenBlacklist, tokenJti, expiresAt);
    }

    private void rememberLocalRefreshTokenRevocation(String refreshToken) {
        long expiresAt = System.currentTimeMillis() + TimeUnit.DAYS.toMillis(REFRESH_TOKEN_EXPIRE_DAYS);
        localRefreshTokenRevocations.put(refreshToken, expiresAt);
        pruneLocalExpirations(localRefreshTokenRevocations);
    }

    private boolean isLocallyRevokedRefreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return false;
        }
        Long expiresAt = localRefreshTokenRevocations.get(refreshToken);
        return expiresAt != null && isLocalEntryActive(localRefreshTokenRevocations, refreshToken, expiresAt);
    }

    private boolean isLocalEntryActive(ConcurrentMap<String, Long> entries, String key, long expiresAt) {
        if (expiresAt <= System.currentTimeMillis()) {
            entries.remove(key, expiresAt);
            return false;
        }
        return true;
    }

    private void pruneLocalExpirations(ConcurrentMap<String, Long> entries) {
        if (entries.size() <= MAX_LOCAL_REVOCATION_ENTRIES) {
            return;
        }
        long now = System.currentTimeMillis();
        for (Map.Entry<String, Long> entry : entries.entrySet()) {
            if (entry.getValue() == null || entry.getValue() <= now) {
                entries.remove(entry.getKey(), entry.getValue());
            }
        }
    }

    private String normalizeAccountKey(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        String normalized = username.replaceAll("\\p{Cntrl}", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();
        if (normalized.isBlank() || normalized.length() > MAX_ACCOUNT_KEY_CHARS) {
            return null;
        }
        return normalized;
    }

    private int parseCounter(String value) {
        try {
            return Integer.parseInt(value);
        } catch (RuntimeException ex) {
            log.debug("Invalid login failure counter value ignored: {}", value, ex);
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
