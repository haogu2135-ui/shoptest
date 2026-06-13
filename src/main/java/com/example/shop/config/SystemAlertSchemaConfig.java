package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class SystemAlertSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureSystemAlertTable() {
        return args -> {
            jdbcTemplate.execute(
                    "CREATE TABLE IF NOT EXISTS system_alerts ("
                            + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                            + "severity VARCHAR(20) NOT NULL,"
                            + "status VARCHAR(20) NOT NULL,"
                            + "source VARCHAR(80) NOT NULL,"
                            + "category VARCHAR(80) NOT NULL,"
                            + "title VARCHAR(200) NOT NULL,"
                            + "message VARCHAR(4000),"
                            + "fingerprint VARCHAR(180) NOT NULL,"
                            + "metadata TEXT,"
                            + "occurrence_count INT NOT NULL DEFAULT 1,"
                            + "first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                            + "last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                            + "acknowledged_at TIMESTAMP NULL,"
                            + "acknowledged_by VARCHAR(120),"
                            + "resolved_at TIMESTAMP NULL,"
                            + "resolved_by VARCHAR(120),"
                            + "INDEX idx_system_alert_fingerprint_status (fingerprint, status),"
                            + "INDEX idx_system_alert_status_last_seen (status, last_seen_at),"
                            + "INDEX idx_system_alert_severity_status (severity, status),"
                            + "INDEX idx_system_alert_category_last_seen (category, last_seen_at)"
                            + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            executeQuietly("ALTER TABLE system_alerts MODIFY COLUMN source VARCHAR(80) NOT NULL");
            executeQuietly("ALTER TABLE system_alerts MODIFY COLUMN category VARCHAR(80) NOT NULL");
            executeQuietly("ALTER TABLE system_alerts MODIFY COLUMN message VARCHAR(4000) NULL");
            executeQuietly("ALTER TABLE system_alerts MODIFY COLUMN acknowledged_by VARCHAR(120) NULL");
            executeQuietly("ALTER TABLE system_alerts MODIFY COLUMN resolved_by VARCHAR(120) NULL");
        };
    }

    private void executeQuietly(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception ex) {
            log.debug("Skipping optional system alert schema hardening SQL: {}; reason={}", sql, ex.getMessage());
        }
    }
}
