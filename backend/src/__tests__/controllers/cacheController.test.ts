/**
 * 缓存控制器测试
 */

import { Request, Response, NextFunction } from 'express';
import { CacheController } from '@/controllers/cacheController';
import { RedisCacheManager } from '@/services/RedisCacheManager';
import {
  getCacheMiddlewareStats,
  resetCacheMiddlewareStats,
  generateCachePerformanceReport
} from '@/middleware/cacheMiddleware';

// Mock依赖
jest.mock('@/services/RedisCacheManager');
jest.mock('@/middleware/cacheMiddleware');

describe('CacheController', () => {
  let cacheController: CacheController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockCacheManager: jest.Mocked<RedisCacheManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建mock对象
    cacheController = new CacheController();

    mockRequest = {
      params: {},
      body: {},
      query: {}
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Mock RedisCacheManager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      deleteByTags: jest.fn(),
      getKeysByPattern: jest.fn(),
      getKeysByTags: jest.fn(),
      clear: jest.fn(),
      warmup: jest.fn(),
      getStats: jest.fn(),
      resetStats: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn(),
      healthCheck: jest.fn(),
      getInstance: jest.fn(),
      getTtl: jest.fn(),
      stop: jest.fn(),
      initialize: jest.fn()
    } as any;

    (RedisCacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager);

    // Mock middleware functions
    (getCacheMiddlewareStats as jest.Mock).mockReturnValue({
      totalRequests: 100,
      cacheHits: 80,
      cacheMisses: 20,
      hitRate: 80,
      averageResponseTime: 150,
      timeSaved: 5000
    });

    (generateCachePerformanceReport as jest.Mock).mockReturnValue('Performance Report');
  });

  describe('getCache', () => {
    test('应该成功获取缓存', async () => {
      mockRequest.params = { key: 'test-key' };
      mockRequest.query = { tags: 'tag1,tag2', strategy: 'lazy_loading' };

      const mockValue = { data: 'test-data' };
      mockCacheManager.get.mockResolvedValue(mockValue);
      mockResponse.json!.mockReturnValue(mockResponse as Response);

      await cacheController.getCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.get).toHaveBeenCalledWith('test-key', {
        tags: ['tag1', 'tag2'],
        strategy: 'lazy_loading'
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          key: 'test-key',
          value: mockValue,
          found: true
        },
        timestamp: expect.any(String)
      });
    });

    test('缓存不存在时应该返回found为false', async () => {
      mockRequest.params = { key: 'test-key' };
      mockCacheManager.get.mockResolvedValue(null);

      await cacheController.getCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          key: 'test-key',
          value: null,
          found: false
        },
        timestamp: expect.any(String)
      });
    });

    test('缺少缓存键时应该返回400错误', async () => {
      mockRequest.params = {};

      await cacheController.getCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '缓存键不能为空'
      });
    });

    test('Redis错误时应该调用next', async () => {
      mockRequest.params = { key: 'test-key' };
      mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

      await cacheController.getCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('setCache', () => {
    test('应该成功设置缓存', async () => {
      mockRequest.body = {
        key: 'test-key',
        value: { data: 'test-data' },
        ttl: 300,
        tags: ['tag1', 'tag2'],
        strategy: 'write_through',
        compress: true
      };

      mockCacheManager.set.mockResolvedValue(true);

      await cacheController.setCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', { data: 'test-data' }, {
        ttl: 300,
        tags: ['tag1', 'tag2'],
        strategy: 'write_through',
        compress: true
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          key: 'test-key',
          ttl: 300,
          tags: ['tag1', 'tag2'],
          compressed: true
        },
        message: '缓存设置成功',
        timestamp: expect.any(String)
      });
    });

    test('缺少键或值时应该返回400错误', async () => {
      mockRequest.body = { key: 'test-key' }; // 缺少value

      await cacheController.setCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '缓存键和值不能为空'
      });
    });

    test('设置失败时应该返回500错误', async () => {
      mockRequest.body = {
        key: 'test-key',
        value: { data: 'test-data' }
      };

      mockCacheManager.set.mockResolvedValue(false);

      await cacheController.setCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '缓存设置失败'
      });
    });
  });

  describe('deleteCache', () => {
    test('应该成功删除缓存', async () => {
      mockRequest.params = { key: 'test-key' };
      mockCacheManager.delete.mockResolvedValue(true);

      await cacheController.deleteCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.delete).toHaveBeenCalledWith('test-key');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { key: 'test-key' },
        message: '缓存删除成功',
        timestamp: expect.any(String)
      });
    });

    test('缓存不存在时应该返回404错误', async () => {
      mockRequest.params = { key: 'test-key' };
      mockCacheManager.delete.mockResolvedValue(false);

      await cacheController.deleteCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '缓存不存在或删除失败'
      });
    });
  });

  describe('existsCache', () => {
    test('应该检查缓存存在性', async () => {
      mockRequest.params = { key: 'test-key' };
      mockCacheManager.exists.mockResolvedValue(true);

      await cacheController.existsCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.exists).toHaveBeenCalledWith('test-key');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          key: 'test-key',
          exists: true
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('batchSetCache', () => {
    test('应该成功批量设置缓存', async () => {
      mockRequest.body = {
        operations: [
          { key: 'key1', value: { data: 'data1' } },
          { key: 'key2', value: { data: 'data2' } }
        ],
        defaultTtl: 300,
        defaultTags: ['batch']
      };

      mockCacheManager.set
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await cacheController.batchSetCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.set).toHaveBeenCalledTimes(2);
      expect(mockCacheManager.set).toHaveBeenCalledWith('key1', { data: 'data1' }, {
        ttl: 300,
        tags: ['batch']
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith('key2', { data: 'data2' }, {
        ttl: 300,
        tags: ['batch']
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 2,
          success: 2,
          failed: 0,
          successRate: '100.0%',
          failedOperations: []
        },
        message: '批量操作完成，成功 2/2',
        timestamp: expect.any(String)
      });
    });

    test('操作列表为空时应该返回400错误', async () => {
      mockRequest.body = { operations: [] };

      await cacheController.batchSetCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '操作列表不能为空'
      });
    });

    test('部分失败时应该返回正确统计', async () => {
      mockRequest.body = {
        operations: [
          { key: 'key1', value: { data: 'data1' } },
          { key: 'key2', value: { data: 'data2' } }
        ]
      };

      mockCacheManager.set
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Set failed'));

      await cacheController.batchSetCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 2,
          success: 1,
          failed: 1,
          successRate: '50.0%',
          failedOperations: expect.arrayContaining([
            expect.objectContaining({
              index: 1,
              operation: { key: 'key2', value: { data: 'data2' } }
            })
          ])
        },
        message: '批量操作完成，成功 1/2',
        timestamp: expect.any(String)
      });
    });
  });

  describe('batchDeleteCache', () => {
    test('应该成功批量删除缓存', async () => {
      mockRequest.body = { keys: ['key1', 'key2', 'key3'] };

      mockCacheManager.delete
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await cacheController.batchDeleteCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.delete).toHaveBeenCalledTimes(3);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 3,
          success: 2,
          failed: 1,
          successRate: '66.7%'
        },
        message: '批量删除完成，成功 2/3',
        timestamp: expect.any(String)
      });
    });

    test('键列表为空时应该返回400错误', async () => {
      mockRequest.body = { keys: [] };

      await cacheController.batchDeleteCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '缓存键列表不能为空'
      });
    });
  });

  describe('deleteByTags', () => {
    test('应该成功按标签删除缓存', async () => {
      mockRequest.body = { tags: ['tag1', 'tag2'] };
      mockCacheManager.deleteByTags.mockResolvedValue(5);

      await cacheController.deleteByTags(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.deleteByTags).toHaveBeenCalledWith(['tag1', 'tag2']);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tags: ['tag1', 'tag2'],
          deletedCount: 5
        },
        message: '按标签删除完成，删除了 5 个缓存',
        timestamp: expect.any(String)
      });
    });

    test('标签列表为空时应该返回400错误', async () => {
      mockRequest.body = { tags: [] };

      await cacheController.deleteByTags(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '标签列表不能为空'
      });
    });
  });

  describe('queryCache', () => {
    test('应该成功按模式查询缓存', async () => {
      mockRequest.query = { pattern: 'test:*', limit: '10', offset: '0' };

      const mockKeys = ['test:1', 'test:2', 'test:3'];
      mockCacheManager.getKeysByPattern.mockResolvedValue(mockKeys);
      mockCacheManager.exists.mockResolvedValue(true);
      mockCacheManager.getTtl.mockResolvedValue(300);

      await cacheController.queryCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.getKeysByPattern).toHaveBeenCalledWith('test:*');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          keys: [
            { key: 'test:1', exists: true, ttl: 300 },
            { key: 'test:2', exists: true, ttl: 300 },
            { key: 'test:3', exists: true, ttl: 300 }
          ],
          total: 3,
          limit: 10,
          offset: 0,
          hasMore: false
        },
        timestamp: expect.any(String)
      });
    });

    test('应该成功按标签查询缓存', async () => {
      mockRequest.query = { tags: 'tag1,tag2', limit: '5' };

      const mockKeys = ['cache1', 'cache2'];
      mockCacheManager.getKeysByTags.mockResolvedValue(mockKeys);
      mockCacheManager.exists.mockResolvedValue(true);
      mockCacheManager.getTtl.mockResolvedValue(600);

      await cacheController.queryCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.getKeysByTags).toHaveBeenCalledWith(['tag1', 'tag2']);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          keys: expect.arrayContaining([
            expect.objectContaining({ key: 'cache1' }),
            expect.objectContaining({ key: 'cache2' })
          ])
        }),
        timestamp: expect.any(String)
      });
    });

    test('应该正确处理分页', async () => {
      mockRequest.query = { limit: '2', offset: '1' };

      const mockKeys = ['key1', 'key2', 'key3', 'key4'];
      mockCacheManager.getKeysByPattern.mockResolvedValue(mockKeys);
      mockCacheManager.exists.mockResolvedValue(true);
      mockCacheManager.getTtl.mockResolvedValue(300);

      await cacheController.queryCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          keys: expect.arrayContaining([
            expect.objectContaining({ key: 'key2' }),
            expect.objectContaining({ key: 'key3' })
          ]),
          total: 4,
          limit: 2,
          offset: 1,
          hasMore: true
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('clearCache', () => {
    test('应该成功清空缓存', async () => {
      mockRequest.query = { pattern: 'test:*' };
      mockCacheManager.clear.mockResolvedValue(10);

      await cacheController.clearCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.clear).toHaveBeenCalledWith('test:*');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          pattern: 'test:*',
          deletedCount: 10
        },
        message: '清空缓存完成，删除了 10 个缓存',
        timestamp: expect.any(String)
      });
    });

    test('没有模式时应该清空所有缓存', async () => {
      mockRequest.query = {};
      mockCacheManager.clear.mockResolvedValue(50);

      await cacheController.clearCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.clear).toHaveBeenCalledWith('*');
    });
  });

  describe('warmupCache', () => {
    test('应该成功预热缓存', async () => {
      mockRequest.body = {
        data: [
          { key: 'key1', value: { data: 'data1' } },
          { key: 'key2', value: { data: 'data2' } }
        ]
      };

      mockCacheManager.warmup.mockResolvedValue({
        success: 2,
        failed: 0
      });

      await cacheController.warmupCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.warmup).toHaveBeenCalledWith([
        { key: 'key1', value: { data: 'data1' } },
        { key: 'key2', value: { data: 'data2' } }
      ]);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          total: 2,
          success: 2,
          failed: 0,
          successRate: '100.0%'
        },
        message: '缓存预热完成，成功 2/2',
        timestamp: expect.any(String)
      });
    });

    test('预热数据为空时应该返回400错误', async () => {
      mockRequest.body = { data: [] };

      await cacheController.warmupCache(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '预热数据不能为空'
      });
    });
  });

  describe('getCacheStats', () => {
    test('应该获取缓存统计', async () => {
      const mockRedisStats = {
        memoryItems: 150,
        memorySize: 1024000,
        redisConnected: true,
        connected: true,
        hits: 100,
        misses: 20,
        hitRate: 83.33,
        sets: 120,
        dels: 10,
        errors: 0,
      };

      mockCacheManager.getStats.mockReturnValue(mockRedisStats);

      await cacheController.getCacheStats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(getCacheMiddlewareStats).toHaveBeenCalled();
      expect(generateCachePerformanceReport).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          redisStats: mockRedisStats,
          middlewareStats: expect.any(Object),
          overallStats: {
            totalCacheSize: 1024000,
            hitRate: 80,
            averageResponseTime: 150,
            timeSaved: 5000
          },
          performanceReport: 'Performance Report'
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('resetCacheStats', () => {
    test('应该重置缓存统计', async () => {
      await cacheController.resetCacheStats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.resetStats).toHaveBeenCalled();
      expect(resetCacheMiddlewareStats).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '缓存统计已重置',
        timestamp: expect.any(String)
      });
    });
  });

  describe('getCacheConfig', () => {
    test('应该获取缓存配置', async () => {
      const mockConfig = {
        defaultTtl: 300,
        maxMemoryItems: 1000,
        enableCompression: true
      };

      mockCacheManager.getConfig.mockReturnValue(mockConfig);

      await cacheController.getCacheConfig(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.getConfig).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockConfig,
        timestamp: expect.any(String)
      });
    });
  });

  describe('updateCacheConfig', () => {
    test('应该更新缓存配置', async () => {
      const newConfig = {
        defaultTtl: 600,
        enableCompression: false
      };

      mockRequest.body = newConfig;

      await cacheController.updateCacheConfig(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: newConfig,
        message: '缓存配置已更新',
        timestamp: expect.any(String)
      });
    });
  });

  describe('healthCheck', () => {
    test('应该执行健康检查', async () => {
      const mockStats = {
        connected: true,
        totalRequests: 1000,
        hitRate: 85.5,
        memoryUsage: 2048000
      };

      mockCacheManager.healthCheck.mockResolvedValue(true);
      mockCacheManager.getStats.mockReturnValue(mockStats);

      await cacheController.healthCheck(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockCacheManager.healthCheck).toHaveBeenCalled();
      expect(mockCacheManager.getStats).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          healthy: true,
          stats: mockStats
        },
        timestamp: expect.any(String)
      });
    });

    test('健康检查失败时应该返回false', async () => {
      mockCacheManager.healthCheck.mockResolvedValue(false);
      mockCacheManager.getStats.mockReturnValue({
        connected: false,
        totalRequests: 0,
        hitRate: 0,
        memoryUsage: 0
      });

      await cacheController.healthCheck(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          healthy: false,
          stats: {
            connected: false,
            totalRequests: 0,
            hitRate: 0,
            memoryUsage: 0
          }
        },
        timestamp: expect.any(String)
      });
    });
  });
});