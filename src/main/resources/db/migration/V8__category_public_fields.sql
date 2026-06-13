SET @shoptest_category_image_url_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'categories'
      AND column_name = 'image_url'
);
SET @shoptest_category_image_url_ddl := IF(
    @shoptest_category_image_url_exists = 0,
    'ALTER TABLE categories ADD COLUMN image_url TEXT NULL',
    'SELECT 1'
);
PREPARE shoptest_category_image_url_stmt FROM @shoptest_category_image_url_ddl;
EXECUTE shoptest_category_image_url_stmt;
DEALLOCATE PREPARE shoptest_category_image_url_stmt;

SET @shoptest_category_localized_content_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'categories'
      AND column_name = 'localized_content'
);
SET @shoptest_category_localized_content_ddl := IF(
    @shoptest_category_localized_content_exists = 0,
    'ALTER TABLE categories ADD COLUMN localized_content TEXT NULL',
    'SELECT 1'
);
PREPARE shoptest_category_localized_content_stmt FROM @shoptest_category_localized_content_ddl;
EXECUTE shoptest_category_localized_content_stmt;
DEALLOCATE PREPARE shoptest_category_localized_content_stmt;
