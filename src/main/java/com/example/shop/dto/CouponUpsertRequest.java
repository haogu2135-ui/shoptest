package com.example.shop.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CouponUpsertRequest {
    @NotBlank
    private String name;

    @NotBlank
    private String couponType;

    private String scope;
    private String status;
    private BigDecimal thresholdAmount;
    private BigDecimal reductionAmount;
    private Integer discountPercent;
    private BigDecimal maxDiscountAmount;
    private Integer totalQuantity;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String description;
}
