package com.example.shop.entity;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class UserCoupon implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Long userId;
    private Long couponId;
    private String status;
    private Long orderId;
    private LocalDateTime claimedAt;
    private LocalDateTime usedAt;

    private String couponName;
    private String couponType;
    private String couponScope;
    private java.math.BigDecimal thresholdAmount;
    private java.math.BigDecimal reductionAmount;
    private Integer discountPercent;
    private java.math.BigDecimal maxDiscountAmount;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String description;
}
