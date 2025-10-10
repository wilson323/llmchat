-- 性能优化索引应用脚本
-- 使用方式: psql -d your_database -f apply-performance-indexes.sql

-- 显示当前时间
SELECT 'Starting performance index optimization at: ' || NOW() as status;

-- 聊天会话表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_agent_updated
ON chat_sessions(user_id, agent_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_created_at
ON chat_sessions(created_at DESC);

-- 聊天消息表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_created
ON chat_messages(session_id, created_at ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_role
ON chat_messages(session_id, role);

-- 审计日志表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created
ON audit_logs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_created
ON audit_logs(action, created_at DESC);

-- 智能体配置表优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_configs_provider_updated
ON agent_configs(provider, updated_at DESC);

-- 用户表复合索引（用于管理员查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status_created
ON users(role, status, created_at DESC);

-- 日志表时间序列索引优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logs_timestamp_level
ON logs(timestamp DESC, level) WHERE timestamp > NOW() - INTERVAL '30 days';

-- 创建分区表索引（如果存在）
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_data_timestamp
-- ON performance_data(timestamp DESC);

-- 创建部分索引以优化常用查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_active
ON chat_sessions(user_id, agent_id, updated_at DESC)
WHERE updated_at > NOW() - INTERVAL '7 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_recent
ON audit_logs(created_at DESC)
WHERE created_at > NOW() - INTERVAL '30 days';

-- 分析表统计信息以优化查询计划
ANALYZE chat_sessions;
ANALYZE chat_messages;
ANALYZE audit_logs;
ANALYZE agent_configs;
ANALYZE users;
ANALYZE logs;

-- 显示索引创建结果
SELECT 'Performance index optimization completed at: ' || NOW() as status;

-- 检查索引是否创建成功
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('chat_sessions', 'chat_messages', 'audit_logs', 'agent_configs', 'users', 'logs')
    AND indexname LIKE 'idx_%_performance%'
ORDER BY tablename, indexname;