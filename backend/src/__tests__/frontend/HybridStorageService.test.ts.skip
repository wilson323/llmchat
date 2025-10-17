/**
 * HybridStorageService.ts 模块单元测试
 * 测试混合存储服务的核心功能和错误处理
 */

import {
  HybridStorageManager,
  MemoryStorageProvider,
  IndexedDBStorageProvider,
  CacheManager,
  SyncManager,
  CacheStrategy
} from '../../../../frontend/src/services/HybridStorageService';

// Mock IndexedDB for testing environment
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

beforeAll(() => {
  // Mock browser APIs for Node.js test environment
  Object.defineProperty(window, 'indexedDB', {
    value: mockIndexedDB,
    writable: true
  });

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true
  });
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();

  // Reset localStorage and sessionStorage
  mockLocalStorage.length = 0;
  mockSessionStorage.length = 0;
});

describe('HybridStorageService模块测试', () => {
  describe('MemoryStorageProvider', () => {
    let memoryProvider: MemoryStorageProvider;

    beforeEach(() => {
      memoryProvider = new MemoryStorageProvider({
        maxSize: 1024 * 1024, // 1MB
        maxEntries: 100
      });
    });

    it('should store and retrieve data correctly', async () => {
      const testData = { id: 1, name: 'test' };
      const key = 'test-key';

      await memoryProvider.set(key, testData);
      const result = await memoryProvider.get(key);

      expect(result).toEqual(testData);
    });

    it('should handle non-existent keys', async () => {
      const result = await memoryProvider.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete data correctly', async () => {
      const testData = { id: 1, name: 'test' };
      const key = 'test-key';

      await memoryProvider.set(key, testData);
      await memoryProvider.del(key);
      const result = await memoryProvider.get(key);

      expect(result).toBeNull();
    });

    it('should handle storage size limits', async () => {
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB data
      const key = 'large-data';

      await memoryProvider.set(key, largeData);
      const result = await memoryProvider.get(key);

      expect(result).toBeNull(); // Should not store data that exceeds size limit
    });

    it('should handle entry count limits', async () => {
      // Fill storage to max entries
      for (let i = 0; i < 105; i++) {
        await memoryProvider.set(`key-${i}`, { id: i });
      }

      // Oldest entries should be evicted
      const oldestEntry = await memoryProvider.get('key-0');
      expect(oldestEntry).toBeNull();

      // Newest entries should exist
      const newestEntry = await memoryProvider.get('key-104');
      expect(newestEntry).toEqual({ id: 104 });
    });

    it('should clear all data', async () => {
      await memoryProvider.set('key1', { data: 'test1' });
      await memoryProvider.set('key2', { data: 'test2' });

      await memoryProvider.clear();

      const result1 = await memoryProvider.get('key1');
      const result2 = await memoryProvider.get('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('CacheManager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
      cacheManager = new CacheManager({
        maxSize: 512 * 1024, // 512KB
        maxEntries: 50,
        strategy: CacheStrategy.LRU,
        ttl: 60000 // 1 minute
      });
    });

    it('should cache data with TTL', async () => {
      const testData = { message: 'test data' };
      const key = 'test-key';

      await cacheManager.set(key, testData);
      const result = await cacheManager.get(key);

      expect(result).toEqual(testData);
    });

    it('should handle TTL expiration', async () => {
      const testData = { message: 'test data' };
      const key = 'test-key';

      // Create cache with very short TTL
      const shortTtlCache = new CacheManager({
        maxSize: 512 * 1024,
        maxEntries: 50,
        strategy: CacheStrategy.LRU,
        ttl: 1 // 1ms
      });

      await shortTtlCache.set(key, testData);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await shortTtlCache.get(key);
      expect(result).toBeNull();
    });

    it('should implement LRU eviction strategy', async () => {
      // Fill cache to capacity
      for (let i = 0; i < 55; i++) {
        await cacheManager.set(`key-${i}`, { data: `value-${i}` });
      }

      // Access some keys to update their recency
      await cacheManager.get('key-50');
      await cacheManager.get('key-51');
      await cacheManager.get('key-52');

      // Add one more entry to trigger eviction
      await cacheManager.set('new-key', { data: 'new-value' });

      // Oldest entries should be evicted
      const oldestEntry = await cacheManager.get('key-0');
      expect(oldestEntry).toBeNull();

      // Recently accessed entries should still exist
      const recentEntry = await cacheManager.get('key-51');
      expect(recentEntry).toEqual({ data: 'value-51' });
    });

    it('should provide cache statistics', async () => {
      await cacheManager.set('key1', { data: 'value1' });
      await cacheManager.get('key1'); // hit
      await cacheManager.get('non-existent'); // miss

      const stats = cacheManager.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.entries).toBe(1);
    });

    it('should handle cache warming', async () => {
      const initialData = {
        'key1': { data: 'value1' },
        'key2': { data: 'value2' },
        'key3': { data: 'value3' }
      };

      await cacheManager.warm(initialData);

      const result1 = await cacheManager.get('key1');
      const result2 = await cacheManager.get('key2');
      const result3 = await cacheManager.get('key3');

      expect(result1).toEqual({ data: 'value1' });
      expect(result2).toEqual({ data: 'value2' });
      expect(result3).toEqual({ data: 'value3' });
    });
  });

  describe('HybridStorageManager', () => {
    let hybridStorage: HybridStorageManager;

    beforeEach(async () => {
      hybridStorage = new HybridStorageManager({
        cache: {
          memory: {
            maxSize: 256 * 1024, // 256KB
            maxEntries: 25,
            strategy: CacheStrategy.LRU,
            ttl: 30000 // 30 seconds
          }
        },
        storage: {
          enableEncryption: false,
          enableCompression: false
        }
      });

      await hybridStorage.initialize();
    });

    afterEach(async () => {
      if (hybridStorage) {
        await hybridStorage.destroy();
      }
    });

    it('should store data in appropriate tier', async () => {
      const testData = { id: 1, content: 'test content' };
      const key = 'test-data';

      await hybridStorage.set(key, testData, {
        tier: 'hot',
        ttl: 60000
      });

      const result = await hybridStorage.get(key);
      expect(result).toEqual(testData);
    });

    it('should automatically promote hot data', async () => {
      const testData = { id: 1, content: 'frequently accessed' };
      const key = 'hot-data';

      // Store data as cold initially
      await hybridStorage.set(key, testData, { tier: 'cold' });

      // Access data multiple times to trigger promotion
      for (let i = 0; i < 5; i++) {
        await hybridStorage.get(key);
      }

      // Check if data was promoted to hot tier
      const metadata = await hybridStorage.getMetadata(key);
      expect(metadata.tier).toBe('hot');
    });

    it('should handle data synchronization', async () => {
      const testData = { id: 1, content: 'sync test' };
      const key = 'sync-data';

      await hybridStorage.set(key, testData, {
        tier: 'warm',
        syncToRemote: true
      });

      // Simulate remote sync
      const syncResult = await hybridStorage.sync();
      expect(syncResult.success).toBe(true);
      expect(syncResult.syncedItems).toBeGreaterThanOrEqual(0);
    });

    it('should handle storage fallback', async () => {
      const testData = { id: 1, content: 'fallback test' };
      const key = 'fallback-data';

      // Mock primary storage failure
      const originalSet = hybridStorage.set;
      hybridStorage.set = jest.fn().mockImplementation(async (key, data, options) => {
        // First call fails, second succeeds with fallback
        if (!hybridStorage.set.mock.calls.length) {
          throw new Error('Primary storage failed');
        }
        return originalSet.call(hybridStorage, key, data, { ...options, tier: 'cold' });
      });

      await hybridStorage.set(key, testData, { tier: 'hot' });

      const result = await hybridStorage.get(key);
      expect(result).toEqual(testData);
    });

    it('should handle data compression', async () => {
      const largeData = {
        id: 1,
        content: 'x'.repeat(1000), // 1KB of repetitive data
        metadata: {
          created: new Date().toISOString(),
          type: 'test'
        }
      };

      const key = 'compressed-data';

      await hybridStorage.set(key, largeData, {
        tier: 'warm',
        compress: true
      });

      const result = await hybridStorage.get(key);
      expect(result).toEqual(largeData);

      // Check compression statistics
      const stats = await hybridStorage.getStorageStats();
      expect(stats.compressionRatio).toBeLessThan(1.0);
    });

    it('should handle data encryption', async () => {
      const sensitiveData = {
        id: 1,
        content: 'sensitive information',
        secret: 'confidential'
      };

      const key = 'encrypted-data';

      await hybridStorage.set(key, sensitiveData, {
        tier: 'cold',
        encrypt: true
      });

      const result = await hybridStorage.get(key);
      expect(result).toEqual(sensitiveData);

      // Verify data is actually encrypted at storage level
      const storageProvider = hybridStorage.getStorageProvider('cold');
      const rawStoredData = await storageProvider.get(key);
      expect(rawStoredData).not.toEqual(sensitiveData);
    });
  });

  describe('SyncManager', () => {
    let syncManager: SyncManager;
    let mockStorageProvider: any;

    beforeEach(() => {
      mockStorageProvider = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        clear: jest.fn(),
        getAll: jest.fn(),
        getStats: jest.fn()
      };

      syncManager = new SyncManager({
        autoSync: false,
        syncInterval: 5000,
        batchSize: 10,
        maxRetries: 3,
        conflictResolution: 'prompt'
      });
    });

    it('should queue sync operations', async () => {
      const operations = [
        { type: 'set', key: 'key1', data: 'value1' },
        { type: 'set', key: 'key2', data: 'value2' },
        { type: 'del', key: 'key3' }
      ];

      for (const op of operations) {
        await syncManager.queueOperation(op);
      }

      const queueStats = syncManager.getQueueStats();
      expect(queueStats.pending).toBe(3);
    });

    it('should process sync queue in batches', async () => {
      const operations = Array(25).fill(null).map((_, i) => ({
        type: 'set' as const,
        key: `key-${i}`,
        data: `value-${i}`
      }));

      for (const op of operations) {
        await syncManager.queueOperation(op);
      }

      const syncResult = await syncManager.processQueue(mockStorageProvider);

      expect(syncResult.processed).toBe(25);
      expect(syncResult.failed).toBe(0);
      expect(mockStorageProvider.set).toHaveBeenCalledTimes(25);
    });

    it('should handle sync conflicts', async () => {
      // Simulate conflict scenario
      mockStorageProvider.get.mockResolvedValue({ data: 'existing-value', version: 2 });
      mockStorageProvider.set.mockRejectedValue(new Error('Conflict: Version mismatch'));

      const conflictOp = {
        type: 'set' as const,
        key: 'conflict-key',
        data: 'new-value',
        version: 1
      };

      await syncManager.queueOperation(conflictOp);

      const syncResult = await syncManager.processQueue(mockStorageProvider);

      expect(syncResult.conflicts).toBe(1);
      expect(syncResult.processed).toBe(0);
    });

    it('should retry failed operations', async () => {
      mockStorageProvider.set
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(true);

      const retryOp = {
        type: 'set' as const,
        key: 'retry-key',
        data: 'retry-value'
      };

      await syncManager.queueOperation(retryOp);

      const syncResult = await syncManager.processQueue(mockStorageProvider);

      expect(syncResult.retried).toBe(1);
      expect(syncResult.processed).toBe(1);
      expect(mockStorageProvider.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration Tests', () => {
    let hybridStorage: HybridStorageManager;

    beforeEach(async () => {
      hybridStorage = new HybridStorageManager({
        cache: {
          memory: {
            maxSize: 1 * 1024 * 1024, // 1MB
            maxEntries: 100,
            strategy: CacheStrategy.LFU,
            ttl: 120000 // 2 minutes
          }
        },
        sync: {
          autoSync: true,
          syncInterval: 1000,
          batchSize: 5
        }
      });

      await hybridStorage.initialize();
    });

    afterEach(async () => {
      if (hybridStorage) {
        await hybridStorage.destroy();
      }
    });

    it('should handle complex workflow', async () => {
      // Store various types of data
      const textData = { type: 'text', content: 'Hello World' };
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
      const complexObject = {
        user: { id: 1, name: 'Test User' },
        preferences: { theme: 'dark', language: 'en' },
        metadata: {
          created: new Date().toISOString(),
          tags: ['important', 'user-data']
        }
      };

      await hybridStorage.set('text-data', textData, { tier: 'hot' });
      await hybridStorage.set('binary-data', binaryData, { tier: 'warm' });
      await hybridStorage.set('complex-data', complexObject, { tier: 'cold' });

      // Retrieve and verify data
      const retrievedText = await hybridStorage.get('text-data');
      const retrievedBinary = await hybridStorage.get('binary-data');
      const retrievedComplex = await hybridStorage.get('complex-data');

      expect(retrievedText).toEqual(textData);
      expect(retrievedBinary).toEqual(binaryData);
      expect(retrievedComplex).toEqual(complexObject);

      // Verify tier assignments
      const textMetadata = await hybridStorage.getMetadata('text-data');
      const binaryMetadata = await hybridStorage.getMetadata('binary-data');
      const complexMetadata = await hybridStorage.getMetadata('complex-data');

      expect(textMetadata.tier).toBe('hot');
      expect(binaryMetadata.tier).toBe('warm');
      expect(complexMetadata.tier).toBe('cold');
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(20).fill(null).map((_, i) => ({
        key: `concurrent-${i}`,
        data: { id: i, value: `value-${i}` },
        tier: i % 3 === 0 ? 'hot' : i % 3 === 1 ? 'warm' : 'cold'
      }));

      // Execute concurrent set operations
      await Promise.all(
        operations.map(op =>
          hybridStorage.set(op.key, op.data, { tier: op.tier })
        )
      );

      // Execute concurrent get operations
      const results = await Promise.all(
        operations.map(op => hybridStorage.get(op.key))
      );

      results.forEach((result, index) => {
        expect(result).toEqual(operations[index].data);
      });

      // Verify all data is accessible
      const stats = await hybridStorage.getStorageStats();
      expect(stats.totalEntries).toBe(20);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid cache strategy', () => {
      expect(() => {
        new CacheManager({
          maxSize: 1024,
          maxEntries: 10,
          strategy: 'invalid' as any,
          ttl: 60000
        });
      }).toThrow();
    });

    it('should handle corrupted data gracefully', async () => {
      const cacheManager = new CacheManager({
        maxSize: 1024,
        maxEntries: 10,
        strategy: CacheStrategy.LRU,
        ttl: 60000
      });

      // Simulate corrupted data in storage
      mockLocalStorage.getItem.mockReturnValue('corrupted-json-data');

      const result = await cacheManager.get('corrupted-key');
      expect(result).toBeNull();
    });

    it('should handle storage quota exceeded', async () => {
      const hybridStorage = new HybridStorageManager({
        cache: {
          memory: {
            maxSize: 1024, // Very small cache
            maxEntries: 2,
            strategy: CacheStrategy.LRU,
            ttl: 60000
          }
        }
      });

      await hybridStorage.initialize();

      try {
        // Fill storage beyond quota
        await hybridStorage.set('large1', 'x'.repeat(1000));
        await hybridStorage.set('large2', 'x'.repeat(1000));
        await hybridStorage.set('large3', 'x'.repeat(1000)); // Should trigger eviction

        const stats = await hybridStorage.getStorageStats();
        expect(stats.totalEntries).toBeLessThanOrEqual(2);
      } finally {
        await hybridStorage.destroy();
      }
    });

    it('should handle network timeouts during sync', async () => {
      const syncManager = new SyncManager({
        autoSync: false,
        syncInterval: 1000,
        batchSize: 5,
        maxRetries: 2,
        networkTimeout: 100
      });

      // Mock network timeout
      const mockNetworkProvider = {
        set: jest.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 200)
          )
        )
      };

      const operation = {
        type: 'set' as const,
        key: 'timeout-test',
        data: 'test-data'
      };

      await syncManager.queueOperation(operation);

      const syncResult = await syncManager.processQueue(mockNetworkProvider);

      expect(syncResult.timeouts).toBe(1);
      expect(syncResult.processed).toBe(0);
    });
  });
});