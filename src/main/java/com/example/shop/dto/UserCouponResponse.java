package com.example.shop.dto;

import com.example.shop.entity.UserCoupon;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class UserCouponResponse {
    private Long id;
    private Long couponId;
    private String status;
    private LocalDateTime claimedAt;
    private LocalDateTime usedAt;
    private String couponName;
    private String couponType;
    private BigDecimal thresholdAmount;
    private BigDecimal reductionAmount;
    private Integer discountPercent;
    private BigDecimal maxDiscountAmount;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String description;

    public static UserCouponResponse from(UserCoupon userCoupon) {
        if (userCoupon == null) {
            return null;
        }
        UserCouponResponse response = new UserCouponResponse();
        response.setId(userCoupon.getId());
        response.setCouponId(userCoupon.getCouponId());
        response.setStatus(userCoupon.getStatus());
        response.setClaimedAt(userCoupon.getClaimedAt());
        response.setUsedAt(userCoupon.getUsedAt());
        response.setCouponName(userCoupon.getCouponName());
        response.setCouponType(userCoupon.getCouponType());
        response.setThresholdAmount(userCoupon.getThresholdAmount());
        response.setReductionAmount(userCoupon.getReductionAmount());
        response.setDiscountPercent(userCoupon.getDiscountPercent());
        response.setMaxDiscountAmount(userCoupon.getMaxDiscountAmount());
        response.setStartAt(userCoupon.getStartAt());
        response.setEndAt(userCoupon.getEndAt());
        response.setDescription(userCoupon.getDescription());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCouponId() {
        return couponId;
    }

    public void setCouponId(Long couponId) {
        this.couponId = couponId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getClaimedAt() {
        return claimedAt;
    }

    public void setClaimedAt(LocalDateTime claimedAt) {
        this.claimedAt = claimedAt;
    }

    public LocalDateTime getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(LocalDateTime usedAt) {
        this.usedAt = usedAt;
    }

    public String getCouponName() {
        return couponName;
    }

    public void setCouponName(String couponName) {
        this.couponName = couponName;
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
