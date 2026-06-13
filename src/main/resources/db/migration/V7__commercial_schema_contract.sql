SET @shoptest_category_path_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'categories'
      AND column_name = 'path'
);
SET @shoptest_category_path_ddl := IF(
    @shoptest_category_path_exists = 0,
    'ALTER TABLE categories ADD COLUMN path VARCHAR(500) NULL',
    'SELECT 1'
);
PREPARE shoptest_category_path_stmt FROM @shoptest_category_path_ddl;
EXECUTE shoptest_category_path_stmt;
DEALLOCATE PREPARE shoptest_category_path_stmt;

SET @shoptest_category_level_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'categories'
      AND column_name = 'level'
);
SET @shoptest_category_level_ddl := IF(
    @shoptest_category_level_exists = 0,
    'ALTER TABLE categories ADD COLUMN level INT NOT NULL DEFAULT 1',
    'SELECT 1'
);
PREPARE shoptest_category_level_stmt FROM @shoptest_category_level_ddl;
EXECUTE shoptest_category_level_stmt;
DEALLOCATE PREPARE shoptest_category_level_stmt;

UPDATE categories SET path = CONCAT('/', id, '/') WHERE path IS NULL OR TRIM(path) = '';
UPDATE categories child
JOIN categories parent ON parent.id = child.parent_id
SET child.path = CONCAT(COALESCE(NULLIF(parent.path, ''), CONCAT('/', parent.id, '/')), child.id, '/')
WHERE child.parent_id IS NOT NULL
  AND (child.path IS NULL OR TRIM(child.path) = '' OR child.path = CONCAT('/', child.id, '/'));
UPDATE categories grandchild
JOIN categories child ON child.id = grandchild.parent_id
SET grandchild.path = CONCAT(COALESCE(NULLIF(child.path, ''), CONCAT('/', child.id, '/')), grandchild.id, '/')
WHERE grandchild.parent_id IS NOT NULL
  AND (grandchild.path IS NULL OR TRIM(grandchild.path) = '' OR grandchild.path = CONCAT('/', grandchild.id, '/'));

SET @shoptest_category_path_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'categories'
      AND index_name = 'idx_categories_path'
);
SET @shoptest_category_path_index_ddl := IF(
    @shoptest_category_path_index_exists = 0,
    'ALTER TABLE categories ADD INDEX idx_categories_path (path)',
    'SELECT 1'
);
PREPARE shoptest_category_path_index_stmt FROM @shoptest_category_path_index_ddl;
EXECUTE shoptest_category_path_index_stmt;
DEALLOCATE PREPARE shoptest_category_path_index_stmt;

SET @shoptest_category_parent_level_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'categories'
      AND index_name = 'idx_categories_parent_level'
);
SET @shoptest_category_parent_level_index_ddl := IF(
    @shoptest_category_parent_level_index_exists = 0,
    'ALTER TABLE categories ADD INDEX idx_categories_parent_level (parent_id, level, id)',
    'SELECT 1'
);
PREPARE shoptest_category_parent_level_index_stmt FROM @shoptest_category_parent_level_index_ddl;
EXECUTE shoptest_category_parent_level_index_stmt;
DEALLOCATE PREPARE shoptest_category_parent_level_index_stmt;

SET @shoptest_product_rank_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'products'
      AND column_name = 'best_seller_rank'
);
SET @shoptest_product_rank_ddl := IF(
    @shoptest_product_rank_exists = 0,
    'ALTER TABLE products ADD COLUMN best_seller_rank INT NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE shoptest_product_rank_stmt FROM @shoptest_product_rank_ddl;
EXECUTE shoptest_product_rank_stmt;
DEALLOCATE PREPARE shoptest_product_rank_stmt;

ALTER TABLE products MODIFY COLUMN brand VARCHAR(120) NULL;
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL;
ALTER TABLE notifications MODIFY COLUMN type VARCHAR(40) NOT NULL;
ALTER TABLE notifications MODIFY COLUMN title VARCHAR(160) NOT NULL;
ALTER TABLE support_sessions MODIFY COLUMN context_key VARCHAR(160) NULL;
ALTER TABLE support_messages MODIFY COLUMN content TEXT NOT NULL;

UPDATE products SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL;
UPDATE products SET status = 'INACTIVE'
WHERE status IS NULL OR status NOT IN ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'REJECTED');

SET @shoptest_products_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'products'
      AND constraint_name = 'ck_products_status'
      AND constraint_type = 'CHECK'
);
SET @shoptest_products_status_check_ddl := IF(
    @shoptest_products_status_check_exists = 0,
    'ALTER TABLE products ADD CONSTRAINT ck_products_status CHECK (status IN (''ACTIVE'', ''INACTIVE'', ''PENDING_REVIEW'', ''REJECTED''))',
    'SELECT 1'
);
PREPARE shoptest_products_status_check_stmt FROM @shoptest_products_status_check_ddl;
EXECUTE shoptest_products_status_check_stmt;
DEALLOCATE PREPARE shoptest_products_status_check_stmt;

UPDATE coupons SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL;
UPDATE coupons SET status = 'INACTIVE'
WHERE status IS NULL OR status NOT IN ('ACTIVE', 'INACTIVE');

SET @shoptest_coupons_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'coupons'
      AND constraint_name = 'ck_coupons_status'
      AND constraint_type = 'CHECK'
);
SET @shoptest_coupons_status_check_ddl := IF(
    @shoptest_coupons_status_check_exists = 0,
    'ALTER TABLE coupons ADD CONSTRAINT ck_coupons_status CHECK (status IN (''ACTIVE'', ''INACTIVE''))',
    'SELECT 1'
);
PREPARE shoptest_coupons_status_check_stmt FROM @shoptest_coupons_status_check_ddl;
EXECUTE shoptest_coupons_status_check_stmt;
DEALLOCATE PREPARE shoptest_coupons_status_check_stmt;

UPDATE orders SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL;
UPDATE orders SET status = 'CANCELLED'
WHERE status IS NULL
   OR status NOT IN ('PENDING_PAYMENT', 'PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED');

SET @shoptest_orders_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'orders'
      AND constraint_name = 'ck_orders_status'
      AND constraint_type = 'CHECK'
);
SET @shoptest_orders_status_check_ddl := IF(
    @shoptest_orders_status_check_exists = 0,
    'ALTER TABLE orders ADD CONSTRAINT ck_orders_status CHECK (status IN (''PENDING_PAYMENT'', ''PENDING_SHIPMENT'', ''SHIPPED'', ''COMPLETED'', ''CANCELLED'', ''RETURN_REQUESTED'', ''RETURN_APPROVED'', ''RETURN_SHIPPED'', ''RETURN_REFUNDING'', ''RETURNED'', ''REFUNDED''))',
    'SELECT 1'
);
PREPARE shoptest_orders_status_check_stmt FROM @shoptest_orders_status_check_ddl;
EXECUTE shoptest_orders_status_check_stmt;
DEALLOCATE PREPARE shoptest_orders_status_check_stmt;

UPDATE payments SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL;
UPDATE payments SET status = 'FAILED'
WHERE status IS NULL
   OR status NOT IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED');

SET @shoptest_payments_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'payments'
      AND constraint_name = 'ck_payments_status'
      AND constraint_type = 'CHECK'
);
SET @shoptest_payments_status_check_ddl := IF(
    @shoptest_payments_status_check_exists = 0,
    'ALTER TABLE payments ADD CONSTRAINT ck_payments_status CHECK (status IN (''PENDING'', ''PAID'', ''FAILED'', ''EXPIRED'', ''CANCELLED'', ''REFUNDING'', ''REFUNDED'', ''RECONCILE_REQUIRED''))',
    'SELECT 1'
);
PREPARE shoptest_payments_status_check_stmt FROM @shoptest_payments_status_check_ddl;
EXECUTE shoptest_payments_status_check_stmt;
DEALLOCATE PREPARE shoptest_payments_status_check_stmt;

SET @shoptest_payments_expires_at_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'payments'
      AND column_name = 'expires_at'
);
SET @shoptest_payments_expires_at_ddl := IF(
    @shoptest_payments_expires_at_exists = 0,
    'ALTER TABLE payments ADD COLUMN expires_at TIMESTAMP NULL',
    'SELECT 1'
);
PREPARE shoptest_payments_expires_at_stmt FROM @shoptest_payments_expires_at_ddl;
EXECUTE shoptest_payments_expires_at_stmt;
DEALLOCATE PREPARE shoptest_payments_expires_at_stmt;

SET @shoptest_payments_status_expires_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'payments'
      AND index_name = 'idx_payments_status_expires'
);
SET @shoptest_payments_status_expires_index_ddl := IF(
    @shoptest_payments_status_expires_index_exists = 0,
    'ALTER TABLE payments ADD INDEX idx_payments_status_expires (status, expires_at)',
    'SELECT 1'
);
PREPARE shoptest_payments_status_expires_index_stmt FROM @shoptest_payments_status_expires_index_ddl;
EXECUTE shoptest_payments_status_expires_index_stmt;
DEALLOCATE PREPARE shoptest_payments_status_expires_index_stmt;

UPDATE reviews SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL;
UPDATE reviews SET status = 'HIDDEN'
WHERE status IS NULL OR status NOT IN ('PENDING', 'APPROVED', 'HIDDEN');

SET @shoptest_reviews_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'reviews'
      AND constraint_name = 'ck_reviews_status'
      AND constraint_type = 'CHECK'
);
SET @shoptest_reviews_status_check_ddl := IF(
    @shoptest_reviews_status_check_exists = 0,
    'ALTER TABLE reviews ADD CONSTRAINT ck_reviews_status CHECK (status IN (''PENDING'', ''APPROVED'', ''HIDDEN''))',
    'SELECT 1'
);
PREPARE shoptest_reviews_status_check_stmt FROM @shoptest_reviews_status_check_ddl;
EXECUTE shoptest_reviews_status_check_stmt;
DEALLOCATE PREPARE shoptest_reviews_status_check_stmt;

SET @shoptest_coupons_used_count_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'coupons'
      AND column_name = 'used_count'
);
SET @shoptest_coupons_used_count_ddl := IF(
    @shoptest_coupons_used_count_exists = 0,
    'ALTER TABLE coupons ADD COLUMN used_count INT NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE shoptest_coupons_used_count_stmt FROM @shoptest_coupons_used_count_ddl;
EXECUTE shoptest_coupons_used_count_stmt;
DEALLOCATE PREPARE shoptest_coupons_used_count_stmt;

UPDATE user_coupons SET status = UPPER(TRIM(status)) WHERE status IS NOT NULL;
UPDATE user_coupons SET status = 'USED'
WHERE status IS NULL OR status NOT IN ('UNUSED', 'USED');

UPDATE coupons c
LEFT JOIN (
    SELECT coupon_id, COUNT(*) AS used_total
    FROM user_coupons
    WHERE status = 'USED'
    GROUP BY coupon_id
) usage_count ON usage_count.coupon_id = c.id
SET c.used_count = COALESCE(usage_count.used_total, 0);

SET @shoptest_user_coupons_status_check_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'user_coupons'
      AND constraint_name = 'ck_user_coupons_status'
      AND constraint_type = 'CHECK'
);
SET @shoptest_user_coupons_status_check_ddl := IF(
    @shoptest_user_coupons_status_check_exists = 0,
    'ALTER TABLE user_coupons ADD CONSTRAINT ck_user_coupons_status CHECK (status IN (''UNUSED'', ''USED''))',
    'SELECT 1'
);
PREPARE shoptest_user_coupons_status_check_stmt FROM @shoptest_user_coupons_status_check_ddl;
EXECUTE shoptest_user_coupons_status_check_stmt;
DEALLOCATE PREPARE shoptest_user_coupons_status_check_stmt;

SET @shoptest_product_rank_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'products'
      AND index_name = 'idx_products_best_seller_rank'
);
SET @shoptest_product_rank_index_ddl := IF(
    @shoptest_product_rank_index_exists = 0,
    'ALTER TABLE products ADD INDEX idx_products_best_seller_rank (best_seller_rank, id)',
    'SELECT 1'
);
PREPARE shoptest_product_rank_index_stmt FROM @shoptest_product_rank_index_ddl;
EXECUTE shoptest_product_rank_index_stmt;
DEALLOCATE PREPARE shoptest_product_rank_index_stmt;

SET @shoptest_products_search_text_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'products'
      AND index_name = 'idx_products_search_text'
);
SET @shoptest_products_search_text_index_ddl := IF(
    @shoptest_products_search_text_index_exists = 0,
    'ALTER TABLE products ADD FULLTEXT INDEX idx_products_search_text (name, description, brand, tag)',
    'SELECT 1'
);
PREPARE shoptest_products_search_text_index_stmt FROM @shoptest_products_search_text_index_ddl;
EXECUTE shoptest_products_search_text_index_stmt;
DEALLOCATE PREPARE shoptest_products_search_text_index_stmt;

SET @shoptest_orders_status_created_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'idx_orders_status_created'
);
SET @shoptest_orders_status_created_index_ddl := IF(
    @shoptest_orders_status_created_index_exists = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_status_created (status, created_at)',
    'SELECT 1'
);
PREPARE shoptest_orders_status_created_index_stmt FROM @shoptest_orders_status_created_index_ddl;
EXECUTE shoptest_orders_status_created_index_stmt;
DEALLOCATE PREPARE shoptest_orders_status_created_index_stmt;

SET @shoptest_orders_recent_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'idx_orders_recent_created_status'
);
SET @shoptest_orders_recent_index_ddl := IF(
    @shoptest_orders_recent_index_exists = 0,
    'ALTER TABLE orders ADD INDEX idx_orders_recent_created_status (created_at, status, id)',
    'SELECT 1'
);
PREPARE shoptest_orders_recent_index_stmt FROM @shoptest_orders_recent_index_ddl;
EXECUTE shoptest_orders_recent_index_stmt;
DEALLOCATE PREPARE shoptest_orders_recent_index_stmt;

SET @shoptest_reviews_reported_count_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND column_name = 'reported_count'
);
SET @shoptest_reviews_reported_count_ddl := IF(
    @shoptest_reviews_reported_count_exists = 0,
    'ALTER TABLE reviews ADD COLUMN reported_count INT NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE shoptest_reviews_reported_count_stmt FROM @shoptest_reviews_reported_count_ddl;
EXECUTE shoptest_reviews_reported_count_stmt;
DEALLOCATE PREPARE shoptest_reviews_reported_count_stmt;

SET @shoptest_reviews_reported_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND index_name = 'idx_reviews_reported_status'
);
SET @shoptest_reviews_reported_index_ddl := IF(
    @shoptest_reviews_reported_index_exists = 0,
    'ALTER TABLE reviews ADD INDEX idx_reviews_reported_status (reported_count, status, created_at)',
    'SELECT 1'
);
PREPARE shoptest_reviews_reported_index_stmt FROM @shoptest_reviews_reported_index_ddl;
EXECUTE shoptest_reviews_reported_index_stmt;
DEALLOCATE PREPARE shoptest_reviews_reported_index_stmt;

SET @shoptest_product_questions_product_answered_created_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'product_questions'
      AND index_name = 'idx_product_questions_product_answered_created'
);
SET @shoptest_product_questions_product_answered_created_index_ddl := IF(
    @shoptest_product_questions_product_answered_created_index_exists = 0,
    'ALTER TABLE product_questions ADD INDEX idx_product_questions_product_answered_created (product_id, answered_at, created_at, id)',
    'SELECT 1'
);
PREPARE shoptest_product_questions_product_answered_created_index_stmt FROM @shoptest_product_questions_product_answered_created_index_ddl;
EXECUTE shoptest_product_questions_product_answered_created_index_stmt;
DEALLOCATE PREPARE shoptest_product_questions_product_answered_created_index_stmt;

SET @shoptest_order_items_product_order_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'order_items'
      AND index_name = 'idx_order_items_product_order'
);
SET @shoptest_order_items_product_order_index_ddl := IF(
    @shoptest_order_items_product_order_index_exists = 0,
    'ALTER TABLE order_items ADD INDEX idx_order_items_product_order (product_id, order_id)',
    'SELECT 1'
);
PREPARE shoptest_order_items_product_order_index_stmt FROM @shoptest_order_items_product_order_index_ddl;
EXECUTE shoptest_order_items_product_order_index_stmt;
DEALLOCATE PREPARE shoptest_order_items_product_order_index_stmt;

SET @shoptest_order_items_order_product_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'order_items'
      AND index_name = 'idx_order_items_order_product'
);
SET @shoptest_order_items_order_product_index_ddl := IF(
    @shoptest_order_items_order_product_index_exists = 0,
    'ALTER TABLE order_items ADD INDEX idx_order_items_order_product (order_id, product_id)',
    'SELECT 1'
);
PREPARE shoptest_order_items_order_product_index_stmt FROM @shoptest_order_items_order_product_index_ddl;
EXECUTE shoptest_order_items_order_product_index_stmt;
DEALLOCATE PREPARE shoptest_order_items_order_product_index_stmt;

SET @shoptest_notifications_created_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND index_name = 'idx_notifications_created_at'
);
SET @shoptest_notifications_created_index_ddl := IF(
    @shoptest_notifications_created_index_exists = 0,
    'ALTER TABLE notifications ADD INDEX idx_notifications_created_at (created_at)',
    'SELECT 1'
);
PREPARE shoptest_notifications_created_index_stmt FROM @shoptest_notifications_created_index_ddl;
EXECUTE shoptest_notifications_created_index_stmt;
DEALLOCATE PREPARE shoptest_notifications_created_index_stmt;

SET @shoptest_notifications_user_created_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND index_name = 'idx_notifications_user_created'
);
SET @shoptest_notifications_user_created_index_ddl := IF(
    @shoptest_notifications_user_created_index_exists = 0,
    'ALTER TABLE notifications ADD INDEX idx_notifications_user_created (user_id, created_at)',
    'SELECT 1'
);
PREPARE shoptest_notifications_user_created_index_stmt FROM @shoptest_notifications_user_created_index_ddl;
EXECUTE shoptest_notifications_user_created_index_stmt;
DEALLOCATE PREPARE shoptest_notifications_user_created_index_stmt;

SET @shoptest_user_addresses_default_user_id_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_addresses'
      AND column_name = 'default_user_id'
);
SET @shoptest_user_addresses_default_user_id_ddl := IF(
    @shoptest_user_addresses_default_user_id_exists = 0,
    'ALTER TABLE user_addresses ADD COLUMN default_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN is_default THEN user_id ELSE NULL END) STORED',
    'SELECT 1'
);
PREPARE shoptest_user_addresses_default_user_id_stmt FROM @shoptest_user_addresses_default_user_id_ddl;
EXECUTE shoptest_user_addresses_default_user_id_stmt;
DEALLOCATE PREPARE shoptest_user_addresses_default_user_id_stmt;

UPDATE user_addresses duplicate_default
JOIN (
    SELECT user_id, MAX(id) AS keep_id
    FROM user_addresses
    WHERE is_default = TRUE
    GROUP BY user_id
    HAVING COUNT(*) > 1
) duplicate_group
ON duplicate_default.user_id = duplicate_group.user_id
SET duplicate_default.is_default = FALSE,
    duplicate_default.updated_at = CURRENT_TIMESTAMP
WHERE duplicate_default.is_default = TRUE
  AND duplicate_default.id <> duplicate_group.keep_id;

SET @shoptest_user_addresses_one_default_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user_addresses'
      AND index_name = 'uk_user_addresses_one_default'
);
SET @shoptest_user_addresses_one_default_index_ddl := IF(
    @shoptest_user_addresses_one_default_index_exists = 0,
    'ALTER TABLE user_addresses ADD UNIQUE KEY uk_user_addresses_one_default (default_user_id)',
    'SELECT 1'
);
PREPARE shoptest_user_addresses_one_default_index_stmt FROM @shoptest_user_addresses_one_default_index_ddl;
EXECUTE shoptest_user_addresses_one_default_index_stmt;
DEALLOCATE PREPARE shoptest_user_addresses_one_default_index_stmt;

SET @shoptest_user_addresses_user_leading_index_exists := (
    SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'user_addresses'
      AND column_name = 'user_id'
      AND seq_in_index = 1
);
SET @shoptest_user_addresses_user_index_ddl := IF(
    @shoptest_user_addresses_user_leading_index_exists = 0,
    'ALTER TABLE user_addresses ADD INDEX idx_user_addresses_user (user_id)',
    'SELECT 1'
);
PREPARE shoptest_user_addresses_user_index_stmt FROM @shoptest_user_addresses_user_index_ddl;
EXECUTE shoptest_user_addresses_user_index_stmt;
DEALLOCATE PREPARE shoptest_user_addresses_user_index_stmt;

SET @shoptest_wishlist_updated_at_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'wishlist'
      AND column_name = 'updated_at'
);
SET @shoptest_wishlist_updated_at_ddl := IF(
    @shoptest_wishlist_updated_at_exists = 0,
    'ALTER TABLE wishlist ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'SELECT 1'
);
PREPARE shoptest_wishlist_updated_at_stmt FROM @shoptest_wishlist_updated_at_ddl;
EXECUTE shoptest_wishlist_updated_at_stmt;
DEALLOCATE PREPARE shoptest_wishlist_updated_at_stmt;

UPDATE wishlist
SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL;

SET @shoptest_cart_selected_specs_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'cart_items'
      AND column_name = 'selected_specs'
);
SET @shoptest_cart_selected_specs_ddl := IF(
    @shoptest_cart_selected_specs_exists = 0,
    'ALTER TABLE cart_items ADD COLUMN selected_specs TEXT NULL',
    'SELECT 1'
);
PREPARE shoptest_cart_selected_specs_stmt FROM @shoptest_cart_selected_specs_ddl;
EXECUTE shoptest_cart_selected_specs_stmt;
DEALLOCATE PREPARE shoptest_cart_selected_specs_stmt;

UPDATE cart_items kept
JOIN (
    SELECT MIN(id) AS kept_id, user_id, product_id, COALESCE(selected_specs, '') AS specs_key, SUM(quantity) AS merged_quantity
    FROM cart_items
    GROUP BY user_id, product_id, COALESCE(selected_specs, '')
    HAVING COUNT(*) > 1
) duplicate_group
  ON kept.id = duplicate_group.kept_id
SET kept.quantity = duplicate_group.merged_quantity,
    kept.updated_at = CURRENT_TIMESTAMP;

DELETE duplicate_item
FROM cart_items duplicate_item
JOIN cart_items kept_item
  ON kept_item.user_id = duplicate_item.user_id
 AND kept_item.product_id = duplicate_item.product_id
 AND COALESCE(kept_item.selected_specs, '') = COALESCE(duplicate_item.selected_specs, '')
 AND kept_item.id < duplicate_item.id;

SET @shoptest_cart_legacy_unique_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'cart_items'
      AND index_name = 'uk_cart_user_product'
);
SET @shoptest_cart_legacy_unique_drop_ddl := IF(
    @shoptest_cart_legacy_unique_exists > 0,
    'ALTER TABLE cart_items DROP INDEX uk_cart_user_product',
    'SELECT 1'
);
PREPARE shoptest_cart_legacy_unique_drop_stmt FROM @shoptest_cart_legacy_unique_drop_ddl;
EXECUTE shoptest_cart_legacy_unique_drop_stmt;
DEALLOCATE PREPARE shoptest_cart_legacy_unique_drop_stmt;

SET @shoptest_cart_specs_key_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'cart_items'
      AND column_name = 'selected_specs_key'
);
SET @shoptest_cart_specs_key_ddl := IF(
    @shoptest_cart_specs_key_exists = 0,
    'ALTER TABLE cart_items ADD COLUMN selected_specs_key VARBINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(COALESCE(selected_specs, ''''), 256))) STORED',
    'SELECT 1'
);
PREPARE shoptest_cart_specs_key_stmt FROM @shoptest_cart_specs_key_ddl;
EXECUTE shoptest_cart_specs_key_stmt;
DEALLOCATE PREPARE shoptest_cart_specs_key_stmt;

SET @shoptest_cart_unique_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'cart_items'
      AND index_name = 'uk_cart_user_product_specs'
);
SET @shoptest_cart_unique_ddl := IF(
    @shoptest_cart_unique_exists = 0,
    'ALTER TABLE cart_items ADD UNIQUE KEY uk_cart_user_product_specs (user_id, product_id, selected_specs_key)',
    'SELECT 1'
);
PREPARE shoptest_cart_unique_stmt FROM @shoptest_cart_unique_ddl;
EXECUTE shoptest_cart_unique_stmt;
DEALLOCATE PREPARE shoptest_cart_unique_stmt;

CREATE TABLE IF NOT EXISTS site_announcements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL,
    content TEXT NOT NULL,
    link_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    sort_order INT DEFAULT 0,
    starts_at DATETIME,
    ends_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_site_announcements_status_window (status, starts_at, ends_at, sort_order),
    INDEX idx_site_announcements_updated (updated_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE admin_roles MODIFY COLUMN description VARCHAR(500) NULL;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_code VARCHAR(50) NOT NULL,
    permission_key VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_code, permission_key),
    INDEX idx_admin_role_permissions_role (role_code)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELETE p
FROM admin_role_permissions p
LEFT JOIN admin_roles r ON r.code = p.role_code
WHERE r.code IS NULL;

SET @shoptest_admin_role_permissions_fk_exists := (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'admin_role_permissions'
      AND constraint_name = 'fk_admin_role_permissions_role_code'
      AND constraint_type = 'FOREIGN KEY'
);
SET @shoptest_admin_role_permissions_fk_ddl := IF(
    @shoptest_admin_role_permissions_fk_exists = 0,
    'ALTER TABLE admin_role_permissions ADD CONSTRAINT fk_admin_role_permissions_role_code FOREIGN KEY (role_code) REFERENCES admin_roles(code) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE shoptest_admin_role_permissions_fk_stmt FROM @shoptest_admin_role_permissions_fk_ddl;
EXECUTE shoptest_admin_role_permissions_fk_stmt;
DEALLOCATE PREPARE shoptest_admin_role_permissions_fk_stmt;

CREATE TABLE IF NOT EXISTS ip_blacklist_entries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45) NOT NULL,
    status VARCHAR(20) NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    reason VARCHAR(500),
    failure_count INT NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_at TIMESTAMP NULL,
    blocked_until TIMESTAMP NULL,
    released_at TIMESTAMP NULL,
    released_by VARCHAR(100),
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ip_blacklist_ip_status (ip_address, status),
    INDEX idx_ip_blacklist_status_until (status, blocked_until),
    INDEX idx_ip_blacklist_last_seen (last_seen_at),
    INDEX idx_ip_blacklist_source_status (source, status)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    source VARCHAR(80) NOT NULL,
    category VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message VARCHAR(4000),
    fingerprint VARCHAR(180) NOT NULL,
    metadata TEXT,
    occurrence_count INT NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP NULL,
    acknowledged_by VARCHAR(120),
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(120),
    INDEX idx_system_alert_fingerprint_status (fingerprint, status),
    INDEX idx_system_alert_status_last_seen (status, last_seen_at),
    INDEX idx_system_alert_severity_status (severity, status),
    INDEX idx_system_alert_category_last_seen (category, last_seen_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_alerts MODIFY COLUMN source VARCHAR(80) NOT NULL;
ALTER TABLE system_alerts MODIFY COLUMN category VARCHAR(80) NOT NULL;
ALTER TABLE system_alerts MODIFY COLUMN message VARCHAR(4000) NULL;
ALTER TABLE system_alerts MODIFY COLUMN acknowledged_by VARCHAR(120) NULL;
ALTER TABLE system_alerts MODIFY COLUMN resolved_by VARCHAR(120) NULL;

DELETE g
FROM pet_birthday_coupon_grants g
LEFT JOIN pet_profiles p ON p.id = g.pet_id
WHERE p.id IS NULL;

DELETE g
FROM pet_birthday_coupon_grants g
LEFT JOIN users u ON u.id = g.user_id
WHERE u.id IS NULL;

SET @shoptest_pet_birthday_pet_restrict_fk := (
    SELECT kcu.constraint_name
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = kcu.constraint_schema
     AND rc.constraint_name = kcu.constraint_name
     AND rc.table_name = kcu.table_name
    WHERE kcu.table_schema = DATABASE()
      AND kcu.table_name = 'pet_birthday_coupon_grants'
      AND kcu.column_name = 'pet_id'
      AND kcu.referenced_table_name = 'pet_profiles'
      AND kcu.referenced_column_name = 'id'
      AND rc.delete_rule <> 'CASCADE'
    LIMIT 1
);
SET @shoptest_pet_birthday_pet_drop_ddl := IF(
    @shoptest_pet_birthday_pet_restrict_fk IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE pet_birthday_coupon_grants DROP FOREIGN KEY `',
           REPLACE(@shoptest_pet_birthday_pet_restrict_fk, '`', '``'),
           '`')
);
PREPARE shoptest_pet_birthday_pet_drop_stmt FROM @shoptest_pet_birthday_pet_drop_ddl;
EXECUTE shoptest_pet_birthday_pet_drop_stmt;
DEALLOCATE PREPARE shoptest_pet_birthday_pet_drop_stmt;

SET @shoptest_pet_birthday_pet_cascade_fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = kcu.constraint_schema
     AND rc.constraint_name = kcu.constraint_name
     AND rc.table_name = kcu.table_name
    WHERE kcu.table_schema = DATABASE()
      AND kcu.table_name = 'pet_birthday_coupon_grants'
      AND kcu.column_name = 'pet_id'
      AND kcu.referenced_table_name = 'pet_profiles'
      AND kcu.referenced_column_name = 'id'
      AND rc.delete_rule = 'CASCADE'
);
SET @shoptest_pet_birthday_pet_add_ddl := IF(
    @shoptest_pet_birthday_pet_cascade_fk_exists = 0,
    'ALTER TABLE pet_birthday_coupon_grants ADD CONSTRAINT fk_pet_birthday_coupon_grants_pet FOREIGN KEY (pet_id) REFERENCES pet_profiles(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE shoptest_pet_birthday_pet_add_stmt FROM @shoptest_pet_birthday_pet_add_ddl;
EXECUTE shoptest_pet_birthday_pet_add_stmt;
DEALLOCATE PREPARE shoptest_pet_birthday_pet_add_stmt;

SET @shoptest_pet_birthday_user_restrict_fk := (
    SELECT kcu.constraint_name
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = kcu.constraint_schema
     AND rc.constraint_name = kcu.constraint_name
     AND rc.table_name = kcu.table_name
    WHERE kcu.table_schema = DATABASE()
      AND kcu.table_name = 'pet_birthday_coupon_grants'
      AND kcu.column_name = 'user_id'
      AND kcu.referenced_table_name = 'users'
      AND kcu.referenced_column_name = 'id'
      AND rc.delete_rule <> 'CASCADE'
    LIMIT 1
);
SET @shoptest_pet_birthday_user_drop_ddl := IF(
    @shoptest_pet_birthday_user_restrict_fk IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE pet_birthday_coupon_grants DROP FOREIGN KEY `',
           REPLACE(@shoptest_pet_birthday_user_restrict_fk, '`', '``'),
           '`')
);
PREPARE shoptest_pet_birthday_user_drop_stmt FROM @shoptest_pet_birthday_user_drop_ddl;
EXECUTE shoptest_pet_birthday_user_drop_stmt;
DEALLOCATE PREPARE shoptest_pet_birthday_user_drop_stmt;

SET @shoptest_pet_birthday_user_cascade_fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = kcu.constraint_schema
     AND rc.constraint_name = kcu.constraint_name
     AND rc.table_name = kcu.table_name
    WHERE kcu.table_schema = DATABASE()
      AND kcu.table_name = 'pet_birthday_coupon_grants'
      AND kcu.column_name = 'user_id'
      AND kcu.referenced_table_name = 'users'
      AND kcu.referenced_column_name = 'id'
      AND rc.delete_rule = 'CASCADE'
);
SET @shoptest_pet_birthday_user_add_ddl := IF(
    @shoptest_pet_birthday_user_cascade_fk_exists = 0,
    'ALTER TABLE pet_birthday_coupon_grants ADD CONSTRAINT fk_pet_birthday_coupon_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE shoptest_pet_birthday_user_add_stmt FROM @shoptest_pet_birthday_user_add_ddl;
EXECUTE shoptest_pet_birthday_user_add_stmt;
DEALLOCATE PREPARE shoptest_pet_birthday_user_add_stmt;
