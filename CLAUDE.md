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
│       │   ├── theme/       # 主题相关组件
│       │   ├── ui/          # 基础UI组件
│       │   ├── cad/         # CAD文件处理组件
│       │   ├── voice/       # 语音通话组件
│       │   └── workspace/   # 工作区组件
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

# 🔐 安全配置（生产环境必需）
# 设置强密码的JWT密钥（至少32字符）
# 设置数据库连接加密密钥
# 配置安全环境变量
```

## 🔒 安全配置

### 必需环境变量（生产环境）

```bash
# JWT安全配置
TOKEN_SECRET="your-super-secure-jwt-secret-min-32-chars-long"
JWT_ALGORITHM="HS256"
JWT_EXPIRES_IN="1h"
JWT_ISSUER="llmchat-backend"
JWT_AUDIENCE="llmchat-frontend"

# 凭证加密密钥
CREDENTIALS_SALT="your-unique-credentials-salt-here"
DATABASE_ENCRYPTION_KEY="your-database-encryption-key"

# 数据库安全
DATABASE_URL="postgresql://username:password@localhost:5432/database?sslmode=require"
# 注意：数据库密码现在会被加密存储

# 应用安全
NODE_ENV="production"
FRONTEND_URL="https://your-domain.com"
RATE_LIMIT_WINDOW_MS="900000"  # 15分钟
RATE_LIMIT_MAX_REQUESTS="100"
```

### 安全最佳实践

1. **JWT密钥安全**
   - 使用至少32字符的随机字符串
   - 定期轮换JWT密钥
   - 不要在代码中硬编码密钥

2. **数据库安全**
   - 数据库密码使用加密存储
   - 启用SSL连接
   - 使用强密码策略

3. **文件上传安全**
   - 限制文件类型和大小
   - 扫描恶意软件
   - 用户认证必需

4. **日志安全**
   - 敏感信息自动脱敏
   - 不记录密码和令牌
   - 使用结构化日志

5. **API安全**
   - 所有管理端点需要认证
   - 实施请求速率限制
   - 使用CORS策略

6. **密码安全**
   - 使用bcrypt或SHA-256加盐哈希
   - 不存储明文密码
   - 强制密码复杂度要求

### 安全修复说明

#### 已修复的关键安全漏洞

1. **🚨 明文密码存储（已修复）**
   - 移除了数据库中的明文密码列
   - 实现了密码的安全哈希存储
   - 使用盐值+SHA-256加密

2. **⚠️ 敏感信息日志（已修复）**
   - 实现了日志脱敏系统
   - 自动屏蔽密码、令牌、API密钥
   - 安全的数据库连接字符串日志

3. **🔐 JWT配置问题（已修复）**
   - 强制使用强JWT密钥
   - 实现了完整的JWT验证
   - 添加了令牌撤销支持

4. **📁 文件上传安全（已修复）**
   - 实现了全面的文件验证
   - 添加了恶意软件扫描
   - 强制要求用户认证

### 安全工具和模块

- `src/utils/secureCredentials.ts` - 凭据加密管理
- `src/utils/secureDb.ts` - 安全数据库配置
- `src/utils/secureJwt.ts` - 安全JWT管理
- `src/utils/secureUpload.ts` - 安全文件上传验证
- `src/utils/logSanitizer.ts` - 日志脱敏工具

### 生产环境安全检查清单

```bash
# 1. 验证JWT配置
node -e "const { SecureJWT } = require('./dist/utils/secureJwt'); const validation = SecureJWT.validateConfiguration(); console.log('JWT配置验证:', validation);"

# 2. 检查数据库安全
node -e "const { SecureCredentialsManager } = require('./dist/utils/secureCredentials'); console.log('加密可用:', SecureCredentialsManager.isEncryptionAvailable());"

# 3. 验证环境变量
pnpm run validate:env

# 4. 运行安全测试
pnpm run test:security  # 如果有安全测试

# 5. 检查依赖漏洞
pnpm audit --audit-level high
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

## 🚨 企业级代码安全准则

### ⚠️ 严格禁止的危险操作
- **禁止使用正则表达式替换代码** - 绝对禁止使用 `.replace(/regex/, replacement)` 修改源代码
- **禁止动态构造正则表达式** - 绝对禁止 `new RegExp(userInput)` 用于代码处理
- **禁止使用sed/awk进行代码修改** - 绝对禁止使用命令行工具修改代码文件
- **禁止使用字符串替换修改结构化数据** - 必须使用专门的解析器
- **禁止企业级自动修复** - 所有修复必须经过影响分析和人工确认

### ✅ 企业级安全替代方案
- **AST优先修复**: 使用TypeScript编译器API进行精确的AST操作
- **类型安全修复**: 使用专门的类型检查和修复工具
- **配置文件**: 使用专门的配置解析库（如dotenv、config等）
- **代码重构**: 使用企业级AST解析器进行代码变换
- **文本处理**: 仅限用于日志处理和数据清理，不用于代码修改

### 🔒 企业级安全检查机制
项目集成了多层安全检查：
1. `pnpm run security:audit` - 全面安全审计
2. `pnpm run security:check` - 提交前安全检查
3. `pnpm run enterprise:fix` - 企业级安全代码修复工具
4. Pre-commit hooks自动阻止危险代码提交
5. 企业级修复影响分析和风险控制
6. 原子操作和100%回滚机制

### 🏢 企业级修复工具
```bash
# 企业级安全修复（推荐）
pnpm run enterprise:fix              # 企业级修复工具（dry-run模式）
pnpm run enterprise:fix --mode fix     # 交互式修复模式
pnpm run enterprise:fix --config custom.json  # 使用自定义配置
```

### 📊 修复影响分析
每个修复都包含完整的影响分析：
- **语义变化**: none | minor | major
- **性能影响**: none | low | medium | high
- **可读性变化**: none | positive | negative
- **破坏风险**: none | low | medium | high
- **置信度**: 0-100%
- **变化描述**: 详细的修复说明

### 🛡️ 安全配置原则
- 首次运行必须使用 `dry-run` 模式
- 高风险问题（error）默认必须人工确认
- 不要在生产环境使用 `auto-fix` 模式
- 所有修复都有完整的备份和回滚机制
- 修复前后进行语法和类型验证
- 限制文件大小和内存使用防止系统过载

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

### 🔒 安全相关问题

**问题**: JWT认证失败，提示"无效的认证令牌"
```bash
# 检查JWT配置
echo $TOKEN_SECRET

# 验证密钥长度（至少32字符）
echo ${#TOKEN_SECRET}

# 检查JWT格式
node -e "const { SecureJWT } = require('./dist/utils/secureJwt'); try { const config = SecureJWT.getConfig(); console.log('JWT配置有效'); } catch(e) { console.error('JWT配置错误:', e.message); }"
```

**问题**: 数据库连接失败
```bash
# 检查加密配置
echo $CREDENTIALS_SALT

# 验证环境变量
pnpm run validate:env

# 检查数据库连接字符串格式（密码将被自动脱敏）
echo $DATABASE_URL | node -e "const { LogSanitizer } = require('./dist/utils/logSanitizer'); console.log('连接字符串:', LogSanitizer.maskConnectionString(require('fs').readFileSync(0, 'utf8').trim()));"
```

**问题**: 文件上传被拒绝
```bash
# 检查文件大小限制
# CAD文件限制：10MB

# 验证文件类型
# 只允许.dxf文件

# 检查用户认证
# 所有CAD端点现在需要JWT认证
```

**问题**: 密码重置失败
```bash
# 确保使用正确的密码哈希
# 系统现在使用SHA-256加盐哈希

# 检查数据库连接
# 密码重置需要数据库访问权限
```

**问题**: 日志中出现敏感信息
```bash
# 检查日志脱敏是否正常工作
# 密码、令牌、API密钥应该被自动屏蔽

# 验证安全日志记录
grep -i "password\|token\|secret" logs/app.log | head -5
# 应该看到脱敏后的日志，如：****或 token***
```

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

## 🔄 阶段性执行规范和机制化流程

### 📋 阶段性开发执行标准

为确保项目开发的系统性和一致性，建立以下阶段性执行机制：

#### 🔧 执行流程标准化

**每个阶段的完整执行流程**：
1. **阶段初始化**
   - 明确阶段目标和范围
   - 制定详细执行计划
   - 预估时间和资源需求

2. **开发实施**
   - 按模块化方式实现功能
   - 保持代码质量和测试覆盖
   - 及时记录技术决策和实现细节

3. **测试验证**
   - 运行自动化测试套件
   - 进行功能验证和性能测试
   - 检查代码质量和类型安全

4. **阶段反思**
   - 总结阶段成果和经验教训
   - 识别问题和改进机会
   - 更新技术文档和使用指南

5. **Git工作流**
   - 更新远程主分支最新代码
   - 解决所有合并冲突
   - 提交更改并创建PR
   - 合并到主分支

6. **文档更新**
   - 更新CLAUDE.md文档
   - 记录阶段性成果
   - 形成标准化规范

#### 🎯 质量保证机制

**自动测试检测**：
```bash
# 1. 核心文件完整性检查
find src -name "*.ts" -type f | head -10

# 2. 构建状态验证
pnpm run build

# 3. 类型检查
pnpm run type-check

# 4. 代码质量检查
pnpm run lint

# 5. 测试套件执行
pnpm test
```

**异常处理标准**：
- ⚠️ 轻微问题：记录但不阻止流程
- 🚨 严重问题：必须修复后才能继续
- 📋 问题跟踪：使用TODO工具记录所有待解决问题

#### 📊 阶段性报告模板

每个阶段完成后必须生成包含以下内容的报告：

```markdown
# Phase X.X: [阶段名称] - 完成报告

## 📋 阶段概述
[阶段目标和背景说明]

## ✅ 已完成项目
### 1. [功能模块1]
**状态**: ✅ 完成
**实施内容**: [详细描述]
**技术细节**: [关键实现]
**预期效果**: [性能/质量提升]

### 2. [功能模块2]
[同上格式]

## 🔧 核心功能集成
[功能整合说明]

## 📊 性能提升预期
| 项目 | 预期提升 | 实现状态 |
|------|---------|---------|

## 🧪 质量保证
### 验证结果
- ✅ 核心功能完整性: [数据]
- ✅ 测试通过率: [数据]
- ✅ 构建状态: [状态]

### 测试状态
**通过测试**: [数量]/[总数]
**待修复**: [问题描述]

## 🚀 技术创新点
[创新内容描述]

## 🔍 已知问题与限制
[问题和解决方案]

## 📈 下一阶段计划
[后续工作安排]

## 💡 经验总结
[关键经验和教训]
```

#### 🔄 Git工作流标准化

**分支管理策略**：
1. **主分支保护**: `main`分支始终保持稳定状态
2. **功能分支**: 每个阶段使用独立功能分支
3. **合并策略**: 先更新远程主分支，再解决冲突，最后合并

**标准化Git命令序列**：
```bash
# 1. 完成阶段开发
git add .
git commit -m "feat: 完成Phase X.X [功能描述]

# 2. 推送到远程功能分支
git push origin feature/phase-x-x

# 3. 切换到主分支
git checkout main

# 4. 更新远程主分支
git pull origin main

# 5. 解决冲突（如有）
# [手动解决冲突文件]
git add .
git commit -m "feat: 解决主分支合并冲突"

# 6. 合并功能分支
git merge feature/phase-x-x

# 7. 推送到主分支
git push origin main
```

**冲突解决标准流程**：
1. 📋 识别冲突文件和类型
2. 🔍 分析冲突原因和影响
3. ⚖️ 选择合适的解决方案
4. ✅ 验证解决结果
5. 📝 记录冲突解决过程

#### 📚 文档更新机制

**CLAUDE.md更新规则**：
- 每个阶段完成后必须更新
- 记录新功能的使用方法
- 更新项目架构说明
- 添加常见问题解决方案

**技术文档要求**：
- 📝 API文档：使用Swagger自动生成
- 📋 用户指南：包含完整使用流程
- 🔧 开发文档：包含架构设计和实现细节
- 🐛 故障排除：常见问题和解决方案

#### 🎯 持续改进机制

**阶段性反思标准**：
1. **成果评估**: 与预期目标对比分析
2. **过程回顾**: 识别流程中的问题和机会
3. **技术债务**: 记录和规划技术债务处理
4. **经验总结**: 形成可复用的最佳实践

**机制化落实措施**：
- 📋 检查清单：为每个阶段创建标准化检查清单
- 🔄 自动化：将重复性工作自动化
- 📊 指标监控：建立质量指标监控体系
- 🎓 知识管理：建立项目知识库

#### 🚨 异常处理机制

**严重问题处理流程**：
1. ⚠️ 问题识别：自动检测或手动发现
2. 📊 影响评估：评估问题对项目的影响
3. 🔧 解决方案：制定和实施解决方案
4. ✅ 验证测试：确保问题彻底解决
5. 📝 复盘总结：分析问题根本原因并预防

**回滚机制**：
- 📦 版本控制：使用Git进行版本管理
- 🔄 快速回滚：支持快速回滚到稳定版本
- 📋 影响评估：评估回滚对现有功能的影响
- ✅ 恢复验证：确保回滚后系统正常工作

#### 📈 成功标准量化

**质量指标**：
- 代码覆盖率：> 80%
- 测试通过率：> 95%
- 构建成功率：100%
- 类型错误：0个

**性能指标**：
- API响应时间：< 200ms
- 页面加载时间：< 3s
- 数据库查询优化：20-70%提升
- 内存使用：优化20-40%

**流程指标**：
- 阶段完成准时率：> 90%
- 冲突解决时间：< 30分钟
- 文档更新及时性：100%
- 问题修复响应时间：< 2小时

---

**执行要求**：
- ✅ 严格按照此标准执行每个阶段
- ✅ 所有偏离标准的情况需要记录和说明
- ✅ 持续优化和完善标准流程
- ✅ 确保全局一致性和可靠性

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
