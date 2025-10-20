/**
 * 对象类型守卫工具函数
 * 
 * 提供对象结构验证和属性检查能力
 * 
 * @module typeGuards/objects
 */

import { isDefined } from './primitives';

/**
 * 检查值是否为对象（排除null和数组）
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为object类型
 * @example
 * ```typescript
 * const val: unknown = { name: "John" };
 * if (isObject(val)) {
 *   console.log(val); // TypeScript知道val是object
 * }
 * ```
 */
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 检查对象是否包含指定属性
 * 
 * @param obj - 待检查的对象
 * @param key - 属性键名
 * @returns 类型谓词，true时obj被收窄为包含该属性的Record类型
 * @example
 * ```typescript
 * const obj: unknown = { name: "John", age: 30 };
 * if (hasProperty(obj, 'name')) {
 *   console.log(obj.name); // TypeScript知道obj有name属性
 * }
 * ```
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * 检查对象是否包含多个指定属性
 * 
 * @param obj - 待检查的对象
 * @param keys - 属性键名数组
 * @returns 如果对象包含所有指定属性则返回true
 * @example
 * ```typescript
 * const obj = { id: "1", name: "John", email: "john@example.com" };
 * if (hasProperties(obj, ['id', 'name'])) {
 *   // obj一定包含id和name属性
 * }
 * ```
 */
export function hasProperties<K extends string>(
  obj: unknown,
  keys: readonly K[]
): obj is Record<K, unknown> {
  if (!isObject(obj)) return false;
  return keys.every(key => key in obj);
}

/**
 * 检查值是否为Record类型（键值对对象）
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为Record<string, unknown>
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

/**
 * 安全获取对象属性，提供默认值
 * 
 * @param obj - 源对象
 * @param key - 属性键名
 * @param defaultValue - 默认值
 * @returns 属性值或默认值
 * @example
 * ```typescript
 * const obj = { name: "John" };
 * const age = getOrDefault(obj, 'age', 0); // 返回0
 * const name = getOrDefault(obj, 'name', ''); // 返回"John"
 * ```
 */
export function getOrDefault<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: NonNullable<T[K]>
): NonNullable<T[K]> {
  const value = obj[key];
  return (isDefined(value) ? value : defaultValue) as NonNullable<T[K]>;
}

/**
 * 检查对象是否为空对象（无自有属性）
 * 
 * @param value - 待检查的值
 * @returns 如果是空对象则返回true
 */
export function isEmptyObject(value: unknown): value is Record<string, never> {
  return isObject(value) && Object.keys(value).length === 0;
}

/**
 * 深度克隆对象（仅支持JSON可序列化的对象）
 * 
 * @param obj - 源对象
 * @returns 克隆后的对象
 * @throws 如果对象包含不可序列化的值（如函数、Symbol）
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 安全的对象合并（不修改原对象）
 * 
 * @param target - 目标对象
 * @param source - 源对象
 * @returns 合并后的新对象
 */
export function safeMerge<T extends object, U extends object>(
  target: T,
  source: U
): T & U {
  return { ...target, ...source };
}

