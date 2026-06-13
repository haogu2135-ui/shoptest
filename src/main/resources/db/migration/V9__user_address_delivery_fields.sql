SET @shoptest_user_addresses_region_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_addresses'
      AND column_name = 'region'
);
SET @shoptest_user_addresses_region_ddl := IF(
    @shoptest_user_addresses_region_exists = 0,
    'ALTER TABLE user_addresses ADD COLUMN region VARCHAR(1000) NULL',
    'SELECT 1'
);
PREPARE shoptest_user_addresses_region_stmt FROM @shoptest_user_addresses_region_ddl;
EXECUTE shoptest_user_addresses_region_stmt;
DEALLOCATE PREPARE shoptest_user_addresses_region_stmt;

SET @shoptest_user_addresses_postal_code_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_addresses'
      AND column_name = 'postal_code'
);
SET @shoptest_user_addresses_postal_code_ddl := IF(
    @shoptest_user_addresses_postal_code_exists = 0,
    'ALTER TABLE user_addresses ADD COLUMN postal_code VARCHAR(20) NULL',
    'SELECT 1'
);
PREPARE shoptest_user_addresses_postal_code_stmt FROM @shoptest_user_addresses_postal_code_ddl;
EXECUTE shoptest_user_addresses_postal_code_stmt;
DEALLOCATE PREPARE shoptest_user_addresses_postal_code_stmt;

SET @shoptest_user_addresses_detail_address_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'user_addresses'
      AND column_name = 'detail_address'
);
SET @shoptest_user_addresses_detail_address_ddl := IF(
    @shoptest_user_addresses_detail_address_exists = 0,
    'ALTER TABLE user_addresses ADD COLUMN detail_address VARCHAR(260) NULL',
    'SELECT 1'
);
PREPARE shoptest_user_addresses_detail_address_stmt FROM @shoptest_user_addresses_detail_address_ddl;
EXECUTE shoptest_user_addresses_detail_address_stmt;
DEALLOCATE PREPARE shoptest_user_addresses_detail_address_stmt;
