package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class SystemAlertSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureSystemAlertTable() {
        return args -> jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS system_alerts ("
                        + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                        + "severity VARCHAR(20) NOT NULL,"
                        + "status VARCHAR(20) NOT NULL,"
                        + "source VARCHAR(50) NOT NULL,"
                        + "category VARCHAR(50) NOT NULL,"
                        + "title VARCHAR(200) NOT NULL,"
                        + "message VARCHAR(1000),"
                        + "fingerprint VARCHAR(180) NOT NULL,"
                        + "metadata TEXT,"
                        + "occurrence_count INT NOT NULL DEFAULT 1,"
                        + "first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                        + "last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                        + "acknowledged_at TIMESTAMP NULL,"
                        + "acknowledged_by VARCHAR(100),"
                        + "resolved_at TIMESTAMP NULL,"
                        + "resolved_by VARCHAR(100),"
                        + "INDEX idx_system_alert_fingerprint_status (fingerprint, status),"
                        + "INDEX idx_system_alert_status_last_seen (status, last_seen_at),"
                        + "INDEX idx_system_alert_severity_status (severity, status),"
                        + "INDEX idx_system_alert_category_last_seen (category, last_seen_at)"
                        + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }
}
