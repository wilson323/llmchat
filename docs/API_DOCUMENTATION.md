# LLMChat API 文档规范

> **企业级API文档标准 - Spec-Kit合规版本**
> **文档版本**: v1.0.0
> **最后更新**: 2025-10-18
> **API版本**: v2.0
> **基准URL**: `https://api.llmchat.com/v2`

## 📋 目录

- [1. API概述](#1-api概述)
- [2. 认证机制](#2-认证机制)
- [3. 通用规范](#3-通用规范)
- [4. 错误处理](#4-错误处理)
- [5. 核心API](#5-核心api)
- [6. WebSocket API](#6-websocket-api)
- [7. 速率限制](#7-速率限制)
- [8. SDK和工具](#8-sdk和工具)
- [9. 开发指南](#9-开发指南)

## API概述

LLMChat提供了一套完整的RESTful API，支持多AI提供商的智能体管理和聊天功能。

### 基础信息

- **基础URL**: `http://localhost:3001/api` (开发环境)
- **协议**: HTTP/HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **API版本**: v1

### 支持的AI提供商

- **FastGPT**: 主要智能体提供商
- **OpenAI**: GPT模型支持
- **Anthropic**: Claude模型支持
- **Dify**: 可视化AI工作流平台
- **自定义**: 支持自定义API端点

## 认证机制

### JWT Token认证

```http
Authorization: Bearer <your_jwt_token>
```

### 获取Token

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

#### 响应示例
```json
{
  "code": "SUCCESS",
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

### Token刷新

```http
POST /api/auth/refresh
Content-Type: application/json
Authorization: Bearer <refresh_token>

{
  "refreshToken": "your_refresh_token"
}
```

## 通用响应格式

### 成功响应

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    // 响应数据
  },
  "timestamp": "2025-10-18T10:30:00.000Z"
}
```

### 分页响应

```json
{
  "code": "SUCCESS",
  "message": "获取成功",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "timestamp": "2025-10-18T10:30:00.000Z"
}
```

## 错误处理

### 错误响应格式

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述",
  "error": {
    "type": "ValidationError",
    "details": "具体错误信息"
  },
  "timestamp": "2025-10-18T10:30:00.000Z"
}
```

### 常见错误码

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| SUCCESS | 200 | 操作成功 |
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| UNAUTHORIZED | 401 | 未授权访问 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| RATE_LIMITED | 429 | 请求频率超限 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |

## API端点详情

### 认证相关

#### 用户注册
```http
POST /api/auth/register
```

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "用户名"
}
```

**响应**:
```json
{
  "code": "SUCCESS",
  "message": "注册成功",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名",
      "createdAt": "2025-10-18T10:30:00.000Z"
    }
  }
}
```

#### 用户登录
```http
POST /api/auth/login
```

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

#### 用户登出
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

#### 刷新Token
```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

### 智能体管理

#### 获取智能体列表
```http
GET /api/agents
Authorization: Bearer <token>
```

**查询参数**:
- `page` (number): 页码，默认1
- `limit` (number): 每页数量，默认20
- `category` (string): 分类过滤
- `provider` (string): 提供商过滤

**响应示例**:
```json
{
  "code": "SUCCESS",
  "message": "获取成功",
  "data": {
    "items": [
      {
        "id": "agent_uuid",
        "name": "智能体名称",
        "description": "智能体描述",
        "category": "写作助手",
        "provider": "fastgpt",
        "avatar": "avatar_url",
        "status": "active",
        "capabilities": ["text_generation", "code_completion"],
        "config": {
          "model": "gpt-3.5-turbo",
          "temperature": 0.7,
          "maxTokens": 2000
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

#### 获取智能体详情
```http
GET /api/agents/{agentId}
Authorization: Bearer <token>
```

#### 更新智能体配置
```http
PUT /api/agents/{agentId}
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "name": "更新后的名称",
  "description": "更新后的描述",
  "config": {
    "model": "gpt-4",
    "temperature": 0.8,
    "maxTokens": 4000
  }
}
```

#### 检查智能体状态
```http
GET /api/agents/{agentId}/status
Authorization: Bearer <token>
```

#### 重新加载智能体配置
```http
POST /api/agents/reload
Authorization: Bearer <token>
```

### 聊天接口

#### 发送聊天消息（流式）
```http
POST /api/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "agentId": "agent_uuid",
  "messages": [
    {
      "role": "user",
      "content": "你好，请介绍一下你自己"
    }
  ],
  "stream": true,
  "sessionId": "session_uuid",
  "config": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

**流式响应**:
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: chunk
data: {"type":"text","content":"你好"}

event: chunk
data: {"type":"text","content":"！我是"}

event: end
data: {"type":"end","sessionId":"session_uuid","messageId":"msg_uuid"}
```

#### 发送聊天消息（非流式）
```http
POST /api/chat/completions
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "agentId": "agent_uuid",
  "messages": [
    {
      "role": "user",
      "content": "你好，请介绍一下你自己"
    }
  ],
  "stream": false,
  "sessionId": "session_uuid"
}
```

**响应**:
```json
{
  "code": "SUCCESS",
  "message": "聊天完成",
  "data": {
    "id": "message_uuid",
    "sessionId": "session_uuid",
    "message": {
      "role": "assistant",
      "content": "你好！我是一个AI助手..."
    },
    "usage": {
      "promptTokens": 25,
      "completionTokens": 150,
      "totalTokens": 175
    },
    "createdAt": "2025-10-18T10:30:00.000Z"
  }
}
```

#### 获取聊天历史
```http
GET /api/chat/sessions/{sessionId}/history
Authorization: Bearer <token>
```

**查询参数**:
- `page` (number): 页码，默认1
- `limit` (number): 每页数量，默认50
- `before` (string): 获取指定消息之前的历史

#### 保存聊天记录
```http
POST /api/chat/sessions/save
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "sessionId": "session_uuid",
  "title": "对话标题",
  "agentId": "agent_uuid",
  "messages": [
    {
      "role": "user",
      "content": "用户消息"
    },
    {
      "role": "assistant",
      "content": "AI回复"
    }
  ]
}
```

### 文件管理

#### 上传文件
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**表单数据**:
- `file` (File): 要上传的文件
- `type` (string): 文件类型 (image/document/cad)
- `description` (string): 文件描述

**响应**:
```json
{
  "code": "SUCCESS",
  "message": "上传成功",
  "data": {
    "id": "file_uuid",
    "filename": "example.pdf",
    "originalName": "原始文件名.pdf",
    "size": 1024000,
    "type": "document",
    "url": "/uploads/file_uuid.pdf",
    "uploadedAt": "2025-10-18T10:30:00.000Z"
  }
}
```

#### 获取文件信息
```http
GET /api/upload/{fileId}
Authorization: Bearer <token>
```

#### 删除文件
```http
DELETE /api/upload/{fileId}
Authorization: Bearer <token>
```

### CAD文件管理

#### 解析DXF文件
```http
POST /api/cad/parse
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**表单数据**:
- `file` (File): DXF文件

**响应**:
```json
{
  "code": "SUCCESS",
  "message": "解析成功",
  "data": {
    "entities": [
      {
        "type": "LINE",
        "startPoint": { "x": 0, "y": 0 },
        "endPoint": { "x": 100, "y": 0 },
        "layer": "0"
      }
    ],
    "layers": [
      {
        "name": "0",
        "color": 0,
        "visible": true
      }
    ],
    "bounds": {
      "minX": 0,
      "minY": 0,
      "maxX": 100,
      "maxY": 100
    }
  }
}
```

### 系统管理

#### 获取系统统计
```http
GET /api/admin/stats
Authorization: Bearer <token>
```

**响应**:
```json
{
  "code": "SUCCESS",
  "message": "获取成功",
  "data": {
    "users": {
      "total": 1000,
      "active": 800,
      "newToday": 50
    },
    "agents": {
      "total": 50,
      "active": 45,
      "categories": ["写作助手", "编程助手", "翻译助手"]
    },
    "chats": {
      "total": 10000,
      "today": 500,
      "averageLength": 25
    },
    "system": {
      "uptime": "72h 30m",
      "version": "1.0.0",
      "environment": "production"
    }
  }
}
```

#### 获取审计日志
```http
GET /api/admin/audit
Authorization: Bearer <token>
```

**查询参数**:
- `page` (number): 页码
- `limit` (number): 每页数量
- `userId` (string): 用户ID过滤
- `action` (string): 操作类型过滤
- `startDate` (string): 开始日期
- `endDate` (string): 结束日期

### 监控与健康检查

#### 健康检查
```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T10:30:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "queue": "running"
  },
  "version": "1.0.0"
}
```

#### 详细健康检查
```http
GET /health/detailed
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "connections": {
        "active": 2,
        "idle": 8,
        "total": 10
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2,
      "memory": {
        "used": "10MB",
        "total": "100MB"
      }
    },
    "queue": {
      "status": "healthy",
      "jobs": {
        "waiting": 0,
        "active": 2,
        "completed": 1000
      }
    }
  }
}
```

#### 系统指标
```http
GET /metrics
Authorization: Bearer <token>
```

## SDK和工具

### JavaScript/TypeScript SDK

```bash
npm install @llmchat/client-sdk
```

```typescript
import { LLMChatClient } from '@llmchat/client-sdk';

const client = new LLMChatClient({
  baseURL: 'http://localhost:3001/api',
  token: 'your_jwt_token'
});

// 发送聊天消息
const response = await client.chat.completions({
  agentId: 'agent_uuid',
  messages: [{ role: 'user', content: '你好' }],
  stream: true
});

// 流式处理
for await (const chunk of response) {
  console.log(chunk.content);
}
```

### Python SDK

```bash
pip install llmchat-client
```

```python
from llmchat import LLMChatClient

client = LLMChatClient(
    base_url='http://localhost:3001/api',
    token='your_jwt_token'
)

# 发送聊天消息
response = client.chat.completions(
    agent_id='agent_uuid',
    messages=[{'role': 'user', 'content': '你好'}],
    stream=True
)

# 流式处理
for chunk in response:
    print(chunk.content)
```

## API版本控制

### 版本策略

- 当前版本: v1
- 版本格式: `v{major}.{minor}`
- 向后兼容: 保持同一主版本内的向后兼容性
- 废弃通知: 提前3个月通知API废弃

### 版本指定

```http
# URL路径版本
GET /api/v1/agents

# Header版本
GET /api/agents
Accept: application/vnd.llmchat.v1+json
```

### 版本变更日志

#### v1.0.0 (当前版本)
- 初始版本发布
- 支持基本聊天功能
- 支持多AI提供商

#### 即将发布的v1.1.0
- 新增批量操作API
- 增强搜索功能
- 优化流式响应性能

## 请求限制

### 频率限制

- 默认限制: 每分钟1000次请求
- 认证用户: 每分钟2000次请求
- 企业用户: 每分钟5000次请求

### 文件上传限制

- 单文件大小: 最大10MB
- 支持格式:
  - 图片: jpg, jpeg, png, gif, webp
  - 文档: pdf, doc, docx, txt, md
  - CAD文件: dxf, dwg

### 内容限制

- 单次消息最大长度: 10000字符
- 聊天历史最大条数: 1000条
- 会话保留时间: 30天

## 安全说明

### 数据加密

- HTTPS传输加密
- 敏感数据存储加密
- Token签名验证

### 访问控制

- 基于角色的访问控制(RBAC)
- API密钥管理
- IP白名单支持

### 审计追踪

- 完整的API调用日志
- 用户操作审计
- 安全事件监控

## 联系支持

- API文档: https://docs.llmchat.com/api
- 技术支持: support@llmchat.com
- 问题反馈: https://github.com/llmchat/issues
- 社区讨论: https://community.llmchat.com

---

*最后更新时间: 2025-10-18*