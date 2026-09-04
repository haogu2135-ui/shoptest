package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CouponSeedConfigTest {
    @Test
    void startupCouponSeedUsesBatchInsertAndOneColumnMetadataRead() throws IOException {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/config/CouponSeedConfig.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("seedCoupons(coupons);"));
        assertTrue(source.contains("jdbcTemplate.batchUpdate("));
        assertTrue(source.contains("WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE name = ?)"));
        assertTrue(source.contains("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS"));
        assertFalse(source.contains("for (SeedCoupon coupon : coupons) {\n                    insertIfMissing(coupon);"));
        assertFalse(source.contains("private boolean columnExists(String tableName, String columnName)"));
    }
}
