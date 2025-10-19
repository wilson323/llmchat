# LLMChat 快速启动指南

> 本指南帮助您在Windows环境下快速启动和测试LLMChat项目

## 📋 目录
- [环境要求](#环境要求)
- [首次使用](#首次使用)
- [日常启动](#日常启动)
- [核心功能测试](#核心功能测试)
- [常见问题](#常见问题)

## 环境要求

- Node.js 18+ (推荐 18 或 20)
- pnpm 8+ (推荐使用pnpm)
- PostgreSQL 14+
- Redis 6+ (可选，用于缓存)
- Windows 10/11

## 首次使用

### 步骤1: 克隆项目
```powershell
git clone https://github.com/wilson323/llmchat.git
cd llmchat
```

### 步骤2: 安装依赖
```powershell
# 安装根目录依赖和所有workspace
pnpm install
```

### 步骤3: 配置环境变量
```powershell
# 复制环境变量示例文件
copy backend\.env.example backend\.env

# 编辑backend\.env，设置必要配置
notepad backend\.env
```

**关键配置项**:
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=llmchat

# JWT配置
TOKEN_SECRET=your-super-secure-jwt-secret-min-32-chars-long

# Redis配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379

# FastGPT配置（示例）
FASTGPT_ENDPOINT=https://api.fastgpt.in/api/v1/chat/completions
FASTGPT_API_KEY=your-api-key
```

### 步骤4: 初始化数据库
```powershell
# 运行数据库迁移
cd backend
pnpm run migrate:up
```

### 步骤5: 启动服务
```powershell
# 返回根目录
cd ..

# 并发启动前后端（推荐）
pnpm run dev

# 或使用快速启动脚本
.\quick-start.bat
```

### 步骤6: 访问应用
- 前端: http://localhost:3000
- 后端: http://localhost:3001
- 健康检查: http://localhost:3001/health

## 日常启动

### 快速启动（推荐）
```powershell
# 方式1: 使用bat脚本
.\quick-start.bat

# 方式2: 使用pnpm命令
pnpm run dev
```

### 分别启动
```powershell
# 终端1 - 启动后端
cd backend
pnpm run dev

# 终端2 - 启动前端
cd frontend
pnpm run dev
```

### 调试模式
```powershell
# 使用调试脚本
.\start-dev-debug.bat
```

## 核心功能测试

### 测试1: 用户登录 (2分钟)

1. 浏览器访问 http://localhost:3000
2. 输入默认管理员账号: `admin / admin123`
3. 点击登录
4. ✅ 应成功跳转到聊天界面

**检查点**:
- [ ] 看到登录界面
- [ ] 登录成功跳转
- [ ] 无控制台错误

### 测试2: 智能体选择 (2分钟)

1. 查看左侧智能体列表
2. 选择一个智能体（如FastGPT）
3. ✅ 智能体切换成功

**检查点**:
- [ ] 智能体列表正常显示
- [ ] 切换响应快速
- [ ] 界面显示当前智能体

### 测试3: 发送消息 (5分钟)

1. 在输入框输入: "你好，请自我介绍"
2. 按Enter或点击发送按钮
3. ✅ 收到AI回复

**检查点**:
- [ ] 消息成功发送
- [ ] 显示加载指示器
- [ ] AI回复正常显示
- [ ] 支持流式响应

### 测试4: 会话管理 (3分钟)

1. 点击新建会话
2. 发送几条消息
3. 切换回旧会话
4. ✅ 历史消息正确加载

**检查点**:
- [ ] 新建会话成功
- [ ] 会话切换流畅
- [ ] 消息历史完整

### 测试5: 管理后台 (5分钟)

1. 访问管理后台页面
2. 查看统计数据
3. 管理智能体配置
4. ✅ 管理功能正常

**检查点**:
- [ ] 管理后台可访问
- [ ] 统计数据正常显示
- [ ] 配置管理功能正常

## 验证检查点

### 控制台检查
打开浏览器开发者工具（F12），检查：

- [ ] ✅ 无TypeScript编译错误
- [ ] ✅ 无运行时JavaScript错误
- [ ] ✅ 无网络请求失败（API已配置）
- [ ] ✅ 无React警告

### 性能检查
- [ ] 消息输入响应快速（<100ms）
- [ ] 消息发送流畅
- [ ] 页面不卡顿
- [ ] 内存使用正常

### 功能完整性
- [ ] 登录/注册功能
- [ ] 智能体切换
- [ ] 消息发送/接收
- [ ] 会话管理
- [ ] 管理后台

## 常见问题

### 问题1: 脚本闪退
**解决方案**: 使用CMD运行调试脚本
```powershell
start-dev-debug.bat
```

### 问题2: concurrently未安装
**解决方案**: 重新安装依赖
```powershell
pnpm install
```

### 问题3: 端口被占用
**解决方案**: 查找并关闭占用端口的进程
```powershell
# 查找占用3000端口的进程
netstat -ano | findstr :3000

# 关闭进程（替换<PID>为实际进程ID）
taskkill /PID <PID> /F
```

### 问题4: 数据库连接失败
**解决方案**: 
1. 确认PostgreSQL服务已启动
2. 检查`backend/.env`中的数据库配置
3. 运行数据库迁移: `pnpm run migrate:up`

### 问题5: 配置文件缺失
**解决方案**: 使用调试脚本自动创建
```powershell
start-dev-debug.bat
```

### 问题6: TypeScript编译错误
**解决方案**: 
```powershell
# 检查类型错误
pnpm run type-check

# 清理并重新构建
pnpm run build
```

## 停止服务

在运行服务的终端中：
1. 按 `Ctrl+C`
2. 选择 `Y` 确认

或者关闭终端窗口。

## 快速命令参考

```powershell
# 开发命令
pnpm run dev              # 并发启动前后端
pnpm run backend:dev      # 仅启动后端
pnpm run frontend:dev     # 仅启动前端

# 构建命令
pnpm run build            # 构建前后端
pnpm run backend:build    # 仅构建后端
pnpm run frontend:build   # 仅构建前端

# 测试命令
pnpm test                 # 运行所有测试
pnpm run backend:test     # 后端测试
pnpm run frontend:test    # 前端测试
pnpm run test:e2e         # E2E测试

# 代码质量
pnpm run lint             # 代码检查
pnpm run lint:fix         # 自动修复
pnpm run type-check       # 类型检查

# 数据库操作
pnpm run migrate:up       # 执行迁移
pnpm run migrate:down     # 回滚迁移
pnpm run migrate:status   # 查看状态
```

## 需要帮助？

- **完整文档**: 查看 [docs/](.) 目录
- **开发规范**: [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- **故障排除**: [troubleshooting/](troubleshooting/) 目录
- **Windows问题**: [TROUBLESHOOTING-WINDOWS.md](TROUBLESHOOTING-WINDOWS.md)

## 下一步

成功启动后，建议：
1. 阅读 [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) 了解开发规范
2. 阅读 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) 了解代码审查流程
3. 查看 [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md) 了解项目架构
4. 开始开发新功能或修复问题

---

*最后更新: 2025年10月*
*维护者: 技术团队*

