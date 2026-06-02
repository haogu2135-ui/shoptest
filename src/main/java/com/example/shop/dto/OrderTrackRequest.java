package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class OrderTrackRequest {
    @NotBlank
    @Size(max = 64)
    private String orderNo;

    @NotBlank
    @Email
    @Size(max = 120)
    private String email;
}
