# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🏗️ 项目架构

这是一个**智能体切换聊天应用**，采用前端+后端分离架构，支持多个 AI 提供商（FastGPT、OpenAI、Anthropic、Dify）之间的动态切换。

### 技术栈

**前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand + React Router
**后端**: Node.js + Express + TypeScript + PostgreSQL/MongoDB + Redis
**状态管理**: Zustand (前端) + 本地存储持久化
**测试**: Jest (后端) + Vitest (前端) + Playwright (E2E)
**包管理器**: pnpm with workspaces

### 项目结构

```
llmchat/
├── backend/                 # 后端服务 (端口 3001)
│   └── src/
│       ├── controllers/     # 控制器 (AgentController, ChatController, AuthController)
│       ├── services/        # 业务服务 (AgentConfigService, ChatProxyService, AuthServiceV2)
│       ├── routes/          # 路由定义 (/api/...)
│       ├── middleware/      # 中间件 (JWT认证, 保护中间件, 日志, 限流)
│       ├── migrations/      # 数据库迁移文件 (PostgreSQL)
│       ├── types/           # TypeScript类型定义
│       └── utils/           # 工具函数和日志
├── frontend/                # 前端应用 (端口 3000)
│   └── src/
│       ├── components/      # React组件
│       │   ├── agents/      # 智能体相关组件
│       │   ├── chat/        # 聊天相关组件
│       │   ├── admin/       # 管理后台组件
│       │   └── theme/       # 主题相关组件
│       ├── store/           # Zustand状态管理
│       ├── services/        # API服务层
│       ├── hooks/           # React Hooks
│       └── types/           # TypeScript类型定义
├── shared-types/            # 前后端共享类型定义
├── config/                  # 配置文件
│   └── agents.json          # 智能体配置文件
├── tests/                   # E2E测试
│   └── e2e/                 # Playwright测试文件
└── docs/                    # 项目文档
```

## 🚀 开发命令

### 环境设置
```bash
# 安装所有依赖（使用工作区自动安装前后端）
pnpm install

# 配置后端环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 设置必要配置（数据库连接、JWT密钥、API密钥等）

# 配置智能体（如需自定义）
cp config/agents.example.json config/agents.json
```

### 开发模式
```bash
# 推荐：并发启动前后端开发服务
pnpm run dev

# 或分别启动
pnpm run backend:dev    # 后端: http://localhost:3001 (使用 ts-node-dev 热重载)
pnpm run frontend:dev   # 前端: http://localhost:3000 (使用 Vite)
```

### 构建和测试
```bash
# 构建
pnpm run build          # 构建前后端（自动安装依赖）
pnpm run backend:build  # 仅构建后端 (tsc)
pnpm run frontend:build # 仅构建前端 (tsc && vite build)

# 测试
pnpm test               # 运行所有测试
pnpm run backend:test   # 后端测试 (jest --runInBand)
pnpm run frontend:test  # 前端测试（vitest）
pnpm run test:e2e       # E2E测试 (playwright)
pnpm run test:e2e:ui    # E2E测试UI模式

# 代码质量
pnpm run lint               # 检查前后端代码
pnpm run lint:fix           # 修复前后端代码问题
pnpm run backend:lint       # 仅后端代码检查
pnpm run backend:lint:fix   # 仅后端代码修复
pnpm run frontend:lint      # 仅前端代码检查
pnpm run frontend:lint:fix  # 仅前端代码修复
pnpm run type-check         # 前端 TypeScript 类型检查
```

### 数据库操作
```bash
# 运行数据库迁移
pnpm run migrate:up         # 执行迁移
pnpm run migrate:down       # 回滚迁移
pnpm run migrate:status     # 查看迁移状态

# 验证配置和环境
pnpm run validate:env       # 验证环境变量
pnpm run validate-config    # 验证智能体配置
```

### 生产部署
```bash
pnpm run build        # 构建生产版本
pnpm start           # 启动后端服务 (node dist/index.js)
```

## 🎯 核心架构概念

### 1. 智能体系统 (Multi-Agent Architecture)

- **智能体配置**: `config/agents.json` 定义所有可用的 AI 智能体
- **支持提供商**: FastGPT、OpenAI、Anthropic、Dify、自定义
- **动态切换**: 用户可以在不同智能体间无缝切换
- **配置热重载**: 通过 API `POST /api/agents/reload` 无需重启服务

### 2. 认证与授权系统

- **JWT认证**: 使用 JWT token 进行用户认证
- **AuthServiceV2**: 统一的认证服务，支持多种认证方式
- **中间件保护**: JWT认证中间件和保护中间件
- **安全增强**: 密码加密、速率限制、请求验证

### 3. 会话管理系统

```typescript
// 数据库中的会话存储结构
{
  id: string,              // UUID
  title: string,           // 会话标题
  agentId: string,         // 关联的智能体ID
  userId?: string,         // 用户ID（可选）
  messages: ChatMessage[], // 消息数组
  createdAt: Date,
  updatedAt: Date
}

// 前端本地存储格式（简化）
{
  conversations: {
    [agentId: string]: Array<{
      id: string;
      title: string;
      agentId: string;
      messages: Array<{'AI': string, 'HUMAN': string}>;
      createdAt: Date;
      updatedAt: Date;
    }>
  }
}
```

### 4. 消息格式与流式响应

- **格式转换**: 前端简化格式 `{'AI': string, 'HUMAN': string}` 与后端标准格式 `{role: string, content: string}` 之间的转换
- **SSE流式响应**: 支持 Server-Sent Events，实时显示AI回复
- **多提供商适配**: 统一的接口适配不同AI提供商的响应格式

### 5. 主题系统

- **三种模式**: 亮色/暗色/自动
- **自动切换**: 基于时间 schedule (06:00-18:00 亮色，其余暗色)
- **持久化**: 用户偏好保存到 localStorage

## 🔧 API 端点

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/refresh` - 刷新token
- `POST /api/auth/logout` - 用户登出

### 智能体管理
- `GET /api/agents` - 获取可用智能体列表
- `GET /api/agents/:id` - 获取特定智能体信息
- `GET /api/agents/:id/status` - 检查智能体状态
- `POST /api/agents/reload` - 重新加载智能体配置
- `GET /api/agents/:id/validate` - 验证智能体配置

### 聊天代理
- `POST /api/chat/completions` - 发送聊天请求 (支持流式和非流式)
- `GET /api/chat/history/:sessionId` - 获取聊天历史
- `POST /api/chat/save` - 保存聊天记录

### 管理后台
- `GET /api/admin/stats` - 获取统计数据
- `GET /api/admin/audit` - 获取审计日志
- `POST /api/admin/migrate` - 执行数据库迁移

## 📝 代码规范和注意事项

### TypeScript 配置
**后端** (`backend/tsconfig.json`):
- 严格模式: `strict: true` + 额外的严格检查（`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`）
- 路径别名: `@/*` 映射到 `src/*`，支持 `@/types`, `@/services` 等
- 输出目录: `dist/`，使用 CommonJS 模块系统
- 需要 `tsconfig-paths/register` 在运行时解析路径别名

**前端** (`frontend/tsconfig.json`):
- 严格模式: `strict: true` + `noUnusedLocals`, `noUnusedParameters`
- 路径别名: `@/*` 映射到 `src/*`，支持 `@/components`, `@/hooks` 等
- JSX: `react-jsx` 模式，无需导入 React
- 模块解析: `bundler` 模式（Vite 特有）

### 包管理器工作区
- **根目录**: 统一的工作区配置，管理所有依赖
- **shared-types**: 前后端共享的类型定义
- **依赖策略**: 优先使用 pnpm workspace，避免重复安装

### 数据库架构
- **PostgreSQL**: 主数据库，存储用户、会话、消息等
- **MongoDB**: 可选，用于日志存储和分析
- **Redis**: 缓存和会话存储
- **迁移系统**: 基于SQL文件的版本控制迁移

### 错误处理
- **统一错误格式**: `ApiError` 接口，包含错误代码、消息、详情
- **自定义错误类型**: `ValidationError`, `ResourceError`, `ExternalServiceError`
- **错误边界**: 前端React错误边界和全局错误处理
- **日志系统**: Winston日志记录，支持文件轮转

### 安全措施
- **JWT认证**: 安全的token认证机制
- **速率限制**: 基于IP和用户的请求限制
- **输入验证**: Joi验证schema
- **保护中间件**: 防止恶意请求和滥用
- **环境变量**: 敏感信息通过环境变量管理

## 🔍 调试和开发

### 快速调试命令
```bash
# 检查项目状态
git status                    # Git 仓库状态
pnpm run type-check          # TypeScript 类型检查
pnpm run lint                # 代码质量检查

# 检查构建产物
ls -la backend/dist/         # 后端构建输出
ls -la frontend/dist/        # 前端构建输出

# 检查配置
cat backend/.env             # 后端环境变量
cat config/agents.json       # 智能体配置

# 测试 API 端点
curl http://localhost:3001/health                # 健康检查
curl http://localhost:3001/api/agents            # 获取智能体列表

# 数据库操作
pnpm run migrate:status      # 查看迁移状态
pnpm run validate:env        # 验证环境变量
```

### 开发注意事项

**配置热重载**:
- 后端使用 `ts-node-dev` 自动重载代码变更
- 修改 `config/agents.json` 后调用 `POST /api/agents/reload` 热重载
- 前端 Vite 自动热更新 (HMR)

**路径别名使用**:
- 后端: 使用 `@/` 前缀导入，如 `import { AgentService } from '@/services/AgentService'`
- 前端: 使用 `@/` 前缀导入，如 `import { Button } from '@/components/ui/Button'`
- 运行时需要 `tsconfig-paths/register`（后端已配置在 dev 脚本中）

**数据库调试**:
- 迁移文件位置: `backend/src/migrations/`
- 数据库连接配置在 `backend/.env`
- 使用 `pnpm run migrate:status` 检查迁移状态

**状态管理调试**:
- 状态版本: 在 `chatStore.ts` 中定义，版本不匹配时会清除旧数据
- 持久化键: `llmchat-store` (localStorage)
- 清除状态: 在浏览器控制台运行 `localStorage.removeItem('llmchat-store')`

**跨域和代理**:
- 开发环境: 前端 Vite 配置代理 `/api -> http://localhost:3001`
- 生产环境: 需要通过 Nginx 等反向代理配置

### 浏览器开发者工具使用

**Console 调试**:
```javascript
// 查看 Zustand 状态
window.localStorage.getItem('llmchat-store')

// 清除会话历史
localStorage.removeItem('llmchat-store')
```

**Network 面板**:
- 查看 SSE 流式响应: 过滤 `/api/chat/completions`
- 检查事件流: 查看 `event:` 和 `data:` 行

**Application 面板**:
- LocalStorage: 查看 `llmchat-store` 的持久化数据
- 检查会话结构: 按 `agentId` 分组的会话字典

**React DevTools**:
- 组件树: 查看组件层级和 props
- Profiler: 性能分析

## 🛠️ 扩展和维护指南

### 添加新的 AI 提供商

1. **实现 Provider 类** (`backend/src/services/ChatProxyService.ts`):
   ```typescript
   class NewProviderProxy extends BaseProviderProxy {
     async sendMessage(options: ChatOptions): Promise<ChatResponse> {
       // 实现标准请求转换
     }

     async sendStreamMessage(
       options: ChatOptions,
       onChunk: (text: string) => void
     ): Promise<void> {
       // 实现流式响应处理
     }
   }
   ```

2. **更新类型定义** (`backend/src/types/agent.ts`):
   ```typescript
   export type ProviderType = 'fastgpt' | 'openai' | 'anthropic' | 'dify' | 'new-provider';
   ```

3. **配置智能体** (`config/agents.json`):
   ```json
   {
     "id": "new-agent",
     "provider": "new-provider",
     "endpoint": "https://api.newprovider.com/v1/chat",
     "apiKey": "sk-...",
     "features": {
       "supportsStream": true,
       "supportsFiles": true,
       "supportsImages": false
     }
   }
   ```

### 数据库迁移

**创建新迁移**:
```bash
# 1. 创建新的迁移文件
echo "-- 新迁移文件" > backend/src/migrations/XXX_new_table.sql

# 2. 编写迁移SQL
# 在新文件中编写 UP 和 DOWN SQL语句

# 3. 执行迁移
pnpm run migrate:up
```

**迁移文件格式**:
```sql
-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_users_email ON users(email);
```

### 自定义主题

1. **修改 Tailwind 配置** (`frontend/tailwind.config.js`):
   ```javascript
   theme: {
     extend: {
       colors: {
         primary: { /* 自定义颜色 */ }
       }
     }
   }
   ```

2. **更新主题 Provider** (`frontend/src/components/theme/ThemeProvider.tsx`):
   ```typescript
   // 修改自动切换时间
   const schedule = {
     light: { start: 6, end: 18 },  // 调整为自定义时间段
     dark: { start: 18, end: 6 }
   };
   ```

3. **扩展主题类型** (`frontend/src/types/index.ts`):
   ```typescript
   export type ThemeMode = 'light' | 'dark' | 'auto' | 'custom';
   ```

### 性能优化建议

**消息列表优化**:
- 使用 `react-window` 或 `react-virtualized` 虚拟化长列表
- 懒加载历史消息（按需加载旧会话）

**智能体配置缓存**:
- 后端: 使用 Redis 缓存智能体配置，避免频繁读取 JSON 文件
- 前端: 使用 `useMemo` 缓存智能体列表

**流式响应优化**:
- 实现文本分块渲染（避免每个字符都触发重渲染）
- 使用 `requestAnimationFrame` 批量更新 UI

**构建优化**:
- 前端: 代码分割（按路由）、Tree shaking
- 后端: 生产构建移除 source map

## 🔧 常见问题排查

### 编译和类型错误

**问题**: `Cannot find module '@/...'` 或路径别名无法解析
```bash
# 解决方案
# 1. 确认 tsconfig.json 中 baseUrl 和 paths 配置正确
# 2. 后端: 确保使用 tsconfig-paths/register
pnpm run backend:dev  # 已配置 -r tsconfig-paths/register

# 3. 前端: Vite 需要在 vite.config.ts 中配置 resolve.alias
# 已配置，如有问题检查 vite.config.ts
```

**问题**: TypeScript 严格模式错误（`exactOptionalPropertyTypes` 等）
```bash
# 后端使用了额外的严格检查
# 注意可选属性不能设置为 undefined，应该省略或设置为具体值

# 错误示例
const config: Config = { optional: undefined };  // ❌

# 正确示例
const config: Config = {};  // ✅ 省略可选属性
```

### 运行时错误

**问题**: 后端启动失败 - "Cannot find module"
```bash
# 检查依赖是否安装
pnpm install

# 检查 tsconfig-paths 是否注册
pnpm run backend:dev  # 确保使用项目脚本
```

**问题**: 数据库连接失败
```bash
# 1. 检查环境变量配置
cat backend/.env | grep DATABASE

# 2. 验证数据库连接
pnpm run validate:env

# 3. 检查数据库迁移状态
pnpm run migrate:status
```

**问题**: 前端 API 调用 404 或 CORS 错误
```bash
# 1. 检查后端是否运行
curl http://localhost:3001/health

# 2. 检查前端代理配置
# vite.config.ts 中确认 proxy 设置为 http://localhost:3001

# 3. 生产环境检查 CORS 配置
# backend/.env 中设置正确的 FRONTEND_URL
```

**问题**: SSE 流式响应卡住或中断
```bash
# 1. 检查是否启用了压缩（应该禁用）
# backend/src/index.ts 已针对 SSE 端点禁用压缩

# 2. 检查反向代理配置（Nginx）
# 需要禁用 gzip 和缓冲
location /api/chat/completions {
    proxy_buffering off;
    proxy_cache off;
    gzip off;
}

# 3. 浏览器网络面板检查事件流
# 确认收到 event: chunk 和 event: end
```

### 配置和环境问题

**问题**: 智能体配置无法加载
```bash
# 1. 检查配置文件路径
cat config/agents.json

# 2. 验证 JSON 格式
npx jsonlint config/agents.json

# 3. 热重载配置
curl -X POST http://localhost:3001/api/agents/reload

# 4. 检查后端日志
pnpm run backend:dev  # 查看控制台输出
```

**问题**: 环境变量未生效
```bash
# 1. 确认 .env 文件位置
ls backend/.env

# 2. 检查 NODE_ENV 设置
echo $NODE_ENV  # 或 Windows: echo %NODE_ENV%

# 3. 验证环境变量
pnpm run validate:env

# 4. 重启服务
pnpm run backend:dev
```

### 状态和存储问题

**问题**: 会话历史丢失或状态混乱
```javascript
// 浏览器控制台执行

// 1. 检查当前存储结构
console.log(JSON.parse(localStorage.getItem('llmchat-store')));

// 2. 检查版本号
const store = JSON.parse(localStorage.getItem('llmchat-store'));
console.log('Store version:', store?.state?.version);

// 3. 清除并重置（谨慎操作）
localStorage.removeItem('llmchat-store');
location.reload();
```

**问题**: 切换智能体后会话未更新
```bash
# 检查 chatStore.ts 中的 selectAgent 逻辑
# 确认按 agentId 正确获取会话列表
```

### 性能问题

**问题**: 前端渲染卡顿
```bash
# 1. 使用 React DevTools Profiler 分析
# 2. 检查是否有过多的重渲染
# 3. 考虑消息列表虚拟化（大量消息时）
```

**问题**: 后端响应慢
```bash
# 1. 检查速率限制配置
# backend/.env 中的 RATE_LIMIT_* 参数

# 2. 检查外部 API 调用延迟
# 查看后端日志中的请求时间

# 3. 考虑增加请求超时
# REQUEST_TIMEOUT=30000 (30秒)
```

## 📊 ECharts 地图配置

### 中国地图数据
项目使用动态加载的方式加载中国地图 GeoJSON 数据:

**数据位置**: `frontend/public/maps/china.json`
**数据来源**: 阿里云 DataV (https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json)

**加载方式**:
```typescript
// frontend/src/components/admin/AdminHome.tsx
fetch('/maps/china.json')
  .then(res => res.json())
  .then(chinaMap => {
    echarts.registerMap('china', chinaMap);
  });
```

**注意事项**:
- 新版 echarts (5.x+) 不再内置地图 JSON 数据
- 地图数据需要单独下载并放置在 `public/maps/` 目录
- 开发时修改 public 目录内容需要重启 Vite 服务器

**更新地图数据**:
```bash
# 下载最新的中国地图数据
curl -L "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json" -o frontend/public/maps/china.json

# 下载省级地图(示例:广东省 440000)
curl -L "https://geo.datav.aliyun.com/areas_v3/bound/440000_full.json" -o frontend/public/maps/guangdong.json
```

## 🧪 测试策略

### 单元测试
```bash
# 后端单元测试
pnpm run backend:test

# 前端单元测试
pnpm run frontend:test

# 测试覆盖率
pnpm run frontend:test:coverage
```

### E2E测试
```bash
# 运行所有E2E测试
pnpm run test:e2e

# 交互模式
pnpm run test:e2e:ui

# 调试模式
pnpm run test:e2e:debug
```

### 测试文件位置
- 后端测试: `backend/src/__tests__/`
- 前端测试: `frontend/src/test/`
- E2E测试: `tests/e2e/`

## 📱 生产部署

### Docker 部署
```bash
# 构建镜像
docker build -t llmchat .

# 运行容器
docker run -p 3001:3001 llmchat
```

### 环境变量配置
生产环境必需的环境变量：
- `DATABASE_URL`: PostgreSQL 连接字符串
- `JWT_SECRET`: JWT 密钥
- `REDIS_URL`: Redis 连接字符串（可选）
- `NODE_ENV`: 设置为 `production`

### 健康检查
- 健康检查端点: `GET /health`
- 数据库连接检查: `GET /health/db`
- 外部服务检查: `GET /health/external`