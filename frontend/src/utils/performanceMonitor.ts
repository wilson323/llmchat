/**
 * 性能监控工具
 * 
 * 用于测量和分析关键操作的性能指标
 * 支持统计分析（min/max/avg/p50/p95/p99）
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  total: number;
}

class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private enabled: boolean;
  private maxSamplesPerMetric: number;

  constructor(options?: { enabled?: boolean; maxSamplesPerMetric?: number }) {
    this.enabled = options?.enabled ?? process.env.NODE_ENV === 'development';
    this.maxSamplesPerMetric = options?.maxSamplesPerMetric ?? 1000;
  }

  /**
   * 测量同步操作的执行时间
   */
  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.record(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration);
      throw error;
    }
  }

  /**
   * 测量异步操作的执行时间
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.record(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration);
      throw error;
    }
  }

  /**
   * 手动记录性能数据
   */
  record(name: string, duration: number): void {
    if (!this.enabled) {
      return;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const samples = this.metrics.get(name)!;
    samples.push(duration);

    // 限制样本数量，避免内存泄漏
    if (samples.length > this.maxSamplesPerMetric) {
      samples.shift();
    }
  }

  /**
   * 开始计时（手动控制）
   */
  start(name: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.record(name, duration);
    };
  }

  /**
   * 获取指定指标的统计数据
   */
  getStats(name: string): PerformanceStats | null {
    const samples = this.metrics.get(name);
    if (!samples || samples.length === 0) {
      return null;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, val) => acc + val, 0);

    return {
      count: samples.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / samples.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      total: sum,
    };
  }

  /**
   * 获取所有指标的统计数据
   */
  getAllStats(): Map<string, PerformanceStats> {
    const allStats = new Map<string, PerformanceStats>();
    
    this.metrics.forEach((_, name) => {
      const stats = this.getStats(name);
      if (stats) {
        allStats.set(name, stats);
      }
    });

    return allStats;
  }

  /**
   * 导出性能报告（Markdown格式）
   */
  exportReport(): string {
    const lines: string[] = [];
    lines.push('# Performance Monitoring Report\n');
    lines.push(`Generated at: ${new Date().toLocaleString()}\n`);

    const allStats = this.getAllStats();
    if (allStats.size === 0) {
      lines.push('No performance data collected.\n');
      return lines.join('\n');
    }

    // 按平均耗时排序
    const sortedEntries = Array.from(allStats.entries()).sort(
      (a, b) => b[1].avg - a[1].avg
    );

    lines.push('## Summary Table\n');
    lines.push('| Metric | Count | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Min (ms) | Max (ms) |');
    lines.push('|--------|-------|----------|----------|----------|----------|----------|----------|');

    sortedEntries.forEach(([name, stats]) => {
      lines.push(
        `| ${name} | ${stats.count} | ${stats.avg.toFixed(2)} | ${stats.p50.toFixed(2)} | ${stats.p95.toFixed(2)} | ${stats.p99.toFixed(2)} | ${stats.min.toFixed(2)} | ${stats.max.toFixed(2)} |`
      );
    });

    lines.push('\n## Detailed Metrics\n');

    sortedEntries.forEach(([name, stats]) => {
      lines.push(`### ${name}\n`);
      lines.push(`- **Samples**: ${stats.count}`);
      lines.push(`- **Total Time**: ${stats.total.toFixed(2)}ms`);
      lines.push(`- **Average**: ${stats.avg.toFixed(2)}ms`);
      lines.push(`- **Median (P50)**: ${stats.p50.toFixed(2)}ms`);
      lines.push(`- **P95**: ${stats.p95.toFixed(2)}ms`);
      lines.push(`- **P99**: ${stats.p99.toFixed(2)}ms`);
      lines.push(`- **Min**: ${stats.min.toFixed(2)}ms`);
      lines.push(`- **Max**: ${stats.max.toFixed(2)}ms\n`);
    });

    return lines.join('\n');
  }

  /**
   * 导出JSON格式报告
   */
  exportJSON(): string {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.getAllStats()),
    };
    return JSON.stringify(report, null, 2);
  }

  /**
   * 清除指定指标的数据
   */
  clear(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * 清除所有指标数据
   */
  clearAll(): void {
    this.metrics.clear();
  }

  /**
   * 启用/禁用监控
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取原始样本数据（用于高级分析）
   */
  getRawSamples(name: string): number[] | undefined {
    return this.metrics.get(name);
  }
}

// 导出全局单例
export const perfMonitor = new PerformanceMonitor({
  enabled: process.env.NODE_ENV === 'development',
  maxSamplesPerMetric: 1000,
});

// 开发环境自动打印报告
if (process.env.NODE_ENV === 'development') {
  // 每60秒打印一次性能报告
  setInterval(() => {
    const stats = perfMonitor.getAllStats();
    if (stats.size > 0) {
      console.group('📊 Performance Report');
      console.log(perfMonitor.exportReport());
      console.groupEnd();
    }
  }, 60000);

  // 暴露到 window 对象，方便调试
  if (typeof window !== 'undefined') {
    (window as any).__perfMonitor = perfMonitor;
    console.log('💡 Performance Monitor available at window.__perfMonitor');
  }
}

export default perfMonitor;

