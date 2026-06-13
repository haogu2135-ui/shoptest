package com.example.shop.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

@Configuration
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class CommerceSchemaConfig {
    private static final String PRODUCT_STATUS_CHECK_VALUES = "'ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'REJECTED'";
    private static final String COUPON_STATUS_CHECK_VALUES = "'ACTIVE', 'INACTIVE'";
    private static final String ORDER_STATUS_CHECK_VALUES =
            "'PENDING_PAYMENT', 'PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED', "
                    + "'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED'";
    private static final String CHECKOUT_IDEMPOTENCY_STATUS_CHECK_VALUES = "'PROCESSING', 'COMPLETED'";
    private static final String PAYMENT_STATUS_CHECK_VALUES =
            "'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED'";
    private static final String REVIEW_STATUS_CHECK_VALUES = "'PENDING', 'APPROVED', 'HIDDEN'";
    private static final String USER_COUPON_STATUS_CHECK_VALUES = "'UNUSED', 'USED'";

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public ApplicationRunner ensureCommerceSchema() {
        return args -> {
            ensureUserSecurityColumns();
            ensureOrderColumns();
            ensureCheckoutIdempotencyTable();
            ensureCategoryTableCompatibility();
            ensureProductTableCompatibility();
            ensureReviewTableCompatibility();
            ensureCartTableCompatibility();
            ensureWishlistTableCompatibility();
            ensureNotificationTableCompatibility();
            ensureAnnouncementTable();
            ensureSupportTables();
            ensureSupportColumns();
            ensureCriticalStatusConstraints();
            ensureCouponUsageCounters();
            ensureForeignKeys();
            ensureUserAddressDeliveryFields();
            ensureUserAddressDefaultUniqueness();
            ensureIndexes();
        };
    }

    private void ensureUserSecurityColumns() {
        executeQuietly("ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL");
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
        addColumnIfMissing("orders", "guest_order", "BOOLEAN NOT NULL DEFAULT FALSE");
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
        executeQuietly("UPDATE orders o LEFT JOIN users u ON u.id = o.user_id SET o.guest_order = TRUE WHERE (o.guest_order IS NULL OR o.guest_order = FALSE) AND (o.shipping_address LIKE '[Guest]%' OR u.status = 'GUEST')");
    }

    private void ensureCheckoutIdempotencyTable() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS checkout_idempotency_keys ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "checkout_scope VARCHAR(20) NOT NULL,"
                + "principal VARCHAR(180) NOT NULL,"
                + "idempotency_key VARCHAR(120) NOT NULL,"
                + "request_fingerprint CHAR(64) NOT NULL,"
                + "order_id BIGINT NULL,"
                + "status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',"
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
                + "UNIQUE KEY uk_checkout_idempotency_key (checkout_scope, principal, idempotency_key),"
                + "INDEX idx_checkout_idempotency_order (order_id),"
                + "INDEX idx_checkout_idempotency_updated (updated_at)"
                + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    private void ensureCategoryTableCompatibility() {
        addColumnIfMissing("categories", "level", "INT NOT NULL DEFAULT 1");
        addColumnIfMissing("categories", "path", "VARCHAR(500) NULL");
        addColumnIfMissing("categories", "image_url", "TEXT NULL");
        addColumnIfMissing("categories", "localized_content", "TEXT NULL");
        executeQuietly("UPDATE categories SET path = CONCAT('/', id, '/') WHERE path IS NULL OR TRIM(path) = ''");
        for (int depth = 0; depth < 3; depth++) {
            executeQuietly("UPDATE categories child "
                    + "JOIN categories parent ON parent.id = child.parent_id "
                    + "SET child.path = CONCAT(COALESCE(NULLIF(parent.path, ''), CONCAT('/', parent.id, '/')), child.id, '/') "
                    + "WHERE child.parent_id IS NOT NULL "
                    + "AND (child.path IS NULL OR TRIM(child.path) = '' OR child.path = CONCAT('/', child.id, '/'))");
        }
    }

    private void ensureProductTableCompatibility() {
        executeQuietly("ALTER TABLE products MODIFY COLUMN name VARCHAR(200) NOT NULL");
        executeQuietly("ALTER TABLE products MODIFY COLUMN brand VARCHAR(120) NULL");
        executeQuietly("ALTER TABLE products MODIFY COLUMN tag VARCHAR(80) NULL");
        addColumnIfMissing("products", "best_seller_rank", "INT NOT NULL DEFAULT 0");
    }

    private void ensureReviewTableCompatibility() {
        if (!tableExists("reviews") && tableExists("product_reviews")) {
            executeQuietly("RENAME TABLE product_reviews TO reviews");
        }
        addColumnIfMissing("reviews", "status", "VARCHAR(20) NOT NULL DEFAULT 'PENDING'");
        addColumnIfMissing("reviews", "order_id", "BIGINT NULL");
        addColumnIfMissing("reviews", "admin_reply", "VARCHAR(1000) NULL");
        addColumnIfMissing("reviews", "replied_at", "DATETIME NULL");
        addColumnIfMissing("reviews", "image_urls", "TEXT NULL");
        addColumnIfMissing("reviews", "reported_count", "INT NOT NULL DEFAULT 0");
        executeQuietly("UPDATE reviews SET status = 'APPROVED' WHERE status IS NULL OR TRIM(status) = ''");
    }

    private void ensureCartTableCompatibility() {
        addColumnIfMissing("cart_items", "selected_specs", "TEXT NULL");
        executeQuietly("UPDATE cart_items kept "
                + "JOIN (SELECT MIN(id) AS kept_id, user_id, product_id, COALESCE(selected_specs, '') AS specs_key, SUM(quantity) AS merged_quantity "
                + "FROM cart_items GROUP BY user_id, product_id, COALESCE(selected_specs, '') HAVING COUNT(*) > 1) duplicate_group "
                + "ON kept.id = duplicate_group.kept_id "
                + "SET kept.quantity = duplicate_group.merged_quantity, kept.updated_at = CURRENT_TIMESTAMP");
        executeQuietly("DELETE duplicate_item "
                + "FROM cart_items duplicate_item "
                + "JOIN cart_items kept_item "
                + "ON kept_item.user_id = duplicate_item.user_id "
                + "AND kept_item.product_id = duplicate_item.product_id "
                + "AND COALESCE(kept_item.selected_specs, '') = COALESCE(duplicate_item.selected_specs, '') "
                + "AND kept_item.id < duplicate_item.id");
        dropIndexIfPresent("cart_items", "uk_cart_user_product");
        addColumnIfMissing("cart_items", "selected_specs_key",
                "VARBINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(COALESCE(selected_specs, ''), 256))) STORED");
    }

    private void ensureWishlistTableCompatibility() {
        addColumnIfMissing("wishlist", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        executeQuietly("UPDATE wishlist SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL");
    }

    private void ensureNotificationTableCompatibility() {
        executeQuietly("ALTER TABLE notifications MODIFY COLUMN type VARCHAR(40) NOT NULL");
        executeQuietly("ALTER TABLE notifications MODIFY COLUMN title VARCHAR(160) NOT NULL");
    }

    private void ensureAnnouncementTable() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS site_announcements ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "title VARCHAR(120) NOT NULL,"
                + "content TEXT NOT NULL,"
                + "link_url VARCHAR(500) NULL,"
                + "status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',"
                + "sort_order INT DEFAULT 0,"
                + "starts_at DATETIME NULL,"
                + "ends_at DATETIME NULL,"
                + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                + ") DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    private void ensureForeignKeys() {
        addForeignKeyIfMissing("orders", "fk_orders_coupon_id",
                "ALTER TABLE orders ADD CONSTRAINT fk_orders_coupon_id FOREIGN KEY (coupon_id) REFERENCES coupons(id)");
        addForeignKeyIfMissing("orders", "fk_orders_user_coupon_id",
                "ALTER TABLE orders ADD CONSTRAINT fk_orders_user_coupon_id FOREIGN KEY (user_coupon_id) REFERENCES user_coupons(id)");
        addForeignKeyIfMissing("reviews", "fk_reviews_order_id",
                "ALTER TABLE reviews ADD CONSTRAINT fk_reviews_order_id FOREIGN KEY (order_id) REFERENCES orders(id)");
        ensurePetBirthdayCouponGrantForeignKey("pet_id", "pet_profiles", "fk_pet_birthday_coupon_grants_pet");
        ensurePetBirthdayCouponGrantForeignKey("user_id", "users", "fk_pet_birthday_coupon_grants_user");
    }

    private void ensureSupportTables() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS support_sessions ("
                + "id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + "user_id BIGINT NOT NULL,"
                + "assigned_admin_id BIGINT NULL,"
                + "context_key VARCHAR(160) NULL,"
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
        addColumnIfMissing("support_sessions", "context_key", "VARCHAR(160) NULL");
        addColumnIfMissing("support_sessions", "last_message", "VARCHAR(500) NULL");
        addColumnIfMissing("support_sessions", "last_message_at", "TIMESTAMP NULL");
        addColumnIfMissing("support_sessions", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        addColumnIfMissing("support_messages", "is_read_by_user", "BOOLEAN NOT NULL DEFAULT FALSE");
        addColumnIfMissing("support_messages", "is_read_by_admin", "BOOLEAN NOT NULL DEFAULT FALSE");
        executeQuietly("ALTER TABLE support_sessions MODIFY COLUMN context_key VARCHAR(160) NULL");
        executeQuietly("ALTER TABLE support_messages MODIFY COLUMN content TEXT NOT NULL");
    }

    private void ensureUserAddressDefaultUniqueness() {
        addColumnIfMissing("user_addresses", "default_user_id",
                "BIGINT GENERATED ALWAYS AS (CASE WHEN is_default THEN user_id ELSE NULL END) STORED");
        executeQuietly("UPDATE user_addresses duplicate_default "
                + "JOIN (SELECT user_id, MAX(id) AS keep_id "
                + "FROM user_addresses "
                + "WHERE is_default = TRUE "
                + "GROUP BY user_id "
                + "HAVING COUNT(*) > 1) duplicate_group "
                + "ON duplicate_default.user_id = duplicate_group.user_id "
                + "SET duplicate_default.is_default = FALSE, duplicate_default.updated_at = CURRENT_TIMESTAMP "
                + "WHERE duplicate_default.is_default = TRUE "
                + "AND duplicate_default.id <> duplicate_group.keep_id");
        addIndexIfMissing("user_addresses", "uk_user_addresses_one_default",
                "ALTER TABLE user_addresses ADD UNIQUE KEY uk_user_addresses_one_default (default_user_id)");
    }

    private void ensureUserAddressDeliveryFields() {
        addColumnIfMissing("user_addresses", "region", "VARCHAR(1000) NULL");
        addColumnIfMissing("user_addresses", "postal_code", "VARCHAR(20) NULL");
        addColumnIfMissing("user_addresses", "detail_address", "VARCHAR(260) NULL");
    }

    private void ensureCouponUsageCounters() {
        addColumnIfMissing("coupons", "used_count", "INT NOT NULL DEFAULT 0");
        executeQuietly("UPDATE coupons c "
                + "LEFT JOIN (SELECT coupon_id, COUNT(*) AS used_total "
                + "FROM user_coupons WHERE status = 'USED' GROUP BY coupon_id) usage_count "
                + "ON usage_count.coupon_id = c.id "
                + "SET c.used_count = COALESCE(usage_count.used_total, 0)");
    }

    private void ensureIndexes() {
        addIndexIfMissing("orders", "idx_orders_order_no", "ALTER TABLE orders ADD INDEX idx_orders_order_no (order_no)");
        addIndexIfMissing("orders", "idx_orders_user_created", "ALTER TABLE orders ADD INDEX idx_orders_user_created (user_id, created_at)");
        addIndexIfMissing("orders", "idx_orders_status_created", "ALTER TABLE orders ADD INDEX idx_orders_status_created (status, created_at)");
        addIndexIfMissing("orders", "idx_orders_user_status", "ALTER TABLE orders ADD INDEX idx_orders_user_status (user_id, status)");
        addIndexIfMissing("orders", "idx_orders_user_status_created", "ALTER TABLE orders ADD INDEX idx_orders_user_status_created (user_id, status, created_at)");
        addIndexIfMissing("orders", "idx_orders_created_id", "ALTER TABLE orders ADD INDEX idx_orders_created_id (created_at, id)");
        addIndexIfMissing("orders", "idx_orders_status_updated", "ALTER TABLE orders ADD INDEX idx_orders_status_updated (status, updated_at)");
        addIndexIfMissing("orders", "idx_orders_status_return_requested", "ALTER TABLE orders ADD INDEX idx_orders_status_return_requested (status, return_requested_at)");
        addIndexIfMissing("orders", "idx_orders_status_return_approved", "ALTER TABLE orders ADD INDEX idx_orders_status_return_approved (status, return_approved_at)");
        addIndexIfMissing("orders", "idx_orders_status_return_shipped", "ALTER TABLE orders ADD INDEX idx_orders_status_return_shipped (status, return_shipped_at)");
        addIndexIfMissing("orders", "idx_orders_status_tracking", "ALTER TABLE orders ADD INDEX idx_orders_status_tracking (status, tracking_number)");
        addIndexIfMissing("orders", "idx_orders_refunded_at", "ALTER TABLE orders ADD INDEX idx_orders_refunded_at (refunded_at)");
        addIndexIfMissing("orders", "idx_orders_contact_email", "ALTER TABLE orders ADD INDEX idx_orders_contact_email (contact_email)");
        addIndexIfMissing("orders", "idx_orders_recent_created_status", "ALTER TABLE orders ADD INDEX idx_orders_recent_created_status (created_at, status, id)");
        addIndexIfMissing("order_items", "idx_order_items_product_order", "ALTER TABLE order_items ADD INDEX idx_order_items_product_order (product_id, order_id)");
        addIndexIfMissing("order_items", "idx_order_items_order_product", "ALTER TABLE order_items ADD INDEX idx_order_items_order_product (order_id, product_id)");
        addIndexIfMissing("categories", "idx_categories_path", "ALTER TABLE categories ADD INDEX idx_categories_path (path)");
        addIndexIfMissing("categories", "idx_categories_parent_level", "ALTER TABLE categories ADD INDEX idx_categories_parent_level (parent_id, level, id)");
        addIndexIfMissing("products", "idx_products_best_seller_rank", "ALTER TABLE products ADD INDEX idx_products_best_seller_rank (best_seller_rank, id)");
        addIndexIfMissing("products", "idx_products_search_text", "ALTER TABLE products ADD FULLTEXT INDEX idx_products_search_text (name, description, brand, tag)");
        addIndexIfMissing("reviews", "idx_reviews_product_id", "ALTER TABLE reviews ADD INDEX idx_reviews_product_id (product_id)");
        addIndexIfMissing("reviews", "idx_reviews_user_id", "ALTER TABLE reviews ADD INDEX idx_reviews_user_id (user_id)");
        addIndexIfMissing("reviews", "idx_reviews_order_id", "ALTER TABLE reviews ADD INDEX idx_reviews_order_id (order_id)");
        addIndexIfMissing("reviews", "idx_reviews_product_user_order", "ALTER TABLE reviews ADD INDEX idx_reviews_product_user_order (product_id, user_id, order_id)");
        addIndexIfMissing("reviews", "idx_reviews_status_created", "ALTER TABLE reviews ADD INDEX idx_reviews_status_created (status, created_at)");
        addIndexIfMissing("reviews", "idx_reviews_reported_status", "ALTER TABLE reviews ADD INDEX idx_reviews_reported_status (reported_count, status, created_at)");
        addIndexIfMissing("product_questions", "idx_product_questions_product_answered_created", "ALTER TABLE product_questions ADD INDEX idx_product_questions_product_answered_created (product_id, answered_at, created_at, id)");
        addIndexIfMissing("cart_items", "uk_cart_user_product_specs", "ALTER TABLE cart_items ADD UNIQUE KEY uk_cart_user_product_specs (user_id, product_id, selected_specs_key)");
        addIndexIfMissing("site_announcements", "idx_site_announcements_status_window", "ALTER TABLE site_announcements ADD INDEX idx_site_announcements_status_window (status, starts_at, ends_at, sort_order)");
        addIndexIfMissing("site_announcements", "idx_site_announcements_updated", "ALTER TABLE site_announcements ADD INDEX idx_site_announcements_updated (updated_at)");
        addIndexIfMissing("payments", "idx_payments_order_no_channel", "ALTER TABLE payments ADD INDEX idx_payments_order_no_channel (order_no, channel)");
        addIndexIfMissing("payments", "idx_payments_transaction_id", "ALTER TABLE payments ADD INDEX idx_payments_transaction_id (transaction_id)");
        addIndexIfMissing("payments", "idx_payments_status_expires", "ALTER TABLE payments ADD INDEX idx_payments_status_expires (status, expires_at)");
        addIndexIfMissing("checkout_idempotency_keys", "uk_checkout_idempotency_key", "ALTER TABLE checkout_idempotency_keys ADD UNIQUE KEY uk_checkout_idempotency_key (checkout_scope, principal, idempotency_key)");
        addIndexIfMissing("checkout_idempotency_keys", "idx_checkout_idempotency_order", "ALTER TABLE checkout_idempotency_keys ADD INDEX idx_checkout_idempotency_order (order_id)");
        addIndexIfMissing("checkout_idempotency_keys", "idx_checkout_idempotency_updated", "ALTER TABLE checkout_idempotency_keys ADD INDEX idx_checkout_idempotency_updated (updated_at)");
        addIndexIfMissing("notifications", "idx_notifications_user_read", "ALTER TABLE notifications ADD INDEX idx_notifications_user_read (user_id, is_read)");
        addIndexIfMissing("notifications", "idx_notifications_created_at", "ALTER TABLE notifications ADD INDEX idx_notifications_created_at (created_at)");
        addIndexIfMissing("notifications", "idx_notifications_user_created", "ALTER TABLE notifications ADD INDEX idx_notifications_user_created (user_id, created_at)");
        addLeadingColumnIndexIfMissing("user_addresses", "user_id", "idx_user_addresses_user", "ALTER TABLE user_addresses ADD INDEX idx_user_addresses_user (user_id)");
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

    private void ensureCriticalStatusConstraints() {
        ensureStatusConstraint("products", "ck_products_status", PRODUCT_STATUS_CHECK_VALUES, "INACTIVE");
        ensureStatusConstraint("coupons", "ck_coupons_status", COUPON_STATUS_CHECK_VALUES, "INACTIVE");
        ensureStatusConstraint("orders", "ck_orders_status", ORDER_STATUS_CHECK_VALUES, "CANCELLED");
        ensureStatusConstraint("checkout_idempotency_keys", "ck_checkout_idempotency_status",
                CHECKOUT_IDEMPOTENCY_STATUS_CHECK_VALUES, "PROCESSING");
        ensureStatusConstraint("payments", "ck_payments_status", PAYMENT_STATUS_CHECK_VALUES, "FAILED");
        ensureStatusConstraint("reviews", "ck_reviews_status", REVIEW_STATUS_CHECK_VALUES, "HIDDEN");
        ensureStatusConstraint("user_coupons", "ck_user_coupons_status", USER_COUPON_STATUS_CHECK_VALUES, "USED");
    }

    private void ensureStatusConstraint(String tableName, String constraintName, String allowedValues, String fallbackStatus) {
        executeQuietly("UPDATE " + tableName + " SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL");
        executeQuietly("UPDATE " + tableName + " SET status = '" + fallbackStatus
                + "' WHERE status IS NULL OR status NOT IN (" + allowedValues + ")");
        addCheckConstraintIfMissing(tableName, constraintName,
                "ALTER TABLE " + tableName + " ADD CONSTRAINT " + constraintName + " CHECK (status IN ("
                        + allowedValues + "))");
    }

    private void addCheckConstraintIfMissing(String tableName, String constraintName, String sql) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'CHECK'",
                    Integer.class,
                    tableName,
                    constraintName);
            if (count != null && count > 0) {
                return;
            }
            executeQuietly(sql);
        } catch (Exception ignored) {
            executeQuietly(sql);
        }
    }

    private void ensurePetBirthdayCouponGrantForeignKey(String columnName, String referencedTable, String constraintName) {
        executeQuietly("DELETE g FROM pet_birthday_coupon_grants g LEFT JOIN " + referencedTable
                + " r ON r.id = g." + columnName + " WHERE r.id IS NULL");
        String restrictiveConstraint = findForeignKeyConstraint(
                "pet_birthday_coupon_grants", columnName, referencedTable, false);
        if (restrictiveConstraint != null) {
            executeQuietly("ALTER TABLE pet_birthday_coupon_grants DROP FOREIGN KEY `" + restrictiveConstraint.replace("`", "``") + "`");
        }
        if (!foreignKeyExists("pet_birthday_coupon_grants", columnName, referencedTable, true)) {
            executeQuietly("ALTER TABLE pet_birthday_coupon_grants ADD CONSTRAINT " + constraintName
                    + " FOREIGN KEY (" + columnName + ") REFERENCES " + referencedTable + "(id) ON DELETE CASCADE");
        }
    }

    private String findForeignKeyConstraint(String tableName, String columnName, String referencedTable, boolean cascade) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT kcu.constraint_name "
                        + "FROM information_schema.key_column_usage kcu "
                        + "JOIN information_schema.referential_constraints rc "
                        + "ON rc.constraint_schema = kcu.constraint_schema "
                        + "AND rc.constraint_name = kcu.constraint_name "
                        + "AND rc.table_name = kcu.table_name "
                        + "WHERE kcu.table_schema = DATABASE() "
                        + "AND kcu.table_name = ? "
                        + "AND kcu.column_name = ? "
                        + "AND kcu.referenced_table_name = ? "
                        + "AND kcu.referenced_column_name = 'id' "
                        + "AND rc.delete_rule " + (cascade ? "= 'CASCADE' " : "<> 'CASCADE' ")
                        + "LIMIT 1",
                tableName,
                columnName,
                referencedTable);
        if (rows.isEmpty()) {
            return null;
        }
        Object value = rows.get(0).get("CONSTRAINT_NAME");
        return value == null ? null : value.toString();
    }

    private boolean foreignKeyExists(String tableName, String columnName, String referencedTable, boolean cascade) {
        return findForeignKeyConstraint(tableName, columnName, referencedTable, cascade) != null;
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

    private void addLeadingColumnIndexIfMissing(String tableName, String columnName, String indexName, String sql) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics "
                        + "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? AND seq_in_index = 1",
                Integer.class,
                tableName,
                columnName);
        if (count == null || count == 0) {
            executeQuietly(sql);
        }
    }

    private void dropIndexIfPresent(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
                Integer.class,
                tableName,
                indexName);
        if (count != null && count > 0) {
            executeQuietly("ALTER TABLE " + tableName + " DROP INDEX " + indexName);
        }
    }

    private void executeQuietly(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception ex) {
            log.debug("Skipping optional commerce schema hardening SQL: {}; reason={}", sql, ex.getMessage());
        }
    }
}
