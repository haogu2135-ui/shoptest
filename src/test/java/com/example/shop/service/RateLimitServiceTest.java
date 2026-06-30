package com.example.shop.service;

import com.example.shop.dto.TrafficControlStatusResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RateLimitServiceTest {
    private RuntimeConfigService runtimeConfig;
    private ClientIpResolver clientIpResolver;
    private RateLimitService service;

    @BeforeEach
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        service = new RateLimitService(runtimeConfig, clientIpResolver);
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(Instant.parse("2026-05-24T12:00:05Z"), ZoneOffset.UTC));
        when(runtimeConfig.getBoolean("traffic.rate-limit.enabled", true)).thenReturn(true);
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(2);
        when(runtimeConfig.getInt("traffic.rate-limit.authenticated-per-minute", 300)).thenReturn(300);
        when(runtimeConfig.getInt("traffic.rate-limit.admin-per-minute", 600)).thenReturn(600);
        when(runtimeConfig.getInt("traffic.rate-limit.window-seconds", 60)).thenReturn(60);
        when(runtimeConfig.getInt("traffic.rate-limit.max-buckets", 5000)).thenReturn(5000);
        when(runtimeConfig.getInt("traffic.rate-limit.pet-gallery-like-per-minute", 20)).thenReturn(2);
        when(runtimeConfig.getInt("traffic.rate-limit.checkout-payment-per-minute", 20)).thenReturn(20);
        when(runtimeConfig.getInt("traffic.rate-limit.payment-sync-per-minute", 30)).thenReturn(30);
        when(runtimeConfig.getInt("traffic.rate-limit.payment-callback-per-minute", 60)).thenReturn(60);
        when(runtimeConfig.getInt("traffic.rate-limit.admin-bug-create-per-minute", 20)).thenReturn(20);
        when(runtimeConfig.getInt("traffic.rate-limit.cart-write-per-minute", 60)).thenReturn(60);
        when(runtimeConfig.getBoolean("traffic.rate-limit.redis-enabled", true)).thenReturn(true);
        when(runtimeConfig.getString("traffic.rate-limit.redis-key-prefix", "shop:rate-limit")).thenReturn("shop:rate-limit");
        when(runtimeConfig.getInt("traffic.rate-limit.redis-clear-scan-count", 500)).thenReturn(10);
        when(runtimeConfig.getString("traffic.rate-limit.skip-path-prefixes", "/actuator/health,/actuator/info,/uploads/,/ws/"))
                .thenReturn("/actuator/health,/actuator/info,/uploads/,/ws/");
        when(clientIpResolver.resolve(org.mockito.ArgumentMatchers.any())).thenReturn("203.0.113.9");
    }

    @Test
    void numericPathSegmentsShareOneRateLimitBucket() {
        assertTrue(service.check(request("GET", "/payments/order/100/latest"), null).isAllowed());
        assertTrue(service.check(request("GET", "/payments/order/200/latest"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("GET", "/payments/order/300/latest"), null);

        assertFalse(third.isAllowed());
        assertEquals(0, third.getRemaining());
        TrafficControlStatusResponse.RateLimitStatus status = service.status();
        assertEquals(1, status.getActiveBuckets());
        assertEquals(5000, status.getMaxBuckets());
        assertEquals(2, status.getAcceptedRequests());
        assertEquals(1, status.getRejectedRequests());
        assertEquals("/payments/order/{id}/latest", status.getHotBuckets().get(0).getPath());
    }

    @Test
    void orderNumbersAndLongTokensAreCollapsedInBucketPath() {
        service.check(request("GET", "/orders/track/SO20260524123456ABCDEF"), null);
        service.check(request("GET", "/orders/track/SO20260524199999ZZZZZZ"), null);
        service.check(request("GET", "/magic/" + "z".repeat(96)), null);

        List<String> hotPaths = service.status().getHotBuckets().stream()
                .map(TrafficControlStatusResponse.RateLimitBucketStatus::getPath)
                .collect(Collectors.toList());

        assertTrue(hotPaths.contains("/orders/track/{orderNo}"));
        assertTrue(hotPaths.contains("/magic/{token}"));
    }

    @Test
    void orderTrackPostUsesDedicatedGuestLookupRateLimit() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.guest-order-lookup-per-minute", 20)).thenReturn(2);

        assertTrue(service.check(request("POST", "/orders/track"), null).isAllowed());
        assertTrue(service.check(request("POST", "/orders/track"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/orders/track"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("orders:guest-lookup");
    }

    @Test
    void skippedUploadPathStillBypassesRateLimitAfterNormalization() {
        for (int i = 0; i < 5; i++) {
            assertTrue(service.check(request("GET", "/uploads/products/" + i + ".jpg"), null).isAllowed());
        }

        assertEquals(0, service.status().getActiveBuckets());
        assertEquals(5, service.status().getAcceptedRequests());
    }

    @Test
    void currentTrafficControlHasNoLegacyVisitorMetricGate() throws Exception {
        String rateLimitSource = Files.readString(Path.of("src/main/java/com/example/shop/service/RateLimitService.java"));

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/VisitorServiceImpl.java")));
        assertFalse(rateLimitSource.contains("getConcurrentVisitors"));
        assertFalse(rateLimitSource.contains("UV_THRESHOLD_VISITORS"));
        assertFalse(rateLimitSource.contains("MAX_CONCURRENT_VISITORS"));
        assertFalse(rateLimitSource.contains("visitors:{date}:"));
        assertTrue(rateLimitSource.contains("buckets.compute("));
        assertTrue(rateLimitSource.contains("redis.opsForValue().increment(key)"));
        assertTrue(rateLimitSource.contains("private final AtomicLong acceptedRequests = new AtomicLong();"));
    }

    @Test
    void petGalleryLikeEndpointHasSharedPerClientLimitAcrossPhotoIds() {
        assertTrue(service.check(request("POST", "/pet-gallery/100/like"), null).isAllowed());
        assertTrue(service.check(request("POST", "/pet-gallery/200/like"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/pet-gallery/300/like"), null);

        assertFalse(third.isAllowed());
        assertEquals(0, third.getRemaining());
        assertEquals("/pet-gallery/{id}/like", service.status().getHotBuckets().get(0).getPath());
    }

    @Test
    void paymentCreateEndpointsShareDedicatedPerClientLimitAcrossAliases() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.checkout-payment-per-minute", 20)).thenReturn(2);

        assertTrue(service.check(request("POST", "/payments"), null).isAllowed());
        assertTrue(service.check(request("POST", "/payment"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/payments"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("payment:create");
    }

    @Test
    void paymentSyncEndpointsShareDedicatedPerClientLimitAcrossPaymentAndOrderBatchSync() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.payment-sync-per-minute", 30)).thenReturn(2);

        assertTrue(service.check(request("POST", "/payments/100/sync"), null).isAllowed());
        assertTrue(service.check(request("POST", "/payment/order/200/sync"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/payments/order/300/sync"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("payment:sync");
    }

    @Test
    void paymentCallbackAndWebhookEndpointsShareDedicatedPerClientLimit() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.payment-callback-per-minute", 60)).thenReturn(2);

        assertTrue(service.check(request("POST", "/payments/callback"), null).isAllowed());
        assertTrue(service.check(request("POST", "/payment/stripe/webhook"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/payments/stripe/webhook"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("payment:callback");
    }

    @Test
    void guestOrderMutationEndpointsShareDedicatedPerClientLimitAcrossIds() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.guest-order-mutation-per-minute", 10)).thenReturn(2);

        assertTrue(service.check(request("POST", "/orders/guest/100/cancel"), null).isAllowed());
        assertTrue(service.check(request("POST", "/orders/guest/200/return-shipment"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/orders/guest/300/confirm"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("orders:guest-mutation");
    }

    @Test
    void guestCheckoutEndpointHasDedicatedHourlyPerClientLimit() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.guest-checkout-per-hour", 10)).thenReturn(2);

        assertTrue(service.check(request("POST", "/orders/checkout/guest"), null).isAllowed());
        assertTrue(service.check(request("POST", "/orders/checkout/guest"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/orders/checkout/guest"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("checkout:guest");
    }

    @Test
    void adminBugCreateEndpointHasDedicatedPerClientLimit() {
        when(runtimeConfig.getInt("traffic.rate-limit.admin-per-minute", 600)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.admin-bug-create-per-minute", 20)).thenReturn(2);

        assertTrue(service.check(request("POST", "/admin/bugs"), null).isAllowed());
        assertTrue(service.check(request("POST", "/admin/bugs/"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/admin/bugs"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("admin:bugs:create");
    }

    @Test
    void loginEndpointHasDedicatedSensitiveAuthLimit() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.auth-sensitive-per-minute", 30)).thenReturn(2);

        assertTrue(service.check(request("POST", "/auth/login"), null).isAllowed());
        assertTrue(service.check(request("POST", "/auth/login"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/auth/login"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("auth:sensitive");
    }

    @Test
    void registrationEndpointHasDedicatedHourlyPerClientLimit() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.auth-sensitive-per-minute", 30)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.register-per-hour", 5)).thenReturn(2);

        assertTrue(service.check(request("POST", "/auth/register"), null).isAllowed());
        assertTrue(service.check(request("POST", "/auth/register"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/auth/register"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("auth:register");
    }

    @Test
    void adminBootstrapEndpointHasDedicatedHourlyPerClientLimit() throws Exception {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.auth-sensitive-per-minute", 30)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.admin-bootstrap-per-hour", 3)).thenReturn(2);

        assertTrue(service.check(request("POST", "/users/create-admin"), null).isAllowed());
        assertTrue(service.check(request("POST", "/users/create-admin"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("POST", "/users/create-admin"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("auth:admin-bootstrap");

        String rateLimitSource = Files.readString(Path.of("src/main/java/com/example/shop/service/RateLimitService.java"));
        String tokenPolicySource = Files.readString(Path.of("src/main/java/com/example/shop/config/AdminBootstrapTokenPolicy.java"));
        assertTrue(rateLimitSource.contains("positiveInt(\"traffic.rate-limit.admin-bootstrap-per-hour\", 3)"));
        assertTrue(rateLimitSource.contains("return new EndpointLimit(\"POST\", \"auth:admin-bootstrap\", config.adminBootstrapPerHour, 3600);"));
        assertTrue(tokenPolicySource.contains("MIN_BOOTSTRAP_TOKEN_LENGTH = 32"));
        assertTrue(tokenPolicySource.contains("admin.bootstrap-token must be blank or at least 32 non-placeholder characters"));
    }

    @Test
    void cartWriteEndpointsShareDedicatedPerClientLimitAcrossMethodsAndIds() {
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(100);
        when(runtimeConfig.getInt("traffic.rate-limit.cart-write-per-minute", 60)).thenReturn(2);

        assertTrue(service.check(request("POST", "/cart/add"), null).isAllowed());
        assertTrue(service.check(request("PUT", "/cart/update"), null).isAllowed());

        RateLimitService.Decision third = service.check(request("DELETE", "/cart/remove/300"), null);

        assertFalse(third.isAllowed());
        assertEquals(2, third.getLimit());
        assertEquals(0, third.getRemaining());
        assertHotBucketPath("cart:write");
    }

    @Test
    void cartWriteEndpointLimitIsExposedInRuntimeDefaults() throws Exception {
        String rateLimitSource = Files.readString(Path.of("src/main/java/com/example/shop/service/RateLimitService.java"));
        String applicationProperties = Files.readString(Path.of("src/main/resources/application.properties"));
        String configCenterService = Files.readString(Path.of("src/main/java/com/example/shop/service/ConfigCenterService.java"));
        String backendEnvExample = Files.readString(Path.of("deploy/backend.env.example"));

        assertTrue(rateLimitSource.contains("positiveInt(\"traffic.rate-limit.cart-write-per-minute\", 60)"));
        assertTrue(rateLimitSource.contains("return new EndpointLimit(\"*\", \"cart:write\", config.cartWritePerMinute, 60);"));
        assertTrue(applicationProperties.contains("traffic.rate-limit.cart-write-per-minute=${TRAFFIC_RATE_LIMIT_CART_WRITE_PER_MINUTE:60}"));
        assertTrue(configCenterService.contains("\"traffic.rate-limit.cart-write-per-minute=60\""));
        assertTrue(backendEnvExample.contains("TRAFFIC_RATE_LIMIT_CART_WRITE_PER_MINUTE=60"));
    }

    @Test
    void adminBugCreateEndpointLimitIsExposedInRuntimeDefaults() throws Exception {
        String rateLimitSource = Files.readString(Path.of("src/main/java/com/example/shop/service/RateLimitService.java"));
        String applicationProperties = Files.readString(Path.of("src/main/resources/application.properties"));
        String configCenterService = Files.readString(Path.of("src/main/java/com/example/shop/service/ConfigCenterService.java"));
        String backendEnvExample = Files.readString(Path.of("deploy/backend.env.example"));

        assertTrue(rateLimitSource.contains("positiveInt(\"traffic.rate-limit.admin-bug-create-per-minute\", 20)"));
        assertTrue(rateLimitSource.contains("return new EndpointLimit(\"POST\", \"admin:bugs:create\", config.adminBugCreatePerMinute, 60);"));
        assertTrue(applicationProperties.contains("traffic.rate-limit.admin-bug-create-per-minute=${TRAFFIC_RATE_LIMIT_ADMIN_BUG_CREATE_PER_MINUTE:20}"));
        assertTrue(configCenterService.contains("\"traffic.rate-limit.admin-bug-create-per-minute=20\""));
        assertTrue(backendEnvExample.contains("TRAFFIC_RATE_LIMIT_ADMIN_BUG_CREATE_PER_MINUTE=20"));
    }

    @Test
    void authRateLimitDefaultsAreExposedInRuntimeTemplates() throws Exception {
        String rateLimitSource = Files.readString(Path.of("src/main/java/com/example/shop/service/RateLimitService.java"));
        String applicationProperties = Files.readString(Path.of("src/main/resources/application.properties"));
        String configCenterService = Files.readString(Path.of("src/main/java/com/example/shop/service/ConfigCenterService.java"));
        String backendEnvExample = Files.readString(Path.of("deploy/backend.env.example"));

        assertTrue(rateLimitSource.contains("positiveInt(\"traffic.rate-limit.auth-sensitive-per-minute\", 30)"));
        assertTrue(rateLimitSource.contains("positiveInt(\"traffic.rate-limit.register-per-hour\", 5)"));
        assertTrue(applicationProperties.contains("traffic.rate-limit.auth-sensitive-per-minute=${TRAFFIC_RATE_LIMIT_AUTH_SENSITIVE_PER_MINUTE:30}"));
        assertTrue(applicationProperties.contains("traffic.rate-limit.register-per-hour=${TRAFFIC_RATE_LIMIT_REGISTER_PER_HOUR:5}"));
        assertTrue(applicationProperties.contains("traffic.rate-limit.password-reset-per-hour=${TRAFFIC_RATE_LIMIT_PASSWORD_RESET_PER_HOUR:5}"));
        assertTrue(configCenterService.contains("\"traffic.rate-limit.auth-sensitive-per-minute=30\""));
        assertTrue(configCenterService.contains("\"traffic.rate-limit.register-per-hour=5\""));
        assertTrue(backendEnvExample.contains("TRAFFIC_RATE_LIMIT_AUTH_SENSITIVE_PER_MINUTE=30"));
        assertTrue(backendEnvExample.contains("TRAFFIC_RATE_LIMIT_REGISTER_PER_HOUR=5"));
    }

    @Test
    void redisFailureFallsBackToLocalBucketsAndStillRejectsBurst() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOperations = mockValueOperations();
        when(redis.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(anyString())).thenThrow(new RuntimeException("redis unavailable"));
        service = new RateLimitService(runtimeConfig, clientIpResolver, redisProvider(redis));
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(Instant.parse("2026-05-24T12:00:05Z"), ZoneOffset.UTC));

        assertTrue(service.check(request("GET", "/products"), null).isAllowed());
        assertTrue(service.check(request("GET", "/products"), null).isAllowed());
        RateLimitService.Decision third = service.check(request("GET", "/products"), null);

        assertFalse(third.isAllowed());
        assertEquals(0, third.getRemaining());
        assertEquals(1, service.status().getActiveBuckets());
    }

    @Test
    void redisFallbackUsesConfiguredLimitWithoutInstanceCountDivision() throws Exception {
        String rateLimitSource = Files.readString(Path.of("src/main/java/com/example/shop/service/RateLimitService.java"));

        assertFalse(rateLimitSource.contains("instanceCount"));
        assertFalse(rateLimitSource.contains("instance-count"));
        assertFalse(rateLimitSource.contains("/ instance"));
        assertTrue(rateLimitSource.contains("return consumeLocal(limitKey, now);"));
        assertTrue(rateLimitSource.contains("return consumed(limitKey.limit, bucket.count, windowStart, limitKey.windowSeconds, now);"));
        assertTrue(rateLimitSource.contains("return consumed(limitKey.limit, count == null ? 0 : count, windowStart, limitKey.windowSeconds, now);"));
    }

    @Test
    @DisplayName("clear scans Redis buckets instead of issuing KEYS")
    void clearRedisBucketsUsesScanAndDeleteInsteadOfKeys() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        RedisConnection connection = mock(RedisConnection.class);
        Cursor<byte[]> cursor = mockCursor();
        byte[] first = "shop:rate-limit:public:first".getBytes(StandardCharsets.UTF_8);
        byte[] second = "shop:rate-limit:public:second".getBytes(StandardCharsets.UTF_8);
        byte[] third = "shop:rate-limit:public:third".getBytes(StandardCharsets.UTF_8);
        when(connection.scan(any(ScanOptions.class))).thenReturn(cursor);
        when(cursor.hasNext()).thenReturn(true, true, true, false);
        when(cursor.next()).thenReturn(first, second, third);
        runRedisCallback(redis, connection);
        service = new RateLimitService(runtimeConfig, clientIpResolver, redisProvider(redis));

        service.clear();

        verify(redis, never()).keys(anyString());
        verify(redis).execute(any(RedisCallback.class));
        ArgumentCaptor<ScanOptions> options = ArgumentCaptor.forClass(ScanOptions.class);
        verify(connection).scan(options.capture());
        verify(connection).del(first, second, third);
        verify(cursor).close();
    }

    @Test
    void evictsColdestBucketsWhenConfiguredBucketCapIsExceeded() {
        when(runtimeConfig.getInt("traffic.rate-limit.max-buckets", 5000)).thenReturn(100);
        for (int i = 0; i < 105; i++) {
            service.check(request("GET", "/search/q" + i), null);
        }

        TrafficControlStatusResponse.RateLimitStatus status = service.status();

        assertEquals(100, status.getMaxBuckets());
        assertEquals(100, status.getActiveBuckets());
        assertEquals(105, status.getAcceptedRequests());
    }

    private MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRemoteAddr("203.0.113.9");
        return request;
    }

    private void assertHotBucketPath(String path) {
        assertTrue(service.status().getHotBuckets().stream()
                .anyMatch(bucket -> path.equals(bucket.getPath())));
    }

    @SuppressWarnings("unchecked")
    private ObjectProvider<StringRedisTemplate> redisProvider(StringRedisTemplate redis) {
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(redis);
        return provider;
    }

    @SuppressWarnings("unchecked")
    private ValueOperations<String, String> mockValueOperations() {
        return mock(ValueOperations.class);
    }

    @SuppressWarnings("unchecked")
    private Cursor<byte[]> mockCursor() {
        return mock(Cursor.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private void runRedisCallback(StringRedisTemplate redis, RedisConnection connection) {
        doAnswer(invocation -> {
            RedisCallback callback = invocation.getArgument(0);
            return callback.doInRedis(connection);
        }).when(redis).execute(any(RedisCallback.class));
    }
}
