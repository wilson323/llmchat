/**
 * 智能缓存服务测试
 */

import SmartCacheService, { CacheConfigs } from '@/services/SmartCacheService';
import { getCacheService } from '@/services/CacheService';

// Mock dependencies
jest.mock('@/services/CacheService');
jest.mock('@/utils/logger');

describe('SmartCacheService', () => {
  let service: SmartCacheService;
  let mockCacheService: any;

  beforeEach(() => {
    service = SmartCacheService.getInstance();
    service.resetStats();
    
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
      clear: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    };
    
    (getCacheService as jest.Mock).mockReturnValue(mockCacheService);
  });

  describe('Basic Cache Operations', () => {
    it('should get or set value with fallback', async () => {
      const fallback = jest.fn().mockResolvedValue('test-value');
      mockCacheService.get.mockResolvedValue(null);

      const result = await service.getOrSet('test-key', fallback, CacheConfigs.AGENTS_LIST);

      expect(result).toBe('test-value');
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return cached value without calling fallback', async () => {
      const fallback = jest.fn().mockResolvedValue('new-value');
      mockCacheService.get.mockResolvedValue('cached-value');

      const result = await service.getOrSet('test-key', fallback, CacheConfigs.AGENTS_LIST);

      expect(result).toBe('cached-value');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should use memory cache for repeated requests', async () => {
      const fallback = jest.fn().mockResolvedValue('test-value');
      mockCacheService.get.mockResolvedValue(null);

      const config = { ...CacheConfigs.AGENTS_LIST, enableMemoryCache: true };

      // 第一次请求 - 回源
      const result1 = await service.getOrSet('test-key', fallback, config);

      // 第二次请求 - 命中内存缓存
      const result2 = await service.getOrSet('test-key', fallback, config);

      expect(result1).toBe('test-value');
      expect(result2).toBe('test-value');
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(mockCacheService.get).toHaveBeenCalledTimes(1); // 只查询Redis一次
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate by tag', async () => {
      const config = CacheConfigs.AGENTS_LIST;
      
      await service.set('agent1', { id: '1' }, config);
      await service.set('agent2', { id: '2' }, config);

      const invalidated = await service.invalidateByTag('agents');

      expect(invalidated).toBeGreaterThan(0);
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should invalidate by pattern', async () => {
      mockCacheService.keys.mockResolvedValue(['user:sessions:1', 'user:sessions:2']);

      const invalidated = await service.invalidatePattern('user:sessions');

      expect(invalidated).toBeGreaterThan(0);
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should delete individual cache entry', async () => {
      await service.delete('test-key', 'agents');

      expect(mockCacheService.del).toHaveBeenCalledWith('agents:test-key');
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      const fallback = jest.fn().mockResolvedValue('value');
      
      // Miss
      mockCacheService.get.mockResolvedValueOnce(null);
      await service.getOrSet('key1', fallback, CacheConfigs.AGENTS_LIST);

      // Hit
      mockCacheService.get.mockResolvedValueOnce('cached');
      await service.getOrSet('key2', fallback, CacheConfigs.AGENTS_LIST);

      const stats = service.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should calculate hit rate correctly', async () => {
      const fallback = jest.fn().mockResolvedValue('value');
      
      // 3 hits
      mockCacheService.get.mockResolvedValue('cached');
      await service.getOrSet('key1', fallback, CacheConfigs.AGENTS_LIST);
      await service.getOrSet('key2', fallback, CacheConfigs.AGENTS_LIST);
      await service.getOrSet('key3', fallback, CacheConfigs.AGENTS_LIST);

      // 1 miss
      mockCacheService.get.mockResolvedValue(null);
      await service.getOrSet('key4', fallback, CacheConfigs.AGENTS_LIST);

      const stats = service.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(75); // 3/4 = 75%
    });

    it('should reset statistics', () => {
      service.resetStats();

      const stats = service.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Memory Cache', () => {
    it('should expire memory cache entries', async () => {
      const config = {
        ...CacheConfigs.AGENTS_LIST,
        enableMemoryCache: true,
        memoryTtl: 1, // 1秒过期
      };

      const fallback = jest.fn().mockResolvedValue('value');
      mockCacheService.get.mockResolvedValue(null);

      // 第一次请求
      await service.getOrSet('test-key', fallback, config);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      // 第二次请求应该重新回源
      await service.getOrSet('test-key', fallback, config);

      expect(fallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Predefined Configs', () => {
    it('should have agents list config', () => {
      expect(CacheConfigs.AGENTS_LIST).toHaveProperty('ttl', 300);
      expect(CacheConfigs.AGENTS_LIST).toHaveProperty('prefix', 'agents');
      expect(CacheConfigs.AGENTS_LIST.enableMemoryCache).toBe(true);
    });

    it('should have session messages config', () => {
      expect(CacheConfigs.SESSION_MESSAGES).toHaveProperty('ttl', 30);
      expect(CacheConfigs.SESSION_MESSAGES.enableMemoryCache).toBe(false);
    });
  });
});

