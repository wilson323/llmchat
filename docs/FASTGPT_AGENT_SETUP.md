# FastGPT智能体配置指南

## 配置步骤

### 1. 准备环境变量

在 `backend/.env` 文件中添加FastGPT智能体配置：

```bash
# FastGPT智能体 #1 - 知识库助手
FASTGPT_AGENT_ID_1=fastgpt-knowledge-assistant
FASTGPT_APP_ID_1=your_24_hex_app_id_here
FASTGPT_AGENT_NAME_1=知识库助手
FASTGPT_AGENT_DESCRIPTION_1=基于企业知识库的智能问答助手
FASTGPT_ENDPOINT_1=https://your-fastgpt-server.com/api/v1/chat/completions
FASTGPT_API_KEY_1=fastgpt-your-api-key-here
FASTGPT_MODEL_1=gpt-3.5-turbo
FASTGPT_RATE_LIMIT_RPM_1=60
FASTGPT_RATE_LIMIT_TPM_1=100000

# FastGPT智能体 #2 - 客服助手
FASTGPT_AGENT_ID_2=fastgpt-customer-service
FASTGPT_APP_ID_2=your_24_hex_app_id_here
FASTGPT_AGENT_NAME_2=客服助手
FASTGPT_AGENT_DESCRIPTION_2=7×24小时在线客服智能助手
FASTGPT_ENDPOINT_2=https://your-fastgpt-server.com/api/v1/chat/completions
FASTGPT_API_KEY_2=fastgpt-your-api-key-here
FASTGPT_MODEL_2=gpt-3.5-turbo
FASTGPT_RATE_LIMIT_RPM_2=120
FASTGPT_RATE_LIMIT_TPM_2=200000
```

**重要提示**：
- `FASTGPT_APP_ID_X` 必须是24位十六进制字符串（FastGPT应用ID）
- `FASTGPT_AGENT_ID_X` 是本系统内的唯一标识，可以自定义
- `FASTGPT_API_KEY_X` 从FastGPT平台获取

### 2. 更新 config/agents.json

将 `config/agents.example.json` 中的配置复制到 `config/agents.json`：

```json
{
  "agents": [
    {
      "id": "${FASTGPT_AGENT_ID_1}",
      "appId": "${FASTGPT_APP_ID_1}",
      "name": "${FASTGPT_AGENT_NAME_1}",
      "description": "${FASTGPT_AGENT_DESCRIPTION_1}",
      "endpoint": "${FASTGPT_ENDPOINT_1}",
      "apiKey": "${FASTGPT_API_KEY_1}",
      "model": "${FASTGPT_MODEL_1}",
      "provider": "fastgpt",
      "isActive": true,
      "capabilities": ["chat", "knowledge-retrieval", "streaming"],
      "features": {
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
      },
      "rateLimit": {
        "requestsPerMinute": ${FASTGPT_RATE_LIMIT_RPM_1},
        "tokensPerMinute": ${FASTGPT_RATE_LIMIT_TPM_1}
      },
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 3. 重启服务并同步到数据库

```bash
# 停止服务
Ctrl+C

# 清空数据库中的旧配置（可选）
psql -U postgres -d llmchat -c "DELETE FROM agent_configs WHERE provider = 'custom';"

# 重新启动服务
npm run dev
```

服务启动后，系统会：
1. 检测到数据库中没有FastGPT智能体
2. 从 `config/agents.json` 读取配置
3. 替换环境变量占位符
4. 写入数据库

### 4. 验证配置

检查数据库中的智能体：

```sql
SELECT id, name, provider, is_active, app_id 
FROM agent_configs 
WHERE provider = 'fastgpt';
```

测试API：

```bash
curl http://localhost:3001/api/agents
```

## 通过API动态添加（方法2）

使用后台管理API添加智能体：

```bash
curl -X POST http://localhost:3001/api/admin/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "fastgpt-new-agent",
    "appId": "your_24_hex_app_id_here",
    "name": "新智能体",
    "description": "动态添加的FastGPT智能体",
    "endpoint": "https://your-fastgpt-server.com/api/v1/chat/completions",
    "apiKey": "fastgpt-your-api-key",
    "model": "gpt-3.5-turbo",
    "provider": "fastgpt",
    "isActive": true,
    "features": {
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
    }
  }'
```

## 常见问题

### Q1: 为什么环境变量显示未定义？

**A**: 现在已经优化为debug级别日志，对于未激活的示例智能体不会产生噪音。只有激活的智能体配置包含占位符时才会报错。

### Q2: 如何获取FastGPT的appId和apiKey？

**A**: 
1. 登录FastGPT平台
2. 创建或选择一个应用
3. 在应用设置中找到"API访问"
4. appId在URL中（24位十六进制）
5. apiKey需要生成新的API密钥

### Q3: 配置更新后如何热重载？

**A**: 调用重载API：

```bash
curl -X POST http://localhost:3001/api/agents/reload
```

或者在前端管理界面点击"重新加载配置"按钮。

## 配置验证

系统会自动验证：
- ✅ `appId` 必须是24位十六进制字符串
- ✅ `endpoint` 不能包含未解析的环境变量
- ✅ `apiKey` 不能为空
- ✅ `provider` 必须为 'fastgpt'
- ✅ 激活的智能体必须配置完整

## 安全提示

⚠️ **永远不要**将真实的API密钥提交到Git！

- `config/agents.json` 应该只包含占位符
- 真实密钥放在 `backend/.env`（已在 .gitignore 中）
- 部署时通过环境变量注入


