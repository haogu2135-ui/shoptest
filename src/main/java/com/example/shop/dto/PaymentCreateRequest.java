package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class PaymentCreateRequest {
    @NotNull
    private Long orderId;

    @NotBlank
    private String channel;
}
