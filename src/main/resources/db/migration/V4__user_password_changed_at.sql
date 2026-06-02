SET @shoptest_user_password_changed_at_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'password_changed_at'
);

SET @shoptest_user_password_changed_at_ddl := IF(
    @shoptest_user_password_changed_at_exists = 0,
    'ALTER TABLE users ADD COLUMN password_changed_at DATETIME(3) NULL',
    'SELECT 1'
);

PREPARE shoptest_user_password_changed_at_stmt FROM @shoptest_user_password_changed_at_ddl;
EXECUTE shoptest_user_password_changed_at_stmt;
DEALLOCATE PREPARE shoptest_user_password_changed_at_stmt;

UPDATE users
SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at, NOW(3))
WHERE password_changed_at IS NULL;
