/**
 * 会话性能监控工具
 * 用于监控和优化会话切换性能
 */

interface SessionPerformanceMetrics {
  sessionId: string;
  switchStartTime: number;
  switchEndTime?: number;
  switchDuration?: number;
  renderStartTime: number;
  renderEndTime?: number;
  renderDuration?: number;
  totalDuration?: number;
  cacheHit: boolean;
  messageCount: number;
  error?: string;
}

interface PerformanceStats {
  totalSwitches: number;
  averageSwitchTime: number;
  averageRenderTime: number;
  cacheHitRate: number;
  errorRate: number;
  fastestSwitch: SessionPerformanceMetrics | null;
  slowestSwitch: SessionPerformanceMetrics | null;
}

class SessionPerformanceMonitor {
  private metrics: Map<string, SessionPerformanceMetrics> = new Map();
  private performanceObserver: PerformanceObserver | null = null;

  constructor() {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver() {
    if (!window?.PerformanceObserver) {
      return;
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name.startsWith('session-switch-')) {
            const sessionId = entry.name.replace('session-switch-', '');
            const metric = this.metrics.get(sessionId);
            if (metric && entry.entryType === 'measure') {
              metric.switchEndTime = entry.startTime + entry.duration;
              metric.switchDuration = entry.duration;
              this.updateTotalDuration(sessionId);
            }
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  /**
   * 开始监控会话切换
   */
  startSessionSwitch(sessionId: string, messageCount: number, cacheHit: boolean = false) {
    const startTime = performance.now();
    const renderStartTime = performance.now();

    const metric: SessionPerformanceMetrics = {
      sessionId,
      switchStartTime: startTime,
      renderStartTime,
      messageCount,
      cacheHit,
    };

    this.metrics.set(sessionId, metric);

    // 开始性能测量
    try {
      performance.mark(`session-switch-start-${sessionId}`);
    } catch (error) {
      console.warn('Performance mark not supported:', error);
    }

    return {
      sessionId,
      startTime,
      renderStartTime,
    };
  }

  /**
   * 结束监控会话切换
   */
  endSessionSwitch(sessionId: string, error?: string) {
    const metric = this.metrics.get(sessionId);
    if (!metric) {
      console.warn(`No metric found for session ${sessionId}`);
      return;
    }

    const endTime = performance.now();
    metric.renderEndTime = endTime;
    metric.renderDuration = endTime - metric.renderStartTime;
    if (error !== undefined) {
      metric.error = error;
    }

    try {
      performance.mark(`session-switch-end-${sessionId}`);
      performance.measure(
        `session-switch-${sessionId}`,
        `session-switch-start-${sessionId}`,
        `session-switch-end-${sessionId}`,
      );
    } catch (markError) {
      console.warn('Performance measurement not supported:', markError);
    }

    this.updateTotalDuration(sessionId);
  }

  /**
   * 更新总持续时间
   */
  private updateTotalDuration(sessionId: string) {
    const metric = this.metrics.get(sessionId);
    if (metric?.switchEndTime && metric.renderEndTime) {
      metric.totalDuration = Math.max(
        metric.switchEndTime - metric.switchStartTime,
        metric.renderEndTime - metric.renderStartTime,
      );
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): PerformanceStats {
    const allMetrics = Array.from(this.metrics.values());
    const successfulMetrics = allMetrics.filter(m => !m.error);
    const totalSwitches = allMetrics.length;

    if (totalSwitches === 0) {
      return {
        totalSwitches: 0,
        averageSwitchTime: 0,
        averageRenderTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        fastestSwitch: null,
        slowestSwitch: null,
      };
    }

    const validSwitchTimes = successfulMetrics
      .map(m => m.switchDuration)
      .filter((d): d is number => d !== undefined);

    const validRenderTimes = successfulMetrics
      .map(m => m.renderDuration)
      .filter((d): d is number => d !== undefined);

    const cacheHits = successfulMetrics.filter(m => m.cacheHit).length;

    const stats: PerformanceStats = {
      totalSwitches,
      averageSwitchTime: validSwitchTimes.length > 0
        ? validSwitchTimes.reduce((sum, time) => sum + time, 0) / validSwitchTimes.length
        : 0,
      averageRenderTime: validRenderTimes.length > 0
        ? validRenderTimes.reduce((sum, time) => sum + time, 0) / validRenderTimes.length
        : 0,
      cacheHitRate: cacheHits / successfulMetrics.length,
      errorRate: (totalSwitches - successfulMetrics.length) / totalSwitches,
      fastestSwitch: null,
      slowestSwitch: null,
    };

    // 找出最快和最慢的切换
    if (validSwitchTimes.length > 0) {
      stats.fastestSwitch = successfulMetrics.reduce((fastest, current) => {
        const fastestTime = fastest.switchDuration || Infinity;
        const currentTime = current.switchDuration || Infinity;
        return currentTime < fastestTime ? current : fastest;
      });

      stats.slowestSwitch = successfulMetrics.reduce((slowest, current) => {
        const slowestTime = slowest.switchDuration || 0;
        const currentTime = current.switchDuration || 0;
        return currentTime > slowestTime ? current : slowest;
      });
    }

    return stats;
  }

  /**
   * 获取指定会话的性能指标
   */
  getSessionMetrics(sessionId: string): SessionPerformanceMetrics | null {
    return this.metrics.get(sessionId) || null;
  }

  /**
   * 清除性能数据
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    const stats = this.getPerformanceStats();
    const allMetrics = Array.from(this.metrics.values());

    let report = '📊 会话切换性能报告\n';
    report += '='.repeat(50) + '\n\n';
    report += `📈 总切换次数: ${stats.totalSwitches}\n`;
    report += `⚡ 平均切换时间: ${stats.averageSwitchTime.toFixed(2)}ms\n`;
    report += `🎨 平均渲染时间: ${stats.averageRenderTime.toFixed(2)}ms\n`;
    report += `💾 缓存命中率: ${(stats.cacheHitRate * 100).toFixed(1)}%\n`;
    report += `❌ 错误率: ${(stats.errorRate * 100).toFixed(1)}%\n\n`;

    if (stats.fastestSwitch) {
      report += `🚀 最快切换: ${stats.fastestSwitch.sessionId} (${stats.fastestSwitch.switchDuration?.toFixed(2)}ms)\n`;
    }

    if (stats.slowestSwitch) {
      report += `🐌 最慢切换: ${stats.slowestSwitch.sessionId} (${stats.slowestSwitch.switchDuration?.toFixed(2)}ms)\n`;
    }

    report += '\n📋 详细指标:\n';
    allMetrics.slice(0, 10).forEach((metric, index) => {
      report += `${index + 1}. ${metric.sessionId}\n`;
      report += `   切换时间: ${metric.switchDuration?.toFixed(2) || 'N/A'}ms\n`;
      report += `   渲染时间: ${metric.renderDuration?.toFixed(2) || 'N/A'}ms\n`;
      report += `   缓存命中: ${metric.cacheHit ? '是' : '否'}\n`;
      report += `   消息数量: ${metric.messageCount}\n`;
      if (metric.error) {
        report += `   错误: ${metric.error}\n`;
      }
      report += '\n';
    });

    if (allMetrics.length > 10) {
      report += `... 还有 ${allMetrics.length - 10} 个会话\n`;
    }

    return report;
  }

  /**
   * 分析性能瓶颈
   */
  analyzePerformanceBottlenecks(): {
    issues: string[];
    recommendations: string[];
    } {
    const stats = this.getPerformanceStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 分析平均切换时间
    if (stats.averageSwitchTime > 200) {
      issues.push(`平均切换时间过长: ${stats.averageSwitchTime.toFixed(2)}ms`);
      recommendations.push('考虑启用会话预加载和缓存优化');
    }

    // 分析缓存命中率
    if (stats.cacheHitRate < 0.5) {
      issues.push(`缓存命中率过低: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
      recommendations.push('增加预加载会话数量或优化缓存策略');
    }

    // 分析错误率
    if (stats.errorRate > 0.1) {
      issues.push(`错误率过高: ${(stats.errorRate * 100).toFixed(1)}%`);
      recommendations.push('检查会话数据获取逻辑，增加错误处理');
    }

    // 分析渲染时间
    if (stats.averageRenderTime > 100) {
      issues.push(`平均渲染时间过长: ${stats.averageRenderTime.toFixed(2)}ms`);
      recommendations.push('优化消息列表渲染，考虑虚拟滚动');
    }

    // 分析最慢的会话
    if (stats.slowestSwitch?.switchDuration && stats.slowestSwitch.switchDuration > 500) {
      issues.push(`存在非常慢的会话切换: ${stats.slowestSwitch.sessionId}`);
      recommendations.push('检查大消息会话的优化处理');
    }

    return { issues, recommendations };
  }

  /**
   * 销毁性能监控器
   */
  destroy() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    this.clearMetrics();
  }
}

// 单例模式
let performanceMonitorInstance: SessionPerformanceMonitor | null = null;

export const getSessionPerformanceMonitor = (): SessionPerformanceMonitor => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new SessionPerformanceMonitor();
  }
  return performanceMonitorInstance;
};

// 开发模式下自动输出性能报告
if (process.env.NODE_ENV === 'development') {
  // 每隔30秒输出一次性能报告
  setInterval(() => {
    const monitor = getSessionPerformanceMonitor();
    const report = monitor.getPerformanceReport();
    console.log(report);
  }, 30000);
}