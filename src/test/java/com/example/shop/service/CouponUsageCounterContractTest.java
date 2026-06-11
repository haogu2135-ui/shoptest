package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class CouponUsageCounterContractTest {

    @Test
    void useCouponIncrementsUsageOnlyAfterAtomicUserCouponStatusChange() throws IOException {
        String service = read("src/main/java/com/example/shop/service/CouponService.java");
        String useCoupon = methodBlock(service,
                "public AppliedCoupon useCoupon(Long userId, Long userCouponId, BigDecimal subtotal, Long orderId)");

        assertTrue(service.contains("@Transactional(rollbackFor = Exception.class)\n"
                + "    public AppliedCoupon useCoupon("),
                "useCoupon should run in a rollback-for-Exception transaction");
        assertTrue(useCoupon.contains("userCouponMapper.markUsed(userCouponId, orderId) == 0"),
                "useCoupon should rely on the conditional user_coupons status update");
        assertTrue(useCoupon.contains("couponRepository.incrementUsedCount(userCoupon.getCouponId())"),
                "useCoupon should increment the coupon counter through a repository update");
        assertTrue(useCoupon.indexOf("userCouponMapper.markUsed(userCouponId, orderId)")
                        < useCoupon.indexOf("couponRepository.incrementUsedCount(userCoupon.getCouponId())"),
                "coupon used_count must only increment after user_coupons changes from UNUSED to USED");
        assertTrue(!useCoupon.contains("setUsedCount(") && !useCoupon.contains("couponRepository.save("),
                "useCoupon must not read-modify-write Coupon.usedCount through entity save");
    }

    @Test
    void repositoryUsageCounterUpdatesAreDatabaseSideIncrements() throws IOException {
        String repository = read("src/main/java/com/example/shop/repository/CouponRepository.java");

        assertTrue(repository.contains("int incrementUsedCount(Long couponId);"));
        assertTrue(repository.contains("update Coupon c set c.usedCount = coalesce(c.usedCount, 0) + 1"),
                "used_count should increment in one database UPDATE statement");
        assertTrue(repository.contains("int decrementUsedCount(Long couponId);"));
        assertTrue(repository.contains("update coupons set used_count = case"),
                "release should decrement used_count in one guarded database UPDATE statement");
        assertTrue(repository.contains("when coalesce(used_count, 0) > 0 then coalesce(used_count, 0) - 1"),
                "used_count release must not decrement below zero");
    }

    @Test
    void userCouponMapperGuardsSingleRedemptionByStatus() throws IOException {
        String mapper = read("src/main/resources/mapper/UserCouponMapper.xml");
        String markUsed = xmlBlock(mapper, "<update id=\"markUsed\">", "</update>");
        String releaseUsed = xmlBlock(mapper, "<update id=\"releaseUsed\">", "</update>");

        assertTrue(markUsed.contains("UPDATE user_coupons"));
        assertTrue(markUsed.contains("SET status = 'USED'"));
        assertTrue(markUsed.contains("WHERE id = #{id} AND status = 'UNUSED'"),
                "markUsed must only affect currently UNUSED user coupons");
        assertTrue(releaseUsed.contains("WHERE id = #{id} AND status = 'USED'"),
                "releaseUsed must only affect currently USED user coupons");
    }

    @Test
    void schemaLimitsRedeemableRowsToClaimedUserCoupons() throws IOException {
        String schema = read("src/main/resources/schema.sql");
        String baselineMigration = read("src/main/resources/db/migration/V1__init.sql");
        String commercialMigration = read("src/main/resources/db/migration/V7__commercial_schema_contract.sql");

        assertTrue(schema.contains("used_count INT NOT NULL DEFAULT 0"));
        assertTrue(schema.contains("CONSTRAINT ck_user_coupons_status CHECK (status IN ('UNUSED', 'USED'))"));
        assertTrue(schema.contains("UNIQUE KEY uk_user_coupon (user_id, coupon_id)"));
        assertTrue(baselineMigration.contains("used_count INT NOT NULL DEFAULT 0"));
        assertTrue(baselineMigration.contains("CONSTRAINT ck_user_coupons_status CHECK (status IN ('UNUSED', 'USED'))"));
        assertTrue(commercialMigration.contains("SET c.used_count = COALESCE(usage_count.used_total, 0);"),
                "existing databases should reconcile used_count from USED user_coupons");
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

    private static String xmlBlock(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing XML block start: " + startMarker);
        int end = source.indexOf(endMarker, start);
        assertTrue(end >= 0, "Missing XML block end: " + endMarker);
        return source.substring(start, end + endMarker.length());
    }
}
