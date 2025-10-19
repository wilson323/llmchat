/**
 * 类型守卫性能优化工具测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LRUCache,
  CacheManager,
  PerformanceMetricsCollector,
  PerformanceMonitor,
  OptimizedTypeValidator,
  LazyValidatorFactory,
  BatchValidationProcessor,
  createOptimizedValidator,
  createLazyValidator,
  createBatchProcessor,
  getPerformanceMonitor,
  warmupValidatorCache
} from '../type-guards-performance';
import { RuntimeTypeValidator } from '../runtime-type-validator';

describe('LRUCache', () => {
  let cache: LRUCache<string, string>;

  beforeEach(() => {
    cache = new LRUCache<string, string>(3);
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should handle non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should update LRU order on access', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 to make it most recently used
    cache.get('key1');

    // Add key4, should evict key2 (least recently used)
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1'); // Still there
    expect(cache.get('key2')).toBeUndefined(); // Evicted
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should respect max size', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    expect(cache.size()).toBe(3);

    cache.set('key4', 'value4');
    expect(cache.size()).toBe(3); // Should still be 3
  });

  it('should clear all values', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();

    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should delete specific values', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');

    expect(cache.delete('nonexistent')).toBe(false);
  });

  it('should provide keys and values arrays', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    expect(cache.keys()).toEqual(['key1', 'key2']);
    expect(cache.values()).toEqual(['value1', 'value2']);
  });
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = CacheManager.getInstance({
      enableCache: true,
      cacheSize: 5,
      enableMetrics: true
    });
  });

  it('should be singleton', () => {
    const instance1 = CacheManager.getInstance();
    const instance2 = CacheManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should create and manage caches', () => {
    const cache1 = cacheManager.getCache<string, string>('cache1');
    const cache2 = cacheManager.getCache<number, number>('cache2');

    expect(cache1).toBeInstanceOf(LRUCache);
    expect(cache2).toBeInstanceOf(LRUCache);

    // Should return same cache instance
    const cache1Again = cacheManager.getCache<string, string>('cache1');
    expect(cache1Again).toBe(cache1);
  });

  it('should clear specific caches', () => {
    const cache1 = cacheManager.getCache<string, string>('cache1');
    const cache2 = cacheManager.getCache<string, string>('cache2');

    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');

    cacheManager.clearCache('cache1');

    expect(cache1.get('key1')).toBeUndefined();
    expect(cache2.get('key2')).toBe('value2');
  });

  it('should clear all caches', () => {
    const cache1 = cacheManager.getCache<string, string>('cache1');
    const cache2 = cacheManager.getCache<string, string>('cache2');

    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');

    cacheManager.clearCache();

    expect(cache1.get('key1')).toBeUndefined();
    expect(cache2.get('key2')).toBeUndefined();
  });

  it('should provide cache statistics', () => {
    const cache1 = cacheManager.getCache<string, string>('cache1');
    cache1.set('key1', 'value1');
    cache1.set('key2', 'value2');

    const stats = cacheManager.getCacheStats();

    expect(stats['cache1']).toEqual({
      size: 2,
      maxSize: 5
    });
  });

  it('should update configuration', () => {
    cacheManager.updateConfig({ cacheSize: 10 });

    const cache = cacheManager.getCache<string, string>('newCache');
    expect(cache['maxSize']).toBe(10);
  });
});

describe('PerformanceMetricsCollector', () => {
  let collector: PerformanceMetricsCollector;

  beforeEach(() => {
    collector = new PerformanceMetricsCollector(true);
  });

  it('should record validation metrics', () => {
    collector.recordValidation(10, true, false);
    collector.recordValidation(5, false, true);
    collector.recordValidation(15, true, false);

    const metrics = collector.getMetrics();

    expect(metrics.totalValidations).toBe(3);
    expect(metrics.successfulValidations).toBe(2);
    expect(metrics.failedValidations).toBe(1);
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.cacheMisses).toBe(2);
    expect(metrics.averageValidationTime).toBe(10); // (10 + 5 + 15) / 3
    expect(metrics.slowestValidation).toBe(15);
    expect(metrics.fastestValidation).toBe(5);
  });

  it('should calculate average validation time correctly', () => {
    collector.recordValidation(10, true, false);
    collector.recordValidation(20, true, false);

    const metrics = collector.getMetrics();
    expect(metrics.averageValidationTime).toBe(15); // (10 + 20) / 2
  });

  it('should reset metrics', () => {
    collector.recordValidation(10, true, false);
    collector.recordValidation(5, false, true);

    collector.reset();

    const metrics = collector.getMetrics();
    expect(metrics.totalValidations).toBe(0);
    expect(metrics.successfulValidations).toBe(0);
    expect(metrics.failedValidations).toBe(0);
  });

  it('should enable/disable metrics collection', () => {
    collector.disable();
    collector.recordValidation(10, true, false);

    let metrics = collector.getMetrics();
    expect(metrics.totalValidations).toBe(0);

    collector.enable();
    collector.recordValidation(10, true, false);

    metrics = collector.getMetrics();
    expect(metrics.totalValidations).toBe(1);
  });

  it('should track fastest and slowest validations', () => {
    collector.recordValidation(50, true, false);
    collector.recordValidation(10, true, false);
    collector.recordValidation(30, true, false);

    const metrics = collector.getMetrics();
    expect(metrics.fastestValidation).toBe(10);
    expect(metrics.slowestValidation).toBe(50);
  });
});

describe('OptimizedTypeValidator', () => {
  let validator: OptimizedTypeValidator<string>;

  beforeEach(() => {
    const baseValidator = RuntimeTypeValidator.create<string>();
    validator = createOptimizedValidator(baseValidator, {
      enableCache: true,
      cacheSize: 10,
      enableMetrics: true
    });
  });

  it('should validate values with caching', () => {
    const result1 = validator.test('test');
    const result2 = validator.test('test');

    expect(result1.isValid).toBe(true);
    expect(result2.isValid).toBe(true);
    expect(result1.data).toBe(result2.data);

    // Second call should use cache
    const metrics = validator.getMetrics();
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.cacheMisses).toBe(1);
  });

  it('should validate batch values', async () => {
    const values = ['test1', 'test2', 'test3'];
    const results = await validator.testBatch(values);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.isValid)).toBe(true);
  });

  it('should handle async validation with timeout', async () => {
    const result = await validator.testAsync('test');

    expect(result.isValid).toBe(true);
    expect(result.data).toBe('test');
  });

  it('should timeout on long validation', async () => {
    const slowValidator = createOptimizedValidator(
      {
        test: (value: unknown) => ({
          isValid: typeof value === 'string',
          data: value,
          errors: []
        })
      },
      { timeoutMs: 1 } // Very short timeout
    );

    await expect(slowValidator.testAsync('test')).rejects.toThrow('Validation timeout');
  });

  it('should clear cache', () => {
    validator.test('test');
    validator.test('test2');

    validator.clearCache();

    const metrics = validator.getMetrics();
    // Cache should be empty but metrics remain
    expect(metrics.totalValidations).toBeGreaterThan(0);
  });

  it('should reset metrics', () => {
    validator.test('test');
    validator.test('test2');

    validator.resetMetrics();

    const metrics = validator.getMetrics();
    expect(metrics.totalValidations).toBe(0);
  });
});

describe('LazyValidatorFactory', () => {
  it('should create validator lazily', async () => {
    let factoryCallCount = 0;
    const factory = () => {
      factoryCallCount++;
      return (value: unknown): value is string => typeof value === 'string';
    };

    const lazyFactory = new LazyValidatorFactory(factory);

    expect(factoryCallCount).toBe(0);

    const validator = await lazyFactory.getValidator();
    expect(factoryCallCount).toBe(1);
    expect(validator('test')).toBe(true);

    // Subsequent calls should not call factory again
    const validator2 = await lazyFactory.getValidator();
    expect(factoryCallCount).toBe(1);
    expect(validator2('test')).toBe(true);
  });

  it('should handle synchronous access after creation', async () => {
    const factory = () => (value: unknown): value is number => typeof value === 'number';
    const lazyFactory = new LazyValidatorFactory(factory);

    // Create validator asynchronously first
    await lazyFactory.getValidator();

    // Then access synchronously
    const validator = lazyFactory.getValidatorSync();
    expect(validator).toBeDefined();
    expect(validator!(42)).toBe(true);
  });

  it('should handle concurrent creation', async () => {
    let factoryCallCount = 0;
    const factory = () => {
      factoryCallCount++;
      return new Promise(resolve => {
        setTimeout(() => resolve((value: unknown): value is string => typeof value === 'string'), 10);
      });
    };

    const lazyFactory = new LazyValidatorFactory(factory);

    // Start multiple concurrent creations
    const [validator1, validator2, validator3] = await Promise.all([
      lazyFactory.getValidator(),
      lazyFactory.getValidator(),
      lazyFactory.getValidator()
    ]);

    expect(factoryCallCount).toBe(1);
    expect(validator1).toBe(validator2);
    expect(validator2).toBe(validator3);
  });

  it('should reset validator', async () => {
    let factoryCallCount = 0;
    const factory = () => {
      factoryCallCount++;
      return (value: unknown): value is string => typeof value === 'string';
    };

    const lazyFactory = new LazyValidatorFactory(factory);

    await lazyFactory.getValidator();
    expect(factoryCallCount).toBe(1);

    lazyFactory.reset();
    await lazyFactory.getValidator();
    expect(factoryCallCount).toBe(2);
  });
});

describe('BatchValidationProcessor', () => {
  let processor: BatchValidationProcessor;

  beforeEach(() => {
    processor = createBatchProcessor(2, 2); // Small batch size for testing
  });

  it('should process validation tasks', async () => {
    const validator1 = createOptimizedValidator(RuntimeTypeValidator.create<string>());
    const validator2 = createOptimizedValidator(RuntimeTypeValidator.create<number>());

    const result1 = await processor.addTask('test1', 'hello', validator1);
    const result2 = await processor.addTask('test2', 42, validator2);

    expect(result1.isValid).toBe(true);
    expect(result1.data).toBe('hello');
    expect(result2.isValid).toBe(true);
    expect(result2.data).toBe(42);
  });

  it('should handle task priorities', async () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());

    // Add tasks with different priorities
    const lowPriorityPromise = processor.addTask('low', 'low', validator, 1);
    const highPriorityPromise = processor.addTask('high', 'high', validator, 10);

    const [lowResult, highResult] = await Promise.all([lowPriorityPromise, highPriorityPromise]);

    expect(lowResult.isValid).toBe(true);
    expect(highResult.isValid).toBe(true);
  });

  it('should handle validation errors in batch', async () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());

    const validPromise = processor.addTask('valid', 'test', validator);
    const invalidPromise = processor.addTask('invalid', 123, validator);

    const [validResult, invalidResult] = await Promise.allSettled([validPromise, invalidPromise]);

    expect(validResult.status).toBe('fulfilled');
    if (validResult.status === 'fulfilled') {
      expect(validResult.value.isValid).toBe(true);
    }

    expect(invalidResult.status).toBe('fulfilled');
    if (invalidResult.status === 'fulfilled') {
      expect(invalidResult.value.isValid).toBe(false);
    }
  });

  it('should provide queue status', () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());

    // Add tasks without awaiting
    processor.addTask('task1', 'test1', validator);
    processor.addTask('task2', 'test2', validator);

    const status = processor.getQueueStatus();
    expect(status.queueLength).toBeGreaterThanOrEqual(0);
    expect(typeof status.processing).toBe('boolean');
    expect(typeof status.processingCount).toBe('number');
  });

  it('should clear queue', async () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());

    const promise1 = processor.addTask('task1', 'test1', validator);
    const promise2 = processor.addTask('task2', 'test2', validator);

    processor.clearQueue();

    await expect(promise1).rejects.toThrow('Task cancelled due to queue clear');
    await expect(promise2).rejects.toThrow('Task cancelled due to queue clear');
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = getPerformanceMonitor();
    monitor.resetMetrics();
  });

  it('should be singleton', () => {
    const monitor1 = getPerformanceMonitor();
    const monitor2 = getPerformanceMonitor();
    expect(monitor1).toBe(monitor2);
  });

  it('should record validation performance', () => {
    monitor.recordValidation(10, true, false);
    monitor.recordValidation(5, false, true);

    const report = monitor.generateReport();

    expect(report.metrics.totalValidations).toBe(2);
    expect(report.metrics.successfulValidations).toBe(1);
    expect(report.metrics.failedValidations).toBe(1);
    expect(report.metrics.cacheHits).toBe(1);
    expect(report.metrics.cacheMisses).toBe(1);
  });

  it('should include cache statistics in report', () => {
    const cacheManager = CacheManager.getInstance();
    const cache = cacheManager.getCache<string, string>('test-cache');
    cache.set('key1', 'value1');

    monitor.recordValidation(5, true, true);

    const report = monitor.generateReport();
    expect(report.cacheStats).toBeDefined();
    expect(report.cacheStats['test-cache']).toBeDefined();
  });

  it('should generate performance recommendations', () => {
    // Record some metrics that would trigger recommendations
    for (let i = 0; i < 10; i++) {
      monitor.recordValidation(50, i < 5, i >= 5); // 5 failed, 5 successful, 5 cache misses
    }

    const report = monitor.generateReport();
    expect(report.recommendations).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should start and stop monitoring', () => {
    vi.useFakeTimers();

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    monitor.startMonitoring(1000); // Report every second

    // Advance time
    vi.advanceTimersByTime(1000);

    expect(consoleSpy).toHaveBeenCalledWith('Performance Report:', expect.any(Object));

    monitor.stopMonitoring();

    // Advance time again
    vi.advanceTimersByTime(1000);

    // Should not have called console.log again
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should reset metrics', () => {
    monitor.recordValidation(10, true, false);
    monitor.recordValidation(5, false, true);

    monitor.resetMetrics();

    const report = monitor.generateReport();
    expect(report.metrics.totalValidations).toBe(0);
  });
});

describe('工具函数', () => {
  describe('createOptimizedValidator', () => {
    it('should create optimized validator with default config', () => {
      const baseValidator = RuntimeTypeValidator.create<string>();
      const optimized = createOptimizedValidator(baseValidator);

      expect(optimized).toBeInstanceOf(OptimizedTypeValidator);
    });

    it('should create optimized validator with custom config', () => {
      const baseValidator = RuntimeTypeValidator.create<string>();
      const optimized = createOptimizedValidator(baseValidator, {
        enableCache: false,
        enableMetrics: false
      });

      expect(optimized).toBeInstanceOf(OptimizedTypeValidator);
    });
  });

  describe('createLazyValidator', () => {
    it('should create lazy validator factory', () => {
      const factory = () => RuntimeTypeValidator.create<string>();
      const lazyFactory = createLazyValidator(factory);

      expect(lazyFactory).toBeInstanceOf(LazyValidatorFactory);
    });
  });

  describe('createBatchProcessor', () => {
    it('should create batch processor with default config', () => {
      const processor = createBatchProcessor();

      expect(processor).toBeInstanceOf(BatchValidationProcessor);
    });

    it('should create batch processor with custom config', () => {
      const processor = createBatchProcessor(10, 5);

      expect(processor).toBeInstanceOf(BatchValidationProcessor);
    });
  });

  describe('warmupValidatorCache', () => {
    it('should warm up validator cache with test data', async () => {
      const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());
      const testData = ['test1', 'test2', 'test3'];

      await warmupValidatorCache(validator, testData);

      const metrics = validator.getMetrics();
      expect(metrics.totalValidations).toBe(3);
      expect(metrics.cacheMisses).toBe(3); // All initial calls should be cache misses
    });
  });
});

describe('性能测试', () => {
  it('should handle large numbers of validations efficiently', () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());

    const startTime = performance.now();
    const promises = Array.from({ length: 1000 }, (_, i) =>
      validator.testAsync(`test${i}`)
    );

    Promise.all(promises).then(() => {
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  it('should maintain performance with cache hits', () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>());
    const testValue = 'repeated-test-value';

    // First call (cache miss)
    const startTime1 = performance.now();
    validator.test(testValue);
    const endTime1 = performance.now();

    // Second call (cache hit)
    const startTime2 = performance.now();
    validator.test(testValue);
    const endTime2 = performance.now();

    // Cache hit should be faster
    expect(endTime2 - startTime2).toBeLessThan(endTime1 - startTime1);
  });

  it('should handle memory efficiently with cache size limits', () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<string>(), {
      cacheSize: 10 // Small cache size
    });

    // Add more items than cache size
    for (let i = 0; i < 20; i++) {
      validator.test(`test${i}`);
    }

    const metrics = validator.getMetrics();
    expect(metrics.totalValidations).toBe(20);

    // Cache should not grow beyond limits
    const cacheStats = CacheManager.getInstance().getCacheStats();
    Object.values(cacheStats).forEach(stats => {
      expect(stats.size).toBeLessThanOrEqual(10);
    });
  });
});

describe('边界情况和错误处理', () => {
  it('should handle invalid cache keys', () => {
    const validator = createOptimizedValidator(RuntimeTypeValidator.create<any>());

    // Test with various invalid values
    const invalidValues = [null, undefined, NaN, Infinity, -Infinity];

    invalidValues.forEach(value => {
      expect(() => validator.test(value)).not.toThrow();
    });
  });

  it('should handle validator factory errors', async () => {
    const factory = () => {
      throw new Error('Factory error');
    };

    const lazyFactory = createLazyValidator(factory);

    await expect(lazyFactory.getValidator()).rejects.toThrow('Factory error');
  });

  it('should handle batch processor errors gracefully', async () => {
    const processor = createBatchProcessor();

    // Add a task with an invalid validator
    const invalidValidator = null as any;

    await expect(
      processor.addTask('invalid', 'test', invalidValidator)
    ).rejects.toThrow();
  });

  it('should handle performance monitor edge cases', () => {
    const monitor = getPerformanceMonitor();

    // Record very fast validation
    monitor.recordValidation(0.001, true, false);

    // Record very slow validation
    monitor.recordValidation(1000, false, true);

    const report = monitor.generateReport();
    expect(report.metrics.fastestValidation).toBeLessThanOrEqual(report.metrics.slowestValidation);
  });
});