package com.example.shop.service;

import com.example.shop.dto.TrafficControlStatusResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

@Service
@Slf4j
public class RateLimitService {
    private static final char[] HEX_DIGITS = "0123456789abcdef".toCharArray();
    private static final Pattern REDIS_PREFIX_UNSAFE_PATTERN = Pattern.compile("[^A-Za-z0-9:_-]");
    private static final Pattern REDIS_SEGMENT_UNSAFE_PATTERN = Pattern.compile("[^a-z0-9:_*-]");
    private static final Pattern NUMERIC_SEGMENT_PATTERN = Pattern.compile("\\d+");
    private static final Pattern UUID_SEGMENT_PATTERN = Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final Pattern HEX_SEGMENT_PATTERN = Pattern.compile("[0-9a-f]{16,}");
    private static final Pattern ORDER_SEGMENT_PATTERN = Pattern.compile("so\\d{10,}[0-9a-z]*");
    private static final Set<String> SENSITIVE_AUTH_PATHS = Set.of(
            "/auth/login", "/auth/register", "/auth/forgot-password",
            "/auth/password-reset-code", "/auth/email-code", "/auth/email-login", "/auth/refresh");
    private static final Set<String> PAYMENT_SYNC_PATHS = Set.of(
            "/payment/{id}/sync", "/payment/{orderNo}/sync", "/payment/order/{id}/sync",
            "/payments/{id}/sync", "/payments/{orderNo}/sync", "/payments/order/{id}/sync");
    private static final Set<String> PAYMENT_CALLBACK_PATHS = Set.of(
            "/payment/callback", "/payments/callback", "/payment/stripe/webhook",
            "/payments/stripe/webhook", "/payment/mercado-pago/webhook",
            "/payment/mercadopago/webhook", "/payments/mercado-pago/webhook",
            "/payments/mercadopago/webhook");
    private static final Set<String> ADMIN_ORDER_LIST_PATHS = Set.of("/admin/orders", "/admin/orders/page");

    private final RuntimeConfigService runtimeConfig;
    private final ClientIpResolver clientIpResolver;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong acceptedRequests = new AtomicLong();
    private final AtomicLong rejectedRequests = new AtomicLong();
    private volatile Clock clock = Clock.systemUTC();

    public RateLimitService(RuntimeConfigService runtimeConfig, ClientIpResolver clientIpResolver) {
        this(runtimeConfig, clientIpResolver, null);
    }

    @Autowired
    public RateLimitService(RuntimeConfigService runtimeConfig,
                            ClientIpResolver clientIpResolver,
                            ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.runtimeConfig = runtimeConfig;
        this.clientIpResolver = clientIpResolver;
        this.redisTemplateProvider = redisTemplateProvider;
    }

    public Decision check(HttpServletRequest request, Authentication authentication) {
        Config config = config();
        long now = nowEpochSecond();
        String path = normalizePath(request);
        if (!config.enabled || shouldSkip(request, config, path)) {
            acceptedRequests.incrementAndGet();
            return Decision.allowed(config.limitFor(resolveScope(path, authentication)), config.windowSeconds, now);
        }

        Scope scope = resolveScope(path, authentication);
        List<LimitKey> limits = resolveLimits(request, authentication, config, scope, path);
        if (limits.isEmpty()) {
            acceptedRequests.incrementAndGet();
            return Decision.allowed(config.limitFor(scope), config.windowSeconds, now);
        }

        List<ConsumedLimit> consumedLimits = new ArrayList<>(limits.size());
        for (LimitKey limitKey : limits) {
            if (limitKey.limit <= 0) {
                continue;
            }
            consumedLimits.add(consume(limitKey, now, config));
        }
        cleanup(now, config);

        if (consumedLimits.isEmpty()) {
            acceptedRequests.incrementAndGet();
            return Decision.allowed(config.limitFor(scope), config.windowSeconds, now);
        }

        ConsumedLimit rejected = null;
        ConsumedLimit mostConstrained = null;
        for (ConsumedLimit consumedLimit : consumedLimits) {
            if (consumedLimit.count > consumedLimit.limit
                    && (rejected == null || consumedLimit.retryAfterSeconds > rejected.retryAfterSeconds)) {
                rejected = consumedLimit;
            }
            if (mostConstrained == null || consumedLimit.remaining < mostConstrained.remaining) {
                mostConstrained = consumedLimit;
            }
        }
        if (rejected != null) {
            rejectedRequests.incrementAndGet();
            return Decision.rejected(rejected.limit, rejected.remaining, rejected.retryAfterSeconds, rejected.resetAtEpochSeconds);
        }
        acceptedRequests.incrementAndGet();
        return Decision.accepted(mostConstrained.limit, mostConstrained.remaining,
                mostConstrained.retryAfterSeconds, mostConstrained.resetAtEpochSeconds);
    }

    public TrafficControlStatusResponse.RateLimitStatus status() {
        Config config = config();
        TrafficControlStatusResponse.RateLimitStatus status = new TrafficControlStatusResponse.RateLimitStatus();
        status.setEnabled(config.enabled);
        status.setPublicPerMinute(config.publicPerMinute);
        status.setAuthenticatedPerMinute(config.authenticatedPerMinute);
        status.setAdminPerMinute(config.adminPerMinute);
        status.setWindowSeconds(config.windowSeconds);
        status.setMaxBuckets(config.maxBuckets);
        status.setActiveBuckets(buckets.size());
        status.setAcceptedRequests(acceptedRequests.get());
        status.setRejectedRequests(rejectedRequests.get());
        status.setHotBuckets(hotBuckets());
        return status;
    }

    public void clear() {
        buckets.clear();
        acceptedRequests.set(0);
        rejectedRequests.set(0);
        clearRedisBuckets();
    }

    private void clearRedisBuckets() {
        Config config = config();
        if (!config.redisEnabled) {
            return;
        }
        StringRedisTemplate redis = redisTemplate();
        if (redis == null) {
            return;
        }
        try {
            int batchSize = config.redisClearScanCount;
            String redisPattern = redisPrefix(config.redisKeyPrefix) + ":*";
            redis.execute((RedisCallback<Void>) connection -> {
                ScanOptions options = ScanOptions.scanOptions()
                        .match(redisPattern)
                        .count(batchSize)
                        .build();
                List<byte[]> batch = new ArrayList<>(batchSize);
                try (Cursor<byte[]> cursor = connection.scan(options)) {
                    while (cursor.hasNext()) {
                        batch.add(cursor.next());
                        if (batch.size() >= batchSize) {
                            connection.del(batch.toArray(new byte[0][]));
                            batch.clear();
                        }
                    }
                    if (!batch.isEmpty()) {
                        connection.del(batch.toArray(new byte[0][]));
                    }
                }
                return null;
            });
        } catch (RuntimeException ex) {
            log.warn("Redis rate-limit bucket clear failed; local counters were cleared", ex);
            // Local counters are already cleared; Redis errors should not block admin recovery.
        }
    }

    private Config config() {
        return new Config(
                runtimeConfig.getBoolean("traffic.rate-limit.enabled", true),
                positiveInt("traffic.rate-limit.public-per-minute", 120),
                positiveInt("traffic.rate-limit.authenticated-per-minute", 300),
                positiveInt("traffic.rate-limit.admin-per-minute", 600),
                Math.max(5, Math.min(3600, runtimeConfig.getInt("traffic.rate-limit.window-seconds", 60))),
                Math.max(100, Math.min(100000, runtimeConfig.getInt("traffic.rate-limit.max-buckets", 5000))),
                positiveInt("traffic.rate-limit.auth-sensitive-per-minute", 30),
                positiveInt("traffic.rate-limit.register-per-hour", 5),
                positiveInt("traffic.rate-limit.password-reset-per-hour", 5),
                positiveInt("traffic.rate-limit.email-login-per-minute", 10),
                positiveInt("traffic.rate-limit.refresh-per-minute", 20),
                positiveInt("traffic.rate-limit.admin-bootstrap-per-hour", 3),
                positiveInt("traffic.rate-limit.guest-checkout-per-hour", 10),
                positiveInt("traffic.rate-limit.search-per-minute", 30),
                positiveInt("traffic.rate-limit.checkout-payment-per-minute", 20),
                positiveInt("traffic.rate-limit.payment-sync-per-minute", 30),
                positiveInt("traffic.rate-limit.payment-callback-per-minute", 60),
                positiveInt("traffic.rate-limit.guest-order-lookup-per-minute", 20),
                positiveInt("traffic.rate-limit.guest-order-mutation-per-minute", 10),
                positiveInt("traffic.rate-limit.admin-order-list-per-minute", 60),
                positiveInt("traffic.rate-limit.admin-bug-create-per-minute", 20),
                positiveInt("traffic.rate-limit.cart-write-per-minute", 60),
                positiveInt("traffic.rate-limit.pet-gallery-like-per-minute", 20),
                runtimeConfig.getBoolean("traffic.rate-limit.redis-enabled", true),
                runtimeConfig.getString("traffic.rate-limit.redis-key-prefix", "shop:rate-limit"),
                Math.max(10, Math.min(5000, runtimeConfig.getInt("traffic.rate-limit.redis-clear-scan-count", 500))),
                parseCsv(runtimeConfig.getString("traffic.rate-limit.skip-path-prefixes", "/actuator/health,/actuator/info,/uploads/,/ws/"))
        );
    }

    private int positiveInt(String key, int fallback) {
        return Math.max(0, runtimeConfig.getInt(key, fallback));
    }

    private boolean shouldSkip(HttpServletRequest request, Config config, String path) {
        if (request == null || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        for (String prefix : config.skipPrefixes) {
            if (!prefix.isEmpty() && path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private Scope resolveScope(String path, Authentication authentication) {
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
        String authenticatedName = authentication == null ? null : authentication.getName();
        if (authentication != null && authentication.isAuthenticated()
                && authenticatedName != null && !"anonymousUser".equals(authenticatedName)) {
            return "user:" + authenticatedName;
        }
        String clientIp = clientIpResolver.resolve(request);
        return "ip:" + (clientIp.isBlank() ? "unknown" : clientIp);
    }

    private List<LimitKey> resolveLimits(HttpServletRequest request, Authentication authentication, Config config, Scope scope,
                                         String path) {
        List<LimitKey> limits = new ArrayList<>(3);
        String client = clientKey(request, authentication);
        String method = request.getMethod() == null ? "" : request.getMethod().toUpperCase(Locale.ROOT);

        EndpointLimit endpointLimit = endpointLimitFor(method, path, config);
        if (isSensitiveAuthEndpoint(method, path)) {
            limits.add(new LimitKey(scope, client, "*", "auth:sensitive", config.authSensitivePerMinute, 60));
        }
        if (endpointLimit != null) {
            limits.add(new LimitKey(scope, client, endpointLimit.method, endpointLimit.path, endpointLimit.limit, endpointLimit.windowSeconds));
        }

        int globalLimit = config.limitFor(scope);
        if (globalLimit > 0) {
            limits.add(new LimitKey(scope, client, method, path, globalLimit, config.windowSeconds));
        }
        return limits;
    }

    private ConsumedLimit consume(LimitKey limitKey, long now, Config config) {
        StringRedisTemplate redis = redisTemplate();
        if (config.redisEnabled && redis != null) {
            try {
                return consumeRedis(redis, limitKey, now, config);
            } catch (RuntimeException ex) {
                log.warn("Redis rate-limit consume failed; local fallback remains active", ex);
                // Local fallback keeps rate limiting active if Redis is temporarily unavailable.
            }
        }
        return consumeLocal(limitKey, now);
    }

    private ConsumedLimit consumeLocal(LimitKey limitKey, long now) {
        long windowStart = now - Math.floorMod(now, limitKey.windowSeconds);
        String key = limitKey.scope.name() + ":" + limitKey.client + ":" + limitKey.method + ":" + limitKey.path;
        Bucket bucket = buckets.compute(key, (ignored, current) -> {
            if (current == null || current.windowStart != windowStart
                    || current.limit != limitKey.limit || current.windowSeconds != limitKey.windowSeconds) {
                return new Bucket(limitKey.scope.name(), limitKey.client, limitKey.method, limitKey.path,
                        windowStart, 1, limitKey.limit, limitKey.windowSeconds);
            }
            current.count++;
            return current;
        });
        return consumed(limitKey.limit, bucket.count, windowStart, limitKey.windowSeconds, now);
    }

    private ConsumedLimit consumeRedis(StringRedisTemplate redis, LimitKey limitKey, long now, Config config) {
        long windowStart = now - Math.floorMod(now, limitKey.windowSeconds);
        String key = redisKey(config.redisKeyPrefix, limitKey, windowStart);
        Long count = redis.opsForValue().increment(key);
        long ttlSeconds = Math.max(2L, (long) limitKey.windowSeconds * 2L);
        if (count != null && count == 1L) {
            redis.expire(key, ttlSeconds, TimeUnit.SECONDS);
        } else {
            Long ttl = redis.getExpire(key, TimeUnit.SECONDS);
            if (ttl == null || ttl < 0) {
                redis.expire(key, ttlSeconds, TimeUnit.SECONDS);
            }
        }
        return consumed(limitKey.limit, count == null ? 0 : count, windowStart, limitKey.windowSeconds, now);
    }

    private ConsumedLimit consumed(int limit, long count, long windowStart, int windowSeconds, long now) {
        long remaining = Math.max(0, limit - count);
        long resetAt = windowStart + windowSeconds;
        return new ConsumedLimit(limit, remaining, Math.max(1, resetAt - now), resetAt, count);
    }

    private boolean isSensitiveAuthEndpoint(String method, String path) {
        if (path == null) {
            return false;
        }
        if ("POST".equals(method) && path.equals("/users/create-admin")) {
            return true;
        }
        if (!path.startsWith("/auth/")) {
            return false;
        }
        return SENSITIVE_AUTH_PATHS.contains(path);
    }

    private EndpointLimit endpointLimitFor(String method, String path, Config config) {
        if ("GET".equals(method) && path.equals("/search")) {
            return new EndpointLimit("GET", "search:catalog", config.searchPerMinute, 60);
        }
        if ("GET".equals(method) && isAdminOrderListPath(path)) {
            return new EndpointLimit("GET", "admin:orders:list", config.adminOrderListPerMinute, 60);
        }
        if ("GET".equals(method) && isGuestOrderLookupPath(path)) {
            return new EndpointLimit("GET", "orders:guest-lookup", config.guestOrderLookupPerMinute, 60);
        }
        if ("POST".equals(method) && path.equals("/orders/track")) {
            return new EndpointLimit("POST", "orders:guest-lookup", config.guestOrderLookupPerMinute, 60);
        }
        if ("POST".equals(method) && isGuestOrderMutationPath(path)) {
            return new EndpointLimit("POST", "orders:guest-mutation", config.guestOrderMutationPerMinute, 60);
        }
        if (isCartWritePath(method, path)) {
            return new EndpointLimit("*", "cart:write", config.cartWritePerMinute, 60);
        }
        if (!"POST".equals(method)) {
            return null;
        }
        if (path.equals("/auth/register")) {
            return new EndpointLimit("POST", "auth:register", config.registerPerHour, 3600);
        }
        if (path.equals("/auth/forgot-password") || path.equals("/auth/password-reset-code")) {
            return new EndpointLimit("POST", "auth:password-reset", config.passwordResetPerHour, 3600);
        }
        if (path.equals("/auth/email-code") || path.equals("/auth/email-login")) {
            return new EndpointLimit("POST", "auth:email-login", config.emailLoginPerMinute, 60);
        }
        if (path.equals("/auth/refresh")) {
            return new EndpointLimit("POST", "auth:refresh", config.refreshPerMinute, 60);
        }
        if (path.equals("/users/create-admin")) {
            return new EndpointLimit("POST", "auth:admin-bootstrap", config.adminBootstrapPerHour, 3600);
        }
        if (path.equals("/admin/bugs")) {
            return new EndpointLimit("POST", "admin:bugs:create", config.adminBugCreatePerMinute, 60);
        }
        if (path.equals("/orders/checkout/guest")) {
            return new EndpointLimit("POST", "checkout:guest", config.guestCheckoutPerHour, 3600);
        }
        if (path.equals("/payment") || path.equals("/payments")) {
            return new EndpointLimit("POST", "payment:create", config.checkoutPaymentPerMinute, 60);
        }
        if (isPaymentSyncPath(path)) {
            return new EndpointLimit("POST", "payment:sync", config.paymentSyncPerMinute, 60);
        }
        if (isPaymentCallbackPath(path)) {
            return new EndpointLimit("POST", "payment:callback", config.paymentCallbackPerMinute, 60);
        }
        if (path.equals("/pet-gallery/{id}/like")) {
            return new EndpointLimit("POST", "pet-gallery:like", config.petGalleryLikePerMinute, 60);
        }
        return null;
    }

    private boolean isPaymentSyncPath(String path) {
        return PAYMENT_SYNC_PATHS.contains(path);
    }

    private boolean isPaymentCallbackPath(String path) {
        return PAYMENT_CALLBACK_PATHS.contains(path);
    }

    private boolean isAdminOrderListPath(String path) {
        return ADMIN_ORDER_LIST_PATHS.contains(path);
    }

    private boolean isGuestOrderLookupPath(String path) {
        return path.equals("/orders/track")
                || (path.startsWith("/orders/guest/") && !isGuestOrderMutationPath(path));
    }

    private boolean isGuestOrderMutationPath(String path) {
        return path.startsWith("/orders/guest/")
                && (path.endsWith("/cancel")
                || path.endsWith("/confirm")
                || path.endsWith("/return")
                || path.endsWith("/return-shipment"));
    }

    private boolean isCartWritePath(String method, String path) {
        if (!("POST".equals(method) || "PUT".equals(method) || "DELETE".equals(method))) {
            return false;
        }
        return path.equals("/cart") || path.startsWith("/cart/");
    }

    private String normalizePath(HttpServletRequest request) {
        String path = request == null ? "" : request.getRequestURI();
        if (path == null || path.isBlank()) {
            return "/";
        }
        String decodedPath = decodePath(path.trim());
        String lowerPath = decodedPath.toLowerCase(Locale.ROOT);
        StringBuilder compacted = new StringBuilder(lowerPath.length());
        boolean previousSlash = false;
        for (int index = 0; index < lowerPath.length(); index++) {
            char character = lowerPath.charAt(index);
            if (character == '/') {
                if (previousSlash) {
                    continue;
                }
                previousSlash = true;
            } else {
                previousSlash = false;
            }
            compacted.append(character);
        }
        String normalized = compacted.toString();
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        if (normalized.length() > 1 && normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        StringBuilder result = new StringBuilder(normalized.length());
        result.append('/');
        int segmentStart = normalized.startsWith("/") ? 1 : 0;
        for (int index = segmentStart; index <= normalized.length(); index++) {
            if (index < normalized.length() && normalized.charAt(index) != '/') {
                continue;
            }
            if (index > segmentStart) {
                result.append(normalizePathSegment(normalized.substring(segmentStart, index)));
                result.append('/');
            }
            segmentStart = index + 1;
        }
        if (result.length() > 1) {
            result.setLength(result.length() - 1);
        }
        return result.toString();
    }

    private String decodePath(String path) {
        try {
            return UriUtils.decode(path, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            // Keep malformed request paths rate-limitable without turning the filter into a 5xx.
            log.debug("Unable to decode request path for rate limiting", exception);
            return path;
        }
    }

    private String normalizePathSegment(String segment) {
        String cleaned = segment;
        int matrixParamStart = cleaned.indexOf(';');
        if (matrixParamStart >= 0) {
            cleaned = cleaned.substring(0, matrixParamStart);
        }
        if (NUMERIC_SEGMENT_PATTERN.matcher(cleaned).matches()) {
            return "{id}";
        }
        if (UUID_SEGMENT_PATTERN.matcher(cleaned).matches()) {
            return "{id}";
        }
        if (HEX_SEGMENT_PATTERN.matcher(cleaned).matches()) {
            return "{id}";
        }
        if (ORDER_SEGMENT_PATTERN.matcher(cleaned).matches()) {
            return "{orderNo}";
        }
        if (cleaned.length() > 64) {
            return "{token}";
        }
        return cleaned;
    }

    private Set<String> parseCsv(String value) {
        String source = value == null ? "" : value;
        Set<String> values = new java.util.HashSet<>();
        int tokenStart = 0;
        for (int index = 0; index <= source.length(); index++) {
            if (index < source.length() && source.charAt(index) != ',') {
                continue;
            }
            String token = source.substring(tokenStart, index).trim();
            if (!token.isEmpty()) {
                values.add(token);
            }
            tokenStart = index + 1;
        }
        return values;
    }

    private void cleanup(long now, Config config) {
        int size = buckets.size();
        if (size <= config.maxBuckets) {
            return;
        }
        for (Map.Entry<String, Bucket> entry : buckets.entrySet()) {
            Bucket bucket = entry.getValue();
            if (bucket.windowStart + (bucket.windowSeconds * 2L) < now) {
                buckets.remove(entry.getKey(), bucket);
            }
        }
        int overflow = buckets.size() - config.maxBuckets;
        if (overflow <= 0) {
            return;
        }
        List<Map.Entry<String, Bucket>> candidates = new ArrayList<>(buckets.entrySet());
        candidates.sort(Comparator
                .comparingLong((Map.Entry<String, Bucket> entry) -> entry.getValue().windowStart)
                .thenComparingLong(entry -> entry.getValue().count));
        int removalCount = Math.min(overflow, candidates.size());
        for (int index = 0; index < removalCount; index++) {
            Map.Entry<String, Bucket> entry = candidates.get(index);
            buckets.remove(entry.getKey(), entry.getValue());
        }
    }

    private List<TrafficControlStatusResponse.RateLimitBucketStatus> hotBuckets() {
        long now = nowEpochSecond();
        List<Bucket> active = new ArrayList<>(Math.min(10, buckets.size()));
        for (Bucket bucket : buckets.values()) {
            if (bucket.windowStart + (bucket.windowSeconds * 2L) >= now) {
                active.add(bucket);
            }
        }
        active.sort(Comparator.comparingLong((Bucket bucket) -> bucket.count).reversed());
        int resultSize = Math.min(10, active.size());
        List<TrafficControlStatusResponse.RateLimitBucketStatus> result = new ArrayList<>(resultSize);
        for (int index = 0; index < resultSize; index++) {
            result.add(toBucketStatus(active.get(index)));
        }
        return result;
    }

    private TrafficControlStatusResponse.RateLimitBucketStatus toBucketStatus(Bucket bucket) {
        TrafficControlStatusResponse.RateLimitBucketStatus status = new TrafficControlStatusResponse.RateLimitBucketStatus();
        status.setScope(bucket.scope);
        status.setClient(maskClient(bucket.client));
        status.setMethod(bucket.method);
        status.setPath(bucket.path);
        status.setCount(bucket.count);
        status.setRemaining(Math.max(0, bucket.limit - bucket.count));
        status.setResetAt(Instant.ofEpochSecond(bucket.windowStart + bucket.windowSeconds).toString());
        return status;
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

    private StringRedisTemplate redisTemplate() {
        return redisTemplateProvider == null ? null : redisTemplateProvider.getIfAvailable();
    }

    private String redisKey(String prefix, LimitKey limitKey, long windowStart) {
        return redisPrefix(prefix)
                + ":" + limitKey.scope.name().toLowerCase(Locale.ROOT)
                + ":" + safeRedisSegment(limitKey.method)
                + ":" + safeRedisSegment(limitKey.path)
                + ":" + windowStart
                + ":" + sha256Hex(limitKey.client);
    }

    private String redisPrefix(String prefix) {
        String value = prefix == null || prefix.isBlank() ? "shop:rate-limit" : prefix.trim();
        return REDIS_PREFIX_UNSAFE_PATTERN.matcher(value).replaceAll("_");
    }

    private String safeRedisSegment(String value) {
        if (value == null || value.isBlank()) {
            return "_";
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return REDIS_SEGMENT_UNSAFE_PATTERN.matcher(normalized).replaceAll("_");
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                int unsigned = b & 0xff;
                builder.append(HEX_DIGITS[unsigned >>> 4]);
                builder.append(HEX_DIGITS[unsigned & 0x0f]);
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
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
        private final int maxBuckets;
        private final int authSensitivePerMinute;
        private final int registerPerHour;
        private final int passwordResetPerHour;
        private final int emailLoginPerMinute;
        private final int refreshPerMinute;
        private final int adminBootstrapPerHour;
        private final int guestCheckoutPerHour;
        private final int searchPerMinute;
        private final int checkoutPaymentPerMinute;
        private final int paymentSyncPerMinute;
        private final int paymentCallbackPerMinute;
        private final int guestOrderLookupPerMinute;
        private final int guestOrderMutationPerMinute;
        private final int adminOrderListPerMinute;
        private final int adminBugCreatePerMinute;
        private final int cartWritePerMinute;
        private final int petGalleryLikePerMinute;
        private final boolean redisEnabled;
        private final String redisKeyPrefix;
        private final int redisClearScanCount;
        private final Set<String> skipPrefixes;

        private Config(boolean enabled,
                       int publicPerMinute,
                       int authenticatedPerMinute,
                       int adminPerMinute,
                       int windowSeconds,
                       int maxBuckets,
                       int authSensitivePerMinute,
                       int registerPerHour,
                       int passwordResetPerHour,
                       int emailLoginPerMinute,
                       int refreshPerMinute,
                       int adminBootstrapPerHour,
                       int guestCheckoutPerHour,
                       int searchPerMinute,
                       int checkoutPaymentPerMinute,
                       int paymentSyncPerMinute,
                       int paymentCallbackPerMinute,
                       int guestOrderLookupPerMinute,
                       int guestOrderMutationPerMinute,
                       int adminOrderListPerMinute,
                       int adminBugCreatePerMinute,
                       int cartWritePerMinute,
                       int petGalleryLikePerMinute,
                       boolean redisEnabled,
                       String redisKeyPrefix,
                       int redisClearScanCount,
                       Set<String> skipPrefixes) {
            this.enabled = enabled;
            this.publicPerMinute = publicPerMinute;
            this.authenticatedPerMinute = authenticatedPerMinute;
            this.adminPerMinute = adminPerMinute;
            this.windowSeconds = windowSeconds;
            this.maxBuckets = maxBuckets;
            this.authSensitivePerMinute = authSensitivePerMinute;
            this.registerPerHour = registerPerHour;
            this.passwordResetPerHour = passwordResetPerHour;
            this.emailLoginPerMinute = emailLoginPerMinute;
            this.refreshPerMinute = refreshPerMinute;
            this.adminBootstrapPerHour = adminBootstrapPerHour;
            this.guestCheckoutPerHour = guestCheckoutPerHour;
            this.searchPerMinute = searchPerMinute;
            this.checkoutPaymentPerMinute = checkoutPaymentPerMinute;
            this.paymentSyncPerMinute = paymentSyncPerMinute;
            this.paymentCallbackPerMinute = paymentCallbackPerMinute;
            this.guestOrderLookupPerMinute = guestOrderLookupPerMinute;
            this.guestOrderMutationPerMinute = guestOrderMutationPerMinute;
            this.adminOrderListPerMinute = adminOrderListPerMinute;
            this.adminBugCreatePerMinute = adminBugCreatePerMinute;
            this.cartWritePerMinute = cartWritePerMinute;
            this.petGalleryLikePerMinute = petGalleryLikePerMinute;
            this.redisEnabled = redisEnabled;
            this.redisKeyPrefix = redisKeyPrefix;
            this.redisClearScanCount = redisClearScanCount;
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
        private final int limit;
        private final int windowSeconds;
        private volatile long count;

        private Bucket(String scope, String client, String method, String path, long windowStart, long count, int limit, int windowSeconds) {
            this.scope = scope;
            this.client = client;
            this.method = method;
            this.path = path;
            this.windowStart = windowStart;
            this.count = count;
            this.limit = limit;
            this.windowSeconds = windowSeconds;
        }
    }

    private static class LimitKey {
        private final Scope scope;
        private final String client;
        private final String method;
        private final String path;
        private final int limit;
        private final int windowSeconds;

        private LimitKey(Scope scope, String client, String method, String path, int limit, int windowSeconds) {
            this.scope = scope;
            this.client = client;
            this.method = method;
            this.path = path;
            this.limit = limit;
            this.windowSeconds = Math.max(1, windowSeconds);
        }
    }

    private static class EndpointLimit {
        private final String method;
        private final String path;
        private final int limit;
        private final int windowSeconds;

        private EndpointLimit(String method, String path, int limit, int windowSeconds) {
            this.method = method;
            this.path = path;
            this.limit = limit;
            this.windowSeconds = Math.max(1, windowSeconds);
        }
    }

    private static class ConsumedLimit {
        private final int limit;
        private final long remaining;
        private final long retryAfterSeconds;
        private final long resetAtEpochSeconds;
        private final long count;

        private ConsumedLimit(int limit, long remaining, long retryAfterSeconds, long resetAtEpochSeconds, long count) {
            this.limit = limit;
            this.remaining = remaining;
            this.retryAfterSeconds = retryAfterSeconds;
            this.resetAtEpochSeconds = resetAtEpochSeconds;
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

        private static Decision allowed(int limit, int windowSeconds, long now) {
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

    private long nowEpochSecond() {
        return Instant.now(clock).getEpochSecond();
    }
}
