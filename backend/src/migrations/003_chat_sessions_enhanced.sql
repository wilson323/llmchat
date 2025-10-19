-- 增强版聊天会话表
-- 创建时间: 2025-10-16
-- 功能: 支持会话CRUD、全文搜索、统计信息

-- 创建聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  agent_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '新对话',
  
  -- 会话数据（JSONB格式）
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- 统计信息
  message_count INT DEFAULT 0,
  token_usage INT DEFAULT 0,
  avg_response_time FLOAT DEFAULT 0,
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP,
  
  -- 全文搜索支持
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(messages::text, ''))
  ) STORED
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions_enhanced(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON chat_sessions_enhanced(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON chat_sessions_enhanced(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON chat_sessions_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_sessions_search USING GIN (search_vector);

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_chat_sessions_enhanced_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_sessions_enhanced_timestamp
BEFORE UPDATE ON chat_sessions_enhanced
FOR EACH ROW
EXECUTE FUNCTION update_chat_sessions_enhanced_timestamp();

-- 注释说明
COMMENT ON TABLE chat_sessions_enhanced IS '增强版聊天会话表，支持全文搜索和统计';
COMMENT ON COLUMN chat_sessions_enhanced.messages IS '会话消息（JSONB数组）';
COMMENT ON COLUMN chat_sessions_enhanced.search_vector IS '全文搜索向量（自动生成）';
COMMENT ON COLUMN chat_sessions_enhanced.status IS '会话状态：active=活跃，archived=归档，deleted=已删除';

