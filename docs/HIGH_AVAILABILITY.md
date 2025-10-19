# 高可用性方案
> LLMChat 99.9% 可用性保障指南 | 2025-01-15

## 🎯 可用性目标

### SLA 指标
| 指标 | 目标 | 实现方式 |
|------|------|---------|
| 系统可用性 | 99.9% | 故障转移 + 健康检查 + 自动恢复 |
| MTBF (平均故障间隔) | >720小时 | 预防性维护 + 监控告警 |
| MTTR (平均恢复时间) | <5分钟 | 自动故障切换 + 快速回滚 |
| RTO (恢复时间目标) | <10分钟 | 数据备份 + 冗余部署 |
| RPO (恢复点目标) | <1小时 | 实时数据复制 |

**可用性计算**:
- 99.9% = 每年停机时间 <8.76小时
- 99.9% = 每月停机时间 <43.8分钟
- 99.9% = 每天停机时间 <1.44分钟

---

## 🏗️ 高可用架构

### 系统架构图
```
                    ┌─────────────────┐
                    │   Nginx LoadBalancer  │  ← 健康检查
                    │   (主+备)        │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────┐          ┌───▼─────┐         ┌───▼─────┐
   │ App #1  │          │ App #2  │         │ App #3  │  ← 应用集群
   │ Active  │          │ Active  │         │ Active  │
   └────┬────┘          └───┬─────┘         └───┬─────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                ┌────────────▼───────────┐
                │    PostgreSQL          │
                │  ┌────────┬────────┐  │
                │  │Primary │Replica │  │  ← 主从复制
                │  │(RW)    │(RO)    │  │
                │  └────────┴────────┘  │
                └───────────────────────┘
                             │
                ┌────────────▼───────────┐
                │       Redis            │
                │  ┌─────────────────┐  │
                │  │ Sentinel Cluster │  │  ← 哨兵集群
                │  │  (3 nodes)       │  │
                │  └─────────────────┘  │
                └───────────────────────┘
```

---

## 🔄 故障转移策略

### 1. 应用层故障转移

#### 健康检查机制
```typescript
// backend/src/middleware/healthCheck.ts
import { Request, Response, NextFunction } from 'express';
import { checkDatabase, checkRedis, checkExternalAPIs } from '../utils/health';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    redis: boolean;
    externalAPIs: boolean;
    memory: boolean;
    cpu: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: string;
    cpuUsage: string;
  };
  timestamp: string;
}

/**
 * 健康检查端点
 */
export async function healthCheck(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // 并行执行所有健康检查
    const [database, redis, externalAPIs] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkExternalAPIs()
    ]);
    
    // 检查系统资源
    const memoryUsage = process.memoryUsage().heapUsed;
    const memoryLimit = 500 * 1024 * 1024; // 500MB
    const memory = memoryUsage < memoryLimit;
    
    const cpuLoad = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpu = cpuLoad < cpuCount;
    
    // 计算整体状态
    const checks = { database, redis, externalAPIs, memory, cpu };
    const allHealthy = Object.values(checks).every(v => v);
    const someHealthy = Object.values(checks).some(v => v);
    
    const status: HealthStatus['status'] = 
      allHealthy ? 'healthy' :
      someHealthy ? 'degraded' : 'unhealthy';
    
    // 构建响应
    const response: HealthStatus = {
      status,
      checks,
      metrics: {
        uptime: process.uptime(),
        memoryUsage: `${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        cpuUsage: `${((cpuLoad / cpuCount) * 100).toFixed(2)}%`
      },
      timestamp: new Date().toISOString()
    };
    
    // 根据状态返回不同的HTTP状态码
    const statusCode = status === 'healthy' ? 200 :
                      status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 就绪检查端点（Kubernetes readiness probe）
 */
export async function readinessCheck(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // 检查关键服务是否就绪
    const databaseReady = await checkDatabase();
    const redisReady = await checkRedis();
    
    if (databaseReady && redisReady) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
}

/**
 * 存活检查端点（Kubernetes liveness probe）
 */
export function livenessCheck(req: Request, res: Response): void {
  // 简单检查进程是否存活
  res.status(200).json({ alive: true });
}
```

#### 自动故障检测和转移
```typescript
// backend/src/services/FailoverManager.ts
export class FailoverManager {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private failureCount: Map<string, number> = new Map();
  private readonly maxFailures = 3;
  private readonly checkInterval = 10000; // 10秒
  
  /**
   * 启动故障检测
   */
  start(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.checkInterval);
  }
  
  /**
   * 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    const services = ['database', 'redis', 'api-gateway'];
    
    for (const service of services) {
      const isHealthy = await this.checkServiceHealth(service);
      
      if (!isHealthy) {
        this.handleServiceFailure(service);
      } else {
        this.failureCount.set(service, 0);
      }
    }
  }
  
  /**
   * 检查服务健康状态
   */
  private async checkServiceHealth(service: string): Promise<boolean> {
    try {
      switch (service) {
        case 'database':
          await dbPool.query('SELECT 1');
          return true;
          
        case 'redis':
          await redisClient.ping();
          return true;
          
        case 'api-gateway':
          const response = await axios.get('/health', { timeout: 5000 });
          return response.status === 200;
          
        default:
          return true;
      }
    } catch (error) {
      logger.error(`Health check failed for ${service}:`, error);
      return false;
    }
  }
  
  /**
   * 处理服务故障
   */
  private handleServiceFailure(service: string): void {
    const currentFailures = this.failureCount.get(service) || 0;
    const newFailures = currentFailures + 1;
    this.failureCount.set(service, newFailures);
    
    logger.warn(`Service ${service} health check failed (${newFailures}/${this.maxFailures})`);
    
    // 如果故障次数超过阈值，触发故障转移
    if (newFailures >= this.maxFailures) {
      this.triggerFailover(service);
    }
  }
  
  /**
   * 触发故障转移
   */
  private async triggerFailover(service: string): Promise<void> {
    logger.error(`Triggering failover for ${service}`);
    
    switch (service) {
      case 'database':
        await this.failoverDatabase();
        break;
        
      case 'redis':
        await this.failoverRedis();
        break;
        
      case 'api-gateway':
        // API网关故障由负载均衡器处理
        logger.info('API gateway failover handled by load balancer');
        break;
    }
    
    // 发送告警
    await this.sendAlert({
      level: 'critical',
      service,
      message: `Service ${service} failover triggered`,
      timestamp: new Date()
    });
  }
  
  /**
   * 数据库故障转移
   */
  private async failoverDatabase(): Promise<void> {
    logger.info('Failing over to database replica...');
    
    try {
      // 切换到只读副本
      const replicaPool = createReplicaPool();
      globalThis.dbPool = replicaPool;
      
      logger.info('Successfully failed over to database replica');
    } catch (error) {
      logger.error('Database failover failed:', error);
      throw error;
    }
  }
  
  /**
   * Redis 故障转移
   */
  private async failoverRedis(): Promise<void> {
    logger.info('Failing over to Redis sentinel...');
    
    try {
      // Redis Sentinel自动处理主节点切换
      const sentinelClient = createSentinelClient();
      globalThis.redisClient = sentinelClient;
      
      logger.info('Successfully failed over to Redis sentinel');
    } catch (error) {
      logger.error('Redis failover failed:', error);
      throw error;
    }
  }
  
  /**
   * 发送告警
   */
  private async sendAlert(alert: any): Promise<void> {
    // 发送到监控系统
    logger.error('ALERT:', alert);
    
    // 可以集成钉钉、Slack等通知
    // await notifySlack(alert);
    // await notifyDingTalk(alert);
  }
  
  /**
   * 停止故障检测
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
```

---

### 2. 数据库高可用

#### PostgreSQL 主从复制配置
```bash
# postgresql.conf (Primary)
wal_level = replica
max_wal_senders = 3
wal_keep_size = 64MB
hot_standby = on

# pg_hba.conf (Primary)
host replication replicator 192.168.1.0/24 md5
```

```bash
# recovery.conf (Replica)
standby_mode = 'on'
primary_conninfo = 'host=192.168.1.10 port=5432 user=replicator password=xxx'
trigger_file = '/tmp/postgresql.trigger'
```

#### 数据库连接池配置
```typescript
// backend/src/config/database.ts
export const createDatabasePool = () => {
  return new Pool({
    // 主库配置
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'llmchat',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    
    // 连接池配置
    max: 20,
    min: 5,
    idle: 10000,
    
    // 故障转移配置
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    
    // 健康检查
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });
};

export const createReplicaPool = () => {
  return new Pool({
    // 从库配置（只读）
    host: process.env.DB_REPLICA_HOST || 'localhost',
    port: parseInt(process.env.DB_REPLICA_PORT || '5433'),
    database: process.env.DB_NAME || 'llmchat',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    
    // 只读连接
    application_name: 'llmchat-replica',
    
    // 连接池配置
    max: 20,
    min: 5
  });
};
```

---

### 3. Redis 高可用

#### Redis Sentinel 配置
```conf
# sentinel.conf
sentinel monitor mymaster 192.168.1.10 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000
```

#### Redis 客户端配置
```typescript
// backend/src/config/redis.ts
import Redis from 'ioredis';

export const createRedisClient = () => {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    
    // 重连策略
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    
    // 超时配置
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // 健康检查
    enableReadyCheck: true,
    enableOfflineQueue: true,
    
    // 自动流水线
    autoResubscribe: true,
    autoResendUnfulfilledCommands: true
  });
};

export const createSentinelClient = () => {
  return new Redis({
    sentinels: [
      { host: '192.168.1.11', port: 26379 },
      { host: '192.168.1.12', port: 26379 },
      { host: '192.168.1.13', port: 26379 }
    ],
    name: 'mymaster',
    password: process.env.REDIS_PASSWORD,
    
    // 故障转移
    sentinelRetryStrategy: (times) => {
      const delay = Math.min(times * 100, 2000);
      return delay;
    }
  });
};
```

---

## 🔁 自动恢复机制

### 1. 优雅重启
```typescript
// backend/src/utils/GracefulShutdown.ts
export class GracefulShutdown {
  private isShuttingDown = false;
  
  /**
   * 注册关闭处理器
   */
  register(): void {
    // 处理 SIGTERM 信号（Docker/K8s）
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    
    // 处理 SIGINT 信号（Ctrl+C）
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.shutdown('uncaughtException');
    });
    
    // 处理未捕获的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection:', { reason, promise });
    });
  }
  
  /**
   * 优雅关闭
   */
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }
    
    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // 1. 停止接收新请求
      logger.info('Stopping HTTP server...');
      await this.stopServer();
      
      // 2. 等待现有请求完成（最多30秒）
      logger.info('Waiting for existing requests to complete...');
      await this.waitForRequests(30000);
      
      // 3. 关闭数据库连接
      logger.info('Closing database connections...');
      await dbPool.end();
      
      // 4. 关闭 Redis 连接
      logger.info('Closing Redis connections...');
      await redisClient.quit();
      
      // 5. 清理其他资源
      logger.info('Cleaning up resources...');
      await this.cleanup();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
  
  /**
   * 停止HTTP服务器
   */
  private stopServer(): Promise<void> {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server stopped');
        resolve();
      });
    });
  }
  
  /**
   * 等待现有请求完成
   */
  private waitForRequests(timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const activeRequests = getActiveRequestCount();
        
        if (activeRequests === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // 超时后强制关闭
      setTimeout(() => {
        clearInterval(checkInterval);
        logger.warn('Request timeout, forcing shutdown');
        resolve();
      }, timeout);
    });
  }
  
  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    // 停止定时任务
    clearAllIntervals();
    
    // 关闭文件句柄
    closeAllFiles();
    
    // 清理缓存
    cacheManager.clear();
  }
}
```

### 2. 自动重启策略
```json
// ecosystem.config.js (PM2配置)
{
  "apps": [{
    "name": "llmchat",
    "script": "./dist/index.js",
    "instances": 2,
    "exec_mode": "cluster",
    "watch": false,
    "max_memory_restart": "500M",
    "error_file": "./logs/error.log",
    "out_file": "./logs/out.log",
    "log_date_format": "YYYY-MM-DD HH:mm:ss",
    "merge_logs": true,
    "autorestart": true,
    "max_restarts": 10,
    "min_uptime": "10s",
    "restart_delay": 4000,
    "kill_timeout": 30000,
    "wait_ready": true,
    "listen_timeout": 10000
  }]
}
```

---

## 📊 监控和告警

### 监控指标
```typescript
// backend/src/services/MonitoringService.ts
export class MonitoringService {
  /**
   * 收集系统指标
   */
  collectMetrics() {
    return {
      // 应用指标
      app: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      
      // HTTP指标
      http: {
        requestsPerSecond: this.getRequestsPerSecond(),
        averageResponseTime: this.getAverageResponseTime(),
        errorRate: this.getErrorRate(),
        activeConnections: this.getActiveConnections()
      },
      
      // 数据库指标
      database: {
        activeConnections: this.getDatabaseConnections(),
        queryLatency: this.getDatabaseLatency(),
        slowQueries: this.getSlowQueryCount()
      },
      
      // 缓存指标
      cache: {
        hitRate: this.getCacheHitRate(),
        missRate: this.getCacheMissRate(),
        evictionRate: this.getEvictionRate()
      }
    };
  }
  
  /**
   * 检查告警阈值
   */
  checkAlerts() {
    const metrics = this.collectMetrics();
    const alerts = [];
    
    // 内存告警
    if (metrics.app.memory.heapUsed > 450 * 1024 * 1024) {
      alerts.push({
        level: 'warning',
        type: 'memory',
        message: 'Memory usage exceeds 450MB',
        value: metrics.app.memory.heapUsed
      });
    }
    
    // 错误率告警
    if (metrics.http.errorRate > 0.05) {
      alerts.push({
        level: 'critical',
        type: 'error_rate',
        message: 'Error rate exceeds 5%',
        value: metrics.http.errorRate
      });
    }
    
    // 响应时间告警
    if (metrics.http.averageResponseTime > 500) {
      alerts.push({
        level: 'warning',
        type: 'response_time',
        message: 'Average response time exceeds 500ms',
        value: metrics.http.averageResponseTime
      });
    }
    
    return alerts;
  }
}
```

---

## ✅ 高可用检查清单

### 架构层面
- [ ] 多实例部署（≥3个实例）
- [ ] 负载均衡配置
- [ ] 健康检查机制
- [ ] 故障自动切换
- [ ] 数据库主从复制
- [ ] Redis哨兵集群

### 应用层面
- [ ] 优雅启动和关闭
- [ ] 异常自动恢复
- [ ] 请求超时控制
- [ ] 重试机制
- [ ] 断路器模式
- [ ] 降级策略

### 数据层面
- [ ] 数据备份策略
- [ ] 数据恢复演练
- [ ] 事务一致性保证
- [ ] 数据同步验证

### 监控告警
- [ ] 实时性能监控
- [ ] 关键指标告警
- [ ] 日志聚合分析
- [ ] 故障自动通知

---

**文档版本**: 1.0.0  
**最后更新**: 2025-01-15  
**维护者**: LLMChat 开发团队

