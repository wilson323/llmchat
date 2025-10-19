/**
 * 类型守卫工具库
 *
 * 提供通用的类型检查、类型守卫和类型断言函数,
 * 用于增强TypeScript类型安全,避免运行时类型错误。
 *
 * @module type-guards
 * @since 2025-10-17
 */

/**
 * 检查值是否已定义（非 null 和 undefined）
 *
 * @template T - 值的类型
 * @param value - 要检查的值
 * @returns 如果值已定义则返回 true，类型守卫为 T
 *
 * @example
 * ```typescript
 * const value: string | null = getValue();
 * if (isDefined(value)) {
 *   // 这里 value 的类型是 string
 *   console.log(value.toUpperCase());
 * }
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 检查值是否为特定类型
 *
 * @template T - 目标类型
 * @param value - 要检查的值
 * @param validator - 类型验证函数
 * @returns 如果值符合类型则返回 true
 *
 * @example
 * ```typescript
 * const data: unknown = fetchData();
 * if (isOfType(data, isAgent)) {
 *   // 这里 data 的类型是 Agent
 *   console.log(data.name);
 * }
 * ```
 */
export function isOfType<T>(
  value: unknown,
  validator: (val: unknown) => val is T,
): value is T {
  return validator(value);
}

/**
 * 安全访问可选属性,提供默认值
 *
 * @template T - 对象类型
 * @template K - 属性键类型
 * @param obj - 源对象
 * @param key - 属性键
 * @param defaultValue - 默认值
 * @returns 属性值或默认值
 *
 * @example
 * ```typescript
 * interface Config {
 *   timeout?: number;
 * }
 * const config: Config = {};
 * const timeout = getOrDefault(config, 'timeout', 3000); // 返回 3000
 * ```
 */
export function getOrDefault<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: NonNullable<T[K]>,
): NonNullable<T[K]> {
  const value = obj[key];
  return isDefined(value) ? value as NonNullable<T[K]> : defaultValue;
}

/**
 * 过滤数组中的 undefined 和 null
 *
 * @template T - 数组元素类型
 * @param array - 源数组
 * @returns 过滤后的数组
 *
 * @example
 * ```typescript
 * const items = [1, null, 2, undefined, 3];
 * const defined = filterDefined(items); // [1, 2, 3]
 * ```
 */
export function filterDefined<T>(
  array: (T | null | undefined)[],
): T[] {
  return array.filter(isDefined);
}

/**
 * 检查数组的所有元素是否符合特定类型
 *
 * @template T - 目标元素类型
 * @param array - 要检查的数组
 * @param validator - 元素类型验证函数
 * @returns 如果所有元素都符合类型则返回 true
 *
 * @example
 * ```typescript
 * const data: unknown[] = fetchData();
 * if (isArrayOf(data, isAgent)) {
 *   // 这里 data 的类型是 Agent[]
 *   data.forEach(agent => console.log(agent.name));
 * }
 * ```
 */
export function isArrayOf<T>(
  array: unknown,
  validator: (val: unknown) => val is T,
): array is T[] {
  if (!Array.isArray(array)) {
return false;
}
  return array.every(validator);
}

/**
 * 从数组中过滤出符合特定类型的元素
 *
 * @template T - 目标元素类型
 * @param array - 源数组
 * @param validator - 元素类型验证函数
 * @returns 符合类型的元素数组
 *
 * @example
 * ```typescript
 * const mixed: unknown[] = [1, 'text', { id: '1', name: 'Agent' }];
 * const agents = filterByType(mixed, isAgent); // 只返回Agent类型的元素
 * ```
 */
export function filterByType<T>(
  array: unknown[],
  validator: (val: unknown) => val is T,
): T[] {
  return array.filter(validator);
}

/**
 * 断言值已定义,否则抛出错误
 *
 * @template T - 值的类型
 * @param value - 要检查的值
 * @param message - 错误消息
 * @throws {Error} 如果值为 null 或 undefined
 *
 * @example
 * ```typescript
 * const value: string | null = getValue();
 * assertDefined(value, 'Value must be defined');
 * // 这里 value 的类型是 string
 * console.log(value.toUpperCase());
 * ```
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value must be defined',
): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message);
  }
}

/**
 * 断言值符合特定类型,否则抛出错误
 *
 * @template T - 目标类型
 * @param value - 要检查的值
 * @param validator - 类型验证函数
 * @param message - 错误消息
 * @throws {Error} 如果值不符合类型
 *
 * @example
 * ```typescript
 * const data: unknown = fetchData();
 * assertType(data, isAgent, 'Data must be an Agent');
 * // 这里 data 的类型是 Agent
 * console.log(data.name);
 * ```
 */
export function assertType<T>(
  value: unknown,
  validator: (val: unknown) => val is T,
  message = 'Value does not match expected type',
): asserts value is T {
  if (!validator(value)) {
    throw new Error(message);
  }
}

/**
 * 检查值是否为字符串
 *
 * @param value - 要检查的值
 * @returns 如果值是字符串则返回 true
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 检查值是否为数字
 *
 * @param value - 要检查的值
 * @returns 如果值是数字且不是NaN则返回 true
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 检查值是否为布尔值
 *
 * @param value - 要检查的值
 * @returns 如果值是布尔值则返回 true
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 检查值是否为对象（非 null）
 *
 * @param value - 要检查的值
 * @returns 如果值是对象则返回 true
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 检查对象是否具有特定属性
 *
 * @template K - 属性键类型
 * @param obj - 要检查的对象
 * @param key - 属性键
 * @returns 如果对象具有该属性则返回 true
 *
 * @example
 * ```typescript
 * const data: unknown = fetchData();
 * if (isObject(data) && hasProperty(data, 'id')) {
 *   console.log(data.id); // 安全访问
 * }
 * ```
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * 安全解析JSON字符串
 *
 * @template T - 目标类型
 * @param json - JSON字符串
 * @param defaultValue - 解析失败时的默认值
 * @returns 解析后的对象或默认值
 *
 * @example
 * ```typescript
 * const config = safeJsonParse<Config>(
 *   localStorage.getItem('config'),
 *   { timeout: 3000 }
 * );
 * ```
 */
export function safeJsonParse<T>(
  json: string | null | undefined,
  defaultValue: T,
): T {
  if (!isDefined(json)) {
return defaultValue;
}

  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 创建枚举值类型守卫
 *
 * @template T - 枚举类型
 * @param enumValues - 枚举值数组
 * @returns 类型守卫函数
 *
 * @example
 * ```typescript
 * type Status = 'active' | 'inactive' | 'pending';
 * const isStatus = createEnumGuard<Status>(['active', 'inactive', 'pending']);
 *
 * const value: unknown = 'active';
 * if (isStatus(value)) {
 *   // value 的类型是 Status
 * }
 * ```
 */
export function createEnumGuard<T extends string>(
  enumValues: readonly T[],
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return isString(value) && (enumValues as readonly string[]).includes(value);
  };
}
