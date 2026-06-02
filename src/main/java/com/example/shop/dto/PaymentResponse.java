package com.example.shop.dto;

import com.example.shop.entity.Payment;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

@Data
public class PaymentResponse {
    private static final Set<String> DISPLAYABLE_TRANSACTION_STATUSES = Set.of("PAID", "REFUNDED");

    private Long id;
    private Long orderId;
    private String orderNo;
    private BigDecimal amount;
    private String channel;
    private String status;
    private String paymentUrl;
    private String transactionId;
    private LocalDateTime expiresAt;
    private LocalDateTime paidAt;
    private LocalDateTime refundedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PaymentResponse from(Payment payment) {
        PaymentResponse response = new PaymentResponse();
        if (payment == null) {
            return response;
        }
        response.setId(payment.getId());
        response.setOrderId(payment.getOrderId());
        response.setOrderNo(payment.getOrderNo());
        response.setAmount(payment.getAmount());
        response.setChannel(payment.getChannel());
        response.setStatus(payment.getStatus());
        response.setPaymentUrl(isPending(payment) ? payment.getPaymentUrl() : null);
        response.setTransactionId(isDisplayableTransaction(payment) ? payment.getTransactionId() : null);
        response.setExpiresAt(payment.getExpiresAt());
        response.setPaidAt(payment.getPaidAt());
        response.setRefundedAt(payment.getRefundedAt());
        response.setCreatedAt(payment.getCreatedAt());
        response.setUpdatedAt(payment.getUpdatedAt());
        return response;
    }

    private static boolean isPending(Payment payment) {
        return payment != null && "PENDING".equalsIgnoreCase(String.valueOf(payment.getStatus()));
    }

    private static boolean isDisplayableTransaction(Payment payment) {
        return payment != null && DISPLAYABLE_TRANSACTION_STATUSES.contains(String.valueOf(payment.getStatus()).toUpperCase());
    }
}
