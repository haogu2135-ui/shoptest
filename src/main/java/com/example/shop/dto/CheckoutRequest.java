package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class CheckoutRequest {
    private Long userId;

    @NotEmpty
    private List<Long> cartItemIds;

    @NotEmpty
    private String shippingAddress;

    private String recipientName;
    private String recipientPhone;
    private String contactEmail;

    @NotEmpty
    private String paymentMethod;

    private Long userCouponId;
}
