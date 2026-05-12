package com.example.shop.controller;

import com.example.shop.dto.CouponQuoteRequest;
import com.example.shop.entity.Coupon;
import com.example.shop.entity.UserCoupon;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.CouponService;
import com.example.shop.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/coupons")
@RequiredArgsConstructor
public class CouponController {
    private final CouponService couponService;
    private final OrderService orderService;

    @GetMapping("/public")
    public ResponseEntity<List<Coupon>> publicCoupons() {
        return ResponseEntity.ok(couponService.findPublicActive());
    }

    @PostMapping("/{couponId}/claim")
    public ResponseEntity<?> claim(@PathVariable Long couponId, @RequestParam Long userId, Authentication authentication) {
        try {
            SecurityUtils.assertSelfOrAdmin(authentication, userId);
            return ResponseEntity.ok(couponService.claim(couponId, userId));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<UserCoupon>> userCoupons(@PathVariable Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return ResponseEntity.ok(couponService.findUserCoupons(userId));
    }

    @GetMapping("/user/{userId}/available")
    public ResponseEntity<List<UserCoupon>> availableUserCoupons(@PathVariable Long userId, Authentication authentication) {
        SecurityUtils.assertSelfOrAdmin(authentication, userId);
        return ResponseEntity.ok(couponService.findAvailableUserCoupons(userId));
    }

    @PostMapping("/quote")
    public ResponseEntity<?> quote(@Valid @RequestBody CouponQuoteRequest request, Authentication authentication) {
        try {
            SecurityUtils.assertSelfOrAdmin(authentication, request.getUserId());
            return ResponseEntity.ok(orderService.quoteCheckout(request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
