package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class CouponQuoteShippingFeeContractTest {

    @Test
    void checkoutQuoteCalculatesShippingBeforeReturningCouponQuote() throws IOException {
        String orderService = read("src/main/java/com/example/shop/service/OrderService.java");
        String quoteCheckout = methodBlock(orderService, "public CouponQuoteResponse quoteCheckout(CouponQuoteRequest request)");

        assertTrue(quoteCheckout.contains(
                "BigDecimal shippingFee = calculateShippingFee(selectedItems, selection.productById());"));
        assertTrue(quoteCheckout.contains("quote.setShippingFee(shippingFee);"));
        assertTrue(quoteCheckout.contains(
                "quote.setPayableAmount(quote.getSubtotal().subtract(quote.getDiscountAmount()).max(BigDecimal.ZERO).add(shippingFee));"));
    }

    @Test
    void couponQuoteControllersUseCheckoutQuoteWithShipping() throws IOException {
        String couponController = read("src/main/java/com/example/shop/controller/CouponController.java");

        assertTrue(couponController.contains("return ResponseEntity.ok(orderService.quoteCheckout(request));"));
        assertFalse(couponController.contains("return ResponseEntity.ok(couponService.quote("),
                "Coupon quote endpoints must not return the pre-shipping CouponService quote directly");
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String methodBlock(String source, String signature) {
        int start = source.indexOf(signature);
        assertTrue(start >= 0, "Missing method signature: " + signature);
        int openBrace = source.indexOf('{', start);
        assertTrue(openBrace >= 0, "Missing method body: " + signature);
        int depth = 0;
        for (int index = openBrace; index < source.length(); index++) {
            char ch = source.charAt(index);
            if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return source.substring(start, index + 1);
                }
            }
        }
        throw new AssertionError("Unterminated method body: " + signature);
    }
}
