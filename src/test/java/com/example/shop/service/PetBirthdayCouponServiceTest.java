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
        assertTrue(source.contains("petProfileMapper.findBirthdayPetsAfterId("));
        assertTrue(source.contains("petProfileMapper.findBirthdayPetsByUserId("));
        assertTrue(source.contains("\"pet.birthday-coupon-scan-batch-size\""));
        assertTrue(source.contains("HARD_BIRTHDAY_SCAN_BATCH_SIZE = 1_000"));
        assertTrue(source.contains("HARD_BIRTHDAY_REISSUE_PET_LIMIT = 50"));
        assertTrue(source.contains("if (nextAfterId == currentAfterId || pets.size() < batchSize)"));
        assertTrue(source.contains("grantMapper.countByUserIdsAndBirthdayYear(userIds, birthdayYear)"));
        assertTrue(source.contains("grantCounts.merge(pet.getUserId(), 1, Integer::sum)"));
        assertTrue(source.contains("int reserved = grantMapper.insertIgnore(pet.getId(), pet.getUserId(), coupon.getId(), date.getYear());"));
        assertTrue(source.contains("if (reserved == 0)"));
        assertTrue(source.contains("userCouponMapper.insert(userCoupon);"));
        assertTrue(source.contains("couponRepository.incrementClaimedQuantity(coupon.getId());"));

        String mapper = Files.readString(
                Path.of("src/main/resources/mapper/PetProfileMapper.xml"), StandardCharsets.UTF_8);
        assertTrue(mapper.contains("id=\"findBirthdayPetsAfterId\""));
        assertTrue(mapper.contains("AND id &gt; #{afterId}"));
        assertTrue(mapper.contains("ORDER BY id ASC"));
        assertTrue(mapper.contains("LIMIT #{limit}"));
        assertTrue(mapper.contains("id=\"findBirthdayPetsByUserId\""));
        String grantMapper = Files.readString(
                Path.of("src/main/resources/mapper/PetBirthdayCouponGrantMapper.xml"), StandardCharsets.UTF_8);
        assertTrue(grantMapper.contains("id=\"countByUserIdsAndBirthdayYear\""));
        assertTrue(grantMapper.contains("GROUP BY user_id"));
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
        assertTrue(source.contains("\"pet-profile.max-per-user\", 10"));
        assertTrue(source.contains("birthdayReissuePetLimit()"));
    }
}
