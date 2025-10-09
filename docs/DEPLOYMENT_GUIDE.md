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
```

### 方式3: Docker部署

#### Dockerfile（后端）

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

#### Dockerfile（前端）

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/llmchat
    depends_on:
      - db
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=llmchat
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

#### 启动Docker

```bash
docker-compose up -d
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

