package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class CartAddRequest {
    private static final int MAX_CART_REQUEST_QUANTITY = 999;

    @Min(1)
    private Long userId;

    @NotNull
    @Min(1)
    private Long productId;

    @NotNull
    @Min(1)
    @Max(MAX_CART_REQUEST_QUANTITY)
    private Integer quantity;

    @Size(max = 1000)
    private String selectedSpecs;
}
