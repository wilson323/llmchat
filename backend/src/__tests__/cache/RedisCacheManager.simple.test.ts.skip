/**
 * Redis缓存管理器简化测试
 * 测试基本功能以确保系统稳定性
 */

import { RedisCacheManager } from '@/services/RedisCacheManager';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
  status: 'ready',
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  isReady: true
};

// Mock logger
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('RedisCacheManager Basic Tests', () => {
  let cacheManager: RedisCacheManager;

  beforeEach(() => {
    cacheManager = new RedisCacheManager(mockRedis as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('基本缓存操作', () => {
    test('应该能够设置和获取缓存', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify({
        data: value,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,
        accessCount: 1,
        lastAccessAt: Date.now(),
        size: 50,
        compressed: false
      }));

      // 设置缓存
      await expect(cacheManager.set(key, value)).resolves.toBeUndefined();
      expect(mockRedis.set).toHaveBeenCalled();

      // 获取缓存
      const result = await cacheManager.get(key);
      expect(result).toEqual(value);
      expect(mockRedis.get).toHaveBeenCalled();
    });

    test('应该处理缓存未命中', async () => {
      const key = 'nonexistent-key';
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.get(key);
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalled();
    });

    test('应该能够删除缓存', async () => {
      const key = 'test-key';
      mockRedis.del.mockResolvedValue(1);

      await expect(cacheManager.delete(key)).resolves.toBeUndefined();
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining(key));
    });
  });

  describe('缓存统计', () => {
    test('应该提供统计信息', () => {
      const stats = cacheManager.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryItems');
      expect(stats).toHaveProperty('redisConnected');
      expect(typeof stats.hitRate).toBe('number');
    });

    test('应该提供健康检查', async () => {
      const health = await cacheManager.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(['healthy', 'degraded', 'down']).toContain(health.status);
    });
  });

  describe('配置管理', () => {
    test('应该能够更新配置', () => {
      const newConfig = {
        defaultTtl: 7200,
        maxMemorySize: 2048,
        compressionThreshold: 2048
      };

      expect(() => {
        cacheManager.updateConfig(newConfig);
      }).not.toThrow();

      const config = cacheManager.getConfig();
      expect(config.defaultTtl).toBe(7200);
      expect(config.maxMemorySize).toBe(2048);
    });
  });

  describe('健康检查', () => {
    test('应该能够进行健康检查', () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const health = cacheManager.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('redisConnected');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('uptime');
    });
  });

  describe('错误处理', () => {
    test('应该处理Redis连接错误', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheManager.get('test-key');
      expect(result).toBeNull();
    });

    test('应该处理序列化错误', async () => {
      // 模拟无效的JSON数据
      mockRedis.get.mockResolvedValue('invalid-json-data');

      const result = await cacheManager.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('性能测试', () => {
    test('应该能够在合理时间内处理大量操作', async () => {
      const operations = 100;
      const startTime = Date.now();

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(null);

      // 执行大量设置操作
      const setPromises = [];
      for (let i = 0; i < operations; i++) {
        setPromises.push(cacheManager.set(`key-${i}`, `value-${i}`));
      }
      await Promise.all(setPromises);

      const duration = Date.now() - startTime;

      // 性能要求：100个操作应在5秒内完成
      expect(duration).toBeLessThan(5000);
      expect(mockRedis.set).toHaveBeenCalledTimes(operations);
    });
  });

  describe('内存管理', () => {
    test('应该能够清空所有缓存', async () => {
      mockRedis.del.mockResolvedValue(10); // 模拟删除了10个键

      await cacheManager.clear();

      // 验证清空操作
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('生命周期管理', () => {
    test('应该能够正确断开连接', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await expect(cacheManager.disconnect()).resolves.toBeUndefined();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('应该能够重置缓存管理器', () => {
      expect(() => {
        cacheManager.clear();
      }).not.toThrow();
    });
  });
});