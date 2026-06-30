package com.example.shop.dto;

import com.example.shop.entity.Payment;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

@Data
public class PaymentCustomerResponse {
    private static final Set<String> DISPLAYABLE_TRANSACTION_STATUSES = Set.of("PAID", "REFUNDED", "RECONCILE_REQUIRED");

    private Long id;
    private Long orderId;
    private String orderNo;
    private BigDecimal amount;
    private String channel;
    private String currency;
    private String status;
    private String paymentUrl;
    private String transactionId;
    private LocalDateTime expiresAt;
    private LocalDateTime paidAt;
    private LocalDateTime refundedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PaymentCustomerResponse from(Payment payment) {
        return from(payment, null);
    }

    public static PaymentCustomerResponse from(Payment payment, String currency) {
        PaymentCustomerResponse response = new PaymentCustomerResponse();
        populateCustomerFields(payment, response, currency);
        return response;
    }

    protected static void populateCustomerFields(Payment payment, PaymentCustomerResponse response) {
        populateCustomerFields(payment, response, null);
    }

    protected static void populateCustomerFields(Payment payment, PaymentCustomerResponse response, String currency) {
        if (payment == null || response == null) {
            return;
        }
        response.setId(payment.getId());
        response.setOrderId(payment.getOrderId());
        response.setOrderNo(payment.getOrderNo());
        response.setAmount(payment.getAmount());
        response.setChannel(payment.getChannel());
        response.setCurrency(currency);
        response.setStatus(payment.getStatus());
        response.setPaymentUrl(isPending(payment) ? payment.getPaymentUrl() : null);
        response.setTransactionId(isDisplayableTransaction(payment) ? payment.getTransactionId() : null);
        response.setExpiresAt(payment.getExpiresAt());
        response.setPaidAt(payment.getPaidAt());
        response.setRefundedAt(payment.getRefundedAt());
        response.setCreatedAt(payment.getCreatedAt());
        response.setUpdatedAt(payment.getUpdatedAt());
    }

    private static boolean isPending(Payment payment) {
        return payment != null && "PENDING".equalsIgnoreCase(String.valueOf(payment.getStatus()));
    }

    private static boolean isDisplayableTransaction(Payment payment) {
        return payment != null && DISPLAYABLE_TRANSACTION_STATUSES.contains(String.valueOf(payment.getStatus()).toUpperCase());
    }
}
