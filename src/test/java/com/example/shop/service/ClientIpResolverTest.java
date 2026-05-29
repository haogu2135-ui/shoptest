package com.example.shop.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClientIpResolverTest {
    private RuntimeConfigService runtimeConfig;
    private ClientIpResolver resolver;

    @BeforeEach
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        resolver = new ClientIpResolver(runtimeConfig);
    }

    @Test
    void ignoresForwardedHeaderWhenRemoteAddressIsNotTrusted() {
        trustProxies("10.0.0.1");
        MockHttpServletRequest request = request("203.0.113.10");
        request.addHeader("X-Forwarded-For", "198.51.100.25");

        assertEquals("203.0.113.10", resolver.resolve(request));
    }

    @Test
    void usesFirstForwardedAddressFromTrustedProxy() {
        trustProxies("10.0.0.1");
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.25, 10.0.0.1");

        assertEquals("198.51.100.25", resolver.resolve(request));
        assertTrue(resolver.shouldTrustForwardedHeaders(request));
    }

    @Test
    void doesNotTrustForwardedHeadersFromUntrustedRemoteAddress() {
        trustProxies("10.0.0.1");
        MockHttpServletRequest request = request("203.0.113.10");

        assertFalse(resolver.shouldTrustForwardedHeaders(request));
    }

    @Test
    void supportsTrustedProxyCidrAndRealIpFallback() {
        trustProxies("10.0.0.0/8");
        MockHttpServletRequest request = request("10.2.3.4");
        request.addHeader("X-Real-IP", "198.51.100.88");

        assertEquals("198.51.100.88", resolver.resolve(request));
    }

    @Test
    void rejectsMalformedForwardedAddressFromTrustedProxy() {
        trustProxies("10.0.0.1");
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "bad\r\nX: injected, 198.51.100.25");

        assertEquals("10.0.0.1", resolver.resolve(request));
    }

    @Test
    void rejectsBareNumericOrHostnameLikeForwardedAddress() {
        trustProxies("10.0.0.1");
        MockHttpServletRequest request = request("10.0.0.1");
        request.addHeader("X-Forwarded-For", "1234");

        assertEquals("10.0.0.1", resolver.resolve(request));
    }

    private MockHttpServletRequest request(String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/products");
        request.setRemoteAddr(remoteAddress);
        return request;
    }

    private void trustProxies(String value) {
        when(runtimeConfig.getString(eq(ClientIpResolver.TRUSTED_PROXIES_KEY), org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(value);
    }
}
