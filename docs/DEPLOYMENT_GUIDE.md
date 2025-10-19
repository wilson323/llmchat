# LLMChat 生产部署指南

> **版本**: 1.0.0  
> **最后更新**: 2025-10-03  
> **状态**: 生产就绪

---

## 🎯 部署前检查清单

### 必备条件
- [ ] Node.js 18+ 已安装
- [ ] PostgreSQL 15+ 已安装并运行
- [ ] pnpm已安装（`npm install -g pnpm`）
- [ ] 所有环境变量已配置
- [ ] 数据库已创建并迁移
- [ ] 所有测试通过（`pnpm test:all`）

### 监控配置
- [ ] Sentry DSN已配置（前后端）
- [ ] Google Analytics / 自定义分析已配置
- [ ] 日志收集已配置

### 安全检查
- [ ] API密钥已妥善保管（不在代码中）
- [ ] CORS配置正确
- [ ] 速率限制已启用
- [ ] Helmet安全头部已配置

---

## 📝 环境变量配置

### 后端环境变量 (`backend/.env`)

```env
# 应用配置
NODE_ENV=production
PORT=3001
APP_VERSION=1.0.0

# 数据库
DATABASE_URL=postgresql://username:password@host:5432/llmchat

# 前端URL（CORS）
FRONTEND_URL=https://your-domain.com

# Sentry监控
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
SENTRY_ENABLED=true

# 速率限制
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# 智能体提供商API密钥（可选，也可在agents.json中配置）
FASTGPT_API_KEY=your-fastgpt-key
DIFY_API_KEY=your-dify-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### 前端环境变量 (`.env.production`)

```env
# API地址
VITE_API_URL=https://api.your-domain.com

# Sentry监控
VITE_SENTRY_DSN=https://your-frontend-sentry-dsn@sentry.io/project
VITE_SENTRY_ENABLED=true
VITE_APP_VERSION=1.0.0

# 用户行为分析
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_ENDPOINT=https://your-analytics-endpoint.com/track

# Google Analytics (可选)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## 🏗️ 构建步骤

### 1. 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 2. 数据库迁移

```bash
# 运行所有迁移脚本
cd backend
psql -U username -d llmchat -f src/migrations/001_create_agent_configs_table.sql
psql -U username -d llmchat -f src/migrations/002_add_features_column.sql
# ... 依次运行所有迁移
```

### 3. 配置智能体

编辑 `config/agents.json`，配置您的AI智能体：

```json
{
  "agents": [
    {
      "id": "my-agent",
      "name": "我的智能体",
      "provider": "fastgpt",
      "endpoint": "https://api.fastgpt.in",
      "apiKey": "fgt-xxx",
      "appId": "xxx",
      "model": "gpt-3.5-turbo",
      "isActive": true
    }
  ]
}
```

### 4. 构建应用

```bash
# 构建前后端
pnpm run build

# 检查构建产物
ls -la backend/dist
ls -la frontend/dist
```

### 5. 运行测试（可选但推荐）

```bash
# 运行所有测试
pnpm run test:all

# 只运行单元测试
pnpm run test:unit

# 只运行E2E测试
pnpm run test:e2e
```

---

## 🚀 部署方式

### 方式1: Node.js直接部署

```bash
# 后端
cd backend
NODE_ENV=production node dist/index.js

# 前端（使用静态服务器）
cd frontend
npx serve -s dist -p 3000
```

### 方式2: PM2部署（推荐）

#### 安装PM2

```bash
npm install -g pm2
```

#### 后端PM2配置 (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [
    {
      name: 'llmchat-backend',
      script: './backend/dist/index.js',
      instances: 2, // 使用2个实例（集群模式）
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './backend/log/pm2-error.log',
      out_file: './backend/log/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 3000,
    },
    {
      name: 'llmchat-frontend',
      script: 'npx',
      args: ['serve', '-s', 'dist', '-p', '3000'],
      cwd: './frontend',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './frontend/log/pm2-error.log',
      out_file: './frontend/log/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      restart_delay: 3000,
    }
  ],
};
```

#### 启动PM2

```bash
# 启动
pm2 start ecosystem.config.js --env production

# 保存配置
pm2 save

# 设置开机自启
pm2 startup

# 监控
pm2 monit
```

### 方式3: Docker部署

#### Dockerfile（后端）

```dockerfile
FROM node:18-alpine AS base

# 安装必要的系统依赖
RUN apk add --no-cache curl

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package.json pnpm-lock.yaml ./

# 安装pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 生产阶段
FROM node:18-alpine AS runner

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nodejs

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY --from=base --chown=nodejs:nodejs /app/dist ./dist
COPY --from=base --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs /app/package.json ./

# 创建日志目录
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 启动应用
CMD ["node", "dist/index.js"]
```

#### Dockerfile（前端）

```dockerfile
FROM node:18-alpine AS base

# 安装pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# Nginx配置
FROM nginx:alpine AS runner

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 复制构建产物
COPY --from=base /app/dist /usr/share/nginx/html

# 创建非root用户
RUN addgroup --system --gid 1001 nginx && \
    adduser --system --uid 1001 --gid 1001 nginx

# 设置权限
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# 创建nginx运行时需要的目录
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx

# 切换到非root用户
USER nginx

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml（开发环境）

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/llmchat
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - llmchat-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - llmchat-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=llmchat
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/src/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - llmchat-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - llmchat-network

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - llmchat-network

volumes:
  postgres_data:
  redis_data:

networks:
  llmchat-network:
    driver: bridge
```

#### docker-compose.prod.yml（生产环境）

```yaml
version: '3.8'

services:
  backend:
    image: llmchat/backend:${VERSION:-latest}
    restart: always
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - llmchat-network
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  frontend:
    image: llmchat/frontend:${VERSION:-latest}
    restart: always
    networks:
      - llmchat-network
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
        reservations:
          memory: 128M
          cpus: '0.125'

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - llmchat-network
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD} --maxmemory 256mb
    volumes:
      - redis_data:/data
    networks:
      - llmchat-network
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
        reservations:
          memory: 128M
          cpus: '0.125'

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - llmchat-network
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.25'
        reservations:
          memory: 64M
          cpus: '0.125'

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  backups:
    driver: local

networks:
  llmchat-network:
    driver: bridge
```

#### Docker多阶段构建优化

```dockerfile
# backend/Dockerfile.optimized
FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 类型检查
RUN pnpm run type-check

# 构建
RUN pnpm run build

# 生产阶段
FROM node:18-alpine AS runner

# 安全配置
RUN apk add --no-cache dumb-init curl

# 创建应用用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nodejs

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# 创建必要的目录
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app/logs /app/uploads

# 设置权限
USER nodejs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# 使用dumb-init作为PID 1
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/index.js"]
```

#### 启动Docker

```bash
# 开发环境
docker-compose up -d

# 生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 构建镜像
docker-compose build

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down

# 更新服务
docker-compose pull
docker-compose up -d --force-recreate
```

### 方式4: Kubernetes部署

#### Kubernetes清单

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: llmchat
  labels:
    name: llmchat
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: llmchat-config
  namespace: llmchat
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: llmchat-secrets
  namespace: llmchat
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  OPENAI_API_KEY: <base64-encoded-openai-key>
---
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llmchat-backend
  namespace: llmchat
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llmchat-backend
  template:
    metadata:
      labels:
        app: llmchat-backend
    spec:
      containers:
      - name: backend
        image: llmchat/backend:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: llmchat-config
        - secretRef:
            name: llmchat-secrets
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
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: llmchat-backend-service
  namespace: llmchat
spec:
  selector:
    app: llmchat-backend
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: llmchat-ingress
  namespace: llmchat
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - llmchat.yourdomain.com
    secretName: llmchat-tls
  rules:
  - host: llmchat.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: llmchat-backend-service
            port:
              number: 3001
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llmchat-frontend-service
            port:
              number: 80
```

#### Kubernetes部署脚本

```bash
#!/bin/bash
# k8s/deploy.sh

set -e

echo "开始部署LLMChat到Kubernetes..."

# 应用配置
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 部署数据库
kubectl apply -f k8s/postgres.yaml
kubectl apply - f k8s/redis.yaml

# 等待数据库就绪
echo "等待数据库启动..."
kubectl wait --for=condition=ready pod -l app=postgres -n llmchat --timeout=300s

# 运行数据库迁移
kubectl run migration --image=llmchat/backend:latest --rm -i --restart=Never \
  --env="DATABASE_URL=$(kubectl get secret llmchat-secrets -n llmchat -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
  --env="NODE_ENV=production" \
  --command="pnpm run migrate:up"

# 部署应用
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# 等待应用就绪
echo "等待应用启动..."
kubectl wait --for=condition=available deployment/llmchat-backend -n llmchat --timeout=300s
kubectl wait --for=condition=available deployment/llmchat-frontend -n llmchat --timeout=300s

echo "部署完成！"
echo "访问地址: https://llmchat.yourdomain.com"
```

### 方式5: 云平台部署

#### AWS ECS部署

```json
{
  "family": "llmchat",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "llmchat/backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:llmchat/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/llmchat",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:llmchat/database-url"
        }
      ]
    }
  ]
}
```

#### 阿里云ACK部署

```yaml
# 阿里云ACK服务配置
apiVersion: v1
kind: Service
metadata:
  name: llmchat-backend-service
spec:
  type: LoadBalancer
  selector:
    app: llmchat-backend
  ports:
  - port: 80
    targetPort: 3001
    protocol: TCP
  sessionAffinity: None
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llmchat-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: registry.cn-hangzhou.aliyuncs.com/llmchat/backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: llmchat-secrets
              key: database-url
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
```

---

## 🌐 Nginx反向代理配置

```nginx
# /etc/nginx/sites-available/llmchat

# 上游服务器
upstream backend {
    server localhost:3001;
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS主配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL证书
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API代理
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE流式响应支持
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend;
        access_log off;
    }

    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
    }

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

### 启用Nginx配置

```bash
sudo ln -s /etc/nginx/sites-available/llmchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 监控配置

### 1. Sentry配置

访问 [sentry.io](https://sentry.io) 创建项目，获取DSN。

### 2. 日志管理

```bash
# 后端日志位置
backend/log/app-YYYY-MM-DD.log       # 应用日志
backend/log/error-YYYY-MM-DD.log     # 错误日志
backend/log/audit-YYYY-MM-DD.log     # 审计日志

# PM2日志
~/.pm2/logs/llmchat-backend-error.log
~/.pm2/logs/llmchat-backend-out.log
```

### 3. 健康检查

```bash
# 检查后端健康
curl http://localhost:3001/health

# 预期响应
{
  "status": "ok",
  "timestamp": "2025-10-03T...",
  "uptime": 12345,
  "version": "1.0.0"
}
```

---

## 🔐 安全最佳实践

### 1. 环境变量
- ✅ 使用`.env`文件管理敏感信息
- ✅ 不要提交`.env`到Git
- ✅ 使用密钥管理服务（AWS Secrets Manager / HashiCorp Vault）

### 2. 数据库
- ✅ 使用强密码
- ✅ 限制数据库访问IP
- ✅ 定期备份
- ✅ 使用SSL连接

### 3. API安全
- ✅ 启用速率限制
- ✅ 使用HTTPS
- ✅ 验证所有输入
- ✅ 实施CORS策略

### 4. 依赖安全
```bash
# 定期检查漏洞
pnpm audit

# 自动修复（谨慎）
pnpm audit --fix
```

---

## 🔄 CI/CD集成

GitHub Actions已配置（`.github/workflows/ci.yml`），每次push会自动：
- ✅ Lint检查
- ✅ 类型检查
- ✅ 单元测试
- ✅ E2E测试
- ✅ 构建验证
- ✅ 安全扫描

### 自动部署（可选）

添加部署步骤到`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [build, test]
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/llmchat
            git pull
            pnpm install
            pnpm run build
            pm2 restart llmchat-backend
```

---

## 🐛 故障排查

### 问题1: 后端无法启动

```bash
# 检查端口占用
lsof -i :3001

# 检查日志
tail -f backend/log/error-*.log

# 检查环境变量
node -e "require('dotenv').config({path:'backend/.env'}); console.log(process.env)"
```

### 问题2: 数据库连接失败

```bash
# 测试数据库连接
psql -U username -d llmchat -h host -p 5432

# 检查DATABASE_URL格式
echo $DATABASE_URL
```

### 问题3: 前端无法访问API

```bash
# 检查CORS配置
curl -H "Origin: https://your-domain.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS http://api.your-domain.com/api/agents

# 检查Nginx代理
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### 问题4: Service Worker无法注册

- 检查是否在HTTPS环境（或localhost）
- 检查`sw.js`是否在public根目录
- 清除浏览器缓存

---

## 📈 性能优化建议

### 1. 后端
- ✅ 启用compression
- ✅ 使用PM2集群模式
- ✅ 配置Redis缓存（可选）
- ✅ 数据库连接池优化

### 2. 前端
- ✅ 使用CDN托管静态资源
- ✅ 启用Service Worker缓存
- ✅ 图片懒加载
- ✅ 代码分割（已配置）

### 3. 数据库
- ✅ 添加合适的索引
- ✅ 定期VACUUM清理
- ✅ 配置连接池
- ✅ 使用只读副本（高负载时）

---

## 🎉 部署完成确认

部署完成后，依次确认：

- [ ] 访问 `https://your-domain.com` 能正常打开
- [ ] 登录管理员账号成功
- [ ] 创建/编辑智能体功能正常
- [ ] 聊天功能正常（发送消息、接收响应）
- [ ] 语言切换功能正常
- [ ] 健康检查API正常 `/health`
- [ ] Sentry错误追踪正常（触发一个测试错误）
- [ ] Web Vitals数据正常上报
- [ ] Service Worker正常注册（检查DevTools → Application）
- [ ] 所有静态资源加载正常

---

## 📞 支持与维护

### 日常维护

```bash
# 查看PM2状态
pm2 status

# 查看日志
pm2 logs llmchat-backend

# 重启服务
pm2 restart llmchat-backend

# 数据库备份
pg_dump -U username llmchat > backup-$(date +%Y%m%d).sql
```

### 性能监控

- Sentry仪表板: 错误和性能追踪
- Google Analytics: 用户行为分析
- PM2监控: `pm2 monit`

---

**祝您部署顺利！** 🚀

**如有问题，请参考**:
- [CI/CD指南](./CI_CD_GUIDE.md)
- [故障排查指南](./TROUBLESHOOTING.md)
- [开发文档](./development-guidelines.md)

