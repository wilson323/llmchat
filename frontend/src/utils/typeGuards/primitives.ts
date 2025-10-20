/**
 * 基础类型守卫工具函数
 * 
 * 提供TypeScript的运行时类型检查能力
 * 使用类型谓词(type predicate)实现类型收窄
 * 
 * @module typeGuards/primitives
 */

/**
 * 检查值是否为字符串类型
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为string类型
 * @example
 * ```typescript
 * const val: unknown = "hello";
 * if (isString(val)) {
 *   console.log(val.toUpperCase()); // TypeScript知道val是string
 * }
 * ```
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 检查值是否为数字类型（排除NaN）
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为number类型
 * @example
 * ```typescript
 * const val: unknown = 42;
 * if (isNumber(val)) {
 *   console.log(val.toFixed(2)); // TypeScript知道val是number
 * }
 * ```
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 检查值是否为布尔类型
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为boolean类型
 * @example
 * ```typescript
 * const val: unknown = true;
 * if (isBoolean(val)) {
 *   console.log(val ? 'yes' : 'no'); // TypeScript知道val是boolean
 * }
 * ```
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 检查值是否已定义（非null且非undefined）
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为非null/undefined类型
 * @example
 * ```typescript
 * const val: string | null | undefined = "hello";
 * if (isDefined(val)) {
 *   console.log(val.length); // TypeScript知道val不是null或undefined
 * }
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 检查值是否为null
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为null类型
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * 检查值是否为undefined
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为undefined类型
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * 检查值是否为函数
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为Function类型
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * 检查值是否为Date对象
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为Date类型
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * 检查值是否为有效的ISO日期字符串
 * 
 * @param value - 待检查的值
 * @returns 如果是有效的ISO日期字符串则返回true
 */
export function isISODateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

