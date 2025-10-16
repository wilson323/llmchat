/**
 * 性能优化辅助工具函数
 * 提供通用的性能优化和类型安全工具
 */

import type {
  CacheConfig,
  HeightCache,
  MessageMetadata,
  MemoryUsage,
  ObjectPool,
  PerformanceEvent,
  RenderMetrics,
  SafeOptional,
  NonNullable,
  MemoCompareFn
} from '@/types/performance';

// 消息复杂度枚举
export enum MessageComplexity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  VERY_HIGH = 4
}

// 性能事件类型枚举
export enum PerformanceEventType {
  RENDER_START = 'render_start',
  RENDER_END = 'render_end',
  MEMORY_WARNING = 'memory_warning',
  COMPONENT_MOUNT = 'component_mount',
  COMPONENT_UNMOUNT = 'component_unmount',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss'
}

// ============================================================================
// 缓存工具
// ============================================================================

/**
 * 创建LRU缓存
 */
export function createLRUCache(maxSize: number): HeightCache {
  const cache = new Map<string, number>();

  return {
    get(key: string): number | undefined {
      const value = cache.get(key);
      if (value !== undefined) {
        // 移动到末尾（最近使用）
        cache.delete(key);
        cache.set(key, value);
      }
      return value;
    },

    set(key: string, height: number): void {
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= maxSize) {
        // 删除最久未使用的项（第一个）
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
      cache.set(key, height);
    },

    has(key: string): boolean {
      return cache.has(key);
    },

    delete(key: string): boolean {
      return cache.delete(key);
    },

    clear(): void {
      cache.clear();
    },

    get size(): number {
      return cache.size;
    }
  };
}

/**
 * 创建TTL缓存（带过期时间的缓存）
 */
export function createTTLCache<V>(maxSize: number, ttlMs: number = 5 * 60 * 1000): {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  size: number;
} {
  const cache = new Map<string, { value: V; timestamp: number }>();

  const cleanup = (): void => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > ttlMs) {
        cache.delete(key);
      }
    }
  };

  // 定期清理过期项
  setInterval(cleanup, ttlMs / 10);

  return {
    get(key: string): V | undefined {
      const entry = cache.get(key);
      if (!entry) return undefined;

      if (Date.now() - entry.timestamp > ttlMs) {
        cache.delete(key);
        return undefined;
      }

      // 移动到末尾（最近使用）
      cache.delete(key);
      cache.set(key, entry);
      return entry.value;
    },

    set(key: string, value: V): void {
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
      cache.set(key, { value, timestamp: Date.now() });
    },

    has(key: string): boolean {
      const entry = cache.get(key);
      if (!entry) return false;

      if (Date.now() - entry.timestamp > ttlMs) {
        cache.delete(key);
        return false;
      }
      return true;
    },

    delete(key: string): boolean {
      return cache.delete(key);
    },

    clear(): void {
      cache.clear();
    },

    get size(): number {
      cleanup(); // 清理过期项
      return cache.size;
    }
  };
}

// ============================================================================
// React 性能优化工具
// ============================================================================

/**
 * 创建安全的 memo 比较函数
 */
export function createSafeMemoCompare<T extends Record<string, unknown>>(
  keys: (keyof T)[]
): MemoCompareFn<T> {
  return (prevProps: T, nextProps: T): boolean => {
    for (const key of keys) {
      if (prevProps[key] !== nextProps[key]) {
        return false;
      }
    }
    return true;
  };
}

/**
 * 深度比较函数（用于复杂对象）
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
    return a === b;
  }

  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }

  if (typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  let keys = Object.keys(aObj);
  if (keys.length !== Object.keys(bObj).length) {
    return false;
  }

  return keys.every(k => deepEqual(aObj[k], bObj[k]));
}

/**
 * 创建深度比较的 memo 函数
 */
export function createDeepMemoCompare<T>(): MemoCompareFn<T> {
  return (prevProps: T, nextProps: T): boolean => {
    return deepEqual(prevProps, nextProps);
  };
}

/**
 * 防抖 Hook 的实现函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流 Hook 的实现函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>): void => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================================================
// 消息性能分析工具
// ============================================================================

/**
 * 计算消息复杂度
 */
export function calculateMessageComplexity(message: string): MessageComplexity {
  const wordCount = message.split(/\s+/).length;
  const lineCount = message.split('\n').length;
  const hasCode = /```/.test(message);
  const hasLinks = /https?:\/\/[^\s]+/.test(message);

  let complexity = MessageComplexity.LOW;

  // 基于字数的复杂度
  if (wordCount > 500) complexity = MessageComplexity.HIGH;
  else if (wordCount > 100) complexity = MessageComplexity.MEDIUM;
  else if (wordCount > 50) complexity = MessageComplexity.LOW;

  // 基于特殊内容的调整
  if (hasCode || hasLinks || lineCount > 20) {
    complexity = MessageComplexity.VERY_HIGH;
  }

  return complexity;
}

/**
 * 生成消息元数据
 */
export function generateMessageMetadata(content: string): MessageMetadata {
  const complexity = calculateMessageComplexity(content);
  const wordCount = content.split(/\s+/).length;
  const charCount = content.length;
  const lineCount = content.split('\n').length;
  const hasCode = /```/.test(content);
  const hasLinks = /https?:\/\/[^\s]+/.test(content);
  const hasEmojis = /[\u2600-\u27BF]|[\uD83C][\uDC00-\uDFFF]|[\uD83D][\uDC00-\uDFFF]|[\uD83E][\uDD10-\uDDFF]/g.test(content);

  // 估算渲染时间（微秒）
  const estimatedRenderTime = complexity * 50 + wordCount * 0.1 + lineCount * 2;

  // 估算内存占用（字节）
  const memoryFootprint = charCount * 2 + (hasCode ? 1024 : 0) + (hasLinks ? 512 : 0);

  return {
    wordCount,
    charCount,
    lineCount,
    hasCode,
    hasLinks,
    hasEmojis,
    complexity,
    estimatedRenderTime,
    memoryFootprint
  };
}

/**
 * 生成消息高度缓存键
 */
export function generateMessageHeightKey(message: {
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
  const eventCount = message.events &&
    Array.isArray(message.events) ?
    message.events.length : 0;

  return `${content.slice(0, 100)}-${hasInteractive}-${reasoningSteps}-${eventCount}`;
}

// ============================================================================
// 内存管理工具
// ============================================================================

/**
 * 获取当前内存使用情况
 */
export function getCurrentMemoryUsage(): MemoryUsage {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      heapUsed: memory.usedJSHeapSize,
      heapTotal: memory.totalJSHeapSize,
      external: 0, // Node.js 特有
      rss: 0, // Node.js 特有
      timestamp: Date.now()
    };
  }

  // 浏览器环境下的默认值
  return {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0,
    timestamp: Date.now()
  };
}

/**
 * 格式化内存大小
 */
export function formatMemorySize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 创建对象池
 */
export function createObjectPool<T>(
  factory: () => T,
  reset: (obj: T) => void,
  maxSize: number = 100
): ObjectPool<T> {
  const pool: T[] = [];

  return {
    acquire(): T {
      if (pool.length > 0) {
        return pool.pop()!;
      }
      return factory();
    },

    release(obj: T): void {
      if (pool.length < maxSize) {
        reset(obj);
        pool.push(obj);
      }
    },

    size(): number {
      return pool.length;
    },

    clear(): void {
      pool.length = 0;
    }
  };
}

// ============================================================================
// 性能监控工具
// ============================================================================

/**
 * 性能事件收集器
 */
export class PerformanceEventCollector {
  private events: PerformanceEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }

  add(event: PerformanceEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift(); // 移除最旧的事件
    }
  }

  getEvents(type?: PerformanceEventType): PerformanceEvent[] {
    if (type) {
      return this.events.filter(event => event.type === type);
    }
    return [...this.events];
  }

  getMetrics(): RenderMetrics {
    const renderEvents = this.events.filter(
      event => event.type === PerformanceEventType.RENDER_END
    );

    if (renderEvents.length === 0) {
      return {
        renderCount: 0,
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: 0,
        lastRenderTime: 0,
        memoryUsage: 0
      };
    }

    const renderTimes = renderEvents.map(event => event.duration || 0);
    const memoryUsage = getCurrentMemoryUsage().heapUsed;

    return {
      renderCount: renderEvents.length,
      averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      minRenderTime: Math.min(...renderTimes),
      lastRenderTime: renderTimes[renderTimes.length - 1] || 0,
      memoryUsage
    };
  }

  clear(): void {
    this.events.length = 0;
  }
}

// ============================================================================
// 批处理工具
// ============================================================================

/**
 * 批处理队列
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private processor: (items: T[]) => Promise<void>,
    private batchSize: number = 10,
    private delay: number = 100
  ) {}

  add(item: T): void {
    this.queue.push(item);

    if (!this.processing) {
      this.scheduleProcess();
    } else if (this.queue.length >= this.batchSize) {
      this.process();
    }
  }

  private scheduleProcess(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.process();
    }, this.delay);
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.processor(batch);
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      this.processing = false;

      // 如果还有待处理的项目，继续处理
      if (this.queue.length > 0) {
        this.scheduleProcess();
      }
    }
  }

  flush(): Promise<void> {
    return new Promise((resolve) => {
      const checkProcessing = (): void => {
        if (!this.processing && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(checkProcessing, 10);
        }
      };
      checkProcessing();
    });
  }
}

// ============================================================================
// 类型安全工具
// ============================================================================

/**
 * 安全的可选属性构造器
 */
export function createSafeOptional<T, K extends keyof T>(
  obj: T,
  optionalKeys: K[]
): SafeOptional<T, K> {
  const result = { ...obj };

  for (const key of optionalKeys) {
    if (result[key] === undefined) {
      delete (result as any)[key];
    }
  }

  return result as SafeOptional<T, K>;
}

/**
 * 安全的属性访问器
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: NonNullable<T[K]>
): NonNullable<T[K]> {
  if (obj == null || obj[key] == null) {
    return defaultValue;
  }

  return obj[key] as NonNullable<T[K]>;
}

/**
 * 安全的数组访问器
 */
export function safeArrayGet<T>(
  array: T[] | null | undefined,
  index: number,
  defaultValue: T
): T {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }

  return array[index]!;
}

// ============================================================================
// 导出所有工具
// ============================================================================

export {
  type CacheConfig,
  type HeightCache,
  type MessageMetadata,
  type MemoryUsage,
  type ObjectPool,
  type PerformanceEvent,
  type RenderMetrics,
  type SafeOptional,
  type NonNullable,
  type MemoCompareFn
};