package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class CheckoutRequest {
    private Long userId;

    @NotEmpty
    private List<Long> cartItemIds;

    @NotEmpty
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

    @NotEmpty
    private String paymentMethod;

    private Long userCouponId;
}
