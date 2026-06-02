package com.example.shop.entity;

import lombok.Data;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.Email;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
public class Order implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private Long id;
    @Size(max = 32)
    private String orderNo;
    @NotNull
    private Long userId;
    @NotNull
    @DecimalMin("0.00")
    private BigDecimal totalAmount;
    @DecimalMin("0.00")
    private BigDecimal originalAmount;
    @DecimalMin("0.00")
    private BigDecimal discountAmount;
    @DecimalMin("0.00")
    private BigDecimal shippingFee;
    private Long userCouponId;
    private Long couponId;
    @Size(max = 100)
    private String couponName;
    @NotBlank
    @Size(max = 20)
    private String status;
    @NotBlank
    @Size(max = 2000)
    private String shippingAddress;
    @Size(max = 120)
    private String recipientName;
    @Size(max = 60)
    private String recipientPhone;
    @Email
    @Size(max = 160)
    private String contactEmail;
    @NotBlank
    @Size(max = 50)
    private String paymentMethod;
    @Size(max = 100)
    private String trackingNumber;
    @Size(max = 80)
    private String trackingCarrierCode;
    @Size(max = 100)
    private String trackingCarrierName;
    @Size(max = 100)
    private String returnTrackingNumber;
    @Size(max = 1000)
    private String returnReason;
    private LocalDateTime returnRequestedAt;
    private LocalDateTime returnApprovedAt;
    private LocalDateTime returnRejectedAt;
    private LocalDateTime returnShippedAt;
    private LocalDateTime returnedAt;
    private Boolean returnable;
    private LocalDateTime returnDeadline;
    private Boolean guestOrder;
    @Size(max = 120)
    private String customerUsername;
    @Email
    @Size(max = 160)
    private String customerEmail;
    @Size(max = 60)
    private String customerPhone;
    @Size(max = 160)
    private String customerDisplayName;
    @Size(max = 40)
    private String customerType;
    private LocalDateTime refundedAt;
    private LocalDateTime shippedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public BigDecimal getOriginalAmount() {
        return originalAmount;
    }

    public void setOriginalAmount(BigDecimal originalAmount) {
        this.originalAmount = originalAmount;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(BigDecimal discountAmount) {
        this.discountAmount = discountAmount;
    }

    public BigDecimal getShippingFee() {
        return shippingFee;
    }

    public void setShippingFee(BigDecimal shippingFee) {
        this.shippingFee = shippingFee;
    }

    public Long getUserCouponId() {
        return userCouponId;
    }

    public void setUserCouponId(Long userCouponId) {
        this.userCouponId = userCouponId;
    }

    public Long getCouponId() {
        return couponId;
    }

    public void setCouponId(Long couponId) {
        this.couponId = couponId;
    }

    public String getCouponName() {
        return couponName;
    }

    public void setCouponName(String couponName) {
        this.couponName = couponName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getShippingAddress() {
        return shippingAddress;
    }

    public void setShippingAddress(String shippingAddress) {
        this.shippingAddress = shippingAddress;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }

    public String getTrackingCarrierCode() {
        return trackingCarrierCode;
    }

    public void setTrackingCarrierCode(String trackingCarrierCode) {
        this.trackingCarrierCode = trackingCarrierCode;
    }

    public String getTrackingCarrierName() {
        return trackingCarrierName;
    }

    public void setTrackingCarrierName(String trackingCarrierName) {
        this.trackingCarrierName = trackingCarrierName;
    }

    public String getReturnTrackingNumber() {
        return returnTrackingNumber;
    }

    public void setReturnTrackingNumber(String returnTrackingNumber) {
        this.returnTrackingNumber = returnTrackingNumber;
    }

    public String getReturnReason() {
        return returnReason;
    }

    public void setReturnReason(String returnReason) {
        this.returnReason = returnReason;
    }

    public LocalDateTime getReturnRequestedAt() {
        return returnRequestedAt;
    }

    public void setReturnRequestedAt(LocalDateTime returnRequestedAt) {
        this.returnRequestedAt = returnRequestedAt;
    }

    public LocalDateTime getReturnApprovedAt() {
        return returnApprovedAt;
    }

    public void setReturnApprovedAt(LocalDateTime returnApprovedAt) {
        this.returnApprovedAt = returnApprovedAt;
    }

    public LocalDateTime getReturnRejectedAt() {
        return returnRejectedAt;
    }

    public void setReturnRejectedAt(LocalDateTime returnRejectedAt) {
        this.returnRejectedAt = returnRejectedAt;
    }

    public LocalDateTime getReturnShippedAt() {
        return returnShippedAt;
    }

    public void setReturnShippedAt(LocalDateTime returnShippedAt) {
        this.returnShippedAt = returnShippedAt;
    }

    public LocalDateTime getReturnedAt() {
        return returnedAt;
    }

    public void setReturnedAt(LocalDateTime returnedAt) {
        this.returnedAt = returnedAt;
    }

    public Boolean getReturnable() {
        return returnable;
    }

    public void setReturnable(Boolean returnable) {
        this.returnable = returnable;
    }

    public LocalDateTime getReturnDeadline() {
        return returnDeadline;
    }

    public void setReturnDeadline(LocalDateTime returnDeadline) {
        this.returnDeadline = returnDeadline;
    }

    public Boolean getGuestOrder() {
        return guestOrder;
    }

    public void setGuestOrder(Boolean guestOrder) {
        this.guestOrder = guestOrder;
    }

    public LocalDateTime getRefundedAt() {
        return refundedAt;
    }

    public void setRefundedAt(LocalDateTime refundedAt) {
        this.refundedAt = refundedAt;
    }

    public LocalDateTime getShippedAt() {
        return shippedAt;
    }

    public void setShippedAt(LocalDateTime shippedAt) {
        this.shippedAt = shippedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
} 
