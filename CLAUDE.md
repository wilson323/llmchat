# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🏗️ 项目架构

这是一个**智能体切换聊天应用**，采用前端+后端分离架构，支持多个 AI 提供商（FastGPT、OpenAI、Anthropic）之间的动态切换。

### 技术栈

**前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
**后端**: Node.js + Express + TypeScript
**状态管理**: Zustand (前端) + 本地存储持久化

### 项目结构

```
llmchat/
├── backend/                 # 后端服务 (端口 3001)
│   └── src/
│       ├── controllers/     # 控制器 (AgentController, ChatController)
│       ├── services/        # 业务服务 (AgentConfigService, ChatProxyService)
│       ├── types/           # TypeScript类型定义
│       └── utils/           # 工具函数
├── frontend/                # 前端应用 (端口 3000)
│   └── src/
│       ├── components/      # React组件
│       │   ├── agents/      # 智能体相关组件
│       │   ├── chat/        # 聊天相关组件
│       │   └── theme/       # 主题相关组件
│       ├── store/           # Zustand状态管理
│       └── types/           # TypeScript类型定义
├── config/                  # 配置文件
│   └── agents.json          # 智能体配置文件
└── doc/                     # 文档目录
```

## 🚀 开发命令

### 环境设置
```bash
# 安装依赖
npm install
cd backend && npm install
cd ../frontend && npm install

# 配置智能体 (复制配置模板)
cp config/agents.example.json config/agents.json
```

### 开发模式
```bash
# 同时启动前后端开发服务
npm run dev

# 分别启动
npm run backend:dev    # 后端: http://localhost:3001
npm run frontend:dev   # 前端: http://localhost:3000
```

### 构建和测试
```bash
# 构建
npm run build          # 构建前后端
npm run backend:build  # 仅构建后端
npm run frontend:build # 仅构建前端

# 测试
npm test               # 运行所有测试
npm run backend:test   # 仅后端测试
npm run frontend:test  # 仅前端测试

# 代码质量
npm run backend:lint       # 后端代码检查
npm run backend:lint:fix   # 后端代码修复
npm run frontend:lint      # 前端代码检查
npm run frontend:lint:fix  # 前端代码修复
npm run frontend:type-check # 前端类型检查
```

### 生产部署
```bash
npm run build        # 构建生产版本
npm start           # 启动后端服务
```

## 🎯 核心架构概念

### 1. 智能体系统 (Multi-Agent Architecture)

- **智能体配置**: `config/agents.json` 定义所有可用的 AI 智能体
- **支持提供商**: FastGPT、OpenAI、Anthropic、自定义
- **动态切换**: 用户可以在不同智能体间无缝切换
- **状态管理**: 每个智能体独立管理会话和配置

### 2. 会话管理系统

按照 `huihua.md` 文档设计的会话存储结构：
```typescript
// 按智能体分组的会话字典
{
  "agentId1": [会话数组],
  "agentId2": [会话数组],
  // ...
}

// 单个会话结构
{
  id: string,              // 时间戳字符串
  title: string,           // 取自首条消息前30字符
  agentId: string,         // 关联的智能体ID
  messages: ChatMessage[], // 格式: {'AI': string, 'HUMAN': string}
  createdAt: Date,
  updatedAt: Date
}
```

### 3. 消息格式转换

前端使用简化的消息格式 (`{'AI': string, 'HUMAN': string}`)，与后端通信时转换为标准格式 (`{role: string, content: string}`)。

### 4. 主题系统

- **三种模式**: 亮色/暗色/自动
- **自动切换**: 基于时间 schedule (06:00-18:00 亮色，其余暗色)
- **持久化**: 用户偏好保存到 localStorage

## 🔧 API 端点

### 智能体管理
- `GET /api/agents` - 获取可用智能体列表
- `GET /api/agents/:id` - 获取特定智能体信息
- `GET /api/agents/:id/status` - 检查智能体状态
- `POST /api/agents/reload` - 重新加载智能体配置
- `GET /api/agents/:id/validate` - 验证智能体配置

### 聊天代理
- `POST /api/chat/completions` - 发送聊天请求 (支持流式和非流式)
- `GET /api/chat/history/:sessionId` - 获取聊天历史 (待实现)

## 📝 代码规范和注意事项

### 类型系统
- 前后端共享核心类型定义，但前端有适配的简化版本
- 使用 TypeScript 严格模式
- 消息格式转换使用工具函数处理

### 状态管理
- 使用 Zustand 进行状态管理
- 支持持久化到 localStorage
- 状态恢复时自动执行初始化检查

### 错误处理
- 统一的 API 错误格式 (`ApiError` 接口)
- 开发环境包含详细错误信息
- 前端错误边界和全局错误处理

### 流式响应
- 支持 Server-Sent Events (SSE)
- FastGPT 特有的流式状态事件
- 实时显示工作流进度

## 🔍 调试和开发

### 常用调试命令
```bash
# 查看当前 git 状态
git status

# 检查构建产物
ls -la backend/dist/
ls -la frontend/dist/

# 检查配置文件
cat config/agents.json
```

### 开发注意事项
1. **智能体配置**: 修改 `config/agents.json` 后需要重启后端服务
2. **状态迁移**: 状态管理版本升级时会清除旧数据
3. **跨域处理**: 前端开发服务器已配置代理到后端
4. **环境变量**: 使用 `.env` 文件管理敏感配置

### 浏览器开发者工具
- **状态调试**: Zustand DevTools
- **网络请求**: 查看 API 调用和流式响应
- **本地存储**: 检查 localStorage 中的持久化数据
- **主题调试**: 实时切换主题模式

## 🛠️ 扩展指南

### 添加新的 AI 提供商
1. 在 `backend/src/services/ChatProxyService.ts` 中实现新的 Provider 类
2. 在 `config/agents.json` 中添加对应的智能体配置
3. 更新类型定义以支持新提供商的特有功能

### 自定义主题
1. 修改 `frontend/src/styles/` 中的 Tailwind 配置
2. 更新 `ThemeProvider.tsx` 中的主题切换逻辑
3. 在 `types/index.ts` 中扩展主题相关类型

### 性能优化
- 消息列表虚拟化 (大数据量)
- 智能体配置缓存优化
- 流式响应性能监控