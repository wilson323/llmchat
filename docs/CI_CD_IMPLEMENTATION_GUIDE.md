# LLMChat CI/CD 实施指南

## 📋 概述

本指南详细说明如何实施LLMChat项目的企业级CI/CD自动化流水线，包括配置步骤、最佳实践和故障排查。

## 🚀 快速开始

### 前置要求

#### 系统要求
- **Git**: 版本控制
- **GitHub**: 代码托管和CI/CD平台
- **Docker**: 容器化平台
- **Node.js**: 20.x 或更高版本
- **pnpm**: 8.15.0 或更高版本

#### 账户要求
- **GitHub账户**: 代码托管权限
- **容器注册表权限**: 镜像推送权限
- **环境访问权限**: 部署环境访问权限

### 初始设置

#### 1. 克隆项目
```bash
git clone https://github.com/your-org/llmchat.git
cd llmchat
```

#### 2. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
# 设置必要的环境变量
# TOKEN_SECRET=your-super-secure-jwt-secret-min-32-chars-long
# DATABASE_URL=postgresql://username:password@localhost:5432/database
# REDIS_URL=redis://localhost:6379
```

#### 3. 安装依赖
```bash
# 安装项目依赖
pnpm install

# 验证安装
pnpm run type-check
pnpm run lint
pnpm test
```

## 🔧 GitHub Actions 配置

### 工作流文件结构

```
.github/
├── workflows/
│   ├── advanced-ci-cd.yml          # 主要CI/CD流水线
│   ├── intelligent-quality-gates.yml # 智能质量门禁
│   ├── performance-monitoring.yml    # 性能监控
│   ├── intelligent-rollback.yml      # 智能回滚
│   └── workflow-dispatch.yml        # 工作流调度
└── settings/
    └── actions-permissions.yml     # Actions权限配置
```

### 配置工作流权限

#### 创建权限配置文件
```yaml
# .github/settings/actions-permissions.yml
permissions:
  contents: read
  issues: write
  pull-requests: write
  packages: write
  deployments: write
  actions: read
  checks: write
  statuses: write
```

### 配置Secrets

#### 必需的Secrets
```bash
# 在GitHub仓库设置中添加以下Secrets
TOKEN_SECRET: "your-super-secure-jwt-secret-min-32-chars-long"
DATABASE_URL: "postgresql://username:password@localhost:5432/database"
REDIS_URL: "redis://localhost:6379"
SLACK_WEBHOOK: "your-slack-webhook-url"
TEAMS_WEBHOOK: "your-teams-webhook-url"
```

## 🐳 Docker 配置

### Dockerfile最佳实践

#### 多阶段构建
```dockerfile
# 基础阶段
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@8.15.0

# 依赖阶段
FROM base AS dependencies
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# 运行时阶段
FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
USER nodejs
CMD ["node", "dist/index.js"]
```

### 镜像优化

#### 多架构构建
```yaml
# .github/workflows/docker-build.yml
- name: Build and Push Images
  uses: docker/build-push-action@v5
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: true
    tags: |
      ghcr.io/${{ github.repository }}:latest
      ghcr.io/${{ github.repository }}:${{ github.sha }}
```

## 🧪 测试配置

### 测试环境设置

#### Jest配置
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

#### Playwright配置
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

## 🚀 部署配置

### 多环境部署

#### 环境变量配置
```yaml
# 不同环境的配置
environments:
  development:
    NODE_ENV: development
    API_URL: http://dev-api.example.com
    DEBUG: true

  staging:
    NODE_ENV: production
    API_URL: http://staging-api.example.com
    DEBUG: false

  production:
    NODE_ENV: production
    API_URL: https://api.example.com
    DEBUG: false
```

#### Kubernetes配置
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llmchat
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llmchat
  template:
    metadata:
      labels:
        app: llmchat
    spec:
      containers:
      - name: llmchat
        image: ghcr.io/your-org/llmchat:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Docker Compose配置
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: .
      target: frontend
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
    depends_on:
      - backend

  backend:
    build:
      context: .
      target: backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/llmchat
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=llmchat
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 📊 监控配置

### Lighthouse CI配置

#### Lighthouse配置文件
```javascript
// .lighthouserc.js
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--no-sandbox --headless"
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'categories:pwa': 'off'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
```

#### 性能监控配置
```yaml
# performance-config.yml
performance_thresholds:
  lighthouse:
    performance: 90
    accessibility: 90
    best_practices: 90
    seo: 90

  api:
    response_time: 500
    error_rate: 1
    throughput: 100

  database:
    query_time: 100
    connection_pool: 80
```

## 🔧 故障排查

### 常见问题解决

#### 构建失败
```bash
# 检查构建日志
grep -i "error" build.log

# 检查依赖问题
pnpm install --verbose

# 清理缓存
pnpm store prune
rm -rf node_modules
pnpm install
```

#### 测试失败
```bash
# 检查测试配置
pnpm run test:debug

# 检查测试覆盖率
pnpm run test:coverage

# 运行特定测试
pnpm test --testNamePattern="specific-test"
```

#### 部署失败
```bash
# 检查部署日志
kubectl logs deployment/llmchat

# 检查资源使用
kubectl top pods

# 检查网络连接
kubectl exec -it pod-name -- curl http://localhost:3001/health
```

### 性能问题

#### 前端性能问题
```bash
# 运行Lighthouse分析
npx lighthouse http://localhost:3000 --view

# 分析包大小
npx webpack-bundle-analyzer dist/static/js/*.js

# 检查运行时性能
npx clinic doctor -- node dist/server.js
```

#### 后端性能问题
```bash
# 运行性能分析
node --prof dist/index.js

# 检查内存使用
node --inspect dist/index.js

# 监控CPU使用
top -p $(pgrep -f "node.*dist/index.js")
```

## 📚 最佳实践

### 代码提交规范

#### 提交信息格式
```bash
# 提交消息格式
type(scope): description

# 示例
feat(auth): add JWT authentication
fix(api): resolve API timeout issue
docs(readme): update installation guide
test(unit): add user service tests
```

#### 分支保护规则
- **main分支**: 必须通过所有CI/CD检查
- **develop分支**: 必须通过基本检查
- **功能分支**: 鼓励运行本地测试

### 安全最佳实践

#### 密钥管理
```bash
# 不要在代码中硬编码密钥
# ❌ 错误示例
const apiKey = "sk-1234567890abcdef";

# ✅ 正确示例
const apiKey = process.env.API_KEY;
```

#### 镜像安全
```dockerfile
# 使用非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 最小化镜像
FROM node:20-alpine
RUN apk add --no-cache curl
```

### 监控最佳实践

#### 健康检查
```javascript
// 健康检查端点
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  };

  res.json(health);
});
```

#### 日志记录
```javascript
// 结构化日志记录
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

logger.info('Application started', {
  port: process.env.PORT,
  environment: process.env.NODE_ENV
});
```

## 📞 支持和帮助

### 文档资源
- **官方文档**: [GitHub Actions文档](https://docs.github.com/en/actions)
- **Docker文档**: [Docker最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- **Node.js文档**: [Node.js最佳实践](https://nodejs.org/en/docs/guides/)

### 社区支持
- **GitHub社区**: [GitHub Actions社区](https://github.community/c/code-security-and-analysis/codeql)
- **Docker社区**: [Docker论坛](https://forums.docker.com/)
- **Node.js社区**: [Node.js社区](https://nodejs.org/en/community/)

### 技术支持
- **项目Issues**: [GitHub Issues](https://github.com/your-org/llmchat/issues)
- **讨论区**: [GitHub Discussions](https://github.com/your-org/llmchat/discussions)
- **Wiki**: [项目Wiki](https://github.com/your-org/llmchat/wiki)

---

*本文档持续更新，最后更新时间: 2025-10-18*