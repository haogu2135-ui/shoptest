package com.example.shop.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProductPricingContractTest {

    @Test
    void activeLimitedTimePriceDoesNotStackStoredDiscountAgain() {
        Product product = discountedProduct();
        product.setLimitedTimePrice(new BigDecimal("70.00"));
        product.setLimitedTimeStartAt(LocalDateTime.now().minusMinutes(5));
        product.setLimitedTimeEndAt(LocalDateTime.now().plusMinutes(5));

        assertEquals(new BigDecimal("70.00"), product.getEffectivePrice());
        assertEquals(30, product.getEffectiveDiscountPercent());
        assertEquals(30, product.getDisplayedDiscount());
    }

    @Test
    void expiredLimitedTimePriceRevertsToBasePriceAndBaseDiscount() {
        Product product = discountedProduct();
        product.setLimitedTimePrice(new BigDecimal("70.00"));
        product.setLimitedTimeStartAt(LocalDateTime.now().minusMinutes(15));
        product.setLimitedTimeEndAt(LocalDateTime.now().minusMinutes(5));

        assertEquals(new BigDecimal("80.00"), product.getEffectivePrice());
        assertEquals(20, product.getEffectiveDiscountPercent());
        assertEquals(20, product.getDisplayedDiscount());
    }

    private Product discountedProduct() {
        Product product = new Product();
        product.setPrice(new BigDecimal("80.00"));
        product.setOriginalPrice(new BigDecimal("100.00"));
        product.setDiscount(20);
        return product;
    }
}
