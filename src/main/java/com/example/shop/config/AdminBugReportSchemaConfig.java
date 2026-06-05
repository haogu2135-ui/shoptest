package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class AdminBugReportSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureAdminBugReportTable() {
        return args -> {
            jdbcTemplate.execute(
                    "CREATE TABLE IF NOT EXISTS admin_bug_reports ("
                            + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                            + "title VARCHAR(160) NOT NULL,"
                            + "description TEXT NOT NULL,"
                            + "module VARCHAR(40) NOT NULL DEFAULT 'GENERAL',"
                            + "severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',"
                            + "priority VARCHAR(20) NOT NULL DEFAULT 'P2',"
                            + "status VARCHAR(40) NOT NULL DEFAULT 'OPEN',"
                            + "page_url VARCHAR(500),"
                            + "environment VARCHAR(120),"
                            + "reproduction_steps TEXT,"
                            + "expected_result TEXT,"
                            + "actual_result TEXT,"
                            + "attachment_urls TEXT,"
                            + "reporter_id BIGINT,"
                            + "reporter_name VARCHAR(120),"
                            + "assigned_to VARCHAR(120) DEFAULT 'CODEX',"
                            + "scan_note TEXT,"
                            + "fix_summary TEXT,"
                            + "regression_note TEXT,"
                            + "last_scanned_at TIMESTAMP NULL,"
                            + "fixed_at TIMESTAMP NULL,"
                            + "fixed_by VARCHAR(120),"
                            + "regression_at TIMESTAMP NULL,"
                            + "regression_by VARCHAR(120),"
                            + "closed_at TIMESTAMP NULL,"
                            + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                            + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
                            + "INDEX idx_admin_bug_status_updated (status, updated_at),"
                            + "INDEX idx_admin_bug_scan_due (status, last_scanned_at),"
                            + "INDEX idx_admin_bug_severity_status (severity, status),"
                            + "INDEX idx_admin_bug_module_status (module, status),"
                            + "INDEX idx_admin_bug_created (created_at)"
                            + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            ensureColumns();
            ensureIndexes();
        };
    }

    private void ensureColumns() {
        ensureColumn("title", "VARCHAR(160) NOT NULL DEFAULT ''");
        ensureColumn("description", "TEXT");
        ensureColumn("module", "VARCHAR(40) NOT NULL DEFAULT 'GENERAL'");
        ensureColumn("severity", "VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'");
        ensureColumn("priority", "VARCHAR(20) NOT NULL DEFAULT 'P2'");
        ensureColumn("status", "VARCHAR(40) NOT NULL DEFAULT 'OPEN'");
        ensureColumn("page_url", "VARCHAR(500)");
        ensureColumn("environment", "VARCHAR(120)");
        ensureColumn("reproduction_steps", "TEXT");
        ensureColumn("expected_result", "TEXT");
        ensureColumn("actual_result", "TEXT");
        ensureColumn("attachment_urls", "TEXT");
        ensureColumn("reporter_id", "BIGINT");
        ensureColumn("reporter_name", "VARCHAR(120)");
        ensureColumn("assigned_to", "VARCHAR(120) DEFAULT 'CODEX'");
        ensureColumn("scan_note", "TEXT");
        ensureColumn("fix_summary", "TEXT");
        ensureColumn("regression_note", "TEXT");
        ensureColumn("last_scanned_at", "TIMESTAMP NULL");
        ensureColumn("fixed_at", "TIMESTAMP NULL");
        ensureColumn("fixed_by", "VARCHAR(120)");
        ensureColumn("regression_at", "TIMESTAMP NULL");
        ensureColumn("regression_by", "VARCHAR(120)");
        ensureColumn("closed_at", "TIMESTAMP NULL");
        ensureColumn("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        ensureColumn("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    private void ensureIndexes() {
        ensureIndex("idx_admin_bug_status_updated", "(status, updated_at)");
        ensureIndex("idx_admin_bug_scan_due", "(status, last_scanned_at)");
        ensureIndex("idx_admin_bug_severity_status", "(severity, status)");
        ensureIndex("idx_admin_bug_module_status", "(module, status)");
        ensureIndex("idx_admin_bug_created", "(created_at)");
    }

    private void ensureColumn(String columnName, String definition) {
        if (!columnExists(columnName)) {
            jdbcTemplate.execute("ALTER TABLE admin_bug_reports ADD COLUMN " + columnName + " " + definition);
        }
    }

    private boolean columnExists(String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() "
                        + "AND table_name = 'admin_bug_reports' AND column_name = ?",
                Integer.class,
                columnName);
        return count != null && count > 0;
    }

    private void ensureIndex(String indexName, String definition) {
        if (!indexExists(indexName)) {
            jdbcTemplate.execute("CREATE INDEX " + indexName + " ON admin_bug_reports " + definition);
        }
    }

    private boolean indexExists(String indexName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() "
                        + "AND table_name = 'admin_bug_reports' AND index_name = ?",
                Integer.class,
                indexName);
        return count != null && count > 0;
    }
}
