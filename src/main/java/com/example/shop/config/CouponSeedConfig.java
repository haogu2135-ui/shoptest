package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class CouponSeedConfig {
    private static final Logger log = LoggerFactory.getLogger(CouponSeedConfig.class);

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner seedPublicCoupons() {
        return args -> {
            try {
                ensureCouponColumns();
                LocalDateTime now = LocalDateTime.now();
                List<SeedCoupon> coupons = List.of(
                    new SeedCoupon(
                        "New Pet Parent Starter Perk",
                        "FULL_REDUCTION",
                        new BigDecimal("79.00"),
                        new BigDecimal("12.00"),
                        null,
                        null,
                        500,
                        "Starter savings for food, walking and comfort essentials.",
                        now.minusHours(1),
                        now.plusDays(14)
                    ),
                    new SeedCoupon(
                        "Smart Care Upgrade Deal",
                        "DISCOUNT",
                        new BigDecimal("120.00"),
                        BigDecimal.ZERO,
                        90,
                        new BigDecimal("24.00"),
                        180,
                        "A limited smart-care coupon for feeders, fountains and daily care devices.",
                        now.minusHours(1),
                        now.plusDays(7)
                    ),
                    new SeedCoupon(
                        "Weekend Walk & Play Bundle",
                        "FULL_REDUCTION",
                        new BigDecimal("45.00"),
                        new BigDecimal("6.00"),
                        null,
                        null,
                        320,
                        "Bundle savings for toys, leashes, collars and small accessories.",
                        now.minusHours(1),
                        now.plusDays(21)
                    )
                );

                for (SeedCoupon coupon : coupons) {
                    insertIfMissing(coupon);
                }
            } catch (Exception e) {
                log.warn("Public coupon seed data could not be inserted. Coupon APIs will continue with existing data.", e);
            }
        };
    }

    private void ensureCouponColumns() {
        if (!tableExists("coupons")) {
            return;
        }
        addColumnIfMissing("coupons", "scope", "VARCHAR(20) NOT NULL DEFAULT 'PUBLIC'");
        addColumnIfMissing("coupons", "status", "VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'");
        addColumnIfMissing("coupons", "threshold_amount", "DECIMAL(10,2) DEFAULT 0.00");
        addColumnIfMissing("coupons", "reduction_amount", "DECIMAL(10,2) DEFAULT 0.00");
        addColumnIfMissing("coupons", "discount_percent", "INT NULL");
        addColumnIfMissing("coupons", "max_discount_amount", "DECIMAL(10,2) NULL");
        addColumnIfMissing("coupons", "total_quantity", "INT NULL");
        addColumnIfMissing("coupons", "claimed_quantity", "INT NOT NULL DEFAULT 0");
        addColumnIfMissing("coupons", "start_at", "DATETIME NULL");
        addColumnIfMissing("coupons", "end_at", "DATETIME NULL");
        addColumnIfMissing("coupons", "description", "TEXT NULL");
        addColumnIfMissing("coupons", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        addColumnIfMissing("coupons", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        jdbcTemplate.update("UPDATE coupons SET scope = 'PUBLIC' WHERE scope IS NULL OR TRIM(scope) = ''");
        jdbcTemplate.update("UPDATE coupons SET status = 'ACTIVE' WHERE status IS NULL OR TRIM(status) = ''");
        jdbcTemplate.update("UPDATE coupons SET claimed_quantity = 0 WHERE claimed_quantity IS NULL");
    }

    private void insertIfMissing(SeedCoupon coupon) {
        jdbcTemplate.update(
            "INSERT INTO coupons (" +
                "name, coupon_type, scope, status, threshold_amount, reduction_amount, discount_percent, " +
                "max_discount_amount, total_quantity, claimed_quantity, start_at, end_at, description, created_at, updated_at" +
            ") SELECT ?, ?, 'PUBLIC', 'ACTIVE', ?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW() " +
            "WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE name = ?)",
            coupon.name,
            coupon.couponType,
            coupon.thresholdAmount,
            coupon.reductionAmount,
            coupon.discountPercent,
            coupon.maxDiscountAmount,
            coupon.totalQuantity,
            coupon.startAt,
            coupon.endAt,
            coupon.description,
            coupon.name
        );
    }

    private void addColumnIfMissing(String tableName, String columnName, String definition) {
        if (!columnExists(tableName, columnName)) {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + definition);
        }
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            Integer.class,
            tableName
        );
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            Integer.class,
            tableName,
            columnName
        );
        return count != null && count > 0;
    }

    private static final class SeedCoupon {
        private final String name;
        private final String couponType;
        private final BigDecimal thresholdAmount;
        private final BigDecimal reductionAmount;
        private final Integer discountPercent;
        private final BigDecimal maxDiscountAmount;
        private final Integer totalQuantity;
        private final String description;
        private final LocalDateTime startAt;
        private final LocalDateTime endAt;

        private SeedCoupon(String name,
                           String couponType,
                           BigDecimal thresholdAmount,
                           BigDecimal reductionAmount,
                           Integer discountPercent,
                           BigDecimal maxDiscountAmount,
                           Integer totalQuantity,
                           String description,
                           LocalDateTime startAt,
                           LocalDateTime endAt) {
            this.name = name;
            this.couponType = couponType;
            this.thresholdAmount = thresholdAmount;
            this.reductionAmount = reductionAmount;
            this.discountPercent = discountPercent;
            this.maxDiscountAmount = maxDiscountAmount;
            this.totalQuantity = totalQuantity;
            this.description = description;
            this.startAt = startAt;
            this.endAt = endAt;
        }
    }
}
