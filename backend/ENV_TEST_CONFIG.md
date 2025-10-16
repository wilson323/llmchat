# 测试环境配置说明

## ⚠️ E2E测试环境变量配置

为了避免E2E测试中的速率限制（429）和CSRF保护（403）问题，需要在 `backend/.env` 中添加以下配置：

### 方式1：修改现有.env文件（推荐）
在运行E2E测试前，临时修改 `backend/.env`：

```env
# ===== 测试环境专用配置 =====
RATE_LIMIT_MAX_REQUESTS=1000    # ✅ 提高速率限制（默认100 → 1000）
CSRF_ENABLED=false              # ✅ 禁用CSRF保护（测试环境）
LOG_LEVEL=warn                  # 减少日志输出
```

### 方式2：使用专用测试环境文件
创建 `backend/.env.test` 文件（复制.env内容并修改上述配置），然后：

```bash
# 运行测试时使用test环境
NODE_ENV=test pnpm run test:e2e
```

---

## 📝 完整测试环境配置模板

```env
# ===================================
# 测试环境配置 (.env.test)
# ===================================

# === 数据库配置 ===
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=123456
DB_POOL_MIN=5
DB_POOL_MAX=20

# === Redis配置 ===
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # 本地Redis无密码
REDIS_DB=0

# === JWT配置 ===
TOKEN_SECRET=test-secret-key-minimum-32-characters-long-for-testing
JWT_EXPIRES_IN=1h
JWT_ALGORITHM=HS256
REFRESH_TOKEN_TTL=7d

# === 速率限制配置（测试环境放宽）===
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000     # ✅ 提高限制避免429
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# === 安全配置 ===
CSRF_ENABLED=false               # ✅ 测试环境禁用
HELMET_ENABLED=false             # 测试环境简化

# === 日志配置 ===
LOG_LEVEL=warn                   # 测试时减少输出
LOG_TO_FILE=false                # 测试时不写文件

# === 功能开关（测试环境简化）===
MEMORY_OPTIMIZATION_ENABLED=false
VISUALIZATION_ENABLED=false
QUEUE_ENABLED=false
SENTRY_ENABLED=false

# === 环境标识 ===
NODE_ENV=test
PORT=3001
FRONTEND_URL=http://localhost:3000
```

---

## 🔄 使用方法

### 方法1：手动切换（简单）
```bash
# 1. 复制.env为.env.production备份
cp backend/.env backend/.env.production

# 2. 应用测试配置
# 手动编辑backend/.env，添加：
# RATE_LIMIT_MAX_REQUESTS=1000
# CSRF_ENABLED=false

# 3. 运行E2E测试
pnpm run test:e2e

# 4. 恢复生产配置
cp backend/.env.production backend/.env
```

### 方法2：环境文件切换（推荐）
```bash
# 1. 创建.env.test文件（使用上述模板）

# 2. 修改package.json测试命令
"test:e2e": "cross-env NODE_ENV=test dotenv -e backend/.env.test -- playwright test"

# 3. 运行测试
pnpm run test:e2e
```

---

## ⚡ 快速修复命令

### Windows PowerShell
```powershell
# 临时禁用速率限制和CSRF，运行E2E测试
$env:RATE_LIMIT_MAX_REQUESTS=1000
$env:CSRF_ENABLED="false"
pnpm run test:e2e
```

### Windows CMD
```cmd
set RATE_LIMIT_MAX_REQUESTS=1000
set CSRF_ENABLED=false
pnpm run test:e2e
```

---

## ✅ 预期效果

### 修复前
- 20个测试因429失败
- 3个测试因403失败

### 修复后
- 所有429错误应消失
- CSRF相关403错误应解决
- E2E通过率预计提升25-30%

---

**使用建议**: 测试环境禁用CSRF和提高速率限制是合理的做法。生产环境务必恢复这些安全配置。

