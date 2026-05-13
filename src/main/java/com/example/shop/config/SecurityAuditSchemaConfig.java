package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class SecurityAuditSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureSecurityAuditLogTable() {
        return args -> jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS security_audit_logs ("
                        + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                        + "action VARCHAR(50) NOT NULL,"
                        + "result VARCHAR(20) NOT NULL,"
                        + "actor_user_id BIGINT,"
                        + "actor_username VARCHAR(100),"
                        + "actor_role VARCHAR(30),"
                        + "resource_type VARCHAR(50),"
                        + "resource_id VARCHAR(100),"
                        + "ip_address VARCHAR(45),"
                        + "user_agent VARCHAR(500),"
                        + "message VARCHAR(1000),"
                        + "metadata TEXT,"
                        + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                        + "INDEX idx_audit_created (created_at),"
                        + "INDEX idx_audit_action_created (action, created_at),"
                        + "INDEX idx_audit_actor_created (actor_username, created_at),"
                        + "INDEX idx_audit_resource (resource_type, resource_id)"
                        + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }
}
