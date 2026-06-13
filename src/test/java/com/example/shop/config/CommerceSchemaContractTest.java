package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class CommerceSchemaContractTest {

    @Test
    void schemaContainsCommercialDataIntegrityAndPerformanceFields() throws IOException {
        String schema = readResource("schema.sql");
        String productsTable = tableDefinition(schema, "products");
        String ordersTable = tableDefinition(schema, "orders");

        assertTrue(schema.contains("path VARCHAR(500)"), "categories.path should exist for hierarchy lookups");
        assertTrue(schema.contains("idx_categories_path"), "categories.path should be indexed");
        assertTrue(schema.contains("best_seller_rank INT NOT NULL DEFAULT 0"), "products should have best_seller_rank");
        assertTrue(schema.contains("name VARCHAR(200) NOT NULL"), "products.name should match Product entity @Size(max = 200)");
        assertTrue(schema.contains("description TEXT"), "product descriptions should remain TEXT for imported/rich catalog copy");
        assertTrue(schema.contains("brand VARCHAR(120)"), "products.brand should match Product entity @Size(max = 120)");
        assertTrue(schema.contains("tag VARCHAR(80)"), "products.tag should match Product entity @Size(max = 80)");
        assertTrue(schema.contains("image_url TEXT"), "product primary image URLs should use TEXT storage");
        assertTrue(schema.contains("Product brand is intentionally denormalized vendor/display text"),
                "product brand free-text storage should be an explicit schema contract");
        assertTrue(productsTable.contains("variants TEXT"), "variant SKU data should stay in products.variants JSON storage");
        assertFalse(productsTable.matches("(?is).*\\bsku\\b\\s+VARCHAR.*"),
                "current products table should not reintroduce a stale top-level sku column");
        assertFalse(productsTable.contains("UNIQUE KEY uk_products_sku"),
                "current variant SKU uniqueness is validated in service/import preflight, not a stale products.sku key");
        assertTrue(productsTable.contains("FOREIGN KEY (category_id) REFERENCES categories(id)"),
                "products.category_id should keep its categories FK");
        assertFalse(productsTable.contains("brand_id"),
                "products.brand is intentionally free text, not a strict brand_id FK column");
        assertFalse(productsTable.contains("FOREIGN KEY (brand"),
                "products.brand should not be wired to a stale strict brands FK");
        assertTrue(schema.contains("idx_products_best_seller_rank"), "best_seller_rank should be indexed");
        assertTrue(schema.contains("FULLTEXT INDEX idx_products_search_text (name, description, brand, tag)"),
                "product keyword search fields should have a MySQL fulltext index");
        assertFalse(schema.contains("brandidx"), "product schema should not use stale non-descriptive brand index names");
        assertFalse(schema.contains("categoryidx"), "product schema should not use stale non-descriptive category index names");
        assertTrue(schema.contains("CONSTRAINT ck_products_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'REJECTED'))"),
                "products.status should be constrained to product visibility states");
        assertTrue(schema.contains("CONSTRAINT ck_coupons_status CHECK (status IN ('ACTIVE', 'INACTIVE'))"),
                "coupons.status should be constrained to coupon availability states");
        assertTrue(schema.contains("used_count INT NOT NULL DEFAULT 0"),
                "coupons should track successful redemptions as a durable aggregate");
        assertTrue(schema.contains("CONSTRAINT ck_orders_status CHECK (status IN ('PENDING_PAYMENT', 'PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED'))"),
                "orders.status should be constrained to the application order state machine");
        assertTrue(ordersTable.contains("user_id BIGINT NOT NULL"), "orders should require an owning user_id");
        assertTrue(ordersTable.contains("FOREIGN KEY (user_id) REFERENCES users(id)"),
                "orders.user_id should keep its users FK");
        assertTrue(schema.contains("total_amount DECIMAL(10,2) NOT NULL"), "order totals should use exact decimal storage");
        assertFalse(schema.contains("total_price"), "current order schema should not reintroduce stale total_price storage");
        assertFalse(schema.contains("total_amount FLOAT"), "order totals must not use floating-point storage");
        assertTrue(schema.contains("CONSTRAINT ck_checkout_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED'))"),
                "checkout idempotency status should be constrained");
        assertTrue(schema.contains("CONSTRAINT ck_payments_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED'))"),
                "payments.status should be constrained to payment lifecycle states");
        assertTrue(schema.contains("status VARCHAR(20) NOT NULL DEFAULT 'PENDING'"),
                "reviews should default to the pending moderation state");
        assertTrue(schema.contains("CONSTRAINT ck_reviews_status CHECK (status IN ('PENDING', 'APPROVED', 'HIDDEN'))"),
                "reviews.status should be constrained to moderation states");
        assertTrue(schema.contains("CONSTRAINT ck_user_coupons_status CHECK (status IN ('UNUSED', 'USED'))"),
                "user_coupons.status should be constrained to coupon assignment states");
        assertTrue(schema.contains("idx_orders_status_created"), "admin status queues should have a status/created_at index");
        assertTrue(schema.contains("idx_orders_recent_created_status"), "recent order reporting should have a created_at/status index");
        assertTrue(schema.contains("idx_notifications_created_at"), "notification cleanup/recent queries should have a created_at index");
        assertTrue(schema.contains("idx_notifications_user_created"), "notification user listing should have a user_id/created_at index");
        assertTrue(schema.contains("idx_payments_status_expires"), "expired pending payment sweeps should have a status/expires_at index");
        assertTrue(schema.contains("idx_user_addresses_user"), "address listing should have an explicit user_id index");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS user_addresses"),
                "current address storage should use user_addresses, not stale addresses table naming");
        assertFalse(schema.contains("CREATE TABLE IF NOT EXISTS addresses"),
                "current schema should not reintroduce a stale standalone addresses table");
        assertFalse(schema.contains("region VARCHAR(255)"),
                "current address model should not reintroduce the stale oversized region column");
        assertTrue(schema.contains("default_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN is_default THEN user_id ELSE NULL END) STORED"),
                "user address defaults should expose a nullable generated key for default-only uniqueness");
        assertTrue(schema.contains("UNIQUE KEY uk_user_addresses_one_default (default_user_id)"),
                "each user should have at most one default address");
        assertTrue(schema.contains("UNIQUE KEY uk_user_product (user_id, product_id)"), "wishlist user lookups should be covered by the left prefix of the unique key");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS wishlist"), "wishlist/favorites should have schema coverage");
        assertTrue(schema.contains("updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
                "wishlist/favorites rows should carry an updated_at marker for sync and audit use");
        assertTrue(schema.contains("UNIQUE KEY uk_user_coupon (user_id, coupon_id)"), "user coupon ownership lookups should be covered by the left prefix of the unique key");
        assertTrue(schema.contains("idx_user_coupons_user_status"), "user coupon status lookups should have a user/status index");
        assertTrue(schema.contains("INDEX idx_order_items_product_order (product_id, order_id)"),
                "top-product aggregation should have product/order index");
        assertTrue(schema.contains("INDEX idx_order_items_order_product (order_id, product_id)"),
                "order detail lookups should have order/product index");
        assertTrue(schema.contains("product_name_snapshot VARCHAR(100)"),
                "order items should use explicit scalar product-name snapshots");
        assertTrue(schema.contains("image_url_snapshot TEXT"),
                "order items should use explicit scalar image URL snapshots");
        assertFalse(schema.contains("product_name GENERATED"), "order item product names should not be generated columns");
        assertFalse(schema.contains("product_image GENERATED"), "order item product images should not be generated columns");
        assertFalse(schema.contains("product_price GENERATED"), "order item product prices should not be generated columns");
        assertTrue(schema.contains("reported_count INT NOT NULL DEFAULT 0"), "reviews should track moderation reports");
        assertTrue(schema.contains("idx_reviews_reported_status"), "reported reviews should be indexed for moderation");
        assertTrue(schema.contains("INDEX idx_product_questions_product_answered_created (product_id, answered_at, created_at, id)"),
                "product question lookups by product should have an explicit product/answered/created index");
        assertTrue(schema.contains("selected_specs_key VARBINARY(32) GENERATED ALWAYS AS"), "cart duplicate guard should hash selected specs");
        assertTrue(schema.contains("UNIQUE KEY uk_cart_user_product_specs (user_id, product_id, selected_specs_key)"),
                "cart duplicate guard and cart user lookups should be covered by the left prefix of the unique key");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS security_audit_logs"), "security audit trail table should exist");
        assertTrue(schema.contains("password VARCHAR(255) NOT NULL"), "users.password should match User entity @Size(max = 255)");
        assertTrue(schema.contains("email VARCHAR(100) UNIQUE"), "users.email should remain nullable for guest/legacy account rows");
        assertTrue(schema.contains("role_code VARCHAR(50)"), "users.role_code should match User entity @Size(max = 50)");
        assertTrue(schema.contains("type VARCHAR(40) NOT NULL"), "notifications.type should match Notification entity @Size(max = 40)");
        assertTrue(schema.contains("title VARCHAR(160) NOT NULL"), "notifications.title should match Notification entity @Size(max = 160)");
        assertTrue(schema.contains("content TEXT NOT NULL"), "support message content should not truncate the 4000-char entity contract");
        assertTrue(schema.contains("actor_username VARCHAR(120)"), "security audit actor_username should match entity @Size(max = 120)");
        assertTrue(schema.contains("actor_role VARCHAR(40)"), "security audit actor_role should match entity @Size(max = 40)");
        assertTrue(schema.contains("resource_type VARCHAR(80)"), "security audit resource_type should match entity @Size(max = 80)");
        assertTrue(schema.contains("resource_id VARCHAR(120)"), "security audit resource_id should match entity @Size(max = 120)");
        assertTrue(schema.contains("ip_address VARCHAR(64)"), "security audit ip_address should match entity @Size(max = 64)");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS site_announcements"), "announcements entity should have schema coverage");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS admin_roles"), "admin roles should have schema coverage");
        assertTrue(schema.contains("description VARCHAR(500)"), "admin role description should match entity @Size(max = 500)");
        assertTrue(schema.contains("CONSTRAINT fk_admin_role_permissions_role_code FOREIGN KEY (role_code) REFERENCES admin_roles(code) ON DELETE CASCADE"),
                "admin role permissions should cascade with their owning role");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS ip_blacklist_entries"), "IP blacklist should have schema coverage");
        assertTrue(schema.contains("CREATE TABLE IF NOT EXISTS system_alerts"), "system alerts should have schema coverage");
        assertTrue(schema.contains("source VARCHAR(80) NOT NULL"), "system alert source should match entity @Size(max = 80)");
        assertTrue(schema.contains("category VARCHAR(80) NOT NULL"), "system alert category should match entity @Size(max = 80)");
        assertTrue(schema.contains("message VARCHAR(4000)"), "system alert message should match entity @Size(max = 4000)");
        assertTrue(schema.contains("fingerprint VARCHAR(180) NOT NULL"), "system alert fingerprint should match entity @Size(max = 180)");
        assertTrue(schema.contains("acknowledged_by VARCHAR(120)"), "system alert acknowledged_by should match entity @Size(max = 120)");
        assertTrue(schema.contains("resolved_by VARCHAR(120)"), "system alert resolved_by should match entity @Size(max = 120)");
        assertTrue(schema.contains("context_key VARCHAR(160)"), "support session context_key should match SupportSession @Size(max = 160)");
        assertTrue(schema.contains("CONSTRAINT fk_pet_birthday_coupon_grants_pet FOREIGN KEY (pet_id) REFERENCES pet_profiles(id) ON DELETE CASCADE"),
                "pet birthday grants should not block deleting a pet profile");
        assertTrue(schema.contains("CONSTRAINT fk_pet_birthday_coupon_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"),
                "pet birthday grants should not block deleting the owning user");
        assertFalse(schema.contains("idx_cart_user_product_specs"), "cart unique key already covers user/product/specs lookups without a redundant same-column index");
        assertFalse(schema.contains("product_snapshot"), "current order item model uses snapshot scalar columns, not product_snapshot JSON");
        assertFalse(schema.contains("CREATE TABLE IF NOT EXISTS product_tags"), "current product model does not use a product_tags table");
        assertFalse(schema.contains("CREATE TABLE IF NOT EXISTS product_images"), "current product media is stored on products, not product_images");
        assertFalse(schema.contains("CREATE TABLE IF NOT EXISTS product_variants"), "current product variants are stored on products, not product_variants");
        assertFalse(schema.contains("CREATE TABLE IF NOT EXISTS product_options"), "current product options are stored on products, not product_options");
        assertFalse(schema.toUpperCase().contains("USING GIN"), "MySQL schema should not contain PostgreSQL GIN indexes");

        String productSource = readSource("src/main/java/com/example/shop/entity/Product.java");
        assertTrue(productSource.contains("@Column(columnDefinition = \"TEXT\")\n    @Size(max = 1000)\n    private String description;"),
                "Product.description should keep TEXT storage with application-level length validation");
        assertTrue(productSource.contains("@Column(columnDefinition = \"TEXT\")\n    @Size(max = 2000)\n    private String imageUrl;"),
                "Product.imageUrl should remain a String field backed by TEXT storage");
        assertTrue(productSource.contains("Denormalized merchant/vendor label"),
                "Product.brand should document why it is not modeled as a strict brands FK");

        String userSource = readSource("src/main/java/com/example/shop/entity/User.java");
        assertTrue(userSource.contains("@Column(unique = true)\n    @Email\n    @Size(max = 100)\n    private String email;"),
                "User.email entity mapping should match nullable unique schema storage");
        assertFalse(userSource.contains("@Column(nullable = false, unique = true)\n    @NotBlank\n    @Email\n    @Size(max = 100)\n    private String email;"),
                "User.email must not reintroduce non-null entity validation while schema allows NULL");

        String orderSource = readSource("src/main/java/com/example/shop/entity/Order.java");
        assertTrue(orderSource.contains("private BigDecimal totalAmount;"),
                "Order.totalAmount should use BigDecimal to match DECIMAL order total storage");

        assertFalse(new File("src/main/resources/mapper/BrandMapper.xml").exists(),
                "brands should not use a stale MyBatis BrandMapper selectKey path");
        String brandRepositorySource = readSource("src/main/java/com/example/shop/repository/BrandRepository.java");
        assertTrue(brandRepositorySource.contains("extends JpaRepository<Brand, Long>"),
                "brands should remain backed by the JPA repository path");
    }

    @Test
    void startupHardeningBackfillsExistingDatabases() throws IOException {
        String source = readSource("src/main/java/com/example/shop/config/CommerceSchemaConfig.java");

        assertTrue(source.contains("ensureCategoryTableCompatibility"), "startup hardening should cover category path");
        assertTrue(source.contains("addColumnIfMissing(\"categories\", \"image_url\", \"TEXT NULL\")"),
                "startup hardening should backfill category image URLs for public category responses");
        assertTrue(source.contains("addColumnIfMissing(\"categories\", \"localized_content\", \"TEXT NULL\")"),
                "startup hardening should backfill category localized content for public category responses");
        assertTrue(source.contains("ensureProductTableCompatibility"), "startup hardening should cover product ranking columns");
        assertTrue(source.contains("MODIFY COLUMN name VARCHAR(200)"), "startup hardening should widen products.name to the entity contract");
        assertTrue(source.contains("MODIFY COLUMN brand VARCHAR(120)"), "startup hardening should widen products.brand to the entity contract");
        assertTrue(source.contains("MODIFY COLUMN tag VARCHAR(80)"), "startup hardening should widen products.tag to the entity contract");
        assertTrue(source.contains("MODIFY COLUMN password VARCHAR(255)"), "startup hardening should widen users.password to the entity contract");
        assertTrue(source.contains("ensureNotificationTableCompatibility"), "startup hardening should cover notification field lengths");
        assertTrue(source.contains("MODIFY COLUMN type VARCHAR(40)"), "startup hardening should widen notifications.type to the entity contract");
        assertTrue(source.contains("MODIFY COLUMN title VARCHAR(160)"), "startup hardening should widen notifications.title to the entity contract");
        assertTrue(source.contains("context_key VARCHAR(160)"), "startup hardening should create support session context_key at entity width");
        assertTrue(source.contains("MODIFY COLUMN context_key VARCHAR(160)"), "startup hardening should widen existing support session context_key columns");
        assertTrue(source.contains("ensureCriticalStatusConstraints"), "startup hardening should repair and constrain critical commerce statuses");
        assertTrue(source.contains("ORDER_STATUS_CHECK_VALUES"), "startup hardening should centralize the allowed order status values");
        assertTrue(source.contains("PAYMENT_STATUS_CHECK_VALUES"), "startup hardening should centralize the allowed payment status values");
        assertTrue(source.contains("ck_products_status"), "startup hardening should add the product status check constraint");
        assertTrue(source.contains("ck_coupons_status"), "startup hardening should add the coupon status check constraint");
        assertTrue(source.contains("ck_orders_status"), "startup hardening should add the order status check constraint");
        assertTrue(source.contains("ck_checkout_idempotency_status"), "startup hardening should add the checkout idempotency status check constraint");
        assertTrue(source.contains("ck_payments_status"), "startup hardening should add the payment status check constraint");
        assertTrue(source.contains("ck_reviews_status"), "startup hardening should add the review status check constraint");
        assertTrue(source.contains("ck_user_coupons_status"), "startup hardening should add the user coupon status check constraint");
        assertTrue(source.contains("ensureCouponUsageCounters"), "startup hardening should backfill coupon usage counters");
        assertTrue(source.contains("SET c.used_count = COALESCE(usage_count.used_total, 0)"),
                "startup hardening should align coupon usage counters with used user coupons");
        assertTrue(source.contains("MODIFY COLUMN content TEXT"), "startup hardening should widen support message content");
        assertTrue(source.contains("ensureCartTableCompatibility"), "startup hardening should cover cart uniqueness");
        assertTrue(source.contains("ensureWishlistTableCompatibility"), "startup hardening should backfill wishlist updated_at");
        assertTrue(source.contains("ensureAnnouncementTable"), "startup hardening should cover site announcements");
        assertTrue(source.contains("reported_count"), "startup hardening should cover review report counts");
        assertTrue(source.contains("idx_orders_status_created"), "startup hardening should cover admin order status queue index");
        assertTrue(source.contains("idx_orders_recent_created_status"), "startup hardening should cover recent order index");
        assertTrue(source.contains("idx_notifications_created_at"), "startup hardening should cover notification created_at index");
        assertTrue(source.contains("idx_notifications_user_created"), "startup hardening should cover notification user listing index");
        assertTrue(source.contains("idx_payments_status_expires"), "startup hardening should cover expired pending payment sweeps");
        assertTrue(source.contains("addLeadingColumnIndexIfMissing(\"user_addresses\", \"user_id\", \"idx_user_addresses_user\""),
                "startup hardening should avoid duplicating an existing FK-created user address index");
        assertTrue(source.contains("ensureUserAddressDefaultUniqueness"), "startup hardening should repair address default uniqueness");
        assertTrue(source.contains("uk_user_addresses_one_default"),
                "startup hardening should add the default-address uniqueness key");
        assertTrue(source.contains("HAVING COUNT(*) > 1"),
                "startup hardening should normalize duplicate default addresses before adding the unique key");
        assertTrue(source.contains("idx_products_best_seller_rank"), "startup hardening should cover best-seller rank index");
        assertTrue(source.contains("idx_products_search_text"), "startup hardening should cover product keyword fulltext index");
        assertTrue(source.contains("idx_order_items_product_order"), "startup hardening should cover top-product order item index");
        assertTrue(source.contains("idx_order_items_order_product"), "startup hardening should cover order detail item index");
        assertTrue(source.contains("uk_cart_user_product_specs"), "startup hardening should cover cart unique key");
        assertTrue(source.contains("dropIndexIfPresent(\"cart_items\", \"uk_cart_user_product\")"), "startup hardening should remove stale cart user/product uniqueness");
        assertFalse(source.contains("idx_cart_user_product_specs"), "startup hardening should not add a redundant cart index");

        String adminRoleSource = readSource("src/main/java/com/example/shop/service/AdminRoleService.java");
        assertTrue(adminRoleSource.contains("removeOrphanRolePermissions"), "admin role startup hardening should clean orphan permissions before adding the FK");
        assertTrue(adminRoleSource.contains("addForeignKeyIfMissing(\"fk_admin_role_permissions_role_code\""),
                "admin role startup hardening should add the role permission FK to existing databases");
        assertTrue(adminRoleSource.contains("alterColumnQuietly(\"admin_roles\", \"description\", \"VARCHAR(500) NULL\")"),
                "admin role startup hardening should widen descriptions to the entity contract");

        String auditSource = readSource("src/main/java/com/example/shop/config/SecurityAuditSchemaConfig.java");
        assertTrue(auditSource.contains("actor_username VARCHAR(120)"), "security audit startup schema should match actor username width");
        assertTrue(auditSource.contains("MODIFY COLUMN ip_address VARCHAR(64)"), "security audit startup hardening should widen IP storage");

        String alertSource = readSource("src/main/java/com/example/shop/config/SystemAlertSchemaConfig.java");
        assertTrue(alertSource.contains("source VARCHAR(80) NOT NULL"), "system alert startup schema should match source width");
        assertTrue(alertSource.contains("message VARCHAR(4000)"), "system alert startup schema should match message width");

        assertTrue(source.contains("ensurePetBirthdayCouponGrantForeignKey(\"pet_id\", \"pet_profiles\", \"fk_pet_birthday_coupon_grants_pet\")"),
                "startup hardening should repair pet birthday grant pet FK cascade");
        assertTrue(source.contains("ensurePetBirthdayCouponGrantForeignKey(\"user_id\", \"users\", \"fk_pet_birthday_coupon_grants_user\")"),
                "startup hardening should repair pet birthday grant user FK cascade");
        assertTrue(source.contains("JOIN information_schema.referential_constraints rc"),
                "startup hardening should inspect existing FK delete rules instead of assuming generated FK names");
    }

    @Test
    void flywayBaselineMatchesCurrentCommercialSchema() throws IOException {
        String migration = readResource("db/migration/V1__init.sql");
        String productsTable = tableDefinition(migration, "products");
        String ordersTable = tableDefinition(migration, "orders");

        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS users"), "Flyway baseline should create current users table");
        assertTrue(migration.contains("password VARCHAR(255) NOT NULL"), "Flyway baseline should match User password width");
        assertTrue(migration.contains("email VARCHAR(100) UNIQUE"), "Flyway baseline should keep users.email nullable");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS products"), "Flyway baseline should create current products table");
        assertTrue(migration.contains("category_id BIGINT NOT NULL"), "Flyway product baseline should use category_id, not stale category text");
        assertTrue(migration.contains("name VARCHAR(200) NOT NULL"), "Flyway product baseline should match Product entity name width");
        assertTrue(migration.contains("description TEXT"), "Flyway product baseline should keep TEXT product descriptions");
        assertTrue(migration.contains("brand VARCHAR(120)"), "Flyway product baseline should match Product entity brand width");
        assertTrue(migration.contains("tag VARCHAR(80)"), "Flyway product baseline should match Product entity tag width");
        assertTrue(migration.contains("image_url TEXT"), "Flyway product baseline should keep TEXT image URL storage");
        assertTrue(migration.contains("Product brand is intentionally denormalized vendor/display text"),
                "Flyway baseline should preserve the explicit product brand storage contract");
        assertTrue(productsTable.contains("variants TEXT"), "Flyway baseline should keep variant SKU data in products.variants");
        assertFalse(productsTable.matches("(?is).*\\bsku\\b\\s+VARCHAR.*"),
                "Flyway baseline should not reintroduce a stale top-level products.sku column");
        assertFalse(productsTable.contains("UNIQUE KEY uk_products_sku"),
                "Flyway baseline should not add a stale products.sku unique key");
        assertTrue(productsTable.contains("FOREIGN KEY (category_id) REFERENCES categories(id)"),
                "Flyway baseline should keep the product category FK");
        assertFalse(productsTable.contains("brand_id"),
                "Flyway baseline should keep products.brand as denormalized display text");
        assertFalse(productsTable.contains("FOREIGN KEY (brand"),
                "Flyway baseline should not add a stale strict brands FK");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS cart_items"), "Flyway baseline should create current cart_items table");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS site_announcements"), "Flyway baseline should create announcements table");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS admin_roles"), "Flyway baseline should create admin roles table");
        assertTrue(migration.contains("description VARCHAR(500)"), "Flyway baseline should match AdminRole description width");
        assertTrue(migration.contains("CONSTRAINT fk_admin_role_permissions_role_code FOREIGN KEY (role_code) REFERENCES admin_roles(code) ON DELETE CASCADE"),
                "Flyway baseline should protect admin role permissions from orphan role codes");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS ip_blacklist_entries"), "Flyway baseline should create IP blacklist table");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS system_alerts"), "Flyway baseline should create system alerts table");
        assertTrue(migration.contains("source VARCHAR(80) NOT NULL"), "Flyway baseline should match SystemAlert source width");
        assertTrue(migration.contains("message VARCHAR(4000)"), "Flyway baseline should match SystemAlert message width");
        assertTrue(migration.contains("actor_username VARCHAR(120)"), "Flyway baseline should match SecurityAuditLog actor username width");
        assertTrue(migration.contains("context_key VARCHAR(160)"), "Flyway baseline should match SupportSession contextKey width");
        assertTrue(migration.contains("content TEXT NOT NULL"), "Flyway baseline should not truncate SupportMessage content");
        assertTrue(migration.contains("CONSTRAINT ck_products_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'REJECTED'))"),
                "Flyway baseline should constrain product statuses");
        assertTrue(migration.contains("FULLTEXT INDEX idx_products_search_text (name, description, brand, tag)"),
                "Flyway baseline should include product keyword fulltext index");
        assertFalse(migration.contains("brandidx"), "Flyway baseline should not use stale non-descriptive brand index names");
        assertFalse(migration.contains("categoryidx"), "Flyway baseline should not use stale non-descriptive category index names");
        assertTrue(migration.contains("CONSTRAINT ck_coupons_status CHECK (status IN ('ACTIVE', 'INACTIVE'))"),
                "Flyway baseline should constrain coupon statuses");
        assertTrue(migration.contains("used_count INT NOT NULL DEFAULT 0"),
                "Flyway baseline should track successful coupon redemptions");
        assertTrue(migration.contains("CONSTRAINT ck_orders_status CHECK (status IN ('PENDING_PAYMENT', 'PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED'))"),
                "Flyway baseline should constrain order statuses to the application state machine");
        assertTrue(ordersTable.contains("user_id BIGINT NOT NULL"), "Flyway baseline should require order ownership");
        assertTrue(ordersTable.contains("FOREIGN KEY (user_id) REFERENCES users(id)"),
                "Flyway baseline should keep the orders.user_id FK");
        assertTrue(migration.contains("total_amount DECIMAL(10,2) NOT NULL"), "Flyway baseline should store order totals as DECIMAL");
        assertFalse(migration.contains("total_price"), "Flyway baseline should not create stale total_price storage");
        assertFalse(migration.contains("total_amount FLOAT"), "Flyway baseline must not store order totals as FLOAT");
        assertTrue(migration.contains("CONSTRAINT ck_checkout_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED'))"),
                "Flyway baseline should constrain checkout idempotency statuses");
        assertTrue(migration.contains("CONSTRAINT ck_payments_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED'))"),
                "Flyway baseline should constrain payment statuses");
        assertTrue(migration.contains("status VARCHAR(20) NOT NULL DEFAULT 'PENDING'"),
                "Flyway baseline should default reviews to pending moderation");
        assertTrue(migration.contains("CONSTRAINT ck_reviews_status CHECK (status IN ('PENDING', 'APPROVED', 'HIDDEN'))"),
                "Flyway baseline should constrain review statuses");
        assertTrue(migration.contains("CONSTRAINT ck_user_coupons_status CHECK (status IN ('UNUSED', 'USED'))"),
                "Flyway baseline should constrain user coupon statuses");
        assertTrue(migration.contains("idx_orders_status_created"), "Flyway baseline should include admin order status queue index");
        assertTrue(migration.contains("idx_orders_recent_created_status"), "Flyway baseline should include recent-order index");
        assertTrue(migration.contains("idx_notifications_created_at"), "Flyway baseline should include notification created_at index");
        assertTrue(migration.contains("idx_notifications_user_created"), "Flyway baseline should include notification user listing index");
        assertTrue(migration.contains("idx_payments_status_expires"), "Flyway baseline should include expired pending payment index");
        assertTrue(migration.contains("idx_user_addresses_user"), "Flyway baseline should include user address lookup index");
        assertTrue(migration.contains("default_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN is_default THEN user_id ELSE NULL END) STORED"),
                "Flyway baseline should include default-only address uniqueness column");
        assertTrue(migration.contains("UNIQUE KEY uk_user_addresses_one_default (default_user_id)"),
                "Flyway baseline should enforce one default address per user");
        assertTrue(migration.contains("UNIQUE KEY uk_user_product (user_id, product_id)"), "Flyway baseline should cover wishlist user lookups through left-prefix uniqueness");
        assertTrue(migration.contains("CREATE TABLE IF NOT EXISTS wishlist"), "Flyway baseline should include wishlist/favorites table");
        assertTrue(migration.contains("updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
                "Flyway baseline should include wishlist updated_at");
        assertTrue(migration.contains("UNIQUE KEY uk_user_coupon (user_id, coupon_id)"), "Flyway baseline should cover user coupon ownership lookups through left-prefix uniqueness");
        assertTrue(migration.contains("idx_user_coupons_user_status"), "Flyway baseline should include user coupon status index");
        assertTrue(migration.contains("INDEX idx_order_items_product_order (product_id, order_id)"),
                "Flyway baseline should include top-product order item index");
        assertTrue(migration.contains("INDEX idx_order_items_order_product (order_id, product_id)"),
                "Flyway baseline should include order detail item index");
        assertTrue(migration.contains("product_name_snapshot VARCHAR(100)"),
                "Flyway baseline should use explicit order item product-name snapshots");
        assertTrue(migration.contains("image_url_snapshot TEXT"),
                "Flyway baseline should use explicit order item image URL snapshots");
        assertFalse(migration.contains("product_name GENERATED"), "Flyway baseline should not use generated order item product names");
        assertFalse(migration.contains("product_image GENERATED"), "Flyway baseline should not use generated order item product images");
        assertFalse(migration.contains("product_price GENERATED"), "Flyway baseline should not use generated order item product prices");
        assertTrue(migration.contains("UNIQUE KEY uk_cart_user_product_specs (user_id, product_id, selected_specs_key)"),
                "Flyway baseline should include cart uniqueness and cart user lookup left-prefix coverage");
        assertTrue(migration.contains("idx_reviews_reported_status"), "Flyway baseline should include review moderation index");
        assertTrue(migration.contains("INDEX idx_product_questions_product_answered_created (product_id, answered_at, created_at, id)"),
                "Flyway baseline should include product question product/answered/created lookup index");
        assertFalse(migration.contains("CREATE TABLE IF NOT EXISTS user ("), "Flyway baseline should not create stale singular user table");
        assertFalse(migration.contains("CREATE TABLE IF NOT EXISTS product ("), "Flyway baseline should not create stale singular product table");
        assertFalse(migration.contains("REFERENCES cart(id)"), "Flyway baseline should not reference nonexistent cart table");
        assertFalse(migration.contains("idx_cart_user_product_specs"), "Flyway baseline should not duplicate the cart unique index");
    }

    @Test
    void followOnMigrationsRemainFreshBaselineSafe() throws IOException {
        String orderContactMigration = readResource("db/migration/V3__order_contact_fields.sql");

        assertTrue(orderContactMigration.contains("information_schema.columns"), "V3 should be idempotent because V1 now contains order contact fields");
        assertTrue(orderContactMigration.contains("information_schema.statistics"), "V3 should avoid duplicate contact-email index creation");
        assertFalse(orderContactMigration.startsWith("ALTER TABLE orders ADD COLUMN recipient_name"), "V3 should not use non-idempotent direct ALTER first");

        String schemaContractMigration = readResource("db/migration/V7__commercial_schema_contract.sql");
        String petMigration = readResource("db/migration/V2__pet_tables.sql");
        assertTrue(schemaContractMigration.contains("DROP INDEX uk_cart_user_product"), "V7 should remove stale cart user/product-only uniqueness");
        assertTrue(schemaContractMigration.contains("idx_site_announcements_status_window"), "V7 should add announcement table/index coverage");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN brand VARCHAR(120)"), "V7 should widen product brand for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN password VARCHAR(255)"), "V7 should widen user passwords for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN type VARCHAR(40)"), "V7 should widen notification type for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN title VARCHAR(160)"), "V7 should widen notification title for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN context_key VARCHAR(160)"), "V7 should widen support session context_key for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN content TEXT"), "V7 should widen support message content for existing databases");
        assertTrue(schemaContractMigration.contains("ck_products_status"), "V7 should add product status check coverage");
        assertTrue(schemaContractMigration.contains("ck_coupons_status"), "V7 should add coupon status check coverage");
        assertTrue(schemaContractMigration.contains("SET status = 'CANCELLED'"),
                "V7 should fail closed before adding the order status check to existing databases");
        assertTrue(schemaContractMigration.contains("ck_orders_status"), "V7 should add order status check coverage");
        assertTrue(schemaContractMigration.contains("SET status = 'FAILED'"),
                "V7 should fail closed before adding the payment status check to existing databases");
        assertTrue(schemaContractMigration.contains("ck_payments_status"), "V7 should add payment status check coverage");
        assertTrue(schemaContractMigration.contains("ADD COLUMN expires_at TIMESTAMP NULL"),
                "V7 should backfill payment expiry before adding indexes that use it");
        assertTrue(schemaContractMigration.contains("SET status = 'HIDDEN'"),
                "V7 should fail closed before adding the review status check to existing databases");
        assertTrue(schemaContractMigration.contains("ck_reviews_status"), "V7 should add review status check coverage");
        assertTrue(schemaContractMigration.contains("SET status = 'USED'"),
                "V7 should fail closed before adding the user-coupon status check to existing databases");
        assertTrue(schemaContractMigration.contains("ck_user_coupons_status"), "V7 should add user-coupon status check coverage");
        assertTrue(schemaContractMigration.contains("ADD COLUMN used_count INT NOT NULL DEFAULT 0"),
                "V7 should backfill the coupon usage aggregate column");
        assertTrue(schemaContractMigration.contains("SET c.used_count = COALESCE(usage_count.used_total, 0)"),
                "V7 should repair coupon usage counters from user coupon rows");
        assertTrue(schemaContractMigration.contains("constraint_type = 'CHECK'"),
                "V7 should add status checks idempotently");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN description VARCHAR(500)"), "V7 should widen admin role descriptions for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN source VARCHAR(80)"), "V7 should widen system alert source for existing databases");
        assertTrue(schemaContractMigration.contains("MODIFY COLUMN message VARCHAR(4000)"), "V7 should widen system alert message for existing databases");
        assertTrue(schemaContractMigration.contains("idx_notifications_created_at"), "V7 should add notification created_at index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_notifications_user_created"), "V7 should add notification user listing index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_orders_status_created"), "V7 should add admin order status queue index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_products_search_text"),
                "V7 should add product keyword fulltext index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_order_items_product_order"), "V7 should add top-product order item index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_order_items_order_product"), "V7 should add order detail item index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_payments_status_expires"), "V7 should add expired pending payment index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_product_questions_product_answered_created"),
                "V7 should add product question product/answered/created index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("idx_user_addresses_user"), "V7 should add user address lookup index coverage for existing databases");
        assertTrue(schemaContractMigration.contains("ALTER TABLE wishlist ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
                "V7 should backfill wishlist updated_at for existing databases");
        assertTrue(schemaContractMigration.contains("ADD COLUMN default_user_id BIGINT GENERATED ALWAYS AS"),
                "V7 should backfill default-only address uniqueness column for existing databases");
        assertTrue(schemaContractMigration.contains("uk_user_addresses_one_default"),
                "V7 should add default-address uniqueness coverage for existing databases");
        assertTrue(schemaContractMigration.contains("FROM user_addresses"),
                "V7 should normalize legacy duplicate default addresses before adding the unique key");
        assertTrue(schemaContractMigration.contains("seq_in_index = 1"),
                "V7 should avoid duplicating existing FK-created leading-column indexes");
        assertTrue(schemaContractMigration.contains("DELETE p"), "V7 should remove orphan admin role permissions before adding the FK");
        assertTrue(schemaContractMigration.contains("information_schema.table_constraints"), "V7 should add the admin role permission FK idempotently");
        assertTrue(schemaContractMigration.contains("fk_admin_role_permissions_role_code"), "V7 should enforce admin role permission ownership");
        assertTrue(schemaContractMigration.contains("FROM pet_birthday_coupon_grants g"),
                "V7 should remove orphan birthday grants before repairing grant FKs");
        assertTrue(schemaContractMigration.contains("JOIN information_schema.referential_constraints rc"),
                "V7 should inspect existing birthday grant FK delete rules");
        assertTrue(schemaContractMigration.contains("DROP FOREIGN KEY"),
                "V7 should drop restrictive birthday grant FKs before replacing them");
        assertTrue(schemaContractMigration.contains("fk_pet_birthday_coupon_grants_pet FOREIGN KEY (pet_id) REFERENCES pet_profiles(id) ON DELETE CASCADE"),
                "V7 should cascade birthday grants when pet profiles are deleted");
        assertTrue(schemaContractMigration.contains("fk_pet_birthday_coupon_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"),
                "V7 should cascade birthday grants when users are deleted");
        assertTrue(petMigration.contains("fk_pet_birthday_coupon_grants_pet FOREIGN KEY (pet_id) REFERENCES pet_profiles(id) ON DELETE CASCADE"),
                "V2 should create birthday grant pet FK with cascade for fresh pet-table installs");
        assertTrue(petMigration.contains("fk_pet_birthday_coupon_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"),
                "V2 should create birthday grant user FK with cascade for fresh pet-table installs");
    }

    @Test
    void repositoryDoesNotShipSeparateDataSqlThatCanDriftFromSchema() {
        assertFalse(new File("src/main/resources/data.sql").exists(), "catalog seed data should not drift in a separate data.sql");
    }

    private String readResource(String path) throws IOException {
        return new String(new ClassPathResource(path).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    private String readSource(String path) throws IOException {
        return new String(java.nio.file.Files.readAllBytes(java.nio.file.Path.of(path)), StandardCharsets.UTF_8);
    }

    private static String tableDefinition(String source, String tableName) {
        String marker = "CREATE TABLE IF NOT EXISTS " + tableName + " (";
        int start = source.indexOf(marker);
        assertTrue(start >= 0, "expected table definition for " + tableName);
        int end = source.indexOf("\n)", start);
        assertTrue(end > start, "expected table definition to close for " + tableName);
        return source.substring(start, end);
    }
}
