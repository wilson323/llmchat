# 🔐 LLMChat 项目安全配置指南

## 概述

本文档提供了 LLMChat 项目的安全配置最佳实践，确保敏感信息得到妥善保护。

## 🚨 安全风险警示

### 已修复的安全问题

1. **API 密钥泄露** - ✅ 已修复
   - 原问题：`config/agents.json` 文件包含真实的 API 密钥
   - 修复方案：使用环境变量占位符 `${VARIABLE_NAME}` 替换真实密钥
   - 影响范围：所有智能体配置

2. **数据库密码明文存储** - ✅ 已修复
   - 原问题：`config/config.jsonc` 文件包含明文数据库密码
   - 修复方案：使用环境变量占位符 `${DB_PASSWORD}` 等
   - 影响范围：数据库连接配置、Redis 连接配置

3. **配置文件安全** - ✅ 已修复
   - 原问题：`.env.example` 缺少安全配置说明
   - 修复方案：添加完整的安全配置模板和说明，包括数据库、Redis、Token 等所有敏感配置

4. **环境变量验证** - ✅ 已加强
   - 实现：`envHelper.ts` 工具提供环境变量解析、验证和安全检查
   - 功能：自动替换占位符、检测未解析的占位符、验证必需变量

## 🔑 环境变量配置

### 必需配置

创建 `.env` 文件（基于 `.env.example`）：

```bash
cp backend/.env.example backend/.env
```

### FastGPT 智能体配置

```bash
# 智能体 1 配置
FASTGPT_AGENT_ID_1=your_real_agent_id
FASTGPT_APP_ID_1=your_real_app_id
FASTGPT_AGENT_NAME_1=熵犇犇售后服务助手
FASTGPT_ENDPOINT_1=http://your-fastgpt-server:3000/api/v1/chat/completions
FASTGPT_API_KEY_1=your_real_api_key_here
FASTGPT_MODEL_1=FastAI-4k
FASTGPT_RATE_LIMIT_RPM_1=60
FASTGPT_RATE_LIMIT_TPM_1=40000

# 智能体 2 配置
FASTGPT_AGENT_ID_2=your_real_agent_id_2
FASTGPT_APP_ID_2=your_real_app_id_2
FASTGPT_AGENT_NAME_2=配单智能应用
FASTGPT_ENDPOINT_2=http://your-fastgpt-server:3000/api/v1/chat/completions
FASTGPT_API_KEY_2=your_real_api_key_here_2
FASTGPT_MODEL_2=FastAI-4k
FASTGPT_RATE_LIMIT_RPM_2=60
FASTGPT_RATE_LIMIT_TPM_2=40000

# 智能体 3 配置
FASTGPT_AGENT_ID_3=your_real_agent_id_3
FASTGPT_APP_ID_3=your_real_app_id_3
FASTGPT_AGENT_NAME_3=需求分析
FASTGPT_ENDPOINT_3=http://your-fastgpt-server:3000/api/v1/chat/completions
FASTGPT_API_KEY_3=your_real_api_key_here_3
FASTGPT_MODEL_3=FastAI-4k
FASTGPT_RATE_LIMIT_RPM_3=60
FASTGPT_RATE_LIMIT_TPM_3=40000
```

### 数据库配置（PostgreSQL）

```bash
# PostgreSQL 连接配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_secure_db_password_here
DB_NAME=llmchat

# 连接池配置（可选）
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_IDLE_TIMEOUT=10000
```

### Redis 配置（Token 管理）

```bash
# Redis 连接配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
REDIS_DB=0

# Redis 连接选项（可选）
REDIS_MAX_RETRIES=10
REDIS_RETRY_DELAY=1000
```

### 安全认证配置

```bash
# Token 配置
TOKEN_SECRET=your_super_secure_token_secret_key_here_minimum_32_characters
TOKEN_TTL=86400
REFRESH_TOKEN_TTL=2592000

# JWT 令牌配置（如使用 JWT）
JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_32_characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# API 访问控制
API_ACCESS_TOKEN=your_api_access_token_here
API_KEY_HEADER_NAME=x-api-key
```

## 🛡️ 安全最佳实践

### 1. 密钥管理

**使用强密码：**
- API 密钥长度至少 32 字符
- 包含大小写字母、数字、特殊字符
- 避免使用常见词汇或重复模式

**密钥轮换：**
- 定期更换 API 密钥（建议每 90 天）
- 更换密钥时确保服务不中断
- 保留旧密钥直到确认新密钥正常工作

### 2. 环境隔离

**不同环境使用不同配置：**
- 开发环境：使用测试密钥
- 测试环境：使用专用测试密钥
- 生产环境：使用正式密钥

**示例环境配置：**
```bash
# 开发环境 (.env.development)
NODE_ENV=development
FASTGPT_API_KEY_1=dev_api_key_for_testing_only

# 生产环境 (.env.production)
NODE_ENV=production
FASTGPT_API_KEY_1=production_secure_api_key
```

### 3. 文件权限

```bash
# 设置 .env 文件权限
chmod 600 backend/.env

# 确保 config 目录权限正确
chmod 644 config/agents.json
```

### 4. Git 安全

**确保 .gitignore 包含：**
```
# 环境变量文件
backend/.env
backend/.env.*
!.env.example

# 日志文件
logs/
*.log

# 临时文件
tmp/
temp/

# 依赖目录
node_modules/
```

## 🔍 验证配置

### 1. 检查环境变量

```bash
# 进入后端目录
cd backend

# 加载环境变量并验证
source .env
echo "FastGPT API Key 1: $FASTGPT_API_KEY_1"
echo "JWT Secret: $JWT_SECRET"
```

### 2. 测试配置加载

```bash
# 启动开发服务器
npm run backend:dev

# 检查日志输出，确认：
# - 智能体配置正常加载
# - 没有未解析的环境变量占位符警告
# - 所有服务正常启动
```

### 3. API 测试

```bash
# 测试智能体列表端点
curl http://localhost:3001/api/agents

# 检查返回的智能体配置，确保：
# - endpoint 是完整的 URL
# - apiKey 不包含 ${} 占位符
# - 所有字段正确填充
```

### 4. 环境变量占位符检查

```bash
# 检查配置文件中是否有未解析的环境变量占位符
grep -r '\${' config/

# 确认输出中所有占位符都对应存在的环境变量
# 例如：如果看到 ${FASTGPT_API_KEY_1}，确保 .env 中定义了 FASTGPT_API_KEY_1

# 检查日志中是否有环境变量警告
tail -f backend/log/app.log | grep "环境变量未定义"
```

## 🚨 故障排除

### 常见问题

**1. 环境变量未解析**

错误信息：
```
智能体配置包含未解析的环境变量占位符: endpoint = ${FASTGPT_ENDPOINT_1}
```

解决方案：
```bash
# 检查 .env 文件是否存在
ls -la backend/.env

# 检查环境变量是否正确设置
cat backend/.env | grep FASTGPT_ENDPOINT_1

# 重启服务
npm run backend:dev
```

**2. API 密钥无效**

错误信息：
```
智能体配置缺少有效的 appId（需要 24 位十六进制字符串）
```

解决方案：
```bash
# 验证 FastGPT appId 格式
echo "$FASTGPT_APP_ID_1" | grep -E '^[a-fA-F0-9]{24}$'

# 如果格式不正确，联系 FastGPT 管理员获取正确的 appId
```

**3. 配置文件权限问题**

错误信息：
```
权限被拒绝: 无法读取配置文件
```

解决方案：
```bash
# 检查文件权限
ls -la backend/.env
ls -la config/agents.json

# 修复权限
chmod 600 backend/.env
chmod 644 config/agents.json
```

## 🔧 高级安全配置

### 1. 使用密钥管理服务

**推荐使用：**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Cloud Secret Manager

**示例集成（AWS Secrets Manager）：**
```javascript
// 在服务启动时从 AWS Secrets Manager 获取密钥
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function loadSecrets() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'llmchat/secrets'
  }).promise();

  const secrets = JSON.parse(secret.SecretString);

  // 设置环境变量
  process.env.FASTGPT_API_KEY_1 = secrets.FASTGPT_API_KEY_1;
  process.env.JWT_SECRET = secrets.JWT_SECRET;
  // ... 其他密钥
}
```

### 2. 网络安全配置

**生产环境推荐配置：**
```bash
# 强制 HTTPS
FORCE_HTTPS=true

# 安全头配置
HELMET_ENABLED=true
CSP_ENABLED=true

# CORS 严格配置
CORS_ORIGIN=https://your-domain.com

# IP 白名单
IP_WHITELIST=127.0.0.1,::1,your.server.ip
```

### 3. 监控和日志

**安全日志配置：**
```bash
# 启用安全日志
SECURITY_LOG_ENABLED=true
SECURITY_LOG_FILE=logs/security.log

# 启用审计日志
AUDIT_LOG_ENABLED=true
AUDIT_LOG_FILE=logs/audit.log
```

## 📋 安全检查清单

部署前请确认：

- [ ] 所有环境变量已正确设置
- [ ] `.env` 文件权限为 600
- [ ] `.env` 已添加到 `.gitignore`
- [ ] 没有真实的 API 密钥提交到版本控制
- [ ] 生产环境使用 HTTPS
- [ ] 防火墙规则正确配置
- [ ] 密钥轮换策略已制定
- [ ] 日志监控已配置
- [ ] 备份策略已制定
- [ ] 安全扫描已通过

## 📞 安全问题报告

如果发现安全问题，请：

1. 立即停止受影响的服务
2. 检查日志确定影响范围
3. 修复安全问题
4. 更新配置和密钥
5. 进行安全测试
6. 部署修复后的版本

**联系方式：**
- 安全团队邮箱：security@yourcompany.com
- 紧急联系：[电话号码]

---

**⚠️ 重要提醒：安全是一个持续的过程，不是一次性的配置。请定期审查和更新安全配置。**