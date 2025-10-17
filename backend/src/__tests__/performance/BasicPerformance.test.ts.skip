/**
 * 基础性能测试
 * 测试核心功能的性能表现，不依赖外部服务
 */

describe('Basic Performance Tests', () => {
  describe('String Operations', () => {
    it('should handle JSON serialization efficiently', () => {
      const testData = {
        id: 1,
        name: 'performance-test',
        messages: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          content: `Message ${i}`,
          timestamp: new Date().toISOString(),
        })),
        metadata: {
          version: '1.0.0',
          environment: 'test',
          features: ['chat', 'streaming', 'cache'],
        },
      };

      const iterations = 1000;
      const startTime = Date.now();

      // 测试JSON序列化性能
      for (let i = 0; i < iterations; i++) {
        const serialized = JSON.stringify(testData);
        const deserialized = JSON.parse(serialized);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // 平均每次操作应小于1ms
      expect(duration).toBeLessThan(1000); // 1000次操作应在1秒内完成

      console.log(`📊 JSON Operations: ${iterations} ops in ${duration}ms (avg: ${avgTime.toFixed(2)}ms/op)`);
    });

    it('should handle string manipulation efficiently', () => {
      const baseString = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
      const iterations = 5000;

      const startTime = Date.now();

      // 测试字符串操作性能
      for (let i = 0; i < iterations; i++) {
        const combined = baseString.repeat(10);
        const uppercased = combined.toUpperCase();
        const trimmed = uppercased.trim();
        const parts = trimmed.split(' ');
        const joined = parts.join('-');
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(0.5); // 平均每次操作应小于0.5ms

      console.log(`📊 String Operations: ${iterations} ops in ${duration}ms (avg: ${avgTime.toFixed(2)}ms/op)`);
    });
  });

  describe('Array Operations', () => {
    it('should handle array operations efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: Math.random() * 1000,
        category: `category-${i % 10}`,
        active: i % 2 === 0,
      }));

      const startTime = Date.now();

      // 测试数组操作性能
      const filtered = largeArray.filter(item => item.active);
      const mapped = filtered.map(item => ({ ...item, processed: true }));
      const reduced = mapped.reduce((acc, item) => acc + item.value, 0);
      const sorted = mapped.sort((a, b) => a.value - b.value);

      const duration = Date.now() - startTime;

      expect(filtered.length).toBe(5000);
      expect(reduced).toBeGreaterThan(0);
      expect(sorted.length).toBe(5000);
      expect(duration).toBeLessThan(500); // 复杂数组操作应在500ms内完成

      console.log(`📊 Array Operations: 10k items processed in ${duration}ms`);
    });

    it('should handle search operations efficiently', () => {
      const dataArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i} with some additional text`,
        tags: [`tag-${i % 20}`, `category-${i % 5}`],
      }));

      const searchTerm = 'Item 123';
      const iterations = 1000;

      const startTime = Date.now();

      // 测试搜索性能
      for (let i = 0; i < iterations; i++) {
        const exactMatch = dataArray.find(item => item.name === searchTerm);
        const includesMatch = dataArray.filter(item =>
          item.description.includes('additional')
        );
        const regexMatch = dataArray.filter(item =>
          /^Item \d+$/.test(item.name)
        );
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(2); // 平均每次搜索应小于2ms

      console.log(`📊 Search Operations: ${iterations} searches in ${duration}ms (avg: ${avgTime.toFixed(2)}ms/search)`);
    });
  });

  describe('Object Operations', () => {
    it('should handle object property operations efficiently', () => {
      const testObject = {
        id: 1,
        name: 'test',
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0',
          config: {
            feature1: true,
            feature2: false,
            feature3: 'enabled',
          },
        },
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          value: Math.random(),
        })),
      };

      const iterations = 2000;
      const startTime = Date.now();

      // 测试对象操作性能
      for (let i = 0; i < iterations; i++) {
        const keys = Object.keys(testObject);
        const values = Object.values(testObject);
        const entries = Object.entries(testObject);
        const hasProperty = testObject.hasOwnProperty('metadata');
        const nestedValue = testObject.metadata?.config?.feature1;
        const cloned = JSON.parse(JSON.stringify(testObject));
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // 平均每次操作应小于1ms

      console.log(`📊 Object Operations: ${iterations} ops in ${duration}ms (avg: ${avgTime.toFixed(2)}ms/op)`);
    });

    it('should handle deep cloning efficiently', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                data: Array.from({ length: 100 }, (_, i) => ({
                  id: i,
                  nested: {
                    value: i * 2,
                    text: `Item ${i}`,
                  },
                })),
              },
            },
          },
        },
      };

      const iterations = 100;
      const startTime = Date.now();

      // 测试深拷贝性能
      for (let i = 0; i < iterations; i++) {
        const cloned = JSON.parse(JSON.stringify(deepObject));
        const modified = { ...cloned, modified: true };
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(10); // 平均每次深拷贝应小于10ms

      console.log(`📊 Deep Clone Operations: ${iterations} ops in ${duration}ms (avg: ${avgTime.toFixed(2)}ms/clone)`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during intensive operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行内存密集型操作
      for (let i = 0; i < 100; i++) {
        const largeArray = Array.from({ length: 1000 }, (_, j) => ({
          id: j,
          data: 'x'.repeat(100), // 100字节
          timestamp: Date.now(),
        }));

        // 处理数组
        const processed = largeArray.map(item => ({
          ...item,
          processed: true,
          doubled: item.id * 2,
        }));

        // 清理引用 - 让垃圾回收处理
        void processed;
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该小于50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`📊 Memory Usage: Increase ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB after 100k operations`);
    });
  });

  describe('Async Operations', () => {
    it('should handle async operations efficiently', async () => {
      const iterations = 50;
      const asyncTasks = Array.from({ length: iterations }, (_, i) =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ id: i, result: `async-result-${i}` });
          }, Math.random() * 10); // 0-10ms随机延迟
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(asyncTasks);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(iterations);
      expect(duration).toBeLessThan(1000); // 50个异步操作应在1秒内完成

      console.log(`📊 Async Operations: ${iterations} async tasks completed in ${duration}ms`);
    });
  });
});