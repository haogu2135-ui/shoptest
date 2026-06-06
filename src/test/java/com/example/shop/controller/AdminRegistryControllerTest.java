package com.example.shop.controller;

import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.client.DefaultServiceInstance;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminRegistryControllerTest {
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);

    @Test
    void reportsHealthyWhenCurrentServiceIsRegistered() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, true, true);
        ServiceInstance backendInstance = new DefaultServiceInstance(
                "shop-backend-1",
                "shop-backend",
                "127.0.0.1",
                8081,
                false
        );
        ServiceInstance gatewayInstance = new DefaultServiceInstance(
                "shop-gateway-1",
                "shop-gateway",
                "127.0.0.1",
                8080,
                false
        );

        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(discoveryClient.description()).thenReturn("mock-discovery");
        when(discoveryClient.getServices()).thenReturn(List.of("shop-backend", "shop-gateway"));
        when(discoveryClient.getInstances("shop-backend")).thenReturn(List.of(backendInstance));
        when(discoveryClient.getInstances("shop-gateway")).thenReturn(List.of(gatewayInstance));

        Map<String, Object> status = controller.getRegistryStatus(adminAuthentication());

        assertEquals("UP", status.get("status"));
        assertEquals(true, status.get("healthy"));
        assertEquals(true, status.get("currentServiceRegistered"));
        assertEquals(1, status.get("instanceCount"));
        assertEquals(List.of("shop-backend", "shop-gateway"), status.get("knownServices"));
        assertTrue(((List<?>) status.get("errors")).isEmpty());
        assertTrue(((List<?>) status.get("warnings")).isEmpty());
        assertEquals(true, ((Map<?, ?>) status.get("readiness")).get("ready"));
        assertEquals(HttpStatus.OK.value(), ((Map<?, ?>) status.get("readiness")).get("httpStatus"));
        assertEquals("/admin/registry/readiness", ((Map<?, ?>) status.get("diagnostics")).get("registryReadinessEndpoint"));
        assertEquals("/gateway/admin/admin/registry", ((Map<?, ?>) status.get("diagnostics")).get("gatewayAdminPath"));
        assertEquals("/gateway/admin/admin/registry/readiness", ((Map<?, ?>) status.get("diagnostics")).get("gatewayReadinessPath"));
    }

    @Test
    void masksSensitiveServiceMetadataInRegistryResponses() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, true, true);
        ServiceInstance backendInstance = new DefaultServiceInstance(
                "shop-backend-1",
                "shop-backend",
                "127.0.0.1",
                8081,
                false,
                Map.of(
                        "version", "  v1\nstable  ",
                        "authToken", "raw-token-value",
                        "notes", "password=secret; Authorization: Bearer abcdefghijklmnop"
                )
        );

        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(discoveryClient.description()).thenReturn("mock-discovery");
        when(discoveryClient.getServices()).thenReturn(List.of("shop-backend"));
        when(discoveryClient.getInstances("shop-backend")).thenReturn(List.of(backendInstance));

        Map<String, Object> status = controller.getRegistryStatus(adminAuthentication());

        List<?> instances = (List<?>) status.get("instances");
        Map<?, ?> instancePayload = (Map<?, ?>) instances.get(0);
        Map<?, ?> metadata = (Map<?, ?>) instancePayload.get("metadata");
        assertEquals("v1 stable", metadata.get("version"));
        assertEquals("******", metadata.get("authToken"));
        assertEquals("password=******; Authorization: Bearer ******", metadata.get("notes"));

        List<?> serviceSummaries = (List<?>) status.get("serviceSummaries");
        Map<?, ?> summary = (Map<?, ?>) serviceSummaries.get(0);
        Map<?, ?> summaryInstance = (Map<?, ?>) ((List<?>) summary.get("instances")).get(0);
        assertEquals(metadata, summaryInstance.get("metadata"));
    }

    @Test
    void readinessReturnsOkWhenCurrentServiceIsRegistered() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, true, true);
        ServiceInstance backendInstance = new DefaultServiceInstance(
                "shop-backend-1",
                "shop-backend",
                "127.0.0.1",
                8081,
                false
        );

        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(discoveryClient.description()).thenReturn("mock-discovery");
        when(discoveryClient.getServices()).thenReturn(List.of("shop-backend"));
        when(discoveryClient.getInstances("shop-backend")).thenReturn(List.of(backendInstance));

        ResponseEntity<Map<String, Object>> response = controller.getRegistryReadiness(adminAuthentication());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("UP", response.getBody().get("status"));
        assertEquals(true, ((Map<?, ?>) response.getBody().get("readiness")).get("ready"));
    }

    @Test
    void degradesInsteadOfFailingWhenDiscoveryClientThrows() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, true, true);

        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(discoveryClient.description()).thenThrow(new IllegalStateException("bad\nregistry"));
        when(discoveryClient.getServices()).thenThrow(new IllegalStateException("nacos\tunavailable"));
        when(discoveryClient.getInstances("shop-backend")).thenThrow(new IllegalStateException("instances\r\nfailed"));

        Map<String, Object> status = controller.getRegistryStatus(adminAuthentication());

        assertEquals("DEGRADED", status.get("status"));
        assertEquals(false, status.get("healthy"));
        assertEquals(false, status.get("currentServiceRegistered"));
        assertEquals(0, status.get("instanceCount"));
        assertTrue(((List<?>) status.get("knownServices")).isEmpty());
        List<?> errors = (List<?>) status.get("errors");
        assertEquals(3, errors.size());
        errors.forEach((error) -> {
            String text = String.valueOf(error);
            assertFalse(text.contains("\n"));
            assertFalse(text.contains("\r"));
            assertFalse(text.contains("\t"));
        });
    }

    @Test
    void disabledDiscoveryReturnsConfigWithoutQueryingServices() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, false, false);

        when(environment.getActiveProfiles()).thenReturn(new String[]{"local"});
        when(discoveryClient.description()).thenReturn("mock-discovery");

        Map<String, Object> status = controller.getRegistryStatus(adminAuthentication());

        assertEquals("DISABLED", status.get("status"));
        assertEquals(false, status.get("healthy"));
        assertEquals(false, status.get("registrationExpected"));
        assertEquals(false, ((Map<?, ?>) status.get("readiness")).get("ready"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), ((Map<?, ?>) status.get("readiness")).get("httpStatus"));
        assertTrue(((List<?>) status.get("knownServices")).isEmpty());
        assertEquals(List.of("Service discovery is disabled"), status.get("warnings"));
        verify(discoveryClient, never()).getServices();
        verify(discoveryClient, never()).getInstances("shop-backend");
    }

    @Test
    void readinessReturnsServiceUnavailableWhenRegistrationIsMissing() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, true, true);

        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(discoveryClient.description()).thenReturn("mock-discovery");
        when(discoveryClient.getServices()).thenReturn(List.of("shop-gateway"));
        when(discoveryClient.getInstances("shop-backend")).thenReturn(List.of());
        when(discoveryClient.getInstances("shop-gateway")).thenReturn(List.of());

        ResponseEntity<Map<String, Object>> response = controller.getRegistryReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("UNREGISTERED", response.getBody().get("status"));
        assertEquals(false, ((Map<?, ?>) response.getBody().get("readiness")).get("ready"));
        assertEquals(List.of("Current service is not visible in discovery results"), response.getBody().get("warnings"));
    }

    @Test
    void registryStatusRequiresRegistryStatusPermission() {
        DiscoveryClient discoveryClient = mock(DiscoveryClient.class);
        Environment environment = mock(Environment.class);
        AdminRegistryController controller = controller(discoveryClient, environment, true, true);
        when(adminRoleService.hasPermission(1L, AdminRoleService.REGISTRY_STATUS_PERMISSION)).thenReturn(false);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> controller.getRegistryStatus(adminAuthentication())
        );

        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
        verify(discoveryClient, never()).description();
        verify(discoveryClient, never()).getServices();
    }

    private AdminRegistryController controller(
            DiscoveryClient discoveryClient,
            Environment environment,
            boolean discoveryEnabled,
            boolean registerEnabled
    ) {
        when(environment.getProperty("spring.application.name", "shop-backend")).thenReturn("shop-backend");
        when(environment.getProperty("spring.cloud.nacos.discovery.enabled", Boolean.class, false)).thenReturn(discoveryEnabled);
        when(environment.getProperty("spring.cloud.nacos.discovery.register-enabled", Boolean.class, false)).thenReturn(registerEnabled);
        when(environment.getProperty("spring.cloud.nacos.discovery.server-addr", "")).thenReturn("127.0.0.1:8848");
        when(environment.getProperty("spring.cloud.nacos.discovery.namespace", "")).thenReturn("");
        when(environment.getProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP")).thenReturn("DEFAULT_GROUP");
        when(environment.getProperty("server.port", "8081")).thenReturn("8081");
        when(environment.getProperty("spring.cloud.nacos.discovery.ip", "")).thenReturn("");
        when(environment.getProperty("spring.cloud.nacos.discovery.port", "8081")).thenReturn("8081");
        when(environment.getProperty("spring.cloud.nacos.discovery.ephemeral", Boolean.class, true)).thenReturn(true);
        when(environment.getProperty("spring.cloud.nacos.discovery.weight", "1")).thenReturn("1");
        grantRegistryStatusPermission();
        return new AdminRegistryController(discoveryClient, environment, adminRoleService);
    }

    private void grantRegistryStatusPermission() {
        when(adminRoleService.hasPermission(1L, AdminRoleService.REGISTRY_STATUS_PERMISSION)).thenReturn(true);
    }

    private Authentication adminAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
