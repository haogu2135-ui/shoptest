package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class IpBlacklistSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureIpBlacklistTable() {
        return args -> {
            jdbcTemplate.execute(
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
            ensureColumns();
            ensureIndexes();
        };
    }

    private void ensureColumns() {
        addColumnIfMissing("ip_blacklist_entries", "source", "VARCHAR(30) NOT NULL DEFAULT 'MANUAL'");
        addColumnIfMissing("ip_blacklist_entries", "reason", "VARCHAR(500) NULL");
        addColumnIfMissing("ip_blacklist_entries", "failure_count", "INT NOT NULL DEFAULT 0");
        addColumnIfMissing("ip_blacklist_entries", "first_seen_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
        addColumnIfMissing("ip_blacklist_entries", "last_seen_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
        addColumnIfMissing("ip_blacklist_entries", "blocked_at", "TIMESTAMP NULL");
        addColumnIfMissing("ip_blacklist_entries", "blocked_until", "TIMESTAMP NULL");
        addColumnIfMissing("ip_blacklist_entries", "released_at", "TIMESTAMP NULL");
        addColumnIfMissing("ip_blacklist_entries", "released_by", "VARCHAR(100) NULL");
        addColumnIfMissing("ip_blacklist_entries", "created_by", "VARCHAR(100) NULL");
        addColumnIfMissing("ip_blacklist_entries", "created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
        addColumnIfMissing("ip_blacklist_entries", "updated_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    private void ensureIndexes() {
        addIndexIfMissing("ip_blacklist_entries", "idx_ip_blacklist_ip_status", "ALTER TABLE ip_blacklist_entries ADD INDEX idx_ip_blacklist_ip_status (ip_address, status)");
        addIndexIfMissing("ip_blacklist_entries", "idx_ip_blacklist_status_until", "ALTER TABLE ip_blacklist_entries ADD INDEX idx_ip_blacklist_status_until (status, blocked_until)");
        addIndexIfMissing("ip_blacklist_entries", "idx_ip_blacklist_last_seen", "ALTER TABLE ip_blacklist_entries ADD INDEX idx_ip_blacklist_last_seen (last_seen_at)");
        addIndexIfMissing("ip_blacklist_entries", "idx_ip_blacklist_source_status", "ALTER TABLE ip_blacklist_entries ADD INDEX idx_ip_blacklist_source_status (source, status)");
    }

    private void addColumnIfMissing(String tableName, String columnName, String columnDefinition) {
        if (!columnExists(tableName, columnName)) {
            executeQuietly("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + columnDefinition);
        }
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
                Integer.class,
                tableName,
                columnName);
        return count != null && count > 0;
    }

    private void addIndexIfMissing(String tableName, String indexName, String sql) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
                Integer.class,
                tableName,
                indexName);
        if (count == null || count == 0) {
            executeQuietly(sql);
        }
    }

    private void executeQuietly(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception ex) {
            log.debug("Skipping optional IP blacklist schema hardening SQL: {}; reason={}", sql, ex.getMessage());
        }
    }
}
