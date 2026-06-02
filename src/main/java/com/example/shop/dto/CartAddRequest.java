package com.example.shop.dto;

import lombok.Data;

@Data
public class CartAddRequest {
    private Long userId;
    private Long productId;
    private Integer quantity;
    private String selectedSpecs;
}
