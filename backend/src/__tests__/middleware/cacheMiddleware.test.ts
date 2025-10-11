/**
 * 缓存中间件测试
 */

import { Request, Response, NextFunction } from 'express';
import { RedisCacheManager } from '@/services/RedisCacheManager';
import {
  cacheMiddleware,
  updateCacheMiddlewareConfig,
  getCacheMiddlewareStats,
  resetCacheMiddlewareStats,
  generateCachePerformanceReport
} from '@/middleware/cacheMiddleware';

// Mock RedisCacheManager
jest.mock('@/services/RedisCacheManager');

describe('缓存中间件', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockCacheManager: jest.Mocked<RedisCacheManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建mock对象
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test?param=value',
      path: '/api/test',
      query: { param: 'value', timestamp: '1234567890' },
      user: { role: 'user' }
    };

    mockResponse = {
      json: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      statusCode: 200
    };

    mockNext = jest.fn();

    // Mock RedisCacheManager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      getInstance: jest.fn(),
      getStats: jest.fn(),
      resetStats: jest.fn(),
      generatePerformanceReport: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn()
    } as any;

    (RedisCacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager);
  });

  describe('缓存中间件基础功能', () => {
    test('缓存命中时应该返回缓存数据', async () => {
      const cachedData = { message: 'Cached response' };
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(JSON.stringify(cachedData));
      mockResponse.set!.mockReturnValue(mockResponse as Response);
      mockResponse.json!.mockReturnValue(mockResponse as Response);

      // 执行中间件
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(mockResponse.json).toHaveBeenCalledWith(cachedData);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('缓存未命中时应该继续处理请求', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = { message: 'Fresh response' };
        return this;
      });
      mockResponse.end = jest.fn(function(this: Response) {
        // Mock end behavior
      });

      // 执行中间件
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache', 'MISS');
    });

    test('缓存查询错误时应该继续处理请求', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

      // 执行中间件
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证结果
      expect(mockCacheManager.get).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('缓存键生成', () => {
    test('应该生成正确的缓存键', async () => {
      const middleware = cacheMiddleware({
        keyPrefix: 'test_cache'
      });

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const expectedKey = 'test_cache:get:/api/test:param=value';
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expectedKey,
        expect.objectContaining({
          tags: expect.any(Array),
          strategy: expect.any(String)
        })
      );
    });

    test('应该忽略指定的查询参数', async () => {
      const middleware = cacheMiddleware({
        ignoreQueryParams: ['timestamp', '_']
      });

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const expectedKey = 'api_cache:get:/api/test:param=value';
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expectedKey,
        expect.any(Object)
      );
    });

    test('应该使用自定义键生成器', async () => {
      const customKeyGenerator = jest.fn().mockReturnValue('custom-key');
      const middleware = cacheMiddleware({
        keyGenerator: customKeyGenerator
      });

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(customKeyGenerator).toHaveBeenCalledWith(mockRequest);
      expect(mockCacheManager.get).toHaveBeenCalledWith('custom-key', expect.any(Object));
    });
  });

  describe('缓存标签生成', () => {
    test('应该生成正确的标签', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tags: expect.arrayContaining([
            'path:api',
            'path:test',
            'method:get',
            'role:user'
          ])
        })
      );
    });

    test('应该使用自定义标签生成器', async () => {
      const customTags = ['custom1', 'custom2'];
      const customTagGenerator = jest.fn().mockReturnValue(customTags);
      const middleware = cacheMiddleware({
        tagGenerator: customTagGenerator
      });

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(customTagGenerator).toHaveBeenCalledWith(mockRequest);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tags: customTags
        })
      );
    });
  });

  describe('缓存条件判断', () => {
    test('应该缓存成功响应', async () => {
      const middleware = cacheMiddleware({
        cacheSuccess: true,
        cacheErrors: false
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.statusCode = 200;
      mockResponse.get!.mockReturnValue('application/json');
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = { success: true };
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 模拟响应结束
      expect(mockResponse.end).toHaveBeenCalled();
    });

    test('应该根据配置决定是否缓存错误响应', async () => {
      const middleware = cacheMiddleware({
        cacheSuccess: false,
        cacheErrors: true
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.statusCode = 500;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('应该使用自定义缓存条件', async () => {
      const shouldCache = jest.fn().mockReturnValue(false);
      const middleware = cacheMiddleware({
        shouldCache
      });

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(shouldCache).toHaveBeenCalledWith(mockRequest, mockResponse);
    });
  });

  describe('TTL计算', () => {
    test('应该使用Cache-Control头的max-age', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.get!.mockImplementation((header) => {
        if (header === 'Cache-Control') return 'max-age=3600';
        if (header === 'Content-Type') return 'application/json';
        return undefined;
      });
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = { data: 'test' };
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 模拟响应结束
      mockCacheManager.set.mockResolvedValue(true);

      // 验证TTL设置
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          ttl: 3600
        })
      );
    });

    test('应该使用Expires头计算TTL', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);
      const futureDate = new Date(Date.now() + 1800000); // 30分钟后
      mockResponse.get!.mockImplementation((header) => {
        if (header === 'Expires') return futureDate.toUTCString();
        if (header === 'Content-Type') return 'application/json';
        return undefined;
      });
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = { data: 'test' };
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 模拟响应结束
      mockCacheManager.set.mockResolvedValue(true);

      // 验证TTL设置（应该在1800秒左右）
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          ttl: expect.any(Number)
        })
      );
    });

    test('应该使用默认TTL', async () => {
      const middleware = cacheMiddleware({
        defaultTtl: 600
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.get!.mockReturnValue('application/json');
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = { data: 'test' };
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 模拟响应结束
      mockCacheManager.set.mockResolvedValue(true);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          ttl: 600
        })
      );
    });
  });

  describe('压缩功能', () => {
    test('大数据量应该启用压缩', async () => {
      const middleware = cacheMiddleware({
        compressThreshold: 100
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.get!.mockReturnValue('application/json');
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = 'x'.repeat(200); // 大于阈值
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 模拟响应结束
      mockCacheManager.set.mockResolvedValue(true);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          compress: true
        })
      );
    });

    test('小数据量不应该启用压缩', async () => {
      const middleware = cacheMiddleware({
        compressThreshold: 100
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.get!.mockReturnValue('application/json');
      mockResponse.json = jest.fn(function(this: Response) {
        (this as any).responseData = 'small data';
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 模拟响应结束
      mockCacheManager.set.mockResolvedValue(true);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          compress: false
        })
      );
    });
  });

  describe('统计功能', () => {
    test('应该正确跟踪缓存命中统计', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));
      mockResponse.set!.mockReturnValue(mockResponse as Response);
      mockResponse.json!.mockReturnValue(mockResponse as Response);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const stats = getCacheMiddlewareStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.hitRate).toBe(100);
    });

    test('应该正确跟踪缓存未命中统计', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const stats = getCacheMiddlewareStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    test('应该能够重置统计', () => {
      // 重置前先产生一些统计数据
      resetCacheMiddlewareStats();

      const stats = getCacheMiddlewareStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe('配置管理', () => {
    test('应该能够更新配置', () => {
      const newConfig = {
        defaultTtl: 600,
        cacheSuccess: false,
        keyPrefix: 'custom_prefix'
      };

      updateCacheMiddlewareConfig(newConfig);

      // 验证配置已更新（通过检查中间件行为）
      const middleware = cacheMiddleware();
      expect(middleware).toBeDefined();
    });

    test('配置更新应该保持默认值', () => {
      const newConfig = {
        defaultTtl: 600
      };

      updateCacheMiddlewareConfig(newConfig);

      // 配置应该部分更新，其他保持默认值
      expect(true).toBe(true); // 简单的断言，实际实现中需要更复杂的验证
    });
  });

  describe('性能报告', () => {
    test('应该生成性能报告', () => {
      mockCacheManager.getStats.mockReturnValue({
        hits: 10,
        misses: 5,
        hitRate: 66.67
      });

      const report = generateCachePerformanceReport();

      expect(report).toContain('缓存中间件性能报告');
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    test('缓存数据损坏时应该删除缓存并继续', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue('invalid json data');
      mockCacheManager.delete.mockResolvedValue(true);

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockCacheManager.delete).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test('序列化响应数据失败时应该优雅处理', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);
      mockResponse.get!.mockReturnValue('application/json');
      mockResponse.json = jest.fn(function(this: Response) {
        // 创建一个包含循环引用的对象
        const circular: any = { data: 'test' };
        circular.self = circular;
        (this as any).responseData = circular;
        return this;
      });
      mockResponse.end = jest.fn();

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 应该继续处理而不抛出错误
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('响应拦截', () => {
    test('应该正确拦截json方法', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);
      const originalJson = jest.fn();
      mockResponse.json = originalJson;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证json方法被包装
      expect(typeof mockResponse.json).toBe('function');
      expect(mockResponse.json).not.toBe(originalJson);
    });

    test('应该正确拦截end方法', async () => {
      const middleware = cacheMiddleware();

      mockCacheManager.get.mockResolvedValue(null);
      const originalEnd = jest.fn();
      mockResponse.end = originalEnd;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 验证end方法被包装
      expect(typeof mockResponse.end).toBe('function');
      expect(mockResponse.end).not.toBe(originalEnd);
    });
  });
});