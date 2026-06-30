package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

class IpBlacklistAdminCoverageContractTest {
    @Test
    void defaultProtectedPrefixesIncludeAdminEndpoints() {
        IpBlacklistService service = serviceUsingDefaultProtectedPrefixes();

        assertTrue(service.shouldCheckPath(new MockHttpServletRequest("GET", "/admin/products")));
        assertTrue(service.shouldCheckPath(new MockHttpServletRequest("POST", "/admin/ip-blacklist/block")));
        assertFalse(service.shouldCheckPath(new MockHttpServletRequest("OPTIONS", "/admin/products")));
    }

    @Test
    void securityFilterChainChecksIpBlacklistBeforeJwtAuthentication() throws Exception {
        String security = Files.readString(
                Path.of("src/main/java/com/example/shop/config/SecurityConfig.java"),
                StandardCharsets.UTF_8);

        int ipBlacklistFilter = security.indexOf("addFilterBefore(ipBlacklistFilter, UsernamePasswordAuthenticationFilter.class)");
        int jwtFilter = security.indexOf("addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)");

        assertTrue(security.contains(".antMatchers(\"/admin/**\").hasRole(\"ADMIN\")"));
        assertFalse(security.contains("buildAdminAccessExpression"));
        assertFalse(security.contains("USER_AGENT"));
        assertFalse(security.contains("hasRole('USER_AGENT')"));
        assertTrue(ipBlacklistFilter >= 0);
        assertTrue(jwtFilter >= 0);
        assertTrue(ipBlacklistFilter < jwtFilter, "IP blacklist must run before JWT authentication for admin paths");
        assertFalse(security.contains("storeFrontFilterChain"));
        assertFalse(security.contains("visitorMonitor"));
    }

    @Test
    void shippedConfigurationTemplatesIncludeAdminPrefix() throws Exception {
        String applicationProperties = Files.readString(
                Path.of("src/main/resources/application.properties"),
                StandardCharsets.UTF_8);
        String configCenter = Files.readString(
                Path.of("src/main/java/com/example/shop/service/ConfigCenterService.java"),
                StandardCharsets.UTF_8);

        assertTrue(applicationProperties.contains("/users/create-admin,/admin,/payment"));
        assertTrue(configCenter.contains("/users/create-admin,/admin,/payment"));
    }

    private IpBlacklistService serviceUsingDefaultProtectedPrefixes() {
        RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getBoolean("security.ip-blacklist.block-all-paths", false)).thenReturn(false);
        when(runtimeConfig.getString(eq("security.ip-blacklist.path-prefixes"), anyString()))
                .thenAnswer(invocation -> invocation.getArgument(1));

        return new IpBlacklistService(
                mock(JdbcTemplate.class),
                runtimeConfig,
                mock(SystemAlertService.class),
                mock(ClientIpResolver.class),
                mock(TokenBlacklistService.class));
    }
}
