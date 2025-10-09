-- ====================================
-- 迁移007回滚脚本
-- ====================================
-- 警告: 此脚本仅用于紧急回滚
-- 执行前请确认影响范围
-- ====================================

-- 1. 重新添加password_plain列
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- 2. 从备份表恢复数据 (如果备份表存在)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users_password_backup_007') THEN
    UPDATE users u
    SET password_plain = b.password_plain
    FROM users_password_backup_007 b
    WHERE u.id = b.id;
    
    RAISE NOTICE '✅ 已从备份表恢复password_plain数据';
  ELSE
    RAISE WARNING '⚠️  备份表不存在，无法恢复password_plain数据';
  END IF;
END $$;

-- 3. 删除密码强度约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS password_hash_not_empty;

-- 4. 删除密码更新时间戳列
ALTER TABLE users DROP COLUMN IF EXISTS password_updated_at;

-- 5. 删除触发器和函数
DROP TRIGGER IF EXISTS trigger_update_password_timestamp ON users;
DROP FUNCTION IF EXISTS update_password_timestamp();

-- 6. 删除迁移记录
DELETE FROM schema_migrations WHERE version = '007';

-- 回滚完成
SELECT '⚠️  迁移007已回滚: password_plain列已恢复' AS status;

