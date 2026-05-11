package com.example.shop.dto;

import com.example.shop.entity.UserCoupon;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CouponQuoteResponse {
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal shippingFee;
    private BigDecimal payableAmount;
    private Long selectedUserCouponId;
    private List<UserCoupon> availableCoupons;

    public CouponQuoteResponse(BigDecimal subtotal, BigDecimal discountAmount, BigDecimal payableAmount,
                               Long selectedUserCouponId, List<UserCoupon> availableCoupons) {
        this.subtotal = subtotal;
        this.discountAmount = discountAmount;
        this.shippingFee = BigDecimal.ZERO;
        this.payableAmount = payableAmount;
        this.selectedUserCouponId = selectedUserCouponId;
        this.availableCoupons = availableCoupons;
    }
}
