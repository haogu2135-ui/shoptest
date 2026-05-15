package com.example.shop.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PetBirthdayCouponConfigRequest {
    private Boolean enabled;
    private String namePrefix;
    private String couponType;
    private BigDecimal thresholdAmount;
    private BigDecimal reductionAmount;
    private Integer discountPercent;
    private BigDecimal maxDiscountAmount;
    private Integer validDays;
    private Integer maxBenefitsPerUser;
    private Integer totalQuantityPerCoupon;
    private String description;
}
