package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CouponControllerTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/controller/CouponController.java");

    @Test
    void couponControllerKeepsMeScopedClaimAndQuoteContracts() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@RequestMapping(\"/coupons\")"));
        assertTrue(source.contains("@GetMapping(\"/public\")"));
        assertTrue(source.contains("couponService.findPublicActiveResponses()"));
        assertTrue(source.contains("throw new ResponseStatusException(HttpStatus.METHOD_NOT_ALLOWED, \"Use POST /coupons/me/{couponId}/claim\")"));
        assertTrue(source.contains("@PostMapping(\"/me/{couponId}/claim\")"));
        assertTrue(source.contains("couponService.claim(couponId, SecurityUtils.requireUser(authentication).getId())"));
        assertTrue(source.contains("SecurityUtils.assertSelf(authentication, userId);"));
        assertTrue(source.contains("@PostMapping(\"/me/quote\")"));
        assertTrue(source.contains("request.setUserId(SecurityUtils.requireUser(authentication).getId());"));
        assertTrue(source.contains("Map.of(\"error\", \"Coupon quote payload is required\")"));
    }
}
