# LLMChat - 智能体切换聊天应用

一个仿照 ChatGPT 官网的智能体切换功能的聊天应用，支持多个 AI 提供商（FastGPT、OpenAI、Anthropic 等）之间的动态切换。

## 功能特性

- 🤖 多智能体动态切换
- 🌙 主题切换支持（白天/夜晚/自动）
- 💬 流式响应处理
- 🔧 服务端统一配置管理
- 📱 响应式界面设计
- 💾 本地状态持久化

## 技术栈

### 前端
- React 18 + TypeScript
- Tailwind CSS
- Zustand（状态管理）
- Axios（网络请求）

### 后端
- Node.js + Express
- TypeScript
- 智能体配置管理
- 聊天代理服务

## 项目结构

```
llmchat/
├── backend/          # 后端服务
│   └── src/
│       ├── controllers/    # 控制器
│       ├── services/      # 业务服务
│       ├── routes/        # 路由
│       ├── models/        # 数据模型
│       ├── types/         # TypeScript类型
│       ├── middleware/    # 中间件
│       └── utils/         # 工具函数
├── frontend/         # 前端应用
│   └── src/
│       ├── components/    # React组件
│       ├── hooks/         # 自定义Hooks
│       ├── store/         # 状态管理
│       ├── services/      # API服务
│       ├── types/         # TypeScript类型
│       ├── utils/         # 工具函数
│       └── styles/        # 样式文件
├── config/           # 配置文件
├── doc/             # 文档
└── README.md
```

## 快速开始

### 安装依赖

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 配置智能体

复制并编辑智能体配置文件：

```bash
cp config/agents.example.json config/agents.json
```

### 启动开发服务

```bash
npm run dev
```

这会同时启动后端服务（端口3001）和前端应用（端口3000）。

### 构建生产版本

```bash
npm run build
```

## API 文档

### 智能体管理

- `GET /api/agents` - 获取可用智能体列表
- `GET /api/agents/:id` - 获取特定智能体信息
- `GET /api/agents/:id/status` - 检查智能体状态

### 聊天代理

- `POST /api/chat/completions` - 发送聊天请求（支持流式和非流式）

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目使用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件获取详细信息。