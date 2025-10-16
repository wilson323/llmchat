# 工作计划A：日志系统与性能优化

**负责范围**: 日志、监控、性能优化相关
**预估总时间**: 6.5小时
**优先级**: P0 + P1
**可并行执行**: ✅ 与工作计划B无冲突

---

## 📋 任务总览

| 阶段 | 任务数 | 预估时间 | 优先级 |
|------|--------|----------|--------|
| 阶段1 | 3个 | 30分钟 | P0 |
| 阶段2 | 2个 | 3小时 | P1 |
| 阶段3 | 2个 | 3小时 | P1 |

---

## 🔴 阶段1：P0紧急修复（30分钟）

### 任务A1.1: 修复Logger控制台debug硬编码 ⏱️ 5分钟

**问题**: 控制台日志级别硬编码为`debug`，导致日志洪水

**文件**: `backend/src/utils/logger.ts`

**当前代码**（第109-114行）:
```typescript
// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug',  // ❌ 硬编码
  }));
}
```

**修复代码**:
```typescript
// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info',  // ✅ 使用环境变量
  }));
}
```

**验证步骤**:
```bash
# 1. 修改代码
# 2. 构建
pnpm run backend:build

# 3. 重启服务
cd backend && pnpm run dev

# 4. 观察控制台，应该只有info/warn/error级别日志
```

**预期效果**:
- Debug日志减少: 99%
- 控制台输出清爽
- CPU: -5%

---

### 任务A1.2: 优化RedisConnectionPool日志 ⏱️ 15分钟

**问题**: 每次连接操作都记录debug日志，每秒1000+条

**文件**: `backend/src/utils/redisConnectionPool.ts`

**需要移除的日志**:
```typescript
// ❌ 删除这些高频debug日志
logger.debug('RedisConnectionPool: Reusing idle connection');
logger.debug('RedisConnectionPool: Connection released to pool');
logger.debug('RedisConnectionPool: New connection established');
logger.debug('RedisConnectionPool: Connection from pool');
```

**替换为定时统计**:
```typescript
/**
 * 连接池统计（每分钟记录一次）
 */
private lastStatsTime = 0;

/**
 * 记录连接池统计信息（降频）
 */
private logStatsIfNeeded(): void {
  const now = Date.now();
  if (now - this.lastStatsTime > 60000) { // 60秒
    const stats = this.getStats();
    logger.info('RedisConnectionPool stats', {
      total: stats.totalConnections,
      active: stats.activeConnections,
      idle: stats.idleConnections,
      waiting: stats.waitingClients,
      avgResponseTime: stats.avgResponseTime,
    });
    this.lastStatsTime = now;
  }
}

/**
 * 获取连接（优化后）
 */
public async getConnection(): Promise<Redis> {
  // ... 连接逻辑 ...
  
  // ✅ 改为定时统计
  this.logStatsIfNeeded();
  
  return connection;
}
```

**修改位置**（搜索并替换）:
```bash
# 搜索所有logger.debug调用
rg "logger\.debug\('RedisConnectionPool" backend/src/utils/redisConnectionPool.ts

# 逐个移除或注释
```

**验证步骤**:
```bash
# 1. 修改代码
# 2. 重启服务
# 3. 观察控制台，应该每分钟最多1条连接池统计
# 4. 测试Redis功能正常
curl http://localhost:3001/api/agents
```

**预期效果**:
- 日志量: 1000+/秒 → 1/分钟（降低99.99%）
- CPU: -10%
- 控制台可读性: 显著提升

---

### 任务A1.3: 修复MemoryOptimization环境变量逻辑 ⏱️ 10分钟

**问题**: 环境变量逻辑错误，`ENABLED=false`仍然启用

**文件**: `backend/src/services/MemoryOptimizationService.ts`

**当前代码**（构造函数）:
```typescript
constructor(config: Partial<MemoryOptimizationConfig> = {}) {
  super();

  this.config = {
    // ❌ !== 'false' 意味着默认启用
    monitoringEnabled: process.env.MEMORY_OPTIMIZATION_ENABLED !== 'false',
    autoOptimizationEnabled: process.env.MEMORY_OPTIMIZATION_ENABLED !== 'false',
    // ...
  };
}
```

**修复代码**:
```typescript
constructor(config: Partial<MemoryOptimizationConfig> = {}) {
  super();

  // ✅ 修复：改为显式启用逻辑
  const isEnabled = process.env.MEMORY_OPTIMIZATION_ENABLED === 'true';
  
  this.config = {
    monitoringEnabled: isEnabled,
    autoOptimizationEnabled: isEnabled,
    monitoringIntervalMs: 60000,
    historyRetentionMinutes: 60,
    optimizationThreshold: 95,
    optimizationIntervalMs: 300000,
    expiredDataCleanupMs: 600000,
    maxHistorySize: 500,
    batchCleanupSize: 50,
    maxHeapSizeMB: 2048,
    maxRSSSizeMB: 4096,
    alertThresholds: {
      heapUsageWarning: 85,
      heapUsageCritical: 95,
      rssWarning: 1024,
      rssCritical: 2048
    },
    ...config
  };
  
  // ✅ 如果禁用，记录并退出
  if (!this.config.monitoringEnabled) {
    logger.info('MemoryOptimizationService: 已禁用（MEMORY_OPTIMIZATION_ENABLED != true）');
    return; // 不启动监控
  }
  
  // 启动监控
  this.startMonitoring();
}
```

**验证步骤**:
```bash
# 1. 确认.env配置
cat backend/.env | grep MEMORY_OPTIMIZATION_ENABLED
# 应该是: MEMORY_OPTIMIZATION_ENABLED=false

# 2. 修改代码
# 3. 重启服务
# 4. 检查日志，应该看到"已禁用"消息
# 5. 观察不应再有内存优化警告
```

**预期效果**:
- 停止无意义的内存优化循环
- CPU: -10%
- 内存: -100MB
- 日志清爽

---

## 🟡 阶段2：请求日志批量化（3小时）

### 任务A2.1: 实现AsyncBatchRequestLogger ⏱️ 2小时

**目标**: 异步批量请求日志，替代当前同步requestLogger

**新文件**: `backend/src/middleware/AsyncBatchRequestLogger.ts`

**完整实现**:
```typescript
import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

/**
 * 请求日志条目
 */
interface LogEntry {
  timestamp: Date;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  requestId?: string;
}

/**
 * 异步批量请求日志器
 * 
 * 性能优势：
 * - 日志收集不阻塞HTTP响应
 * - 批量写入降低I/O频率99%
 * - 内存队列，快速读写
 * 
 * 使用方式：
 * ```typescript
 * import { asyncRequestLogger } from '@/middleware/AsyncBatchRequestLogger';
 * app.use(asyncRequestLogger);
 * ```
 */
export class AsyncBatchRequestLogger {
  private logQueue: LogEntry[] = [];
  private batchSize = 100;           // 100条批量写入
  private flushInterval = 5000;      // 5秒强制刷新
  private lastFlushTime = Date.now();
  private flushTimer: NodeJS.Timeout;

  constructor() {
    // 定时刷新队列
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
    
    // 进程退出前刷新
    process.on('beforeExit', () => {
      this.flush();
      clearInterval(this.flushTimer);
    });
  }

  /**
   * Express中间件
   */
  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = req.requestId || `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

    // 监听响应完成
    res.on('finish', () => {
      const logEntry: LogEntry = {
        timestamp: new Date(),
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        requestId,
      };

      // 推入队列（不等待）
      this.logQueue.push(logEntry);

      // 队列满了立即刷新
      if (this.logQueue.length >= this.batchSize) {
        this.flush();
      }
    });

    // 立即调用next，不等待日志
    next();
  };

  /**
   * 批量刷新日志到文件
   */
  private flush(): void {
    if (this.logQueue.length === 0) {
      return;
    }

    // 异步执行，不阻塞主线程
    setImmediate(() => {
      try {
        const batch = this.logQueue.splice(0, this.batchSize);
        
        // 批量记录
        logger.info('Request batch', {
          count: batch.length,
          period: {
            start: batch[0].timestamp,
            end: batch[batch.length - 1].timestamp,
          },
          summary: {
            totalRequests: batch.length,
            avgDuration: batch.reduce((sum, log) => sum + log.duration, 0) / batch.length,
            errorCount: batch.filter(log => log.statusCode >= 400).length,
            methods: this.countBy(batch, 'method'),
          },
          logs: batch.map(log => ({
            time: log.timestamp,
            method: log.method,
            url: log.url,
            status: log.statusCode,
            duration: log.duration,
            ...(log.userId && { userId: log.userId }),
          })),
        });
        
        this.lastFlushTime = Date.now();
      } catch (err) {
        // 静默失败，不影响服务
        logger.error('Log flush failed', { 
          error: (err as Error).message,
          queueSize: this.logQueue.length,
        });
      }
    });
  }

  /**
   * 辅助方法：按字段计数
   */
  private countBy(array: LogEntry[], key: keyof LogEntry): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      queueSize: this.logQueue.length,
      timeSinceLastFlush: Date.now() - this.lastFlushTime,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
    };
  }

  /**
   * 手动刷新（用于测试或紧急情况）
   */
  forceFlush(): void {
    this.flush();
  }
}

// 导出单例
export const asyncBatchRequestLogger = new AsyncBatchRequestLogger();

// 导出中间件
export const asyncRequestLogger = asyncBatchRequestLogger.middleware;

// 默认导出
export default asyncRequestLogger;
```

**集成方式**:
```typescript
// backend/src/index.ts
import asyncRequestLogger from '@/middleware/AsyncBatchRequestLogger';

// 替代原requestLogger
app.use(asyncRequestLogger);
```

**测试验证**:
```bash
# 1. 创建文件并编码
# 2. 构建
pnpm run backend:build

# 3. 更新index.ts使用新logger
# 4. 重启服务
# 5. 发送100个请求测试批量
for i in {1..100}; do curl -s http://localhost:3001/api/agents > /dev/null; done

# 6. 检查日志，应该看到批量日志（每100个请求1条）
```

**预期效果**:
- 日志I/O: 每请求1次 → 每100请求1次（99% ↓）
- 请求延迟: -5-10ms
- CPU使用: -5%

---

### 任务A1.2: 配置Sentry异步发送模式 ⏱️ 1小时

**目标**: Sentry事件异步发送，不阻塞HTTP响应

**新文件**: `backend/src/config/sentryOptimized.ts`

**完整实现**:
```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Express } from 'express';
import logger from '@/utils/logger';

/**
 * 优化后的Sentry初始化
 * 
 * 性能优化：
 * - 异步发送事件
 * - 降低采样率（10%）
 * - 批量传输（30个事件）
 * - 过滤低优先级事件
 */
export function initSentryOptimized(app: Express): void {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.info('Sentry: 未配置DSN，跳过初始化');
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
    
    // ✅ Express集成
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new ProfilingIntegration(),
    ],
    
    // ✅ 采样率配置（降低发送频率）
    tracesSampleRate: isProduction ? 0.1 : 0.05,  // 生产10%，开发5%
    profilesSampleRate: 0.05,                      // 性能采样5%
    
    // ✅ 过滤低优先级事件
    beforeSend: async (event, hint) => {
      // 过滤info和debug级别
      if (event.level === 'info' || event.level === 'debug') {
        return null;
      }
      
      // 过滤健康检查端点错误
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      
      // 开发环境记录所有error
      if (!isProduction) {
        return event;
      }
      
      // 生产环境只发送error和fatal
      if (event.level === 'error' || event.level === 'fatal') {
        return event;
      }
      
      return null;
    },
    
    // ✅ 异步传输配置
    transport: Sentry.makeNodeTransport({
      bufferSize: 30,           // 批量发送30个事件
      recordDroppedEvent: true,
    }),
    
    // ✅ 性能配置
    maxBreadcrumbs: 50,          // 面包屑限制
    maxValueLength: 1000,        // 值长度限制
    attachStacktrace: true,      // 附加堆栈
    
    // ✅ 忽略特定错误
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'NetworkError',
      'Non-Error promise rejection',
    ],
  });

  logger.info('Sentry: 已初始化（优化模式）', {
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProduction ? 0.1 : 0.05,
  });
}
```

**集成方式**:
```typescript
// backend/src/index.ts
import { initSentryOptimized } from '@/config/sentryOptimized';

// 替代原initSentry
initSentryOptimized(app);

// 恢复Sentry中间件（取消注释）
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// ... 路由 ...
app.use(Sentry.Handlers.errorHandler());
```

**验证步骤**:
```bash
# 1. 创建配置文件
# 2. 更新index.ts
# 3. 重启服务
# 4. 触发错误测试
curl http://localhost:3001/api/nonexistent

# 5. 检查Sentry dashboard，应该收到错误事件
# 6. 验证响应时间未受影响
```

**预期效果**:
- Sentry影响: <5ms
- 错误上报率: >95%
- CPU开销: <2%

---

## 🟡 阶段2：性能监控优化（3小时）

### 任务A2.1: 优化PerformanceMonitor数据存储 ⏱️ 1.5小时

**目标**: 限制性能数据大小，定期清理

**文件**: `backend/src/middleware/PerformanceMonitor.ts`

**添加数据管理逻辑**:
```typescript
/**
 * 性能监控配置
 */
private readonly maxDataSize = 1000;      // 最多保留1000条
private readonly dataRetentionHours = 1;   // 保留1小时
private cleanupInterval: NodeJS.Timeout;

constructor() {
  // 启动定期清理
  this.cleanupInterval = setInterval(() => {
    this.cleanOldData();
  }, 60000); // 每分钟清理一次
  
  process.on('beforeExit', () => {
    clearInterval(this.cleanupInterval);
  });
}

/**
 * 存储性能数据（带大小限制）
 */
private storePerformanceData(data: PerformanceData): void {
  this.performanceData.push(data);
  
  // ✅ 超过大小限制，移除最旧的
  if (this.performanceData.length > this.maxDataSize) {
    const removeCount = this.performanceData.length - this.maxDataSize;
    this.performanceData.splice(0, removeCount);
  }
}

/**
 * 清理旧数据
 */
private cleanOldData(): void {
  const cutoffTime = Date.now() - (this.dataRetentionHours * 60 * 60 * 1000);
  const beforeCount = this.performanceData.length;
  
  this.performanceData = this.performanceData.filter(
    d => new Date(d.timestamp).getTime() > cutoffTime
  );
  
  const removedCount = beforeCount - this.performanceData.length;
  if (removedCount > 0) {
    logger.debug(`PerformanceMonitor: 清理旧数据 ${removedCount} 条`);
  }
}
```

**预期效果**:
- 内存占用: 稳定在<10MB
- 无内存泄漏
- 数据始终保持最近1小时

---

### 任务A2.2: 数据库性能监控优化 ⏱️ 1.5小时

**文件**: `backend/src/middleware/databasePerformanceMonitor.ts`

**优化目标**:
- 移除同步logger调用
- 异步记录慢查询
- 批量统计

**修改逻辑**:
```typescript
// ✅ 慢查询队列
private slowQueryQueue: Array<SlowQueryInfo> = [];

// ✅ 在查询完成后异步处理
setImmediate(() => {
  if (duration > SLOW_QUERY_THRESHOLD) {
    this.slowQueryQueue.push({
      query: sqlQuery,
      duration,
      timestamp: new Date(),
    });
    
    // 批量记录
    if (this.slowQueryQueue.length >= 10) {
      logger.warn('Slow queries batch', {
        count: this.slowQueryQueue.length,
        queries: this.slowQueryQueue,
      });
      this.slowQueryQueue = [];
    }
  }
});
```

**验证步骤**:
```bash
# 1. 修改代码
# 2. 重启服务
# 3. 执行数据库操作
curl http://localhost:3001/api/admin/stats

# 4. 检查日志，确认无阻塞
```

---

## 🟢 阶段3：性能基准测试（3小时）

### 任务A3.1: 建立性能基准 ⏱️ 1.5小时

**目标**: 记录优化后的性能基准，用于后续对比

**新文件**: `tests/performance/benchmark.ts`

**基准测试项目**:
```typescript
import axios from 'axios';

interface BenchmarkResult {
  test: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  throughput: number;
}

async function runBenchmark() {
  const results: BenchmarkResult[] = [];
  
  // 测试1: 健康检查
  results.push(await benchmarkEndpoint('GET', '/health', 1000));
  
  // 测试2: Agents列表
  results.push(await benchmarkEndpoint('GET', '/api/agents', 500));
  
  // 测试3: 登录
  results.push(await benchmarkEndpoint('POST', '/api/auth/login', 100, {
    username: 'admin',
    password: 'admin123'
  }));
  
  // 生成报告
  generateReport(results);
}

async function benchmarkEndpoint(
  method: string,
  path: string,
  requests: number,
  data?: any
): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const durations: number[] = [];
  let successCount = 0;
  
  for (let i = 0; i < requests; i++) {
    const reqStart = Date.now();
    try {
      await axios({ method, url: `http://localhost:3001${path}`, data });
      successCount++;
      durations.push(Date.now() - reqStart);
    } catch (err) {
      durations.push(Date.now() - reqStart);
    }
  }
  
  const totalTime = Date.now() - startTime;
  durations.sort((a, b) => a - b);
  
  return {
    test: `${method} ${path}`,
    avgResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95ResponseTime: durations[Math.floor(durations.length * 0.95)],
    p99ResponseTime: durations[Math.floor(durations.length * 0.99)],
    successRate: successCount / requests,
    throughput: requests / (totalTime / 1000),
  };
}
```

**执行**:
```bash
npx ts-node tests/performance/benchmark.ts
```

---

### 任务A3.2: 压力测试 ⏱️ 1.5小时

**工具**: Artillery

**配置文件**: `tests/performance/artillery.yml`

```yaml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "API健康检查"
    weight: 30
    flow:
      - get:
          url: "/health"
          
  - name: "获取智能体列表"
    weight: 50
    flow:
      - get:
          url: "/api/agents"
          
  - name: "聊天请求"
    weight: 20
    flow:
      - post:
          url: "/api/chat/completions"
          json:
            agentId: "fastgpt-1"
            message: "Hello"
            stream: false
```

**执行**:
```bash
# 安装Artillery
pnpm add -D artillery

# 运行压力测试
npx artillery run tests/performance/artillery.yml
```

---

## 📊 性能目标

### 修复后性能指标

| 指标 | 目标值 | 验收标准 |
|------|--------|----------|
| HTTP响应时间（P95） | < 50ms | 95%请求<50ms |
| HTTP响应时间（P99） | < 100ms | 99%请求<100ms |
| CPU使用率（空闲） | < 5% | 无请求时<5% |
| CPU使用率（负载） | < 30% | 100并发<30% |
| 内存使用（空闲） | < 100MB | 稳定无泄漏 |
| 内存使用（负载） | < 200MB | 持续负载<200MB |
| 日志量 | < 100条/分钟 | 正常运行时 |
| 吞吐量 | > 1000 req/s | 压力测试 |

---

## ✅ 质量检查清单

### 代码质量
- [ ] TypeScript编译通过
- [ ] ESLint检查无严重问题
- [ ] 所有日志调用已优化
- [ ] 无同步I/O操作

### 功能完整性
- [ ] Logger级别正确控制
- [ ] RedisPool日志清爽
- [ ] MemoryOptimization正确禁用
- [ ] Sentry正常工作
- [ ] 批量日志功能正常

### 性能验证
- [ ] HTTP响应< 50ms (P95)
- [ ] CPU< 10%（空闲）
- [ ] 内存< 100MB（空闲）
- [ ] 日志量< 100条/分钟
- [ ] 压力测试通过

### 文档更新
- [ ] 修改记录到CHANGELOG
- [ ] 更新性能优化文档
- [ ] 基准测试结果归档

---

## 🔄 执行流程

### Day 1（今天）
**时间**: 09:00 - 09:30

```bash
# 1. 修复Logger级别（5分钟）
vim backend/src/utils/logger.ts
# 第112行: level: process.env.LOG_LEVEL || 'info'

# 2. 优化RedisPool日志（15分钟）
vim backend/src/utils/redisConnectionPool.ts
# 移除所有logger.debug，添加定时统计

# 3. 修复MemoryOptimization（10分钟）
vim backend/src/services/MemoryOptimizationService.ts
# !== 'false' → === 'true'

# 4. 构建和验证
pnpm run backend:build
cd backend && pnpm run dev

# 5. 观察日志清爽，无debug洪水

# 6. 提交
git add .
git commit -m "fix(P0): 修复日志级别和环境变量逻辑"
git push origin main
```

### Day 2-3（本周）
**时间**: 6小时

- 实现AsyncBatchRequestLogger（2小时）
- 配置Sentry优化模式（1小时）
- 优化PerformanceMonitor（1.5小时）
- 优化databasePerformanceMonitor（1.5小时）

### Day 4-5（本周）
**时间**: 3小时

- 建立性能基准测试（1.5小时）
- 执行压力测试（1.5小时）
- 生成性能报告

---

## 📝 提交计划

### Commit 1: P0修复
```bash
git commit -m "fix(P0): 修复Logger和环境变量逻辑

🎯 修复问题:
- Logger控制台级别硬编码debug
- RedisConnectionPool日志洪水（1000+条/秒）
- MemoryOptimization环境变量逻辑错误

✅ 修复方案:
- Logger使用环境变量控制级别
- RedisPool改为每分钟统计一次
- MemoryOptimization改为显式启用逻辑

📊 修复效果:
- 日志量: 99.9% ↓
- CPU: 15% ↓
- 控制台清爽可读"
```

### Commit 2: 批量日志
```bash
git commit -m "feat: 实现异步批量请求日志系统

🎯 新功能:
- AsyncBatchRequestLogger批量异步日志
- 100条请求批量写入
- 5秒强制刷新机制

📊 性能提升:
- 日志I/O: 99% ↓
- 请求延迟: 90% ↓
- CPU使用: 5% ↓"
```

### Commit 3: Sentry优化
```bash
git commit -m "feat: Sentry异步发送和采样优化

🎯 优化内容:
- 异步批量发送（30个事件）
- 采样率10%（生产环境）
- 过滤低优先级事件

📊 性能提升:
- Sentry影响< 5ms
- CPU开销< 2%"
```

---

## 🎯 成功标准

### 最终验收
- ✅ 控制台日志清爽（< 10行/分钟）
- ✅ CPU使用< 10%（空闲），< 30%（负载）
- ✅ 内存使用< 100MB（空闲），< 200MB（负载）
- ✅ HTTP响应< 50ms (P95)
- ✅ 压力测试1000 req/s通过
- ✅ Sentry正常工作
- ✅ 所有日志批量化

**完成标准**: 所有✅勾选

---

**计划创建时间**: 2025-10-16 17:30  
**负责人**: 开发团队A（日志和性能）  
**执行开始**: 立即  
**预计完成**: 2025-10-20

