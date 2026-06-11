-- Keep admin catalog edits race-safe when two operators create or rename a product
-- to the same name inside one category. The ALTER intentionally fails if existing
-- duplicate rows must be cleaned before enabling the production constraint.
SET @product_category_name_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'products'
      AND index_name = 'uk_products_category_name'
);

SET @product_category_name_index_sql = IF(
    @product_category_name_index_exists = 0,
    'ALTER TABLE products ADD UNIQUE KEY uk_products_category_name (category_id, name)',
    'SELECT 1'
);

PREPARE product_category_name_index_stmt FROM @product_category_name_index_sql;
EXECUTE product_category_name_index_stmt;
DEALLOCATE PREPARE product_category_name_index_stmt;
