package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class CheckoutRequest {
    @NotNull
    private Long userId;

    @NotEmpty
    private List<Long> cartItemIds;

    @NotEmpty
    private String shippingAddress;

    @NotEmpty
    private String paymentMethod;

    private Long userCouponId;
}
