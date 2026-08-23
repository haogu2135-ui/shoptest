package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
public class SeckillPurchaseRequest {
    @NotNull
    @Min(1)
    private Long itemId;

    @NotNull
    @Min(1)
    private Integer quantity = 1;

    @Size(max = 1000)
    private String selectedSpecs;

    @NotBlank
    @Size(max = 2000)
    private String shippingAddress;

    @NotBlank
    @Size(max = 120)
    private String recipientName;

    @NotBlank
    @Size(max = 40)
    @Pattern(regexp = "^(?=(?:.*\\d){6,20})\\+?[\\d\\s().-]{6,40}$")
    private String recipientPhone;

    @Email
    @Size(max = 160)
    private String contactEmail;

    @NotBlank
    @Size(max = 50)
    private String paymentMethod;
}
