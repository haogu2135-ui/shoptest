package com.example.shopgateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.test.context.TestPropertySource;

import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
    "spring.cloud.nacos.discovery.enabled=false",
    "spring.cloud.gateway.discovery.locator.enabled=false"
})
class GatewayRouteConfigTest {
    @Autowired
    private RouteLocator routeLocator;

    @Test
    void loadsCoreGatewayRoutes() {
        Set<String> routeIds = routeLocator.getRoutes()
            .map((route) -> route.getId())
            .collect(Collectors.toSet())
            .block();

        assertThat(routeIds).contains(
            "shop-identity",
            "shop-catalog",
            "shop-order",
            "shop-payment",
            "shop-admin",
            "shop-support-websocket"
        );
    }
}
