/**
 * 缓存性能测试
 * 测试Redis缓存系统的性能表现（使用Mock Redis）
 */

import { TestCacheService } from '../services/TestCacheService';

describe('Cache Performance Tests', () => {
  let cacheService: TestCacheService;

  beforeAll(async () => {
    // 创建测试专用的缓存服务
    cacheService = new TestCacheService();
    await cacheService.connect();

    console.log('✅ 测试缓存服务初始化成功，将执行缓存性能测试');
  });

  beforeEach(() => {
    // 清空缓存数据
    cacheService.clear();
  });

  afterAll(async () => {
    if (cacheService) {
      await cacheService.disconnect();
    }
  });

  describe('Basic Cache Operations', () => {
    it('should set and get data efficiently', async () => {
      const testData = {
        id: 1,
        name: 'test-agent',
        description: 'Performance test data',
        timestamp: new Date().toISOString(),
      };

      const startTime = Date.now();

      // 设置缓存
      await cacheService.set('test-key-1', testData, { ttl: 300 });
      const setTime = Date.now() - startTime;

      // 获取缓存
      const getStartTime = Date.now();
      const result = await cacheService.get('test-key-1');
      const getTime = Date.now() - getStartTime;

      expect(result).toEqual(testData);
      expect(setTime).toBeLessThan(100); // 设置操作应在100ms内完成
      expect(getTime).toBeLessThan(50);  // 获取操作应在50ms内完成

      console.log(`📊 Cache Performance - Set: ${setTime}ms, Get: ${getTime}ms`);
    });

    it('should handle concurrent operations', async () => {
      const operations = 100;
      const promises: Promise<any>[] = [];

      const startTime = Date.now();

      // 并发设置操作
      for (let i = 0; i < operations; i++) {
        promises.push(
          cacheService.set(`concurrent-${i}`, {
            id: i,
            data: `test-data-${i}`,
            timestamp: Date.now()
          })
        );
      }

      await Promise.all(promises);
      const setTime = Date.now() - startTime;

      // 并发获取操作
      const getPromises: Promise<any>[] = [];
      const getStartTime = Date.now();

      for (let i = 0; i < operations; i++) {
        getPromises.push(cacheService.get(`concurrent-${i}`));
      }

      const results = await Promise.all(getPromises);
      const getTime = Date.now() - getStartTime;

      expect(results.length).toBe(operations);
      expect(results.every(r => r !== null)).toBe(true);
      expect(setTime).toBeLessThan(2000); // 100个并发操作应在2秒内完成
      expect(getTime).toBeLessThan(1000);  // 100个并发获取应在1秒内完成

      console.log(`📊 Concurrent Performance - ${operations} ops: Set ${setTime}ms, Get ${getTime}ms`);
    });

    it('should maintain good hit rate', async () => {
      const totalOperations = 200;
      const keys = Array.from({ length: 50 }, (_, i) => `hitrate-${i}`);

      // 预热缓存
      for (const key of keys) {
        await cacheService.set(key, { data: `value-${key}` }, { ttl: 300 });
      }

      let hits = 0;
      const startTime = Date.now();

      // 测试命中率
      for (let i = 0; i < totalOperations; i++) {
        const randomKey = keys[Math.floor(Math.random() * keys.length)]!;
        const result = await cacheService.get(randomKey);
        if (result) hits++;
      }

      const duration = Date.now() - startTime;
      const hitRate = (hits / totalOperations) * 100;

      expect(hitRate).toBeGreaterThan(80); // 至少80%命中率
      expect(duration).toBeLessThan(5000); // 200次操作应在5秒内完成

      console.log(`📊 Hit Rate Performance: ${hitRate.toFixed(1)}% in ${duration}ms`);
    });
  });

  describe('Cache Statistics', () => {
    it('should track performance metrics', async () => {
      // 执行一些操作
      await cacheService.set('stats-test-1', { data: 'test1' });
      await cacheService.set('stats-test-2', { data: 'test2' });
      await cacheService.get('stats-test-1');
      await cacheService.get('stats-test-2');
      await cacheService.get('non-existent-key');

      const stats = cacheService.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(66.67); // 2/3 * 100

      console.log(`📊 Cache Stats:`, stats);
    });

    it('should provide health check', async () => {
      const health = await cacheService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(['healthy', 'degraded', 'down']).toContain(health.status);
      expect(health.details).toHaveProperty('stats');
      expect(health.details).toHaveProperty('redisConnected');

      console.log(`📊 Cache Health:`, health);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle memory usage efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行大量缓存操作
      const operations = 500;
      const largeData = 'x'.repeat(1000); // 1KB数据

      for (let i = 0; i < operations; i++) {
        await cacheService.set(`memory-test-${i}`, {
          id: i,
          data: largeData,
          timestamp: Date.now()
        });
        await cacheService.get(`memory-test-${i}`);
        // 随机删除一些数据以避免内存堆积
        if (i % 3 === 0) {
          await cacheService.del(`memory-test-${i}`);
        }
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该小于20MB
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);

      console.log(`📊 Memory Usage: Increase ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${operations} operations`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle TTL expiration correctly', async () => {
      const testData = { message: 'will expire' };

      // 设置1秒TTL
      await cacheService.set('expire-test', testData, { ttl: 1 });

      // 立即获取应该成功
      let result = await cacheService.get('expire-test');
      expect(result).toEqual(testData);

      // 等待1.1秒后应该过期
      await new Promise(resolve => setTimeout(resolve, 1100));
      result = await cacheService.get('expire-test');
      expect(result).toBeNull();
    });

    it('should handle large data objects', async () => {
      const largeData = {
        id: 1,
        payload: 'x'.repeat(10000), // 10KB数据
        metadata: {
          created: new Date().toISOString(),
          tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`)
        }
      };

      const startTime = Date.now();
      await cacheService.set('large-data', largeData);
      const setTime = Date.now() - startTime;

      const getStartTime = Date.now();
      const result = await cacheService.get('large-data');
      const getTime = Date.now() - getStartTime;

      expect(result).toEqual(largeData);
      expect(setTime).toBeLessThan(200); // 大数据设置应在200ms内完成
      expect(getTime).toBeLessThan(100); // 大数据获取应在100ms内完成

      console.log(`📊 Large Data Performance - Set: ${setTime}ms, Get: ${getTime}ms`);
    });

    it('should handle data correctly in edge cases', async () => {
      // 测试设置和获取
      await cacheService.set('test-key', 'test-value');
      const result = await cacheService.get('test-key');
      expect(result).toEqual('test-value');

      // 测试不存在的键
      const nonExistent = await cacheService.get('non-existent-key');
      expect(nonExistent).toBeNull();

      // 测试删除操作
      const deleted = await cacheService.del('test-key');
      expect(deleted).toBe(1);

      const afterDelete = await cacheService.get('test-key');
      expect(afterDelete).toBeNull();
    });
  });
});