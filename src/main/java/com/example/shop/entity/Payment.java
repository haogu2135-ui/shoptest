package com.example.shop.entity;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class Payment implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long orderId;
    private String orderNo;
    private BigDecimal amount;
    private String channel;
    private String status;
    private String paymentUrl;
    private String transactionId;
    private String providerReference;
    private String refundReference;
    private LocalDateTime expiresAt;
    private LocalDateTime paidAt;
    private LocalDateTime refundedAt;
    private LocalDateTime callbackAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
