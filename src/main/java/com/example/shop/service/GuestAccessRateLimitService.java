package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

/**
 * Bounds repeated guest credential failures without storing the email or order number.
 * Redis is preferred for multi-instance deployments; the local bucket keeps protection
 * active during a short Redis outage or in single-instance environments.
 */
@Service
@Slf4j
public class GuestAccessRateLimitService {
    private static final int DEFAULT_MAX_FAILURES = 8;
    private static final int DEFAULT_CLIENT_MAX_FAILURES = 30;
    private static final int DEFAULT_WINDOW_MINUTES = 15;
    private static final int DEFAULT_MAX_BUCKETS = 100_000;

    private final RuntimeConfigService runtimeConfig;
    private final ClientIpResolver clientIpResolver;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private volatile Clock clock = Clock.systemUTC();

    public GuestAccessRateLimitService(RuntimeConfigService runtimeConfig,
                                       ClientIpResolver clientIpResolver,
                                       ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.runtimeConfig = runtimeConfig;
        this.clientIpResolver = clientIpResolver;
        this.redisTemplateProvider = redisTemplateProvider;
    }

    /** Rejects a credential or client that has accumulated too many failures. */
    public void assertAllowed(String scope, String orderNo, String email, HttpServletRequest request) {
        Config config = config();
        if (!config.enabled || !hasCredential(orderNo, email)) {
            return;
        }
        long now = Instant.now(clock).getEpochSecond();
        String credentialKey = key("credential", orderNo, email);
        String clientKey = clientKey(request);
        if (currentCount(credentialKey, now, config) >= config.maxFailures
                || (clientKey != null && currentCount(clientKey, now, config) >= config.clientMaxFailures)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Guest access is temporarily rate limited");
        }
    }

    /** Records a failed attempt using only hashed credential and client identifiers. */
    public void recordFailure(String scope, String orderNo, String email, HttpServletRequest request) {
        Config config = config();
        if (!config.enabled || !hasCredential(orderNo, email)) {
            return;
        }
        long now = Instant.now(clock).getEpochSecond();
        increment(key("credential", orderNo, email), now, config);
        String clientKey = clientKey(request);
        if (clientKey != null) {
            increment(clientKey, now, config);
        }
        cleanup(now, config);
    }

    public int activeBucketCount() {
        return buckets.size();
    }

    private boolean hasCredential(String orderNo, String email) {
        return orderNo != null && !orderNo.trim().isEmpty()
                && email != null && !email.trim().isEmpty();
    }

    private Config config() {
        return new Config(
                runtimeConfig.getBoolean("security.guest-access-rate-limit.enabled", true),
                Math.max(1, runtimeConfig.getInt("security.guest-access-rate-limit.max-failures", DEFAULT_MAX_FAILURES)),
                Math.max(1, runtimeConfig.getInt("security.guest-access-rate-limit.client-max-failures", DEFAULT_CLIENT_MAX_FAILURES)),
                Math.max(1, Math.min(1440, runtimeConfig.getInt("security.guest-access-rate-limit.window-minutes", DEFAULT_WINDOW_MINUTES))),
                Math.max(1000, Math.min(500_000, runtimeConfig.getInt("security.guest-access-rate-limit.max-buckets", DEFAULT_MAX_BUCKETS))),
                runtimeConfig.getBoolean("security.guest-access-rate-limit.redis-enabled", true),
                runtimeConfig.getString("security.guest-access-rate-limit.redis-key-prefix", "shop:guest-access"));
    }

    private long currentCount(String key, long now, Config config) {
        StringRedisTemplate redis = redisTemplate(config);
        if (redis != null) {
            try {
                String value = redis.opsForValue().get(redisKey(config, key));
                return value == null ? 0 : Long.parseLong(value);
            } catch (RuntimeException ex) {
                log.warn("Guest access Redis read failed; using local bucket", ex);
            }
        }
        Bucket bucket = buckets.get(key);
        long windowSeconds = config.windowMinutes * 60L;
        if (bucket == null || bucket.windowStart + windowSeconds <= now) {
            return 0;
        }
        return bucket.count;
    }

    private void increment(String key, long now, Config config) {
        StringRedisTemplate redis = redisTemplate(config);
        if (redis != null) {
            try {
                String redisKey = redisKey(config, key);
                Long count = redis.opsForValue().increment(redisKey);
                if (count != null && count == 1L) {
                    redis.expire(redisKey, config.windowMinutes * 60L, TimeUnit.SECONDS);
                } else {
                    Long ttl = redis.getExpire(redisKey, TimeUnit.SECONDS);
                    if (ttl == null || ttl < 0) {
                        redis.expire(redisKey, config.windowMinutes * 60L, TimeUnit.SECONDS);
                    }
                }
                return;
            } catch (RuntimeException ex) {
                log.warn("Guest access Redis write failed; using local bucket", ex);
            }
        }
        long windowSeconds = config.windowMinutes * 60L;
        buckets.compute(key, (ignored, current) -> {
            if (current == null || current.windowStart + windowSeconds <= now) {
                return new Bucket(now, 1);
            }
            current.count++;
            return current;
        });
    }

    private StringRedisTemplate redisTemplate(Config config) {
        if (!config.redisEnabled || redisTemplateProvider == null) {
            return null;
        }
        return redisTemplateProvider.getIfAvailable();
    }

    private String redisKey(Config config, String key) {
        return config.redisPrefix + ":" + key;
    }

    private String clientKey(HttpServletRequest request) {
        String client = clientIpResolver.resolve(request);
        return client == null || client.trim().isEmpty() ? null : key("client", client, null);
    }

    private String key(String kind, String first, String second) {
        String firstValue = normalize(first);
        String secondValue = second == null ? "" : normalize(second);
        return kind + ":" + hash(firstValue + "|" + secondValue);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                result.append(String.format("%02x", item & 0xff));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private void cleanup(long now, Config config) {
        if (buckets.size() <= config.maxBuckets) {
            return;
        }
        long expiry = config.windowMinutes * 60L;
        buckets.entrySet().removeIf(entry -> entry.getValue().windowStart + expiry <= now);
        int overflow = buckets.size() - config.maxBuckets;
        if (overflow <= 0) {
            return;
        }
        buckets.entrySet().stream()
                .sorted((left, right) -> Long.compare(left.getValue().windowStart, right.getValue().windowStart))
                .limit(overflow)
                .forEach(entry -> buckets.remove(entry.getKey(), entry.getValue()));
    }

    private static final class Bucket {
        private final long windowStart;
        private long count;

        private Bucket(long windowStart, long count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }

    private static final class Config {
        private final boolean enabled;
        private final int maxFailures;
        private final int clientMaxFailures;
        private final int windowMinutes;
        private final int maxBuckets;
        private final boolean redisEnabled;
        private final String redisPrefix;

        private Config(boolean enabled, int maxFailures, int clientMaxFailures, int windowMinutes,
                       int maxBuckets, boolean redisEnabled, String redisPrefix) {
            this.enabled = enabled;
            this.maxFailures = maxFailures;
            this.clientMaxFailures = clientMaxFailures;
            this.windowMinutes = windowMinutes;
            this.maxBuckets = maxBuckets;
            this.redisEnabled = redisEnabled;
            this.redisPrefix = redisPrefix == null || redisPrefix.trim().isEmpty()
                    ? "shop:guest-access" : redisPrefix.trim();
        }
    }
}
