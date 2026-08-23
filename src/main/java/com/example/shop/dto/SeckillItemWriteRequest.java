package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;

import java.math.BigDecimal;

@Data
public class SeckillItemWriteRequest {
    @NotNull
    @Min(1)
    private Long productId;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal seckillPrice;

    @NotNull
    @Min(1)
    private Integer quota;

    @NotNull
    @Min(1)
    private Integer limitPerUser = 1;
}
