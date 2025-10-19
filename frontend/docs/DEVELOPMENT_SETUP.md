# 开发环境设置指南

## 📋 概述

本指南将帮助您快速设置 LLMChat 前端项目的开发环境。遵循这些步骤可以确保您的开发环境与团队保持一致，并能够高效地进行开发工作。

## 🎯 系统要求

### 必需软件

- **Node.js**: 版本 18.x 或更高（推荐使用 LTS 版本）
- **包管理器**: pnpm 8.x 或更高
- **Git**: 版本 2.30 或更高
- **代码编辑器**: VS Code（推荐）或支持 TypeScript 的其他编辑器

### 推荐软件

- **浏览器**: Chrome 90+ 或 Firefox 88+
- **Node.js 版本管理器**: nvm 或 fnm
- **API 测试工具**: Postman 或 Insomnia
- **设计工具**: Figma（用于查看设计稿）

## 🛠️ 环境安装

### 1. 安装 Node.js

#### 使用 nvm（推荐）

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载终端配置
source ~/.bashrc

# 安装最新的 Node.js LTS 版本
nvm install --lts
nvm use --lts

# 设置默认版本
nvm alias default node

# 验证安装
node --version
npm --version
```

#### 直接安装

从 [Node.js 官网](https://nodejs.org/) 下载并安装适合您操作系统的版本。

### 2. 安装 pnpm

```bash
# 安装 pnpm
npm install -g pnpm

# 验证安装
pnpm --version
```

### 3. 安装 Git

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install git
```

#### macOS

```bash
# 使用 Homebrew
brew install git

# 或下载安装包
# https://git-scm.com/download/mac
```

#### Windows

从 [Git 官网](https://git-scm.com/download/win) 下载并安装 Git for Windows。

### 4. 配置 Git

```bash
# 配置用户名和邮箱
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 配置默认分支名
git config --global init.defaultBranch main

# 配置换行符处理（Windows）
git config --global core.autocrlf true

# 配置换行符处理（macOS/Linux）
git config --global core.autocrlf input
```

## 📦 项目设置

### 1. 克隆项目

```bash
# 克隆项目仓库
git clone https://github.com/your-org/llmchat.git
cd llmchat

# 或者使用 SSH
git clone git@github.com:your-org/llmchat.git
cd llmchat
```

### 2. 安装依赖

```bash
# 在项目根目录安装所有依赖
pnpm install

# 这个命令会自动：
# - 安装根目录依赖
# - 安装前端依赖
# - 安装后端依赖
# - 安装共享类型依赖
```

### 3. 环境变量配置

#### 复制环境变量模板

```bash
# 复制前端环境变量模板
cp frontend/.env.example frontend/.env

# 复制后端环境变量模板
cp backend/.env.example backend/.env
```

#### 配置前端环境变量

编辑 `frontend/.env` 文件：

```env
# API 配置
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# 应用配置
VITE_APP_NAME=LLMChat
VITE_APP_VERSION=1.0.0

# 功能开关
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true

# 第三方服务
VITE_SENTRY_DSN=your_sentry_dsn_here
```

#### 配置后端环境变量

编辑 `backend/.env` 文件：

```env
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/llmchat

# JWT 配置
TOKEN_SECRET=your-super-secure-jwt-secret-min-32-chars-long
JWT_EXPIRES_IN=1h

# Redis 配置（可选）
REDIS_URL=redis://localhost:6379

# API 密钥
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. 数据库设置

#### 使用 Docker（推荐）

```bash
# 启动 PostgreSQL 容器
docker run --name llmchat-postgres \
  -e POSTGRES_DB=llmchat \
  -e POSTGRES_USER=llmchat \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15

# 启动 Redis 容器（可选）
docker run --name llmchat-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

#### 本地安装

如果 prefer 本地安装，请按照官方文档安装 PostgreSQL 和 Redis。

### 5. 运行数据库迁移

```bash
# 进入后端目录
cd backend

# 运行数据库迁移
pnpm run migrate:up

# 检查迁移状态
pnpm run migrate:status
```

## 🚀 启动开发服务器

### 1. 并发启动前后端（推荐）

```bash
# 在项目根目录
pnpm run dev
```

这将同时启动：
- 前端开发服务器：http://localhost:3000
- 后端 API 服务器：http://localhost:3001

### 2. 分别启动

#### 启动后端服务器

```bash
# 在后端目录
cd backend
pnpm run dev

# 服务器将在 http://localhost:3001 启动
```

#### 启动前端服务器

```bash
# 在前端目录
cd frontend
pnpm run dev

# 应用将在 http://localhost:3000 启动
```

## 🧪 验证设置

### 1. 检查服务状态

```bash
# 检查后端健康状态
curl http://localhost:3001/health

# 检查前端访问
curl http://localhost:3000
```

### 2. 运行测试

```bash
# 运行所有测试
pnpm test

# 只运行前端测试
pnpm run frontend:test

# 只运行后端测试
pnpm run backend:test
```

### 3. 检查代码质量

```bash
# 检查代码风格
pnpm run lint

# 检查 TypeScript 类型
pnpm run type-check

# 构建项目
pnpm run build
```

## 🔧 开发工具配置

### 1. VS Code 配置

#### 推荐扩展

在 VS Code 中安装以下扩展：

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode-remote.remote-containers"
  ]
}
```

#### 工作区设置

创建 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

#### 调试配置

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/frontend/node_modules/.bin/vite",
      "args": ["--mode", "development"],
      "cwd": "${workspaceFolder}/frontend",
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "cwd": "${workspaceFolder}/backend",
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 2. Git Hooks 配置

项目已配置 Husky 和 lint-staged：

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### 3. 浏览器开发工具

#### Chrome 扩展推荐

- **React Developer Tools**: React 组件调试
- **Redux DevTools**: 状态管理调试（如果使用 Redux）
- **Tailwind CSS DevTools**: Tailwind CSS 调试
- **JSON Viewer**: JSON 格式化显示

## 📁 项目结构

```
llmchat/
├── frontend/                 # 前端应用
│   ├── public/              # 静态资源
│   ├── src/
│   │   ├── components/      # React 组件
│   │   ├── pages/           # 页面组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── store/           # 状态管理
│   │   ├── services/        # API 服务
│   │   ├── types/           # TypeScript 类型
│   │   ├── utils/           # 工具函数
│   │   └── styles/          # 样式文件
│   ├── docs/                # 前端文档
│   ├── tests/               # 测试文件
│   ├── package.json
│   ├── vite.config.ts       # Vite 配置
│   ├── tsconfig.json        # TypeScript 配置
│   └── tailwind.config.js   # Tailwind CSS 配置
├── backend/                 # 后端应用
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 业务服务
│   │   ├── models/          # 数据模型
│   │   ├── routes/          # 路由定义
│   │   ├── middleware/      # 中间件
│   │   ├── utils/           # 工具函数
│   │   └── types/           # TypeScript 类型
│   ├── tests/               # 测试文件
│   ├── package.json
│   └── tsconfig.json        # TypeScript 配置
├── shared-types/            # 共享类型定义
├── docs/                    # 项目文档
├── scripts/                 # 构建脚本
├── package.json             # 根目录 package.json
└── pnpm-workspace.yaml      # pnpm 工作区配置
```

## 🔄 日常开发流程

### 1. 创建功能分支

```bash
# 创建并切换到新分支
git checkout -b feature/new-feature

# 或创建 bugfix 分支
git checkout -b bugfix/fix-something
```

### 2. 开发和提交

```bash
# 添加更改
git add .

# 提交更改（会自动运行 lint 和格式化）
git commit -m "feat: add new feature"

# 推送到远程
git push origin feature/new-feature
```

### 3. 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试
pnpm run frontend:test
pnpm run backend:test

# 运行测试覆盖率
pnpm run test:coverage
```

### 4. 构建和部署

```bash
# 构建项目
pnpm run build

# 预览生产构建
pnpm run preview
```

## 🚨 常见问题与解决方案

### 问题 1: 端口冲突

**症状**: `Error: listen EADDRINUSE :::3000`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或修改配置文件中的端口
```

### 问题 2: 依赖安装失败

**症状**: `npm ERR! peer dep missing`

**解决方案**:
```bash
# 清除缓存
pnpm store prune

# 删除 node_modules 和 pnpm-lock.yaml
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install
```

### 问题 3: TypeScript 编译错误

**症状**: `TypeScript error: Cannot find module`

**解决方案**:
```bash
# 检查 tsconfig.json 路径配置
# 确保路径别名正确

# 重新生成类型
pnpm run type-check

# 或重启 TypeScript 服务器
# VS Code: Ctrl+Shift+P -> TypeScript: Restart TS Server
```

### 问题 4: 数据库连接失败

**症状**: `ECONNREFUSED 127.0.0.1:5432`

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
docker ps | grep postgres

# 启动 PostgreSQL
docker start llmchat-postgres

# 检查环境变量配置
cat backend/.env | grep DATABASE_URL
```

## 📚 有用资源

### 官方文档

- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Vite 文档](https://vitejs.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [pnpm 文档](https://pnpm.io/)

### 开发工具

- [VS Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/)

### 学习资源

- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Modern JavaScript Tutorial](https://javascript.info/)

---

如有任何问题，请联系开发团队或在项目仓库中创建 Issue。

最后更新: 2025-10-18