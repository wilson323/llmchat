# LLMChat - 企业级多智能体聊天平台

[![Spec-Kit Compliant](https://img.shields.io/badge/Spec--Kit-Compliant-brightgreen.svg)](https://docs.llmchat.com/spec-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

> **企业级智能体聊天平台** - 支持多AI提供商动态切换的现代化聊天应用

LLMChat 是一个企业级多智能体聊天平台，支持在多个AI提供商（FastGPT、OpenAI、Anthropic、Dify等）之间进行动态切换，提供统一的服务端配置与代理能力。前端具备主题切换、流式响应、管理后台等功能，后端采用微服务架构设计。

## 技术栈

- 前端：React 18 + TypeScript + Vite 5 + Tailwind CSS + React Router + Zustand + Axios
- 后端：Node.js + Express + TypeScript
- 其它：ESLint、Jest、ts-node-dev、tsconfig-paths、rate-limiter-flexible、helmet、compression、cors、dotenv

## 内置智能体工作台

- **产品现场预览**：引导用户上传现场与产品素材、勾勒红框并调用阿里图像生成 API，输出沉浸式的场景合成图。
- **电话语音对话**：借助浏览器语音识别与播报能力，提供贴近 Kimi、豆包、通义千问电话助手体验的实时语音通话模式。

## 目录结构

```
llmchat/
├── backend/                 # 后端服务（Express + TS）
│   ├── src/
│   │   ├── controllers/     # 控制器（Chat/Agent/Auth/Admin）
│   │   ├── routes/          # 路由（/api/...）
│   │   ├── middleware/      # 中间件（日志/限流/错误处理）
│   │   ├── services/        # 业务服务
│   │   ├── models/          # 数据模型
│   │   ├── types/           # TS 类型
│   │   └── utils/           # 工具与DB初始化
│   ├── tsconfig.json
│   ├── .env.example         # 环境变量示例
│   └── .env                 # 实际环境变量（本地/生产）
├── frontend/                # 前端应用（React + Vite）
│   ├── src/
│   │   ├── components/      # 组件（含 ChatApp、admin 页面、主题等）
│   │   ├── hooks/ lib/ utils/ services/ store/ styles/ types/
│   ├── vite.config.ts       # 端口与代理、路径别名
│   ├── tailwind.config.js   # Tailwind 配置（颜色/动画等）
│   └── postcss.config.js
├── config/
│   └── agents.json          # 智能体配置（后端读取）
├── package.json             # 根工作区脚本（并发启动/构建）
└── README.md
```

## 环境要求

- Node.js 18+（建议 18 或 20）
- pnpm 8+（推荐使用pnpm，项目使用workspace管理）
- PostgreSQL 14+（数据库）
- Redis 6+（可选，用于缓存和Token管理）
- 操作系统：Windows 10/11（亦可在 macOS/Linux 运行）

## 安装与启动（Windows）

1. 安装依赖（根、后端、前端）
   ```
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. 配置环境变量（后端）
   - 参考 `backend/.env.example` 在 `backend/.env` 中设置：
     ```bash
     # === 服务器配置 ===
     PORT=3001
     NODE_ENV=development
     FRONTEND_URL=http://localhost:3000
     
     # === 日志与限流 ===
     LOG_LEVEL=debug
     REQUEST_TIMEOUT=30000
     RATE_LIMIT_POINTS=100
     RATE_LIMIT_DURATION=60
     RATE_LIMIT_BLOCK_DURATION=60
     
     # === 数据库配置（PostgreSQL）===
     DB_HOST=localhost
     DB_PORT=5432
     DB_USER=your_db_user
     DB_PASSWORD=your_db_password
     DB_NAME=llmchat
     
     # === Redis 配置（用于 Token 管理）===
     REDIS_HOST=localhost
     REDIS_PORT=6379
     REDIS_PASSWORD=your_redis_password
     REDIS_DB=0
     
     # === Token 配置 ===
     TOKEN_SECRET=your-secure-secret-key-at-least-32-characters-long
     TOKEN_TTL=86400
     REFRESH_TOKEN_TTL=2592000
     
     # === FastGPT 智能体配置（示例）===
     FASTGPT_AGENT_ID_1=your-fastgpt-agent-id-1
     FASTGPT_API_KEY_1=your-fastgpt-api-key-1
     FASTGPT_ENDPOINT=https://api.fastgpt.in/api/v1/chat/completions
     
     # === 阿里云图像生成 API ===
     ALIYUN_IMAGE_API_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation
     ALIYUN_IMAGE_API_KEY=your-dashscope-api-key
     ALIYUN_IMAGE_MODEL=wanx-stylepro-v1
     # 可选：如需指定工作空间
     # ALIYUN_WORKSPACE_ID=your-workspace-id
     ```
   
   - **重要说明**：
     - 生产环境中 `FRONTEND_URL` 必须设置为实际前端地址（如 `https://yourdomain`）
     - **智能体配置**：`config/agents.json` 现支持环境变量占位符（如 `${FASTGPT_API_KEY_1}`），避免在配置文件中硬编码敏感信息
     - **数据库配置**：`config/config.jsonc` 中的数据库连接信息也支持环境变量占位符（如 `${DB_PASSWORD}`）
     - 所有敏感信息（API密钥、数据库密码、Token密钥等）**必须**存储在 `backend/.env` 中，**切勿**提交到版本控制系统
     - 环境变量命名规范：使用大写字母和下划线（如 `FASTGPT_API_KEY_1`）

3. 启动开发服务（并发前后端）
   ```
   npm run dev
   ```
   - 前端开发服务器：`http://localhost:3000`
   - 后端 API 服务：`http://localhost:3001`
   - 前端代理已在 `frontend/vite.config.ts` 设置：
     - `'/api' -> 'http://localhost:3001'`

4. 构建生产版本
   ```
   npm run build
   ```
   构建后：
   - 后端：`backend/dist`
   - 前端：`frontend/dist`

5. 仅启动后端（生产或本地）
   ```
   npm start
   ```

## 📚 项目文档

### 文档体系
- **项目宪法**: [CONSTITUTION.md](CONSTITUTION.md) - 管理原则和开发指南
- **AI助手配置**: [CLAUDE.md](CLAUDE.md) - AI开发规范和技术细节
- **质量体系**: [QUALITY_SYSTEM_GUIDE.md](QUALITY_SYSTEM_GUIDE.md) - 质量保障机制
- **文档索引**: [DOCUMENT_INDEX.md](DOCUMENT_INDEX.md) - 完整文档导航

### 技术文档
- **核心文档**: 位于 `docs/` 目录
- **归档文档**: 历史报告归档在 `docs/archive/`
- **故障排除**: 专题文档在 `docs/troubleshooting/`
- **项目分析**: [全局一致性分析](docs/GLOBAL_CONSISTENCY_ANALYSIS.md) ⭐⭐⭐⭐⭐
- **详细索引**: 查看 [docs/README.md](docs/README.md)

### 必读文档
1. **[CONSTITUTION.md](CONSTITUTION.md)** - 项目宪法（管理原则）⭐⭐⭐⭐⭐
2. **[CLAUDE.md](CLAUDE.md)** - AI助手开发规范 ⭐⭐⭐⭐⭐
3. **[docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)** - 开发规范 ⭐⭐⭐⭐⭐
4. **[docs/CODE_REVIEW_GUIDE.md](docs/CODE_REVIEW_GUIDE.md)** - 代码审查 ⭐⭐⭐⭐

## 根级脚本说明

- `dev`：并发启动后端与前端（使用 concurrently）
- `backend:dev`：进入 backend 并运行 ts-node-dev
- `frontend:dev`：进入 frontend 并运行 Vite
- `build`：先构建后端，再构建前端
- `start`：进入 backend 运行已构建的 `dist/index.js`
- `test`：串行运行前后端测试（如有）

## 后端服务说明

- 入口：`backend/src/index.ts`
- 端口：默认 `3001`，可通过 `PORT` 环境变量覆盖
- 中间件：
  - `helmet`：基础安全头，含 CSP（脚本/样式/img/connectSrc 等）
  - `cors`：开发允许 `http://localhost:3000` 与 `127.0.0.1:3000`；生产使用 `FRONTEND_URL`
  - `compression`：对 SSE 与 `/api/chat/completions` 显式禁用压缩，避免流式缓冲
  - `express.json/urlencoded`：请求解析，大小限制 10MB
  - `requestLogger`：请求日志
  - `rateLimiter`：对 `/api` 路径进行速率限制
  - `errorHandler`：统一错误处理
- 健康检查：`GET /health`
- 优雅关闭：处理 SIGTERM/SIGINT，关闭 HTTP 与 DB 连接

### 数据库迁移

项目使用版本化的数据库迁移系统管理 PostgreSQL schema:

```bash
cd backend

# 查看迁移状态
npm run migrate:status

# 执行所有待执行的迁移
npm run migrate:up

# 回滚最后一次迁移
npm run migrate:down
```

详细说明请参阅 [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md)

### 数据存储架构

**重要**: LLMChat 采用**混合存储架构**：
- **第三方智能体**（FastGPT、Dify）- 消息内容由其平台管理，本地仅存储会话元数据
- **自研智能体**（语音电话、产品预览）- 消息内容存储在本地数据库

这种设计的优势：
- ✅ 遵循数据所有权原则，避免重复存储
- ✅ 降低存储成本和数据库压力
- ✅ 简化GDPR合规要求（用户数据删除）
- ✅ 保持自研功能的完整性

详细说明请参阅 [ARCHITECTURE_DATA_STORAGE.md](docs/ARCHITECTURE_DATA_STORAGE.md)

### API 前缀与路由

所有业务接口均以 `/api` 为前缀：

- 智能体管理（`/api/agents`）
  - `GET /api/agents` 获取智能体列表（支持 `?includeInactive=true`）
  - `POST /api/agents/reload` 重新加载配置
  - `GET /api/agents/:id` 获取特定智能体信息
  - `GET /api/agents/:id/status` 检查智能体状态
  - `GET /api/agents/:id/validate` 验证智能体配置
  - `POST /api/agents/:id/update` 更新智能体（启用/禁用、编辑）

- 聊天代理（`/api/chat`）
  - `POST /api/chat/completions` 发送聊天请求（支持流式/非流式）
  - `GET /api/chat/init` 聊天初始化
  - `GET /api/chat/history` 获取 FastGPT 会话列表
  - `GET /api/chat/history/:chatId` 获取会话详情
  - `DELETE /api/chat/history/:chatId` 删除会话历史
  - `DELETE /api/chat/history` 清空当前智能体的会话历史
  - `POST /api/chat/history/:chatId/retry` 重新生成指定消息
  - `POST /api/chat/feedback` 点赞/点踩反馈

- 产品现场预览（`/api/product-preview`）
  - `POST /api/product-preview/generate` 上传现场照片、产品素材与红框区域，调用阿里图片生成接口返回现场合成图

- 认证（`/api/auth`）
  - `POST /api/auth/login` 登录
  - `POST /api/auth/register` 注册新用户
  - `GET /api/auth/profile` 个人信息
  - `POST /api/auth/logout` 退出
  - `POST /api/auth/change-password` 修改密码
  - `POST /api/auth/refresh` 刷新Token（如果实现）

- 会话持久化（`/api/chat-sessions`）**✨ 新增**
  - `GET /api/chat-sessions` 获取用户会话列表
  - `POST /api/chat-sessions` 创建新会话
  - `GET /api/chat-sessions/:id` 获取会话详情
  - `PATCH /api/chat-sessions/:id/title` 更新会话标题
  - `DELETE /api/chat-sessions/:id` 删除会话
  - `GET /api/chat-sessions/search` 搜索会话（全文搜索）

- 文件上传（`/api/upload`）**✨ 新增**
  - `POST /api/upload/single` 单文件上传（需要认证）
  - `POST /api/upload/multiple` 多文件上传（最多5个，需要认证）

- 管理（`/api/admin`）
  - `GET /api/admin/system-info` 系统信息
  - `GET /api/admin/users` 用户列表
  - `POST /api/admin/users/create` 创建用户
  - `POST /api/admin/users/update` 更新用户
  - `POST /api/admin/users/reset-password` 重置密码
  - `GET /api/admin/logs` 日志查询
  - `GET /api/admin/logs/export` 日志导出

## 智能体对话工作原理与数据流

本节描述从前端发起到后端代理外部 AI，再到流式渲染与反馈的完整流程。

### 关键端点

- 聊天请求：`POST /api/chat/completions`
  - 非流式：`stream=false`，返回标准 JSON
  - 流式：`stream=true`，返回 SSE 流（事件：`start`、`chunk`、`status`、`interactive`、`chatId`、`end`、`error`）
- 初始化开场白：`GET /api/chat/init?appId=:agentId&chatId=:chatId&stream=:bool`
  - 非流式：返回初始化数据与欢迎文本
  - 流式：SSE 流（事件：`start`、`chunk`、`complete`、`end`、`error`）
- 点赞/点踩反馈：`POST /api/chat/feedback`

### 请求体与选项

`/api/chat/completions` 请求体（后端会兼容顶层与 `options` 混用并归一化）：
- 必填
  - `agentId: string` 智能体ID（或 appId）
  - `messages: { role: 'user' | 'assistant' | 'system'; content: string; id?; timestamp?; metadata? }[]`
- 可选（顶层或 options 内任意位置，后端统一归一化）
  - `stream: boolean` 是否流式
  - `chatId: string` 透传会话ID（FastGPT 场景）
  - `detail: boolean` 是否返回 detail（配合 FastGPT 交互节点）
  - `temperature: number`、`maxTokens: number`
  - `variables: object` 自定义变量
  - `responseChatItemId: string` 响应消息项ID（用于 FastGPT 记录）

`/api/chat/init` 查询参数：
- `appId: string`（即 agentId）
- `chatId?: string`
- `stream?: boolean`

### SSE 事件说明

- `start`：开始事件，包含请求标识、时间戳、agentId/appId
- `chunk`：内容片段（文本增量）
- `status`：状态事件（`{ type: 'complete' | 'error' | ... }` 等）
- `interactive`：FastGPT 交互节点事件（`detail=true` 时可收到）
- `chatId`：透传会话ID（FastGPT 返回）
- `complete`：初始化完成事件（仅 `/chat/init` 流式中）
- `end`：流结束
- `error`：错误事件（包含错误信息）

后端为保证实时性，已对 SSE 与 `/api/chat/completions` 显式禁用压缩，并设置：
- `Content-Type: text/event-stream; charset=utf-8`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`（兼容反向代理）
并在可用时调用 `flushHeaders()` 立即刷新头部。

### 后端处理流程概览

- 控制器：`backend/src/controllers/ChatController.ts`
  - `chatCompletions`：校验参数 → 获取 agent → 非流式走 `handleNormalRequest`，流式走 `handleStreamRequest`
  - `handleNormalRequest`：调用 `ChatProxyService.sendMessage` 返回标准 JSON
  - `handleStreamRequest`：设置 SSE 头 → 调用 `ChatProxyService.sendStreamMessage`；通过回调发送 `chunk`、`status`、`interactive`、`chatId`，在 `complete/error` 时发 `end` 并 `res.end()`
  - `chatInit`：校验参数与激活状态 → 非流式 `handleInitNormalRequest`，流式 `handleInitStreamRequest`（事件为 `start/chunk/complete/end`）
  - `updateUserFeedback`：组装 FastGPT 反馈 API `POST /api/core/chat/feedback/updateUserFeedback`，透传 `appId/chatId/dataId/userGoodFeedback/userBadFeedback`
- 服务层：
  - `ChatProxyService`：负责不同 provider（如 FastGPT）的请求体转换、SSE 流解析与事件修复、普通与流式发送；支持 `detail`、`chatId`、`maxTokens`、`temperature` 等
  - `ChatInitService`：获取初始化数据与欢迎文本，支持非流与流式输出
  - `ChatLogService`：记录普通与流式日志（按配置）
  - `AgentConfigService`：读取与校验 `config/agents.json`，支持保存与热重载

### 前端数据流概览

- 服务：`frontend/src/services/api.ts`
  - `chatService.sendMessage()`：`POST /api/chat/completions` 非流式
  - `chatService.sendStreamMessage()`：`fetch` + `ReadableStream` 解析 SSE 文本行，识别 `event:` 与 `data:`，分派到回调（含 `onInteractive`、`onChatId`）
  - `chatService.init()` 与 `initStream()`：开场白初始化的普通与流式
  - `chatService.updateUserFeedback()`：提交点赞/点踩到 `/api/chat/feedback`
- 逻辑：`frontend/src/hooks/useChat.ts`
  - 组装消息与选项；维护会话 `chatId`（从 SSE `chatId` 事件回填）；根据 `stream` 分支调用服务；在 `chunk` 时增量更新；在 `status` 完成时结束
- 状态：`frontend/src/store/chatStore.ts`
  - 存储消息、会话、当前智能体、持久化点赞/点踩（`setMessageFeedback`）
- 组件：`frontend/src/components/chat/ChatContainer.tsx`
  - 首次进入会根据偏好选择流式或非流式进行初始化（调用 `init/initStream`）；渲染消息与侧边栏
  - `MessageItem.tsx` 里通过 `chatService.updateUserFeedback` 提交点赞/点踩

### 调试建议

- 流式卡顿或断流：
  - 检查反向代理是否强制 Gzip/缓冲（需关闭）；确认浏览器网络面板中 SSE 事件持续到 `end`
- `chatId` 未回填：
  - 确认使用 FastGPT provider 且后端已透传 `chatId` 事件；前端 `onChatId` 回调是否被触发
- 交互节点未显示：
  - 需设置 `detail=true`（前端 options），并确认后端与 provider 均支持交互数据透传
- 提交反馈失败：
  - 检查智能体 `endpoint/apiKey/appId` 配置是否正确；后端会将 `endpoint` 基座拼接至反馈 API

## 前端应用说明

- 入口：`frontend/src/main.tsx` 与 `src/App.tsx`
- 路由：`react-router-dom`
  - `/`：Chat 应用主界面（`<ChatApp />`）
  - `/login`：登录页面（成功后跳转 `redirect` 参数或 `/home`）
  - `/home` 与 `/home/:tab`：受保护的管理主页（需要登录）
  - 其它路径重定向到 `/`
- 主题：`ThemeProvider` 支持暗色/亮色/自动
- 通知：`<Toaster />` 全局提示
- 别名：`@` 指向 `src` 目录（详见 `vite.config.ts`）
- 开发服务器：端口 `3000`，已配置代理 `'/api' -> 'http://localhost:3001'`

## 智能体配置（config/agents.json）

后端通过环境变量 `AGENTS_CONFIG_PATH` 读取智能体配置。该文件包含多个 agent 条目，每个条目一般包括：

```json
{
  "agents": [
    {
      "id": "your-agent-id",
      "appId": "your-app-id",
      "name": "名称",
      "description": "描述",
      "endpoint": "http://your-ai-provider/api/v1/chat/completions",
      "apiKey": "YOUR_SECURE_API_KEY",
      "model": "Model-Name",
      "maxTokens": 4096,
      "temperature": 0.7,
      "systemPrompt": "系统提示词",
      "capabilities": [],
      "rateLimit": { "requestsPerMinute": 60, "tokensPerMinute": 40000 },
      "provider": "fastgpt",
      "isActive": true,
      "features": {
        "supportsChatId": true,
        "supportsStream": true,
        "supportsDetail": true,
        "supportsFiles": true,
        "supportsImages": true,
        "streamingConfig": { "enabled": true, "endpoint": "same", "statusEvents": true, "flowNodeStatus": true }
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

重要安全提示：
- 切勿将真实 `apiKey` 提交到版本库。请使用 `.env`、密钥管理（如 Vault、KMS）或部署环境变量注入，并在配置文件中使用占位符与启动时替换加载。
- 如需在 `agents.json` 存放敏感信息，请确保仓库为私有并配置访问控制。

## 开发与调试

- 代码检查：
  - 前端：`npm run lint`（在 frontend）/ `npm run lint:fix`
  - 后端：`npm run lint`（在 backend）/ `npm run lint:fix`
- 类型检查：`npm run type-check`（在 frontend）
- 测试：
  - 后端：`npm test` 或 `npm run test:watch`
  - 根：`npm run test` 会依次触发前后端测试（如已配置）
- 日志与级别：通过 `LOG_LEVEL` 控制输出详略
- 请求超时与限流：`REQUEST_TIMEOUT` 与 `RATE_LIMIT_*` 控制

## 构建与部署

- 前端构建：`frontend/dist` 可部署到静态资源服务器或 CDN
- 后端部署：
  - 使用 `npm run build` 生成 `backend/dist`
  - 启动命令：`npm start`（实际为 `node dist/index.js`）
  - 在生产环境设置 `NODE_ENV=production`，并正确设置 `FRONTEND_URL`
  - 通过反向代理（Nginx/Traefik）将 `https://yourdomain/api` 转发到后端服务
- 流式响应（SSE/或 chunked 流）：已对 `/api/chat/completions` 禁用压缩，避免流式缓冲；部署时请确保代理不强制 Gzip/缓存。

## 测试

### 单元测试
```bash
# 运行后端单元测试
cd backend
pnpm test

# 运行特定测试文件
pnpm test auth.test.ts
pnpm test agents.test.ts
pnpm test chat.test.ts

# 查看测试覆盖率
pnpm test:coverage
```

### E2E测试（Playwright）
```bash
# 运行所有E2E测试
pnpm run test:e2e

# 交互模式运行
pnpm run test:e2e:ui

# 调试模式
pnpm run test:e2e:debug

# 运行特定测试文件
pnpm run test:e2e tests/e2e/user-journey.spec.ts
```

### 性能测试
```bash
# 运行性能基准测试
cd tests/performance
node benchmark.ts

# 使用Artillery进行压力测试
npx artillery run artillery.yml
```

### 测试覆盖率
- **后端单元测试覆盖率**: 79% (595/751 tests passed)
- **API端点覆盖**: 95%+
- **关键业务逻辑**: 80%+
- **E2E核心流程**: 已覆盖用户/管理员完整旅程

## 常见问题（FAQ）

- 前后端跨域问题？
  - 开发环境已允许 `http://localhost:3000` 与 `http://127.0.0.1:3000`；生产环境请设置 `FRONTEND_URL`。
- 流式响应卡顿或延迟？
  - 确保代理层未强制压缩或缓冲；后端已禁用对聊天流接口的压缩。
- 端口冲突？
  - 修改 `backend/.env` 的 `PORT` 或 `frontend/vite.config.ts` 的 `server.port`。
- agents.json 中含有敏感信息？
  - 强烈建议不提交真实 Key；改为运行时注入或私有仓库管理。

## 许可协议

本项目使用 MIT 许可证。详见仓库内 LICENSE（如未包含，请根据需要添加）。

## 致开发者

本仓库已通过工作区脚本简化前后端并发开发，目录与别名结构清晰。为保持 UI 风格与代码一致性：
- 统一使用中文注释与文档
- 遵循现有组件与样式约定（Tailwind 配色与动画）
- 后端遵循现有中间件与路由组织方式
- 严禁在代码中硬编码敏感信息

如需增强功能或二次开发，请基于以上结构扩展相应模块并完善测试与文档。