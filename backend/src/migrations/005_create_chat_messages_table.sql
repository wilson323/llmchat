-- UP
-- 聊天消息表 (仅用于自研智能体,如语音电话、产品预览等)
-- 第三方智能体 (FastGPT/Dify) 的消息内容由其平台管理,不存储在此表
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  -- 消息元数据 (可包含文件、图片、音频等信息)
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

COMMENT ON TABLE chat_messages IS '聊天消息表 - 仅用于自研智能体(语音电话、产品预览等),第三方智能体的消息由其平台管理';
COMMENT ON COLUMN chat_messages.metadata IS '消息元数据,可包含文件引用、图片URL、音频时长等';

-- DOWN
DROP INDEX IF EXISTS idx_chat_messages_role;
DROP INDEX IF EXISTS idx_chat_messages_session_created;
DROP TABLE IF EXISTS chat_messages;

