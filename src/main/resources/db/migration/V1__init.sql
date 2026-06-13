-- Current commercial baseline for a fresh MySQL database.
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
    password_changed_at TIMESTAMP(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logistics_carriers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    tracking_code VARCHAR(80) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product brand is intentionally denormalized vendor/display text for imports,
-- search, personalization and storefront display. The brands table supplies
-- curated option lists, not a strict FK source for every supplier label.
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
    FULLTEXT INDEX idx_products_search_text (name, description, brand, tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    INDEX idx_coupons_public_active (scope, status, start_at, end_at),
    INDEX idx_coupons_public_claimable (scope, status, start_at, end_at, total_quantity, claimed_quantity, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    CONSTRAINT ck_orders_status CHECK (status IN ('PENDING_PAYMENT', 'PENDING_SHIPMENT', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURN_REFUNDING', 'RETURNED', 'REFUNDED')),
    INDEX idx_orders_status_created (status, created_at),
    INDEX idx_orders_user_created (user_id, created_at),
    INDEX idx_orders_user_status (user_id, status),
    INDEX idx_orders_user_status_created (user_id, status, created_at),
    INDEX idx_orders_created_id (created_at, id),
    INDEX idx_orders_status_updated (status, updated_at),
    INDEX idx_orders_status_return_requested (status, return_requested_at),
    INDEX idx_orders_status_return_approved (status, return_approved_at),
    INDEX idx_orders_status_return_shipped (status, return_shipped_at),
    INDEX idx_orders_status_tracking (status, tracking_number),
    INDEX idx_orders_refunded_at (refunded_at),
    INDEX idx_orders_contact_email (contact_email),
    INDEX idx_orders_recent_created_status (created_at, status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlist (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uk_user_product (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    CONSTRAINT ck_reviews_status CHECK (status IN ('PENDING', 'APPROVED', 'HIDDEN')),
    INDEX idx_reviews_product_id (product_id),
    INDEX idx_reviews_user_id (user_id),
    INDEX idx_reviews_order_id (order_id),
    UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id),
    INDEX idx_reviews_status_created (status, created_at),
    INDEX idx_reviews_reported_status (reported_count, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders ADD CONSTRAINT fk_orders_user_coupon_id FOREIGN KEY (user_coupon_id) REFERENCES user_coupons(id);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_bug_reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_code VARCHAR(50) NOT NULL,
    permission_key VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_code, permission_key),
    INDEX idx_admin_role_permissions_role (role_code),
    CONSTRAINT fk_admin_role_permissions_role_code FOREIGN KEY (role_code) REFERENCES admin_roles(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
