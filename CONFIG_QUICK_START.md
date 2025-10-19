# 配置统一快速开始指南

## 🚀 一键配置统一

### Step 1: 运行配置统一脚本

```powershell
# 在项目根目录运行
.\consolidate-config.ps1
```

这个脚本会自动：
- ✅ 备份现有 `.env` 文件
- ✅ 从 `.env.example` 创建新的 `.env`
- ✅ 标记废弃的配置文件

### Step 2: 编辑 .env 文件

打开根目录的 `.env` 文件，确认以下关键配置：

```env
# ========================================
# PostgreSQL 配置（必需）
# ========================================
DB_HOST=localhost          # ✅ 本地开发使用 localhost
DB_PORT=5432              # ✅ 标准 PostgreSQL 端口
DB_USER=postgres          # ✅ 默认用户
DB_PASSWORD=123456        # ⚠️  请修改为你的密码
DB_NAME=llmchat           # ✅ 项目数据库名称

# ========================================
# Redis 配置（必需）
# ========================================
REDIS_HOST=localhost       # ✅ 本地开发使用 localhost
REDIS_PORT=6379           # ✅ 标准 Redis 端口（已从3019统一）
REDIS_PASSWORD=           # 本地开发通常不需要密码
REDIS_DB=0                # ✅ 使用 DB 0

# ========================================
# JWT 配置（必需）
# ========================================
JWT_SECRET=your_super_secure_jwt_secret_key_here_minimum_64_characters_long
# ⚠️  生产环境必须修改为强密钥（至少64字符）

# ========================================
# FastGPT 智能体配置（可选）
# ========================================
# 如果使用 FastGPT，请配置以下信息
# FASTGPT_ENDPOINT_1=http://your-server:3000/api/v1/chat/completions
# FASTGPT_API_KEY_1=your_api_key
```

### Step 3: 验证配置

```bash
# 安装依赖（如果还没有）
pnpm install

# 运行测试验证配置
npm test

# 如果测试通过，启动开发服务器
npm run dev
```

## 📊 配置统一完成标志

当你看到以下情况时，说明配置统一成功：

✅ 根目录有 `.env` 文件
✅ Redis 端口统一为 6379（不是 3019）
✅ PostgreSQL 使用 llmchat 数据库（不是 postgres）
✅ 测试环境使用独立配置（TEST_ 前缀）
✅ 没有硬编码的远程服务器地址（171.43.138.237）

## 🔧 常见问题

### Q: 如果我的 PostgreSQL 密码不是 123456？

A: 在 `.env` 文件中修改 `DB_PASSWORD`:
```env
DB_PASSWORD=your_actual_password
```

### Q: 如果我需要连接远程 Redis？

A: 在 `.env` 文件中修改 Redis 配置:
```env
REDIS_HOST=your.redis.server.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### Q: 测试环境如何配置？

A: 使用 `TEST_` 前缀的环境变量:
```env
# 测试环境独立配置
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=llmchat_test
TEST_REDIS_DB=1
```

### Q: 如何验证配置是否正确？

A: 运行以下命令:
```bash
# 1. 检查数据库连接
npm run backend:test -- src/__tests__/utils/db.test.ts

# 2. 检查 Redis 连接
npm run backend:dev
# 看到 "✅ Redis连接池已初始化" 说明配置正确

# 3. 运行完整测试
npm test
```

## 📚 详细文档

- [完整配置报告](./docs/CONFIG_CONSOLIDATION_COMPLETE.md)
- [配置统一方案](./docs/CONFIG_CONSOLIDATION_PLAN.md)
- [.env.example 模板](./.env.example)

## 🎉 完成！

配置统一后，你的开发环境将更加规范和易于管理。所有配置都在一个地方，清晰明了！

