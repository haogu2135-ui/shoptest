-- 鐢ㄦ埛琛?
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    address TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 鍟嗗搧鍒嗙被琛?
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    parent_id BIGINT,
    level INT NOT NULL DEFAULT 1,
    image_url TEXT,
    localized_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
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

-- 鍟嗗搧琛?
CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    category_id BIGINT NOT NULL,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    brand VARCHAR(100),
    original_price DECIMAL(10,2),
    discount INT DEFAULT 0,
    limited_time_price DECIMAL(10,2),
    limited_time_start_at DATETIME,
    limited_time_end_at DATETIME,
    tag VARCHAR(20),
    images TEXT,
    specifications TEXT,
    detail_content TEXT,
    variants TEXT,
    warranty VARCHAR(255),
    shipping VARCHAR(255),
    free_shipping BOOLEAN DEFAULT FALSE,
    free_shipping_threshold DECIMAL(10,2),
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 璐墿杞﹁〃
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    selected_specs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
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
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 鏀惰揣鍦板潃琛?
CREATE TABLE IF NOT EXISTS user_addresses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    recipient_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 鏀惰棌琛?
CREATE TABLE IF NOT EXISTS wishlist (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uk_user_product (user_id, product_id)
);

-- 閫氱煡琛?
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    message TEXT,
    content_format VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
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
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    order_id BIGINT,
    admin_reply VARCHAR(1000),
    replied_at DATETIME,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_reviews_product_id (product_id),
    INDEX idx_reviews_user_id (user_id),
    INDEX idx_reviews_status_created (status, created_at)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES pet_gallery_photos(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_pet_gallery_like_photo (photo_id),
    INDEX idx_pet_gallery_like_user (user_id),
    INDEX idx_pet_gallery_like_ip (ip_address)
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
    expires_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    UNIQUE KEY uk_payment_order_channel (order_id, channel)
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(50) NOT NULL,
    result VARCHAR(20) NOT NULL,
    actor_user_id BIGINT,
    actor_username VARCHAR(100),
    actor_role VARCHAR(30),
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address VARCHAR(45),
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
    start_at DATETIME,
    end_at DATETIME,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_coupons_public_active (scope, status, start_at, end_at)
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
    UNIQUE KEY uk_user_coupon (user_id, coupon_id),
    INDEX idx_user_coupons_user_status (user_id, status)
);

CREATE TABLE IF NOT EXISTS pet_birthday_coupon_grants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pet_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    coupon_id BIGINT NOT NULL,
    birthday_year INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pet_birthday_year (pet_id, birthday_year),
    FOREIGN KEY (pet_id) REFERENCES pet_profiles(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    FOREIGN KEY (answered_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS support_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    assigned_admin_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    last_message VARCHAR(500),
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_admin_id) REFERENCES users(id),
    INDEX idx_support_sessions_user_status (user_id, status),
    INDEX idx_support_sessions_updated_at (updated_at)
);

CREATE TABLE IF NOT EXISTS support_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    sender_role VARCHAR(20) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    is_read_by_user BOOLEAN DEFAULT FALSE,
    is_read_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES support_sessions(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    INDEX idx_support_messages_session_created (session_id, created_at),
    INDEX idx_support_messages_unread_admin (is_read_by_admin, sender_role),
    INDEX idx_support_messages_unread_user (is_read_by_user, sender_role)
);

-- Fix existing columns to TEXT (idempotent with continue-on-error)
ALTER TABLE products MODIFY COLUMN image_url TEXT;
ALTER TABLE products MODIFY COLUMN images TEXT;
ALTER TABLE products MODIFY COLUMN specifications TEXT;
ALTER TABLE products ADD COLUMN detail_content TEXT;
ALTER TABLE products ADD COLUMN variants TEXT;
ALTER TABLE products MODIFY COLUMN description TEXT;
ALTER TABLE users MODIFY COLUMN email VARCHAR(100) NULL;
ALTER TABLE users ADD UNIQUE KEY uk_users_phone (phone);
ALTER TABLE cart_items ADD COLUMN selected_specs TEXT;
ALTER TABLE cart_items DROP INDEX uk_cart_user_product;
ALTER TABLE cart_items ADD INDEX idx_cart_user_product_specs (user_id, product_id);
ALTER TABLE categories ADD COLUMN level INT NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN image_url TEXT;
ALTER TABLE categories ADD COLUMN localized_content TEXT;
ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE brands ADD COLUMN description TEXT;
ALTER TABLE brands ADD COLUMN logo_url TEXT;
ALTER TABLE brands ADD COLUMN website_url TEXT;
ALTER TABLE brands ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE brands ADD COLUMN sort_order INT DEFAULT 0;
ALTER TABLE products ADD COLUMN limited_time_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN limited_time_start_at DATETIME;
ALTER TABLE products ADD COLUMN limited_time_end_at DATETIME;
ALTER TABLE products ADD COLUMN free_shipping BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN free_shipping_threshold DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN order_no VARCHAR(32);
UPDATE orders SET order_no = CONCAT('SO', DATE_FORMAT(COALESCE(created_at, NOW()), '%Y%m%d%H%i%s'), LPAD(id, 8, '0')) WHERE order_no IS NULL OR order_no = '';
ALTER TABLE orders MODIFY COLUMN order_no VARCHAR(32) NOT NULL;
ALTER TABLE orders ADD UNIQUE KEY uk_orders_order_no (order_no);
ALTER TABLE orders MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT';
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN tracking_carrier_code VARCHAR(80);
ALTER TABLE orders ADD COLUMN tracking_carrier_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN return_tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN return_reason TEXT;
ALTER TABLE orders ADD COLUMN return_requested_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN return_approved_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN return_rejected_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN return_shipped_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN returned_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN completed_at TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN original_amount DECIMAL(10,2);
UPDATE orders SET original_amount = total_amount WHERE original_amount IS NULL;
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN shipping_fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN user_coupon_id BIGINT;
ALTER TABLE orders ADD COLUMN coupon_id BIGINT;
ALTER TABLE orders ADD COLUMN coupon_name VARCHAR(100);
ALTER TABLE notifications ADD COLUMN content_format VARCHAR(20) NOT NULL DEFAULT 'TEXT';
ALTER TABLE payments ADD COLUMN expires_at TIMESTAMP NULL;
ALTER TABLE payments ADD INDEX idx_payments_status_expires (status, expires_at);
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(50) NOT NULL,
    result VARCHAR(20) NOT NULL,
    actor_user_id BIGINT,
    actor_username VARCHAR(100),
    actor_role VARCHAR(30),
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    message VARCHAR(1000),
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_action_created (action, created_at),
    INDEX idx_audit_actor_created (actor_username, created_at),
    INDEX idx_audit_resource (resource_type, resource_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE reviews ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
UPDATE reviews SET status = 'APPROVED' WHERE status IS NULL OR status = '';
ALTER TABLE order_items ADD COLUMN product_name_snapshot VARCHAR(100);
ALTER TABLE order_items ADD COLUMN image_url_snapshot TEXT;
ALTER TABLE order_items ADD COLUMN selected_specs TEXT;
ALTER TABLE pet_gallery_photos MODIFY COLUMN user_id BIGINT NULL;
ALTER TABLE pet_gallery_photos ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'USER_UPLOAD';
ALTER TABLE pet_gallery_photos ADD COLUMN like_count INT NOT NULL DEFAULT 0;
UPDATE order_items oi
LEFT JOIN products p ON oi.product_id = p.id
SET oi.product_name_snapshot = COALESCE(oi.product_name_snapshot, p.name, CONCAT('#', oi.product_id)),
    oi.image_url_snapshot = COALESCE(oi.image_url_snapshot, p.image_url)
WHERE oi.product_name_snapshot IS NULL OR oi.image_url_snapshot IS NULL;
ALTER TABLE orders ADD COLUMN refunded_at TIMESTAMP NULL;
UPDATE orders SET completed_at = updated_at WHERE completed_at IS NULL AND status IN ('COMPLETED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'RETURNED');
UPDATE orders SET returned_at = updated_at, refunded_at = COALESCE(refunded_at, updated_at) WHERE status = 'RETURNED' AND returned_at IS NULL;

INSERT IGNORE INTO brands (id, name, description, logo_url, website_url, status, sort_order) VALUES
(1, 'PawPilot', 'Smart feeding and connected pet care devices.', 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=240&q=80', 'https://pawpilot.example.com', 'ACTIVE', 10),
(2, 'HydraWhisk', 'Quiet hydration products for cats and small pets.', 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=240&q=80', 'https://hydrawhisk.example.com', 'ACTIVE', 20),
(3, 'TrailTails', 'Walking, travel and safety gear for daily adventures.', 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=240&q=80', 'https://trailtails.example.com', 'ACTIVE', 30),
(4, 'CloudNap', 'Comfort beds and furniture for restful pets.', 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=240&q=80', 'https://cloudnap.example.com', 'ACTIVE', 40),
(5, 'BrightBite', 'Dental toys and enrichment for healthy play.', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=240&q=80', 'https://brightbite.example.com', 'ACTIVE', 50),
(6, 'PurePaws', 'Gentle grooming and hygiene essentials.', 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=240&q=80', 'https://purepaws.example.com', 'ACTIVE', 60),
(7, 'NutriTail', 'Balanced nutrition for cats and dogs.', 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=240&q=80', 'https://nutritail.example.com', 'ACTIVE', 70),
(8, 'CanineCore', 'Training treats and puppy care basics.', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=240&q=80', 'https://caninecore.example.com', 'ACTIVE', 80);

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
(1, 'Pet Supplies', 'English default catalog root for pet-only test data.', NULL, 1, 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=900&q=80'),
(2, 'Pet Food', 'Dry food, wet food, treats and supplements for dogs and cats.', 1, 2, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80'),
(3, 'Bowls, Feeders & Waterers', 'Automatic feeders, slow feeders, bowls and fountains.', 1, 2, 'https://images.unsplash.com/photo-1601758123927-1967a0d5f11b?auto=format&fit=crop&w=900&q=80'),
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
(1, 'PawPilot Smart Pet Feeder 4L', 'Programmable automatic feeder with portion control, sealed food storage and a clear schedule for cats and small dogs.', 129.90, 42, 10, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'PawPilot', 159.90, 19, 109.90, '2026-05-01 00:00:00', '2026-06-30 23:59:59', 'hot', '["https://images.unsplash.com/photo-1601758123927-1967a0d5f11b?auto=format&fit=crop&w=900&q=80","https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium","Capacity":"4 L","Material":"BPA-free ABS","Color":"White","options.Size":"Small,Medium","options.Color":"White,Black","i18n.es.name":"Comedero inteligente PawPilot 4L","i18n.es.description":"Comedero automatico programable con control de porciones para gatos y perros pequenos.","i18n.zh.name":"PawPilot 4L \\u667a\\u80fd\\u5ba0\\u7269\\u5582\\u98df\\u5668","i18n.zh.description":"\\u652f\\u6301\\u5b9a\\u65f6\\u4e0e\\u5206\\u91cf\\u63a7\\u5236\\u7684\\u81ea\\u52a8\\u5582\\u98df\\u5668\\uff0c\\u9002\\u5408\\u732b\\u548c\\u5c0f\\u578b\\u72ac\\u3002"}', '[{"type":"text","content":"Set up to six meals per day and keep dry food fresh with the sealed hopper."},{"type":"text","content":"English is the default content. Spanish and Chinese demo text is stored in specifications for language fallback testing."}]', '1 year limited warranty', 'Ships in a protective box; free over threshold.', TRUE, 899.00, TRUE),
(2, 'HydraWhisk Quiet Cat Water Fountain', 'Low-noise filtered water fountain that encourages cats to drink more throughout the day.', 49.90, 75, 11, 'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'HydraWhisk', 64.90, 23, NULL, NULL, NULL, 'new', '["https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Cat","Capacity":"2.5 L","Material":"Stainless steel, ABS","Color":"Blue","options.Color":"Blue,White","Filter":"Replace every 30 days","i18n.es.name":"Fuente silenciosa HydraWhisk para gato","i18n.es.description":"Fuente filtrada de bajo ruido que ayuda a los gatos a beber mas agua."}', '[{"type":"text","content":"Circulating water and replaceable filters help keep every sip fresh."}]', '6 month warranty', 'Standard shipping', FALSE, NULL, TRUE),
(3, 'TrailTails Walking Starter Bundle', 'Leash, collar and waste-bag holder bundled for safer daily walks at one special set price.', 34.90, 120, 13, 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'TrailTails', 54.90, 27, NULL, NULL, NULL, 'hot', '["https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium, Large","Material":"Nylon","Color":"Black","options.Size":"Small,Medium,Large","options.Color":"Black,Red,Blue","Closure":"Quick-release buckles","bundle.enabled":"true","bundle.title":"Leash + Collar + Waste Bags","bundle.price":"39.90","bundle.items":"[{\"name\":\"Adjustable leash\",\"quantity\":1},{\"name\":\"Matching collar\",\"quantity\":1},{\"name\":\"Waste-bag roll\",\"quantity\":2}]"}', '[{"type":"text","content":"Adjustable neck and chest straps help the harness fit growing pets and different breeds."},{"type":"text","content":"Bundle includes a matching walking set for first-time pet parents."}]', '1 year limited warranty', 'Standard shipping', FALSE, NULL, FALSE),
(4, 'CloudNap Orthopedic Calming Bed', 'Bolstered pet bed with orthopedic foam support and a washable cover for deep everyday rest.', 89.90, 36, 4, 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'CloudNap', 109.90, 18, 79.90, '2026-05-01 00:00:00', '2026-05-31 23:59:59', 'discount', '["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Medium, Large","Material":"Orthopedic foam, plush cover","Color":"Gray","options.Size":"Medium,Large","options.Color":"Gray,Brown","Care":"Machine-washable cover"}', '[{"type":"text","content":"The raised edge supports curled sleepers while the foam base cushions joints."}]', '1 year limited warranty', 'Ships compressed; allow 24 hours to expand.', TRUE, 899.00, TRUE),
(5, 'BrightBite Dental Chew Toy Set', 'Durable chew toy pair with textured ridges for enrichment and everyday dental care.', 18.90, 180, 12, 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'BrightBite', 24.90, 24, NULL, NULL, NULL, 'new', '["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium","Material":"Silicone","Color":"Green","options.Size":"Small,Medium","options.Color":"Green,Orange","Pack":"2 pieces"}', '[{"type":"text","content":"Textured surfaces help massage gums during supervised play."}]', '30 day replacement for manufacturing defects', 'Standard shipping', FALSE, NULL, FALSE),
(6, 'PurePaws Oatmeal Sensitive Shampoo', 'Gentle oatmeal shampoo for sensitive skin, designed for dogs and cats with a light clean scent.', 15.90, 95, 6, 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'PurePaws', 19.90, 20, NULL, NULL, NULL, NULL, '["https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"All sizes","Volume":"500 ml","Formula":"Oatmeal, aloe","Coat Type":"Sensitive skin"}', '[{"type":"text","content":"A mild grooming essential for routine baths and coat care."}]', 'Quality guarantee', 'Standard shipping', FALSE, NULL, FALSE),
(7, 'NutriTail Grain-Free Salmon Cat Food 2kg', 'Complete dry cat food with salmon protein, taurine and balanced minerals for adult cats.', 32.90, 88, 9, 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'NutriTail', 39.90, 18, NULL, NULL, NULL, 'hot', '["https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Cat","Weight":"2 kg","Flavor":"Salmon","Life Stage":"Adult"}', '[{"type":"text","content":"Balanced daily nutrition for adult cats with a fish-first flavor profile."}]', 'Freshness guarantee', 'Food items ship separately when needed.', FALSE, NULL, TRUE),
(8, 'CanineCore Puppy Training Treats', 'Soft bite-size chicken treats for puppy training, recall practice and positive reinforcement.', 12.90, 160, 8, 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80', 'ACTIVE', 'CanineCore', 16.90, 24, NULL, NULL, NULL, 'new', '["https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80"]', '{"Pet Size":"Small, Medium","Weight":"300 g","Flavor":"Chicken","Texture":"Soft"}', '[{"type":"text","content":"Small, soft rewards help keep training fast and focused."}]', 'Freshness guarantee', 'Standard shipping', FALSE, NULL, FALSE);

