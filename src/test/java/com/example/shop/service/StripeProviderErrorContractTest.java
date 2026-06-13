package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class StripeProviderErrorContractTest {

    @Test
    void stripeProviderExceptionsDoNotExposeProviderMessagesToCustomers() throws IOException {
        assertNoStripeMessagePassthrough("src/main/java/com/example/shop/service/PaymentService.java");
        assertNoStripeMessagePassthrough("src/main/java/com/example/shop/service/RefundService.java");
    }

    private void assertNoStripeMessagePassthrough(String path) throws IOException {
        String source = Files.readString(Path.of(path), StandardCharsets.UTF_8);
        assertTrue(source.contains("stripeProviderUnavailable"), path + " should use the shared customer-safe Stripe error helper");
        assertFalse(source.contains("Stripe Checkout session: \" + e.getMessage()"), path + " must not expose Stripe checkout SDK messages");
        assertFalse(source.contains("Stripe refund failed: \" + e.getMessage()"), path + " must not expose Stripe refund SDK messages");
        assertFalse(source.contains("Stripe payment lookup failed: \" + e.getMessage()"), path + " must not expose Stripe lookup SDK messages");
    }
}
