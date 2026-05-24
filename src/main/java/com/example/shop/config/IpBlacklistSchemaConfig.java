package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class IpBlacklistSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureIpBlacklistTable() {
        return args -> jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS ip_blacklist_entries ("
                        + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                        + "ip_address VARCHAR(45) NOT NULL,"
                        + "status VARCHAR(20) NOT NULL,"
                        + "source VARCHAR(30) NOT NULL,"
                        + "reason VARCHAR(500),"
                        + "failure_count INT NOT NULL DEFAULT 0,"
                        + "first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                        + "last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                        + "blocked_at TIMESTAMP NULL,"
                        + "blocked_until TIMESTAMP NULL,"
                        + "released_at TIMESTAMP NULL,"
                        + "released_by VARCHAR(100),"
                        + "created_by VARCHAR(100),"
                        + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                        + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
                        + "INDEX idx_ip_blacklist_ip_status (ip_address, status),"
                        + "INDEX idx_ip_blacklist_status_until (status, blocked_until),"
                        + "INDEX idx_ip_blacklist_last_seen (last_seen_at)"
                        + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }
}
