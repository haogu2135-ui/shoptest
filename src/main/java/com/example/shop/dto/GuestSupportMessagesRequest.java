package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.Max;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Positive;
import javax.validation.constraints.Size;

@Data
public class GuestSupportMessagesRequest {
    @NotBlank
    @Email
    @Size(max = 120)
    private String guestEmail;

    @NotBlank
    @Size(max = 64)
    private String orderNo;

    @Positive
    @Max(120)
    private Integer limit;

    @Positive
    private Long afterId;
}
