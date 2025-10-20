# 环境配置检查清单

## ⚠️ 必需配置（启动前必须填写）

在启动后端服务之前，请确保 `.env` 文件中的以下配置已正确填写：

### 1. 数据库配置

```ini
# 🗄️ PostgreSQL数据库
DB_HOST=171.43.138.237
DB_PORT=5443
DB_USER=postgres
DB_PASSWORD=?????              # ⚠️ 请填写真实密码
DB_NAME=llmchat
DB_SSL=false
```

**验证方法**：
```bash
# Windows PowerShell
Test-NetConnection -ComputerName 171.43.138.237 -Port 5443
```

### 2. JWT认证配置

```ini
# 🔑 JWT密钥（至少64字符）
JWT_SECRET=?????              # ⚠️ 请生成强密钥
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

**生成强密钥**（PowerShell）：
```powershell
# 生成64字符随机密钥
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### 3. 端口配置

```ini
# 🖥️ 应用端口
PORT=3005                     # 后端端口
FRONTEND_URL=http://localhost:3004  # 前端地址
```

## ✅ 可选配置（可以暂时使用默认值）

### Redis缓存（可选）

```ini
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

**如果没有Redis**：系统会降级运行，不影响核心功能。

### FastGPT智能体（可选）

```ini
FASTGPT_APP_ID_1=your_app_id_here
FASTGPT_API_KEY_1=fastgpt-your_api_key_here
FASTGPT_ENDPOINT_1=http://your-fastgpt-server:3000/api/v1/chat/completions
```

**如果没有FastGPT**：可以先使用系统内置的智能体配置。

## 🔍 配置验证步骤

### 步骤1：检查.env文件存在性

```powershell
# 检查.env是否存在
Test-Path .env

# 如果不存在，从模板创建
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}
```

### 步骤2：验证必需配置

```powershell
# 检查关键配置
Get-Content .env | Select-String "DB_PASSWORD|JWT_SECRET"

# 确保不是占位符
# ❌ 错误：DB_PASSWORD=your_secure_password_here
# ✅ 正确：DB_PASSWORD=实际的数据库密码
```

### 步骤3：测试数据库连接

```powershell
# 启动后端（会自动验证数据库）
cd backend
pnpm run dev

# 预期输出：
# ✓ 环境变量已加载
# ✓ 所有必需环境变量已就绪
# 📦 初始化数据库连接...
# ✅ 数据库连接成功
# 🚀 服务器启动成功
```

## 🚨 常见问题

### 问题1：数据库连接失败

**错误信息**：
```
Error: connect ECONNREFUSED 171.43.138.237:5443
```

**解决方案**：
1. 检查数据库服务器是否可访问
2. 验证防火墙规则
3. 确认密码正确

### 问题2：JWT密钥过短

**错误信息**：
```
Warning: JWT_SECRET length is less than 64 characters
```

**解决方案**：
使用上面的PowerShell命令生成64+字符的强密钥

### 问题3：环境变量未加载

**错误信息**：
```
✗ 缺少必需的环境变量: DB_PASSWORD
```

**解决方案**：
1. 确认.env文件在项目根目录
2. 检查.env文件格式（UTF-8编码，无BOM）
3. 重启服务器

## 📋 配置完成确认

在启动服务器之前，确认以下所有项：

- [ ] .env文件已创建（从.env.example复制）
- [ ] DB_PASSWORD已填写真实密码
- [ ] JWT_SECRET已生成强密钥（64+字符）
- [ ] 数据库服务器可访问（端口5443开放）
- [ ] PORT配置正确（默认3005）
- [ ] FRONTEND_URL配置正确（http://localhost:3004）
- [ ] .env文件已添加到.gitignore（防止泄露）

## 🎯 下一步

配置完成后，执行：

```powershell
# 安装依赖（如果还没有）
pnpm install

# 启动后端开发服务器
pnpm run backend:dev

# 在另一个终端启动前端
pnpm run frontend:dev
```

---

**创建时间**：2025-10-20
**文档版本**：v1.0
**状态**：✅ 可直接使用

