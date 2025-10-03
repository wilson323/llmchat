-- ====================================
-- 迁移008回滚脚本
-- ====================================

-- 1. 删除触发器和函数
DROP TRIGGER IF EXISTS trigger_reset_failed_attempts ON users;
DROP FUNCTION IF EXISTS reset_failed_attempts_on_success();

-- 2. 删除索引
DROP INDEX IF EXISTS idx_users_locked_until;
DROP INDEX IF EXISTS idx_users_last_login;

-- 3. 删除约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_status_values;

-- 4. 删除字段
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_ip;

-- 5. 删除迁移记录
DELETE FROM schema_migrations WHERE version = '008';

-- 回滚完成
SELECT '⚠️  迁移008已回滚' AS status;

