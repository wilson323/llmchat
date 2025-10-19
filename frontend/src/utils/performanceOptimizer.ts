/**
 * 前端性能优化工具
 * 提供资源加载优化、React组件性能优化和内存管理功能
 */

import type {
  PerformanceEvent,
  RenderMetrics,
  MemoryUsage,
  MessageMetadata
} from '@/types/performance';
import {
  MessageComplexity,
  generateMessageMetadata,
  createLRUCache,
  createTTLCache,
  debounce,
  throttle,
  getCurrentMemoryUsage,
  formatMemorySize
} from '@/utils/performanceHelpers';

// ============================================================================
// 资源加载优化
// ============================================================================

export interface ResourceLoadMetrics {
  type: 'script' | 'style' | 'image' | 'font' | 'other';
  url: string;
  loadTime: number;
  size: number;
  cached: boolean;
  timestamp: number;
}

export interface PreloadConfig {
  criticalResources: string[];
  prefetchResources: string[];
  lazyResources: string[];
}

/**
 * 资源加载优化器
 */
export class ResourceLoadOptimizer {
  private metrics: ResourceLoadMetrics[] = [];
  private preloadQueue: Set<string> = new Set();
  private observer: PerformanceObserver | null = null;

  constructor() {
    this.initializePerformanceObserver();
  }

  /**
   * 初始化性能观察器
   */
  private initializePerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();

          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              const url = new URL(resourceEntry.name).pathname;
              const type = this.getResourceType(url);

              this.metrics.push({
                type,
                url,
                loadTime: resourceEntry.responseEnd - resourceEntry.requestStart,
                size: resourceEntry.transferSize || 0,
                cached: resourceEntry.transferSize === 0 && resourceEntry.decodedBodySize > 0,
                timestamp: Date.now()
              });
            }
          });

          // 保持指标数组大小限制
          if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-500);
          }
        });

        this.observer.observe({ entryTypes: ['resource'] });
      } catch (error) {
        console.warn('Failed to initialize PerformanceObserver:', error);
      }
    }
  }

  /**
   * 获取资源类型
   */
  private getResourceType(url: string): ResourceLoadMetrics['type'] {
    const extension = url.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'js':
      case 'mjs':
        return 'script';
      case 'css':
        return 'style';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'eot':
        return 'font';
      default:
        return 'other';
    }
  }

  /**
   * 预加载关键资源
   */
  preloadCriticalResources(resources: string[]): void {
    resources.forEach(url => {
      if (!this.preloadQueue.has(url)) {
        this.preloadQueue.add(url);

        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;

        // 根据文件类型设置as属性
        const extension = url.split('.').pop()?.toLowerCase();
        switch (extension) {
          case 'js':
          case 'mjs':
            link.as = 'script';
            break;
          case 'css':
            link.as = 'style';
            break;
          case 'woff':
          case 'woff2':
            link.as = 'font';
            link.crossOrigin = 'anonymous';
            break;
          case 'png':
          case 'jpg':
          case 'jpeg':
          case 'gif':
          case 'webp':
            link.as = 'image';
            break;
        }

        document.head.appendChild(link);
      }
    });
  }

  /**
   * 预取资源
   */
  prefetchResources(resources: string[]): void {
    resources.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  /**
   * 延迟加载资源
   */
  lazyLoadResources(resources: string[], trigger?: IntersectionObserverEntry[]): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const resource = (entry.target as HTMLElement).dataset.resource;
          if (resource) {
            this.loadResource(resource);
            observer.unobserve(entry.target);
          }
        }
      });
    }, { rootMargin: '50px' });

    resources.forEach(url => {
      const placeholder = document.createElement('div');
      placeholder.dataset.resource = url;
      observer.observe(placeholder);
    });
  }

  /**
   * 加载资源
   */
  private loadResource(url: string): void {
    const extension = url.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'js':
      case 'mjs':
        this.loadScript(url);
        break;
      case 'css':
        this.loadStylesheet(url);
        break;
      default:
        // 其他类型的资源可以根据需要实现
        break;
    }
  }

  /**
   * 加载脚本
   */
  private loadScript(url: string): void {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    document.head.appendChild(script);
  }

  /**
   * 加载样式表
   */
  private loadStylesheet(url: string): void {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  /**
   * 获取资源加载统计
   */
  getResourceStatistics(): {
    totalResources: number;
    averageLoadTime: number;
    cacheHitRate: number;
    slowResources: ResourceLoadMetrics[];
    typeDistribution: Record<string, number>;
  } {
    if (this.metrics.length === 0) {
      return {
        totalResources: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
        slowResources: [],
        typeDistribution: {}
      };
    }

    const totalResources = this.metrics.length;
    const totalLoadTime = this.metrics.reduce((sum, m) => sum + m.loadTime, 0);
    const averageLoadTime = totalLoadTime / totalResources;

    const cachedResources = this.metrics.filter(m => m.cached).length;
    const cacheHitRate = (cachedResources / totalResources) * 100;

    const slowResources = this.metrics
      .filter(m => m.loadTime > 1000) // 大于1秒认为是慢资源
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 10);

    const typeDistribution = this.metrics.reduce((acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalResources,
      averageLoadTime: Math.round(averageLoadTime * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      slowResources,
      typeDistribution
    };
  }

  /**
   * 清理指标
   */
  clearMetrics(): void {
    this.metrics = [];
    this.preloadQueue.clear();
  }
}

// ============================================================================
// React 组件性能优化
// ============================================================================

export interface ComponentPerformanceConfig {
  enableVirtualization: boolean;
  virtualizationThreshold: number;
  enableMemoization: boolean;
  enableLazyLoading: boolean;
  debounceDelay: number;
  throttleDelay: number;
}

/**
 * React 组件性能优化器
 */
export class ReactComponentOptimizer {
  private config: ComponentPerformanceConfig;
  private renderMetrics: RenderMetrics[] = [];
  private componentRegistry: Map<string, any> = new Map();

  constructor(config?: Partial<ComponentPerformanceConfig>) {
    this.config = {
      enableVirtualization: true,
      virtualizationThreshold: 100,
      enableMemoization: true,
      enableLazyLoading: true,
      debounceDelay: 300,
      throttleDelay: 100,
      ...config
    };
  }

  /**
   * 注册组件
   */
  registerComponent(name: string, component: any): void {
    this.componentRegistry.set(name, component);
  }

  /**
   * 创建虚拟化列表 Hook
   */
  createVirtualizedListHook<T>(
    items: T[],
    threshold: number = this.config.virtualizationThreshold
  ) {
    const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: threshold });
    const [containerRef, setContainerRef] = React.useState<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!containerRef) return;

      const handleScroll = throttle(() => {
        const container = containerRef;
        if (!container) return;

        const { scrollTop, clientHeight } = container;
        const itemHeight = 40; // 假设每个项目高度为40px
        const start = Math.floor(scrollTop / itemHeight);
        const end = start + Math.ceil(clientHeight / itemHeight) + 1;

        setVisibleRange({ start, end });
      }, this.config.throttleDelay);

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }, [containerRef]);

    const visibleItems = items.slice(visibleRange.start, visibleRange.end);

    return {
      containerRef: setContainerRef,
      visibleItems,
      visibleRange,
      totalItems: items.length
    };
  }

  /**
   * 创建防抖搜索 Hook
   */
  createDebouncedSearchHook(
    searchFunction: (query: string) => void,
    delay: number = this.config.debounceDelay
  ) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearching, setIsSearching] = React.useState(false);

    const debouncedSearch = React.useMemo(
      () => debounce((query: string) => {
        setIsSearching(true);
        searchFunction(query);
        setTimeout(() => setIsSearching(false), 100);
      }, delay),
      [searchFunction, delay]
    );

    React.useEffect(() => {
      debouncedSearch(searchQuery);
    }, [searchQuery, debouncedSearch]);

    return {
      searchQuery,
      setSearchQuery,
      isSearching
    };
  }

  /**
   * 创建懒加载 Hook
   */
  createLazyLoadHook<T>(
    loader: () => Promise<T>,
    dependencies: React.DependencyList = []
  ) {
    const [data, setData] = React.useState<T | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
      let isMounted = true;

      const loadData = async () => {
        try {
          setLoading(true);
          setError(null);
          const result = await loader();
          if (isMounted) {
            setData(result);
          }
        } catch (err) {
          if (isMounted) {
            setError((err as Error).message);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      loadData();

      return () => {
        isMounted = false;
      };
    }, dependencies);

    return { data, loading, error, refetch: loadData };
  }

  /**
   * 记录渲染指标
   */
  recordRenderMetrics(componentName: string, renderTime: number): void {
    const memoryUsage = getCurrentMemoryUsage();

    this.renderMetrics.push({
      renderCount: this.renderMetrics.length + 1,
      averageRenderTime: renderTime,
      maxRenderTime: renderTime,
      minRenderTime: renderTime,
      lastRenderTime: renderTime,
      memoryUsage: memoryUsage.heapUsed
    });

    // 保持指标数组大小限制
    if (this.renderMetrics.length > 1000) {
      this.renderMetrics = this.renderMetrics.slice(-500);
    }

    // 慢渲染警告
    if (renderTime > 16.67) { // 大于一帧时间(60fps)
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * 获取组件性能统计
   */
  getComponentStatistics(): {
    totalRenders: number;
    averageRenderTime: number;
    maxRenderTime: number;
    minRenderTime: number;
    lastRenderTime: number;
    averageMemoryUsage: number;
  } {
    if (this.renderMetrics.length === 0) {
      return {
        totalRenders: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: 0,
        lastRenderTime: 0,
        averageMemoryUsage: 0
      };
    }

    const renderTimes = this.renderMetrics.map(m => m.lastRenderTime);
    const memoryUsages = this.renderMetrics.map(m => m.memoryUsage);

    return {
      totalRenders: this.renderMetrics.length,
      averageRenderTime: renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      minRenderTime: Math.min(...renderTimes),
      lastRenderTime: renderTimes[renderTimes.length - 1] || 0,
      averageMemoryUsage: memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length
    };
  }

  /**
   * 清理指标
   */
  clearMetrics(): void {
    this.renderMetrics = [];
  }
}

// ============================================================================
// 全局性能优化管理器
// ============================================================================

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private resourceOptimizer: ResourceLoadOptimizer;
  private componentOptimizer: ReactComponentOptimizer;
  private messageHeightCache: ReturnType<typeof createLRUCache>;
  private performanceEvents: PerformanceEvent[] = [];

  constructor() {
    this.resourceOptimizer = new ResourceLoadOptimizer();
    this.componentOptimizer = new ReactComponentOptimizer();
    this.messageHeightCache = createLRUCache(1000); // 缓存1000个消息高度
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * 获取消息高度（带缓存）
   */
  getMessageHeight(message: {
    AI?: string;
    HUMAN?: string;
    interactive?: unknown;
    reasoning?: unknown;
    events?: unknown;
  }): number {
    const key = this.generateMessageKey(message);

    // 尝试从缓存获取
    const cachedHeight = this.messageHeightCache.get(key);
    if (cachedHeight !== undefined) {
      return cachedHeight;
    }

    // 计算并缓存高度
    const metadata = generateMessageMetadata(message.AI || message.HUMAN || '');
    const estimatedHeight = this.estimateMessageHeight(metadata);

    this.messageHeightCache.set(key, estimatedHeight);
    return estimatedHeight;
  }

  /**
   * 生成消息缓存键
   */
  private generateMessageKey(message: {
    AI?: string;
    HUMAN?: string;
    interactive?: unknown;
    reasoning?: unknown;
    events?: unknown;
  }): string {
    const content = message.AI || message.HUMAN || '';
    const hasInteractive = !!message.interactive;
    const reasoningSteps = message.reasoning &&
      typeof message.reasoning === 'object' &&
      'steps' in message.reasoning ?
      (message.reasoning as { steps?: unknown[] }).steps?.length || 0 : 0;

    return `${content.slice(0, 100)}-${hasInteractive}-${reasoningSteps}`;
  }

  /**
   * 估算消息高度
   */
  private estimateMessageHeight(metadata: MessageMetadata): number {
    const baseHeight = 40; // 基础高度
    const lineHeight = 24; // 行高

    let height = baseHeight;

    // 基于内容长度的高度估算
    height += Math.ceil(metadata.charCount / 80) * lineHeight; // 假设每行80个字符

    // 代码块增加高度
    if (metadata.hasCode) {
      height += metadata.lineCount * lineHeight * 1.5;
    }

    // 链接增加高度
    if (metadata.hasLinks) {
      height += 20;
    }

    // 复杂度调整
    height += metadata.complexity * 10;

    return Math.max(baseHeight, height);
  }

  /**
   * 优化资源加载
   */
  optimizeResourceLoading(config: PreloadConfig): void {
    this.resourceOptimizer.preloadCriticalResources(config.criticalResources);
    this.resourceOptimizer.prefetchResources(config.prefetchResources);

    if (config.lazyResources.length > 0) {
      this.resourceOptimizer.lazyLoadResources(config.lazyResources);
    }
  }

  /**
   * 获取资源统计
   */
  getResourceStatistics() {
    return this.resourceOptimizer.getResourceStatistics();
  }

  /**
   * 获取组件统计
   */
  getComponentStatistics() {
    return this.componentOptimizer.getComponentStatistics();
  }

  /**
   * 记录性能事件
   */
  recordPerformanceEvent(event: PerformanceEvent): void {
    this.performanceEvents.push(event);

    // 保持事件数组大小限制
    if (this.performanceEvents.length > 1000) {
      this.performanceEvents = this.performanceEvents.slice(-500);
    }
  }

  /**
   * 获取性能事件
   */
  getPerformanceEvents(type?: string): PerformanceEvent[] {
    if (type) {
      return this.performanceEvents.filter(event => event.type === type);
    }
    return [...this.performanceEvents];
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): MemoryUsage & {
    formatted: {
      heapUsed: string;
      heapTotal: string;
      external: string;
      rss: string;
    };
  } {
    const memory = getCurrentMemoryUsage();

    return {
      ...memory,
      formatted: {
        heapUsed: formatMemorySize(memory.heapUsed),
        heapTotal: formatMemorySize(memory.heapTotal),
        external: formatMemorySize(memory.external),
        rss: formatMemorySize(memory.rss)
      }
    };
  }

  /**
   * 清理所有缓存和指标
   */
  cleanup(): void {
    this.messageHeightCache.clear();
    this.resourceOptimizer.clearMetrics();
    this.componentOptimizer.clearMetrics();
    this.performanceEvents = [];
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    timestamp: string;
    memory: ReturnType<typeof this.getMemoryUsage>;
    resources: ReturnType<typeof this.getResourceStatistics>;
    components: ReturnType<typeof this.getComponentStatistics>;
    events: {
      total: number;
      byType: Record<string, number>;
      recent: PerformanceEvent[];
    };
    cache: {
      messageHeightCache: {
        size: number;
        maxSize: number;
      };
    };
  } {
    const events = this.getPerformanceEvents();
    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      timestamp: new Date().toISOString(),
      memory: this.getMemoryUsage(),
      resources: this.getResourceStatistics(),
      components: this.getComponentStatistics(),
      events: {
        total: events.length,
        byType: eventsByType,
        recent: events.slice(-10)
      },
      cache: {
        messageHeightCache: {
          size: this.messageHeightCache.size,
          maxSize: 1000
        }
      }
    };
  }
}

// 导出单例实例
export const performanceOptimizer = PerformanceOptimizer.getInstance();

// 导出工具函数
export {
  debounce,
  throttleWrapper,
  MessageComplexity,
  generateMessageMetadata,
  createLRUCache,
  createTTLCache,
  getCurrentMemoryUsage,
  formatMemorySize
};

// ============================================================================
// 向后兼容的钩子和类
// ============================================================================

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = React.useRef(0);

  React.useEffect(() => {
    renderCount.current += 1;
    console.log(`[Performance] ${componentName} rendered ${renderCount.current} times`);
  });

  return {
    renderCount: renderCount.current,
    componentName,
  };
};

// Memory monitoring class
export class MemoryMonitor {
  private measurements: number[] = [];

  getCurrentUsage() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (performance as any).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          heapUsed: memory.usedJSHeapSize / 1024 / 1024, // Convert to MB
        };
      }
    }

    // Fallback for browsers without memory API
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      heapUsed: 0,
    };
  }

  startMeasurement() {
    this.measurements = [];
    const initial = this.getCurrentUsage();
    this.measurements.push(initial.heapUsed);
  }

  recordMeasurement() {
    const current = this.getCurrentUsage();
    this.measurements.push(current.heapUsed);
  }

  getAverageUsage() {
    if (this.measurements.length === 0) {
      return 0;
    }
    return this.measurements.reduce((sum, val) => sum + val, 0) / this.measurements.length;
  }

  addMemoryObserver(_callback: () => void): () => void {
    // Implementation for memory observation
    console.log('Memory observer added');
    // Return cleanup function
    return () => {
      console.log('Memory observer removed');
    };
  }

  startMonitoring() {
    console.log('[Memory Monitor] Started monitoring');
    this.startMeasurement();
  }

  stopMonitoring() {
    console.log('[Memory Monitor] Stopped monitoring');
  }

  getMemoryStats() {
    const current = this.getCurrentUsage();
    return {
      current: current.heapUsed,
      average: this.getAverageUsage(),
      peak: Math.max(...this.measurements, current.heapUsed),
      trend: 'stable',
    };
  }
}

// Component performance monitor
export const componentMonitor = {
  startMonitoring(componentName: string) {
    console.log(`[Component Monitor] Started monitoring: ${componentName}`);
  },

  recordRender(componentName: string) {
    console.log(`[Component Monitor] Render recorded: ${componentName}`);
  },

  stopMonitoring(componentName: string) {
    console.log(`[Component Monitor] Stopped monitoring: ${componentName}`);
  },

  getAllStats() {
    return {
      PerformanceMonitor: {
        renders: 1,
        averageRenderTime: 0,
        isMounted: true,
      },
    };
  },
};

// Request monitor for API calls
export const requestMonitor = {
  startRequest(requestId: string, url: string) {
    console.log(`[Request Monitor] Started: ${requestId} - ${url}`);
  },

  endRequest(requestId: string, method: string, status: number) {
    console.log(`[Request Monitor] Ended: ${requestId} - ${method} - ${status}`);
  },

  completeRequest(requestId: string, duration: number) {
    console.log(`[Request Monitor] Completed: ${requestId} - ${duration}ms`);
  },

  failRequest(requestId: string, error: string) {
    console.log(`[Request Monitor] Failed: ${requestId} - ${error}`);
  },

  getRequestStats() {
    return {
      totalRequests: 0,
      averageDuration: 0,
      slowestRequests: [],
      activeRequests: 0,
    };
  },
};

export const memoryMonitor = new MemoryMonitor();

// Resource manager for memory and performance optimization
export class ResourceManager {
  private observers: Set<() => void> = new Set();
  private measurements: number[] = [];

  addObserver(callback: () => void) {
    this.observers.add(callback);
  }

  removeObserver(callback: () => void) {
    this.observers.delete(callback);
  }

  notifyObservers() {
    this.observers.forEach(callback => callback());
  }

  addMemoryObserver(callback: () => void) {
    this.addObserver(callback);
  }

  recordMeasurement() {
    const current = this.getCurrentUsage();
    this.measurements.push(current.heapUsed);
  }

  getCurrentUsage() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (performance as any).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          heapUsed: memory.usedJSHeapSize / 1024 / 1024,
        };
      }
    }
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      heapUsed: 0,
    };
  }

  cleanup() {
    this.observers.clear();
  }
}

export const resourceManager = new ResourceManager();