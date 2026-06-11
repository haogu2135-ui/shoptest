package com.example.shop.controller;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class LegacyRaceConditionControllerContractTest {

    @Test
    void legacyHealthAndPetClinicRaceTargetsAreAbsent() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/controller/AdminHealthCheckController.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/controller/PetHealthController.java")));

        String productionSource = readProductionJavaSource();
        assertFalse(productionSource.contains("class AdminHealthCheckController"));
        assertFalse(productionSource.contains("class PetHealthController"));
        assertFalse(productionSource.contains("findNearestClinics"));
        assertFalse(productionSource.contains("Files.move("));
    }

    @Test
    void legacyPromotionRaceTargetsAreAbsent() throws Exception {
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/controller/AdminPromotionController.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/controller/PromotionController.java")));
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/UserPointsService.java")));

        String productionSource = readProductionJavaSource();
        assertFalse(productionSource.contains("class AdminPromotionController"));
        assertFalse(productionSource.contains("class PromotionController"));
        assertFalse(productionSource.contains("class UserPointsService"));
    }

    @Test
    void currentCouponQuantityLimitsUseAtomicRepositoryUpdates() throws Exception {
        String couponService = Files.readString(Path.of("src/main/java/com/example/shop/service/CouponService.java"));
        String birthdayCouponService = Files.readString(Path.of("src/main/java/com/example/shop/service/PetBirthdayCouponService.java"));
        String couponRepository = Files.readString(Path.of("src/main/java/com/example/shop/repository/CouponRepository.java"));

        assertTrue(couponService.contains("@Transactional(rollbackFor = Exception.class)\n    public UserCoupon claim("));
        assertTrue(couponService.contains("@Transactional(rollbackFor = Exception.class)\n    public int grant("));
        assertTrue(couponService.contains("couponRepository.incrementClaimedQuantity(couponId) == 0"));
        assertTrue(couponService.contains("couponRepository.decrementClaimedQuantity(couponId, 1)"));
        assertTrue(birthdayCouponService.contains("couponRepository.incrementClaimedQuantity(coupon.getId())"));
        assertTrue(birthdayCouponService.contains("couponRepository.decrementClaimedQuantity(couponId, deleted)"));
        assertTrue(couponRepository.contains("@Modifying\n    @Query(\"update Coupon c set c.claimedQuantity"));
        assertTrue(couponRepository.contains("and (c.totalQuantity is null or coalesce(c.claimedQuantity, 0) < c.totalQuantity)"));
    }

    private static String readProductionJavaSource() throws Exception {
        StringBuilder source = new StringBuilder();
        try (var paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> {
                        try {
                            source.append(Files.readString(path)).append('\n');
                        } catch (Exception e) {
                            throw new IllegalStateException("Unable to read " + path, e);
                        }
                    });
        }
        return source.toString();
    }
}
