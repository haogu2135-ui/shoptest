package com.example.shop.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Index;
import javax.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@Entity
@Table(name = "coupons", indexes = {
        @Index(name = "idx_coupons_public_claimable", columnList = "scope,status,start_at,end_at,total_quantity,claimed_quantity,id")
})
public class Coupon implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @NotBlank
    @Size(max = 100)
    private String name;

    @Column(name = "coupon_type", nullable = false)
    @NotBlank
    @Size(max = 30)
    private String couponType;

    @Column(nullable = false)
    @NotBlank
    @Size(max = 30)
    private String scope = "PUBLIC";

    @Column(nullable = false)
    @NotBlank
    @Size(max = 20)
    private String status = "ACTIVE";

    @Column(name = "threshold_amount")
    @DecimalMin("0.00")
    private BigDecimal thresholdAmount;

    @Column(name = "reduction_amount")
    @DecimalMin("0.00")
    private BigDecimal reductionAmount;

    @Column(name = "discount_percent")
    @Min(1)
    @Max(100)
    private Integer discountPercent;

    @Column(name = "max_discount_amount")
    @DecimalMin("0.00")
    private BigDecimal maxDiscountAmount;

    @Column(name = "total_quantity")
    @Min(0)
    private Integer totalQuantity;

    @Column(name = "claimed_quantity")
    @Min(0)
    private Integer claimedQuantity = 0;

    @Column(name = "used_count")
    @Min(0)
    private Integer usedCount = 0;

    @Column(name = "start_at")
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(columnDefinition = "TEXT")
    @Size(max = 2000)
    private String description;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
