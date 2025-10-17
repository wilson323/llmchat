/**
 * 数据库性能优化中间件
 *
 * 集成查询优化器、连接池优化器、缓存等功能
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { getQueryOptimizer } from '@/utils/queryOptimizer';
import { connectionPoolOptimizer } from '@/utils/connectionPoolOptimizer';
import { defaultQueryCache } from '@/utils/queryCache';
import { getPool } from '@/utils/db';
import databasePerformanceMonitor from './databasePerformanceMonitor';

// 优化配置接口
export interface OptimizationConfig {
  /** 是否启用查询缓存 */
  enableQueryCache: boolean;
  /** 是否启用查询分析 */
  enableQueryAnalysis: boolean;
  /** 是否启用连接池监控 */
  enablePoolMonitoring: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
  /** 慢查询阈值（毫秒） */
  slowQueryThreshold: number;
  /** 自动优化查询 */
  autoOptimizeQueries: boolean;
  /** 缓存排除的查询模式 */
  cacheExcludePatterns: RegExp[];
  /** 需要分析的查询模式 */
  analysisIncludePatterns: RegExp[];
}

// 优化结果接口
export interface OptimizationResult {
  /** 查询时间 */
  queryTime: number;
  /** 是否使用缓存 */
  fromCache: boolean;
  /** 优化建议 */
  suggestions: string[];
  /** 是否为慢查询 */
  isSlowQuery: boolean;
  /** 查询优化结果 */
  queryOptimization?: {
    originalQuery: string;
    optimizedQuery?: string;
    estimatedImprovement?: string;
  };
}

// 默认配置
const defaultConfig: OptimizationConfig = {
  enableQueryCache: true,
  enableQueryAnalysis: true,
  enablePoolMonitoring: true,
  enablePerformanceMonitoring: true,
  slowQueryThreshold: 1000,
  autoOptimizeQueries: false,
  cacheExcludePatterns: [
    /^INSERT/i,
    /^UPDATE/i,
    /^DELETE/i,
    /^CREATE/i,
    /^DROP/i,
    /^ALTER/i,
  ],
  analysisIncludePatterns: [
    /^SELECT/i,
  ],
};

/**
 * 数据库性能优化器类
 */
class DatabaseOptimizer {
  private static instance: DatabaseOptimizer;
  private config: OptimizationConfig;
  private isInitialized = false;

  private constructor() {
    this.config = { ...defaultConfig };
  }

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer();
    }
    return DatabaseOptimizer.instance;
  }

  /**
   * 初始化优化器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('🚀 初始化数据库性能优化器');

      // 设置慢查询阈值
      databasePerformanceMonitor.setSlowQueryThreshold(this.config.slowQueryThreshold);

      // 基本初始化完成（不依赖数据库连接池）
      this.isInitialized = true;
      logger.info('✅ 数据库性能优化器初始化完成');

    } catch (error) {
      logger.error('❌ 数据库性能优化器初始化失败', { error });
      throw error;
    }
  }

  /**
   * 优化查询
   */
  async optimizeQuery(query: string, params: unknown[] = []): Promise<OptimizationResult> {
    const startTime = performance.now();
    const result: OptimizationResult = {
      queryTime: 0,
      fromCache: false,
      suggestions: [],
      isSlowQuery: false,
    };

    try {
      // 检查是否应该使用缓存
      if (this.shouldUseCache(query)) {
        const cached = defaultQueryCache.get(query, params);
        if (cached !== null) {
          result.fromCache = true;
          result.queryTime = performance.now() - startTime;
          return result;
        }
      }

      // 查询分析（只有在数据库可用时才执行）
      if (this.shouldAnalyzeQuery(query)) {
        try {
          const pool = getPool();
          const optimizer = getQueryOptimizer(pool);
          const analysis = await optimizer.analyzeQuery(query, params);

          result.queryOptimization = {
            originalQuery: query,
            optimizedQuery: optimizer.optimizeQuery(query).optimized,
          };

          result.suggestions = analysis.suggestions.map(s => s.description);

          // 如果启用自动优化，应用优化建议
          if (this.config.autoOptimizeQueries && analysis.suggestions.length > 0) {
            const optimized = optimizer.optimizeQuery(query);
            query = optimized.optimized;
            result.queryOptimization.optimizedQuery = query;
          }
        } catch (dbError) {
          logger.warn('数据库查询分析失败，跳过优化', { query, error: dbError instanceof Error ? dbError.message : String(dbError) });
        }
      }

      // 执行查询（这里只是模拟，实际查询在数据库层执行）
      const queryTime = performance.now() - startTime;
      result.queryTime = queryTime;
      result.isSlowQuery = queryTime > this.config.slowQueryThreshold;

      // 缓存查询结果
      if (this.shouldUseCache(query) && this.shouldCacheResult(result)) {
        // 注意：这里没有实际的查询结果，实际使用时需要传入结果
      }

      // 记录慢查询
      if (result.isSlowQuery) {
        logger.warn('检测到慢查询', {
          query: query.substring(0, 100),
          queryTime: `${queryTime.toFixed(2)}ms`,
          suggestions: result.suggestions.length,
        });
      }

      return result;

    } catch (error) {
      logger.error('查询优化失败', { query, error });
      result.queryTime = performance.now() - startTime;
      return result;
    }
  }

  /**
   * 判断是否应该使用缓存
   */
  private shouldUseCache(query: string): boolean {
    if (!this.config.enableQueryCache) {
      return false;
    }

    return !this.config.cacheExcludePatterns.some(pattern => pattern.test(query));
  }

  /**
   * 判断是否应该分析查询
   */
  private shouldAnalyzeQuery(query: string): boolean {
    if (!this.config.enableQueryAnalysis) {
      return false;
    }

    return this.config.analysisIncludePatterns.some(pattern => pattern.test(query));
  }

  /**
   * 判断是否应该缓存结果
   */
  private shouldCacheResult(result: OptimizationResult): boolean {
    // 不缓存慢查询的错误结果
    if (result.isSlowQuery && result.suggestions.length > 0) {
      return false;
    }

    return true;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('数据库优化配置已更新', { config: this.config });
  }

  /**
   * 获取配置
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * 生成综合性能报告
   */
  generateComprehensiveReport(): string {
    const poolReport = connectionPoolOptimizer.generatePerformanceReport();
    const cacheReport = defaultQueryCache.generatePerformanceReport();
    const perfReport = databasePerformanceMonitor.generatePerformanceReport();

    return `
数据库综合性能报告
====================

🔗 连接池性能
${poolReport}

💾 查询缓存性能
${cacheReport}

📊 查询性能监控
${perfReport}

⚙️ 优化器配置
- 查询缓存: ${this.config.enableQueryCache ? '启用' : '禁用'}
- 查询分析: ${this.config.enableQueryAnalysis ? '启用' : '禁用'}
- 连接池监控: ${this.config.enablePoolMonitoring ? '启用' : '禁用'}
- 性能监控: ${this.config.enablePerformanceMonitoring ? '启用' : '禁用'}
- 慢查询阈值: ${this.config.slowQueryThreshold}ms
- 自动优化: ${this.config.autoOptimizeQueries ? '启用' : '禁用'}

💡 综合优化建议
${this.generateComprehensiveRecommendations()}
    `.trim();
  }

  /**
   * 生成综合优化建议
   */
  private generateComprehensiveRecommendations(): string[] {
    const recommendations: string[] = [];

    // 连接池建议
    const poolRecommendations = connectionPoolOptimizer.getPerformanceRecommendations();
    recommendations.push(...poolRecommendations.map(rec => `连接池: ${rec}`));

    // 缓存建议
    const cacheStats = defaultQueryCache.getStats();
    if (cacheStats.hitRate < 50) {
      recommendations.push('缓存: 命中率较低，建议调整缓存策略');
    }

    // 查询性能建议
    const perfStats = databasePerformanceMonitor.getStats();
    if (perfStats.averageResponseTime > 500) {
      recommendations.push('查询: 平均响应时间较长，建议优化慢查询');
    }

    // 整体建议
    if (recommendations.length === 0) {
      recommendations.push('数据库性能整体良好，继续保持当前配置');
    }

    return recommendations;
  }

  /**
   * 执行自动优化
   */
  async performAutoOptimization(): Promise<void> {
    if (!this.config.autoOptimizeQueries) {
      logger.info('自动优化未启用');
      return;
    }

    try {
      logger.info('🔧 开始执行自动优化...');

      // 优化连接池配置
      await connectionPoolOptimizer.optimizePoolConfig();

      // 清理过期缓存（通过创建新实例来触发清理）
      // defaultQueryCache.cleanup();

      // 重置性能统计（如果需要）
      // databasePerformanceMonitor.resetStats();

      logger.info('✅ 自动优化完成');

    } catch (error) {
      logger.error('❌ 自动优化失败', { error });
    }
  }

  /**
   * 停止优化器
   */
  stop(): void {
    logger.info('⏹️ 停止数据库性能优化器');

    // 停止连接池监控
    if (this.config.enablePoolMonitoring) {
      connectionPoolOptimizer.stopMonitoring();
    }

    // 停止缓存
    defaultQueryCache.stop();

    this.isInitialized = false;
  }
}

// 创建单例实例
const databaseOptimizer = DatabaseOptimizer.getInstance();

/**
 * 数据库优化中间件
 */
export function databaseOptimizationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 只对数据库相关的请求进行处理
  if (!req.path.startsWith('/api/') || req.method === 'OPTIONS') {
    return next();
  }

  const originalJson = res.json;
  const queryOptimizations: OptimizationResult[] = [];

  // 拦截JSON响应
  res.json = function(this: Response, data: unknown) {
    // 添加优化信息到响应中（如果在开发环境）
    if (process.env.NODE_ENV === 'development' && queryOptimizations.length > 0) {
      if (data && typeof data === 'object') {
        (data)._queryOptimizations = queryOptimizations;
      }
    }

    return originalJson.call(this, data);
  };

  // 存储原始查询方法（暂时注释掉，因为没有req.db）
  // const originalQuery = req.db?.query;
  // if (originalQuery) {
  //   // 包装查询方法
  //   req.db.query = async function(query: string, params?: unknown[]) {
  //     const optimization = await databaseOptimizer.optimizeQuery(query, params);
  //     queryOptimizations.push(optimization);

  //     // 执行原始查询
  //     return originalQuery.call(this, query, params);
  //   };
  // }

  next();
}

/**
 * 初始化数据库优化器
 */
export async function initializeDatabaseOptimization(): Promise<void> {
  await databaseOptimizer.initialize();
}

/**
 * 更新数据库优化配置
 */
export function updateDatabaseOptimizationConfig(config: Partial<OptimizationConfig>): void {
  databaseOptimizer.updateConfig(config);
}

/**
 * 生成数据库性能报告
 */
export function generateDatabasePerformanceReport(): string {
  return databaseOptimizer.generateComprehensiveReport();
}

/**
 * 执行数据库自动优化
 */
export async function performDatabaseAutoOptimization(): Promise<void> {
  await databaseOptimizer.performAutoOptimization();
}

export default databaseOptimizer;