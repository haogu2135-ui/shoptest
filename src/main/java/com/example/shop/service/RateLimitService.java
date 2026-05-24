package com.example.shop.service;

import com.example.shop.dto.TrafficControlStatusResponse;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
public class RateLimitService {
    private final RuntimeConfigService runtimeConfig;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong acceptedRequests = new AtomicLong();
    private final AtomicLong rejectedRequests = new AtomicLong();

    public RateLimitService(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public Decision check(HttpServletRequest request, Authentication authentication) {
        Config config = config();
        if (!config.enabled || shouldSkip(request, config)) {
            acceptedRequests.incrementAndGet();
            return Decision.allowed(config.limitFor(resolveScope(request, authentication)), config.windowSeconds);
        }

        Scope scope = resolveScope(request, authentication);
        int limit = config.limitFor(scope);
        if (limit <= 0) {
            acceptedRequests.incrementAndGet();
            return Decision.allowed(limit, config.windowSeconds);
        }

        long now = Instant.now().getEpochSecond();
        long windowStart = now - Math.floorMod(now, config.windowSeconds);
        String client = clientKey(request, authentication);
        String method = request.getMethod() == null ? "" : request.getMethod().toUpperCase(Locale.ROOT);
        String path = normalizePath(request);
        String key = scope.name() + ":" + client + ":" + method + ":" + path;
        Bucket bucket = buckets.compute(key, (ignored, current) -> {
            if (current == null || current.windowStart != windowStart) {
                return new Bucket(scope.name(), client, method, path, windowStart, 1);
            }
            current.count++;
            return current;
        });
        cleanup(windowStart, config.windowSeconds);

        long remaining = Math.max(0, limit - bucket.count);
        long resetAt = windowStart + config.windowSeconds;
        if (bucket.count > limit) {
            rejectedRequests.incrementAndGet();
            return Decision.rejected(limit, remaining, Math.max(1, resetAt - now), resetAt);
        }
        acceptedRequests.incrementAndGet();
        return Decision.accepted(limit, remaining, Math.max(1, resetAt - now), resetAt);
    }

    public TrafficControlStatusResponse.RateLimitStatus status() {
        Config config = config();
        TrafficControlStatusResponse.RateLimitStatus status = new TrafficControlStatusResponse.RateLimitStatus();
        status.setEnabled(config.enabled);
        status.setPublicPerMinute(config.publicPerMinute);
        status.setAuthenticatedPerMinute(config.authenticatedPerMinute);
        status.setAdminPerMinute(config.adminPerMinute);
        status.setWindowSeconds(config.windowSeconds);
        status.setActiveBuckets(buckets.size());
        status.setAcceptedRequests(acceptedRequests.get());
        status.setRejectedRequests(rejectedRequests.get());
        status.setHotBuckets(hotBuckets(config));
        return status;
    }

    public void clear() {
        buckets.clear();
        acceptedRequests.set(0);
        rejectedRequests.set(0);
    }

    private Config config() {
        return new Config(
                runtimeConfig.getBoolean("traffic.rate-limit.enabled", true),
                positiveInt("traffic.rate-limit.public-per-minute", 120),
                positiveInt("traffic.rate-limit.authenticated-per-minute", 300),
                positiveInt("traffic.rate-limit.admin-per-minute", 600),
                Math.max(5, Math.min(3600, runtimeConfig.getInt("traffic.rate-limit.window-seconds", 60))),
                parseCsv(runtimeConfig.getString("traffic.rate-limit.skip-path-prefixes", "/actuator/health,/actuator/info,/uploads/,/ws/"))
        );
    }

    private int positiveInt(String key, int fallback) {
        return Math.max(0, runtimeConfig.getInt(key, fallback));
    }

    private boolean shouldSkip(HttpServletRequest request, Config config) {
        if (request == null || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = normalizePath(request);
        return config.skipPrefixes.stream().anyMatch(prefix -> !prefix.isEmpty() && path.startsWith(prefix));
    }

    private Scope resolveScope(HttpServletRequest request, Authentication authentication) {
        String path = normalizePath(request);
        if (path.startsWith("/admin")) {
            return Scope.ADMIN;
        }
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() != null
                && !"anonymousUser".equals(String.valueOf(authentication.getPrincipal()))) {
            return Scope.AUTHENTICATED;
        }
        return Scope.PUBLIC;
    }

    private String clientKey(HttpServletRequest request, Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getName() != null && !"anonymousUser".equals(authentication.getName())) {
            return "user:" + authentication.getName();
        }
        return "ip:" + clientIp(request);
    }

    private String clientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private String normalizePath(HttpServletRequest request) {
        String path = request == null ? "" : request.getRequestURI();
        if (path == null || path.isBlank()) {
            return "/";
        }
        return path.toLowerCase(Locale.ROOT);
    }

    private Set<String> parseCsv(String value) {
        return Arrays.stream((value == null ? "" : value).split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .collect(Collectors.toSet());
    }

    private void cleanup(long currentWindowStart, int windowSeconds) {
        if (buckets.size() < 5000) {
            return;
        }
        long oldest = currentWindowStart - (long) windowSeconds * 2;
        buckets.entrySet().removeIf(entry -> entry.getValue().windowStart < oldest);
    }

    private List<TrafficControlStatusResponse.RateLimitBucketStatus> hotBuckets(Config config) {
        long now = Instant.now().getEpochSecond();
        long oldest = now - (long) config.windowSeconds * 2;
        return buckets.values().stream()
                .filter(bucket -> bucket.windowStart >= oldest)
                .sorted(Comparator.comparingLong((Bucket bucket) -> bucket.count).reversed())
                .limit(10)
                .map(bucket -> toBucketStatus(bucket, config))
                .collect(Collectors.toList());
    }

    private TrafficControlStatusResponse.RateLimitBucketStatus toBucketStatus(Bucket bucket, Config config) {
        TrafficControlStatusResponse.RateLimitBucketStatus status = new TrafficControlStatusResponse.RateLimitBucketStatus();
        Scope scope = parseScope(bucket.scope);
        int limit = config.limitFor(scope);
        status.setScope(bucket.scope);
        status.setClient(maskClient(bucket.client));
        status.setMethod(bucket.method);
        status.setPath(bucket.path);
        status.setCount(bucket.count);
        status.setRemaining(Math.max(0, limit - bucket.count));
        status.setResetAt(Instant.ofEpochSecond(bucket.windowStart + config.windowSeconds).toString());
        return status;
    }

    private Scope parseScope(String value) {
        try {
            return Scope.valueOf(value);
        } catch (RuntimeException ignored) {
            return Scope.PUBLIC;
        }
    }

    private String maskClient(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        if (value.startsWith("user:")) {
            return value.length() <= 18 ? value : value.substring(0, 18) + "...";
        }
        return value;
    }

    private enum Scope {
        PUBLIC,
        AUTHENTICATED,
        ADMIN
    }

    private static class Config {
        private final boolean enabled;
        private final int publicPerMinute;
        private final int authenticatedPerMinute;
        private final int adminPerMinute;
        private final int windowSeconds;
        private final Set<String> skipPrefixes;

        private Config(boolean enabled, int publicPerMinute, int authenticatedPerMinute, int adminPerMinute, int windowSeconds, Set<String> skipPrefixes) {
            this.enabled = enabled;
            this.publicPerMinute = publicPerMinute;
            this.authenticatedPerMinute = authenticatedPerMinute;
            this.adminPerMinute = adminPerMinute;
            this.windowSeconds = windowSeconds;
            this.skipPrefixes = skipPrefixes;
        }

        private int limitFor(Scope scope) {
            if (scope == Scope.ADMIN) {
                return adminPerMinute;
            }
            if (scope == Scope.AUTHENTICATED) {
                return authenticatedPerMinute;
            }
            return publicPerMinute;
        }
    }

    private static class Bucket {
        private final String scope;
        private final String client;
        private final String method;
        private final String path;
        private final long windowStart;
        private long count;

        private Bucket(String scope, String client, String method, String path, long windowStart, long count) {
            this.scope = scope;
            this.client = client;
            this.method = method;
            this.path = path;
            this.windowStart = windowStart;
            this.count = count;
        }
    }

    public static class Decision {
        private final boolean allowed;
        private final int limit;
        private final long remaining;
        private final long retryAfterSeconds;
        private final long resetAtEpochSeconds;

        private Decision(boolean allowed, int limit, long remaining, long retryAfterSeconds, long resetAtEpochSeconds) {
            this.allowed = allowed;
            this.limit = limit;
            this.remaining = remaining;
            this.retryAfterSeconds = retryAfterSeconds;
            this.resetAtEpochSeconds = resetAtEpochSeconds;
        }

        private static Decision allowed(int limit, int windowSeconds) {
            long now = Instant.now().getEpochSecond();
            return new Decision(true, limit, Math.max(0, limit), windowSeconds, now + windowSeconds);
        }

        private static Decision accepted(int limit, long remaining, long retryAfterSeconds, long resetAtEpochSeconds) {
            return new Decision(true, limit, remaining, retryAfterSeconds, resetAtEpochSeconds);
        }

        private static Decision rejected(int limit, long remaining, long retryAfterSeconds, long resetAtEpochSeconds) {
            return new Decision(false, limit, remaining, retryAfterSeconds, resetAtEpochSeconds);
        }

        public boolean isAllowed() {
            return allowed;
        }

        public int getLimit() {
            return limit;
        }

        public long getRemaining() {
            return remaining;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }

        public long getResetAtEpochSeconds() {
            return resetAtEpochSeconds;
        }
    }
}
