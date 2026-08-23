package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Digits;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.math.BigDecimal;

@Data
public class PaymentCallbackRequest {
    @NotBlank
    @Size(max = 32)
    private String orderNo;

    @NotBlank
    @Size(max = 30)
    private String channel;

    @NotBlank
    @Size(max = 64)
    private String transactionId;

    @NotBlank
    @Size(max = 20)
    private String status;

    @NotNull
    @DecimalMin("0.00")
    @Digits(integer = 8, fraction = 2)
    private BigDecimal amount;

    @Size(max = 128)
    private String providerReference;

    @NotNull
    @Min(0)
    @Max(4102444800L)
    private Long callbackTimestamp;

    @NotBlank
    @Pattern(regexp = "(?i)^[0-9a-f]{64}$")
    private String signature;
}
