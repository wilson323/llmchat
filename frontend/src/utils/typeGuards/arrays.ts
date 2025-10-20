/**
 * 数组类型守卫工具函数
 * 
 * 提供数组结构验证和元素类型检查能力
 * 
 * @module typeGuards/arrays
 */

import { isDefined } from './primitives';

/**
 * 检查值是否为数组
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为Array<unknown>
 * @example
 * ```typescript
 * const val: unknown = [1, 2, 3];
 * if (isArray(val)) {
 *   console.log(val.length); // TypeScript知道val是数组
 * }
 * ```
 */
export function isArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value);
}

/**
 * 检查值是否为指定元素类型的数组
 * 
 * @param value - 待检查的值
 * @param guard - 元素类型守卫函数
 * @returns 类型谓词，true时value被收窄为Array<T>
 * @example
 * ```typescript
 * const val: unknown = ["a", "b", "c"];
 * if (isArrayOf(val, isString)) {
 *   // TypeScript知道val是string[]
 *   console.log(val.join(',')); 
 * }
 * ```
 */
export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is Array<T> {
  return Array.isArray(value) && value.every(guard);
}

/**
 * 过滤数组中的null和undefined值
 * 
 * @param array - 源数组
 * @returns 过滤后的数组（所有元素都已定义）
 * @example
 * ```typescript
 * const arr = [1, null, 2, undefined, 3];
 * const filtered = filterDefined(arr); // [1, 2, 3]
 * ```
 */
export function filterDefined<T>(
  array: Array<T | null | undefined>
): Array<T> {
  return array.filter(isDefined);
}

/**
 * 根据类型守卫函数过滤数组
 * 
 * @param array - 源数组
 * @param guard - 类型守卫函数
 * @returns 过滤后的类型安全数组
 * @example
 * ```typescript
 * const arr: Array<string | number> = [1, "a", 2, "b"];
 * const strings = filterByType(arr, isString); // ["a", "b"]
 * ```
 */
export function filterByType<T, U extends T>(
  array: Array<T>,
  guard: (item: T) => item is U
): Array<U> {
  return array.filter(guard);
}

/**
 * 检查数组是否为空
 * 
 * @param value - 待检查的值
 * @returns 如果是空数组则返回true
 */
export function isEmptyArray(value: unknown): value is Array<never> {
  return Array.isArray(value) && value.length === 0;
}

/**
 * 检查数组是否非空
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为至少有一个元素的数组
 */
export function isNonEmptyArray<T>(value: Array<T>): value is [T, ...Array<T>] {
  return value.length > 0;
}

/**
 * 安全获取数组第一个元素
 * 
 * @param array - 源数组
 * @returns 第一个元素或undefined
 */
export function first<T>(array: Array<T>): T | undefined {
  return array[0];
}

/**
 * 安全获取数组最后一个元素
 * 
 * @param array - 源数组
 * @returns 最后一个元素或undefined
 */
export function last<T>(array: Array<T>): T | undefined {
  return array[array.length - 1];
}

/**
 * 数组去重（基于值相等性）
 * 
 * @param array - 源数组
 * @returns 去重后的数组
 */
export function unique<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}

/**
 * 数组分块
 * 
 * @param array - 源数组
 * @param size - 每块大小
 * @returns 分块后的二维数组
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const chunks = chunk(arr, 2); // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const result: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

