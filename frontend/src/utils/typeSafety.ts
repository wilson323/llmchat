/**
 * 类型安全工具
 * 解决 exactOptionalPropertyTypes 带来的类型安全问题
 */

import type { SafeOptional, NonNullable } from '@/types/performance';

// ============================================================================
// exactOptionalPropertyTypes 安全工具
// ============================================================================

/**
 * 安全地创建可选属性对象
 * 解决 exactOptionalPropertyTypes: true 时的类型问题
 */
export function createOptionalObject<T extends Record<string, unknown>>(
  obj: T
): SafeOptional<T, keyof T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // 只包含已定义的属性，不包含 undefined
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as SafeOptional<T, keyof T>;
}

/**
 * 安全地合并可选属性
 */
export function mergeOptionalObjects<T extends Record<string, unknown>>(
  base: T,
  optional: Partial<T>
): T {
  const result = { ...base };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
  }

  return result;
}

/**
 * 安全地设置可选属性
 */
export function setOptionalProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K] | undefined
): T {
  if (value === undefined) {
    const { [key]: omitted, ...rest } = obj;
    return rest as T;
  }

  return { ...obj, [key]: value } as T;
}

/**
 * 安全地获取可选属性
 */
export function getOptionalProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: NonNullable<T[K]>
): NonNullable<T[K]> {
  const value = obj[key];
  return (value as NonNullable<T[K]>) ?? defaultValue;
}

// ============================================================================
// 组件 Props 安全工具
// ============================================================================

/**
 * 安全地创建组件 props
 * 确保 undefined 属性不会被传递
 */
export function createComponentProps<T extends Record<string, unknown>>(
  props: T
): SafeOptional<T, keyof T> {
  return createOptionalObject(props);
}

/**
 * 安全地合并组件 props
 */
export function mergeComponentProps<T extends Record<string, unknown>>(
  defaultProps: T,
  props: Partial<T>
): SafeOptional<T, keyof T> {
  const merged = mergeOptionalObjects(defaultProps, props);
  return createOptionalObject(merged);
}

/**
 * 安全地处理可选的回调函数
 */
export function safeCallback<T extends (...args: any[]) => any>(
  callback?: T
): T | undefined {
  return callback;
}

/**
 * 安全地调用可选函数
 */
export function safeInvoke<T extends (...args: any[]) => any>(
  fn?: T,
  ...args: Parameters<T>
): ReturnType<T> | undefined {
  if (typeof fn === 'function') {
    return fn(...args);
  }
  return undefined;
}

// ============================================================================
// 数组和对象安全工具
// ============================================================================

/**
 * 安全地访问数组元素
 */
export function safeArrayAccess<T>(
  array: T[] | undefined,
  index: number,
  defaultValue: T
): T {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }
  return array[index]!;
}

/**
 * 安全地访问对象属性
 */
export function safeObjectAccess<T extends Record<string, unknown>, K extends keyof T>(
  obj: T | undefined,
  key: K,
  defaultValue: NonNullable<T[K]>
): NonNullable<T[K]> {
  if (obj == null || obj[key] == null) {
    return defaultValue;
  }
  return obj[key] as NonNullable<T[K]>;
}

/**
 * 安全地过滤数组
 */
export function safeFilter<T>(
  array: T[] | undefined,
  predicate: (item: T, index: number) => boolean
): T[] {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.filter(predicate);
}

/**
 * 安全地映射数组
 */
export function safeMap<T, U>(
  array: T[] | undefined,
  mapper: (item: T, index: number) => U
): U[] {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.map(mapper);
}

// ============================================================================
// React 组件类型安全工具
// ============================================================================

/**
 * 安全的 React.memo 比较函数
 * 避免因为 exactOptionalPropertyTypes 导致的问题
 */
export function createSafeMemoCompare<T extends Record<string, unknown>>(
  keys: (keyof T)[]
): (prevProps: T, nextProps: T) => boolean {
  return (prevProps: T, nextProps: T): boolean => {
    for (const key of keys) {
      const prevValue = prevProps[key];
      const nextValue = nextProps[key];

      // 处理 undefined 值的比较
      if (prevValue !== nextValue) {
        // 如果两者都是 undefined，认为它们相等
        if (prevValue === undefined && nextValue === undefined) {
          continue;
        }
        return false;
      }
    }
    return true;
  };
}

/**
 * 安全的 useMemo 依赖数组创建
 * 过滤掉 undefined 值
 */
export function createSafeMemoDeps(deps: unknown[]): unknown[] {
  return deps.filter(dep => dep !== undefined);
}

/**
 * 安全的 useCallback 依赖数组创建
 */
export function createSafeCallbackDeps(deps: unknown[]): unknown[] {
  return createSafeMemoDeps(deps);
}

/**
 * 安全地处理 ref.current
 */
export function safeRefValue<T>(ref: { current: T | null | undefined }): T | null {
  return ref.current ?? null;
}

/**
 * 安全地设置 ref 值
 */
export function safeSetRef<T>(
  ref: { current: T | null | undefined },
  value: T | null | undefined
): void {
  (ref as { current: T | null | undefined }).current = value;
}

// ============================================================================
// 事件处理器安全工具
// ============================================================================

/**
 * 安全地创建事件处理器
 */
export function safeEventHandler<T extends Event>(
  handler?: (event: T) => void
): ((event: T) => void) | undefined {
  return handler;
}

/**
 * 安全地调用事件处理器
 */
export function safeTriggerEvent<T extends Event>(
  handler?: (event: T) => void,
  event?: T
): void {
  if (handler && event) {
    handler(event);
  }
}

// ============================================================================
// 异步操作安全工具
// ============================================================================

/**
 * 安全地创建 Promise
 */
export function safePromise<T>(
  executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void
): Promise<T> {
  return new Promise(executor);
}

/**
 * 安全地处理 Promise 结果
 */
export async function safePromiseResult<T>(
  promise: Promise<T>
): Promise<[T, null] | [null, Error]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error('Unknown error')];
  }
}

// ============================================================================
// 导出所有工具
// ============================================================================

export {
  type SafeOptional,
  type NonNullable
};