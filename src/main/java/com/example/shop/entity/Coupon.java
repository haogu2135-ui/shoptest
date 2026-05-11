package com.example.shop.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "coupons")
public class Coupon implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "coupon_type", nullable = false)
    private String couponType;

    @Column(nullable = false)
    private String scope = "PUBLIC";

    @Column(nullable = false)
    private String status = "ACTIVE";

    @Column(name = "threshold_amount")
    private BigDecimal thresholdAmount;

    @Column(name = "reduction_amount")
    private BigDecimal reductionAmount;

    @Column(name = "discount_percent")
    private Integer discountPercent;

    @Column(name = "max_discount_amount")
    private BigDecimal maxDiscountAmount;

    @Column(name = "total_quantity")
    private Integer totalQuantity;

    @Column(name = "claimed_quantity")
    private Integer claimedQuantity = 0;

    @Column(name = "start_at")
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
