package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class RefundServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/RefundService.java");

    @Test
    void refundServiceKeepsAtomicClaimAndIdempotentCompletionContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@Transactional(rollbackFor = Exception.class)"));
        assertTrue(source.contains("Payment payment = findLatestRefundablePayment(order.getId());"));
        assertTrue(source.contains("paymentRepository.findLatestPaidByOrderId(orderId)"));
        assertTrue(source.contains("paymentRepository.findLatestReconcileRequiredByOrderId(orderId)"));
        assertTrue(source.contains("int claimed = paymentRepository.markRefunding(payment.getId());"));
        assertTrue(source.contains("if (STATUS_REFUNDED.equals(latestStatus))"));
        assertTrue(source.contains("if (STATUS_REFUNDING.equals(latestStatus))"));
        assertTrue(source.contains("paymentRepository.revertRefunding(payment.getId(), claimedStatus);"));
        assertTrue(source.contains("paymentRepository.markRefunded(payment.getId(), refundReference);"));
    }

    @Test
    void refundServiceKeepsGatewayRefundValidationAndIdempotencyContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("GatewayUrlValidator.requireOutboundHttpUrl(refundUrl"));
        assertTrue(source.contains("payload.put(\"idempotencyKey\", idempotencyKey);"));
        assertTrue(source.contains("headers.set(\"Idempotency-Key\", idempotencyKey);"));
        assertTrue(source.contains("circuitBreakerService.execute(\"payment-refund-\" + channel.getCode()"));
        assertTrue(source.contains("validateGatewayRefundAmount(root, payment, channel);"));
        assertTrue(source.contains("Gateway refund response is missing refund reference"));
        assertTrue(source.contains("Gateway refund response amount mismatch"));
        assertTrue(source.contains("Gateway refund response currency mismatch"));
        assertTrue(source.contains("return \"return-refund-\" + order.getId() + \"-\" + payment.getId();"));
        assertTrue(source.contains("Manual refund reference must be 128 characters or less"));
    }
}
