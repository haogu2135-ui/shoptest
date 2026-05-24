package com.example.shop.controller;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.client.DefaultServiceInstance;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminRegistryControllerTest {

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

        Map<String, Object> status = controller.getRegistryStatus();

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

        ResponseEntity<Map<String, Object>> response = controller.getRegistryReadiness();

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

        Map<String, Object> status = controller.getRegistryStatus();

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

        Map<String, Object> status = controller.getRegistryStatus();

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

        ResponseEntity<Map<String, Object>> response = controller.getRegistryReadiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("UNREGISTERED", response.getBody().get("status"));
        assertEquals(false, ((Map<?, ?>) response.getBody().get("readiness")).get("ready"));
        assertEquals(List.of("Current service is not visible in discovery results"), response.getBody().get("warnings"));
    }

    private AdminRegistryController controller(
            DiscoveryClient discoveryClient,
            Environment environment,
            boolean discoveryEnabled,
            boolean registerEnabled
    ) {
        AdminRegistryController controller = new AdminRegistryController(discoveryClient, environment);
        ReflectionTestUtils.setField(controller, "applicationName", "shop-backend");
        ReflectionTestUtils.setField(controller, "discoveryEnabled", discoveryEnabled);
        ReflectionTestUtils.setField(controller, "registerEnabled", registerEnabled);
        ReflectionTestUtils.setField(controller, "nacosServerAddr", "127.0.0.1:8848");
        ReflectionTestUtils.setField(controller, "namespace", "");
        ReflectionTestUtils.setField(controller, "group", "DEFAULT_GROUP");
        ReflectionTestUtils.setField(controller, "serverPort", "8081");
        ReflectionTestUtils.setField(controller, "configuredIp", "");
        ReflectionTestUtils.setField(controller, "configuredPort", "8081");
        ReflectionTestUtils.setField(controller, "ephemeral", true);
        ReflectionTestUtils.setField(controller, "weight", "1");
        return controller;
    }
}
