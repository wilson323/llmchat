# 🚀 后端启动指南

## ⚠️ 重要提醒

**后端代码已修复完成，但需要启动后端服务！**

前端看到404错误是因为：
- ✅ 前端正常运行（localhost:3004）
- ❌ 后端未启动（localhost:3005）

## 🔧 启动前必需配置

### 步骤1：配置数据库密码

打开 `.env` 文件，找到第40行：

```ini
DB_PASSWORD=your_secure_password_here   # ← 修改这里
```

修改为：
```ini
DB_PASSWORD=实际的数据库密码
```

### 步骤2：配置JWT密钥

**生成强密钥**（复制这个命令到PowerShell执行）：

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**复制生成的密钥**到 `.env` 文件第90行：

```ini
JWT_SECRET=这里粘贴刚才生成的64字符密钥
```

## 🚀 启动后端服务

### 方法1：开发模式（推荐）

在**新的PowerShell终端**中执行：

```powershell
cd F:\ss\aa\sssss\llmchat
pnpm run backend:dev
```

**预期输出**：
```
✓ 环境变量已加载
📦 初始化数据库连接...
✅ 数据库连接成功
🤖 初始化智能体配置服务...
✅ 智能体配置服务已就绪
🚀 服务器启动成功
📍 端口: 3005
🌍 环境: development
```

### 方法2：使用pnpm dev（同时启动前后端）

```powershell
# 停止当前的前端服务（Ctrl+C）
# 然后执行：
pnpm run dev
```

这会同时启动：
- 后端：localhost:3005
- 前端：localhost:3004

## ✅ 验证后端已启动

在浏览器访问或用curl测试：

```powershell
# 方法1：浏览器访问
# http://localhost:3005/health

# 方法2：PowerShell测试
Invoke-WebRequest -Uri http://localhost:3005/health | Select-Object StatusCode,Content
```

**预期返回**：
```json
{
  "status": "ok",
  "message": "LLMChat Backend",
  "timestamp": "2025-10-20T...",
  "environment": "development"
}
```

## 🔍 故障排除

### 问题1：端口被占用

**错误信息**：
```
Error: listen EADDRINUSE: address already in use :::3005
```

**解决方法**：
```powershell
# 查找占用3005端口的进程
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue | Select-Object OwningProcess

# 停止进程（替换PID）
Stop-Process -Id PID号 -Force
```

### 问题2：数据库连接失败

**错误信息**：
```
Error: connect ECONNREFUSED 171.43.138.237:5443
```

**检查步骤**：
```powershell
# 1. 测试网络连接
Test-NetConnection -ComputerName 171.43.138.237 -Port 5443

# 2. 检查密码是否正确
Get-Content .env | Select-String "DB_PASSWORD"

# 3. 确认不是占位符
```

### 问题3：环境变量未加载

**错误信息**：
```
✗ 缺少必需的环境变量: DB_PASSWORD
```

**解决方法**：
```powershell
# 1. 确认.env在根目录
Test-Path .env

# 2. 检查.env编码（应该是UTF-8无BOM）
Get-Content .env -Encoding UTF8 | Select-Object -First 5

# 3. 重启后端服务
```

## 📋 快速启动检查清单

在启动后端之前，确认：

- [ ] .env文件存在（项目根目录）
- [ ] DB_PASSWORD已修改（不是占位符）
- [ ] JWT_SECRET已生成并配置
- [ ] 数据库服务器可访问（171.43.138.237:5443）
- [ ] 3005端口未被占用
- [ ] 已安装所有依赖（pnpm install）

## 🎯 成功标志

当后端成功启动后：

1. **终端输出**：
```
🚀 服务器启动成功
📍 端口: 3005
```

2. **前端登录不再404**：
   - 访问 http://localhost:3004
   - 输入用户名密码
   - 应该显示"登录成功"而不是404错误

3. **健康检查通过**：
   - http://localhost:3005/health 返回200

---

**创建时间**：2025-10-20
**状态**：等待启动后端
**下一步**：按照本文档配置并启动后端服务

