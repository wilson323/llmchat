/**
 * 缓存中间件
 *
 * 集成RedisCacheManager，提供自动缓存、响应缓存和缓存策略
 */

import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { RedisCacheManager, CacheStrategy } from '@/services/RedisCacheManager';

// 缓存中间件配置接口
export interface CacheMiddlewareConfig {
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 默认TTL（秒） */
  defaultTtl?: number;
  /** 缓存键生成器 */
  keyGenerator?: (req: Request) => string;
  /** 是否缓存成功响应 */
  cacheSuccess?: boolean;
  /** 是否缓存错误响应 */
  cacheErrors?: boolean;
  /** 缓存标签生成器 */
  tagGenerator?: (req: Request) => string[];
  /** 条件缓存函数 */
  shouldCache?: (req: Request, res: Response) => boolean;
  /** 缓存键前缀 */
  keyPrefix?: string;
  /** 压缩阈值 */
  compressThreshold?: number;
  /** 忽略的查询参数 */
  ignoreQueryParams?: string[];
}

// 缓存统计接口
export interface CacheMiddlewareStats {
  /** 总请求数 */
  totalRequests: number;
  /** 缓存命中数 */
  cacheHits: number;
  /** 缓存未命中数 */
  cacheMisses: number;
  /** 缓存设置数 */
  cacheSets: number;
  /** 缓存命中率 */
  hitRate: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 缓存节省时间 */
  timeSaved: number;
}

/**
 * 缓存中间件类
 */
class CacheMiddlewareManager {
  private static instance: CacheMiddlewareManager;
  private cacheManager: RedisCacheManager;
  private config: CacheMiddlewareConfig;
  private stats: CacheMiddlewareStats;

  private constructor() {
    this.cacheManager = RedisCacheManager.getInstance();
    this.config = this.getDefaultConfig();
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheSets: 0,
      hitRate: 0,
      averageResponseTime: 0,
      timeSaved: 0,
    };
  }

  static getInstance(): CacheMiddlewareManager {
    if (!CacheMiddlewareManager.instance) {
      CacheMiddlewareManager.instance = new CacheMiddlewareManager();
    }
    return CacheMiddlewareManager.instance;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): CacheMiddlewareConfig {
    return {
      strategy: CacheStrategy.CACHE_ASIDE,
      defaultTtl: 300, // 5分钟
      cacheSuccess: true,
      cacheErrors: false,
      keyPrefix: 'api_cache',
      compressThreshold: 1024, // 1KB
      ignoreQueryParams: ['_', 't', 'timestamp'],
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CacheMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('缓存中间件配置已更新', { config: this.config });
  }

  /**
   * 获取配置
   */
  getConfig(): CacheMiddlewareConfig {
    return { ...this.config };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // 默认缓存键生成策略
    const url = req.originalUrl || req.url;
    const method = req.method.toLowerCase();

    // 处理查询参数
    let queryString = '';
    if (req.query && Object.keys(req.query).length > 0) {
      const filteredQuery = { ...req.query };

      // 移除忽略的查询参数
      if (this.config.ignoreQueryParams) {
        this.config.ignoreQueryParams.forEach(param => {
          delete filteredQuery[param];
        });
      }

      // 排序查询参数以确保一致性
      const sortedKeys = Object.keys(filteredQuery).sort();
      const queryPairs = sortedKeys.map(key => `${key}=${filteredQuery[key]}`);
      queryString = queryPairs.join('&');
    }

    const basePath = url.split('?')[0];
    const cacheKey = queryString
      ? `${this.config.keyPrefix}:${method}:${basePath}:${queryString}`
      : `${this.config.keyPrefix}:${method}:${basePath}`;

    return cacheKey.replace(/[^a-zA-Z0-9:_\-]/g, '_');
  }

  /**
   * 生成缓存标签
   */
  private generateCacheTags(req: Request): string[] {
    if (this.config.tagGenerator) {
      return this.config.tagGenerator(req);
    }

    // 默认标签生成策略
    const tags: string[] = [];

    // 按路径添加标签
    const pathParts = req.path.split('/').filter(part => part && !isNaN(Number(part)) === false);
    pathParts.forEach(part => {
      tags.push(`path:${part}`);
    });

    // 按HTTP方法添加标签
    tags.push(`method:${req.method.toLowerCase()}`);

    // 按用户角色添加标签（如果有用户信息）
    if (req.user) {
      tags.push(`role:${req.user.role || 'anonymous'}`);
    }

    return tags;
  }

  /**
   * 判断是否应该缓存
   */
  private shouldCacheRequest(req: Request, res: Response): boolean {
    // 自定义缓存条件
    if (this.config.shouldCache) {
      return this.config.shouldCache(req, res);
    }

    // 默认缓存条件
    const method = req.method.toLowerCase();
    const contentType = res.get('Content-Type') || '';

    // 只缓存GET和HEAD请求
    if (!['get', 'head'].includes(method)) {
      return false;
    }

    // 检查响应状态码
    if (!this.config.cacheErrors && res.statusCode >= 400) {
      return false;
    }

    if (!this.config.cacheSuccess && res.statusCode >= 200 && res.statusCode < 300) {
      return false;
    }

    // 检查内容类型
    const cacheableTypes = [
      'application/json',
      'text/html',
      'text/plain',
      'text/xml',
      'application/xml',
    ];

    const isCacheableType = cacheableTypes.some(type => contentType.includes(type));
    if (!isCacheableType) {
      return false;
    }

    // 检查响应头中的缓存控制指令
    const cacheControl = res.get('Cache-Control') || '';
    if (cacheControl.includes('no-cache') || cacheControl.includes('private')) {
      return false;
    }

    return true;
  }

  /**
   * 计算TTL
   */
  private calculateTtl(req: Request, res: Response): number {
    // 检查响应头中的缓存控制
    const cacheControl = res.get('Cache-Control');

    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch && maxAgeMatch[1]) {
        return parseInt(maxAgeMatch[1], 10);
      }
    }

    // 检查Expires头
    const expires = res.get('Expires');
    if (expires) {
      const expiresTime = new Date(expires).getTime();
      const now = Date.now();
      const ttl = Math.max(0, Math.floor((expiresTime - now) / 1000));
      if (ttl > 0) {
        return ttl;
      }
    }

    // 使用默认TTL
    return this.config.defaultTtl || 300;
  }

  /**
   * 序列化响应数据
   */
  private serializeResponse(res: Response): string | null {
    try {
      // 检查是否已有响应数据
      const responseData = (res as any).responseData;
      if (responseData) {
        return JSON.stringify(responseData);
      }

      // 如果没有缓存的数据，返回null
      return null;
    } catch (error) {
      logger.warn('序列化响应数据失败', { error });
      return null;
    }
  }

  /**
   * 反序列化响应数据
   */
  private deserializeResponse(data: string): any {
    try {
      return JSON.parse(data);
    } catch (error) {
      logger.warn('反序列化响应数据失败', { error });
      return null;
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(hit: boolean, responseTime: number): void {
    this.stats.totalRequests++;

    if (hit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }

    // 更新命中率
    this.stats.hitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100
      : 0;

    // 更新平均响应时间
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;

    // 更新节省时间（假设缓存命中比原始请求快95%）
    if (hit) {
      this.stats.timeSaved += responseTime * 0.95;
    }
  }

  /**
   * 缓存中间件
   */
  cacheMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(req);
    const tags = this.generateCacheTags(req);

    logger.debug('缓存中间件处理请求', {
      method: req.method,
      url: req.url,
      cacheKey,
      tags
    });

    // 尝试从缓存获取
    const cacheOptions: {
      tags?: string[];
      strategy?: CacheStrategy;
    } = {};

    if (tags) {
      cacheOptions.tags = tags;
    }

    if (this.config.strategy) {
      cacheOptions.strategy = this.config.strategy;
    }

    this.cacheManager.get(cacheKey, cacheOptions)
      .then(cachedData => {
        if (cachedData !== null) {
          // 缓存命中
          const responseTime = performance.now() - startTime;
          this.updateStats(true, responseTime);

          logger.info('缓存命中', {
            cacheKey,
            responseTime: `${responseTime.toFixed(2)}ms`,
            hitRate: `${this.stats.hitRate.toFixed(1)}%`
          });

          // 设置缓存头
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);

          // 反序列化并发送响应
          const responseData = this.deserializeResponse(cachedData as string);
          if (responseData) {
            res.json(responseData);
          } else {
            // 缓存数据损坏，删除缓存并继续处理
            this.cacheManager.delete(cacheKey);
            return this.processRequest(req, res, next, startTime, cacheKey, tags);
          }
        } else {
          // 缓存未命中，继续处理请求
          this.processRequest(req, res, next, startTime, cacheKey, tags);
        }
      })
      .catch(error => {
        logger.error('缓存查询失败', { cacheKey, error });
        // 缓存失败时继续处理请求
        this.processRequest(req, res, next, startTime, cacheKey, tags);
      });
  };

  /**
   * 处理请求
   */
  private processRequest(
    req: Request,
    res: Response,
    next: NextFunction,
    startTime: number,
    cacheKey: string,
    tags: string[]
  ): void {
    const originalJson = res.json;
    const originalEnd = res.end;
    const self = this;

    // 拦截json方法
    res.json = (data: any) => {
      // 存储响应数据用于缓存
      (res as any).responseData = data;
      return originalJson.call(res, data);
    };

    // 拦截end方法
    res.end = function(this: Response, ...args: any[]) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // 检查是否应该缓存响应
      if (self.shouldCacheRequest(req, res)) {
        const responseData = self.serializeResponse(res);
        if (responseData) {
          const ttl = self.calculateTtl(req, res);
          const shouldCompress = responseData.length > (self.config.compressThreshold || 1024);

          const cacheOptions: {
            ttl: number;
            tags: string[];
            strategy?: CacheStrategy;
            compress: boolean;
          } = {
            ttl,
            tags,
            compress: shouldCompress,
          };

          if (self.config.strategy) {
            cacheOptions.strategy = self.config.strategy;
          }

          self.cacheManager.set(cacheKey, responseData, cacheOptions)
          .then((success: boolean) => {
            if (success) {
              self.stats.cacheSets++;
              logger.debug('响应已缓存', {
                cacheKey,
                ttl,
                size: responseData.length,
                compressed: shouldCompress
              });
            }
          })
          .catch((error: Error) => {
            logger.warn('缓存响应失败', { cacheKey, error });
          });
        }
      }

      // 更新统计
      self.updateStats(false, responseTime);

      // 设置缓存头
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);

      // 调用原始end方法
      return originalEnd.apply(res, args as any);
    };

    next();
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheMiddlewareStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheSets: 0,
      hitRate: 0,
      averageResponseTime: 0,
      timeSaved: 0,
    };
    logger.info('缓存中间件统计已重置');
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): string {
    const stats = this.getStats();
    const cacheManagerStats = this.cacheManager.getStats();

    return `
缓存中间件性能报告
================

📊 请求统计
- 总请求数: ${stats.totalRequests}
- 缓存命中数: ${stats.cacheHits}
- 缓存未命中数: ${stats.cacheMisses}
- 缓存设置数: ${stats.cacheSets}
- 缓存命中率: ${stats.hitRate.toFixed(1)}%

⏱️ 响应时间
- 平均响应时间: ${stats.averageResponseTime.toFixed(2)}ms
- 缓存节省时间: ${stats.timeSaved.toFixed(2)}ms

🔧 Redis缓存统计
${cacheManagerStats}

💡 性能优化建议
${this.generateOptimizationRecommendations()}
    `.trim();
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    if (stats.hitRate < 50) {
      recommendations.push('缓存命中率较低，建议调整缓存策略或增加TTL时间');
    }

    if (stats.averageResponseTime > 1000) {
      recommendations.push('平均响应时间较长，建议启用压缩或优化缓存键设计');
    }

    if (stats.totalRequests > 1000 && stats.cacheSets < stats.totalRequests * 0.3) {
      recommendations.push('缓存设置比例较低，建议检查缓存条件配置');
    }

    if (recommendations.length === 0) {
      recommendations.push('缓存性能良好，继续保持当前配置');
    }

    return recommendations;
  }
}

// 创建单例实例
const cacheMiddlewareManager = CacheMiddlewareManager.getInstance();

/**
 * 缓存中间件
 */
export function cacheMiddleware(config?: Partial<CacheMiddlewareConfig>) {
  if (config) {
    cacheMiddlewareManager.updateConfig(config);
  }
  return cacheMiddlewareManager.cacheMiddleware;
}

/**
 * 更新缓存中间件配置
 */
export function updateCacheMiddlewareConfig(config: Partial<CacheMiddlewareConfig>): void {
  cacheMiddlewareManager.updateConfig(config);
}

/**
 * 获取缓存中间件统计
 */
export function getCacheMiddlewareStats(): CacheMiddlewareStats {
  return cacheMiddlewareManager.getStats();
}

/**
 * 重置缓存中间件统计
 */
export function resetCacheMiddlewareStats(): void {
  cacheMiddlewareManager.resetStats();
}

/**
 * 生成缓存性能报告
 */
export function generateCachePerformanceReport(): string {
  return cacheMiddlewareManager.generatePerformanceReport();
}

export default cacheMiddlewareManager;