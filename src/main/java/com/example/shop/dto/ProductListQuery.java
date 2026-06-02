package com.example.shop.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductListQuery {
    private String keyword;
    private Long categoryId;
    private Boolean discount;
    private Boolean featured;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private List<String> petSizes;
    private List<String> materials;
    private List<String> colors;
    private String collection;
    private String status;
    private Integer page;
    private Integer size;
    private String sort;
}
