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

        assertTrue(orderController.contains("@PostMapping(\"/guest/{id}\")"));
        assertTrue(orderController.contains("@PostMapping(\"/guest/{id}/items\")"));
        assertFalse(orderController.contains("@GetMapping(\"/guest/{id}\")"));
        assertFalse(orderController.contains("@GetMapping(\"/guest/{id}/items\")"));
        assertFalse(orderController.contains("@RequestParam String guestEmail"));

        assertTrue(paymentController.contains("@PostMapping(\"/guest/order/{orderId}\")"));
        assertTrue(paymentController.contains("@PostMapping(\"/guest/order/{orderId}/latest\")"));
        assertFalse(paymentController.contains("@GetMapping(\"/guest/order/{orderId}\")"));
        assertFalse(paymentController.contains("@GetMapping(\"/guest/order/{orderId}/latest\")"));
        assertFalse(paymentController.contains("@RequestParam(required = false) String guestEmail"));
        assertFalse(paymentController.contains("@RequestParam String guestEmail"));

        assertTrue(logisticsController.contains("@PostMapping(\"/track\")"));
        assertFalse(logisticsController.contains("@RequestParam(required = false) String guestEmail"));
        assertFalse(logisticsController.contains("@RequestParam(required = false) String orderNo"));
    }
}
