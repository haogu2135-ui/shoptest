package com.example.shop.service;

import com.example.shop.entity.Coupon;
import com.example.shop.entity.CartItem;
import com.example.shop.entity.UserCoupon;
import com.example.shop.repository.CouponRepository;
import com.example.shop.repository.UserCouponMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CouponServiceTest {
    @Test
    void publicCouponListOnlyReturnsCurrentlyClaimableCoupons() {
        CouponRepository couponRepository = mock(CouponRepository.class);
        Coupon expected = new Coupon();
        expected.setId(8L);
        when(couponRepository.findClaimableByScopeAndStatus(eq("PUBLIC"), eq("ACTIVE"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Collections.singletonList(expected));

        CouponService service = new CouponService(
                couponRepository,
                mock(UserCouponMapper.class),
                mock(PetBirthdayCouponService.class)
        );

        assertEquals(Collections.singletonList(expected), service.findPublicActive());

        ArgumentCaptor<java.time.LocalDateTime> nowCaptor = ArgumentCaptor.forClass(java.time.LocalDateTime.class);
        verify(couponRepository).findClaimableByScopeAndStatus(eq("PUBLIC"), eq("ACTIVE"), nowCaptor.capture());
        org.junit.jupiter.api.Assertions.assertNotNull(nowCaptor.getValue());
    }

    @Test
    void discountPercentRepresentsPayablePercentInQuotes() {
        CouponRepository couponRepository = mock(CouponRepository.class);
        UserCouponMapper userCouponMapper = mock(UserCouponMapper.class);
        UserCoupon coupon = new UserCoupon();
        coupon.setId(6L);
        coupon.setStatus("UNUSED");
        coupon.setCouponType("DISCOUNT");
        coupon.setThresholdAmount(BigDecimal.ZERO);
        coupon.setDiscountPercent(80);

        when(userCouponMapper.findUnusedByUserId(3L)).thenReturn(Collections.singletonList(coupon));
        when(userCouponMapper.findByIdAndUserId(6L, 3L)).thenReturn(coupon);

        CouponService service = new CouponService(
                couponRepository,
                userCouponMapper,
                mock(PetBirthdayCouponService.class)
        );
        CartItem item = new CartItem();
        item.setPrice(new BigDecimal("100.00"));
        item.setQuantity(1);

        assertEquals(new BigDecimal("20.00"), service.quote(3L, List.of(item), 6L).getDiscountAmount());
    }
}
