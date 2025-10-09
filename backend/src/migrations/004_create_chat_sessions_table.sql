-- UP
-- 会话元数据表 (仅存储会话引用,不存储消息内容)
-- 实际消息内容由第三方平台 (FastGPT/Dify) 管理
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  title TEXT,
  user_id TEXT,
  -- 第三方平台的会话ID (如 FastGPT 的 chatId, Dify 的 conversation_id)
  external_session_id TEXT,
  provider TEXT NOT NULL,  -- fastgpt, dify, openai, anthropic
  -- 会话元数据 (不包含消息内容)
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_external ON chat_sessions(external_session_id, provider);

COMMENT ON TABLE chat_sessions IS '会话元数据表 - 仅存储会话引用,具体消息内容由第三方智能体平台管理';
COMMENT ON COLUMN chat_sessions.external_session_id IS '第三方平台的会话ID,用于关联外部会话';
COMMENT ON COLUMN chat_sessions.provider IS '第三方平台类型: fastgpt, dify, openai, anthropic';

-- DOWN
DROP INDEX IF EXISTS idx_chat_sessions_external;
DROP INDEX IF EXISTS idx_chat_sessions_created_at;
DROP INDEX IF EXISTS idx_chat_sessions_user_id;
DROP INDEX IF EXISTS idx_chat_sessions_agent_id;
DROP TABLE IF EXISTS chat_sessions;

