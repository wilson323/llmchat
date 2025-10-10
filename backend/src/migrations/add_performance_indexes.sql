-- 性能优化索引
-- 针对聊天和会话表的查询模式优化

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

-- 性能监控索引（如果存在performance_data表）
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_data_timestamp
-- ON performance_data(timestamp DESC);

-- 分析表统计信息以优化查询计划
ANALYZE chat_sessions;
ANALYZE chat_messages;
ANALYZE audit_logs;
ANALYZE agent_configs;
ANALYZE users;