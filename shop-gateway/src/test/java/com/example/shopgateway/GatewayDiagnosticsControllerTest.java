package com.example.shopgateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@TestPropertySource(properties = {
    "spring.cloud.nacos.discovery.enabled=false",
    "spring.cloud.gateway.discovery.locator.enabled=false"
})
class GatewayDiagnosticsControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void exposesGatewayStatusWithConfiguredRoutes() {
        webTestClient.get()
            .uri("/gateway/status")
            .exchange()
            .expectStatus().isOk()
            .expectBody()
            .jsonPath("$.applicationName").isEqualTo("shop-gateway")
            .jsonPath("$.status").isEqualTo("DEGRADED")
            .jsonPath("$.healthy").isEqualTo(false)
            .jsonPath("$.nacos.discoveryEnabled").isEqualTo(false)
            .jsonPath("$.nacos.expectedBackendServiceId").isEqualTo("shop-backend")
            .jsonPath("$.backendService.serviceId").isEqualTo("shop-backend")
            .jsonPath("$.backendService.discoveryCheckEnabled").isEqualTo(false)
            .jsonPath("$.backendService.visible").isEqualTo(false)
            .jsonPath("$.backendService.instanceCount").isEqualTo(0)
            .jsonPath("$.routeCount").isEqualTo(14)
            .jsonPath("$.missingRequiredRouteIds.length()").isEqualTo(0)
            .jsonPath("$.routes[?(@.id == 'shop-direct-api')].uri").isEqualTo("lb://shop-backend")
            .jsonPath("$.routes[?(@.id == 'shop-admin')].uri").isEqualTo("lb://shop-backend")
            .jsonPath("$.routes[?(@.id == 'shop-support-websocket')].uri").isEqualTo("lb:ws://shop-backend")
            .jsonPath("$.readiness.ready").isEqualTo(false)
            .jsonPath("$.readiness.httpStatus").isEqualTo(503)
            .jsonPath("$.diagnostics.gatewayReadinessEndpoint").isEqualTo("/gateway/status/readiness")
            .jsonPath("$.diagnostics.backendRegistryViaGateway").isEqualTo("/gateway/admin/admin/registry")
            .jsonPath("$.diagnostics.backendRegistryReadinessViaGateway").isEqualTo("/gateway/admin/admin/registry/readiness")
            .jsonPath("$.diagnostics.gatewayRoutesEndpoint").isEqualTo("/actuator/gateway/routes");
    }

    @Test
    void readinessUsesHttpStatusForDeploymentChecks() {
        webTestClient.get()
            .uri("/gateway/status/readiness")
            .exchange()
            .expectStatus().is5xxServerError()
            .expectBody()
            .jsonPath("$.status").isEqualTo("DEGRADED")
            .jsonPath("$.healthy").isEqualTo(false)
            .jsonPath("$.readiness.ready").isEqualTo(false)
            .jsonPath("$.readiness.httpStatus").isEqualTo(503);
    }
}
