package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class SecurityAuditSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureSecurityAuditLogTable() {
        return args -> {
            jdbcTemplate.execute(
                    "CREATE TABLE IF NOT EXISTS security_audit_logs ("
                            + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                            + "action VARCHAR(50) NOT NULL,"
                            + "result VARCHAR(20) NOT NULL,"
                            + "actor_user_id BIGINT,"
                            + "actor_username VARCHAR(120),"
                            + "actor_role VARCHAR(40),"
                            + "resource_type VARCHAR(80),"
                            + "resource_id VARCHAR(120),"
                            + "ip_address VARCHAR(64),"
                            + "user_agent VARCHAR(500),"
                            + "message VARCHAR(1000),"
                            + "metadata TEXT,"
                            + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                            + "INDEX idx_audit_created (created_at),"
                            + "INDEX idx_audit_action_created (action, created_at),"
                            + "INDEX idx_audit_actor_created (actor_username, created_at),"
                            + "INDEX idx_audit_resource (resource_type, resource_id)"
                            + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            executeQuietly("ALTER TABLE security_audit_logs MODIFY COLUMN actor_username VARCHAR(120) NULL");
            executeQuietly("ALTER TABLE security_audit_logs MODIFY COLUMN actor_role VARCHAR(40) NULL");
            executeQuietly("ALTER TABLE security_audit_logs MODIFY COLUMN resource_type VARCHAR(80) NULL");
            executeQuietly("ALTER TABLE security_audit_logs MODIFY COLUMN resource_id VARCHAR(120) NULL");
            executeQuietly("ALTER TABLE security_audit_logs MODIFY COLUMN ip_address VARCHAR(64) NULL");
        };
    }

    private void executeQuietly(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception ex) {
            log.debug("Skipping optional security audit schema hardening SQL: {}; reason={}", sql, ex.getMessage());
        }
    }
}
