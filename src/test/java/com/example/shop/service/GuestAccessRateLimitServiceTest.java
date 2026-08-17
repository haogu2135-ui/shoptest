package com.example.shop.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GuestAccessRateLimitServiceTest {
    private RuntimeConfigService runtimeConfig;
    private ClientIpResolver clientIpResolver;
    private GuestAccessRateLimitService service;
    private Clock clock;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        when(redisProvider.getIfAvailable()).thenReturn(null);
        when(clientIpResolver.resolve(any())).thenReturn("203.0.113.19");
        when(runtimeConfig.getBoolean("security.guest-access-rate-limit.enabled", true)).thenReturn(true);
        when(runtimeConfig.getBoolean("security.guest-access-rate-limit.redis-enabled", true)).thenReturn(false);
        when(runtimeConfig.getInt("security.guest-access-rate-limit.max-failures", 8)).thenReturn(2);
        when(runtimeConfig.getInt("security.guest-access-rate-limit.client-max-failures", 30)).thenReturn(20);
        when(runtimeConfig.getInt("security.guest-access-rate-limit.window-minutes", 15)).thenReturn(1);
        when(runtimeConfig.getInt("security.guest-access-rate-limit.max-buckets", 100_000)).thenReturn(1000);
        when(runtimeConfig.getString("security.guest-access-rate-limit.redis-key-prefix", "shop:guest-access"))
                .thenReturn("shop:guest-access");
        service = new GuestAccessRateLimitService(runtimeConfig, clientIpResolver, redisProvider);
        clock = Clock.fixed(Instant.parse("2026-08-16T12:00:00Z"), ZoneOffset.UTC);
        ReflectionTestUtils.setField(service, "clock", clock);
    }

    @Test
    void failuresShareOneCredentialBucketAcrossGuestSurfaces() {
        MockHttpServletRequest request = request();
        service.recordFailure("order-read", "SO202608160001", "Guest@Example.com", request);
        service.recordFailure("support", " so202608160001 ", "guest@example.com", request);

        ResponseStatusException blocked = assertThrows(ResponseStatusException.class,
                () -> service.assertAllowed("payment-read", "SO202608160001", "guest@example.com", request));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, blocked.getStatus());
        assertEquals(2, service.activeBucketCount());
    }

    @Test
    @SuppressWarnings("unchecked")
    void localBucketKeysDoNotContainOrderNumberEmailOrClientIp() {
        service.recordFailure("order-track", "SO202608160001", "guest@example.com", request());

        Map<String, ?> buckets = (Map<String, ?>) ReflectionTestUtils.getField(service, "buckets");
        assertTrue(buckets != null && !buckets.isEmpty());
        for (String key : buckets.keySet()) {
            assertTrue(key.matches("(?:credential|client):[0-9a-f]{64}"));
            assertFalse(key.contains("so202608160001"));
            assertFalse(key.contains("guest@example.com"));
            assertFalse(key.contains("203.0.113.19"));
        }
    }

    @Test
    void localFailureWindowExpiresWithoutManualCleanup() {
        when(runtimeConfig.getInt("security.guest-access-rate-limit.max-failures", 8)).thenReturn(1);
        MockHttpServletRequest request = request();
        service.recordFailure("logistics", "SO202608160001", "guest@example.com", request);
        assertThrows(ResponseStatusException.class,
                () -> service.assertAllowed("support", "SO202608160001", "guest@example.com", request));

        ReflectionTestUtils.setField(service, "clock", Clock.offset(clock, java.time.Duration.ofSeconds(61)));

        service.assertAllowed("support", "SO202608160001", "guest@example.com", request);
    }

    @Test
    void successfulChecksDoNotConsumeFailureBudget() {
        for (int i = 0; i < 20; i++) {
            service.assertAllowed("order-read", "SO202608160001", "guest@example.com", request());
        }

        assertEquals(0, service.activeBucketCount());
    }

    @Test
    @SuppressWarnings("unchecked")
    void redisUsesTheSameHashedIdentifiersAndRepairsMissingTtl() {
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redisProvider.getIfAvailable()).thenReturn(redis);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(anyString())).thenReturn(2L);
        when(redis.getExpire(anyString(), eq(TimeUnit.SECONDS))).thenReturn(-1L);
        when(runtimeConfig.getBoolean("security.guest-access-rate-limit.redis-enabled", true)).thenReturn(true);
        GuestAccessRateLimitService redisService = new GuestAccessRateLimitService(
                runtimeConfig, clientIpResolver, redisProvider);

        redisService.recordFailure("support", "SO202608160001", "guest@example.com", request());

        org.mockito.ArgumentCaptor<String> keys = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(values, times(2)).increment(keys.capture());
        List<String> captured = keys.getAllValues();
        assertTrue(captured.stream().allMatch(key -> key.matches("shop:guest-access:(?:credential|client):[0-9a-f]{64}")));
        assertTrue(captured.stream().noneMatch(key -> key.contains("guest@example.com")
                || key.contains("so202608160001") || key.contains("203.0.113.19")));
        verify(redis, times(2)).expire(anyString(), eq(60L), eq(TimeUnit.SECONDS));
    }

    private MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/orders/track");
        request.setRemoteAddr("203.0.113.19");
        return request;
    }
}
