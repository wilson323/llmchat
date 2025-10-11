/**
 * Redis缓存管理器测试
 */

import { RedisCacheManager, CacheStrategy } from '@/services/RedisCacheManager';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

describe('RedisCacheManager', () => {
  let cacheManager: RedisCacheManager;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // 创建mock Redis实例
    mockRedis = new Redis() as jest.Mocked<Redis>;

    // Mock Redis方法
    mockRedis.get = jest.fn();
    mockRedis.set = jest.fn();
    mockRedis.del = jest.fn();
    mockRedis.exists = jest.fn();
    mockRedis.ttl = jest.fn();
    mockRedis.expire = jest.fn();
    mockRedis.keys = jest.fn();
    mockRedis.flushdb = jest.fn();
    mockRedis.ping = jest.fn();
    mockRedis.quit = jest.fn();

    // Mock Redis constructor
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    // 创建缓存管理器实例
    cacheManager = RedisCacheManager.getInstance();

    // 重置缓存管理器状态
    cacheManager.reset();
  });

  afterEach(async () => {
    // 清理资源
    try {
      await cacheManager.stop();
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('基础缓存操作', () => {
    test('应该能够设置和获取缓存', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      // Mock Redis返回值
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      // 设置缓存
      const setResult = await cacheManager.set(key, value);
      expect(setResult).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        'EX',
        300 // 默认TTL
      );

      // 获取缓存
      const getResult = await cacheManager.get(key);
      expect(getResult).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });

    test('应该能够删除缓存', async () => {
      const key = 'test-key';

      // Mock Redis返回值
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheManager.delete(key);
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(key);
    });

    test('应该能够检查缓存是否存在', async () => {
      const key = 'test-key';

      // Mock Redis返回值
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheManager.exists(key);
      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(key);
    });

    test('获取不存在的缓存应该返回null', async () => {
      const key = 'non-existent-key';

      // Mock Redis返回null
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.get(key);
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(key);
    });
  });

  describe('高级缓存功能', () => {
    test('应该支持TTL设置', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      const ttl = 600; // 10分钟

      mockRedis.set.mockResolvedValue('OK');

      await cacheManager.set(key, value, { ttl });

      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        'EX',
        ttl
      );
    });

    test('应该支持标签功能', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      const tags = ['tag1', 'tag2'];

      mockRedis.set.mockResolvedValue('OK');

      await cacheManager.set(key, value, { tags });

      expect(mockRedis.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        'EX',
        300
      );
    });

    test('应该支持压缩功能', async () => {
      const key = 'test-key';
      const value = 'x'.repeat(2000); // 大数据量
      const compressedValue = 'compressed-data';

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(compressedValue);

      await cacheManager.set(key, value, { compress: true });

      expect(mockRedis.set).toHaveBeenCalled();
    });

    test('应该支持不同的缓存策略', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      // 测试LAZY_LOADING策略
      await cacheManager.set(key, value, { strategy: CacheStrategy.LAZY_LOADING });
      expect(mockRedis.set).toHaveBeenCalled();

      // 测试WRITE_THROUGH策略
      await cacheManager.set(key, value, { strategy: CacheStrategy.WRITE_THROUGH });
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('批量操作', () => {
    test('应该支持批量获取缓存', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = [
        { data: 'value1' },
        { data: 'value2' },
        null // key3不存在
      ];

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(values[0]));
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(values[1]));
      mockRedis.get.mockResolvedValueOnce(null);

      const results = await cacheManager.mget(keys);

      expect(results).toEqual(values);
      expect(mockRedis.get).toHaveBeenCalledTimes(3);
    });

    test('应该支持批量设置缓存', async () => {
      const items = [
        { key: 'key1', value: { data: 'value1' } },
        { key: 'key2', value: { data: 'value2' } }
      ];

      mockRedis.set.mockResolvedValue('OK');

      const results = await cacheManager.mset(items);

      expect(results).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
    });

    test('应该支持按标签删除', async () => {
      const tags = ['tag1', 'tag2'];
      const mockKeys = ['key1', 'key2', 'key3'];

      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.del.mockResolvedValue(mockKeys.length);

      const deletedCount = await cacheManager.deleteByTags(tags);

      expect(deletedCount).toBe(mockKeys.length);
    });
  });

  describe('缓存预热', () => {
    test('应该支持缓存预热', async () => {
      const warmupData = [
        { key: 'key1', value: { data: 'value1' } },
        { key: 'key2', value: { data: 'value2' } }
      ];

      mockRedis.set.mockResolvedValue('OK');

      const results = await cacheManager.warmup(warmupData);

      expect(results.success).toBe(warmupData.length);
      expect(results.failed).toBe(0);
      expect(mockRedis.set).toHaveBeenCalledTimes(warmupData.length);
    });

    test('预热失败时应该正确处理错误', async () => {
      const warmupData = [
        { key: 'key1', value: { data: 'value1' } },
        { key: 'key2', value: { data: 'value2' } }
      ];

      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.set.mockRejectedValueOnce(new Error('Redis error'));

      const results = await cacheManager.warmup(warmupData);

      expect(results.success).toBe(1);
      expect(results.failed).toBe(1);
    });
  });

  describe('性能统计', () => {
    test('应该正确跟踪统计信息', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      mockRedis.get.mockResolvedValue(null); // 缓存未命中
      mockRedis.set.mockResolvedValue('OK');

      // 第一次获取 - 未命中
      await cacheManager.get(key);
      let stats = cacheManager.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // 设置缓存
      await cacheManager.set(key, value);

      // 第二次获取 - 命中
      mockRedis.get.mockResolvedValue(JSON.stringify(value));
      await cacheManager.get(key);
      stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // 计算命中率
      expect(stats.hitRate).toBe(50);
    });

    test('应该能够重置统计信息', async () => {
      // 先进行一些操作产生统计数据
      mockRedis.get.mockResolvedValue(null);
      await cacheManager.get('test-key');

      let stats = cacheManager.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);

      // 重置统计
      cacheManager.resetStats();
      stats = cacheManager.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('连接管理', () => {
    test('应该能够初始化连接', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      await cacheManager.initialize();

      expect(mockRedis.ping).toHaveBeenCalled();
    });

    test('应该能够健康检查', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const isHealthy = await cacheManager.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    test('健康检查失败时应该返回false', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await cacheManager.healthCheck();

      expect(isHealthy).toBe(false);
    });

    test('应该能够停止连接', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.quit.mockResolvedValue('OK');

      await cacheManager.initialize();
      await cacheManager.stop();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    test('应该能够更新配置', () => {
      const newConfig = {
        defaultTtl: 600,
        maxMemoryItems: 2000,
        enableCompression: false
      };

      cacheManager.updateConfig(newConfig);
      const config = cacheManager.getConfig();

      expect(config.defaultTtl).toBe(newConfig.defaultTtl);
      expect(config.maxMemoryItems).toBe(newConfig.maxMemoryItems);
      expect(config.enableCompression).toBe(newConfig.enableCompression);
    });

    test('配置更新应该保持默认值', () => {
      const newConfig = {
        defaultTtl: 600
      };

      cacheManager.updateConfig(newConfig);
      const config = cacheManager.getConfig();

      expect(config.defaultTtl).toBe(newConfig.defaultTtl);
      expect(config.maxMemoryItems).toBeDefined(); // 应该保持默认值
    });
  });

  describe('错误处理', () => {
    test('Redis连接错误应该优雅处理', async () => {
      const key = 'test-key';
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheManager.get(key);
      expect(result).toBeNull();
    });

    test('JSON序列化错误应该优雅处理', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      // Mock一个包含循环引用的对象
      const circularValue: any = { data: 'test' };
      circularValue.self = circularValue;

      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheManager.set(key, circularValue);
      expect(result).toBe(false);
    });

    test('JSON反序列化错误应该优雅处理', async () => {
      const key = 'test-key';
      const invalidJson = '{ invalid json }';

      mockRedis.get.mockResolvedValue(invalidJson);

      const result = await cacheManager.get(key);
      expect(result).toBeNull();
    });
  });

  describe('内存缓存', () => {
    test('应该支持内存缓存', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      // 启用内存缓存
      cacheManager.updateConfig({ enableMemoryCache: true });

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      // 设置缓存
      await cacheManager.set(key, value);

      // 第一次获取 - 从Redis获取
      const result1 = await cacheManager.get(key);
      expect(result1).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);

      // 第二次获取 - 从内存缓存获取
      const result2 = await cacheManager.get(key);
      expect(result2).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalledTimes(1); // 没有增加
    });

    test('内存缓存应该有容量限制', async () => {
      // 设置小的内存缓存限制
      cacheManager.updateConfig({ maxMemoryItems: 2 });

      const items = [
        { key: 'key1', value: { data: 'value1' } },
        { key: 'key2', value: { data: 'value2' } },
        { key: 'key3', value: { data: 'value3' } }
      ];

      mockRedis.set.mockResolvedValue('OK');

      // 添加超过限制的项目
      for (const item of items) {
        await cacheManager.set(item.key, item.value);
      }

      // 验证只有最新的项目在内存缓存中
      // 这里需要通过私有方法或反射来测试内部状态
    });
  });

  describe('性能报告', () => {
    test('应该生成性能报告', () => {
      // 进行一些操作
      cacheManager.updateStats('hit', 100);
      cacheManager.updateStats('miss', 50);
      cacheManager.updateStats('set', 25);

      const report = cacheManager.generatePerformanceReport();

      expect(report).toContain('Redis缓存性能报告');
      expect(report).toContain('命中率');
      expect(report).toContain('统计信息');
    });
  });
});