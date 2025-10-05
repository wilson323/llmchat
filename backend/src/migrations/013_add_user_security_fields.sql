-- UP
-- 添加用户安全和登录追踪字段
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- 更新现有用户的 email（如果为空，设置为 username@local.dev）
UPDATE users 
SET email = username || '@local.dev' 
WHERE email IS NULL;

-- DOWN
-- 删除索引
DROP INDEX IF EXISTS idx_users_locked_until;
DROP INDEX IF EXISTS idx_users_email;

-- 删除列
ALTER TABLE users
  DROP COLUMN IF EXISTS last_login_ip,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS email;
