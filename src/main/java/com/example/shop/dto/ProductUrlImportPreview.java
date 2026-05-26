package com.example.shop.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class ProductUrlImportPreview {
    private String sourceUrl;
    private String sourceHost;
    private String name;
    private String description;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private String currency;
    private String imageUrl;
    private List<String> images = new ArrayList<>();
    private String brand;
    private Integer confidenceScore;
    private List<String> warnings = new ArrayList<>();
}
