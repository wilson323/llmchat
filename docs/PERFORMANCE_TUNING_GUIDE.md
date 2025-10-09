# 🚀 性能调优指南

**适用场景**: 支持最大 **1000 并发**的高性能配置

---

## 📋 核心配置概览

| 组件 | 配置项 | 推荐值 | 说明 |
|------|-------|--------|------|
| **数据库连接池** | max | 50 | 支持1000并发（每20并发1个连接） |
| **数据库连接池** | min | 5 | 最小保持连接 |
| **速率限制** | max | 1000/min | 每分钟最大1000请求 |
| **请求去重** | maxConcurrent | 1000 | 最大并发请求数 |
| **Redis连接** | 重连策略 | 指数退避 | 最大3秒间隔 |
| **SSE流式** | 压缩 | 禁用 | 避免缓冲延迟 |

---

## 🔧 环境变量配置

### 生产环境 `.env` 配置示例

```bash
# =================================
# ⚡ 高并发性能配置（1000并发）
# =================================

# 服务器配置
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com

# 速率限制（每分钟1000请求）
RATE_LIMIT_POINTS=1000
RATE_LIMIT_DURATION=60
RATE_LIMIT_BLOCK_DURATION=60
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000

# 请求超时（30秒）
REQUEST_TIMEOUT=30000

# 数据库连接池（PostgreSQL）
DB_HOST=localhost
DB_PORT=5432
DB_USER=llmchat
DB_PASSWORD=your_secure_password
DB_NAME=llmchat
# 连接池大小（支持1000并发）
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000

# Redis配置（缓存 + 分布式锁）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_MAX_RETRIES=10

# 熔断器配置
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# 重试配置
RETRY_MAX_RETRIES=3
RETRY_BASE_DELAY=1000
RETRY_MAX_DELAY=10000
RETRY_BACKOFF_FACTOR=2
RETRY_ENABLE_JITTER=true

# 监控配置
SENTRY_ENABLED=true
SENTRY_DSN=your_sentry_dsn
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# 日志级别
LOG_LEVEL=info
```

---

## 🗄️ 数据库优化

### 1. PostgreSQL 配置优化

编辑 `postgresql.conf`:

```ini
# 连接配置
max_connections = 200              # 支持多实例，每实例50连接
shared_buffers = 256MB             # 共享缓冲区
effective_cache_size = 1GB         # 有效缓存大小
maintenance_work_mem = 64MB        # 维护操作内存
checkpoint_completion_target = 0.9 # 检查点完成目标
wal_buffers = 16MB                 # WAL 缓冲区
default_statistics_target = 100    # 统计目标
random_page_cost = 1.1             # SSD 随机访问成本
effective_io_concurrency = 200     # IO 并发
work_mem = 4MB                     # 工作内存
min_wal_size = 1GB                 # 最小 WAL 大小
max_wal_size = 4GB                 # 最大 WAL 大小
```

### 2. 索引优化

运行数据库迁移脚本：

```bash
psql -U llmchat -d llmchat -f backend/src/db/migrations/add_performance_indexes.sql
```

关键索引：
- `chat_sessions(user_id, updated_at DESC)` - 用户会话查询
- `chat_messages(session_id, created_at ASC)` - 消息历史查询
- `agent_configs(provider, is_active)` - 智能体查询

### 3. 连接池监控

```sql
-- 查看活跃连接
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- 查看连接池状态
SELECT 
  datname,
  numbackends as active_connections,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  (blks_hit::float / (blks_read + blks_hit + 0.0001)) * 100 as cache_hit_ratio
FROM pg_stat_database
WHERE datname = 'llmchat';
```

---

## 💾 Redis 优化

### 1. Redis 配置

编辑 `redis.conf`:

```ini
# 最大内存（根据服务器调整）
maxmemory 2gb
maxmemory-policy allkeys-lru

# 持久化（根据需求选择）
save 900 1
save 300 10
save 60 10000

# 网络优化
tcp-backlog 511
timeout 0
tcp-keepalive 300

# 性能优化
maxclients 10000
```

### 2. 缓存策略

```typescript
// 智能体列表缓存（5分钟）
const agents = await cache.getOrSet(
  'agents:list',
  () => fetchAgentsFromDB(),
  { ttl: 300 }
);

// 会话元数据缓存（10分钟）
const session = await cache.getOrSet(
  `session:${sessionId}`,
  () => fetchSessionFromDB(sessionId),
  { ttl: 600 }
);

// 用户信息缓存（15分钟）
const user = await cache.getOrSet(
  `user:${userId}`,
  () => fetchUserFromDB(userId),
  { ttl: 900 }
);
```

---

## 🌐 Nginx 反向代理优化

### 配置示例

```nginx
upstream llmchat_backend {
  # 多实例负载均衡
  least_conn;                          # 最少连接算法
  server 127.0.0.1:3001 weight=1;
  server 127.0.0.1:3002 weight=1;
  server 127.0.0.1:3003 weight=1;
  keepalive 32;                        # 保持连接池
}

server {
  listen 80;
  server_name yourdomain.com;
  
  # 客户端配置
  client_max_body_size 10M;
  client_body_timeout 30s;
  client_header_timeout 30s;
  
  # 代理配置
  location /api/ {
    proxy_pass http://llmchat_backend;
    proxy_http_version 1.1;
    
    # 保持连接
    proxy_set_header Connection "";
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # 请求头
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # 超时配置
    proxy_connect_timeout 10s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
    
    # 缓冲配置
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
  }
  
  # SSE 流式端点（禁用缓冲）
  location /api/chat/completions {
    proxy_pass http://llmchat_backend;
    proxy_http_version 1.1;
    
    # 禁用缓冲（SSE 必须）
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection "";
    
    # 禁用压缩
    gzip off;
    
    # 超时配置（SSE 长连接）
    proxy_connect_timeout 10s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    
    # SSE 特殊头
    proxy_set_header X-Accel-Buffering no;
  }
  
  # 静态资源（前端）
  location / {
    root /var/www/llmchat/frontend/dist;
    try_files $uri $uri/ /index.html;
    
    # 缓存配置
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## 📊 压力测试

### k6 压力测试（1000并发）

```bash
# 运行压力测试
k6 run tests/load/k6-stress-test.js

# 带输出
k6 run --out json=k6-results.json tests/load/k6-stress-test.js

# 自定义目标
k6 run -e BASE_URL=https://yourdomain.com tests/load/k6-stress-test.js
```

### Artillery 压力测试

```bash
# 运行压力测试
artillery run tests/load/artillery-config.yml

# 生成报告
artillery run --output report.json tests/load/artillery-config.yml
artillery report report.json
```

### 性能基线

| 指标 | 目标值 | 实际值 | 状态 |
|------|--------|--------|------|
| **p50 响应时间** | <200ms | 待测 | ⚠️ |
| **p95 响应时间** | <1000ms | 待测 | ⚠️ |
| **p99 响应时间** | <2000ms | 待测 | ⚠️ |
| **QPS** | ≥50 req/s | 待测 | ⚠️ |
| **错误率** | <2% | 待测 | ⚠️ |
| **并发支持** | 1000 | 配置完成 | ✅ |

---

## 🔍 监控指标

### 关键指标

```typescript
// 1. 请求吞吐量
const qps = totalRequests / duration;

// 2. 响应时间分布
const p50 = calculatePercentile(responseTimes, 50);
const p95 = calculatePercentile(responseTimes, 95);
const p99 = calculatePercentile(responseTimes, 99);

// 3. 错误率
const errorRate = (failedRequests / totalRequests) * 100;

// 4. 数据库连接池使用率
const poolUsage = (activeConnections / maxConnections) * 100;

// 5. Redis 缓存命中率
const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
```

### Prometheus 指标导出

```typescript
// backend/src/routes/metrics.ts
router.get('/metrics', async (req, res) => {
  const metrics = {
    // 请求指标
    http_requests_total: requestCount,
    http_request_duration_seconds: responseTimes,
    http_request_errors_total: errorCount,
    
    // 数据库指标
    db_connections_active: pool.totalCount,
    db_connections_idle: pool.idleCount,
    db_connections_waiting: pool.waitingCount,
    
    // Redis 指标
    cache_hits_total: cacheService.getStats().hits,
    cache_misses_total: cacheService.getStats().misses,
    cache_hit_rate: cacheService.getStats().hitRate,
    
    // 熔断器指标
    circuit_breaker_open: circuitBreakerService.getOpenCount(),
    circuit_breaker_half_open: circuitBreakerService.getHalfOpenCount(),
  };
  
  res.set('Content-Type', 'text/plain');
  res.send(formatPrometheusMetrics(metrics));
});
```

---

## 🐛 常见问题排查

### 1. 数据库连接池耗尽

**症状**: `TimeoutError: timeout acquiring a connection`

**解决**:
```bash
# 检查活跃连接
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# 增加连接池大小
DB_MAX_CONNECTIONS=100

# 优化慢查询
EXPLAIN ANALYZE <your_slow_query>;
```

### 2. Redis 连接失败

**症状**: `ECONNREFUSED` 或 `ETIMEDOUT`

**解决**:
```bash
# 检查 Redis 状态
redis-cli ping

# 检查最大客户端连接
redis-cli config get maxclients

# 增加最大连接数
redis-cli config set maxclients 10000
```

### 3. 高延迟

**症状**: p95 > 2000ms

**排查**:
1. 检查数据库慢查询日志
2. 检查 Redis 缓存命中率
3. 检查网络延迟
4. 检查外部 API 调用时间
5. 启用 APM 追踪

### 4. 内存泄漏

**症状**: 内存持续增长

**排查**:
```bash
# 生成堆快照
node --heap-prof app.js

# 分析内存使用
node --inspect app.js
# 访问 chrome://inspect

# 监控内存
GET /health/detailed
```

---

## ✅ 性能检查清单

- [ ] 数据库连接池配置为 50
- [ ] 速率限制设置为 1000/分钟
- [ ] Redis 缓存已启用
- [ ] 所有关键索引已创建
- [ ] SSE 端点禁用压缩
- [ ] Nginx 反向代理已配置
- [ ] 熔断器已启用
- [ ] 压力测试已完成
- [ ] 监控指标已导出
- [ ] 日志聚合已配置

---

**文档版本**: 1.0  
**最后更新**: 2025-10-03  
**维护者**: LLMChat 开发团队
