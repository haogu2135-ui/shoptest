SET @shoptest_orders_recipient_name_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'recipient_name'
);
SET @shoptest_orders_recipient_name_ddl := IF(
    @shoptest_orders_recipient_name_exists = 0,
    'ALTER TABLE orders ADD COLUMN recipient_name VARCHAR(120)',
    'SELECT 1'
);
PREPARE shoptest_orders_recipient_name_stmt FROM @shoptest_orders_recipient_name_ddl;
EXECUTE shoptest_orders_recipient_name_stmt;
DEALLOCATE PREPARE shoptest_orders_recipient_name_stmt;

SET @shoptest_orders_recipient_phone_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'recipient_phone'
);
SET @shoptest_orders_recipient_phone_ddl := IF(
    @shoptest_orders_recipient_phone_exists = 0,
    'ALTER TABLE orders ADD COLUMN recipient_phone VARCHAR(60)',
    'SELECT 1'
);
PREPARE shoptest_orders_recipient_phone_stmt FROM @shoptest_orders_recipient_phone_ddl;
EXECUTE shoptest_orders_recipient_phone_stmt;
DEALLOCATE PREPARE shoptest_orders_recipient_phone_stmt;

SET @shoptest_orders_contact_email_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND column_name = 'contact_email'
);
SET @shoptest_orders_contact_email_ddl := IF(
    @shoptest_orders_contact_email_exists = 0,
    'ALTER TABLE orders ADD COLUMN contact_email VARCHAR(160)',
    'SELECT 1'
);
PREPARE shoptest_orders_contact_email_stmt FROM @shoptest_orders_contact_email_ddl;
EXECUTE shoptest_orders_contact_email_stmt;
DEALLOCATE PREPARE shoptest_orders_contact_email_stmt;

SET @shoptest_orders_contact_email_index_exists := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'orders'
      AND index_name = 'idx_orders_contact_email'
);
SET @shoptest_orders_contact_email_index_ddl := IF(
    @shoptest_orders_contact_email_index_exists = 0,
    'CREATE INDEX idx_orders_contact_email ON orders (contact_email)',
    'SELECT 1'
);
PREPARE shoptest_orders_contact_email_index_stmt FROM @shoptest_orders_contact_email_index_ddl;
EXECUTE shoptest_orders_contact_email_index_stmt;
DEALLOCATE PREPARE shoptest_orders_contact_email_index_stmt;
