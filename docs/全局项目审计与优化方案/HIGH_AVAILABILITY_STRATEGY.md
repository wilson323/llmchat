# 高可用性策略 - 全局项目优化

## 🎯 高可用性目标

**可用性指标**: 99.9% (每月停机时间 < 43分钟)  
**RTO** (恢复时间目标): < 5分钟  
**RPO** (恢复点目标): < 1分钟  

---

## 🔒 核心高可用策略

### 1. 服务层高可用

#### 1.1 零停机部署
```bash
# 使用PM2滚动重启
pm2 reload backend --update-env

# 使用K8s滚动更新
kubectl rollout restart deployment/llmchat-backend

# 蓝绿部署策略
# - 保留旧版本运行
# - 新版本通过健康检查后切流量
# - 验证无问题后下线旧版本
```

#### 1.2 健康检查增强
```typescript
// backend/src/routes/health.ts (增强版)
export const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      redis: 'unknown',
      memory: 'unknown',
    },
  };

  try {
    // 1. 数据库健康检查 (超时2秒)
    const dbStart = Date.now();
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('DB timeout')), 2000)
      ),
    ]);
    health.checks.database = 'healthy';
    
    // 2. Redis健康检查 (超时2秒)
    const redisStart = Date.now();
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis timeout')), 2000)
      ),
    ]);
    health.checks.redis = 'healthy';
    
    // 3. 内存检查 (>80%告警)
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    health.checks.memory = memPercent < 80 ? 'healthy' : 'warning';
    
    // 所有检查通过返回200
    res.status(200).json(health);
  } catch (error) {
    // 任何检查失败返回503
    health.status = 'unhealthy';
    res.status(503).json(health);
  }
};
```

#### 1.3 优雅关闭机制
```typescript
// backend/src/index.ts (优雅关闭)
let isShuttingDown = false;

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('Graceful shutdown initiated...');
  
  // 1. 停止接受新请求 (返回503)
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // 2. 等待现有请求完成 (最多30秒)
  await Promise.race([
    waitForActiveRequests(),
    new Promise(resolve => setTimeout(resolve, 30000)),
  ]);
  
  // 3. 关闭数据库连接
  await pool.end();
  logger.info('Database connections closed');
  
  // 4. 关闭Redis连接
  await redis.quit();
  logger.info('Redis connections closed');
  
  // 5. 清理定时任务
  clearInterval(metricsInterval);
  
  logger.info('Graceful shutdown completed');
  process.exit(0);
}

// 中间件：拒绝关闭期间的新请求
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close');
    return res.status(503).json({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Server is shutting down',
    });
  }
  next();
});
```

---

### 2. 数据层高可用

#### 2.1 PostgreSQL连接池优化
```typescript
// backend/src/utils/db.ts (高可用配置)
export const pool = new Pool({
  host: EnvManager.getInstance().get('DB_HOST'),
  port: parseInt(EnvManager.getInstance().get('DB_PORT', '5432')),
  user: EnvManager.getInstance().get('DB_USER'),
  password: EnvManager.getInstance().getRequired('DB_PASSWORD'),
  database: EnvManager.getInstance().get('DB_NAME'),
  
  // 连接池配置 (高可用)
  min: 5,                    // 最小连接数 (保持热连接)
  max: 20,                   // 最大连接数 (防止耗尽)
  idleTimeoutMillis: 30000,  // 空闲连接超时30秒
  connectionTimeoutMillis: 5000, // 连接超时5秒
  
  // 连接重试
  maxUses: 7500,             // 单连接最大使用次数 (防止内存泄漏)
  
  // 健康检查
  allowExitOnIdle: false,    // 禁止空闲时退出
});

// 连接池监控
pool.on('connect', (client) => {
  logger.debug('New database connection established');
});

pool.on('error', (err, client) => {
  logger.error('Database pool error', { error: err });
  // 触发告警 (集成监控系统)
  alertService.send('Database pool error', err);
});

pool.on('remove', (client) => {
  logger.debug('Database connection removed from pool');
});

// 定期检查连接池健康
setInterval(async () => {
  try {
    const { totalCount, idleCount, waitingCount } = pool;
    
    if (waitingCount > 5) {
      logger.warn('High database connection wait queue', {
        totalCount,
        idleCount,
        waitingCount,
      });
    }
    
    // 测试连接
    await pool.query('SELECT 1');
  } catch (error) {
    logger.error('Database health check failed', { error });
  }
}, 60000); // 每分钟检查
```

#### 2.2 数据库查询超时与重试
```typescript
// backend/src/utils/db.ts (查询包装器)
export async function queryWithRetry<T>(
  sql: string,
  params: any[],
  options: { maxRetries?: number; timeout?: number } = {}
): Promise<QueryResult<T>> {
  const { maxRetries = 3, timeout = 5000 } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 设置查询超时
      const client = await pool.connect();
      
      try {
        await client.query('SET statement_timeout = $1', [timeout]);
        const result = await client.query<T>(sql, params);
        return result;
      } finally {
        client.release();
      }
    } catch (error: any) {
      const isRetriable = 
        error.code === 'ECONNRESET' ||  // 连接重置
        error.code === '57P01' ||        // 管理员关闭
        error.code === '57P03';          // 无法连接
      
      if (attempt < maxRetries && isRetriable) {
        logger.warn(`Query retry ${attempt}/${maxRetries}`, { error });
        await sleep(Math.pow(2, attempt) * 100); // 指数退避
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Query failed after max retries');
}
```

#### 2.3 事务高可用
```typescript
// backend/src/utils/db.ts (事务包装器)
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rollback', { error });
    throw error;
  } finally {
    client.release();
  }
}
```

---

### 3. 缓存层高可用

#### 3.1 Redis高可用配置
```typescript
// backend/src/utils/redis.ts (高可用配置)
import Redis from 'ioredis';

export const redis = new Redis({
  host: EnvManager.getInstance().get('REDIS_HOST', 'localhost'),
  port: parseInt(EnvManager.getInstance().get('REDIS_PORT', '6379')),
  password: EnvManager.getInstance().get('REDIS_PASSWORD'),
  db: parseInt(EnvManager.getInstance().get('REDIS_DB', '0')),
  
  // 高可用配置
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000); // 最大2秒
    logger.warn(`Redis retry attempt ${times}, delay ${delay}ms`);
    return delay;
  },
  
  maxRetriesPerRequest: 3,      // 每请求最大重试3次
  enableOfflineQueue: true,      // 离线时队列缓存
  connectTimeout: 10000,         // 连接超时10秒
  
  // 自动重连
  autoResubscribe: true,
  autoResendUnfulfilledCommands: true,
});

// Redis事件监听
redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

// Redis降级策略 (内存缓存)
class CacheService {
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  
  async get(key: string): Promise<any> {
    try {
      // 尝试从Redis获取
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn('Redis get failed, fallback to memory cache', { error });
      
      // 降级到内存缓存
      const cached = this.memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }
      return null;
    }
  }
  
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      // 写入Redis
      await redis.setex(key, ttl, JSON.stringify(value));
      
      // 同时写入内存缓存 (双写)
      this.memoryCache.set(key, {
        value,
        expiry: Date.now() + ttl * 1000,
      });
    } catch (error) {
      logger.warn('Redis set failed, using memory cache only', { error });
      
      // 降级到内存缓存
      this.memoryCache.set(key, {
        value,
        expiry: Date.now() + ttl * 1000,
      });
    }
  }
  
  // 定期清理过期内存缓存
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.memoryCache.entries()) {
        if (cached.expiry <= now) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000); // 每分钟清理
  }
}

export const cacheService = new CacheService();
cacheService.startCleanup();
```

#### 3.2 Rate Limiter降级
```typescript
// backend/src/middleware/rateLimiter.ts (高可用版本)
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';

let rateLimiter: RateLimiterRedis | RateLimiterMemory;
let isRedisFailed = false;

export function createRateLimiter() {
  const envManager = EnvManager.getInstance();
  
  try {
    // 优先使用Redis
    rateLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl',
      points: parseInt(envManager.get('RATE_LIMIT_POINTS', '100')),
      duration: parseInt(envManager.get('RATE_LIMIT_DURATION', '60')),
      blockDuration: parseInt(envManager.get('RATE_LIMIT_BLOCK_DURATION', '60')),
    });
    
    logger.info('Rate limiter using Redis');
  } catch (error) {
    logger.warn('Redis rate limiter failed, fallback to memory', { error });
    isRedisFailed = true;
    
    // 降级到内存版本
    rateLimiter = new RateLimiterMemory({
      points: parseInt(envManager.get('RATE_LIMIT_POINTS', '100')),
      duration: parseInt(envManager.get('RATE_LIMIT_DURATION', '60')),
      blockDuration: parseInt(envManager.get('RATE_LIMIT_BLOCK_DURATION', '60')),
    });
    
    logger.info('Rate limiter using Memory (degraded mode)');
  }
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    
    try {
      await rateLimiter.consume(key);
      next();
    } catch (error: any) {
      if (error.msBeforeNext) {
        res.set('Retry-After', String(Math.round(error.msBeforeNext / 1000)));
        res.status(429).json({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests, please try again later',
        });
      } else {
        // Rate limiter本身失败，放行请求 (高可用优先)
        logger.error('Rate limiter error, allowing request', { error });
        next();
      }
    }
  };
}
```

---

### 4. 外部服务调用高可用

#### 4.1 熔断器模式
```typescript
// backend/src/utils/circuitBreaker.ts (新增)
export class CircuitBreaker {
  private failures = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,          // 失败阈值
    private timeout: number = 60000,        // 熔断超时60秒
    private successThreshold: number = 2    // 半开状态成功次数
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 熔断器打开，直接拒绝
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        logger.info('Circuit breaker closed');
      }
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
    };
  }
}
```

#### 4.2 FastGPT API调用高可用
```typescript
// backend/src/services/ChatProxyService.ts (高可用增强)
export class FastGPTProxy {
  private circuitBreaker = new CircuitBreaker(5, 60000, 2);
  
  async sendMessage(options: ChatOptions): Promise<ChatResponse> {
    return this.circuitBreaker.execute(async () => {
      // 设置超时
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(this.buildRequest(options)),
          signal: controller.signal,
        });
        
        if (!response.ok) {
          throw new ApiError(response.status, 'FASTGPT_ERROR', 'FastGPT request failed');
        }
        
        return await response.json();
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}
```

---

### 5. 监控与告警

#### 5.1 实时监控指标
```typescript
// backend/src/utils/metrics.ts (新增)
export class MetricsCollector {
  private metrics = {
    requests: { total: 0, success: 0, error: 0 },
    latency: { sum: 0, count: 0, p95: 0 },
    database: { connections: 0, queries: 0, errors: 0 },
    redis: { hits: 0, misses: 0, errors: 0 },
  };
  
  recordRequest(success: boolean, latency: number) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }
    
    this.metrics.latency.sum += latency;
    this.metrics.latency.count++;
  }
  
  recordDatabaseQuery(success: boolean) {
    this.metrics.database.queries++;
    if (!success) {
      this.metrics.database.errors++;
    }
  }
  
  recordCacheHit(hit: boolean) {
    if (hit) {
      this.metrics.redis.hits++;
    } else {
      this.metrics.redis.misses++;
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      latency: {
        ...this.metrics.latency,
        avg: this.metrics.latency.sum / this.metrics.latency.count,
      },
      successRate: (this.metrics.requests.success / this.metrics.requests.total) * 100,
      cacheHitRate: (this.metrics.redis.hits / (this.metrics.redis.hits + this.metrics.redis.misses)) * 100,
    };
  }
  
  // 暴露Prometheus格式指标
  getPrometheusMetrics() {
    const metrics = this.getMetrics();
    return `
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{status="success"} ${metrics.requests.success}
http_requests_total{status="error"} ${metrics.requests.error}

# HELP http_request_latency_avg Average request latency
# TYPE http_request_latency_avg gauge
http_request_latency_avg ${metrics.latency.avg}

# HELP db_queries_total Total database queries
# TYPE db_queries_total counter
db_queries_total ${metrics.database.queries}

# HELP cache_hit_rate Cache hit rate percentage
# TYPE cache_hit_rate gauge
cache_hit_rate ${metrics.cacheHitRate}
`.trim();
  }
}

export const metricsCollector = new MetricsCollector();

// 暴露指标端点
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(metricsCollector.getPrometheusMetrics());
});
```

#### 5.2 告警规则
```typescript
// backend/src/utils/alerting.ts (新增)
export class AlertService {
  private alerts: Array<{ level: string; message: string; timestamp: Date }> = [];
  
  async send(message: string, error?: Error, level: 'warning' | 'critical' = 'warning') {
    const alert = {
      level,
      message,
      timestamp: new Date(),
      error: error?.message,
      stack: error?.stack,
    };
    
    this.alerts.push(alert);
    logger[level === 'critical' ? 'error' : 'warn']('Alert triggered', alert);
    
    // 集成外部告警系统 (可选)
    // await this.sendToSlack(alert);
    // await this.sendToEmail(alert);
    // await this.sendToPagerDuty(alert);
  }
  
  getRecentAlerts(minutes: number = 60) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.alerts.filter(a => a.timestamp > cutoff);
  }
}

export const alertService = new AlertService();

// 自动监控与告警
setInterval(() => {
  const metrics = metricsCollector.getMetrics();
  
  // 错误率告警 (>5%)
  if ((metrics.requests.error / metrics.requests.total) > 0.05) {
    alertService.send('High error rate detected', undefined, 'critical');
  }
  
  // 平均延迟告警 (>1000ms)
  if (metrics.latency.avg > 1000) {
    alertService.send('High latency detected', undefined, 'warning');
  }
  
  // 数据库错误率告警 (>1%)
  if ((metrics.database.errors / metrics.database.queries) > 0.01) {
    alertService.send('Database error rate high', undefined, 'critical');
  }
  
  // 缓存命中率告警 (<50%)
  if (metrics.cacheHitRate < 50) {
    alertService.send('Low cache hit rate', undefined, 'warning');
  }
}, 60000); // 每分钟检查
```

---

## 📊 高可用检查清单

### 部署前检查
- [ ] 健康检查端点正常响应
- [ ] 数据库连接池配置合理
- [ ] Redis降级策略已验证
- [ ] 优雅关闭机制已测试
- [ ] 熔断器阈值已调优
- [ ] 监控指标已接入
- [ ] 告警规则已配置
- [ ] 备份恢复流程已演练

### 运行时监控
- [ ] 服务响应时间 <500ms (P95)
- [ ] 错误率 <1%
- [ ] 数据库连接池使用率 <80%
- [ ] Redis命中率 >70%
- [ ] 内存使用率 <80%
- [ ] CPU使用率 <70%

### 故障演练
- [ ] 数据库主从切换
- [ ] Redis故障切换
- [ ] 应用重启测试
- [ ] 网络分区测试
- [ ] 负载突增测试

---

## 🚨 紧急响应流程

### 1. 服务不可用
```bash
# 1. 检查服务状态
curl http://localhost:3001/health

# 2. 查看日志
tail -f backend/log/error.log

# 3. 重启服务
pm2 restart backend

# 4. 验证恢复
curl http://localhost:3001/api/agents
```

### 2. 数据库连接失败
```bash
# 1. 检查数据库状态
psql -h localhost -U llmchat_user -d llmchat -c "SELECT 1"

# 2. 检查连接池
curl http://localhost:3001/metrics | grep db_

# 3. 重启数据库连接池 (代码层面)
# 需要应用重启
```

### 3. Redis故障
```bash
# 1. 检查Redis状态
redis-cli -h localhost -p 6379 PING

# 2. 验证降级生效
# 应用应自动切换到内存缓存

# 3. 重启Redis (影响最小化)
# 应用会自动重连
```

---

**文档版本**: v1.0  
**创建日期**: 2025-10-03  
**最后更新**: 2025-10-03  
**责任人**: 开发团队

