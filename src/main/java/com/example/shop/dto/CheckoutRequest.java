package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class CheckoutRequest {
    private Long userId;

    @NotEmpty
    @Size(max = 80)
    private List<@NotNull @Min(1) Long> cartItemIds;

    @NotEmpty
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

    @NotEmpty
    @Size(max = 50)
    private String paymentMethod;

    private Long userCouponId;
}
