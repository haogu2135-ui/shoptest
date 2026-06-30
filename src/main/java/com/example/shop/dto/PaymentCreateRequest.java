package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Positive;
import javax.validation.constraints.Size;

@Data
public class PaymentCreateRequest {
    @NotNull
    @Positive
    private Long orderId;

    @NotBlank
    @Size(max = 40)
    private String channel;

    @Size(max = 64)
    private String orderNo;

    @Email
    @Size(max = 120)
    private String guestEmail;
}
