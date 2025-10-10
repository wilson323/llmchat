/**
 * 数据库查询优化器
 *
 * 提供查询性能分析、优化建议、慢查询检测等功能
 * 自动优化常用查询模式，提升数据库响应速度
 */

import { Pool, PoolClient } from 'pg';
import { EventEmitter } from 'events';
import logger from './StructuredLogger';
import { getPool } from './db';
import { memoryResourceManager } from './MemoryResourceManager';

// ============================================================================
// 类型定义
// ============================================================================

export interface QueryMetric {
  id: string;
  sql: string;
  params: unknown[];
  duration: number;
  timestamp: number;
  rowsReturned?: number;
  error?: string;
  type: 'select' | 'insert' | 'update' | 'delete' | 'ddl';
  cacheHit?: boolean;
}

export interface SlowQueryThreshold {
  maxDuration: number;
  minRows: number;
  types: string[];
}

export interface QueryOptimization {
  type: 'index' | 'query_rewrite' | 'cache' | 'batch';
  description: string;
  beforeSql: string;
  afterSql: string;
  estimatedImprovement: number;
}

export interface DatabasePerformanceStats {
  totalQueries: number;
  avgDuration: number;
  slowQueries: number;
  cacheHitRate: number;
  connectionPoolUsage: {
    active: number;
    idle: number;
    total: number;
    waiting: number;
  };
  topSlowQueries: QueryMetric[];
  recommendations: QueryOptimization[];
}

export interface QueryCacheEntry {
  sql: string;
  paramsHash: string;
  result: any;
  timestamp: number;
  ttl: number;
  hitCount: number;
}

// ============================================================================
// 查询优化器主类
// ============================================================================

export class DatabaseQueryOptimizer extends EventEmitter {
  private metrics: QueryMetric[] = [];
  private queryCache = new Map<string, QueryCacheEntry>();
  private slowQueryThresholds: SlowQueryThreshold[] = [];
  private isMonitoring = false;
  private metricsInterval?: string;
  private readonly MAX_METRICS = 10000; // 保留最近10000条查询记录
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CACHE_SIZE = 1000; // 最大缓存1000个查询

  constructor() {
    super();
    this.setupDefaultThresholds();
  }

  /**
   * 设置默认的慢查询阈值
   */
  private setupDefaultThresholds(): void {
    this.slowQueryThresholds = [
      { maxDuration: 1000, minRows: 1, types: ['select'] },    // SELECT查询超过1秒
      { maxDuration: 500, minRows: 1, types: ['insert', 'update', 'delete'] }, // 写操作超过500ms
      { maxDuration: 100, minRows: 100, types: ['select'] },   // 返回超过100行的SELECT查询超过100ms
      { maxDuration: 2000, minRows: 0, types: ['ddl'] },       // DDL操作超过2秒
    ];
  }

  /**
   * 启动查询监控
   */
  start(options: {
    metricsInterval?: number;
    enableCache?: boolean;
    enableSlowQueryDetection?: boolean;
  } = {}): void {
    if (this.isMonitoring) {
      logger.warn('数据库查询优化器已在运行');
      return;
    }

    this.isMonitoring = true;

    // 启动指标收集
    const metricsTimerId = `metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    memoryResourceManager.registerTimer(
      'interval',
      () => {
        this.collectMetrics();
        this.cleanupOldCache();
      },
      options.metricsInterval || 30000, // 30秒间隔
      { location: 'DatabaseQueryOptimizer', id: metricsTimerId }
    );
    this.metricsInterval = metricsTimerId;

    logger.info('数据库查询优化器已启动', {
      metricsInterval: options.metricsInterval || 30000,
      enableCache: options.enableCache !== false,
      enableSlowQueryDetection: options.enableSlowQueryDetection !== false,
    });

    this.emit('started');
  }

  /**
   * 停止查询监控
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.metricsInterval) {
      memoryResourceManager.clearTimer(this.metricsInterval);
      this.metricsInterval = undefined as any;
    }

    logger.info('数据库查询优化器已停止');
    this.emit('stopped');
  }

  /**
   * 包装数据库查询以进行监控
   */
  async executeQuery<T = any>(
    pool: Pool,
    sql: string,
    params: unknown[] = [],
    options: {
      enableCache?: boolean;
      queryType?: string;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();
    const paramsHash = this.hashParams(params);
    const cacheKey = `${sql}:${paramsHash}`;

    // 检查缓存
    if (options.enableCache !== false) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        const duration = Date.now() - startTime;
        this.recordMetric({
          id: queryId,
          sql,
          params,
          duration,
          timestamp: startTime,
          rowsReturned: Array.isArray(cached) ? cached.length : 1,
          type: this.inferQueryType(sql),
          cacheHit: true,
        });
        return cached;
      }
    }

    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      const duration = Date.now() - startTime;

      // 缓存结果
      if (options.enableCache !== false && this.shouldCacheResult(result)) {
        this.cacheResult(cacheKey, result);
      }

      // 记录指标
      this.recordMetric({
        id: queryId,
        sql,
        params,
        duration,
        timestamp: startTime,
        rowsReturned: result.rowCount || 0,
        type: this.inferQueryType(sql),
        cacheHit: false,
      });

      return (result as any).rows || result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordMetric({
        id: queryId,
        sql,
        params,
        duration,
        timestamp: startTime,
        error: error instanceof Error ? error.message : String(error),
        type: this.inferQueryType(sql),
        cacheHit: false,
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取查询缓存结果
   */
  private getCachedResult<T = any>(cacheKey: string): T | null {
    const cached = this.queryCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    // 更新命中计数
    cached.hitCount++;
    cached.timestamp = Date.now(); // 延长TTL

    return cached.result;
  }

  /**
   * 缓存查询结果
   */
  private cacheResult<T = any>(cacheKey: string, result: T): void {
    // 如果缓存已满，删除最旧的条目
    if (this.queryCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(cacheKey, {
      sql: (cacheKey.split(':')[0] || ''),
      paramsHash: (cacheKey.split(':')[1] || ''),
      result,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL,
      hitCount: 0,
    });
  }

  /**
   * 判断是否应该缓存结果
   */
  private shouldCacheResult<T = any>(result: any): boolean {
    // 不缓存空结果或错误结果
    if (!result) return false;

    // 缓存SELECT查询结果
    if (Array.isArray(result) && result.length > 0) {
      return true;
    }

    // 缓存单行查询结果
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return true;
    }

    return false;
  }

  /**
   * 清理过期缓存
   */
  private cleanupOldCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.queryCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug('清理过期查询缓存', { count: keysToDelete.length });
    }
  }

  /**
   * 记录查询指标
   */
  private recordMetric(metric: QueryMetric): void {
    this.metrics.push(metric);

    // 限制指标数量
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // 检查慢查询
    this.checkSlowQuery(metric);
  }

  /**
   * 检查慢查询
   */
  private checkSlowQuery(metric: QueryMetric): void {
    if (metric.error) return; // 忽略错误查询

    for (const threshold of this.slowQueryThresholds) {
      if (!threshold.types.includes(metric.type)) continue;
      if (metric.duration <= threshold.maxDuration) continue;
      if (metric.rowsReturned && metric.rowsReturned < threshold.minRows) continue;

      logger.warn('检测到慢查询', {
        queryId: metric.id,
        sql: this.sanitizeSql(metric.sql),
        duration: metric.duration,
        rowsReturned: metric.rowsReturned,
        type: metric.type,
      });

      this.emit('slow_query', metric);
      break;
    }
  }

  /**
   * 生成查询ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 推断查询类型
   */
  private inferQueryType(sql: string): QueryMetric['type'] {
    const normalizedSql = sql.trim().toLowerCase();

    if (normalizedSql.startsWith('select')) return 'select';
    if (normalizedSql.startsWith('insert')) return 'insert';
    if (normalizedSql.startsWith('update')) return 'update';
    if (normalizedSql.startsWith('delete')) return 'delete';
    if (normalizedSql.startsWith('create') || normalizedSql.startsWith('alter') || normalizedSql.startsWith('drop')) {
      return 'ddl';
    }

    return 'select'; // 默认
  }

  /**
   * 计算参数哈希
   */
  private hashParams(params: unknown[]): string {
    if (!params || params.length === 0) return '';
    return JSON.stringify(params);
  }

  /**
   * 清理SQL语句（移除敏感信息）
   */
  private sanitizeSql(sql: string): string {
    // 移除密码等敏感信息
    return sql.replace(/(['\"][^'"]*['"])/gi, '[REDACTED]');
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    if (this.metrics.length === 0) return;

    const recentMetrics = this.metrics.slice(-1000); // 最近1000条查询
    const totalQueries = recentMetrics.length;
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = totalDuration / totalQueries;
    const slowQueries = recentMetrics.filter(m => {
      return this.slowQueryThresholds.some(threshold =>
        threshold.types.includes(m.type) &&
        m.duration > threshold.maxDuration
      );
    }).length;

    // 计算缓存命中率
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;

    // 获取连接池状态
    const pool = getPool();
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      active: 0, // pg Pool doesn't have activeCount, would need to track manually
      waiting: pool.waitingCount,
    };

    // 获取最慢的查询
    const topSlowQueries = recentMetrics
      .filter(m => !m.error)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // 生成优化建议
    const recommendations = this.generateOptimizationRecommendations(recentMetrics);

    const stats: DatabasePerformanceStats = {
      totalQueries,
      avgDuration: Math.round(avgDuration),
      slowQueries,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      connectionPoolUsage: poolStats,
      topSlowQueries,
      recommendations,
    };

    this.emit('metrics_collected', stats);
  }

  /**
   * 生成查询优化建议
   */
  private generateOptimizationRecommendations(metrics: QueryMetric[]): QueryOptimization[] {
    const recommendations: QueryOptimization[] = [];

    // 分析SELECT查询模式
    const selectQueries = metrics.filter(m => m.type === 'select' && !m.error);
    const slowSelectQueries = selectQueries.filter(m =>
      m.duration > 500 && (m.rowsReturned || 0) > 10
    );

    // 建议添加索引
    if (slowSelectQueries.length > 5) {
      recommendations.push({
        type: 'index',
        description: '频繁的慢查询可能缺少适当的索引',
        beforeSql: 'SELECT * FROM table WHERE condition',
        afterSql: 'CREATE INDEX idx_table_condition ON table(condition)',
        estimatedImprovement: 50,
      });
    }

    // 建议批量操作
    const insertQueries = metrics.filter(m => m.type === 'insert' && !m.error);
    if (insertQueries.length > 20) {
      recommendations.push({
        type: 'batch',
        description: '多个单独INSERT可以合并为批量INSERT',
        beforeSql: 'INSERT INTO table (col1, col2) VALUES (val1, val2)',
        afterSql: 'INSERT INTO table (col1, col2) VALUES (val1, val2), (val3, val4), ...',
        estimatedImprovement: 30,
      });
    }

    // 建议查询重写
    const fullTableScans = selectQueries.filter(m =>
      m.duration > 1000 && (m.rowsReturned || 0) > 1000
    );
    if (fullTableScans.length > 3) {
      recommendations.push({
        type: 'query_rewrite',
        description: '大结果集查询可能需要分页或筛选优化',
        beforeSql: 'SELECT * FROM large_table',
        afterSql: 'SELECT * FROM large_table WHERE condition LIMIT 100',
        estimatedImprovement: 60,
      });
    }

    return recommendations;
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): DatabasePerformanceStats {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        avgDuration: 0,
        slowQueries: 0,
        cacheHitRate: 0,
        connectionPoolUsage: {
          active: 0,
          idle: 0,
          total: 0,
          waiting: 0,
        },
        topSlowQueries: [],
        recommendations: [],
      };
    }

    const totalQueries = this.metrics.length;
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const avgDuration = totalDuration / totalQueries;
    const slowQueries = this.metrics.filter(m => {
      return this.slowQueryThresholds.some(threshold =>
        threshold.types.includes(m.type) &&
        m.duration > threshold.maxDuration
      );
    }).length;

    const cacheHits = this.metrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;

    const pool = getPool();
    const poolStats = {
      total: pool.totalCount,
      idle: pool.idleCount,
      active: 0, // pg Pool doesn't have activeCount, would need to track manually
      waiting: pool.waitingCount,
    };

    const topSlowQueries = this.metrics
      .filter(m => !m.error)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(m => ({
        ...m,
        sql: this.sanitizeSql(m.sql),
      }));

    const recommendations = this.generateOptimizationRecommendations(this.metrics);

    return {
      totalQueries,
      avgDuration: Math.round(avgDuration),
      slowQueries,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      connectionPoolUsage: poolStats,
      topSlowQueries,
      recommendations,
    };
  }

  /**
   * 清理指标数据
   */
  clearMetrics(): void {
    this.metrics = [];
    this.queryCache.clear();
    logger.info('数据库查询指标已清理');
  }

  /**
   * 设置慢查询阈值
   */
  setSlowQueryThresholds(thresholds: SlowQueryThreshold[]): void {
    this.slowQueryThresholds = thresholds;
    logger.info('慢查询阈值已更新', { count: thresholds.length });
  }

  /**
   * 手动清除缓存
   */
  clearCache(): void {
    this.queryCache.clear();
    logger.info('查询缓存已清除');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): any {
    const now = Date.now();
    let expiredCount = 0;
    let hitCount = 0;

    for (const entry of this.queryCache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
      hitCount += entry.hitCount;
    }

    return {
      size: this.queryCache.size,
      hitCount,
      expiredCount,
      hitRate: this.queryCache.size > 0 ? hitCount / this.queryCache.size : 0,
    };
  }
}

// ============================================================================
// 导出单例实例
// ============================================================================

export const databaseQueryOptimizer = new DatabaseQueryOptimizer();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 创建查询优化中间件
 */
export function createQueryOptimizationMiddleware(options: {
  enableCache?: boolean;
  enableSlowQueryDetection?: boolean;
  slowQueryThresholds?: SlowQueryThreshold[];
} = {}) {
  return (req: any, res: any, next: any) => {
    // 在请求对象上附加查询优化器
    req.dbOptimizer = databaseQueryOptimizer;

    // 记录请求开始
    const startTime = Date.now();

    // 在响应上附加性能信息
    const originalSend = res.send;
    res.send = function(data: any) {
      // 计算查询时间
      const queryTime = Date.now() - startTime;

      // 添加性能头
      res.set('X-DB-Query-Time', queryTime.toString());

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * 创建优化的数据库查询函数
 */
export function createOptimizedQuery() {
  return async function<T = any>(
    sql: string,
    params: unknown[] = [],
    options: {
      enableCache?: boolean;
      queryType?: string;
    } = {}
  ): Promise<T> {
    const pool = getPool();
    return databaseQueryOptimizer.executeQuery(pool, sql, params, options);
  };
}

export default databaseQueryOptimizer;