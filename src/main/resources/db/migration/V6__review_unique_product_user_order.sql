DELETE duplicate_review
FROM reviews duplicate_review
JOIN reviews kept_review
  ON kept_review.product_id = duplicate_review.product_id
 AND kept_review.user_id = duplicate_review.user_id
 AND kept_review.order_id = duplicate_review.order_id
 AND kept_review.id < duplicate_review.id
WHERE duplicate_review.order_id IS NOT NULL;

SET @shoptest_review_plain_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND index_name = 'idx_reviews_product_user_order'
);

SET @shoptest_review_drop_plain_index_ddl := IF(
    @shoptest_review_plain_index_exists > 0,
    'ALTER TABLE reviews DROP INDEX idx_reviews_product_user_order',
    'SELECT 1'
);

PREPARE shoptest_review_drop_plain_index_stmt FROM @shoptest_review_drop_plain_index_ddl;
EXECUTE shoptest_review_drop_plain_index_stmt;
DEALLOCATE PREPARE shoptest_review_drop_plain_index_stmt;

SET @shoptest_review_unique_index_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND index_name = 'uk_reviews_product_user_order'
);

SET @shoptest_review_unique_index_ddl := IF(
    @shoptest_review_unique_index_exists = 0,
    'ALTER TABLE reviews ADD UNIQUE INDEX uk_reviews_product_user_order (product_id, user_id, order_id)',
    'SELECT 1'
);

PREPARE shoptest_review_unique_index_stmt FROM @shoptest_review_unique_index_ddl;
EXECUTE shoptest_review_unique_index_stmt;
DEALLOCATE PREPARE shoptest_review_unique_index_stmt;
