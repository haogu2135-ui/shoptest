package com.example.shop.dto;

import com.example.shop.entity.Order;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderCustomerResponse {
    private Long id;
    private String orderNo;
    private BigDecimal totalAmount;
    private BigDecimal originalAmount;
    private BigDecimal discountAmount;
    private BigDecimal shippingFee;
    private String couponName;
    private String status;
    private String shippingAddress;
    private String recipientName;
    private String recipientPhone;
    private String contactEmail;
    private String paymentMethod;
    private String trackingNumber;
    private String trackingCarrierCode;
    private String trackingCarrierName;
    private String returnTrackingNumber;
    private String returnReason;
    private LocalDateTime returnRequestedAt;
    private LocalDateTime returnApprovedAt;
    private LocalDateTime returnRejectedAt;
    private LocalDateTime returnShippedAt;
    private LocalDateTime returnedAt;
    private Boolean returnable;
    private LocalDateTime returnDeadline;
    private Boolean guestOrder;
    private LocalDateTime refundedAt;
    private LocalDateTime shippedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;

    public static OrderCustomerResponse from(Order order) {
        if (order == null) {
            return null;
        }
        OrderCustomerResponse response = new OrderCustomerResponse();
        response.setId(order.getId());
        response.setOrderNo(order.getOrderNo());
        response.setTotalAmount(order.getTotalAmount());
        response.setOriginalAmount(order.getOriginalAmount());
        response.setDiscountAmount(order.getDiscountAmount());
        response.setShippingFee(order.getShippingFee());
        response.setCouponName(order.getCouponName());
        response.setStatus(order.getStatus());
        response.setShippingAddress(publicShippingAddress(order));
        response.setRecipientName(order.getRecipientName());
        response.setRecipientPhone(order.getRecipientPhone());
        response.setContactEmail(order.getContactEmail());
        response.setPaymentMethod(order.getPaymentMethod());
        response.setTrackingNumber(order.getTrackingNumber());
        response.setTrackingCarrierCode(order.getTrackingCarrierCode());
        response.setTrackingCarrierName(order.getTrackingCarrierName());
        response.setReturnTrackingNumber(order.getReturnTrackingNumber());
        response.setReturnReason(order.getReturnReason());
        response.setReturnRequestedAt(order.getReturnRequestedAt());
        response.setReturnApprovedAt(order.getReturnApprovedAt());
        response.setReturnRejectedAt(order.getReturnRejectedAt());
        response.setReturnShippedAt(order.getReturnShippedAt());
        response.setReturnedAt(order.getReturnedAt());
        response.setReturnable(order.getReturnable());
        response.setReturnDeadline(order.getReturnDeadline());
        response.setGuestOrder(Boolean.TRUE.equals(order.getGuestOrder()) || isGuestShippingAddress(order.getShippingAddress()));
        response.setRefundedAt(order.getRefundedAt());
        response.setShippedAt(order.getShippedAt());
        response.setCompletedAt(order.getCompletedAt());
        response.setCreatedAt(order.getCreatedAt());
        return response;
    }

    private static String publicShippingAddress(Order order) {
        if (order == null) {
            return null;
        }
        String shippingAddress = order.getShippingAddress();
        if (!isGuestShippingAddress(shippingAddress)) {
            return shippingAddress;
        }
        String[] parts = shippingAddress.split(" / ", 4);
        if (parts.length < 4) {
            return null;
        }
        String name = parts[0].substring("[Guest]".length()).trim();
        String phone = parts[1].trim();
        String address = parts[3].trim();
        StringBuilder result = new StringBuilder();
        if (!name.isEmpty()) {
            result.append(name);
        }
        if (!phone.isEmpty()) {
            if (result.length() > 0) {
                result.append(" / ");
            }
            result.append(phone);
        }
        if (!address.isEmpty()) {
            if (result.length() > 0) {
                result.append(" / ");
            }
            result.append(address);
        }
        return result.length() == 0 ? null : result.toString();
    }

    private static boolean isGuestShippingAddress(String shippingAddress) {
        return shippingAddress != null && shippingAddress.startsWith("[Guest]");
    }

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

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(String recipientName) {
        this.recipientName = recipientName;
    }

    public String getRecipientPhone() {
        return recipientPhone;
    }

    public void setRecipientPhone(String recipientPhone) {
        this.recipientPhone = recipientPhone;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public void setContactEmail(String contactEmail) {
        this.contactEmail = contactEmail;
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

}
