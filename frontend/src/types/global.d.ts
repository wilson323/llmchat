/**
 * 全局类型定义
 *
 * 解决TypeScript安全问题的关键类型定义
 */

declare global {
  interface Window {
    // Google Analytics gtag 函数
    gtag?: (
      command: 'config' | 'set' | 'event' | 'js',
      targetIdOrEventName: string,
      configOrParams?: Record<string, unknown>
    ) => void;

    // Performance API 扩展
    performance: {
      now(): number;
      mark(name: string): void;
      measure(name: string, startMark?: string, endMark?: string): void;
      getEntriesByName?(name: string, type?: string): PerformanceEntry[];
      getEntriesByType?(type: string): PerformanceEntry[];
    } & Performance;

    // 其他可能的第三方全局变量
    dataLayer?: any[];
    _gaq?: any[];

    // ECharts 全局变量
    echarts?: any;

    // React DevTools
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any;
  }

  // Node.js 全局类型（用于SSR兼容）
  namespace NodeJS {
    interface Timeout {
      ref(): this;
      unref(): this;
    }

    interface Immediate {
      ref(): this;
      unref(): this;
    }
  }
}

/**
 * 安全的事件参数类型
 */
export interface SafeEventParams {
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * 安全的用户属性类型
 */
export interface SafeUserProperties {
  id?: string;
  role?: string;
  username?: string;
  email?: string;
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * 安全的分析配置类型
 */
export interface SafeAnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  endpoint?: string;
  trackingId?: string;
}

/**
 * 安全的fetch选项类型
 */
export interface SafeRequestInit extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * 安全的错误类型
 */
export interface SafeError {
  message: string;
  stack?: string;
  code?: string;
  status?: number;
  name?: string;
}

/**
 * 安全的localStorage操作
 */
export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
}

/**
 * 安全的sessionStorage操作
 */
export interface SafeSessionStorage extends SafeStorage {}

export {}; // 确保这是一个模块文件