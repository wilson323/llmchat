-- FastGPT智能体初始化SQL脚本
-- 使用方法：psql -U postgres -d llmchat -f scripts/init-fastgpt-agents.sql

-- 1. 清理示例智能体（可选）
-- DELETE FROM agent_configs WHERE provider = 'custom' AND is_active = false;

-- 2. 插入FastGPT智能体配置
-- 注意：需要先在 backend/.env 中配置相应的环境变量

-- 智能体 #1: 知识库助手
INSERT INTO agent_configs (
  id, 
  name, 
  description, 
  provider, 
  endpoint, 
  api_key, 
  app_id,
  model, 
  is_active,
  capabilities,
  features,
  rate_limit,
  created_at,
  updated_at
) VALUES (
  'fastgpt-knowledge-assistant',
  '知识库助手',
  '基于企业知识库的智能问答助手，支持文档检索和多轮对话',
  'fastgpt',
  'https://your-fastgpt-server.com/api/v1/chat/completions',
  'fastgpt-your-api-key-here',
  'your_24_hex_app_id_here',
  'gpt-3.5-turbo',
  true,
  '["chat", "knowledge-retrieval", "streaming"]'::jsonb,
  '{
    "supportsChatId": true,
    "supportsStream": true,
    "supportsDetail": true,
    "supportsFiles": true,
    "supportsImages": true,
    "streamingConfig": {
      "enabled": true,
      "endpoint": "same",
      "statusEvents": true,
      "flowNodeStatus": true
    }
  }'::jsonb,
  '{
    "requestsPerMinute": 60,
    "tokensPerMinute": 100000
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  endpoint = EXCLUDED.endpoint,
  api_key = EXCLUDED.api_key,
  app_id = EXCLUDED.app_id,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active,
  capabilities = EXCLUDED.capabilities,
  features = EXCLUDED.features,
  rate_limit = EXCLUDED.rate_limit,
  updated_at = NOW();

-- 智能体 #2: 客服助手
INSERT INTO agent_configs (
  id, 
  name, 
  description, 
  provider, 
  endpoint, 
  api_key, 
  app_id,
  model, 
  is_active,
  capabilities,
  features,
  rate_limit,
  created_at,
  updated_at
) VALUES (
  'fastgpt-customer-service',
  '智能客服',
  '7×24小时在线客服助手，支持常见问题解答和工单创建',
  'fastgpt',
  'https://your-fastgpt-server.com/api/v1/chat/completions',
  'fastgpt-your-api-key-here',
  'your_24_hex_app_id_here',
  'gpt-3.5-turbo',
  true,
  '["chat", "customer-service", "streaming"]'::jsonb,
  '{
    "supportsChatId": true,
    "supportsStream": true,
    "supportsDetail": true,
    "supportsFiles": true,
    "supportsImages": false,
    "streamingConfig": {
      "enabled": true,
      "endpoint": "same",
      "statusEvents": true,
      "flowNodeStatus": true
    }
  }'::jsonb,
  '{
    "requestsPerMinute": 120,
    "tokensPerMinute": 200000
  }'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  endpoint = EXCLUDED.endpoint,
  api_key = EXCLUDED.api_key,
  app_id = EXCLUDED.app_id,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active,
  capabilities = EXCLUDED.capabilities,
  features = EXCLUDED.features,
  rate_limit = EXCLUDED.rate_limit,
  updated_at = NOW();

-- 3. 验证插入结果
SELECT 
  id,
  name,
  provider,
  is_active,
  app_id,
  LENGTH(api_key) as api_key_length,
  created_at
FROM agent_configs
WHERE provider = 'fastgpt'
ORDER BY created_at;

-- 4. 显示所有智能体
SELECT 
  id,
  name,
  provider,
  is_active,
  CASE 
    WHEN provider = 'fastgpt' THEN app_id
    ELSE NULL
  END as app_id
FROM agent_configs
ORDER BY is_active DESC, created_at;

