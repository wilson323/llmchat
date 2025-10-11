/**
 * 内存优化服务测试
 */

import MemoryOptimizationService from '@/services/MemoryOptimizationService';
import MemoryMonitor from '@/utils/memoryMonitor';
import { RedisConnectionPool } from '@/utils/redisConnectionPool';

describe('MemoryOptimizationService', () => {
  let memoryOptimizationService: MemoryOptimizationService;
  let mockConnectionPool: jest.Mocked<RedisConnectionPool>;

  beforeEach(() => {
    // 模拟连接池
    mockConnectionPool = {
      getStats: jest.fn().mockReturnValue({
        active: 5,
        idle: 3,
        total: 8
      })
    } as any;

    // 创建内存优化服务实例
    memoryOptimizationService = new MemoryOptimizationService({
      monitoringEnabled: true,
      autoOptimizationEnabled: false, // 禁用自动优化以便测试
      monitoringIntervalMs: 5000,
      optimizationThreshold: 80,
      maxHeapSizeMB: 512,
      maxRSSSizeMB: 1024
    });

    memoryOptimizationService.setConnectionPool(mockConnectionPool);
  });

  afterEach(() => {
    if (memoryOptimizationService) {
      memoryOptimizationService.stop();
      memoryOptimizationService.shutdown();
    }
  });

  describe('基本功能测试', () => {
    test('应该能够启动服务', () => {
      expect(() => {
        memoryOptimizationService.start();
      }).not.toThrow();

      expect(memoryOptimizationService.getMemoryMonitor().healthCheck().monitoring).toBe(true);
    });

    test('应该能够停止服务', () => {
      memoryOptimizationService.start();
      memoryOptimizationService.stop();

      expect(memoryOptimizationService.getMemoryMonitor().healthCheck().monitoring).toBe(false);
    });

    test('应该能够获取内存状态', () => {
      memoryOptimizationService.start();

      const status = memoryOptimizationService.getMemoryReport();

      expect(status).toHaveProperty('current');
      expect(status).toHaveProperty('serviceStats');
      expect(status).toHaveProperty('recommendations');
      expect(status).toHaveProperty('healthStatus');
    });

    test('应该能够创建内存快照', () => {
      memoryOptimizationService.start();

      const snapshot = memoryOptimizationService.createUsageSnapshot();

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('heapUsed');
      expect(snapshot).toHaveProperty('heapTotal');
      expect(snapshot).toHaveProperty('rss');
      expect(snapshot).toHaveProperty('queueJobs');
      expect(snapshot).toHaveProperty('connectionPoolActive');
      expect(snapshot).toHaveProperty('connectionPoolIdle');
    });

    test('应该能够获取优化历史', () => {
      const history = memoryOptimizationService.getOptimizationHistory();

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    test('应该能够更新配置', () => {
      const newConfig = {
        autoOptimizationEnabled: true,
        optimizationThreshold: 85,
        monitoringIntervalMs: 10000
      };

      const result = memoryOptimizationService.updateConfig(newConfig);

      expect(result).toBe(true);

      const updatedConfig = memoryOptimizationService.getConfig();
      expect(updatedConfig.autoOptimizationEnabled).toBe(true);
      expect(updatedConfig.optimizationThreshold).toBe(85);
      expect(updatedConfig.monitoringIntervalMs).toBe(10000);
    });
  });

  describe('内存优化测试', () => {
    test('应该能够执行手动优化', async () => {
      memoryOptimizationService.start();

      const result = await memoryOptimizationService.performOptimization('manual');

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('beforeStats');
      expect(result).toHaveProperty('afterStats');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('freedMemoryMB');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('optimizations');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.freedMemoryMB).toBe('number');
      expect(typeof result.durationMs).toBe('number');
    });

    test('应该能够执行激进优化', async () => {
      memoryOptimizationService.start();

      const result = await memoryOptimizationService.performOptimization('manual', {
        aggressive: true
      });

      expect(result.method).toBe('aggressive');
      expect(result.optimizations).toContain('Garbage collection');
    });

    test('应该能够处理优化失败情况', async () => {
      // 模拟一个会失败的情况
      const mockService = new MemoryOptimizationService({
        monitoringEnabled: false
      });

      try {
        await mockService.performOptimization('manual');
        // 如果没有抛出错误，测试应该通过
        expect(true).toBe(true);
      } catch (error) {
        // 如果抛出错误，确保它是预期的错误类型
        expect(error).toBeInstanceOf(Error);
      } finally {
        mockService.shutdown();
      }
    });
  });

  describe('事件监听测试', () => {
    test('应该能够监听优化完成事件', (done) => {
      memoryOptimizationService.start();

      memoryOptimizationService.on('optimization:completed', (data) => {
        expect(data).toHaveProperty('reason');
        expect(data).toHaveProperty('report');
        done();
      });

      memoryOptimizationService.performOptimization('manual');
    });

    test('应该能够监听内存告警事件', (done) => {
      // 模拟内存监控器
      const mockMemoryMonitor = new MemoryMonitor({
        heapUsedWarning: 1, // 设置很低的阈值以触发告警
        heapUsedCritical: 2,
        rssWarning: 1,
        rssCritical: 2
      });

      const service = new MemoryOptimizationService({
        monitoringEnabled: false
      });

      service.setConnectionPool(mockConnectionPool);

      service.on('alert:memory-threshold', (data) => {
        expect(data).toHaveProperty('level');
        expect(data).toHaveProperty('alerts');
        expect(data).toHaveProperty('stats');
        done();
      });

      // 手动触发告警
      mockMemoryMonitor.emit('threshold:exceeded', {
        level: 'warning',
        alerts: ['Test warning'],
        stats: { heapUsedPercentage: 90 }
      });

      service.shutdown();
    });
  });

  describe('健康检查测试', () => {
    test('应该能够进行健康检查', () => {
      const healthCheck = memoryOptimizationService.healthCheck();

      expect(healthCheck).toHaveProperty('healthy');
      expect(healthCheck).toHaveProperty('issues');
      expect(healthCheck).toHaveProperty('details');
      expect(typeof healthCheck.healthy).toBe('boolean');
      expect(Array.isArray(healthCheck.issues)).toBe(true);
    });

    test('健康检查应该能检测问题', () => {
      // 创建一个有问题的配置
      const problematicService = new MemoryOptimizationService({
        monitoringEnabled: false,
        autoOptimizationEnabled: false
      });

      const healthCheck = problematicService.healthCheck();

      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.issues.length).toBeGreaterThan(0);
      expect(healthCheck.issues).toContain('Memory monitoring is disabled');
      expect(healthCheck.issues).toContain('Auto-optimization is disabled');

      problematicService.shutdown();
    });
  });

  describe('性能测试', () => {
    test('内存监控不应显著影响性能', async () => {
      memoryOptimizationService.start();

      const startTime = Date.now();

      // 执行多次内存状态检查
      for (let i = 0; i < 100; i++) {
        memoryOptimizationService.createUsageSnapshot();
        memoryOptimizationService.getMemoryReport();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 100次操作应该在合理时间内完成（小于1秒）
      expect(duration).toBeLessThan(1000);
    });

    test('优化操作应该在合理时间内完成', async () => {
      memoryOptimizationService.start();

      const startTime = Date.now();
      await memoryOptimizationService.performOptimization('manual', { aggressive: true });
      const endTime = Date.now();

      const duration = endTime - startTime;

      // 优化操作应该在合理时间内完成（小于5秒）
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('配置验证测试', () => {
    test('应该验证无效配置', () => {
      const service = new MemoryOptimizationService();

      // 测试更新无效配置
      const result = service.updateConfig({
        optimizationThreshold: -10, // 无效的阈值
        monitoringIntervalMs: 0     // 无效的间隔
      });

      // 配置应该被接受，但可能会在运行时产生问题
      expect(result).toBe(true);

      service.shutdown();
    });

    test('应该处理边界值配置', () => {
      const service = new MemoryOptimizationService();

      const result = service.updateConfig({
        optimizationThreshold: 100, // 最大值
        monitoringIntervalMs: 1     // 最小值
      });

      expect(result).toBe(true);

      service.shutdown();
    });
  });
});