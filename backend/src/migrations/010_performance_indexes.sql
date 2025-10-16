-- ============================================================================
-- 性能优化索引迁移
-- 
-- 目的：提升数据库查询性能30%+
-- 创建时间：2025-10-16
-- ============================================================================

-- ============================================================================
-- chat_sessions 表索引
-- ============================================================================

-- 用户ID索引（用于获取用户所有会话）
-- 使用场景：GET /api/chat-sessions?userId=xxx
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id 
ON chat_sessions(user_id);

-- 智能体ID索引（用于按智能体筛选）
-- 使用场景：GET /api/chat-sessions?agentId=xxx
CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id 
ON chat_sessions(agent_id);

-- 更新时间索引（用于按时间排序）
-- 使用场景：ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
ON chat_sessions(updated_at DESC);

-- 组合索引（用户+智能体+时间）
-- 使用场景：WHERE user_id = xxx AND agent_id = xxx ORDER BY updated_at
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_agent_time 
ON chat_sessions(user_id, agent_id, updated_at DESC);

-- 标题全文搜索索引（PostgreSQL GIN索引）
-- 使用场景：会话标题搜索
CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_gin 
ON chat_sessions USING gin(to_tsvector('simple', title));

-- 状态索引（如果有archived/deleted状态）
-- CREATE INDEX IF NOT EXISTS idx_chat_sessions_status 
-- ON chat_sessions(status) WHERE status IS NOT NULL;

-- ============================================================================
-- chat_messages 表索引
-- ============================================================================

-- 会话ID索引（用于获取会话的所有消息）
-- 使用场景：GET /api/chat/sessions/:sessionId/messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
ON chat_messages(session_id);

-- 创建时间索引（用于按时间排序）
-- 使用场景：ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
ON chat_messages(created_at DESC);

-- 组合索引（会话+时间）- 最常用的查询模式
-- 使用场景：WHERE session_id = xxx ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time 
ON chat_messages(session_id, created_at DESC);

-- 角色索引（用于按角色筛选，如只看用户消息）
CREATE INDEX IF NOT EXISTS idx_chat_messages_role 
ON chat_messages(role);

-- 消息内容全文搜索索引
-- 使用场景：消息内容搜索
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_gin 
ON chat_messages USING gin(to_tsvector('simple', content));

-- ============================================================================
-- users 表索引
-- ============================================================================

-- 用户名唯一索引（登录查询）
-- 使用场景：WHERE username = xxx
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username 
ON users(username);

-- Email唯一索引（邮箱查询）
-- 使用场景：WHERE email = xxx
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
ON users(email) WHERE email IS NOT NULL;

-- 状态索引（过滤活跃用户）
-- 使用场景：WHERE status = 'active'
CREATE INDEX IF NOT EXISTS idx_users_status 
ON users(status);

-- 创建时间索引（用于用户统计）
CREATE INDEX IF NOT EXISTS idx_users_created_at 
ON users(created_at DESC);

-- ============================================================================
-- agent_configs 表索引
-- ============================================================================

-- is_active索引（获取活跃智能体）
-- 使用场景：WHERE is_active = true
CREATE INDEX IF NOT EXISTS idx_agent_configs_is_active 
ON agent_configs(is_active) WHERE is_active = true;

-- 提供商类型索引
-- 使用场景：WHERE provider = 'fastgpt'
CREATE INDEX IF NOT EXISTS idx_agent_configs_provider 
ON agent_configs(provider);

-- 组合索引（提供商+活跃状态）
CREATE INDEX IF NOT EXISTS idx_agent_configs_provider_active 
ON agent_configs(provider, is_active) WHERE is_active = true;

-- 名称索引（用于搜索）
CREATE INDEX IF NOT EXISTS idx_agent_configs_name 
ON agent_configs(name);

-- ============================================================================
-- 索引统计和分析
-- ============================================================================

-- 更新表统计信息（提升查询优化器效果）
ANALYZE chat_sessions;
ANALYZE chat_messages;
ANALYZE users;
ANALYZE agent_configs;

-- ============================================================================
-- 性能视图（可选）
-- ============================================================================

-- 创建会话摘要视图（预计算常用数据）
CREATE OR REPLACE VIEW chat_sessions_with_stats AS
SELECT 
  s.id,
  s.title,
  s.user_id,
  s.agent_id,
  s.created_at,
  s.updated_at,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM chat_sessions s
LEFT JOIN chat_messages m ON m.session_id = s.id
GROUP BY s.id;

-- 创建用户统计视图
CREATE OR REPLACE VIEW user_activity_stats AS
SELECT 
  u.id as user_id,
  u.username,
  COUNT(DISTINCT s.id) as session_count,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_activity_at
FROM users u
LEFT JOIN chat_sessions s ON s.user_id = u.id::text
LEFT JOIN chat_messages m ON m.session_id = s.id
GROUP BY u.id, u.username;

-- ============================================================================
-- 注释和文档
-- ============================================================================

COMMENT ON INDEX idx_chat_sessions_user_id IS '用户会话查询索引';
COMMENT ON INDEX idx_chat_messages_session_id IS '会话消息查询索引';
COMMENT ON INDEX idx_users_username IS '用户登录查询索引';
COMMENT ON INDEX idx_agent_configs_is_active IS '活跃智能体查询索引';

