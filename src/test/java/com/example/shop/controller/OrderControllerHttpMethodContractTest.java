package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderControllerHttpMethodContractTest {
    private static final List<String> ACTION_PATHS = List.of(
            "/{id}/cancel",
            "/guest/{id}/cancel",
            "/{id}/pay",
            "/{id}/ship",
            "/{id}/confirm",
            "/guest/{id}/confirm",
            "/{id}/return",
            "/guest/{id}/return",
            "/{id}/return-shipment",
            "/guest/{id}/return-shipment"
    );

    @Test
    void orderActionTransitionsUsePostMappings() throws IOException {
        String controller = read("src/main/java/com/example/shop/controller/OrderController.java");

        for (String path : ACTION_PATHS) {
            assertTrue(controller.contains("@PostMapping(\"" + path + "\")"),
                    () -> "Order action should use POST: " + path);
            assertFalse(controller.contains("@PutMapping(\"" + path + "\")"),
                    () -> "Order action must not use PUT: " + path);
        }
    }

    @Test
    void guestActionInfrastructureMatchesPostRoutes() throws IOException {
        String securityConfig = read("src/main/java/com/example/shop/config/SecurityConfig.java");
        String rateLimitService = read("src/main/java/com/example/shop/service/RateLimitService.java");

        assertTrue(securityConfig.contains("HttpMethod.POST, \"/orders/guest/*/cancel\""));
        assertTrue(securityConfig.contains("HttpMethod.POST, \"/orders/guest/*/confirm\""));
        assertTrue(securityConfig.contains("HttpMethod.POST, \"/orders/guest/*/return\""));
        assertTrue(securityConfig.contains("HttpMethod.POST, \"/orders/guest/*/return-shipment\""));
        assertFalse(securityConfig.contains("HttpMethod.PUT, \"/orders/guest/"));

        assertTrue(rateLimitService.contains("\"POST\".equals(method) && isGuestOrderMutationPath(path)"));
        assertTrue(rateLimitService.contains("new EndpointLimit(\"POST\", \"orders:guest-mutation\""));
        assertFalse(rateLimitService.contains("new EndpointLimit(\"PUT\", \"orders:guest-mutation\""));
    }

    @Test
    void frontendOrderActionsCallPostEndpoints() throws IOException {
        String api = read("frontend/src/api/index.ts");

        assertTrue(api.contains("api.post(`${guestOrderPath(id, guestEmail, orderNo)}/cancel`"));
        assertTrue(api.contains("api.post(`${guestOrderPath(id, guestEmail, orderNo)}/confirm`"));
        assertTrue(api.contains("api.post(`${guestOrderPath(id, guestEmail, orderNo)}/return`"));
        assertTrue(api.contains("api.post(`${guestOrderPath(id, guestEmail, orderNo)}/return-shipment`"));
        assertTrue(api.contains("pay: (id: number) => api.post(`/orders/${toPathId(id)}/pay`)"));
        assertTrue(api.contains("ship: (id: number) => api.post(`/orders/${toPathId(id)}/ship`)"));
    }

    private String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }
}
