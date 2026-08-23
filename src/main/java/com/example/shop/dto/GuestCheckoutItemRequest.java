package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class GuestCheckoutItemRequest {
    private static final int MAX_SELECTED_SPECS_CHARS = 2000;
    private static final int MAX_REQUEST_QUANTITY = 999;

    @NotNull
    @Min(1)
    private Long productId;

    @NotNull
    @Min(1)
    @Max(MAX_REQUEST_QUANTITY)
    private Integer quantity;

    @Size(max = MAX_SELECTED_SPECS_CHARS)
    private String selectedSpecs;
}
