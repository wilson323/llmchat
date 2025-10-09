-- ====================================
-- 迁移008: 添加认证安全字段
-- ====================================
-- 目的: 支持账号安全特性
-- 影响: users表
-- 风险: 低（仅添加字段）
-- 回滚: 见008_add_auth_security_fields_down.sql
-- ====================================

-- 1. 添加失败登录计数
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

COMMENT ON COLUMN users.failed_login_attempts IS '连续失败登录次数';

-- 2. 添加账号锁定时间
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMENT ON COLUMN users.locked_until IS '账号锁定截止时间';

-- 3. 添加最后登录时间
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_login_at IS '最后登录时间';

-- 4. 添加最后登录IP
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);

COMMENT ON COLUMN users.last_login_ip IS '最后登录IP地址（IPv4/IPv6）';

-- 5. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_users_locked_until 
  ON users(locked_until) 
  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_login 
  ON users(last_login_at DESC);

-- 6. 创建触发器：重置失败计数（成功登录后）
CREATE OR REPLACE FUNCTION reset_failed_attempts_on_success()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at AND NEW.last_login_at IS NOT NULL THEN
    NEW.failed_login_attempts = 0;
    NEW.locked_until = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_failed_attempts ON users;

CREATE TRIGGER trigger_reset_failed_attempts
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION reset_failed_attempts_on_success();

-- 7. 添加账号状态约束
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS check_status_values;

ALTER TABLE users 
  ADD CONSTRAINT check_status_values 
  CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));

-- 8. 记录迁移日志
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '008',
  'Add authentication security fields (failed attempts, account locking)',
  CURRENT_TIMESTAMP
)
ON CONFLICT (version) DO NOTHING;

-- 迁移完成
SELECT '✅ 迁移008完成: 已添加认证安全字段' AS status;

