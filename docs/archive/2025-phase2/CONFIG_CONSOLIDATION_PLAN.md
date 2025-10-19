# 配置统一整合方案

## 🎯 目标
将所有 Redis、PostgreSQL 和其他服务配置统一到根目录的 `.env` 文件中，消除配置不一致和重复。

## 📊 当前配置问题分析

### 1. **配置文件分散**
- ❌ `backend/.env.example` - 后端专用配置模板
- ❌ `.env.example` - 根目录配置模板
- ❌ `backend/src/__tests__/setup.ts` - 测试环境硬编码配置
- ❌ `config/config.jsonc` - 部分配置使用环境变量占位符

### 2. **Redis 配置不一致**
| 位置 | 主机 | 端口 | 说明 |
|------|------|------|------|
| `backend/.env.example` | localhost | 3019 | ❌ 非标准端口 |
| `.env.example` | localhost | 6379 | ✅ 标准端口 |
| `backend/src/__tests__/setup.ts` | 171.43.138.237 | 7788 | ❌ 测试环境硬编码 |
| `backend/src/index.ts` | process.env | 3019 | ❌ 默认值不一致 |

### 3. **PostgreSQL 配置不一致**
| 位置 | 主机 | 端口 | 数据库 | 说明 |
|------|------|------|--------|------|
| `.env.example` | localhost | 5432 | llmchat | ✅ 开发环境 |
| `backend/src/__tests__/setup.ts` | 171.43.138.237 | 5443 | zkteco_test | ❌ 测试硬编码 |
| `backend/src/utils/db.ts` | localhost | 5432 | postgres | ⚠️ 默认值 |
| Memory记录 | 106.63.8.99 | 5432 | product | ❌ 旧配置 |

### 4. **配置加载逻辑混乱**
- `backend/src/utils/db.ts` - 直接读取环境变量 + 配置文件后备
- `backend/src/utils/appConfig.ts` - 从 config.jsonc 加载并替换环境变量
- `backend/src/index.ts` - 直接使用环境变量
- `backend/src/__tests__/setup.ts` - 硬编码测试配置

## ✅ 统一配置方案

### 配置优先级
```
1. 根目录 .env 文件（开发/生产环境）
2. 环境变量（CI/CD 环境）
3. 合理的默认值（仅用于开发环境）
```

### 统一的 .env 配置结构

```env
# ========================================
# 应用基础配置
# ========================================
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# ========================================
# PostgreSQL 数据库配置（统一）
# ========================================
# 开发环境 - 本地数据库
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=123456
DB_NAME=llmchat
DB_SSL=false

# 数据库连接字符串（自动生成，可选）
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# ========================================
# Redis 配置（统一）
# ========================================
# 开发环境 - 本地 Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=llmchat:queue:

# Redis 连接池配置
REDIS_MAX_CONNECTIONS=100
REDIS_MIN_CONNECTIONS=20
REDIS_ACQUIRE_TIMEOUT_MS=10000

# Redis 连接字符串（自动生成，可选）
REDIS_URL=redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}

# ========================================
# 测试环境配置（使用独立前缀）
# ========================================
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=postgres
TEST_DB_PASSWORD=123456
TEST_DB_NAME=llmchat_test
TEST_DB_SSL=false

TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6379
TEST_REDIS_PASSWORD=
TEST_REDIS_DB=1
```

## 🔧 需要修改的文件

### 1. 创建统一的 `.env` 文件
- ✅ 合并 `backend/.env.example` 和 `.env.example`
- ✅ 标准化 Redis 端口为 6379
- ✅ 标准化 PostgreSQL 配置
- ✅ 添加测试环境专用配置

### 2. 更新测试配置
**文件**: `backend/src/__tests__/setup.ts`
```typescript
// ❌ 删除硬编码配置
// process.env.DB_HOST = '171.43.138.237';

// ✅ 使用统一配置
process.env.DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'llmchat_test';
```

### 3. 更新数据库初始化
**文件**: `backend/src/utils/db.ts`
```typescript
// 统一默认值
const rawPg: PostgresConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '123456',
  database: process.env.DB_NAME ?? 'llmchat',
  ssl: process.env.DB_SSL === 'true'
};
```

### 4. 更新 Redis 配置
**文件**: `backend/src/index.ts`
```typescript
redis: {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'), // 统一为 6379
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'llmchat:queue:'
}
```

### 5. 删除冗余配置文件
- ❌ 删除 `backend/.env.example`（内容已合并到根目录）
- ✅ 保留 `.env.example` 作为唯一模板
- ✅ 更新 `config/config.jsonc` 使用环境变量占位符

## 📋 执行步骤

### Step 1: 创建统一的 .env.example
```bash
# 在根目录创建完整的配置模板
```

### Step 2: 更新代码中的默认值
```bash
# 更新所有使用配置的文件
- backend/src/utils/db.ts
- backend/src/index.ts
- backend/src/__tests__/setup.ts
- backend/src/services/QueueManager.ts
```

### Step 3: 清理旧配置
```bash
# 删除或标记为废弃
- backend/.env.example -> 合并到根目录
- 硬编码的 IP 地址 -> 使用环境变量
```

### Step 4: 验证配置
```bash
# 运行测试验证配置正确
npm test
npm run backend:test
```

## 🎉 预期效果

### 配置统一
- ✅ 所有配置从根目录 `.env` 读取
- ✅ 没有硬编码的 IP 地址和端口
- ✅ 测试环境使用独立配置
- ✅ 合理的默认值适配本地开发

### 可维护性提升
- ✅ 单一配置源，易于管理
- ✅ 环境变量优先级清晰
- ✅ 配置文档完善
- ✅ 测试和生产配置隔离

### 开发体验改善
- ✅ 开箱即用的本地开发配置
- ✅ 清晰的配置说明和示例
- ✅ 易于切换不同环境
- ✅ 配置错误容易排查

## 🚨 注意事项

1. **向后兼容**：保留配置文件后备机制，避免破坏现有部署
2. **安全性**：确保 `.env` 文件在 `.gitignore` 中
3. **文档更新**：更新 README 和部署文档
4. **团队通知**：通知团队成员更新本地配置
5. **CI/CD 适配**：确保 CI/CD 环境变量正确设置

