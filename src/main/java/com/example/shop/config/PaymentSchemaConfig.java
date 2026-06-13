package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class PaymentSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensurePaymentSchema() {
        return args -> executeIfPossible("ALTER TABLE payments ADD COLUMN provider_reference VARCHAR(128) NULL",
                "ALTER TABLE payments ADD COLUMN refund_reference VARCHAR(128) NULL",
                "ALTER TABLE payments ADD COLUMN refunded_at TIMESTAMP NULL",
                "ALTER TABLE payments ADD COLUMN callback_at TIMESTAMP NULL",
                "ALTER TABLE payments ADD INDEX idx_payments_provider_reference (provider_reference)",
                "ALTER TABLE payments ADD INDEX idx_payments_order_status (order_id, status, id)",
                "ALTER TABLE payments ADD INDEX idx_payments_status_expires (status, expires_at)",
                "ALTER TABLE payments ADD INDEX idx_payments_status_refunded_at (status, refunded_at)",
                "ALTER TABLE payments ADD UNIQUE KEY uk_payment_order_channel (order_id, channel)");
    }

    private void executeIfPossible(String... sqlStatements) {
        for (String sql : sqlStatements) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception ex) {
                log.debug("Skipping optional payment schema hardening SQL: {}; reason={}", sql, ex.getMessage());
            }
        }
    }
}
