# 环境变量配置指南

## 概述

本文档详细说明了LLMChat项目所需的所有环境变量配置。环境变量分为**必需配置**和**可选配置**两类。

---

## 配置文件位置

- **模板文件**: `backend/ENV_TEMPLATE.txt`
- **实际配置**: `backend/.env` (需手动创建，不提交到Git)

---

## 快速开始

```bash
# 1. 复制模板文件
cp backend/ENV_TEMPLATE.txt backend/.env

# 2. 编辑 backend/.env，填写必需的配置值

# 3. 验证配置（可选）
npm run validate:env
```

---

## 必需配置 ✅

这些配置项是系统运行的最低要求，必须配置：

### 1. 数据库配置

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_db_password_here
DB_NAME=llmchat
DB_SSL=false
```

**说明**：
- PostgreSQL数据库连接信息
- 生产环境建议启用SSL (`DB_SSL=true`)

### 2. 安全配置

```bash
TOKEN_SECRET=your_token_secret_change_in_production_min_32_chars
SESSION_SECRET=your_session_secret_change_in_production
```

**说明**：
- `TOKEN_SECRET`: JWT Token签名密钥，至少32字符
- `SESSION_SECRET`: Session加密密钥
- ⚠️ **生产环境必须修改默认值！**

### 3. 基础服务配置

```bash
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**说明**：
- `NODE_ENV`: 运行环境 (development/production/test)
- `PORT`: 后端服务端口
- `FRONTEND_URL`: 前端URL，用于CORS配置

---

## 可选配置 ⚙️

这些配置项是可选的，未配置时系统会使用默认值或降级模式：

### 1. Redis配置 (可选)

```bash
# 未配置时系统自动使用内存存储
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

**说明**：
- 用于Token存储和Rate Limiting
- **单实例部署**：可不配置，使用内存模式
- **多实例部署**：必须配置Redis实现共享存储

### 2. FastGPT智能体配置 (可选)

```bash
# 智能体1 (主要对话)
FASTGPT_API_KEY_1=fastgpt-xxxxx
FASTGPT_APP_ID_1=xxxxx

# 智能体2 (备用)
FASTGPT_API_KEY_2=fastgpt-xxxxx
FASTGPT_APP_ID_2=xxxxx

# 智能体3 (可选)
FASTGPT_API_KEY_3=fastgpt-xxxxx
FASTGPT_APP_ID_3=xxxxx
```

**说明**：
- 每个智能体需要配对的 `API_KEY` 和 `APP_ID`
- 未配置的智能体会被自动过滤，不影响已配置的智能体
- 至少配置一个智能体才能使用聊天功能

### 3. 其他AI提供商 (可选)

#### OpenAI

```bash
OPENAI_API_KEY=sk-xxxxx
OPENAI_ENDPOINT=https://api.openai.com/v1
```

#### Anthropic (Claude)

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
ANTHROPIC_ENDPOINT=https://api.anthropic.com
```

#### 阿里云DashScope (CAD智能体)

```bash
DASHSCOPE_API_KEY=sk-xxxxx
DASHSCOPE_ENDPOINT=https://dashscope.aliyuncs.com/api/v1
```

**说明**：
- 根据实际使用的AI提供商配置
- 未配置的提供商对应的智能体将不可用

### 4. 速率限制 (可选)

```bash
RATE_LIMIT_CHAT_PER_MINUTE=30
RATE_LIMIT_ADMIN_PER_MINUTE=100
```

**说明**：
- 默认值已设置，通常无需修改
- 可根据实际负载调整

### 5. 文件上传 (可选)

```bash
MAX_UPLOAD_SIZE_MB=10
ALLOWED_FILE_TYPES=image/png,image/jpeg,image/jpg,image/gif,application/pdf
```

### 6. 日志级别 (可选)

```bash
LOG_LEVEL=info  # error/warn/info/debug
```

### 7. 监控与可观测性 (可选)

```bash
# APM服务
APM_ENDPOINT=http://your-apm-server:8200
APM_SERVICE_NAME=llmchat-backend

# Sentry错误追踪
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### 8. 开发调试 (可选)

```bash
DEBUG=true
VERBOSE=true
```

---

## 生产环境额外配置 🚀

生产环境部署时建议配置以下项：

### HTTPS配置

```bash
USE_HTTPS=true
SSL_KEY_PATH=/path/to/private.key
SSL_CERT_PATH=/path/to/certificate.crt
```

### 反向代理

```bash
TRUST_PROXY=true
```

**说明**：
- 如果使用Nginx/Apache反向代理，必须启用
- 确保正确获取客户端真实IP

---

## 配置验证

### 自动验证

```bash
npm run validate:env
```

### 手动检查

1. **数据库连接**：
   ```bash
   npm run backend:dev
   # 查看日志中是否有数据库连接成功提示
   ```

2. **智能体加载**：
   ```bash
   # 访问 http://localhost:3001/api/agents
   # 检查返回的智能体列表
   ```

3. **环境变量替换**：
   - 查看日志中的环境变量替换提示
   - 确认所有 `${VAR_NAME}` 占位符都被正确替换

---

## 常见问题 ❓

### Q1: 为什么有些智能体没有加载？

**A**: 检查以下几点：
1. 对应的 `API_KEY` 和 `APP_ID` 是否都已配置
2. 环境变量名称是否正确（区分大小写）
3. 查看日志中的警告信息：`环境变量未定义，保留占位符`

### Q2: Redis未配置会影响功能吗？

**A**: 不会影响核心功能：
- ✅ 单实例部署：自动使用内存存储，功能完全正常
- ⚠️ 多实例部署：必须配置Redis，否则Token和限流无法共享

### Q3: 如何知道哪些配置是必需的？

**A**: 启动时查看日志：
- ✅ `All required environment variables validated` - 必需配置齐全
- ⚠️ `Missing recommended environment variables` - 可选配置缺失（不影响运行）
- ❌ `Missing required environment variables` - 必需配置缺失（无法启动）

### Q4: 生产环境如何管理敏感配置？

**A**: 建议使用以下方式之一：
1. **环境变量注入**：通过Docker/K8s的环境变量注入
2. **密钥管理服务**：AWS Secrets Manager、Azure Key Vault等
3. **配置中心**：Consul、etcd等
4. ⚠️ **禁止**：将 `.env` 文件提交到Git

---

## 配置示例

### 开发环境最小配置

```bash
# backend/.env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=llmchat
DB_SSL=false

# 安全
TOKEN_SECRET=dev_secret_key_min_32_characters_long
SESSION_SECRET=dev_session_secret

# 至少一个智能体
FASTGPT_API_KEY_1=fastgpt-xxxxx
FASTGPT_APP_ID_1=xxxxx
```

### 生产环境完整配置

```bash
# backend/.env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# 数据库
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_USER=llmchat_user
DB_PASSWORD=strong_password_here
DB_NAME=llmchat_prod
DB_SSL=true

# 安全（使用强密钥）
TOKEN_SECRET=prod_token_secret_at_least_32_chars_random_string
SESSION_SECRET=prod_session_secret_random_string

# Redis（生产环境推荐）
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0

# 智能体
FASTGPT_API_KEY_1=fastgpt-prod-key-1
FASTGPT_APP_ID_1=prod-app-id-1
FASTGPT_API_KEY_2=fastgpt-prod-key-2
FASTGPT_APP_ID_2=prod-app-id-2

# 监控
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
APM_ENDPOINT=https://apm.example.com
APM_SERVICE_NAME=llmchat-backend-prod

# HTTPS
USE_HTTPS=true
SSL_KEY_PATH=/etc/ssl/private/llmchat.key
SSL_CERT_PATH=/etc/ssl/certs/llmchat.crt
TRUST_PROXY=true

# 日志
LOG_LEVEL=warn
```

---

## 更新日志

| 日期 | 版本 | 变更说明 |
|------|------|----------|
| 2025-10-05 | 1.1 | 添加DashScope配置说明，明确Redis为可选配置 |
| 2025-10-04 | 1.0 | 初始版本 |

---

## 相关文档

- [快速开始指南](../README.md)
- [部署文档](./deployment-guide.md)
- [故障排查](./TROUBLESHOOTING-WINDOWS.md)
- [安全指南](../SECURITY_GUIDE.md)
