# LLMChat 部署运维指南

## 📋 目录
- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [部署架构](#部署架构)
- [多环境部署](#多环境部署)
- [Docker部署](#docker部署)
- [Kubernetes部署](#kubernetes部署)
- [监控与运维](#监控与运维)
- [故障排除](#故障排除)

## 🚀 快速开始

### 一键部署（开发环境）
```bash
# 克隆项目
git clone https://github.com/your-org/llmchat.git
cd llmchat

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件配置必要参数

# 构建并运行
pnpm run build
pnpm start
```

### 使用部署脚本
```bash
# 部署到开发环境
./scripts/deployment/deploy.sh development

# 部署到测试环境
./scripts/deployment/deploy.sh staging --backup

# 部署到生产环境
./scripts/deployment/deploy.sh production --backup --force

# 回滚部署
./scripts/deployment/deploy.sh production --rollback
```

## 📋 环境要求

### 基础要求
- **Node.js**: >= 20.0.0
- **pnpm**: >= 8.0.0
- **Docker**: >= 20.10.0
- **Git**: >= 2.30.0

### 系统要求
- **CPU**: 最少2核，推荐4核+
- **内存**: 最少4GB，推荐8GB+
- **存储**: 最少10GB可用空间
- **网络**: 稳定的互联网连接

### 数据库要求
- **PostgreSQL**: >= 13.0
- **Redis**: >= 6.0

### 可选组件
- **Kubernetes**: >= 1.24 (生产环境)
- **Nginx**: >= 1.20 (反向代理)
- **Prometheus**: >= 2.30 (监控)
- **Grafana**: >= 8.0 (可视化)

## 🏗️ 部署架构

### 架构概览
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 (React)   │    │  后端 (Node.js) │    │   数据库 (PG)    │
│   Port: 3000    │◄──►│   Port: 3001    │◄──►│   Port: 5432    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   缓存 (Redis)   │
                       │   Port: 6379    │
                       │                 │
                       └─────────────────┘
```

### 容器化架构
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    image: llmchat/frontend:latest
    ports:
      - "3000:80"
    depends_on:
      - backend

  backend:
    image: llmchat/backend:latest
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/llmchat
      - REDIS_URL=redis://redis:6379

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=llmchat
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 🌍 多环境部署

### 环境配置结构
```
config/
├── deployment.yml           # 部署配置
├── environments/
│   ├── development.yml      # 开发环境配置
│   ├── staging.yml         # 测试环境配置
│   └── production.yml      # 生产环境配置
└── secrets/
    ├── development.env      # 开发环境密钥
    ├── staging.env         # 测试环境密钥
    └── production.env      # 生产环境密钥
```

### 环境差异对比

| 配置项 | 开发环境 | 测试环境 | 生产环境 |
|--------|----------|----------|----------|
| 副本数 | 1 | 2 | 3+ |
| 资源限制 | 1CPU/1GB | 2CPU/2GB | 4CPU/4GB |
| 调试模式 | 开启 | 关闭 | 关闭 |
| 日志级别 | debug | info | warn |
| 监控 | 基础 | 完整 | 全面 |
| 备份 | 手动 | 自动 | 自动+异地 |

### 环境切换
```bash
# 查看当前环境
echo $NODE_ENV

# 切换环境
export NODE_ENV=production
export DEPLOYMENT_ENV=production

# 使用环境配置
./scripts/deployment/deploy.sh $DEPLOYMENT_ENV
```

## 🐳 Docker部署

### 构建镜像
```bash
# 构建应用镜像
docker build -t llmchat:latest .

# 构建特定环境镜像
docker build \
  --build-arg NODE_ENV=production \
  --build-arg VERSION=1.0.0 \
  -t llmchat:production \
  .

# 多阶段构建
docker build \
  --target builder \
  -t llmchat:builder \
  .
```

### Docker Compose部署
```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

### 生产级Docker配置
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json pnpm-lock.yaml ./
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# 安装pnpm
RUN npm install -g pnpm@latest

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY backend/ backend/
COPY frontend/ frontend/
COPY shared-types/ shared-types/

# 构建应用
RUN pnpm run build

# 生产镜像
FROM node:20-alpine AS production

# 安装生产依赖
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 设置权限
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "backend/dist/index.js"]
```

## ☸️ Kubernetes部署

### 命名空间配置
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: llmchat
  labels:
    name: llmchat
    environment: production
```

### ConfigMap配置
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: llmchat-config
  namespace: llmchat
data:
  NODE_ENV: "production"
  PORT: "3001"
  LOG_LEVEL: "info"
  API_RATE_LIMIT: "1000"
```

### Secret配置
```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: llmchat-secrets
  namespace: llmchat
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  REDIS_URL: <base64-encoded-redis-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
```

### 部署配置
```yaml
# k8s/deployment.yaml
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
      - name: llmchat-backend
        image: llmchat:production
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: llmchat-config
        - secretRef:
            name: llmchat-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health/live
            port: 3001
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
```

### 服务配置
```yaml
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
    port: 80
    targetPort: 3001
  type: ClusterIP
```

### Ingress配置
```yaml
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
    - llmchat.example.com
    secretName: llmchat-tls
  rules:
  - host: llmchat.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llmchat-backend-service
            port:
              number: 80
```

### HPA配置
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llmchat-hpa
  namespace: llmchat
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llmchat-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### K8s部署命令
```bash
# 创建命名空间
kubectl apply -f k8s/namespace.yaml

# 部署配置
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 部署应用
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# 查看部署状态
kubectl get pods -n llmchat
kubectl get services -n llmchat
kubectl get ingress -n llmchat

# 查看日志
kubectl logs -f deployment/llmchat-backend -n llmchat

# 扩缩容
kubectl scale deployment llmchat-backend --replicas=5 -n llmchat

# 更新部署
kubectl set image deployment/llmchat-backend llmchat-backend=llmchat:v1.1.0 -n llmchat
```

## 📊 监控与运维

### 健康检查
```bash
# 使用健康检查脚本
./scripts/monitoring/health-check.sh production

# 持续监控
./scripts/monitoring/health-check.sh production --watch --interval 60

# 检查特定组件
./scripts/monitoring/health-check.sh production --component api

# JSON格式输出
./scripts/monitoring/health-check.sh production --format json
```

### 日志管理
```bash
# 查看应用日志
docker logs -f llmchat-production

# 查看K8s日志
kubectl logs -f deployment/llmchat-backend -n llmchat

# 日志聚合
# 使用ELK Stack或Loki进行日志收集
```

### 性能监控
```yaml
# Prometheus配置
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'llmchat'
    static_configs:
      - targets: ['llmchat.example.com:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### 告警配置
```yaml
# AlertManager规则
groups:
- name: llmchat.rules
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 5% for 2 minutes"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is above 500ms"
```

## 🔧 运维操作

### 备份恢复
```bash
# 数据库备份
pg_dump -h $DATABASE_HOST -U $DATABASE_USER $DATABASE_NAME > backup.sql

# Redis备份
redis-cli --rdb /data/backup.rdb

# 恢复数据库
psql -h $DATABASE_HOST -U $DATABASE_USER $DATABASE_NAME < backup.sql

# 恢复Redis
redis-cli --rdb /data/backup.rdb
```

### 配置更新
```bash
# 热更新配置
curl -X POST http://localhost:3001/api/config/reload

# 重新加载智能体配置
curl -X POST http://localhost:3001/api/agents/reload

# 更新环境变量
# 修改 .env 文件后重启服务
docker restart llmchat-production
```

### 版本管理
```bash
# 查看当前版本
curl http://localhost:3001/api/version

# 版本回滚
./scripts/deployment/deploy.sh production --rollback

# 蓝绿部署
# 使用脚本实现蓝绿部署逻辑
```

## 🔍 故障排除

### 常见问题

#### 1. 应用无法启动
```bash
# 检查日志
docker logs llmchat-production

# 检查端口占用
netstat -tulpn | grep :3001

# 检查环境变量
docker exec llmchat-production env | grep -E "(DATABASE_URL|REDIS_URL)"

# 检查依赖服务
docker exec llmchat-production ping postgres
docker exec llmchat-production ping redis
```

#### 2. 数据库连接失败
```bash
# 检查数据库状态
docker exec postgres pg_isready

# 测试连接
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME -c "SELECT 1;"

# 检查连接池
curl http://localhost:3001/api/health/database
```

#### 3. Redis连接问题
```bash
# 检查Redis状态
docker exec redis redis-cli ping

# 检查内存使用
docker exec redis redis-cli info memory

# 检查连接数
docker exec redis redis-cli info clients
```

#### 4. 性能问题
```bash
# 检查CPU使用
docker stats llmchat-production

# 检查内存使用
docker exec llmchat-production node --inspect=0.0.0.0:9229

# 性能分析
npm install -g clinic
clinic doctor -- node backend/dist/index.js
```

#### 5. SSL证书问题
```bash
# 检查证书
openssl s_client -connect llmchat.example.com:443

# 更新证书
certbot renew --dry-run

# 检查证书有效期
openssl x509 -in /etc/letsencrypt/live/llmchat.example.com/cert.pem -text -noout
```

### 调试技巧

#### 1. 启用调试模式
```bash
# 设置调试环境变量
export DEBUG=llmchat:*
export NODE_OPTIONS=--inspect

# 启动调试模式
npm run dev
```

#### 2. 查看详细日志
```bash
# 启用详细日志
export LOG_LEVEL=debug

# 查看结构化日志
docker logs llmchat-production | jq '.'
```

#### 3. 网络调试
```bash
# 检查网络连通性
docker exec llmchat-production curl -v http://postgres:5432

# 检查DNS解析
docker exec llmchat-production nslookup postgres
```

### 监控脚本
```bash
#!/bin/bash
# 系统健康检查脚本

echo "=== LLMChat 系统状态检查 ==="

# 检查容器状态
echo "📦 容器状态:"
docker ps --filter "name=llmchat" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 检查资源使用
echo -e "\n📊 资源使用:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# 检查健康状态
echo -e "\n🔍 健康检查:"
curl -s http://localhost:3001/api/health | jq '.'

# 检查日志错误
echo -e "\n❌ 最近错误:"
docker logs --tail 10 llmchat-production 2>&1 | grep -i error || echo "无错误日志"

echo -e "\n=== 检查完成 ==="
```

## 📚 参考资源

### 官方文档
- [Node.js 官方文档](https://nodejs.org/docs/)
- [Docker 官方文档](https://docs.docker.com/)
- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Redis 官方文档](https://redis.io/documentation/)

### 工具文档
- [pnpm 文档](https://pnpm.io/)
- [Jest 测试框架](https://jestjs.io/)
- [Playwright E2E测试](https://playwright.dev/)
- [Prometheus 监控](https://prometheus.io/docs/)
- [Grafana 可视化](https://grafana.com/docs/)

### 最佳实践
- [12-Factor App](https://12factor.net/)
- [Docker最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Kubernetes最佳实践](https://kubernetes.io/docs/concepts/cluster-administration/best-practices/)

---

**最后更新**: 2025-01-18
**版本**: v1.0.0
**维护者**: DevOps团队