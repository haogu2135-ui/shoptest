-- 鐢ㄦ埛琛?
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    address TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    role_code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    password_changed_at TIMESTAMP(3) NULL,
    INDEX idx_users_status (status),
    INDEX idx_users_role_code (role_code)
);

-- 鍟嗗搧鍒嗙被琛?
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    parent_id BIGINT,
    path VARCHAR(500),
    level INT NOT NULL DEFAULT 1,
    image_url TEXT,
    localized_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id),
    INDEX idx_categories_path (path),
    INDEX idx_categories_parent_level (parent_id, level, id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logistics_carriers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    tracking_code VARCHAR(80) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product brand is intentionally denormalized vendor/display text for imports,
-- search, personalization and storefront display. The brands table supplies
-- curated option lists, not a strict FK source for every supplier label.
-- 鍟嗗搧琛?
CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    category_id BIGINT NOT NULL,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    brand VARCHAR(120),
    original_price DECIMAL(10,2),
    discount INT DEFAULT 0,
    limited_time_price DECIMAL(10,2),
    limited_time_start_at DATETIME,
    limited_time_end_at DATETIME,
    tag VARCHAR(80),
    images TEXT,
    specifications TEXT,
    detail_content TEXT,
    variants TEXT,
    warranty VARCHAR(255),
    shipping VARCHAR(255),
    free_shipping BOOLEAN DEFAULT FALSE,
    free_shipping_threshold DECIMAL(10,2),
    is_featured BOOLEAN DEFAULT FALSE,
    best_seller_rank INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT ck_products_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'REJECTED')),
    INDEX idx_products_best_seller_rank (best_seller_rank, id),
    INDEX idx_products_limited_time_window (limited_time_start_at, limited_time_end_at, status, id),
    FULLTEXT INDEX idx_products_search_text (name, description, brand, tag),
    UNIQUE KEY uk_products_category_name (category_id, name));

-- 璐墿杞﹁〃
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    selected_specs TEXT,
    selected_specs_key VARBINARY(32) GENERATED ALWAYS AS (UNHEX(SHA2(COALESCE(selected_specs, ''), 256))) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uk_cart_user_product_specs (user_id, product_id, selected_specs_key)
);

-- 璁㈠崟琛?
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no VARCHAR(32) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    original_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    shipping_fee DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    user_coupon_id BIGINT,
    coupon_id BIGINT,
    coupon_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
    shipping_address TEXT NOT NULL,
    recipient_name VARCHAR(120),
    recipient_phone VARCHAR(60),
    contact_email VARCHAR(160),
    guest_order BOOLEAN NOT NULL DEFAULT FALSE,
    payment_method VARCHAR(50) NOT NULL,
    tracking_number VARCHAR(100),
    tracking_carrier_code VARCHAR(80),
    tracking_carrier_name VARCHAR(100),
    return_tracking_number VARCHAR(100),
    return_reason TEXT,
    return_requested_at TIMESTAMP NULL,
    return_approved_at TIMESTAMP NULL,
    return_rejected_at TIMESTAMP NULL,
    return_shipped_at TIMESTAMP NULL,
    returned_at TIMESTAMP NULL,
    refunded_at TIMESTAMP NULL,
    shipped_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_orders_tracking_carrier_code FOREIGN KEY (tracking_carrier_code) REFERENCES logistics_carriers(tracking_code),
    CONSTRAINT ck_orders_status CHECK (status IN ('PENDING_PAYMENT', 'PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED')),
    INDEX idx_orders_status_created (status, created_at),
    INDEX idx_orders_user_status (user_id, status),
    INDEX idx_orders_user_status_created (user_id, status, created_at),
    INDEX idx_orders_created_id (created_at, id),
    INDEX idx_orders_status_updated (status, updated_at),
    INDEX idx_orders_status_return_requested (status, return_requested_at),
    INDEX idx_orders_status_return_approved (status, return_approved_at),
    INDEX idx_orders_status_return_shipped (status, return_shipped_at),
    INDEX idx_orders_status_tracking (status, tracking_number),
    INDEX idx_orders_tracking_carrier_code (tracking_carrier_code),
    INDEX idx_orders_refunded_at (refunded_at),
    INDEX idx_orders_recent_created_status (created_at, status, id)
);

CREATE TABLE IF NOT EXISTS checkout_idempotency_keys (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    checkout_scope VARCHAR(20) NOT NULL,
    principal VARCHAR(180) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    order_id BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT ck_checkout_idempotency_status CHECK (status IN ('PROCESSING', 'COMPLETED')),
    UNIQUE KEY uk_checkout_idempotency_key (checkout_scope, principal, idempotency_key),
    INDEX idx_checkout_idempotency_order (order_id),
    INDEX idx_checkout_idempotency_updated (updated_at)
);

-- 鏀惰揣鍦板潃琛?
CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    recipient_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    region VARCHAR(1000) NULL,
    postal_code VARCHAR(20) NULL,
    detail_address VARCHAR(260) NULL,
    address TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    default_user_id BIGINT GENERATED ALWAYS AS (CASE WHEN is_default THEN user_id ELSE NULL END) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY uk_user_addresses_one_default (default_user_id),
    INDEX idx_user_addresses_user (user_id)
);

-- 鏀惰棌琛?
CREATE TABLE IF NOT EXISTS wishlist (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uk_user_product (user_id, product_id)
);

-- 閫氱煡琛?
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT,
    content_format VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_notifications_user_read (user_id, is_read),
    INDEX idx_notifications_user_created (user_id, created_at),
    INDEX idx_notifications_created_at (created_at)
);

-- 璁㈠崟璇︽儏琛?
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    product_name_snapshot VARCHAR(100),
    image_url_snapshot TEXT,
    selected_specs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order_items_product_order (product_id, order_id),
    INDEX idx_order_items_order_product (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment VARCHAR(1000),
    image_urls TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    order_id BIGINT,
    admin_reply VARCHAR(1000),
    replied_at DATETIME,
    reported_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_reviews_status CHECK (status IN ('PENDING', 'APPROVED', 'HIDDEN')),
    INDEX idx_reviews_product_id (product_id),
    INDEX idx_reviews_user_id (user_id),
    INDEX idx_reviews_order_id (order_id),
    UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id),
    INDEX idx_reviews_status_created (status, created_at),
    INDEX idx_reviews_reported_status (reported_count, status, created_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pet_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    pet_type VARCHAR(20) NOT NULL DEFAULT 'DOG',
    breed VARCHAR(100),
    birthday DATE,
    weight DECIMAL(8,2),
    size VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_pet_profiles_user (user_id)
);

CREATE TABLE IF NOT EXISTS pet_gallery_photos (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT,
    username VARCHAR(80) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    source VARCHAR(20) NOT NULL DEFAULT 'USER_UPLOAD',
    like_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_pet_gallery_status_created (status, like_count, created_at),
    INDEX idx_pet_gallery_user (user_id),
    INDEX idx_pet_gallery_ip (ip_address)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pet_gallery_photo_likes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    photo_id BIGINT NOT NULL,
    user_id BIGINT,
    ip_address VARCHAR(45) NOT NULL,
    viewer_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES pet_gallery_photos(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_pet_gallery_like_photo (photo_id),
    INDEX idx_pet_gallery_like_user (user_id),
    INDEX idx_pet_gallery_like_ip (ip_address),
    INDEX idx_pet_gallery_like_viewer (viewer_key),
    UNIQUE KEY uk_gallery_like_photo_user (photo_id, user_id),
    UNIQUE KEY uk_gallery_like_photo_viewer (photo_id, viewer_key)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_url VARCHAR(500),
    transaction_id VARCHAR(64),
    provider_reference VARCHAR(128),
    refund_reference VARCHAR(128),
    expires_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    refunded_at TIMESTAMP NULL,
    callback_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT ck_payments_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDING', 'REFUNDED', 'RECONCILE_REQUIRED')),
    UNIQUE KEY uk_payment_order_channel (order_id, channel),
    INDEX idx_payments_order_no_channel (order_no, channel),
    INDEX idx_payments_transaction_id (transaction_id),
    INDEX idx_payments_status_expires (status, expires_at)
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(50) NOT NULL,
    result VARCHAR(20) NOT NULL,
    actor_user_id BIGINT,
    actor_username VARCHAR(120),
    actor_role VARCHAR(40),
    resource_type VARCHAR(80),
    resource_id VARCHAR(120),
    ip_address VARCHAR(64),
    user_agent VARCHAR(500),
    message VARCHAR(1000),
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_action_created (action, created_at),
    INDEX idx_audit_actor_created (actor_username, created_at),
    INDEX idx_audit_resource (resource_type, resource_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    coupon_type VARCHAR(30) NOT NULL,
    scope VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    threshold_amount DECIMAL(10,2) DEFAULT 0.00,
    reduction_amount DECIMAL(10,2) DEFAULT 0.00,
    discount_percent INT,
    max_discount_amount DECIMAL(10,2),
    total_quantity INT,
    claimed_quantity INT NOT NULL DEFAULT 0,
    used_count INT NOT NULL DEFAULT 0,
    start_at DATETIME,
    end_at DATETIME,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT ck_coupons_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_coupons_claimed_quantity_lte_total CHECK (claimed_quantity >= 0 AND (total_quantity IS NULL OR (total_quantity >= 0 AND claimed_quantity <= total_quantity))),
    CONSTRAINT ck_coupons_discount_percent CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 99),
    INDEX idx_coupons_public_active (scope, status, start_at, end_at),
    INDEX idx_coupons_public_claimable (scope, status, start_at, end_at, total_quantity, claimed_quantity, id)
);

CREATE TABLE IF NOT EXISTS user_coupons (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    coupon_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNUSED',
    order_id BIGINT,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT ck_user_coupons_status CHECK (status IN ('UNUSED', 'USED')),
    UNIQUE KEY uk_user_coupon (user_id, coupon_id),
    INDEX idx_user_coupons_user_status (user_id, status)
);

ALTER TABLE orders ADD CONSTRAINT fk_orders_coupon_id FOREIGN KEY (coupon_id) REFERENCES coupons(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_user_coupon_id FOREIGN KEY (user_coupon_id) REFERENCES user_coupons(id);

CREATE TABLE IF NOT EXISTS pet_birthday_coupon_grants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    coupon_id BIGINT NOT NULL,
    birthday_year INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pet_birthday_year (pet_id, birthday_year),
    CONSTRAINT fk_pet_birthday_coupon_grants_pet FOREIGN KEY (pet_id) REFERENCES pet_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_pet_birthday_coupon_grants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pet_birthday_coupon_configs (
    id BIGINT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    name_prefix VARCHAR(100) NOT NULL DEFAULT 'Pet Birthday Gift',
    coupon_type VARCHAR(30) NOT NULL DEFAULT 'FULL_REDUCTION',
    threshold_amount DECIMAL(10,2) DEFAULT 30.00,
    reduction_amount DECIMAL(10,2) DEFAULT 8.00,
    discount_percent INT,
    max_discount_amount DECIMAL(10,2),
    valid_days INT NOT NULL DEFAULT 14,
    max_benefits_per_user INT NOT NULL DEFAULT 3,
    total_quantity_per_coupon INT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO pet_birthday_coupon_configs (
    id, enabled, name_prefix, coupon_type, threshold_amount, reduction_amount,
    valid_days, max_benefits_per_user, description
) VALUES (
    1, TRUE, 'Pet Birthday Gift', 'FULL_REDUCTION', 30.00, 8.00,
    14, 3, 'Exclusive birthday coupon for pet profiles. Auto-granted once per pet birthday each year.'
);

CREATE TABLE IF NOT EXISTS product_questions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    question VARCHAR(1000) NOT NULL,
    answer VARCHAR(1000),
    answered_by BIGINT,
    answered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (answered_by) REFERENCES users(id),
    INDEX idx_product_questions_product_answered_created (product_id, answered_at, created_at, id)
);

CREATE TABLE IF NOT EXISTS support_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    assigned_admin_id BIGINT,
    context_key VARCHAR(160),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    last_message VARCHAR(500),
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_admin_id) REFERENCES users(id),
    INDEX idx_support_sessions_user_context_status (user_id, context_key, status),
    INDEX idx_support_sessions_user_status (user_id, status),
    INDEX idx_support_sessions_updated_at (updated_at)
);

CREATE TABLE IF NOT EXISTS support_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    sender_role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    is_read_by_user BOOLEAN DEFAULT FALSE,
    is_read_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES support_sessions(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    INDEX idx_support_messages_session_created (session_id, created_at),
    INDEX idx_support_messages_unread_admin (is_read_by_admin, sender_role),
    INDEX idx_support_messages_unread_user (is_read_by_user, sender_role)
);

CREATE TABLE IF NOT EXISTS admin_bug_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    version BIGINT NOT NULL DEFAULT 0,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    module VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    priority VARCHAR(20) NOT NULL DEFAULT 'P2',
    status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    page_url VARCHAR(500),
    environment VARCHAR(120),
    reproduction_steps TEXT,
    expected_result TEXT,
    actual_result TEXT,
    attachment_urls TEXT,
    reporter_id BIGINT,
    reporter_name VARCHAR(120),
    assigned_to VARCHAR(120) DEFAULT 'CODEX',
    scan_note TEXT,
    fix_summary TEXT,
    regression_note TEXT,
    last_scanned_at TIMESTAMP NULL,
    fixed_at TIMESTAMP NULL,
    fixed_by VARCHAR(120),
    regression_at TIMESTAMP NULL,
    regression_by VARCHAR(120),
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_admin_bug_status_updated (status, updated_at),
    INDEX idx_admin_bug_scan_due (status, last_scanned_at),
    INDEX idx_admin_bug_severity_status (severity, status),
    INDEX idx_admin_bug_module_status (module, status),
    INDEX idx_admin_bug_created (created_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_code VARCHAR(50) NOT NULL,
    permission_key VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_code, permission_key),
    INDEX idx_admin_role_permissions_role (role_code),
    CONSTRAINT fk_admin_role_permissions_role_code FOREIGN KEY (role_code) REFERENCES admin_roles(code) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

INSERT IGNORE INTO brands (id, name, description, logo_url, website_url, status, sort_order) VALUES
(1, 'PawPilot', 'Smart feeding and connected pet care devices.', 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 10),
(2, 'HydraWhisk', 'Quiet hydration products for cats and small pets.', 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 20),
(3, 'TrailTails', 'Walking, travel and safety gear for daily adventures.', 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 30),
(4, 'CloudNap', 'Comfort beds and furniture for restful pets.', 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 40),
(5, 'BrightBite', 'Dental toys and enrichment for healthy play.', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 50),
(6, 'PurePaws', 'Gentle grooming and hygiene essentials.', 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 60),
(7, 'NutriTail', 'Balanced nutrition for cats and dogs.', 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 70),
(8, 'CanineCore', 'Training treats and puppy care basics.', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=240&q=80', NULL, 'ACTIVE', 80);

INSERT IGNORE INTO logistics_carriers (id, name, tracking_code, status, sort_order) VALUES
(1, 'DHL', '100001', 'ACTIVE', 10),
(2, 'FedEx', '100003', 'ACTIVE', 20),
(3, 'UPS', '100002', 'ACTIVE', 30),
(4, 'USPS', '21051', 'ACTIVE', 40),
(5, 'Mexico Post', '13141', 'ACTIVE', 50),
(6, 'YunExpress', '190008', 'ACTIVE', 60),
(7, 'YTO Express', '190157', 'ACTIVE', 70);

-- Default catalog seed is intentionally non-destructive: existing rows are left intact.
INSERT IGNORE INTO categories (id, name, description, parent_id, level, image_url) VALUES
(1, 'Pet Supplies', 'Main catalog root for pet food, care and accessories.', NULL, 1, 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=900&q=80'),
(2, 'Pet Food', 'Dry food, wet food, treats and supplements for dogs and cats.', 1, 2, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80'),
(3, 'Bowls, Feeders & Waterers', 'Automatic feeders, slow feeders, bowls and fountains.', 1, 2, 'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80'),
(4, 'Beds & Furniture', 'Comfort beds, crates, mats and calming furniture.', 1, 2, 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=900&q=80'),
(5, 'Toys & Enrichment', 'Chew toys, puzzles, teaser toys and training rewards.', 1, 2, 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80'),
(6, 'Grooming & Hygiene', 'Shampoo, brushes, litter, pads and daily care.', 1, 2, 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80'),
(7, 'Walking & Travel', 'Leashes, harnesses, carriers and travel accessories.', 1, 2, 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=900&q=80'),
(8, 'Dog Food', 'Daily nutrition and treats for dogs.', 2, 3, 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80'),
(9, 'Cat Food', 'Daily nutrition and treats for cats.', 2, 3, 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80'),
(10, 'Automatic Feeders', 'Programmable feeding and portion control.', 3, 3, 'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80'),
(11, 'Water Fountains', 'Filtered drinking fountains and replacement filters.', 3, 3, 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=900&q=80'),
(12, 'Interactive Toys', 'Puzzle toys and active play for pets.', 5, 3, 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80'),
(13, 'Harnesses & Leashes', 'Adjustable walking sets and safety gear.', 7, 3, 'https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=900&q=80');

INSERT IGNORE INTO products (
    id, name, description, price, stock, category_id, image_url, status, brand,
    original_price, discount, limited_time_price, limited_time_start_at, limited_time_end_at,
    tag, images, specifications, detail_content, warranty, shipping, free_shipping,
    free_shipping_threshold, is_featured
) VALUES
(1, 'PawPilot Smart Pet Feeder 4L', 'Programmable automatic feeder with portion control, sealed food storage and a clear schedule for cats and small dogs.', 129.90, 42, 10, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'PawPilot', 159.90, 19, 109.90, '2026-05-01 00:00:00', '2026-06-30 23:59:59', 'hot', '["https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80","https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium","Capacity":"4 L","Material":"BPA-free ABS","Color":"White","options.Size":"Small,Medium","options.Color":"White,Black","i18n.es.name":"Comedero inteligente PawPilot 4L","i18n.es.description":"Comedero automático programable con control de porciones para gatos y perros pequeños.","i18n.zh.name":"PawPilot 4L \\u667a\\u80fd\\u5ba0\\u7269\\u5582\\u98df\\u5668","i18n.zh.description":"\\u652f\\u6301\\u5b9a\\u65f6\\u4e0e\\u5206\\u91cf\\u63a7\\u5236\\u7684\\u81ea\\u52a8\\u5582\\u98df\\u5668\\uff0c\\u9002\\u5408\\u732b\\u548c\\u5c0f\\u578b\\u72ac\\u3002"}', '[{"type":"text","content":"Set up to six meals per day and keep dry food fresh with the sealed hopper."},{"type":"text","content":"Localized product copy is maintained for shoppers who switch language from the storefront."}]', '1 year limited warranty', 'Ships in a protective box; free over threshold.', TRUE, 899.00, TRUE),
(2, 'HydraWhisk Quiet Cat Water Fountain', 'Low-noise filtered water fountain that encourages cats to drink more throughout the day.', 49.90, 75, 11, 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'HydraWhisk', 64.90, 23, NULL, NULL, NULL, 'new', '["https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Cat","Capacity":"2.5 L","Material":"Stainless steel, ABS","Color":"Blue","options.Color":"Blue,White","Filter":"Replace every 30 days","i18n.es.name":"Fuente silenciosa HydraWhisk para gato","i18n.es.description":"Fuente filtrada de bajo ruido que ayuda a los gatos a beber mas agua."}', '[{"type":"text","content":"Circulating water and replaceable filters help keep every sip fresh."}]', '6 month warranty', 'Standard shipping', FALSE, NULL, TRUE),
(3, 'TrailTails Walking Starter Bundle', 'Leash, collar and waste-bag holder bundled for safer daily walks at one special set price.', 34.90, 120, 13, 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'TrailTails', 54.90, 27, NULL, NULL, NULL, 'hot', '["https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium, Large","Material":"Nylon","Color":"Black","options.Size":"Small,Medium,Large","options.Color":"Black,Red,Blue","Closure":"Quick-release buckles","bundle.enabled":"true","bundle.title":"Leash + Collar + Waste Bags","bundle.price":"39.90","bundle.items":"[{\"name\":\"Adjustable leash\",\"quantity\":1},{\"name\":\"Matching collar\",\"quantity\":1},{\"name\":\"Waste-bag roll\",\"quantity\":2}]","i18n.es.name":"Kit TrailTails de paseo inicial","i18n.es.description":"Correa, collar y bolsas en un kit para paseos diarios mas seguros."}', '[{"type":"text","content":"Adjustable neck and chest straps help the harness fit growing pets and different breeds."},{"type":"text","content":"Bundle includes a matching walking set for first-time pet parents."}]', '1 year limited warranty', 'Standard shipping', FALSE, NULL, FALSE),
(4, 'CloudNap Orthopedic Calming Bed', 'Bolstered pet bed with orthopedic foam support and a washable cover for deep everyday rest.', 89.90, 36, 4, 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'CloudNap', 109.90, 18, 79.90, '2026-05-01 00:00:00', '2026-05-31 23:59:59', 'discount', '["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Medium, Large","Material":"Orthopedic foam, plush cover","Color":"Gray","options.Size":"Medium,Large","options.Color":"Gray,Brown","Care":"Machine-washable cover","i18n.es.name":"Cama ortopédica CloudNap relajante","i18n.es.description":"Cama con bordes, espuma ortopédica y funda lavable para descanso diario."}', '[{"type":"text","content":"The raised edge supports curled sleepers while the foam base cushions joints."}]', '1 year limited warranty', 'Ships compressed; allow 24 hours to expand.', TRUE, 899.00, TRUE),
(5, 'BrightBite Dental Chew Toy Set', 'Durable chew toy pair with textured ridges for enrichment and everyday dental care.', 18.90, 180, 12, 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'BrightBite', 24.90, 24, NULL, NULL, NULL, 'new', '["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium","Material":"Silicone","Color":"Green","options.Size":"Small,Medium","options.Color":"Green,Orange","Pack":"2 pieces","i18n.es.name":"Set BrightBite de juguetes dentales para morder","i18n.es.description":"Par de juguetes resistentes con relieves para juego y cuidado dental diario."}', '[{"type":"text","content":"Textured surfaces help massage gums during supervised play."}]', '30 day replacement for manufacturing defects', 'Standard shipping', FALSE, NULL, FALSE),
(6, 'PurePaws Oatmeal Sensitive Shampoo', 'Gentle oatmeal shampoo for sensitive skin, designed for dogs and cats with a light clean scent.', 15.90, 95, 6, 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'PurePaws', 19.90, 20, NULL, NULL, NULL, NULL, '["https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"All sizes","Volume":"500 ml","Formula":"Oatmeal, aloe","Coat Type":"Sensitive skin","i18n.es.name":"Champú PurePaws de avena para piel sensible","i18n.es.description":"Champú suave de avena para perros y gatos con piel sensible."}', '[{"type":"text","content":"A mild grooming essential for routine baths and coat care."}]', 'Quality guarantee', 'Standard shipping', FALSE, NULL, FALSE),
(7, 'NutriTail Grain-Free Salmon Cat Food 2kg', 'Complete dry cat food with salmon protein, taurine and balanced minerals for adult cats.', 32.90, 88, 9, 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'NutriTail', 39.90, 18, NULL, NULL, NULL, 'hot', '["https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Cat","Weight":"2 kg","Flavor":"Salmon","Life Stage":"Adult","i18n.es.name":"Alimento NutriTail de salmón sin granos para gato, 2 kg","i18n.es.description":"Alimento seco completo con salmón, taurina y minerales balanceados para gatos adultos."}', '[{"type":"text","content":"Balanced daily nutrition for adult cats with a fish-first flavor profile."}]', 'Freshness guarantee', 'Food items ship separately when needed.', FALSE, NULL, TRUE),
(8, 'CanineCore Puppy Training Treats', 'Soft bite-size chicken treats for puppy training, recall practice and positive reinforcement.', 12.90, 160, 8, 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'CanineCore', 16.90, 24, NULL, NULL, NULL, 'new', '["https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium","Weight":"300 g","Flavor":"Chicken","Texture":"Soft","i18n.es.name":"Premios CanineCore para entrenamiento de cachorro","i18n.es.description":"Premios suaves de pollo en bocados pequeños para entrenar cachorros."}', '[{"type":"text","content":"Small, soft rewards help keep training fast and focused."}]', 'Freshness guarantee', 'Standard shipping', FALSE, NULL, FALSE);
