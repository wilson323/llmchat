# 启动脚本使用说明

本目录包含用于启动 LLMChat 开发环境的脚本。

## 📁 可用脚本

### 1. 完整启动脚本（推荐）

**Linux/Mac:**
```bash
./start-dev.sh
```

**Windows:**
```bash
start-dev.bat
```

**功能特性：**
- ✅ 自动检查 Node.js 和 npm 版本
- ✅ 自动检查并创建配置文件（.env, agents.json）
- ✅ 自动检查并安装依赖
- ✅ 彩色输出和友好的错误提示
- ✅ 优雅的进程管理（Ctrl+C 安全退出）

### 2. 快速启动脚本

**Linux/Mac:**
```bash
./quick-start.sh
```

**Windows:**
```bash
quick-start.bat
```

**功能特性：**
- ⚡ 极简版本，直接启动服务
- 💡 适合已配置好环境的快速启动

### 3. 使用 npm 脚本（最简单）

```bash
npm run dev
```

这是最简单的启动方式，直接使用项目配置的 npm 脚本。

## 🔧 首次使用配置

### 步骤 1: 安装依赖

```bash
npm install
```

### 步骤 2: 配置后端环境

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env

# 编辑配置（必须）
nano backend/.env  # 或使用任何文本编辑器
```

**必需配置项：**
- `PORT`: 后端端口（默认 3001）
- `FRONTEND_URL`: 前端地址（开发环境: http://localhost:3000）
- 其他可选配置见 `.env.example` 注释

### 步骤 3: 配置智能体（可选）

```bash
# 复制智能体配置模板
cp config/agents.example.json config/agents.json

# 编辑智能体配置
nano config/agents.json
```

**注意：** 如果不配置，会使用默认配置。

### 步骤 4: 启动服务

选择以下任一方式启动：

```bash
# 方式 1: 使用完整启动脚本（推荐新手）
./start-dev.sh          # Linux/Mac
start-dev.bat           # Windows

# 方式 2: 使用快速启动脚本
./quick-start.sh        # Linux/Mac
quick-start.bat         # Windows

# 方式 3: 使用 npm 脚本（最简单）
npm run dev
```

## 🌐 访问地址

启动成功后访问：

- **前端应用**: http://localhost:3000
- **后端 API**: http://localhost:3001
- **健康检查**: http://localhost:3001/health

## 🛑 停止服务

在终端按 `Ctrl+C` 即可停止所有服务。

## ❓ 常见问题

### 1. 端口被占用

**错误信息：**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**解决方案：**

**Linux/Mac:**
```bash
# 查找占用端口的进程
lsof -i :3001
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

**Windows:**
```bash
# 查找占用端口的进程
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# 杀死进程
taskkill /PID <PID> /F
```

### 2. 依赖安装失败

**解决方案：**
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
```

### 3. 配置文件错误

**错误信息：**
```
Cannot find module 'backend/.env'
```

**解决方案：**
```bash
# 确保配置文件存在
ls backend/.env
ls config/agents.json

# 如果不存在，从模板创建
cp backend/.env.example backend/.env
cp config/agents.example.json config/agents.json
```

### 4. 权限错误（Linux/Mac）

**错误信息：**
```
Permission denied: ./start-dev.sh
```

**解决方案：**
```bash
# 添加执行权限
chmod +x start-dev.sh
chmod +x quick-start.sh
```

## 🔍 调试模式

如果需要查看详细日志：

```bash
# 设置日志级别为 debug
# 在 backend/.env 中设置
LOG_LEVEL=debug

# 或临时设置
LOG_LEVEL=debug npm run dev
```

## 📚 更多信息

- **项目文档**: 查看根目录 `README.md`
- **API 文档**: 查看 `doc/` 目录
- **配置说明**: 查看 `CLAUDE.md`

## 🤝 需要帮助？

如果遇到问题：
1. 查看控制台错误信息
2. 检查配置文件是否正确
3. 确认依赖已正确安装
4. 查看项目 Issues: https://github.com/wilson323/llmchat/issues