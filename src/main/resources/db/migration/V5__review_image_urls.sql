SET @shoptest_review_image_urls_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND column_name = 'image_urls'
);

SET @shoptest_review_image_urls_ddl := IF(
    @shoptest_review_image_urls_exists = 0,
    'ALTER TABLE reviews ADD COLUMN image_urls TEXT NULL',
    'SELECT 1'
);

PREPARE shoptest_review_image_urls_stmt FROM @shoptest_review_image_urls_ddl;
EXECUTE shoptest_review_image_urls_stmt;
DEALLOCATE PREPARE shoptest_review_image_urls_stmt;
