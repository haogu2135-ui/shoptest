-- Pet profiles
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
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pet gallery photos
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

-- Pet gallery photo likes
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
    INDEX idx_pet_gallery_like_ip (ip_address),
    UNIQUE KEY uk_gallery_like_photo_user (photo_id, user_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pet birthday coupon configuration
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

-- Pet birthday coupon grants (tracks which pets received coupons)
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
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
