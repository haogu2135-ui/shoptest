package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

@Data
public class PaymentCallbackRequest {
    @NotBlank
    private String orderNo;

    @NotBlank
    private String channel;

    @NotBlank
    private String transactionId;

    @NotBlank
    private String status;

    @NotNull
    private BigDecimal amount;

    private String providerReference;

    @NotNull
    private Long callbackTimestamp;

    @NotBlank
    private String signature;
}
