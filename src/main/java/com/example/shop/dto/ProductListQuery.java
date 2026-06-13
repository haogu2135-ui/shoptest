package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductListQuery {
    @Size(max = 120)
    private String keyword;
    private Long categoryId;
    private Boolean includeChildren;
    private Boolean discount;
    private Boolean featured;
    @DecimalMin("0.00")
    private BigDecimal minPrice;
    @DecimalMin("0.00")
    private BigDecimal maxPrice;
    @Size(max = 32)
    private List<String> petSizes;
    @Size(max = 32)
    private List<String> materials;
    @Size(max = 32)
    private List<String> colors;
    @Size(max = 80)
    private String collection;
    @Size(max = 40)
    private String status;
    @Min(0)
    private Integer page;
    @Min(1)
    @Max(500)
    private Integer size;
    @Size(max = 80)
    private String sort;
}
