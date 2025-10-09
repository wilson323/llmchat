-- ========================================
-- 数据库性能索引优化
-- 创建时间: 2025-10-03
-- 目的: 优化查询性能，降低数据库负载
-- ========================================

-- 1. agent_configs 表索引优化
-- 用于快速查询活跃的智能体
CREATE INDEX IF NOT EXISTS idx_agent_configs_provider_active 
  ON agent_configs(provider, is_active) 
  WHERE is_active = true;

-- 用于按更新时间排序
CREATE INDEX IF NOT EXISTS idx_agent_configs_updated 
  ON agent_configs(updated_at DESC);

-- 2. chat_sessions 表索引优化
-- 用于用户会话查询（最常用）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated 
  ON chat_sessions(user_id, updated_at DESC);

-- 用于按智能体查询会话
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent 
  ON chat_sessions(agent_id, created_at DESC);

-- 用于外部会话ID查询（FastGPT/Dify）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_external 
  ON chat_sessions(external_session_id, provider) 
  WHERE external_session_id IS NOT NULL;

-- 3. chat_messages 表索引优化
-- 用于按会话查询消息（最常用，已存在但确保）
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created 
  ON chat_messages(session_id, created_at ASC);

-- 用于按角色过滤消息
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_role 
  ON chat_messages(session_id, role, created_at ASC);

-- 4. users 表索引优化
-- 用户名查询（登录场景）
CREATE INDEX IF NOT EXISTS idx_users_username 
  ON users(username) 
  WHERE status = 'active';

-- 用于按角色查询用户
CREATE INDEX IF NOT EXISTS idx_users_role 
  ON users(role, status);

-- 5. audit_logs 表索引优化（如果存在）
-- 按时间范围查询审计日志
CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
  ON audit_logs(created_at DESC);

-- 按用户查询审计日志
CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
  ON audit_logs(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- 按操作类型查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
  ON audit_logs(action, created_at DESC);

-- 6. 分析统计查询优化
-- 按日期统计会话数（BRIN索引，适合时间序列）
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_brin 
  ON chat_sessions USING BRIN(created_at);

-- 7. 外键性能优化（确保外键有索引）
-- 如果 chat_messages 的 session_id 外键没有索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_fk 
  ON chat_messages(session_id);

-- 如果 chat_sessions 的 agent_id 外键没有索引
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_fk 
  ON chat_sessions(agent_id);

-- ========================================
-- 索引维护建议
-- ========================================

-- 定期重建索引（生产环境每月执行）
-- REINDEX TABLE chat_messages;
-- REINDEX TABLE chat_sessions;

-- 分析表统计信息（每天执行）
-- ANALYZE chat_messages;
-- ANALYZE chat_sessions;
-- ANALYZE agent_configs;

-- 清理死行（定期执行）
-- VACUUM ANALYZE chat_messages;
-- VACUUM ANALYZE chat_sessions;

-- ========================================
-- 查询性能验证
-- ========================================

-- 验证会话查询性能（应使用索引扫描）
EXPLAIN ANALYZE 
SELECT * FROM chat_sessions 
WHERE user_id = 'test_user' 
ORDER BY updated_at DESC 
LIMIT 20;

-- 验证消息查询性能
EXPLAIN ANALYZE 
SELECT * FROM chat_messages 
WHERE session_id = 'test_session' 
ORDER BY created_at ASC;

-- 验证智能体查询性能
EXPLAIN ANALYZE 
SELECT * FROM agent_configs 
WHERE is_active = true AND provider = 'fastgpt';

-- ========================================
-- 索引大小监控
-- ========================================

-- 查看所有索引的大小
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- 查看索引使用情况
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
