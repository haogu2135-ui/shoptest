package com.example.shop.dto;

import com.example.shop.entity.Order;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class AdminOrderResponse {
    private Long id;
    private String orderNo;
    private Long userId;
    private String customerUsername;
    private String customerEmail;
    private String customerPhone;
    private String customerDisplayName;
    private String customerType;
    private BigDecimal totalAmount;
    private BigDecimal originalAmount;
    private BigDecimal discountAmount;
    private BigDecimal shippingFee;
    private Long userCouponId;
    private Long couponId;
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
    private LocalDateTime updatedAt;

    public static AdminOrderResponse from(Order order) {
        AdminOrderResponse response = new AdminOrderResponse();
        if (order == null) {
            return response;
        }
        response.setId(order.getId());
        response.setOrderNo(order.getOrderNo());
        response.setUserId(order.getUserId());
        response.setCustomerUsername(order.getCustomerUsername());
        response.setCustomerEmail(order.getCustomerEmail());
        response.setCustomerPhone(order.getCustomerPhone());
        response.setCustomerDisplayName(order.getCustomerDisplayName());
        response.setCustomerType(order.getCustomerType());
        response.setTotalAmount(order.getTotalAmount());
        response.setOriginalAmount(order.getOriginalAmount());
        response.setDiscountAmount(order.getDiscountAmount());
        response.setShippingFee(order.getShippingFee());
        response.setUserCouponId(order.getUserCouponId());
        response.setCouponId(order.getCouponId());
        response.setCouponName(order.getCouponName());
        response.setStatus(order.getStatus());
        response.setShippingAddress(order.getShippingAddress());
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
        response.setGuestOrder(order.getGuestOrder());
        response.setRefundedAt(order.getRefundedAt());
        response.setShippedAt(order.getShippedAt());
        response.setCompletedAt(order.getCompletedAt());
        response.setCreatedAt(order.getCreatedAt());
        response.setUpdatedAt(order.getUpdatedAt());
        return response;
    }
}
