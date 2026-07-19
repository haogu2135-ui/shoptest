package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GuestCredentialTransportContractTest {
    @Test
    void guestOrderPaymentAndLogisticsReadsDoNotAcceptCredentialsInGetQueryParameters() throws Exception {
        String orderController = Files.readString(Path.of("src/main/java/com/example/shop/controller/OrderController.java"));
        String paymentController = Files.readString(Path.of("src/main/java/com/example/shop/controller/PaymentController.java"));
        String logisticsController = Files.readString(Path.of("src/main/java/com/example/shop/controller/LogisticsController.java"));
        String supportController = Files.readString(Path.of("src/main/java/com/example/shop/controller/SupportController.java"));
        String securityConfig = Files.readString(Path.of("src/main/java/com/example/shop/config/SecurityConfig.java"));
        String apiClient = Files.readString(Path.of("frontend/src/api/index.ts"));

        assertTrue(orderController.contains("@PostMapping(\"/guest/{id}\")"));
        assertTrue(orderController.contains("@PostMapping(\"/guest/{id}/items\")"));
        assertTrue(orderController.contains("@PostMapping(\"/track\")"));
        assertTrue(orderController.contains("@GetMapping(\"/track\")"));
        assertTrue(orderController.contains("Use POST /orders/track"));
        assertFalse(orderController.contains("@GetMapping(\"/guest/{id}\")"));
        assertFalse(orderController.contains("@GetMapping(\"/guest/{id}/items\")"));
        assertFalse(orderController.contains("@RequestParam String guestEmail"));
        assertFalse(orderController.contains("@RequestParam String orderNo"));

        assertTrue(paymentController.contains("@PostMapping(\"/guest/order/{orderId}\")"));
        assertTrue(paymentController.contains("@PostMapping(\"/guest/order/{orderId}/latest\")"));
        assertFalse(paymentController.contains("@GetMapping(\"/guest/order/{orderId}\")"));
        assertFalse(paymentController.contains("@GetMapping(\"/guest/order/{orderId}/latest\")"));
        assertFalse(paymentController.contains("@RequestParam(required = false) String guestEmail"));
        assertFalse(paymentController.contains("@RequestParam String guestEmail"));

        assertTrue(logisticsController.contains("@PostMapping(\"/track\")"));
        assertFalse(logisticsController.contains("@RequestParam(required = false) String guestEmail"));
        assertFalse(logisticsController.contains("@RequestParam(required = false) String orderNo"));

        assertTrue(supportController.contains("@PostMapping(\"/support/guest/session/lookup\")"));
        assertTrue(supportController.contains("@PostMapping(\"/support/guest/sessions/{sessionId}/messages\")"));
        assertTrue(supportController.contains("@Valid @RequestBody(required = false) GuestOrderAccessRequest body"));
        assertTrue(supportController.contains("@Valid @RequestBody(required = false) GuestSupportMessagesRequest body"));
        assertTrue(supportController.contains("Authenticated support endpoints expose only default account sessions"));
        assertTrue(supportController.contains("supportService.isDefaultUserSession(session)"));
        assertFalse(supportController.contains("@GetMapping(\"/support/guest/session\")"));
        assertFalse(supportController.contains("@GetMapping(\"/support/guest/sessions/{sessionId}/messages\")"));
        assertFalse(supportController.contains("@RequestParam String orderNo"));
        assertFalse(supportController.contains("@RequestParam String email"));

        assertTrue(securityConfig.contains(".antMatchers(HttpMethod.POST, \"/support/guest/session\", \"/support/guest/session/lookup\","));
        assertFalse(securityConfig.contains(".antMatchers(HttpMethod.GET, \"/support/guest/session\""));
        assertFalse(securityConfig.contains(".antMatchers(HttpMethod.GET, \"/orders/guest/*\", \"/orders/guest/**\")"));
        assertTrue(securityConfig.contains(".antMatchers(HttpMethod.POST, \"/orders/guest/*\", \"/orders/guest/**\")"));

        assertTrue(apiClient.contains("api.post<OrderTrackResult>('/orders/track'"));
        assertTrue(apiClient.contains("api.post<OrderCustomer>(`/orders/guest/${normalizedId}`, credentials, anonymousRequestConfig())"));
        assertTrue(apiClient.contains("api.post<OrderItemCustomer[]>(`/orders/guest/${normalizedOrderId}/items`, credentials, anonymousRequestConfig())"));
        assertTrue(apiClient.contains("api.post<PaymentCustomer[]>(`/payments/guest/order/${normalizedId}`, credentials, anonymousRequestConfig())"));
        assertTrue(apiClient.contains("api.post<PaymentCustomer>(`/payments/guest/order/${normalizedId}/latest`, credentials, anonymousRequestConfig("));
        assertTrue(apiClient.contains("anonymousRequestConfig({}, options)") || apiClient.contains("anonymousRequestConfig())"));
        assertFalse(apiClient.contains("api.get<OrderTrackResult>('/orders/track'"));
        assertFalse(apiClient.contains("api.get<OrderCustomer>(`/orders/guest/${normalizedId}`"));
        assertFalse(apiClient.contains("api.get<OrderItemCustomer[]>(`/orders/guest/${normalizedOrderId}/items`"));
        assertFalse(apiClient.contains("api.get<PaymentCustomer[]>(`/payments/guest/order/${normalizedId}`"));
        assertFalse(apiClient.contains("api.get<PaymentCustomer>(`/payments/guest/order/${normalizedId}/latest`"));
        assertTrue(apiClient.contains("api.post<SupportSessionCustomer>('/support/guest/session/lookup'"));
        assertTrue(apiClient.contains("api.post<SupportMessageCustomer[]>(`/support/guest/sessions/${toPathId(sessionId)}/messages`"));
        assertFalse(apiClient.contains("api.get<SupportSessionCustomer>('/support/guest/session'"));
        assertFalse(apiClient.contains("api.get<SupportMessageCustomer[]>(`/support/guest/sessions/${toPathId(sessionId)}/messages`"));
    }
}
