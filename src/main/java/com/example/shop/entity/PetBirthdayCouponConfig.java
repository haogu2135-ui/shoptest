package com.example.shop.entity;

import lombok.Data;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "pet_birthday_coupon_configs")
public class PetBirthdayCouponConfig implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "name_prefix", nullable = false)
    private String namePrefix = "Pet Birthday Gift";

    @Column(name = "coupon_type", nullable = false)
    private String couponType = "FULL_REDUCTION";

    @Column(name = "threshold_amount")
    private BigDecimal thresholdAmount = new BigDecimal("30.00");

    @Column(name = "reduction_amount")
    private BigDecimal reductionAmount = new BigDecimal("8.00");

    @Column(name = "discount_percent")
    private Integer discountPercent;

    @Column(name = "max_discount_amount")
    private BigDecimal maxDiscountAmount;

    @Column(name = "valid_days", nullable = false)
    private Integer validDays = 14;

    @Column(name = "max_benefits_per_user", nullable = false)
    private Integer maxBenefitsPerUser = 3;

    @Column(name = "total_quantity_per_coupon")
    private Integer totalQuantityPerCoupon;

    @Column(columnDefinition = "TEXT")
    private String description = "Exclusive birthday coupon for pet profiles. Auto-granted once per pet birthday each year.";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
