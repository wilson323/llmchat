/**
 * 前端性能优化器
 * 负责监控和优化前端资源使用
 */

import React from 'react';

// 内存使用监控
class MemoryMonitor {
  private observers: Set<(data: { memory: number; trend: string }) => void> = new Set();
  private memoryHistory: Array<{ timestamp: number; memory: number }> = [];
  private maxHistorySize = 100;
  private isMonitoring = false;

  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.collectMemoryData();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.observers.clear();
  }

  addMemoryObserver(observer: (data: { memory: number; trend: string }) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  private collectMemoryData(): void {
    if (!this.isMonitoring) return;

    // 延迟收集以避免阻塞主线程
    setTimeout(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory.usedJSHeapSize;
        this.memoryHistory.push({
          timestamp: Date.now(),
          memory,
        });

        // 保持历史记录在合理范围内
        if (this.memoryHistory.length > this.maxHistorySize) {
          this.memoryHistory.shift();
        }

        // 计算趋势
        const trend = this.calculateTrend();

        // 通知观察者
        this.observers.forEach(observer => {
          observer({ memory, trend });
        });
      }

      this.collectMemoryData();
    }, 1000); // 每秒收集一次
  }

  private calculateTrend(): string {
    if (this.memoryHistory.length < 3) return 'stable';

    const recent = this.memoryHistory.slice(-3);
    const differences = recent.map((item, index) =>
      index > 0 ? item.memory - recent[index - 1].memory : 0
    );

    const avgDiff = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;

    if (avgDiff > 10 * 1024 * 1024) return 'increasing';
    if (avgDiff < -10 * 1024 * 1024) return 'decreasing';
    return 'stable';
  }

  getMemoryStats() {
    if (this.memoryHistory.length === 0) return null;

    const latest = this.memoryHistory[this.memoryHistory.length - 1];

    return {
      current: latest.memory,
      average: this.memoryHistory.reduce((sum, item) => sum + item.memory, 0) / this.memoryHistory.length,
      peak: Math.max(...this.memoryHistory.map(item => item.memory)),
      trend: this.calculateTrend(),
      historySize: this.memoryHistory.length,
    };
  }
}

// React组件性能监控
class ComponentPerformanceMonitor {
  private componentRenders = new Map<string, number>();
  private renderTimes = new Map<string, number[]>();
  private componentMounts = new Set<string>();

  recordRender(componentName: string, renderTime: number): void {
    this.componentRenders.set(componentName, (this.componentRenders.get(componentName) || 0) + 1);

    if (!this.renderTimes.has(componentName)) {
      this.renderTimes.set(componentName, []);
    }

    const times = this.renderTimes.get(componentName)!;
    times.push(renderTime);

    // 只保留最近20次渲染时间
    if (times.length > 20) {
      times.shift();
    }
  }

  recordMount(componentName: string): void {
    this.componentMounts.add(componentName);
  }

  recordUnmount(componentName: string): void {
    this.componentMounts.delete(componentName);
  }

  getComponentStats(componentName: string) {
    const renders = this.componentRenders.get(componentName) || 0;
    const times = this.renderTimes.get(componentName) || [];

    if (times.length === 0) return null;

    return {
      renders,
      averageRenderTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      maxRenderTime: Math.max(...times),
      minRenderTime: Math.min(...times),
      isMounted: this.componentMounts.has(componentName),
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};

    for (const [name] of this.componentRenders.entries()) {
      stats[name] = this.getComponentStats(name);
    }

    return stats;
  }
}

// 请求性能监控
class RequestPerformanceMonitor {
  private requests = new Map<string, { startTime: number; endTime?: number }>();
  private completedRequests = new Array<{ url: string; method: string; duration: number; status: number; timestamp: number }>();
  private maxHistory = 50;

  startRequest(id: string): void {
    this.requests.set(id, { startTime: Date.now() });
  }

  endRequest(id: string, method: string, status: number): void {
    const request = this.requests.get(id);
    if (request && !request.endTime) {
      request.endTime = Date.now();
      const duration = request.endTime - request.startTime;

      this.completedRequests.push({
        url: id,
        method,
        duration,
        status,
        timestamp: Date.now(),
      });

      this.requests.delete(id);

      // 保持历史记录在合理范围内
      if (this.completedRequests.length > this.maxHistory) {
        this.completedRequests.shift();
      }
    }
  }

  getRequestStats() {
    if (this.completedRequests.length === 0) return null;

    const durations = this.completedRequests.map(req => req.duration);
    const sortedDurations = [...durations].sort((a, b) => a - b);

    return {
      totalRequests: this.completedRequests.length,
      averageDuration: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      minDuration: sortedDurations[0],
      maxDuration: sortedDurations[sortedDurations.length - 1],
      medianDuration: sortedDurations[Math.floor(sortedDurations.length / 2)],
      slowestRequests: this.completedRequests
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      activeRequests: this.requests.size,
    };
  }
}

// 资源清理管理器
class ResourceManager {
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener; remove: () => void }> = [];
  private observers: Set<MutationObserver> = new Set();

  addTimeout(timeout: NodeJS.Timeout): NodeJS.Timeout {
    this.timeouts.add(timeout);
    return timeout;
  }

  clearTimeout(timeout: NodeJS.Timeout): void {
    this.timeouts.delete(timeout);
    clearTimeout(timeout);
  }

  addInterval(interval: NodeJS.Timeout): NodeJS.Timeout {
    this.intervals.add(interval);
    return interval;
  }

  clearInterval(interval: NodeJS.Timeout): void {
    this.intervals.delete(interval);
    clearInterval(interval);
  }

  addEventListener<T extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    event: T,
    handler: (event: HTMLElementEventMap[T]) => any
  ): () => void {
    element.addEventListener(event, handler as EventListener);
    const remove = () => element.removeEventListener(event, handler as EventListener);
    this.eventListeners.push({ element, event: event as string, handler: handler as EventListener, remove });
    return remove;
  }

  addObserver(observer: MutationObserver): MutationObserver {
    this.observers.add(observer);
    return observer;
  }

  disconnectObserver(observer: MutationObserver): void {
    this.observers.delete(observer);
    observer.disconnect();
  }

  cleanup(): void {
    // 清理所有定时器
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // 清理所有事件监听器
    this.eventListeners.forEach(({ remove }) => remove());
    this.eventListeners.length = 0;

    // 断开所有观察器
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// 导出单例实例
export const memoryMonitor = new MemoryMonitor();
export const componentMonitor = new ComponentPerformanceMonitor();
export const requestMonitor = new RequestPerformanceMonitor();
export const resourceManager = new ResourceManager();

// 组件性能监控Hook
export const usePerformanceMonitor = (componentName: string) => {
  React.useEffect(() => {
    componentMonitor.recordMount(componentName);

    return () => {
      componentMonitor.recordUnmount(componentName);
    };
  }, [componentName]);
};

// 性能优化装饰器
export const withPerformanceMonitoring = <T extends Record<string, any>>(
  Component: React.ComponentType<T>
) => {
  const WrappedComponent = React.memo((props: T) => {
    const startTime = Date.now();

    React.useEffect(() => {
      const endTime = Date.now();
      componentMonitor.recordRender(Component.displayName || 'Unknown', endTime - startTime);
    });

    return <Component {...props} />;
  });

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName})`;
  return WrappedComponent;
};

export default {
  memoryMonitor,
  componentMonitor,
  requestMonitor,
  resourceManager,
  usePerformanceMonitor,
  withPerformanceMonitoring,
};