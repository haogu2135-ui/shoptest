package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityConfigCorsTest {
    private SecurityConfig securityConfig;

    @BeforeEach
    void setUp() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("production");
        when(runtimeConfig.getString("app.cors.allowed-origin-patterns", "https://pet.686888666.xyz"))
                .thenReturn("https://pet.686888666.xyz");

        securityConfig = new SecurityConfig();
        ReflectionTestUtils.setField(securityConfig, "corsOriginProperties", new CorsOriginProperties(runtimeConfig));
    }

    @Test
    void corsRequestHeadersUseAllowlist() {
        CorsConfiguration configuration = securityConfig.corsConfigurationSource()
                .getCorsConfiguration(new MockHttpServletRequest("OPTIONS", "/admin/orders"));

        List<String> allowedHeaders = configuration.getAllowedHeaders();
        assertFalse(allowedHeaders.contains("*"));
        assertTrue(allowedHeaders.contains("Authorization"));
        assertTrue(allowedHeaders.contains("Content-Type"));
        assertTrue(allowedHeaders.contains(RequestCorrelationFilter.REQUEST_ID_HEADER));
        assertTrue(allowedHeaders.contains(RequestCorrelationFilter.CORRELATION_ID_HEADER));
        assertTrue(allowedHeaders.contains("X-Bootstrap-Token"));
    }
}
