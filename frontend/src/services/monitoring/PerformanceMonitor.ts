/**
 * 性能监控器
 * 监控混合存储架构的性能指标和优化建议
 */

import {
  IPerformanceMonitor,
  PerformanceReport,
  StorageMetrics,
  SyncMetrics,
  PerformanceAlert,
  OptimizationSuggestion,
  StorageTier
} from '@/types/hybrid-storage';

interface PerformanceData {
  accessTime: number;
  operation: string;
  tier: StorageTier;
  success: boolean;
  dataSize?: number;
  timestamp: number;
}

interface SyncData {
  operation: string;
  duration: number;
  success: boolean;
  dataSize?: number;
  timestamp: number;
}

interface EvictionData {
  key: string;
  reason: string;
  tier: StorageTier;
  timestamp: number;
}

export class PerformanceMonitor implements IPerformanceMonitor {
  private accessHistory: PerformanceData[] = [];
  private syncHistory: SyncData[] = [];
  private evictionHistory: EvictionData[] = [];
  private alertCallbacks = new Set<(alert: PerformanceAlert) => void>();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private maxHistorySize = 10000;

  // 性能阈值
  private thresholds = {
    memoryAccessTime: 10, // 10ms
    indexedDBAccessTime: 100, // 100ms
    fastgptAccessTime: 2000, // 2s
    errorRate: 0.05, // 5%
    cacheHitRate: 0.7, // 70%
    syncDuration: 30000, // 30s
    storageUsage: 0.8 // 80%
  };

  constructor() {
    this.setupErrorHandling();
  }

  // ==================== 数据收集 ====================

  recordAccess(_key: string, tier: StorageTier, duration: number, hit: boolean, dataSize?: number): void {
    if (!this.isMonitoring) return;

    try {
      const data: PerformanceData = {
        accessTime: duration,
        operation: hit ? 'read_hit' : 'read_miss',
        tier,
        success: true,
        dataSize,
        timestamp: Date.now()
      };

      this.addToHistory(this.accessHistory, data);
      this.checkAccessThresholds(data);

    } catch (error) {
      console.error('记录访问数据失败:', error);
    }
  }

  recordSync(operation: string, duration: number, success: boolean, dataSize?: number): void {
    if (!this.isMonitoring) return;

    try {
      const data: SyncData = {
        operation,
        duration,
        success,
        dataSize,
        timestamp: Date.now()
      };

      this.addToHistory(this.syncHistory, data);
      this.checkSyncThresholds(data);

    } catch (error) {
      console.error('记录同步数据失败:', error);
    }
  }

  recordCacheEviction(key: string, reason: string, tier: StorageTier): void {
    if (!this.isMonitoring) return;

    try {
      const data: EvictionData = {
        key,
        reason,
        tier,
        timestamp: Date.now()
      };

      this.addToHistory(this.evictionHistory, data);
      this.checkEvictionThresholds(data);

    } catch (error) {
      console.error('记录缓存清理失败:', error);
    }
  }

  // ==================== 统计报告 ====================

  async getPerformanceReport(): Promise<PerformanceReport> {
    try {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const storage = await this.calculateStorageMetrics(oneHourAgo);
      const sync = this.calculateSyncMetrics(oneHourAgo);
      const cache = await this.calculateCacheMetrics();
      const alerts = this.getActiveAlerts();
      const suggestions = await this.generateOptimizationSuggestions(storage, sync, cache);

      return {
        generatedAt: now,
        period: { start: oneHourAgo, end: now },
        storage,
        sync,
        cache,
        alerts,
        suggestions
      };

    } catch (error) {
      console.error('生成性能报告失败:', error);
      return this.getDefaultReport();
    }
  }

  async getStorageMetrics(): Promise<StorageMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    return this.calculateStorageMetrics(oneHourAgo);
  }

  getSyncMetrics(): Promise<SyncMetrics> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    return Promise.resolve(this.calculateSyncMetrics(oneHourAgo));
  }

  // ==================== 实时监控 ====================

  startRealTimeMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('性能监控已启动');

    // 定期检查性能
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // 每分钟检查一次
  }

  stopRealTimeMonitoring(): void {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('性能监控已停止');
  }

  onPerformanceAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }

  // ==================== 优化建议 ====================

  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    try {
      const storage = await this.getStorageMetrics();
      const sync = await this.getSyncMetrics();
      const cache = await this.calculateCacheMetrics();

      return await this.generateOptimizationSuggestions(storage, sync, cache);
    } catch (error) {
      console.error('获取优化建议失败:', error);
      return [];
    }
  }

  // ==================== 私有方法 ====================

  private setupErrorHandling(): void {
    // 捕获未处理的错误
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.recordError('javascript_error', event.error?.message || '未知错误');
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.recordError('promise_rejection', event.reason?.message || 'Promise拒绝');
      });
    }
  }

  private recordError(type: string, message: string): void {
    console.error(`性能监控错误 [${type}]:`, message);
    // 可以发送到错误收集服务
  }

  private addToHistory<T>(history: T[], data: T): void {
    history.push(data);

    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  private checkAccessThresholds(data: PerformanceData): void {
    const thresholds = this.getThresholdsForTier(data.tier);

    if (data.accessTime > thresholds.maxAccessTime) {
      this.createAlert('warning', 'slow_access', data.accessTime, thresholds.maxAccessTime,
        `${data.tier}访问时间过慢: ${data.accessTime.toFixed(2)}ms`,
        ['优化查询索引', '减少数据传输量', '检查网络连接']);
    }

    if (!data.success) {
      this.createAlert('error', 'access_failure', 1, 0,
        `${data.tier}访问失败`,
        ['检查存储提供者状态', '验证数据格式', '重试操作']);
    }
  }

  private checkSyncThresholds(data: SyncData): void {
    if (data.duration > this.thresholds.syncDuration) {
      this.createAlert('warning', 'slow_sync', data.duration, this.thresholds.syncDuration,
        `同步操作过慢: ${data.duration}ms`,
        ['减少同步数据量', '优化网络请求', '检查远程服务状态']);
    }

    if (!data.success) {
      this.createAlert('error', 'sync_failure', 1, 0,
        `同步操作失败: ${data.operation}`,
        ['检查网络连接', '验证认证信息', '重试同步操作']);
    }
  }

  private checkEvictionThresholds(_data: EvictionData): void {
    // 如果短时间内大量清理，可能是缓存配置问题
    const recentEvictions = this.evictionHistory.filter(
      e => e.timestamp > Date.now() - 60000 // 最近1分钟
    );

    if (recentEvictions.length > 100) {
      this.createAlert('warning', 'excessive_eviction', recentEvictions.length, 50,
        `缓存清理过于频繁: ${recentEvictions.length}次/分钟`,
        ['增加缓存大小', '优化缓存策略', '减少数据大小']);
    }
  }

  private getThresholdsForTier(tier: StorageTier): { maxAccessTime: number } {
    switch (tier) {
      case StorageTier.MEMORY:
        return { maxAccessTime: this.thresholds.memoryAccessTime };
      case StorageTier.INDEXED_DB:
        return { maxAccessTime: this.thresholds.indexedDBAccessTime };
      case StorageTier.FASTGPT_REMOTE:
        return { maxAccessTime: this.thresholds.fastgptAccessTime };
      default:
        return { maxAccessTime: 1000 };
    }
  }

  private createAlert(
    type: 'warning' | 'error' | 'critical',
    metric: string,
    value: number,
    threshold: number,
    message: string,
    suggestions: string[]
  ): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      message,
      timestamp: Date.now(),
      suggestions
    };

    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('性能告警回调失败:', error);
      }
    });
  }

  private async calculateStorageMetrics(since: number): Promise<StorageMetrics> {
    const recentAccess = this.accessHistory.filter(data => data.timestamp >= since);

    const memoryAccess = recentAccess.filter(data => data.tier === StorageTier.MEMORY);
    const indexedDBAccess = recentAccess.filter(data => data.tier === StorageTier.INDEXED_DB);
    const fastgptAccess = recentAccess.filter(data => data.tier === StorageTier.FASTGPT_REMOTE);

    return {
      memory: this.calculateMemoryMetrics(memoryAccess),
      indexedDB: this.calculateIndexedDBMetrics(indexedDBAccess),
      fastgpt: this.calculateFastgptMetrics(fastgptAccess)
    };
  }

  private calculateMemoryMetrics(accessData: PerformanceData[]): {
    hitRate: number;
    averageResponseTime: number;
    totalOperations: number;
    errorRate: number;
  } {
    const totalOps = accessData.length;
    const successfulOps = accessData.filter(data => data.success).length;
    const hitOps = accessData.filter(data => data.operation === 'read_hit').length;

    const averageTime = totalOps > 0
      ? accessData.reduce((sum, data) => sum + data.accessTime, 0) / totalOps
      : 0;

    return {
      hitRate: totalOps > 0 ? hitOps / totalOps : 0,
      averageResponseTime: averageTime,
      totalOperations: totalOps,
      errorRate: totalOps > 0 ? (totalOps - successfulOps) / totalOps : 0
    };
  }

  private calculateIndexedDBMetrics(accessData: PerformanceData[]): {
    hitRate: number;
    averageResponseTime: number;
    totalOperations: number;
    errorRate: number;
    size: number;
    entryCount: number;
  } {
    const totalOps = accessData.length;
    const successfulOps = accessData.filter(data => data.success).length;
    const hitOps = accessData.filter(data => data.operation === 'read_hit').length;

    const averageTime = totalOps > 0
      ? accessData.reduce((sum, data) => sum + data.accessTime, 0) / totalOps
      : 0;

    const totalSize = accessData.reduce((sum, data) => sum + (data.dataSize || 0), 0);

    return {
      hitRate: totalOps > 0 ? hitOps / totalOps : 0,
      averageResponseTime: averageTime,
      totalOperations: totalOps,
      errorRate: totalOps > 0 ? (totalOps - successfulOps) / totalOps : 0,
      size: totalSize,
      entryCount: accessData.length
    };
  }

  private calculateFastgptMetrics(accessData: PerformanceData[]): {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    bandwidthUsed: number;
    cacheHitRate: number;
  } {
    const totalOps = accessData.length;
    const successfulOps = accessData.filter(data => data.success).length;
    const hitOps = accessData.filter(data => data.operation === 'read_hit').length;

    const averageTime = totalOps > 0
      ? accessData.reduce((sum, data) => sum + data.accessTime, 0) / totalOps
      : 0;

    const totalSize = accessData.reduce((sum, data) => sum + (data.dataSize || 0), 0);

    return {
      averageResponseTime: averageTime,
      totalRequests: totalOps,
      errorRate: totalOps > 0 ? (totalOps - successfulOps) / totalOps : 0,
      bandwidthUsed: totalSize,
      cacheHitRate: totalOps > 0 ? hitOps / totalOps : 0
    };
  }

  private calculateSyncMetrics(since: number): SyncMetrics {
    const recentSync = this.syncHistory.filter(data => data.timestamp >= since);
    const successfulSync = recentSync.filter(data => data.success);

    return {
      totalSyncs: recentSync.length,
      successRate: recentSync.length > 0 ? successfulSync.length / recentSync.length : 0,
      averageDuration: successfulSync.length > 0
        ? successfulSync.reduce((sum, data) => sum + data.duration, 0) / successfulSync.length
        : 0,
      conflictRate: 0, // 需要从同步管理器获取
      dataTransferred: recentSync.reduce((sum, data) => sum + (data.dataSize || 0), 0),
      lastSyncTime: recentSync.length > 0 ? Math.max(...recentSync.map(d => d.timestamp)) : 0,
      pendingOperations: 0 // 需要从同步管理器获取
    };
  }

  private async calculateCacheMetrics(): Promise<any> {
    // 这里应该从缓存管理器获取实际数据
    // 简化实现，返回估算值
    return {
      memoryUsage: {
        total: 50 * 1024 * 1024,
        used: 20 * 1024 * 1024,
        free: 30 * 1024 * 1024,
        percentage: 40
      },
      indexedDBUsage: {
        total: 100 * 1024 * 1024,
        used: 30 * 1024 * 1024,
        free: 70 * 1024 * 1024,
        percentage: 30
      },
      cacheEntries: {
        hot: 100,
        warm: 500,
        cold: 200,
        total: 800
      },
      performance: {
        hitRate: 0.75,
        averageResponseTime: 15,
        evictionRate: 0.02
      }
    };
  }

  private getActiveAlerts(): PerformanceAlert[] {
    // 基于当前数据生成活跃告警
    const alerts: PerformanceAlert[] = [];

    // 检查最近的错误率
    const recentAccess = this.accessHistory.filter(
      data => data.timestamp > Date.now() - 300000 // 最近5分钟
    );

    if (recentAccess.length > 0) {
      const errorRate = recentAccess.filter(data => !data.success).length / recentAccess.length;
      if (errorRate > this.thresholds.errorRate) {
        alerts.push({
          type: 'warning',
          metric: 'error_rate',
          value: errorRate,
          threshold: this.thresholds.errorRate,
          message: `错误率过高: ${(errorRate * 100).toFixed(1)}%`,
          timestamp: Date.now(),
          suggestions: ['检查存储提供者状态', '验证网络连接', '查看错误日志']
        });
      }
    }

    return alerts;
  }

  private async generateOptimizationSuggestions(
    storage: StorageMetrics,
    sync: SyncMetrics,
    cache: any
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // 存储优化建议
    if (storage.memory.averageResponseTime > this.thresholds.memoryAccessTime) {
      suggestions.push({
        category: 'cache',
        priority: 'high',
        title: '优化内存缓存性能',
        description: '内存访问时间过慢，影响用户体验',
        expectedImpact: '减少50%的访问时间',
        implementation: '增加内存缓存大小，优化数据结构，减少序列化开销'
      });
    }

    if (cache.memoryUsage.percentage > this.thresholds.storageUsage) {
      suggestions.push({
        category: 'cache',
        priority: 'medium',
        title: '优化内存使用',
        description: '内存使用率过高，可能导致性能问题',
        expectedImpact: '降低30%内存使用',
        implementation: '清理过期数据，压缩存储内容，调整缓存策略'
      });
    }

    // 同步优化建议
    if (sync.averageDuration > this.thresholds.syncDuration) {
      suggestions.push({
        category: 'sync',
        priority: 'high',
        title: '优化同步性能',
        description: '同步操作耗时过长，影响数据一致性',
        expectedImpact: '减少60%同步时间',
        implementation: '启用增量同步，压缩传输数据，优化网络请求'
      });
    }

    if (sync.successRate < 0.9) {
      suggestions.push({
        category: 'sync',
        priority: 'critical',
        title: '提高同步成功率',
        description: '同步失败率过高，影响数据可用性',
        expectedImpact: '提升到99%成功率',
        implementation: '增加重试机制，改进错误处理，优化网络策略'
      });
    }

    return suggestions;
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const report = await this.getPerformanceReport();

      // 检查关键指标
      if (report.storage.memory.errorRate > 0.1) {
        console.warn('内存存储错误率过高:', report.storage.memory.errorRate);
      }

      if (report.sync.successRate < 0.8) {
        console.warn('同步成功率过低:', report.sync.successRate);
      }

      if (report.cache.performance.hitRate < 0.5) {
        console.warn('缓存命中率过低:', report.cache.performance.hitRate);
      }

    } catch (error) {
      console.error('健康检查失败:', error);
    }
  }

  private getDefaultReport(): PerformanceReport {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    return {
      generatedAt: now,
      period: { start: oneHourAgo, end: now },
      storage: {
        memory: { hitRate: 0, averageResponseTime: 0, totalOperations: 0, errorRate: 0 },
        indexedDB: { hitRate: 0, averageResponseTime: 0, totalOperations: 0, errorRate: 0, size: 0, entryCount: 0 },
        fastgpt: { averageResponseTime: 0, totalRequests: 0, errorRate: 0, bandwidthUsed: 0, cacheHitRate: 0 }
      },
      sync: {
        totalSyncs: 0,
        successRate: 0,
        averageDuration: 0,
        conflictRate: 0,
        dataTransferred: 0,
        lastSyncTime: 0,
        pendingOperations: 0
      },
      cache: {
        memoryUsage: { total: 0, used: 0, free: 0, percentage: 0 },
        indexedDBUsage: { total: 0, used: 0, free: 0, percentage: 0 },
        cacheEntries: { hot: 0, warm: 0, cold: 0, total: 0 },
        performance: { hitRate: 0, averageResponseTime: 0, evictionRate: 0 }
      },
      alerts: [],
      suggestions: []
    };
  }

  // ==================== 公共工具方法 ====================

  /**
   * 更新性能阈值
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * 清除历史数据
   */
  clearHistory(): void {
    this.accessHistory.length = 0;
    this.syncHistory.length = 0;
    this.evictionHistory.length = 0;
  }

  /**
   * 获取当前配置
   */
  getThresholds() {
    return { ...this.thresholds };
  }

  /**
   * 导出性能数据
   */
  exportData() {
    return {
      accessHistory: [...this.accessHistory],
      syncHistory: [...this.syncHistory],
      evictionHistory: [...this.evictionHistory],
      thresholds: this.getThresholds()
    };
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopRealTimeMonitoring();
    this.clearHistory();
    this.alertCallbacks.clear();
  }
}