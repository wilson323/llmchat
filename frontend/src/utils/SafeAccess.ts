/**
 * 安全访问工具类 - 可选属性安全化处理
 *
 * 提供类型安全的属性访问、运行时类型验证和错误处理机制
 * 解决可选属性访问可能导致的运行时错误
 */

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 检查值是否为null或undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * 检查值是否为有效的字符串（非空、非null、非undefined）
 */
export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 检查值是否为有效的数字（非NaN、有限数字）
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * 检查值是否为有效的数组
 */
export function isValidArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length >= 0;
}

/**
 * 检查值是否为有效的对象（非null、非数组）
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 检查值是否为有效的日期
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * 检查值是否为有效的布尔值
 */
export function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// ============================================================================
// 安全访问函数
// ============================================================================

/**
 * 安全访问对象属性，支持多级嵌套访问
 * @param obj 目标对象
 * @param path 属性路径，如 'a.b.c' 或 ['a', 'b', 'c']
 * @param defaultValue 默认值
 * @returns 属性值或默认值
 */
export function safeGet<T = unknown>(
  obj: unknown,
  path: string | string[],
  defaultValue?: T
): T | undefined {
  if (!isValidObject(obj) && !Array.isArray(obj)) {
    return defaultValue;
  }

  const keys = Array.isArray(path) ? path : path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }

    if (Array.isArray(current)) {
      // 处理数组索引访问
      const index = parseInt(key, 10);
      if (isNaN(index) || index < 0 || index >= current.length) {
        return defaultValue;
      }
      current = current[index];
    } else if (isValidObject(current)) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}

/**
 * 安全获取字符串属性
 */
export function safeGetString(
  obj: unknown,
  path: string | string[],
  defaultValue = ''
): string {
  const value = safeGet(obj, path);
  return isValidString(value) ? value : defaultValue;
}

/**
 * 安全获取数字属性
 */
export function safeGetNumber(
  obj: unknown,
  path: string | string[],
  defaultValue = 0
): number {
  const value = safeGet(obj, path);
  return isValidNumber(value) ? value : defaultValue;
}

/**
 * 安全获取布尔属性
 */
export function safeGetBoolean(
  obj: unknown,
  path: string | string[],
  defaultValue = false
): boolean {
  const value = safeGet(obj, path);
  return isValidBoolean(value) ? value : defaultValue;
}

/**
 * 安全获取数组属性
 */
export function safeGetArray<T>(
  obj: unknown,
  path: string | string[],
  defaultValue: T[] = []
): T[] {
  const value = safeGet(obj, path);
  return isValidArray<T>(value) ? value : defaultValue;
}

/**
 * 安全获取对象属性
 */
export function safeGetObject<T extends Record<string, unknown>>(
  obj: unknown,
  path: string | string[],
  defaultValue: T = {} as T
): T {
  const value = safeGet(obj, path);
  return isValidObject(value) ? value as T : defaultValue;
}

/**
 * 安全获取日期属性
 */
export function safeGetDate(
  obj: unknown,
  path: string | string[],
  defaultValue?: Date
): Date | undefined {
  const value = safeGet(obj, path);

  if (isValidDate(value)) {
    return value;
  }

  if (isValidString(value)) {
    const date = new Date(value);
    return isValidDate(date) ? date : defaultValue;
  }

  if (isValidNumber(value)) {
    const date = new Date(value);
    return isValidDate(date) ? date : defaultValue;
  }

  return defaultValue;
}

// ============================================================================
// 运行时类型验证
// ============================================================================

/**
 * 类型验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 类型验证器配置
 */
export interface TypeValidatorConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: unknown[];
  customValidator?: (value: unknown) => boolean | string;
}

/**
 * 验证字符串类型
 */
export function validateString(
  value: unknown,
  config: TypeValidatorConfig = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isNullOrUndefined(value)) {
    if (config.required) {
      errors.push('值不能为空');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  if (!isValidString(value)) {
    errors.push('值必须是有效的字符串');
    return { isValid: false, errors, warnings };
  }

  if (config.minLength && value.length < config.minLength) {
    errors.push(`字符串长度不能少于${config.minLength}个字符`);
  }

  if (config.maxLength && value.length > config.maxLength) {
    errors.push(`字符串长度不能超过${config.maxLength}个字符`);
  }

  if (config.pattern && !config.pattern.test(value)) {
    errors.push('字符串格式不正确');
  }

  if (config.allowedValues && !config.allowedValues.includes(value)) {
    errors.push(`值必须是以下之一: ${config.allowedValues.join(', ')}`);
  }

  if (config.customValidator) {
    const result = config.customValidator(value);
    if (typeof result === 'string') {
      errors.push(result);
    } else if (!result) {
      errors.push('自定义验证失败');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * 验证数字类型
 */
export function validateNumber(
  value: unknown,
  config: TypeValidatorConfig = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isNullOrUndefined(value)) {
    if (config.required) {
      errors.push('值不能为空');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  if (!isValidNumber(value)) {
    errors.push('值必须是有效的数字');
    return { isValid: false, errors, warnings };
  }

  if (config.min !== undefined && value < config.min) {
    errors.push(`数字不能小于${config.min}`);
  }

  if (config.max !== undefined && value > config.max) {
    errors.push(`数字不能大于${config.max}`);
  }

  if (config.allowedValues && !config.allowedValues.includes(value)) {
    errors.push(`值必须是以下之一: ${config.allowedValues.join(', ')}`);
  }

  if (config.customValidator) {
    const result = config.customValidator(value);
    if (typeof result === 'string') {
      errors.push(result);
    } else if (!result) {
      errors.push('自定义验证失败');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * 验证数组类型
 */
export function validateArray<T>(
  value: unknown,
  config: TypeValidatorConfig & { itemValidator?: (item: unknown) => ValidationResult } = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isNullOrUndefined(value)) {
    if (config.required) {
      errors.push('值不能为空');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  if (!isValidArray(value)) {
    errors.push('值必须是有效的数组');
    return { isValid: false, errors, warnings };
  }

  if (config.minLength && value.length < config.minLength) {
    errors.push(`数组长度不能少于${config.minLength}`);
  }

  if (config.maxLength && value.length > config.maxLength) {
    errors.push(`数组长度不能超过${config.maxLength}`);
  }

  if (config.itemValidator) {
    value.forEach((item, index) => {
      const result = config.itemValidator!(item);
      if (!result.isValid) {
        errors.push(`数组索引${index}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map(w => `数组索引${index}: ${w}`));
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ============================================================================
// 错误处理和安全包装
// ============================================================================

/**
 * 安全执行函数，捕获异常并返回结果
 */
export function safeExecute<T>(
  fn: () => T,
  defaultValue?: T,
  onError?: (error: Error) => void
): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    } else {
      console.error('SafeExecute执行出错:', error);
    }
    return defaultValue;
  }
}

/**
 * 安全执行异步函数
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  defaultValue?: T,
  onError?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    } else {
      console.error('SafeExecuteAsync执行出错:', error);
    }
    return defaultValue;
  }
}

/**
 * 安全解析JSON
 */
export function safeParseJSON<T = unknown>(
  jsonString: string,
  defaultValue?: T
): T | undefined {
  return safeExecute(() => JSON.parse(jsonString) as T, defaultValue);
}

/**
 * 安全转换为数字
 */
export function safeParseNumber(
  value: unknown,
  defaultValue = 0
): number {
  if (isValidNumber(value)) {
    return value;
  }

  if (isValidString(value)) {
    const parsed = parseFloat(value);
    return isValidNumber(parsed) ? parsed : defaultValue;
  }

  return defaultValue;
}

/**
 * 安全转换为整数
 */
export function safeParseInt(
  value: unknown,
  defaultValue = 0,
  radix = 10
): number {
  if (isValidNumber(value)) {
    return Math.floor(value);
  }

  if (isValidString(value)) {
    const parsed = parseInt(value, radix);
    return isValidNumber(parsed) ? parsed : defaultValue;
  }

  return defaultValue;
}

// ============================================================================
// 高级工具函数
// ============================================================================

/**
 * 深度冻结对象，防止意外修改
 */
export function deepFreeze<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as Record<string, unknown>)[prop];
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return Object.freeze(obj);
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    Object.keys(obj).forEach(key => {
      (cloned as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key]);
    });
    return cloned;
  }

  return obj;
}

/**
 * 创建只读代理
 */
export function createReadonlyProxy<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop) {
      const value = target[prop as keyof T];
      return typeof value === 'object' && value !== null ? createReadonlyProxy(value) : value;
    },
    set() {
      throw new Error('只读对象不允许修改');
    },
    deleteProperty() {
      throw new Error('只读对象不允许删除属性');
    }
  });
}

// ============================================================================
// 导出便捷对象
// ============================================================================

export const SafeAccess = {
  // 类型守卫
  isNullOrUndefined,
  isValidString,
  isValidNumber,
  isValidArray,
  isValidObject,
  isValidDate,
  isValidBoolean,

  // 安全访问
  get: safeGet,
  getString: safeGetString,
  getNumber: safeGetNumber,
  getBoolean: safeGetBoolean,
  getArray: safeGetArray,
  getObject: safeGetObject,
  getDate: safeGetDate,

  // 验证
  validateString,
  validateNumber,
  validateArray,

  // 执行
  execute: safeExecute,
  executeAsync: safeExecuteAsync,
  parseJSON: safeParseJSON,
  parseNumber: safeParseNumber,
  parseInt: safeParseInt,

  // 高级工具
  deepFreeze,
  deepClone,
  createReadonlyProxy,
};

export default SafeAccess;