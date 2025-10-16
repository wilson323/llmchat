-- 添加AuthServiceV2所需的所有缺失字段
-- 创建时间: 2025-10-16
-- 原因: AuthServiceV2使用多个字段，但表中缺失

-- 添加email字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 添加登录失败追踪字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- 添加账户锁定时间字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- 添加最后登录时间字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 添加最后登录IP字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);

-- 为email字段创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
ON users(email) 
WHERE email IS NOT NULL;

-- 添加email验证约束（确保格式正确）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_email_format') THEN
    ALTER TABLE users 
    ADD CONSTRAINT chk_users_email_format 
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}$');
  END IF;
END $$;

