# LLMChat API错误代码规范 v1.0.0

## 错误格式
```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "认证令牌无效"
  }
}
```

## 错误代码

### 认证（AUTH_*）
- AUTH_INVALID_CREDENTIALS (401): 邮箱或密码错误
- AUTH_INVALID_TOKEN (401): 令牌无效
- AUTH_TOKEN_EXPIRED (401): 令牌过期
- AUTH_INSUFFICIENT_PERMISSIONS (403): 权限不足

### 智能体（AGENT_*）
- AGENT_NOT_FOUND (404): 智能体不存在
- AGENT_UNAVAILABLE (503): 智能体不可用
- AGENT_CONFIG_INVALID (422): 配置无效

### 聊天（CHAT_*）
- CHAT_SESSION_NOT_FOUND (404): 会话不存在
- CHAT_MESSAGE_INVALID (400): 消息无效
- CHAT_STREAM_ERROR (500): 流式错误

### 通用（COMMON_*）
- COMMON_VALIDATION_ERROR (400): 参数验证失败
- COMMON_RATE_LIMIT (429): 请求过频
- COMMON_INTERNAL_ERROR (500): 内部错误
- COMMON_DATABASE_ERROR (500): 数据库错误

共36个错误代码。
