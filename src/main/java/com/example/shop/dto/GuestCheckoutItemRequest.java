package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class GuestCheckoutItemRequest {
    private static final int MAX_SELECTED_SPECS_CHARS = 2000;

    @NotNull
    private Long productId;

    @NotNull
    @Min(1)
    private Integer quantity;

    @Size(max = MAX_SELECTED_SPECS_CHARS)
    private String selectedSpecs;
}
