package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PetBirthdayCouponServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/PetBirthdayCouponService.java");

    @Test
    void petBirthdayCouponServiceKeepsScheduledGrantAndIdempotentReservationContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("@Scheduled(cron = \"${pet.birthday-coupon.cron:0 10 0 * * *}\")"));
        assertTrue(source.contains("grantBirthdayCoupons(LocalDate.now());"));
        assertTrue(source.contains("petProfileMapper.findBirthdayPets(date.getMonthValue(), date.getDayOfMonth())"));
        assertTrue(source.contains("grantMapper.countByUserIdAndBirthdayYear(pet.getUserId(), date.getYear())"));
        assertTrue(source.contains("int reserved = grantMapper.insertIgnore(pet.getId(), pet.getUserId(), coupon.getId(), date.getYear());"));
        assertTrue(source.contains("if (reserved == 0)"));
        assertTrue(source.contains("userCouponMapper.insert(userCoupon);"));
        assertTrue(source.contains("couponRepository.incrementClaimedQuantity(coupon.getId());"));
    }

    @Test
    void petBirthdayCouponServiceKeepsConfigValidationAndReissueSafetyContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("private static final long DEFAULT_CONFIG_ID = 1L;"));
        assertTrue(source.contains("config.setCouponType(normalizeType(request.getCouponType()));"));
        assertTrue(source.contains("validateConfig(config);"));
        assertTrue(source.contains("Valid days must be between 1 and 365"));
        assertTrue(source.contains("Max benefits per user cannot be negative"));
        assertTrue(source.contains("Coupon quantity must be positive"));
        assertTrue(source.contains("Reduction amount is required"));
        assertTrue(source.contains("Discount percent must be between 1 and 99"));
        assertTrue(source.contains("userCouponMapper.countUsedByCouponId(coupon.getId()) > 0"));
        assertTrue(source.contains("couponRepository.decrementClaimedQuantity(coupon.getId(), deleted);"));
        assertTrue(source.contains("grantMapper.deleteByPetIdAndBirthdayYear(pet.getId(), date.getYear());"));
    }
}
