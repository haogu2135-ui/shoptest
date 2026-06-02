package com.example.shop.controller;

import com.example.shop.dto.CouponQuoteRequest;
import com.example.shop.dto.CouponPublicResponse;
import com.example.shop.dto.UserCouponResponse;
import com.example.shop.security.SecurityUtils;
import com.example.shop.service.CouponService;
import com.example.shop.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
    public ResponseEntity<List<CouponPublicResponse>> publicCoupons() {
        return ResponseEntity.ok(couponService.findPublicActiveResponses());
    }

    @PostMapping("/{couponId}/claim")
    public ResponseEntity<?> claim(@PathVariable Long couponId) {
        throw new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED, "Use POST /coupons/me/{couponId}/claim");
    }

    @PostMapping("/me/{couponId}/claim")
    public ResponseEntity<?> claimMine(@PathVariable Long couponId, Authentication authentication) {
        try {
            return ResponseEntity.ok(UserCouponResponse.from(couponService.claim(couponId, SecurityUtils.requireUser(authentication).getId())));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<UserCouponResponse>> userCoupons(@PathVariable Long userId, Authentication authentication) {
        SecurityUtils.assertSelf(authentication, userId);
        return ResponseEntity.ok(couponService.findUserCouponResponses(userId));
    }

    @GetMapping("/me")
    public ResponseEntity<List<UserCouponResponse>> myCoupons(Authentication authentication) {
        return ResponseEntity.ok(couponService.findUserCouponResponses(SecurityUtils.requireUser(authentication).getId()));
    }

    @GetMapping("/user/{userId}/available")
    public ResponseEntity<List<UserCouponResponse>> availableUserCoupons(@PathVariable Long userId, Authentication authentication) {
        SecurityUtils.assertSelf(authentication, userId);
        return ResponseEntity.ok(couponService.findAvailableUserCouponResponses(userId));
    }

    @GetMapping("/me/available")
    public ResponseEntity<List<UserCouponResponse>> availableMyCoupons(Authentication authentication) {
        return ResponseEntity.ok(couponService.findAvailableUserCouponResponses(SecurityUtils.requireUser(authentication).getId()));
    }

    @PostMapping("/quote")
    public ResponseEntity<?> quote(@Valid @RequestBody(required = false) CouponQuoteRequest request, Authentication authentication) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Coupon quote payload is required"));
            }
            if (request.getUserId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "userId is required"));
            }
            SecurityUtils.assertSelf(authentication, request.getUserId());
            return ResponseEntity.ok(orderService.quoteCheckout(request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/me/quote")
    public ResponseEntity<?> quoteMine(@Valid @RequestBody(required = false) CouponQuoteRequest request, Authentication authentication) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Coupon quote payload is required"));
            }
            request.setUserId(SecurityUtils.requireUser(authentication).getId());
            return ResponseEntity.ok(orderService.quoteCheckout(request));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
