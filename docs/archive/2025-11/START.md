# 🚀 LLMChat 启动指南

快速启动 LLMChat 开发环境的完整指南。

## 📋 快速开始（3种方式）

### 方式 1: 使用启动脚本（推荐）✨

**Linux/Mac/WSL:**
```bash
./start-dev.sh
```

**Windows CMD/PowerShell:**
```bash
start-dev.bat
```

**特点：**
- ✅ 自动检查环境和依赖
- ✅ 自动创建配置文件
- ✅ 友好的错误提示
- ✅ 彩色输出界面

---

### 方式 2: 快速启动（最快）⚡

**Linux/Mac/WSL:**
```bash
./quick-start.sh
```

**Windows CMD/PowerShell:**
```bash
quick-start.bat
```

**特点：**
- ⚡ 极简启动，无额外检查
- 💡 适合熟悉项目的开发者

---

### 方式 3: 使用 npm 脚本（标准）📦

```bash
npm run dev
```

**特点：**
- 📦 标准 Node.js 项目启动方式
- 🔧 使用项目配置的 concurrently

---

## 🔧 首次配置（必须）

### 1️⃣ 安装依赖

```bash
npm install
```

这会自动安装根目录、前端和后端的所有依赖。

### 2️⃣ 配置后端环境变量

```bash
# 复制模板
cp backend/.env.example backend/.env

# 编辑配置
nano backend/.env  # 或使用 VS Code: code backend/.env
```

**必需配置项：**
```env
PORT=3001                              # 后端端口
NODE_ENV=development                   # 环境：development/production
FRONTEND_URL=http://localhost:3000     # 前端地址（开发环境）
AGENTS_CONFIG_PATH=../config/agents.json  # 智能体配置路径
LOG_LEVEL=debug                        # 日志级别：debug/info/warn/error
REQUEST_TIMEOUT=30000                  # 请求超时（毫秒）
```

**可选配置项：**
```env
# 速率限制
RATE_LIMIT_POINTS=100         # 每分钟请求数
RATE_LIMIT_DURATION=60        # 时间窗口（秒）
RATE_LIMIT_BLOCK_DURATION=60  # 阻止时长（秒）

# 阿里云图像生成 API（产品预览功能需要）
ALIYUN_IMAGE_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation
ALIYUN_IMAGE_API_KEY=your-api-key
ALIYUN_IMAGE_MODEL=wanx-stylepro-v1
```

### 3️⃣ 配置智能体（可选）

```bash
# 复制模板
cp config/agents.example.json config/agents.json

# 编辑配置
nano config/agents.json
```

**注意：** 如果不配置，会使用默认示例配置。

---

## 🌐 访问应用

启动成功后，在浏览器访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端应用** | http://localhost:3000 | React 应用界面 |
| **后端 API** | http://localhost:3001 | Express API 服务 |
| **健康检查** | http://localhost:3001/health | API 健康状态 |
| **智能体列表** | http://localhost:3001/api/agents | 获取智能体配置 |

---

## 🛑 停止服务

在终端按 **Ctrl+C** 即可安全停止所有服务。

---

## 🐛 故障排查

### ❌ 端口被占用

**错误信息：**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**解决方案：**

**Linux/Mac/WSL:**
```bash
# 查找并杀死占用端口的进程
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**Windows:**
```bash
# 查找占用端口的进程
netstat -ano | findstr :3001
netstat -ano | findstr :3000

# 杀死进程（替换 <PID> 为实际进程 ID）
taskkill /PID <PID> /F
```

---

### ❌ 依赖安装失败

**解决方案：**
```bash
# 1. 清除 npm 缓存
npm cache clean --force

# 2. 删除所有 node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# 3. 删除 package-lock.json（可选）
rm -f package-lock.json backend/package-lock.json frontend/package-lock.json

# 4. 重新安装
npm install
```

---

### ❌ 配置文件缺失

**错误信息：**
```
Error: Cannot find module 'backend/.env'
Error: AGENTS_CONFIG_PATH not found
```

**解决方案：**
```bash
# 检查文件是否存在
ls -l backend/.env config/agents.json

# 从模板创建
cp backend/.env.example backend/.env
cp config/agents.example.json config/agents.json

# 编辑必要配置
nano backend/.env
```

---

### ❌ 脚本权限错误（Linux/Mac）

**错误信息：**
```
Permission denied: ./start-dev.sh
```

**解决方案：**
```bash
# 添加执行权限
chmod +x start-dev.sh quick-start.sh

# 验证权限
ls -l *.sh
```

---

### ❌ TypeScript 类型错误

**错误信息：**
```
TS2345: Argument of type 'number' is not assignable to parameter of type 'Date'
```

**解决方案：**
```bash
# 这些是已知的类型问题，不影响运行
# 可以选择性修复或忽略

# 仅检查后端类型（后端无错误）
cd backend && npm run build

# 跳过前端类型检查直接运行
npm run dev
```

---

## 🔍 调试模式

### 启用详细日志

在 `backend/.env` 中设置：
```env
LOG_LEVEL=debug
```

或临时启用：
```bash
LOG_LEVEL=debug npm run dev
```

### 查看实时日志

启动服务后，控制台会显示：
- 后端日志：API 请求、错误、数据库操作
- 前端日志：Vite 编译信息、热更新状态

---

## 📝 其他启动命令

### 分别启动前后端

```bash
# 仅启动后端
npm run backend:dev

# 仅启动前端
npm run frontend:dev
```

### 生产模式启动

```bash
# 构建生产版本
npm run build

# 启动后端服务（需要先构建）
npm start
```

### 运行测试

```bash
# 运行所有测试
npm test

# 仅后端测试
npm run backend:test

# 后端测试（监视模式）
cd backend && npm run test:watch
```

### 代码检查

```bash
# 检查所有代码
npm run lint

# 修复代码问题
npm run lint:fix

# 前端类型检查
cd frontend && npm run type-check
```

---

## 📚 相关文档

- **项目文档**: [README.md](README.md)
- **开发指南**: [CLAUDE.md](CLAUDE.md)
- **脚本说明**: [scripts/README.md](scripts/README.md)
- **API 文档**: [doc/](doc/) 目录

---

## 💡 小贴士

1. **首次启动较慢**: 第一次启动需要编译 TypeScript 和安装依赖，耐心等待
2. **热更新**: 修改代码后会自动重新加载，无需重启
3. **并发日志**: 前后端日志会混合显示，注意识别日志来源
4. **智能体配置热重载**: 修改 `agents.json` 后调用 API 重载无需重启
5. **环境变量修改**: 修改 `.env` 后需要重启后端服务

---

## 🆘 需要帮助？

如果遇到其他问题：

1. 检查控制台错误信息
2. 查看 [常见问题排查](CLAUDE.md#🔧-常见问题排查)
3. 搜索项目 [Issues](https://github.com/wilson323/llmchat/issues)
4. 创建新 Issue 描述问题

---

**Happy Coding! 🎉**