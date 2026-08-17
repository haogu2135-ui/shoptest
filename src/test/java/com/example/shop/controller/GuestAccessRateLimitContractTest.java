package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GuestAccessRateLimitContractTest {
    @Test
    void everyGuestOrderSurfaceUsesTheSharedCredentialFailureLimiter() throws Exception {
        String order = source("OrderController.java");
        String payment = source("PaymentController.java");
        String logistics = source("LogisticsController.java");
        String support = source("SupportController.java");
        String limiter = Files.readString(Path.of(
                "src/main/java/com/example/shop/service/GuestAccessRateLimitService.java"));

        assertTrue(order.contains("assertGuestAccessAllowed(\"order-track\""));
        assertTrue(order.contains("recordGuestAccessFailure(\"order-track\""));
        assertTrue(order.contains("assertGuestAccessAllowed(\"order-read\""));
        assertTrue(order.contains("assertGuestAccessAllowed(\"order-mutation\""));
        assertTrue(order.contains("recordGuestMutationFailure(body, allowGuestCredentials, request)"));

        assertTrue(payment.contains("assertGuestAccessAllowed(\"payment-create\""));
        assertTrue(payment.contains("assertGuestAccessAllowed(\"payment-sync\""));
        assertTrue(payment.contains("assertGuestAccessAllowed(\"payment-read\""));
        assertTrue(logistics.contains("assertGuestAccessAllowed(\"logistics\""));
        assertTrue(support.contains("assertGuestAccessAllowed(\"support\""));

        assertTrue(limiter.contains("key(\"credential\", orderNo, email)"));
        assertTrue(limiter.contains("MessageDigest.getInstance(\"SHA-256\")"));
        assertFalse(limiter.contains("key(\"credential\", scope"));
    }

    private String source(String name) throws Exception {
        return Files.readString(Path.of("src/main/java/com/example/shop/controller", name));
    }
}
