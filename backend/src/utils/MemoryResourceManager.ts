/**
 * 内存资源管理器
 *
 * 管理和清理应用中的各种资源，防止内存泄漏
 * 包括定时器管理、事件监听器管理、缓存管理等
 */

import { EventEmitter } from 'events';
import logger from './StructuredLogger';

// ============================================================================
// 资源类型定义
// ============================================================================

export interface TimerInfo {
  id: string;
  type: 'timeout' | 'interval';
  delay: number;
  callback: Function;
  createdAt: number;
  location: string;
  autoCleanup: boolean;
}

export interface EventListenerInfo {
  id: string;
  emitter: EventEmitter;
  event: string;
  listener: Function;
  once: boolean;
  createdAt: number;
  location: string;
  autoCleanup: boolean;
}

export interface CacheInfo {
  id: string;
  name: string;
  size: number;
  maxSize: number;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  cleanupPolicy: 'lru' | 'fifo' | 'ttl';
}

export interface ResourceMetrics {
  timers: {
    total: number;
    active: number;
    expired: number;
    autoCleaned: number;
  };
  eventListeners: {
    total: number;
    active: number;
    removed: number;
    autoCleaned: number;
  };
  caches: {
    total: number;
    totalSize: number;
    cleaned: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

// ============================================================================
// 内存资源管理器主类
// ============================================================================

export class MemoryResourceManager extends EventEmitter {
  private timers = new Map<string, TimerInfo>();
  private eventListeners = new Map<string, EventListenerInfo>();
  private caches = new Map<string, CacheInfo>();
  private cleanupInterval?: NodeJS.Timeout;
  private isRunning = false;
  private metrics: ResourceMetrics;

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
  }

  /**
   * 启动资源管理器
   */
  start(options: {
    cleanupInterval?: number;
    enableMetrics?: boolean;
  } = {}): void {
    if (this.isRunning) {
      logger.warn('内存资源管理器已在运行');
      return;
    }

    this.isRunning = true;

    // 启动定期清理
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, options.cleanupInterval || 60000) as any; // 默认每分钟清理一次

    logger.info('内存资源管理器已启动', {
      cleanupInterval: options.cleanupInterval || 60000,
    });

    this.emit('started');
  }

  /**
   * 停止资源管理器
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined as any;
    }

    // 执行最终清理
    this.performCleanup(true);

    logger.info('内存资源管理器已停止', this.metrics);
    this.emit('stopped');
  }

  /**
   * 注册定时器
   */
  registerTimer(
    type: 'timeout' | 'interval',
    callback: Function,
    delay: number,
    options: {
      location?: string;
      autoCleanup?: boolean;
      id?: string;
    } = {}
  ): NodeJS.Timeout {
    const timerId = options.id || `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const location = options.location || this.getCallerLocation();

    const timerInfo: TimerInfo = {
      id: timerId,
      type,
      delay,
      callback,
      createdAt: Date.now(),
      location,
      autoCleanup: options.autoCleanup !== false, // 默认自动清理
    };

    this.timers.set(timerId, timerInfo);

    let timer: NodeJS.Timeout;
    if (type === 'timeout') {
      timer = setTimeout(() => {
        try {
          callback();
        } catch (error) {
          logger.error('定时器回调执行失败', {
            timerId,
            error: error instanceof Error ? {
              name: error.name,
              message: error.message,
              ...(error.stack && { stack: error.stack })
            } : { name: 'UnknownError', message: String(error) }
          });
        } finally {
          this.timers.delete(timerId);
          this.updateMetrics();
        }
      }, delay);
    } else {
      timer = setInterval(() => {
        try {
          callback();
        } catch (error) {
          logger.error('定时器回调执行失败', {
            timerId,
            error: error instanceof Error ? {
              name: error.name,
              message: error.message,
              ...(error.stack && { stack: error.stack })
            } : { name: 'UnknownError', message: String(error) }
          });
        }
      }, delay);
    }

    // 将原生定时器对象附加到信息中
    (timerInfo as any).nativeTimer = timer;

    logger.debug('定时器已注册', {
      timerId,
      type,
      delay,
      location,
      autoCleanup: timerInfo.autoCleanup,
    });

    this.updateMetrics();
    return timer;
  }

  /**
   * 清除定时器
   */
  clearTimer(timerId: string): boolean {
    const timerInfo = this.timers.get(timerId);
    if (!timerInfo) {
      return false;
    }

    const nativeTimer = (timerInfo as any).nativeTimer;
    if (nativeTimer) {
      if (timerInfo.type === 'timeout') {
        clearTimeout(nativeTimer);
      } else {
        clearInterval(nativeTimer);
      }
    }

    this.timers.delete(timerId);
    this.updateMetrics();

    logger.debug('定时器已清除', { timerId });
    return true;
  }

  /**
   * 注册事件监听器
   */
  registerEventListener(
    emitter: EventEmitter,
    event: string,
    listener: Function,
    options: {
      once?: boolean;
      location?: string;
      autoCleanup?: boolean;
      id?: string;
    } = {}
  ): string {
    const listenerId = options.id || `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const location = options.location || this.getCallerLocation();

    const listenerInfo: EventListenerInfo = {
      id: listenerId,
      emitter,
      event,
      listener,
      once: options.once || false,
      createdAt: Date.now(),
      location,
      autoCleanup: options.autoCleanup !== false, // 默认自动清理
    };

    this.eventListeners.set(listenerId, listenerInfo);

    // 包装监听器以便追踪
    const wrappedListener = (...args: any[]) => {
      try {
        listener(...args);
      } catch (error) {
        logger.error('事件监听器执行失败', {
          listenerId,
          event,
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            ...(error.stack && { stack: error.stack })
          } : { name: 'UnknownError', message: String(error) }
        });
      }

      // 如果是一次性监听器，自动清理
      if (options.once) {
        this.eventListeners.delete(listenerId);
        this.updateMetrics();
      }
    };

    // 保存包装后的监听器
    (listenerInfo as any).wrappedListener = wrappedListener;

    // 注册到发射器
    if (options.once) {
      emitter.once(event, wrappedListener);
    } else {
      emitter.on(event, wrappedListener);
    }

    logger.debug('事件监听器已注册', {
      listenerId,
      event,
      once: options.once,
      location,
      autoCleanup: listenerInfo.autoCleanup,
    });

    this.updateMetrics();
    return listenerId;
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listenerId: string): boolean {
    const listenerInfo = this.eventListeners.get(listenerId);
    if (!listenerInfo) {
      return false;
    }

    const wrappedListener = (listenerInfo as any).wrappedListener;
    if (wrappedListener) {
      listenerInfo.emitter.removeListener(listenerInfo.event, wrappedListener);
    }

    this.eventListeners.delete(listenerId);
    this.updateMetrics();

    logger.debug('事件监听器已移除', { listenerId });
    return true;
  }

  /**
   * 注册缓存
   */
  registerCache(
    name: string,
    cache: {
      size: number;
      maxSize: number;
      ttl: number;
      cleanupPolicy: 'lru' | 'fifo' | 'ttl';
    },
    options: {
      id?: string;
      autoCleanup?: boolean;
    } = {}
  ): string {
    const cacheId = options.id || `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const cacheInfo: CacheInfo = {
      id: cacheId,
      name,
      size: cache.size,
      maxSize: cache.maxSize,
      ttl: cache.ttl,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      cleanupPolicy: cache.cleanupPolicy,
    };

    this.caches.set(cacheId, cacheInfo);

    logger.debug('缓存已注册', {
      cacheId,
      name,
      size: cache.size,
      maxSize: cache.maxSize,
    });

    this.updateMetrics();
    return cacheId;
  }

  /**
   * 更新缓存信息
   */
  updateCache(cacheId: string, updates: Partial<CacheInfo>): boolean {
    const cacheInfo = this.caches.get(cacheId);
    if (!cacheInfo) {
      return false;
    }

    Object.assign(cacheInfo, updates, { lastAccessed: Date.now() });
    this.updateMetrics();
    return true;
  }

  /**
   * 清理缓存
   */
  cleanupCache(cacheId: string): boolean {
    const cacheInfo = this.caches.get(cacheId);
    if (!cacheInfo) {
      return false;
    }

    // 发出缓存清理事件，让具体的缓存服务处理清理逻辑
    this.emit('cache_cleanup', {
      cacheId,
      name: cacheInfo.name,
      cleanupPolicy: cacheInfo.cleanupPolicy,
    });

    logger.debug('缓存清理请求已发送', { cacheId, name: cacheInfo.name });
    return true;
  }

  /**
   * 执行清理操作
   */
  private performCleanup(force = false): void {
    const startTime = Date.now();
    let cleanedCount = 0;

    // 清理过期的定时器
    cleanedCount += this.cleanupExpiredTimers(force);

    // 清理长时间未使用的事件监听器
    cleanedCount += this.cleanupUnusedEventListeners(force);

    // 清理过期的缓存
    cleanedCount += this.cleanupExpiredCaches(force);

    // 执行垃圾回收（如果可用）
    if (global.gc && (force || Math.random() < 0.1)) { // 10% 概率强制GC
      global.gc();
    }

    const duration = Date.now() - startTime;
    logger.debug('资源清理完成', {
      duration,
      cleanedCount,
      force,
    });

    this.emit('cleanup_completed', {
      duration,
      cleanedCount,
      force,
    });
  }

  /**
   * 清理过期的定时器
   */
  private cleanupExpiredTimers(force: boolean): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [timerId, timerInfo] of this.timers.entries()) {
      const shouldCleanup = force ||
        timerInfo.autoCleanup &&
        (now - timerInfo.createdAt > timerInfo.delay * 10); // 超过预期时间10倍

      if (shouldCleanup) {
        this.clearTimer(timerId);
        cleanedCount++;
        this.metrics.timers.autoCleaned++;
      }
    }

    return cleanedCount;
  }

  /**
   * 清理未使用的事件监听器
   */
  private cleanupUnusedEventListeners(force: boolean): number {
    let cleanedCount = 0;
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30分钟

    for (const [listenerId, listenerInfo] of this.eventListeners.entries()) {
      const shouldCleanup = force ||
        listenerInfo.autoCleanup &&
        (now - listenerInfo.createdAt > maxAge);

      if (shouldCleanup) {
        this.removeEventListener(listenerId);
        cleanedCount++;
        this.metrics.eventListeners.autoCleaned++;
      }
    }

    return cleanedCount;
  }

  /**
   * 清理过期的缓存
   */
  private cleanupExpiredCaches(force: boolean): number {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [cacheId, cacheInfo] of this.caches.entries()) {
      const shouldCleanup = force ||
        (cacheInfo.ttl > 0 && (now - cacheInfo.lastAccessed > cacheInfo.ttl));

      if (shouldCleanup) {
        this.cleanupCache(cacheId);
        cleanedCount++;
        this.metrics.caches.cleaned++;
      }
    }

    return cleanedCount;
  }

  /**
   * 获取资源指标
   */
  getMetrics(): ResourceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * 更新资源指标
   */
  private updateMetrics(): void {
    const memUsage = process.memoryUsage();

    this.metrics = {
      timers: {
        total: this.timers.size,
        active: Array.from(this.timers.values()).filter(t => {
          const nativeTimer = (t as any).nativeTimer;
          return nativeTimer && nativeTimer._onTimeout;
        }).length,
        expired: this.metrics.timers.expired,
        autoCleaned: this.metrics.timers.autoCleaned,
      },
      eventListeners: {
        total: this.eventListeners.size,
        active: this.eventListeners.size,
        removed: this.metrics.eventListeners.removed,
        autoCleaned: this.metrics.eventListeners.autoCleaned,
      },
      caches: {
        total: this.caches.size,
        totalSize: Array.from(this.caches.values()).reduce((sum, c) => sum + c.size, 0),
        cleaned: this.metrics.caches.cleaned,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
    };
  }

  /**
   * 初始化资源指标
   */
  private initializeMetrics(): ResourceMetrics {
    const memUsage = process.memoryUsage();

    return {
      timers: {
        total: 0,
        active: 0,
        expired: 0,
        autoCleaned: 0,
      },
      eventListeners: {
        total: 0,
        active: 0,
        removed: 0,
        autoCleaned: 0,
      },
      caches: {
        total: 0,
        totalSize: 0,
        cleaned: 0,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
    };
  }

  /**
   * 获取调用位置
   */
  private getCallerLocation(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    const lines = stack.split('\n');
    // 跳过当前函数和工具函数的调用栈
    const callerLine = lines[4] || lines[3] || 'unknown';

    // 提取文件名和行号
    const match = callerLine.match(/at\s+(.+?):(\d+):(\d+)/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }

    return callerLine.trim();
  }

  /**
   * 强制清理所有资源
   */
  forceCleanup(): void {
    logger.warn('执行强制资源清理');

    // 清理所有定时器
    for (const timerId of this.timers.keys()) {
      this.clearTimer(timerId);
    }

    // 清理所有事件监听器
    for (const listenerId of this.eventListeners.keys()) {
      this.removeEventListener(listenerId);
    }

    // 清理所有缓存
    for (const cacheId of this.caches.keys()) {
      this.cleanupCache(cacheId);
    }

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }

    logger.info('强制资源清理完成');
  }

  /**
   * 生成资源使用报告
   */
  generateReport(): {
    summary: ResourceMetrics;
    details: {
      timers: Array<TimerInfo & { status: string }>;
      eventListeners: Array<EventListenerInfo & { status: string }>;
      caches: CacheInfo[];
    };
    recommendations: string[];
  } {
    const summary = this.getMetrics();

    const details = {
      timers: Array.from(this.timers.values()).map(timer => ({
        ...timer,
        status: this.getTimerStatus(timer),
      })),
      eventListeners: Array.from(this.eventListeners.values()).map(listener => ({
        ...listener,
        status: this.getListenerStatus(listener),
      })),
      caches: Array.from(this.caches.values()),
    };

    const recommendations = this.generateRecommendations(summary, details);

    return {
      summary,
      details,
      recommendations,
    };
  }

  /**
   * 获取定时器状态
   */
  private getTimerStatus(timer: TimerInfo): string {
    const nativeTimer = (timer as any).nativeTimer;
    if (!nativeTimer) return 'unknown';

    if (timer.type === 'timeout') {
      return nativeTimer._onTimeout ? 'active' : 'expired';
    } else {
      return nativeTimer._onTimeout ? 'active' : 'stopped';
    }
  }

  /**
   * 获取监听器状态
   */
  private getListenerStatus(listener: EventListenerInfo): string {
    try {
      const listeners = listener.emitter.listeners(listener.event);
      const wrappedListener = (listener as any).wrappedListener;
      return listeners.includes(wrappedListener) ? 'active' : 'removed';
    } catch {
      return 'unknown';
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(summary: ResourceMetrics, details: any): string[] {
    const recommendations: string[] = [];

    // 内存使用建议
    const memoryUsageMB = summary.memory.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) {
      recommendations.push(`内存使用量较高 (${memoryUsageMB.toFixed(2)} MB)，建议优化或增加内存`);
    }

    // 定时器建议
    if (summary.timers.total > 20) {
      recommendations.push(`定时器数量较多 (${summary.timers.total})，检查是否有未清理的定时器`);
    }

    // 事件监听器建议
    if (summary.eventListeners.total > 50) {
      recommendations.push(`事件监听器数量较多 (${summary.eventListeners.total})，检查是否有未移除的监听器`);
    }

    // 缓存建议
    if (summary.caches.totalSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push(`缓存总量较大 (${(summary.caches.totalSize / 1024 / 1024).toFixed(2)} MB)，建议清理或限制缓存大小`);
    }

    // 自动清理建议
    if (summary.timers.autoCleaned > 5 || summary.eventListeners.autoCleaned > 5) {
      recommendations.push('检测到大量自动清理的资源，建议检查资源管理逻辑');
    }

    if (recommendations.length === 0) {
      recommendations.push('资源使用状况良好，未发现明显问题');
    }

    return recommendations;
  }
}

// ============================================================================
// 单例实例
// ============================================================================

export const memoryResourceManager = new MemoryResourceManager();

// ============================================================================
// 导出辅助函数
// ============================================================================

/**
 * 创建安全定时器（自动管理）
 */
export function createSafeTimer(
  type: 'timeout' | 'interval',
  callback: Function,
  delay: number,
  options?: {
    location?: string;
    autoCleanup?: boolean;
  }
): NodeJS.Timeout {
  return memoryResourceManager.registerTimer(type, callback, delay, options);
}

/**
 * 创建安全事件监听器（自动管理）
 */
export function createSafeListener(
  emitter: EventEmitter,
  event: string,
  listener: Function,
  options?: {
    once?: boolean;
    location?: string;
    autoCleanup?: boolean;
  }
): string {
  return memoryResourceManager.registerEventListener(emitter, event, listener, options);
}

/**
 * 创建安全缓存（自动管理）
 */
export function createSafeCache(
  name: string,
  cache: {
    size: number;
    maxSize: number;
    ttl: number;
    cleanupPolicy: 'lru' | 'fifo' | 'ttl';
  },
  options?: {
    id?: string;
    autoCleanup?: boolean;
  }
): string {
  return memoryResourceManager.registerCache(name, cache, options);
}

export default memoryResourceManager;