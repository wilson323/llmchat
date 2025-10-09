-- ====================================
-- 迁移007: 移除明文密码列
-- ====================================
-- 目的: 提升安全性，删除password_plain列
-- 影响: users表
-- 风险: 中等 (需确保password_hash已填充)
-- 回滚: 见007_remove_plain_password_down.sql
-- ====================================

-- 1. 检查是否所有用户都有加密密码
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE password_hash IS NULL OR password_hash = '' OR length(password_hash) < 60
  ) THEN
    RAISE EXCEPTION '部分用户缺少加密密码，迁移中止。请先运行密码迁移脚本。';
  END IF;
END $$;

-- 2. 备份明文密码列到临时表 (可选，用于紧急回滚)
CREATE TABLE IF NOT EXISTS users_password_backup_007 AS
SELECT id, username, password_plain, created_at
FROM users
WHERE password_plain IS NOT NULL;

COMMENT ON TABLE users_password_backup_007 IS '迁移007备份表，30天后可删除';

-- 3. 删除明文密码列
ALTER TABLE users DROP COLUMN IF EXISTS password_plain;

-- 4. 添加密码强度约束 (确保bcrypt散列长度)
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS password_hash_not_empty;

ALTER TABLE users 
  ADD CONSTRAINT password_hash_not_empty 
  CHECK (length(password_hash) >= 60);

-- 5. 添加密码更新时间戳 (可选，用于强制定期更换密码)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN users.password_updated_at IS '密码最后更新时间';

-- 6. 创建密码更新触发器 (自动更新时间戳)
CREATE OR REPLACE FUNCTION update_password_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_password_timestamp ON users;

CREATE TRIGGER trigger_update_password_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_password_timestamp();

-- 7. 记录迁移日志
INSERT INTO schema_migrations (version, description, executed_at)
VALUES (
  '007',
  'Remove plain password column and add password security enhancements',
  CURRENT_TIMESTAMP
)
ON CONFLICT (version) DO NOTHING;

-- 迁移完成
SELECT '✅ 迁移007完成: 已删除password_plain列，添加密码安全增强' AS status;

