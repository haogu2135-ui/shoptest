package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class Payment implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    @NotNull
    private Long orderId;
    @NotBlank
    @Size(max = 32)
    private String orderNo;
    @NotNull
    @DecimalMin("0.00")
    private BigDecimal amount;
    @NotBlank
    @Size(max = 30)
    private String channel;
    @NotBlank
    @Size(max = 20)
    private String status;
    @Size(max = 500)
    private String paymentUrl;
    @Size(max = 64)
    private String transactionId;
    @Size(max = 128)
    private String providerReference;
    @Size(max = 128)
    private String refundReference;
    private LocalDateTime expiresAt;
    private LocalDateTime paidAt;
    private LocalDateTime refundedAt;
    private LocalDateTime callbackAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
