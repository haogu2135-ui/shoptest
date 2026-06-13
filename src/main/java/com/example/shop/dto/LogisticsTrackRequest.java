package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class LogisticsTrackRequest {
    @NotBlank
    @Size(max = 120)
    private String trackingNumber;

    @Size(max = 40)
    private String carrier;

    private Long orderId;

    @NotBlank
    @Email
    @Size(max = 120)
    private String guestEmail;

    @NotBlank
    @Size(max = 64)
    private String orderNo;
}
