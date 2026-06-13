package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    @Test
    void productionCorsFiltersUnsafeDefaultOrigins() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("production");
        when(runtimeConfig.getString("app.cors.allowed-origin-patterns", "https://pet.686888666.xyz"))
                .thenReturn("https://pet.686888666.xyz,http://localhost:*,http://10.*:*,http://192.168.*:*,https://admin.example.com");

        List<String> origins = new CorsOriginProperties(runtimeConfig).getCorsAllowedOriginPatterns();

        assertEquals(List.of("https://pet.686888666.xyz", "https://admin.example.com"), origins);
    }

    @Test
    void nonProductionFallbackDoesNotIncludePrivateLanOrigins() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("app.cors.allowed-origin-patterns", "http://localhost:*,http://127.0.0.1:*"))
                .thenReturn("");

        List<String> origins = new CorsOriginProperties(runtimeConfig).getCorsAllowedOriginPatterns();

        assertEquals(List.of("http://localhost:*", "http://127.0.0.1:*"), origins);
        assertFalse(origins.stream().anyMatch(origin -> origin.contains("10.*")));
        assertFalse(origins.stream().anyMatch(origin -> origin.contains("172.*")));
        assertFalse(origins.stream().anyMatch(origin -> origin.contains("192.168")));
    }

    @Test
    void nonProductionExplicitOverrideCanOptIntoDeviceOrigin() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
        when(runtimeConfig.getString("app.cors.allowed-origin-patterns", "http://localhost:*,http://127.0.0.1:*"))
                .thenReturn("http://localhost:*,http://192.168.1.55:3000");

        List<String> origins = new CorsOriginProperties(runtimeConfig).getCorsAllowedOriginPatterns();

        assertEquals(List.of("http://localhost:*", "http://192.168.1.55:3000"), origins);
    }

    @Test
    void corsDoesNotEnablePrivateNetworkAccess() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));

        assertFalse(source.contains("allowPrivateNetwork(true)"));
    }

    @Test
    void publicActuatorHealthRuleDoesNotPermitHealthSubpaths() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));

        assertTrue(source.contains(".antMatchers(HttpMethod.GET, \"/actuator/health\", \"/actuator/info\").permitAll()"));
        assertFalse(source.contains("\"/actuator/health/**\""));
        assertFalse(source.contains("'/actuator/health/**'"));
    }

    @Test
    void csrfDisabledContractRequiresStatelessBearerAuth() throws Exception {
        String security = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));
        String jwtFilter = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/security/JwtAuthenticationFilter.java"));
        String apiClient = java.nio.file.Files.readString(
                java.nio.file.Paths.get("frontend/src/api/index.ts"));

        assertTrue(security.contains(".csrf().disable()"));
        assertTrue(security.contains("SessionCreationPolicy.STATELESS"));
        assertTrue(security.contains("does not use browser session cookies"));
        assertTrue(jwtFilter.contains("request.getHeader(\"Authorization\")"));
        assertTrue(jwtFilter.contains("authHeader.startsWith(\"Bearer \")"));
        assertFalse(jwtFilter.contains("getCookies()"));
        assertFalse(security.contains("SessionCreationPolicy.IF_REQUIRED"));
        assertFalse(apiClient.contains("withCredentials"));
        assertTrue(apiClient.contains("setHeader.call(headers, 'Authorization', `Bearer ${token}`)")
                || apiClient.contains("headers.set('Authorization', `Bearer ${token}`)"));
        assertTrue(apiClient.contains("Authorization: `Bearer ${token}`"));
    }

    @Test
    void publicGuestOperationsAreExplicitlyPermitted() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));

        assertTrue(source.contains(".antMatchers(HttpMethod.POST, \"/orders/track\").permitAll()"));
        assertTrue(source.contains(".antMatchers(HttpMethod.POST, \"/support/guest/session\").permitAll()"));
        assertTrue(source.contains(".antMatchers(HttpMethod.POST, \"/errors\").permitAll()"));
        assertTrue(source.contains(".antMatchers(HttpMethod.GET, \"/home/products\", \"/home/products/**\").permitAll()"));
    }

    @Test
    void anonymousAccessRulesStayNarrowAndControllerGated() throws Exception {
        String security = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));
        String orderController = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/controller/OrderController.java"));
        String paymentController = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/controller/PaymentController.java"));
        String userController = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/controller/UserController.java"));

        assertFalse(security.contains(".antMatchers(\"/orders/**\").permitAll()"));
        assertFalse(security.contains(".antMatchers(\"/users/**\").permitAll()"));
        assertFalse(security.contains(".antMatchers(\"/payments/**\").permitAll()"));
        assertFalse(security.contains("/admin/bootstrap/first-super-admin"));
        assertTrue(security.contains(".antMatchers(HttpMethod.POST, \"/users/create-admin\").permitAll()"));
        assertTrue(security.contains(".anyRequest().authenticated()"));

        assertTrue(orderController.contains("requireGuestVisibleOrder"));
        assertTrue(orderController.contains("guestOrderAccessMatches(order, guestEmail, orderNo)"));
        assertTrue(paymentController.contains("assertCanCreatePayment(request, authentication)"));
        assertTrue(paymentController.contains("assertCanOperatePayment(id, authentication"));
        assertTrue(paymentController.contains("assertAdminPaymentSimulation(authentication)"));
        assertTrue(userController.contains("@RequestHeader(value = \"X-Bootstrap-Token\""));
        assertTrue(userController.contains("runtimeConfig.getString(\"admin.bootstrap-token\", \"\")"));
        assertTrue(userController.contains("if (isBlank(adminBootstrapToken))"));
        assertTrue(userController.contains("assertAdminBootstrapToken(bootstrapToken)"));
        assertTrue(userController.contains("constantTimeEquals(adminBootstrapToken, bootstrapToken.trim())"));
    }

    @Test
    void frameOptionsAreRestrictedToSameOrigin() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));

        assertTrue(source.contains(".frameOptions(frameOptions -> frameOptions.sameOrigin())"));
    }

    @Test
    void securityHeadersIncludeRestrictivePermissionsPolicy() throws Exception {
        String source = java.nio.file.Files.readString(
                java.nio.file.Paths.get("src/main/java/com/example/shop/config/SecurityConfig.java"));

        assertTrue(source.contains("\"Permissions-Policy\""));
        assertTrue(source.contains("camera=()"));
        assertTrue(source.contains("microphone=()"));
        assertTrue(source.contains("geolocation=()"));
        assertTrue(source.contains("browsing-topics=()"));
    }
}
