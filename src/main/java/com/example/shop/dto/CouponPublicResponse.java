package com.example.shop.dto;

import com.example.shop.entity.Coupon;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CouponPublicResponse {
    private Long id;
    private String name;
    private String couponType;
    private BigDecimal thresholdAmount;
    private BigDecimal reductionAmount;
    private Integer discountPercent;
    private BigDecimal maxDiscountAmount;
    private Integer remainingQuantity;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String description;

    public static CouponPublicResponse from(Coupon coupon) {
        if (coupon == null) {
            return null;
        }
        CouponPublicResponse response = new CouponPublicResponse();
        response.setId(coupon.getId());
        response.setName(coupon.getName());
        response.setCouponType(coupon.getCouponType());
        response.setThresholdAmount(coupon.getThresholdAmount());
        response.setReductionAmount(coupon.getReductionAmount());
        response.setDiscountPercent(coupon.getDiscountPercent());
        response.setMaxDiscountAmount(coupon.getMaxDiscountAmount());
        response.setRemainingQuantity(remainingQuantity(coupon));
        response.setStartAt(coupon.getStartAt());
        response.setEndAt(coupon.getEndAt());
        response.setDescription(coupon.getDescription());
        return response;
    }

    private static Integer remainingQuantity(Coupon coupon) {
        Integer totalQuantity = coupon.getTotalQuantity();
        if (totalQuantity == null) {
            return null;
        }
        int claimedQuantity = coupon.getClaimedQuantity() == null ? 0 : Math.max(0, coupon.getClaimedQuantity());
        return Math.max(0, totalQuantity - claimedQuantity);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCouponType() {
        return couponType;
    }

    public void setCouponType(String couponType) {
        this.couponType = couponType;
    }

    public BigDecimal getThresholdAmount() {
        return thresholdAmount;
    }

    public void setThresholdAmount(BigDecimal thresholdAmount) {
        this.thresholdAmount = thresholdAmount;
    }

    public BigDecimal getReductionAmount() {
        return reductionAmount;
    }

    public void setReductionAmount(BigDecimal reductionAmount) {
        this.reductionAmount = reductionAmount;
    }

    public Integer getDiscountPercent() {
        return discountPercent;
    }

    public void setDiscountPercent(Integer discountPercent) {
        this.discountPercent = discountPercent;
    }

    public BigDecimal getMaxDiscountAmount() {
        return maxDiscountAmount;
    }

    public void setMaxDiscountAmount(BigDecimal maxDiscountAmount) {
        this.maxDiscountAmount = maxDiscountAmount;
    }

    public Integer getRemainingQuantity() {
        return remainingQuantity;
    }

    public void setRemainingQuantity(Integer remainingQuantity) {
        this.remainingQuantity = remainingQuantity;
    }

    public LocalDateTime getStartAt() {
        return startAt;
    }

    public void setStartAt(LocalDateTime startAt) {
        this.startAt = startAt;
    }

    public LocalDateTime getEndAt() {
        return endAt;
    }

    public void setEndAt(LocalDateTime endAt) {
        this.endAt = endAt;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
