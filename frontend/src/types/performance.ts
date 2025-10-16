/**
 * 性能优化相关的类型定义
 * 为高性能组件提供严格的类型约束
 */

// ============================================================================
// 基础性能类型
// ============================================================================

/**
 * 渲染性能指标
 */
export interface RenderMetrics {
  renderCount: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  lastRenderTime: number;
  memoryUsage: number;
}

/**
 * 组件性能监控配置
 */
export interface PerformanceMonitorConfig {
  enabled: boolean;
  sampleRate: number; // 采样率 0-1
  maxSamples: number;
  thresholdMs: number; // 性能警告阈值
  trackMemory: boolean;
}

/**
 * 缓存配置
 */
export interface CacheConfig<K, V> {
  maxSize: number;
  ttl?: number; // 生存时间（毫秒）
  onEvict?: (key: K, value: V) => void;
}

// ============================================================================
// 虚拟化相关类型
// ============================================================================

/**
 * 虚拟列表项目高度计算函数
 */
export type ItemHeightCalculator<T = any> = (index: number, item: T) => number;

/**
 * 虚拟列表项目键值生成函数
 */
export type ItemKeyGenerator<T = any> = (index: number, item: T) => string | number;

/**
 * 虚拟列表渲染项
 */
export interface VirtualItem<T = any> {
  index: number;
  key: string | number;
  start: number;
  size: number;
  end: number;
  item: T;
  isVisible: boolean;
}

/**
 * 虚拟列表配置
 */
export interface VirtualListConfig<T = any> {
  itemCount: number;
  itemHeight: number | ItemHeightCalculator<T>;
  containerHeight: number;
  overscan?: number;
  getItemKey?: ItemKeyGenerator<T>;
  estimatedItemHeight?: number;
  enableDynamicHeight?: boolean;
  cacheSize?: number;
}

/**
 * 高度缓存接口
 */
export interface HeightCache {
  get: (key: string) => number | undefined;
  set: (key: string, height: number) => void;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  readonly size: number;
}

// ============================================================================
// React 性能优化类型
// ============================================================================

/**
 * React.memo 比较函数类型
 */
export type MemoCompareFn<T> = (prevProps: T, nextProps: T) => boolean;

/**
 * useMemo 依赖数组类型
 */
export type MemoDeps = readonly unknown[];

/**
 * useCallback 依赖数组类型
 */
export type CallbackDeps = MemoDeps;

/**
 * 性能优化的 React 组件 Props
 */
export interface OptimizedComponentProps<T = Record<string, unknown>> {
  /**
   * 自定义比较函数，用于优化 React.memo
   */
  memoCompare?: MemoCompareFn<T>;

  /**
   * 是否启用性能监控
   */
  enablePerformanceTracking?: boolean;

  /**
   * 渲染阈值，超过此时间会发出警告
   */
  renderThresholdMs?: number;
}

/**
 * 安全的可选属性类型 - 解决 exactOptionalPropertyTypes 问题
 */
export type SafeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 必需属性类型 - 明确标记为必需
 */
export type RequiredProps<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// 消息系统性能类型
// ============================================================================

/**
 * 消息渲染复杂度
 */
export enum MessageComplexity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  VERY_HIGH = 4
}

/**
 * 消息元数据（用于性能优化）
 */
export interface MessageMetadata {
  wordCount: number;
  charCount: number;
  lineCount: number;
  hasCode: boolean;
  hasLinks: boolean;
  hasEmojis: boolean;
  complexity: MessageComplexity;
  estimatedRenderTime: number;
  memoryFootprint: number;
}

/**
 * 消息高度缓存键
 */
export type MessageHeightKey = string;

/**
 * 批量操作配置
 */
export interface BatchConfig<T> {
  batchSize: number;
  delay?: number;
  onError?: (error: Error, items: T[]) => void;
  onSuccess?: (items: T[]) => void;
}

// ============================================================================
// 内存管理类型
// ============================================================================

/**
 * 内存使用统计
 */
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

/**
 * 内存监控配置
 */
export interface MemoryMonitorConfig {
  enabled: boolean;
  intervalMs: number;
  thresholdMB: number;
  onThresholdExceeded?: (usage: MemoryUsage) => void;
}

/**
 * 对象池接口
 */
export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

// ============================================================================
// 性能事件类型
// ============================================================================

/**
 * 性能事件类型
 */
export enum PerformanceEventType {
  RENDER_START = 'render_start',
  RENDER_END = 'render_end',
  MEMORY_WARNING = 'memory_warning',
  COMPONENT_MOUNT = 'component_mount',
  COMPONENT_UNMOUNT = 'component_unmount',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss'
}

/**
 * 性能事件数据
 */
export interface PerformanceEvent {
  type: PerformanceEventType;
  timestamp: number;
  componentName?: string;
  duration?: number;
  memoryUsage?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 非空类型
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * 提取数组元素类型
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * 条件类型：如果 T extends U，返回 X，否则返回 Y
 */
export type IfExtends<T, U, X, Y> = T extends U ? X : Y;

/**
 * 构建函数类型
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * 异步函数类型
 */
export type AsyncFunction<T = void> = (...args: any[]) => Promise<T>;

/**
 * 事件处理器类型
 */
export type EventHandler<T = Event> = (event: T) => void;

// ============================================================================
// 性能断言类型
// ============================================================================

/**
 * 类型断言：确保值不为 null/undefined
 */
export function assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value == null) {
    throw new Error(message || `Expected value to be non-null, got ${value}`);
  }
}

/**
 * 类型断言：确保值为字符串
 */
export function assertString(value: unknown, message?: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(message || `Expected value to be string, got ${typeof value}`);
  }
}

/**
 * 类型断言：确保值为数字
 */
export function assertNumber(value: unknown, message?: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new Error(message || `Expected value to be number, got ${typeof value}`);
  }
}

// ============================================================================
// 性能标记类型
// ============================================================================

/**
 * 标记接口：用于标识性能优化的组件
 */
export interface PerformanceOptimized {
  readonly __performanceOptimized: true;
}

/**
 * 标记接口：用于标识虚拟化组件
 */
export interface VirtualizedComponent {
  readonly __virtualized: true;
}

/**
 * 标记接口：用于标识缓存组件
 */
export interface CachedComponent {
  readonly __cached: true;
}

