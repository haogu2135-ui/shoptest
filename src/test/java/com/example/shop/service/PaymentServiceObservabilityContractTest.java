package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class PaymentServiceObservabilityContractTest {

    @Test
    void paymentServiceLogsCriticalLifecycleEventsWithoutSensitivePaymentDetails() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/PaymentService.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("@Slf4j"), "PaymentService must keep structured logger support");
        assertTrue(source.contains("private void logPaymentLifecycle(String event, Payment payment)"),
                "Payment lifecycle logs should stay centralized and safe");
        assertTrue(source.contains("Payment created via Stripe"));
        assertTrue(source.contains("Payment created via generic API"));
        assertTrue(source.contains("Payment created via redirect"));
        assertTrue(source.contains("Payment refreshed via Stripe"));
        assertTrue(source.contains("Payment refreshed via generic API"));
        assertTrue(source.contains("Payment refreshed"));
        assertTrue(source.contains("Payment callback marked payment paid"));
        assertTrue(source.contains("Payment callback marked payment failed"));
        assertTrue(source.contains("Stripe webhook marked payment paid"));
        assertTrue(source.contains("Stripe sync marked payment paid"));
        assertTrue(source.contains("Payment expiry marked payment expired"));
        assertTrue(source.contains("Provider paid reconciliation required"));
        assertTrue(source.contains("Stripe payment sync failed"));
        assertTrue(source.contains("Payment callback rejected invalid signature"));

        assertTrue(source.contains("paymentId={}, orderId={}, orderNo={}, channel={}, amount={}, status={}"),
                "Lifecycle logs should include stable payment/order context");
        assertFalse(source.contains("paymentUrl={}"), "Payment URLs must not be emitted in lifecycle logs");
        assertFalse(source.contains("webhookSecret={}"), "Webhook secrets must not be emitted in logs");
        assertFalse(source.contains("secretKey={}"), "Gateway secret keys must not be emitted in logs");
    }

    @Test
    void paymentRetriesAvoidLegacyFixedSleepConsumerLoop() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/service/PaymentService.java"),
                StandardCharsets.UTF_8);

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/mq/PayMessageConsumers.java")));
        assertFalse(source.contains("Thread.sleep(200)"));
        assertTrue(source.contains("private long gatewayRetryDelayMs(int failedAttempt, long initialDelayMs, long maxDelayMs)"));
        assertTrue(source.contains("long multiplier = 1L << Math.min(Math.max(0, failedAttempt - 1), 10);"));
        assertTrue(source.contains("TimeUnit.MILLISECONDS.sleep(retryDelayMs);"));
        assertTrue(source.contains("payment.gateway-http-retry-initial-delay-ms"));
        assertTrue(source.contains("payment.gateway-http-retry-max-delay-ms"));
    }
}
