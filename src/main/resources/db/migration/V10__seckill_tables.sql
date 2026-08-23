CREATE TABLE IF NOT EXISTS seckill_campaigns (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(160) NOT NULL,
    subtitle VARCHAR(500),
    banner_url VARCHAR(2000),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    start_at DATETIME(3) NOT NULL,
    end_at DATETIME(3) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT ck_seckill_campaign_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'PAUSED')),
    CONSTRAINT ck_seckill_campaign_window CHECK (end_at > start_at),
    INDEX idx_seckill_campaign_public (status, start_at, end_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seckill_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    campaign_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    seckill_price DECIMAL(10,2) NOT NULL,
    quota INT NOT NULL,
    sold INT NOT NULL DEFAULT 0,
    limit_per_user INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_seckill_items_campaign FOREIGN KEY (campaign_id) REFERENCES seckill_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_seckill_items_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT ck_seckill_item_price CHECK (seckill_price >= 0),
    CONSTRAINT ck_seckill_item_quota CHECK (quota > 0 AND sold >= 0 AND sold <= quota),
    CONSTRAINT ck_seckill_item_limit CHECK (limit_per_user > 0),
    UNIQUE KEY uk_seckill_campaign_product (campaign_id, product_id),
    INDEX idx_seckill_items_campaign (campaign_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seckill_claims (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    campaign_id BIGINT NOT NULL,
    item_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_seckill_claims_campaign FOREIGN KEY (campaign_id) REFERENCES seckill_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_seckill_claims_item FOREIGN KEY (item_id) REFERENCES seckill_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_seckill_claims_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_seckill_claims_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT ck_seckill_claim_quantity CHECK (quantity > 0),
    UNIQUE KEY uk_seckill_claim_campaign_user (campaign_id, user_id),
    UNIQUE KEY uk_seckill_claim_idempotency (campaign_id, user_id, idempotency_key),
    INDEX idx_seckill_claims_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
