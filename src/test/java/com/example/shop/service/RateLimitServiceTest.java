package com.example.shop.service;

import com.example.shop.dto.TrafficControlStatusResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
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
        when(runtimeConfig.getBoolean("traffic.rate-limit.enabled", true)).thenReturn(true);
        when(runtimeConfig.getInt("traffic.rate-limit.public-per-minute", 120)).thenReturn(2);
        when(runtimeConfig.getInt("traffic.rate-limit.authenticated-per-minute", 300)).thenReturn(300);
        when(runtimeConfig.getInt("traffic.rate-limit.admin-per-minute", 600)).thenReturn(600);
        when(runtimeConfig.getInt("traffic.rate-limit.window-seconds", 60)).thenReturn(60);
        when(runtimeConfig.getInt("traffic.rate-limit.max-buckets", 5000)).thenReturn(5000);
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
    void skippedUploadPathStillBypassesRateLimitAfterNormalization() {
        for (int i = 0; i < 5; i++) {
            assertTrue(service.check(request("GET", "/uploads/products/" + i + ".jpg"), null).isAllowed());
        }

        assertEquals(0, service.status().getActiveBuckets());
        assertEquals(5, service.status().getAcceptedRequests());
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
}
