package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class PaymentSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensurePaymentSchema() {
        return args -> executeIfPossible("ALTER TABLE payments ADD COLUMN provider_reference VARCHAR(128) NULL",
                "ALTER TABLE payments ADD COLUMN refund_reference VARCHAR(128) NULL",
                "ALTER TABLE payments ADD COLUMN refunded_at TIMESTAMP NULL",
                "ALTER TABLE payments ADD COLUMN callback_at TIMESTAMP NULL",
                "ALTER TABLE payments ADD INDEX idx_payments_provider_reference (provider_reference)");
    }

    private void executeIfPossible(String... sqlStatements) {
        for (String sql : sqlStatements) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception ignored) {
                // Keep startup idempotent across old and new databases.
            }
        }
    }
}
