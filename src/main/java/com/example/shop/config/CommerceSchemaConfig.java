package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
public class CommerceSchemaConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureCommerceSchema() {
        return args -> {
            ensureUserSecurityColumns();
            ensureOrderColumns();
            ensureReviewTableCompatibility();
            ensureSupportTables();
            ensureSupportColumns();
            ensureForeignKeys();
            ensureIndexes();
        };
    }

    private void ensureUserSecurityColumns() {
        addColumnIfMissing("users", "password_changed_at", "TIMESTAMP(3) NULL");
        executeQuietly("UPDATE users SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at, NOW(3)) WHERE password_changed_at IS NULL");
    }

    private void ensureOrderColumns() {
        addColumnIfMissing("orders", "order_no", "VARCHAR(50) NULL");
        addColumnIfMissing("orders", "original_amount", "DECIMAL(10,2) NULL DEFAULT 0.00");
        addColumnIfMissing("orders", "discount_amount", "DECIMAL(10,2) NULL DEFAULT 0.00");
        addColumnIfMissing("orders", "shipping_fee", "DECIMAL(10,2) NULL DEFAULT 0.00");
        addColumnIfMissing("orders", "user_coupon_id", "BIGINT NULL");
        addColumnIfMissing("orders", "coupon_id", "BIGINT NULL");
        addColumnIfMissing("orders", "coupon_name", "VARCHAR(120) NULL");
        addColumnIfMissing("orders", "payment_method", "VARCHAR(50) NULL");
        addColumnIfMissing("orders", "recipient_name", "VARCHAR(120) NULL");
        addColumnIfMissing("orders", "recipient_phone", "VARCHAR(60) NULL");
        addColumnIfMissing("orders", "contact_email", "VARCHAR(160) NULL");
        addColumnIfMissing("orders", "tracking_number", "VARCHAR(120) NULL");
        addColumnIfMissing("orders", "tracking_carrier_code", "VARCHAR(50) NULL");
        addColumnIfMissing("orders", "tracking_carrier_name", "VARCHAR(100) NULL");
        addColumnIfMissing("orders", "return_tracking_number", "VARCHAR(120) NULL");
        addColumnIfMissing("orders", "return_reason", "VARCHAR(500) NULL");
        addColumnIfMissing("orders", "return_requested_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "return_approved_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "return_rejected_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "return_shipped_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "returned_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "refunded_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "shipped_at", "TIMESTAMP NULL");
        addColumnIfMissing("orders", "completed_at", "TIMESTAMP NULL");
        executeQuietly("UPDATE orders SET original_amount = COALESCE(original_amount, total_amount, 0) WHERE original_amount IS NULL");
        executeQuietly("UPDATE orders SET discount_amount = COALESCE(discount_amount, 0) WHERE discount_amount IS NULL");
        executeQuietly("UPDATE orders SET shipping_fee = COALESCE(shipping_fee, 0) WHERE shipping_fee IS NULL");
        executeQuietly("UPDATE orders SET order_no = CONCAT('ORD', LPAD(id, 12, '0')) WHERE (order_no IS NULL OR TRIM(order_no) = '') AND id IS NOT NULL");
    }

    private void ensureReviewTableCompatibility() {
        if (!tableExists("reviews") && tableExists("product_reviews")) {
            executeQuietly("RENAME TABLE product_reviews TO reviews");
        }
        addColumnIfMissing("reviews", "status", "VARCHAR(20) NOT NULL DEFAULT 'PENDING'");
        addColumnIfMissing("reviews", "order_id", "BIGINT NULL");
        addColumnIfMissing("reviews", "admin_reply", "VARCHAR(1000) NULL");
        addColumnIfMissing("reviews", "replied_at", "DATETIME NULL");
        executeQuietly("UPDATE reviews SET status = 'APPROVED' WHERE status IS NULL OR TRIM(status) = ''");
    }

    private void ensureForeignKeys() {
        addForeignKeyIfMissing("orders", "fk_orders_coupon_id",
                "ALTER TABLE orders ADD CONSTRAINT fk_orders_coupon_id FOREIGN KEY (coupon_id) REFERENCES coupons(id)");
        addForeignKeyIfMissing("orders", "fk_orders_user_coupon_id",
                "ALTER TABLE orders ADD CONSTRAINT fk_orders_user_coupon_id FOREIGN KEY (user_coupon_id) REFERENCES user_coupons(id)");
        addForeignKeyIfMissing("reviews", "fk_reviews_order_id",
                "ALTER TABLE reviews ADD CONSTRAINT fk_reviews_order_id FOREIGN KEY (order_id) REFERENCES orders(id)");
    }

    private void ensureSupportTables() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS support_sessions ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "user_id BIGINT NOT NULL,"
                + "assigned_admin_id BIGINT NULL,"
                + "context_key VARCHAR(120) NULL,"
                + "status VARCHAR(20) NOT NULL DEFAULT 'OPEN',"
                + "last_message VARCHAR(500) NULL,"
                + "last_message_at TIMESTAMP NULL,"
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS support_messages ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "session_id BIGINT NOT NULL,"
                + "sender_id BIGINT NOT NULL,"
                + "sender_role VARCHAR(20) NOT NULL,"
                + "content TEXT NOT NULL,"
                + "is_read_by_user BOOLEAN NOT NULL DEFAULT FALSE,"
                + "is_read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,"
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    private void ensureSupportColumns() {
        addColumnIfMissing("support_sessions", "assigned_admin_id", "BIGINT NULL");
        addColumnIfMissing("support_sessions", "context_key", "VARCHAR(120) NULL");
        addColumnIfMissing("support_sessions", "last_message", "VARCHAR(500) NULL");
        addColumnIfMissing("support_sessions", "last_message_at", "TIMESTAMP NULL");
        addColumnIfMissing("support_sessions", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        addColumnIfMissing("support_messages", "is_read_by_user", "BOOLEAN NOT NULL DEFAULT FALSE");
        addColumnIfMissing("support_messages", "is_read_by_admin", "BOOLEAN NOT NULL DEFAULT FALSE");
    }

    private void ensureIndexes() {
        addIndexIfMissing("orders", "idx_orders_order_no", "ALTER TABLE orders ADD INDEX idx_orders_order_no (order_no)");
        addIndexIfMissing("orders", "idx_orders_user_created", "ALTER TABLE orders ADD INDEX idx_orders_user_created (user_id, created_at)");
        addIndexIfMissing("orders", "idx_orders_status_created", "ALTER TABLE orders ADD INDEX idx_orders_status_created (status, created_at)");
        addIndexIfMissing("orders", "idx_orders_user_status", "ALTER TABLE orders ADD INDEX idx_orders_user_status (user_id, status)");
        addIndexIfMissing("orders", "idx_orders_created_id", "ALTER TABLE orders ADD INDEX idx_orders_created_id (created_at, id)");
        addIndexIfMissing("orders", "idx_orders_status_updated", "ALTER TABLE orders ADD INDEX idx_orders_status_updated (status, updated_at)");
        addIndexIfMissing("orders", "idx_orders_status_return_requested", "ALTER TABLE orders ADD INDEX idx_orders_status_return_requested (status, return_requested_at)");
        addIndexIfMissing("orders", "idx_orders_status_return_approved", "ALTER TABLE orders ADD INDEX idx_orders_status_return_approved (status, return_approved_at)");
        addIndexIfMissing("orders", "idx_orders_status_return_shipped", "ALTER TABLE orders ADD INDEX idx_orders_status_return_shipped (status, return_shipped_at)");
        addIndexIfMissing("orders", "idx_orders_status_tracking", "ALTER TABLE orders ADD INDEX idx_orders_status_tracking (status, tracking_number)");
        addIndexIfMissing("orders", "idx_orders_refunded_at", "ALTER TABLE orders ADD INDEX idx_orders_refunded_at (refunded_at)");
        addIndexIfMissing("orders", "idx_orders_contact_email", "ALTER TABLE orders ADD INDEX idx_orders_contact_email (contact_email)");
        addIndexIfMissing("reviews", "idx_reviews_product_id", "ALTER TABLE reviews ADD INDEX idx_reviews_product_id (product_id)");
        addIndexIfMissing("reviews", "idx_reviews_user_id", "ALTER TABLE reviews ADD INDEX idx_reviews_user_id (user_id)");
        addIndexIfMissing("reviews", "idx_reviews_order_id", "ALTER TABLE reviews ADD INDEX idx_reviews_order_id (order_id)");
        addIndexIfMissing("reviews", "idx_reviews_status_created", "ALTER TABLE reviews ADD INDEX idx_reviews_status_created (status, created_at)");
        addIndexIfMissing("payments", "idx_payments_order_no_channel", "ALTER TABLE payments ADD INDEX idx_payments_order_no_channel (order_no, channel)");
        addIndexIfMissing("payments", "idx_payments_transaction_id", "ALTER TABLE payments ADD INDEX idx_payments_transaction_id (transaction_id)");
        addIndexIfMissing("notifications", "idx_notifications_user_read", "ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read)");
        addIndexIfMissing("support_sessions", "idx_support_sessions_user_context_status", "ALTER TABLE support_sessions ADD INDEX idx_support_sessions_user_context_status (user_id, context_key, status, updated_at)");
        addIndexIfMissing("support_sessions", "idx_support_sessions_user_status", "ALTER TABLE support_sessions ADD INDEX idx_support_sessions_user_status (user_id, status, updated_at)");
        addIndexIfMissing("support_sessions", "idx_support_sessions_status_updated", "ALTER TABLE support_sessions ADD INDEX idx_support_sessions_status_updated (status, updated_at)");
        addIndexIfMissing("support_messages", "idx_support_messages_session_created", "ALTER TABLE support_messages ADD INDEX idx_support_messages_session_created (session_id, created_at, id)");
        addIndexIfMissing("support_messages", "idx_support_messages_unread_admin", "ALTER TABLE support_messages ADD INDEX idx_support_messages_unread_admin (sender_role, is_read_by_admin)");
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

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
                Integer.class,
                tableName);
        return count != null && count > 0;
    }

    private void addForeignKeyIfMissing(String tableName, String constraintName, String sql) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'",
                Integer.class,
                tableName,
                constraintName);
        if (count == null || count == 0) {
            executeQuietly(sql);
        }
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
        } catch (Exception ignored) {
            // Startup schema hardening should not block JPA/Flyway-managed databases.
        }
    }
}
