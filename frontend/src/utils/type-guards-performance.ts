/**
 * 类型守卫性能优化工具
 *
 * 提供类型守卫的性能优化机制，包括缓存、惰性加载、批量处理等功能。
 * 确保类型验证不会影响应用性能。
 *
 * @module type-guards-performance
 * @version 2.0.0
 * @since 2025-10-18
 */

import { TypeValidator, ValidationResult, SyncValidator, AsyncValidator } from './advanced-type-guards';

// ============================================================================
// 性能优化配置
// ============================================================================

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  enableCache: boolean;
  cacheSize: number;
  enableMetrics: boolean;
  enableLazyLoading: boolean;
  batchSize: number;
  timeoutMs: number;
}

/**
 * 默认性能配置
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableCache: true,
  cacheSize: 1000,
  enableMetrics: process.env.NODE_ENV === 'development',
  enableLazyLoading: true,
  batchSize: 50,
  timeoutMs: 5000
};

// ============================================================================
// 缓存机制
// ============================================================================

/**
 * LRU缓存实现
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = DEFAULT_PERFORMANCE_CONFIG.cacheSize) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 移到最后（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的项
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values());
  }
}

/**
 * 全局缓存管理器
 */
export class CacheManager {
  private static instance: CacheManager;
  private caches: Map<string, LRUCache<any, any>> = new Map();
  private config: PerformanceConfig;

  private constructor(config: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG) {
    this.config = config;
  }

  static getInstance(config?: PerformanceConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  getCache<K, V>(name: string): LRUCache<K, V> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache<K, V>(this.config.cacheSize));
    }
    return this.caches.get(name) as LRUCache<K, V>;
  }

  clearCache(name?: string): void {
    if (name) {
      this.caches.get(name)?.clear();
    } else {
      this.caches.forEach(cache => cache.clear());
    }
  }

  getCacheStats(): Record<string, { size: number; maxSize: number }> {
    const stats: Record<string, { size: number; maxSize: number }> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = {
        size: cache.size(),
        maxSize: (cache as any).maxSize
      };
    });
    return stats;
  }

  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// 性能指标收集
// ============================================================================

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  cacheHits: number;
  cacheMisses: number;
  averageValidationTime: number;
  totalValidationTime: number;
  slowestValidation: number;
  fastestValidation: number;
  lastResetTime: number;
}

/**
 * 性能指标收集器
 */
export class PerformanceMetricsCollector {
  private metrics: PerformanceMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageValidationTime: 0,
    totalValidationTime: 0,
    slowestValidation: 0,
    fastestValidation: Infinity,
    lastResetTime: Date.now()
  };

  private enabled: boolean;

  constructor(enabled = DEFAULT_PERFORMANCE_CONFIG.enableMetrics) {
    this.enabled = enabled;
  }

  recordValidation(duration: number, success: boolean, cacheHit: boolean): void {
    if (!this.enabled) return;

    this.metrics.totalValidations++;
    this.metrics.totalValidationTime += duration;
    this.metrics.averageValidationTime = this.metrics.totalValidationTime / this.metrics.totalValidations;

    if (success) {
      this.metrics.successfulValidations++;
    } else {
      this.metrics.failedValidations++;
    }

    if (cacheHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    if (duration > this.metrics.slowestValidation) {
      this.metrics.slowestValidation = duration;
    }

    if (duration < this.metrics.fastestValidation) {
      this.metrics.fastestValidation = duration;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      totalValidationTime: 0,
      slowestValidation: 0,
      fastestValidation: Infinity,
      lastResetTime: Date.now()
    };
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// ============================================================================
// 性能优化的类型验证器
// ============================================================================

/**
 * 性能优化的类型验证器
 */
export class OptimizedTypeValidator<T = any> {
  private validator: TypeValidator<T>;
  private cache: LRUCache<any, ValidationResult<T>>;
  private metrics: PerformanceMetricsCollector;
  private config: PerformanceConfig;

  constructor(
    validator: TypeValidator<T>,
    config: Partial<PerformanceConfig> = {}
  ) {
    this.validator = validator;
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    this.cache = CacheManager.getInstance().getCache<any, ValidationResult<T>>(`validator_${Date.now()}`);
    this.metrics = new PerformanceMetricsCollector(this.config.enableMetrics);
  }

  /**
   * 优化的验证方法
   */
  test(value: unknown): ValidationResult<T> {
    const startTime = performance.now();

    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(value);
      const cachedResult = this.cache.get(cacheKey);

      if (cachedResult) {
        this.metrics.recordValidation(performance.now() - startTime, true, true);
        return cachedResult;
      }
    }

    // 执行验证
    const isValid = this.validator(value);
    const result: ValidationResult<T> = {
      isValid,
      ...(isValid && { data: value as T }),
      errors: isValid ? [] : ['Validation failed']
    };

    // 缓存结果
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(value);
      this.cache.set(cacheKey, result);
    }

    const duration = performance.now() - startTime;
    this.metrics.recordValidation(duration, isValid, false);

    return result;
  }

  /**
   * 批量验证
   */
  async testBatch(values: unknown[]): Promise<ValidationResult<T>[]> {
    const results: ValidationResult<T>[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const batchResults = batch.map(value => this.test(value));
      results.push(...batchResults);

      // 让出控制权，避免阻塞主线程
      if (i + batchSize < values.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return results;
  }

  /**
   * 异步验证（带超时）
   */
  async testAsync(value: unknown): Promise<ValidationResult<T>> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Validation timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      try {
        const result = this.test(value);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    return this.metrics.getMetrics();
  }

  /**
   * 重置性能指标
   */
  resetMetrics(): void {
    this.metrics.reset();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(value: unknown): string {
    try {
      // 对于简单类型，直接使用值作为键
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return `${typeof value}:${value}`;
      }

      // 对于复杂类型，使用序列化后的值作为键
      return JSON.stringify(value);
    } catch {
      // 如果序列化失败，使用对象的内存地址
      return `object:${(value as any).toString()}`;
    }
  }
}

// ============================================================================
// 惰性加载验证器
// ============================================================================

/**
 * 惰性加载验证器工厂
 */
export class LazyValidatorFactory<T = any> {
  private validatorFactory: () => TypeValidator<T>;
  private validator: TypeValidator<T> | null = null;
  private creating = false;
  private createPromise: Promise<TypeValidator<T>> | null = null;

  constructor(factory: () => TypeValidator<T>) {
    this.validatorFactory = factory;
  }

  /**
   * 获取验证器（惰性创建）
   */
  async getValidator(): Promise<TypeValidator<T>> {
    if (this.validator) {
      return this.validator;
    }

    if (this.creating && this.createPromise) {
      return this.createPromise;
    }

    this.creating = true;
    this.createPromise = new Promise((resolve, reject) => {
      try {
        const validator = this.validatorFactory();
        this.validator = validator;
        resolve(validator);
      } catch (error) {
        reject(error);
      } finally {
        this.creating = false;
        this.createPromise = null;
      }
    });

    return this.createPromise;
  }

  /**
   * 同步获取验证器（如果已创建）
   */
  getValidatorSync(): TypeValidator<T> | null {
    return this.validator;
  }

  /**
   * 预创建验证器
   */
  async preCreate(): Promise<void> {
    await this.getValidator();
  }

  /**
   * 重置验证器（下次使用时重新创建）
   */
  reset(): void {
    this.validator = null;
    this.creating = false;
    this.createPromise = null;
  }
}

// ============================================================================
// 批量验证处理器
// ============================================================================

/**
 * 批量验证任务
 */
interface ValidationTask<T = any> {
  id: string;
  value: unknown;
  validator: OptimizedTypeValidator<T>;
  resolve: (result: ValidationResult<T>) => void;
  reject: (error: Error) => void;
  priority: number;
}

/**
 * 批量验证处理器
 */
export class BatchValidationProcessor {
  private taskQueue: ValidationTask[] = [];
  private processing = false;
  private batchSize: number;
  private maxConcurrency: number;
  private processingCount = 0;

  constructor(
    batchSize = DEFAULT_PERFORMANCE_CONFIG.batchSize,
    maxConcurrency = 4
  ) {
    this.batchSize = batchSize;
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * 添加验证任务
   */
  addTask<T>(
    value: unknown,
    validator: OptimizedTypeValidator<T>,
    priority = 0
  ): Promise<ValidationResult<T>> {
    return new Promise((resolve, reject) => {
      const task: ValidationTask<T> = {
        id: `task_${Date.now()}_${Math.random()}`,
        value,
        validator,
        resolve,
        reject,
        priority
      };

      // 按优先级插入
      const insertIndex = this.taskQueue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.taskQueue.push(task);
      } else {
        this.taskQueue.splice(insertIndex, 0, task);
      }

      this.processQueue();
    });
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.processingCount >= this.maxConcurrency) {
      return;
    }

    this.processing = true;

    while (this.taskQueue.length > 0 && this.processingCount < this.maxConcurrency) {
      const batch = this.taskQueue.splice(0, this.batchSize);
      this.processingCount++;

      // 异步处理批次
      this.processBatch(batch).finally(() => {
        this.processingCount--;
        if (this.taskQueue.length > 0) {
          this.processQueue();
        } else {
          this.processing = false;
        }
      });
    }
  }

  /**
   * 处理批次任务
   */
  private async processBatch(batch: ValidationTask[]): Promise<void> {
    const promises = batch.map(async task => {
      try {
        const result = task.validator.test(task.value);
        task.resolve(result);
      } catch (error) {
        task.reject(error instanceof Error ? error : new Error('Unknown validation error'));
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    processingCount: number;
  } {
    return {
      queueLength: this.taskQueue.length,
      processing: this.processing,
      processingCount: this.processingCount
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.taskQueue.forEach(task => {
      task.reject(new Error('Task cancelled due to queue clear'));
    });
    this.taskQueue = [];
  }
}

// ============================================================================
// 性能监控和报告
// ============================================================================

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetricsCollector;
  private reportInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.metrics = new PerformanceMetricsCollector();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 开始性能监控
   */
  startMonitoring(reportIntervalMs = 60000): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }

    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, reportIntervalMs);
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  /**
   * 记录验证性能
   */
  recordValidation(duration: number, success: boolean, cacheHit: boolean): void {
    this.metrics.recordValidation(duration, success, cacheHit);
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const metrics = this.metrics.getMetrics();
    const cacheStats = CacheManager.getInstance().getCacheStats();

    return {
      timestamp: Date.now(),
      metrics,
      cacheStats,
      recommendations: this.generateRecommendations(metrics, cacheStats)
    };
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(
    metrics: PerformanceMetrics,
    cacheStats: Record<string, { size: number; maxSize: number }>
  ): string[] {
    const recommendations: string[] = [];

    // 验证成功率建议
    const successRate = metrics.successfulValidations / metrics.totalValidations;
    if (successRate < 0.9) {
      recommendations.push('验证成功率较低，建议检查验证逻辑和数据质量');
    }

    // 平均验证时间建议
    if (metrics.averageValidationTime > 10) {
      recommendations.push('平均验证时间较长，建议优化验证器或使用缓存');
    }

    // 缓存命中率建议
    const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses);
    if (cacheHitRate < 0.5 && metrics.totalValidations > 100) {
      recommendations.push('缓存命中率较低，建议增加缓存大小或优化缓存策略');
    }

    // 缓存使用率建议
    Object.entries(cacheStats).forEach(([name, stats]) => {
      const utilization = stats.size / stats.maxSize;
      if (utilization > 0.9) {
        recommendations.push(`缓存 ${name} 使用率过高，建议增加缓存大小`);
      } else if (utilization < 0.1 && stats.size > 0) {
        recommendations.push(`缓存 ${name} 使用率过低，建议减少缓存大小`);
      }
    });

    return recommendations;
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics.reset();
  }
}

/**
 * 性能报告接口
 */
export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetrics;
  cacheStats: Record<string, { size: number; maxSize: number }>;
  recommendations: string[];
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建优化的类型验证器
 */
export const createOptimizedValidator = <T>(
  validator: TypeValidator<T>,
  config?: Partial<PerformanceConfig>
): OptimizedTypeValidator<T> => {
  return new OptimizedTypeValidator(validator, config);
};

/**
 * 创建惰性验证器工厂
 */
export const createLazyValidator = <T>(
  factory: () => TypeValidator<T>
): LazyValidatorFactory<T> => {
  return new LazyValidatorFactory(factory);
};

/**
 * 创建批量验证处理器
 */
export const createBatchProcessor = (
  batchSize?: number,
  maxConcurrency?: number
): BatchValidationProcessor => {
  return new BatchValidationProcessor(batchSize, maxConcurrency);
};

/**
 * 获取性能监控器实例
 */
export const getPerformanceMonitor = (): PerformanceMonitor => {
  return PerformanceMonitor.getInstance();
};

/**
 * 预热验证器缓存
 */
export const warmupValidatorCache = async <T>(
  validator: OptimizedTypeValidator<T>,
  testData: unknown[]
): Promise<void> => {
  const promises = testData.map(data => validator.test(data));
  await Promise.all(promises);
};

