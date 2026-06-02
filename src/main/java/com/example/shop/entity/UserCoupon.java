package com.example.shop.entity;

import lombok.Data;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public class UserCoupon implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    @NotNull
    private Long userId;
    @NotNull
    private Long couponId;
    @NotBlank
    @Size(max = 20)
    private String status;
    private Long orderId;
    private LocalDateTime claimedAt;
    private LocalDateTime usedAt;

    @Size(max = 100)
    private String couponName;
    @Size(max = 30)
    private String couponType;
    @Size(max = 30)
    private String couponScope;
    @Size(max = 20)
    private String couponStatus;
    @DecimalMin("0.00")
    private java.math.BigDecimal thresholdAmount;
    @DecimalMin("0.00")
    private java.math.BigDecimal reductionAmount;
    private Integer discountPercent;
    @DecimalMin("0.00")
    private java.math.BigDecimal maxDiscountAmount;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    @Size(max = 2000)
    private String description;
}
