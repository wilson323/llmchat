/**
 * 请求预处理器 - 极致优化版本
 * 专注于请求预处理和响应缓存，减少API响应时间
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

import logger from '@/utils/logger';
import { OptimizedCacheService } from '@/services/OptimizedCacheService';
import { memoryResourceManager } from '@/utils/MemoryResourceManager';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';

// 压缩相关
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// 配置
const CACHE_TTL = 5 * 60 * 1000; // 5分钟
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const COMPRESSION_THRESHOLD = 1024; // 1KB以上才压缩

// 缓存条目接口
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  compressed: boolean;
  size: number;
  hitCount: number;
  lastHit: number;
}

// 请求预处理结果接口
interface PreprocessedRequest {
  requestId: string;
  cacheKey: string;
  agentId: string;
  isValid: boolean;
  error?: any;
  validationTime: number;
  preprocessedAt: number;
}

// 响应缓存接口
interface ResponseCache {
  status: number;
  headers: Record<string, string>;
  data: any;
  timestamp: number;
  ttl: number;
  compressed: boolean;
  size: number;
  etag?: string;
}

/**
 * 极致优化的请求预处理器
 */
export class RequestPreprocessor {
  private static instance: RequestPreprocessor;

  // 缓存服务
  private cacheService: OptimizedCacheService;
  private memoryCache = new Map<string, CacheEntry>();
  private responseCache = new Map<string, ResponseCache>();

  // 性能统计
  private metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    compressionSavings: 0,
    averagePreprocessingTime: 0,
    averageResponseTime: 0,
  };

  // 内存管理
  private totalCacheSize = 0;
  private readonly maxMemoryUsage = MAX_CACHE_SIZE;

  // 热点数据
  private hotPatterns = new Map<string, number>();
  private blacklist = new Set<string>();

  private constructor() {
    this.cacheService = new OptimizedCacheService('request_preprocessor');

    // 定期清理过期缓存
    setInterval(() => this.cleanupExpiredCache(), 60 * 1000);

    // 定期优化缓存
    setInterval(() => this.optimizeCache(), 5 * 60 * 1000);

    // 定期更新统计
    setInterval(() => this.updateMetrics(), 30 * 1000);
  }

  static getInstance(): RequestPreprocessor {
    if (!RequestPreprocessor.instance) {
      RequestPreprocessor.instance = new RequestPreprocessor();
    }
    return RequestPreprocessor.instance;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(req: Request): string {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const userAgent = req.get('User-Agent') || '';
    const contentType = req.get('Content-Type') || '';

    // 对于POST请求，包含请求体哈希
    let bodyHash = '';
    if (method === 'POST' && req.body) {
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      bodyHash = crypto.createHash('md5').update(bodyString).digest('hex');
    }

    const components = [
      method,
      url,
      userAgent.substring(0, 100), // 限制用户代理长度
      contentType,
      bodyHash
    ];

    return crypto.createHash('sha256').update(components.join('|')).digest('hex');
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 预处理请求
   */
  async preprocessRequest(req: Request): Promise<PreprocessedRequest> {
    const startTime = performance.now();
    const requestId = this.generateRequestId();
    const cacheKey = this.generateCacheKey(req);

    this.metrics.totalRequests++;

    // 检查黑名单
    if (this.isBlacklisted(req)) {
      return {
        requestId,
        cacheKey,
        agentId: '',
        isValid: false,
        error: {
          code: 'REQUEST_BLOCKED',
          message: '请求被阻止',
        },
        validationTime: performance.now() - startTime,
        preprocessedAt: Date.now(),
      };
    }

    // 尝试从缓存获取预处理结果
    const cached = this.getPreprocessedCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;

      // 更新热点模式
      this.updateHotPattern(cacheKey);

      return {
        ...cached.data,
        requestId,
        validationTime: performance.now() - startTime,
        preprocessedAt: Date.now(),
      };
    }

    this.metrics.cacheMisses++;

    // 执行预处理
    const result = await this.performPreprocessing(req, requestId);

    // 缓存预处理结果
    if (result.isValid) {
      this.setPreprocessedCache(cacheKey, result);
    }

    return {
      ...result,
      requestId,
      cacheKey,
      validationTime: performance.now() - startTime,
      preprocessedAt: Date.now(),
    };
  }

  /**
   * 执行实际的预处理逻辑
   */
  private async performPreprocessing(req: Request, requestId: string): Promise<Omit<PreprocessedRequest, 'requestId' | 'cacheKey' | 'validationTime' | 'preprocessedAt'>> {
    const startTime = performance.now();

    try {
      // 提取智能体ID
      const agentId = this.extractAgentId(req);

      if (!agentId) {
        return {
          agentId: '',
          isValid: false,
          error: {
            code: 'MISSING_AGENT_ID',
            message: '缺少智能体ID',
          },
        };
      }

      // 基础验证
      const validation = await this.validateRequest(req, agentId);

      return {
        agentId,
        isValid: validation.isValid,
        error: validation.error,
      };

    } catch (error) {
      logger.error('请求预处理失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime,
      });

      return {
        agentId: '',
        isValid: false,
        error: {
          code: 'PREPROCESSING_ERROR',
          message: '请求预处理失败',
        },
      };
    }
  }

  /**
   * 提取智能体ID
   */
  private extractAgentId(req: Request): string {
    // 从请求体中提取
    if (req.body && typeof req.body === 'object') {
      const body = req.body as any;
      if (body.agentId) {
        return body.agentId;
      }
      if (body.appId) {
        return body.appId;
      }
    }

    // 从查询参数中提取
    const query = req.query as any;
    if (query.agentId) {
      return query.agentId;
    }
    if (query.appId) {
      return query.appId;
    }

    // 从路径参数中提取
    const params = req.params as any;
    if (params.agentId) {
      return params.agentId;
    }

    return '';
  }

  /**
   * 验证请求
   */
  private async validateRequest(req: Request, agentId: string): Promise<{ isValid: boolean; error?: any }> {
    try {
      // 基础验证
      if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
        return {
          isValid: false,
          error: {
            code: 'INVALID_AGENT_ID',
            message: '智能体ID无效',
          },
        };
      }

      // 检查请求大小
      const contentLength = req.get('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
        return {
          isValid: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: '请求体过大',
          },
        };
      }

      // 检查内容类型
      const contentType = req.get('content-type');
      if (req.method === 'POST' && !contentType?.includes('application/json')) {
        return {
          isValid: false,
          error: {
            code: 'INVALID_CONTENT_TYPE',
            message: '内容类型必须是application/json',
          },
        };
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求验证失败',
        },
      };
    }
  }

  /**
   * 缓存响应
   */
  async cacheResponse(req: Request, res: Response, data: any): Promise<void> {
    const cacheKey = this.generateCacheKey(req);

    // 检查是否应该缓存
    if (!this.shouldCacheResponse(req, res, data)) {
      return;
    }

    try {
      const responseCache: ResponseCache = {
        status: res.statusCode,
        headers: this.extractHeaders(res),
        data,
        timestamp: Date.now(),
        ttl: CACHE_TTL,
        compressed: false,
        size: this.calculateSize(data),
      };

      // 压缩大型响应
      if (responseCache.size > COMPRESSION_THRESHOLD) {
        responseCache.data = await gzip(JSON.stringify(data));
        responseCache.compressed = true;
        responseCache.size = Buffer.byteLength(responseCache.data);
        this.metrics.compressionSavings += JSON.stringify(data).length - responseCache.size;
      }

      // 生成ETag
      responseCache.etag = this.generateETag(responseCache.data);

      // 存储缓存
      this.setResponseCache(cacheKey, responseCache);

      // 设置响应头
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey.substring(0, 16));

      logger.debug('响应已缓存', {
        cacheKey: cacheKey.substring(0, 16),
        size: responseCache.size,
        compressed: responseCache.compressed,
      });

    } catch (error) {
      logger.error('缓存响应失败', {
        cacheKey: cacheKey.substring(0, 16),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取缓存的响应
   */
  async getCachedResponse(req: Request, res: Response): Promise<any | null> {
    const cacheKey = this.generateCacheKey(req);

    // 检查请求头中的缓存控制
    const cacheControl = req.get('cache-control');
    if (cacheControl?.includes('no-cache')) {
      return null;
    }

    // 检查If-None-Match
    const ifNoneMatch = req.get('if-none-match');

    try {
      const cached = this.getResponseCache(cacheKey);
      if (!cached) {
        return null;
      }

      // 检查缓存是否过期
      if (Date.now() - cached.timestamp > cached.ttl) {
        this.deleteResponseCache(cacheKey);
        return null;
      }

      // 检查ETag
      if (ifNoneMatch && cached.etag === ifNoneMatch) {
        res.status(304).send();
        res.setHeader('X-Cache', 'HIT');
        return null;
      }

      // 解压缩数据
      let data = cached.data;
      if (cached.compressed) {
        data = JSON.parse(await gunzip(cached.data));
      }

      // 设置响应头
      res.status(cached.status);
      Object.entries(cached.headers).forEach(([key, value]) => {
        if (!res.getHeader(key)) {
          res.setHeader(key, value);
        }
      });

      if (cached.etag) {
        res.setHeader('ETag', cached.etag);
      }

      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Key', cacheKey.substring(0, 16));
      res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString());

      // 更新缓存统计
      const cacheEntry = this.memoryCache.get(cacheKey);
      if (cacheEntry) {
        cacheEntry.hitCount++;
        cacheEntry.lastHit = Date.now();
      }

      logger.debug('使用缓存响应', {
        cacheKey: cacheKey.substring(0, 16),
        hitCount: cacheEntry?.hitCount || 0,
        age: Math.floor((Date.now() - cached.timestamp) / 1000),
      });

      return data;

    } catch (error) {
      logger.error('获取缓存响应失败', {
        cacheKey: cacheKey.substring(0, 16),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 判断是否应该缓存响应
   */
  private shouldCacheResponse(req: Request, res: Response, data: any): boolean {
    // 只缓存成功的GET和POST请求
    if (!['GET', 'POST'].includes(req.method)) {
      return false;
    }

    // 只缓存成功的响应
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return false;
    }

    // 不缓存过大的响应
    const size = this.calculateSize(data);
    if (size > MAX_CACHE_SIZE) {
      return false;
    }

    // 检查缓存控制头
    const cacheControl = res.get('cache-control');
    if (cacheControl?.includes('no-store') || cacheControl?.includes('private')) {
      return false;
    }

    // 检查路径是否在缓存白名单中
    const path = req.path;
    const cacheablePaths = ['/api/chat/completions', '/api/chat/init'];
    if (!cacheablePaths.some(allowedPath => path.startsWith(allowedPath))) {
      return false;
    }

    return true;
  }

  /**
   * 提取响应头
   */
  private extractHeaders(res: Response): Record<string, string> {
    const headers: Record<string, string> = {};

    // 复制所有响应头，排除一些不应该缓存的头
    const excludeHeaders = [
      'content-length',
      'date',
      'server',
      'connection',
      'transfer-encoding',
      'x-cache',
      'x-cache-key',
      'x-cache-age',
    ];

    res.getHeaderNames()?.forEach(name => {
      if (!excludeHeaders.includes(name.toLowerCase())) {
        const value = res.getHeader(name);
        if (value) {
          headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      }
    });

    return headers;
  }

  /**
   * 计算数据大小
   */
  private calculateSize(data: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(data));
    } catch {
      return 0;
    }
  }

  /**
   * 生成ETag
   */
  private generateETag(data: any): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`;
  }

  /**
   * 检查是否在黑名单中
   */
  private isBlacklisted(req: Request): boolean {
    const key = `${req.method}:${req.path}`;
    return this.blacklist.has(key);
  }

  /**
   * 添加到黑名单
   */
  addToBlacklist(req: Request): void {
    const key = `${req.method}:${req.path}`;
    this.blacklist.add(key);
    logger.warn('请求已添加到黑名单', { key });
  }

  /**
   * 更新热点模式
   */
  private updateHotPattern(cacheKey: string): void {
    const current = this.hotPatterns.get(cacheKey) || 0;
    this.hotPatterns.set(cacheKey, current + 1);

    // 限制热点模式数量
    if (this.hotPatterns.size > 1000) {
      const sorted = Array.from(this.hotPatterns.entries())
        .sort((a, b) => b[1] - a[1]);

      // 保留前500个热点模式
      this.hotPatterns = new Map(sorted.slice(0, 500));
    }
  }

  /**
   * 获取预处理的缓存
   */
  private getPreprocessedCache(cacheKey: string): CacheEntry | null {
    const cached = this.memoryCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.memoryCache.delete(cacheKey);
      this.totalCacheSize -= cached.size;
      return null;
    }

    return cached;
  }

  /**
   * 设置预处理的缓存
   */
  private setPreprocessedCache(cacheKey: string, data: any): void {
    const size = this.calculateSize(data);

    // 检查内存限制
    if (this.totalCacheSize + size > this.maxMemoryUsage) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
      compressed: false,
      size,
      hitCount: 0,
      lastHit: Date.now(),
    };

    this.memoryCache.set(cacheKey, entry);
    this.totalCacheSize += size;
  }

  /**
   * 获取响应缓存
   */
  private getResponseCache(cacheKey: string): ResponseCache | null {
    return this.responseCache.get(cacheKey) || null;
  }

  /**
   * 设置响应缓存
   */
  private setResponseCache(cacheKey: string, cache: ResponseCache): void {
    // 检查内存限制
    if (this.totalCacheSize + cache.size > this.maxMemoryUsage) {
      this.evictLeastUsed();
    }

    this.responseCache.set(cacheKey, cache);
    this.totalCacheSize += cache.size;
  }

  /**
   * 删除响应缓存
   */
  private deleteResponseCache(cacheKey: string): void {
    const cached = this.responseCache.get(cacheKey);
    if (cached) {
      this.responseCache.delete(cacheKey);
      this.totalCacheSize -= cached.size;
    }
  }

  /**
   * 淘汰最少使用的缓存
   */
  private evictLeastUsed(): void {
    // 找到最少使用的预处理缓存
    let oldestPreprocessed: { key: string; entry: CacheEntry } | null = null;
    let oldestPreprocessedTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastHit < oldestPreprocessedTime) {
        oldestPreprocessedTime = entry.lastHit;
        oldestPreprocessed = { key, entry };
      }
    }

    if (oldestPreprocessed) {
      this.memoryCache.delete(oldestPreprocessed.key);
      this.totalCacheSize -= oldestPreprocessed.entry.size;
    }

    // 找到最少使用的响应缓存
    let oldestResponse: { key: string; cache: ResponseCache } | null = null;
    let oldestResponseTime = Date.now();

    for (const [key, cache] of this.responseCache.entries()) {
      if (cache.timestamp < oldestResponseTime) {
        oldestResponseTime = cache.timestamp;
        oldestResponse = { key, cache };
      }
    }

    if (oldestResponse) {
      this.responseCache.delete(oldestResponse.key);
      this.totalCacheSize -= oldestResponse.cache.size;
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();

    // 清理过期的预处理缓存
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        this.totalCacheSize -= entry.size;
      }
    }

    // 清理过期的响应缓存
    for (const [key, cache] of this.responseCache.entries()) {
      if (now - cache.timestamp > cache.ttl) {
        this.responseCache.delete(key);
        this.totalCacheSize -= cache.size;
      }
    }

    logger.debug('过期缓存清理完成', {
      preprocessedCacheSize: this.memoryCache.size,
      responseCacheSize: this.responseCache.size,
      totalSize: this.totalCacheSize,
    });
  }

  /**
   * 优化缓存
   */
  private optimizeCache(): void {
    // 预热热点数据
    for (const [cacheKey, hitCount] of this.hotPatterns.entries()) {
      if (hitCount > 10) {
        const cached = this.memoryCache.get(cacheKey);
        if (cached) {
          // 延长热点数据的TTL
          cached.ttl = Math.min(cached.ttl * 2, 30 * 60 * 1000); // 最多30分钟
        }
      }
    }

    // 清理黑名单中的旧条目
    if (this.blacklist.size > 100) {
      this.blacklist.clear();
    }

    logger.debug('缓存优化完成', {
      hotPatternsCount: this.hotPatterns.size,
      blacklistSize: this.blacklist.size,
    });
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    const alpha = 0.1;

    // 更新平均预处理时间
    this.metrics.averagePreprocessingTime =
      this.metrics.averagePreprocessingTime * (1 - alpha) +
      (this.calculateAveragePreprocessingTime() * alpha);

    // 更新平均响应时间
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime * (1 - alpha) +
      (performanceOptimizer.getPerformanceStats().averageResponseTime * alpha);

    logger.debug('性能指标更新', {
      ...this.metrics,
      memoryUsage: this.totalCacheSize,
      hitRate: this.metrics.totalRequests > 0
        ? this.metrics.cacheHits / this.metrics.totalRequests
        : 0,
    });
  }

  /**
   * 计算平均预处理时间
   */
  private calculateAveragePreprocessingTime(): number {
    const now = Date.now();
    let totalTime = 0;
    let count = 0;

    for (const entry of this.memoryCache.values()) {
      if (now - entry.timestamp < 60 * 1000) { // 最近1分钟
        totalTime += 0; // 这里可以记录实际的预处理时间
        count++;
      }
    }

    return count > 0 ? totalTime / count : 0;
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      memoryUsage: {
        total: this.totalCacheSize,
        preprocessed: this.memoryCache.size,
        response: this.responseCache.size,
        maxUsage: this.maxMemoryUsage,
      },
      cache: {
        hitRate: this.metrics.totalRequests > 0
          ? this.metrics.cacheHits / this.metrics.totalRequests
          : 0,
        compressionSavings: this.metrics.compressionSavings,
        hotPatternsCount: this.hotPatterns.size,
        blacklistSize: this.blacklist.size,
      },
      optimization: {
        hotPatterns: Array.from(this.hotPatterns.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
      },
    };
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    this.memoryCache.clear();
    this.responseCache.clear();
    this.hotPatterns.clear();
    this.blacklist.clear();
    this.totalCacheSize = 0;

    logger.info('所有缓存已清理');
  }
}

// 导出单例实例
export const requestPreprocessor = RequestPreprocessor.getInstance();

// 导出中间件函数
export const requestPreprocessingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // 将预处理器实例附加到请求对象
  (req as any).preprocessor = requestPreprocessor;
  next();
};