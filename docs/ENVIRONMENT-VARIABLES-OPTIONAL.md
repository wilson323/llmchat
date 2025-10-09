# 可选环境变量配置指南

## 📋 概述

以下环境变量是**可选的**，未配置时系统会自动降级或跳过相关功能，不影响核心功能运行。

## 🤖 智能体相关（可选）

### FastGPT 第3个智能体
```bash
# backend/.env
FASTGPT_APP_ID_3=your_app_id_here
FASTGPT_API_KEY_3=your_api_key_here
```

**用途**: 如果你有多个FastGPT应用，可以配置第3个智能体。
**未配置影响**: 该智能体不会在前端显示，不影响其他智能体。

### 阿里云 DashScope（通义千问）
```bash
# backend/.env
DASHSCOPE_API_KEY=your_dashscope_api_key_here
```

**用途**: 启用CAD编辑智能体（基于通义千问）。
**未配置影响**: CAD智能体不可用，不影响其他智能体。

## 💾 Redis 缓存（可选）

```bash
# backend/.env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # 可选
```

**用途**: 
- 多实例部署时共享会话状态
- 提升性能（缓存智能体配置、会话数据）

**未配置影响**: 
- ✅ 系统自动使用内存模式
- ✅ 单实例部署完全正常
- ⚠️ 多实例部署时会话不共享

## 📊 监控告警（可选）

### Sentry 错误追踪
```bash
# backend/.env
SENTRY_ENABLED=true
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=production
```

**未配置影响**: 错误仅记录到本地日志文件。

## 🔍 当前系统状态

### 已配置的必需变量 ✅
- ✅ DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- ✅ FASTGPT_APP_ID, FASTGPT_API_KEY (主智能体)
- ✅ JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

### 未配置的可选变量 ⚠️
- ⚠️ FASTGPT_APP_ID_3, FASTGPT_API_KEY_3
- ⚠️ DASHSCOPE_API_KEY
- ⚠️ REDIS_HOST, REDIS_PORT

## 💡 建议

### 开发环境
- **不需要配置**可选变量
- 使用默认的内存模式即可
- 专注于核心功能开发

### 生产环境
- **建议配置** Redis（多实例部署）
- **建议配置** Sentry（错误追踪）
- **按需配置** 额外的智能体

## 🚀 快速验证

检查当前配置状态：
```bash
# 查看后端日志
Get-Content backend/log/app-2025-10-05.log -Tail 50 | Select-String -Pattern "warn|Missing"
```

测试API接口：
```bash
# 健康检查
Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing

# 获取可用智能体列表（自动过滤未配置的）
Invoke-WebRequest -Uri "http://localhost:3001/api/agents" -UseBasicParsing
```

## 📞 获取API密钥

### FastGPT
1. 访问 https://fastgpt.in/
2. 创建应用
3. 复制 App ID 和 API Key

### 阿里云 DashScope
1. 访问 https://dashscope.aliyun.com/
2. 开通服务
3. 创建 API Key

### Redis
```bash
# Docker 快速启动
docker run -d --name redis -p 6379:6379 redis:alpine

# 或使用 Windows Redis
# 下载: https://github.com/tporadowski/redis/releases
```

## ✅ 总结

**当前系统状态**: 完全正常 ✅
- 后端服务运行正常
- 数据库连接成功
- 核心智能体可用
- 所有测试通过

**警告信息**: 可以安全忽略 ⚠️
- 仅影响可选功能
- 不影响核心业务
- 系统自动降级处理
