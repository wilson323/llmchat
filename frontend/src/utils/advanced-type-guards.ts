/**
 * 高级类型守卫工具库
 *
 * 提供企业级的运行时类型验证、类型断言和类型安全工具函数集。
 * 专为LLMChat前端项目设计，确保100%类型安全。
 *
 * @module advanced-type-guards
 * @version 2.0.0
 * @since 2025-10-18
 */

// ============================================================================
// 导入基础类型守卫
// ============================================================================

import {
  isDefined,
  isOfType,
  getOrDefault,
  filterDefined,
  isArrayOf,
  filterByType,
  assertDefined,
  assertType,
  isString,
  isNumber,
  isBoolean,
  isObject,
  hasProperty,
  safeJsonParse,
  createEnumGuard,
} from './type-guards';

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 验证结果接口
 */
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  data?: T;
  errors?: string[];
}

/**
 * 类型验证器函数类型
 */
export type TypeValidator<T> = (value: unknown) => value is T;

/**
 * 同步验证器函数类型
 */
export type SyncValidator<T> = (value: unknown) => ValidationResult<T>;

/**
 * 异步验证器函数类型
 */
export type AsyncValidator<T> = (value: unknown) => Promise<ValidationResult<T>>;

/**
 * 对象属性验证配置
 */
export interface PropertyValidation<T extends Record<string, any>> {
  required?: boolean;
  validator: TypeValidator<T[keyof T]>;
  defaultValue?: T[keyof T];
  transform?: (value: unknown) => T[keyof T];
}

/**
 * 对象验证配置
 */
export interface ObjectValidationConfig<T extends Record<string, any>> {
  strict?: boolean; // 是否严格模式（不允许额外属性）
  allowUnknown?: boolean; // 是否允许未知属性
  transform?: (value: unknown) => Record<string, unknown>;
}

// ============================================================================
// 高级对象类型守卫
// ============================================================================

/**
 * 创建对象类型守卫
 *
 * @template T 对象类型
 * @param properties 属性验证配置
 * @param config 验证配置
 * @returns 对象类型守卫函数
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 *   age?: number;
 * }
 *
 * const isUser = createObjectGuard<User>({
 *   id: { validator: isString, required: true },
 *   name: { validator: isString, required: true },
 *   age: { validator: isNumber, required: false, defaultValue: 0 }
 * });
 *
 * const data: unknown = fetchData();
 * if (isUser(data)) {
 *   console.log(data.name); // 类型安全
 * }
 * ```
 */
export function createObjectGuard<T extends Record<string, any>>(
  properties: { [K in keyof T]: PropertyValidation<T> },
  config: ObjectValidationConfig<T> = { strict: false, allowUnknown: true }
): TypeValidator<T> {
  return (value: unknown): value is T => {
    if (!isObject(value)) {
      return false;
    }

    // 检查必需属性
    for (const [key, propConfig] of Object.entries(properties)) {
      const hasKey = key in value;

      if (propConfig.required && !hasKey) {
        return false;
      }

      if (hasKey) {
        const propValue = value[key];

        // 如果有转换函数，先转换值
        const finalValue = propConfig.transform ? propConfig.transform(propValue) : propValue;

        if (!propConfig.validator(finalValue)) {
          return false;
        }
      }
    }

    // 严格模式检查
    if (config.strict) {
      const allowedKeys = new Set(Object.keys(properties));
      const actualKeys = Object.keys(value);

      if (!config.allowUnknown) {
        for (const key of actualKeys) {
          if (!allowedKeys.has(key)) {
            return false;
          }
        }
      }
    }

    return true;
  };
}

/**
 * 创建对象验证器（返回详细验证结果）
 *
 * @template T 对象类型
 * @param properties 属性验证配置
 * @param config 验证配置
 * @returns 对象验证器函数
 */
export function createObjectValidator<T extends Record<string, any>>(
  properties: { [K in keyof T]: PropertyValidation<T> },
  config: ObjectValidationConfig<T> = { strict: false, allowUnknown: true }
): SyncValidator<T> {
  return (value: unknown): ValidationResult<T> => {
    const errors: string[] = [];

    if (!isObject(value)) {
      errors.push('Value must be an object');
      return { isValid: false, errors };
    }

    const result: Record<string, any> = {};

    // 检查和转换属性
    for (const [key, propConfig] of Object.entries(properties)) {
      const hasKey = key in value;

      if (propConfig.required && !hasKey) {
        errors.push(`Required property '${key}' is missing`);

        // 使用默认值
        if (propConfig.defaultValue !== undefined) {
          result[key] = propConfig.defaultValue;
        }
        continue;
      }

      if (hasKey) {
        const propValue = value[key];

        try {
          // 如果有转换函数，先转换值
          const finalValue = propConfig.transform ? propConfig.transform(propValue) : propValue;

          if (!propConfig.validator(finalValue)) {
            errors.push(`Property '${key}' is invalid`);

            // 使用默认值
            if (propConfig.defaultValue !== undefined) {
              result[key] = propConfig.defaultValue;
            }
          } else {
            result[key] = finalValue;
          }
        } catch (error) {
          errors.push(`Property '${key}' transformation failed: ${error}`);

          // 使用默认值
          if (propConfig.defaultValue !== undefined) {
            result[key] = propConfig.defaultValue;
          }
        }
      } else if (propConfig.defaultValue !== undefined) {
        result[key] = propConfig.defaultValue;
      }
    }

    // 严格模式检查未知属性
    if (config.strict && !config.allowUnknown) {
      const allowedKeys = new Set(Object.keys(properties));
      const actualKeys = Object.keys(value);

      for (const key of actualKeys) {
        if (!allowedKeys.has(key)) {
          errors.push(`Unknown property '${key}' found`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? result as T : undefined,
      errors
    };
  };
}

// ============================================================================
// 数组类型守卫增强
// ============================================================================

/**
 * 创建精确的数组类型守卫（支持长度和元素验证）
 *
 * @template T 数组元素类型
 * @param elementValidator 元素验证器
 * @param options 数组验证选项
 * @returns 数组类型守卫函数
 */
export function createArrayGuard<T>(
  elementValidator: TypeValidator<T>,
  options: {
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
    allowEmpty?: boolean;
  } = {}
): TypeValidator<T[]> {
  return (value: unknown): value is T[] => {
    if (!Array.isArray(value)) {
      return false;
    }

    const { minLength, maxLength, exactLength, allowEmpty = true } = options;

    // 检查数组长度
    if (exactLength !== undefined && value.length !== exactLength) {
      return false;
    }

    if (minLength !== undefined && value.length < minLength) {
      return false;
    }

    if (maxLength !== undefined && value.length > maxLength) {
      return false;
    }

    if (!allowEmpty && value.length === 0) {
      return false;
    }

    // 检查所有元素
    return value.every(elementValidator);
  };
}

/**
 * 创建数组验证器（返回详细验证结果）
 */
export function createArrayValidator<T>(
  elementValidator: SyncValidator<T>,
  options: {
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
    allowEmpty?: boolean;
    stopOnFirstError?: boolean;
  } = {}
): SyncValidator<T[]> {
  return (value: unknown): ValidationResult<T[]> => {
    const errors: string[] = [];

    if (!Array.isArray(value)) {
      errors.push('Value must be an array');
      return { isValid: false, errors };
    }

    const { minLength, maxLength, exactLength, allowEmpty = true, stopOnFirstError = false } = options;

    // 检查数组长度
    if (exactLength !== undefined && value.length !== exactLength) {
      errors.push(`Array must have exactly ${exactLength} elements`);
    }

    if (minLength !== undefined && value.length < minLength) {
      errors.push(`Array must have at least ${minLength} elements`);
    }

    if (maxLength !== undefined && value.length > maxLength) {
      errors.push(`Array must have at most ${maxLength} elements`);
    }

    if (!allowEmpty && value.length === 0) {
      errors.push('Array cannot be empty');
    }

    // 验证所有元素
    const validElements: T[] = [];
    const elementErrors: string[] = [];

    for (let i = 0; i < value.length; i++) {
      const elementResult = elementValidator(value[i]);

      if (elementResult.isValid) {
        validElements.push(elementResult.data!);
      } else {
        const elementError = `Element at index ${i}: ${elementResult.errors?.join(', ')}`;
        elementErrors.push(elementError);

        if (stopOnFirstError) {
          break;
        }
      }
    }

    if (elementErrors.length > 0) {
      errors.push(...elementErrors);
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? validElements : undefined,
      errors
    };
  };
}

// ============================================================================
// 联合类型和字面量类型守卫
// ============================================================================

/**
 * 创建联合类型守卫
 *
 * @template T 联合类型
 * @param validators 验证器数组
 * @returns 联合类型守卫函数
 */
export function createUnionGuard<T>(
  validators: Array<TypeValidator<any>>
): TypeValidator<T> {
  return (value: unknown): value is T => {
    return validators.some(validator => validator(value));
  };
}

/**
 * 创建字面量类型守卫
 *
 * @template T 字面量类型
 * @param literals 字面量值数组
 * @returns 字面量类型守卫函数
 */
export function createLiteralGuard<T extends string | number | boolean>(
  literals: readonly T[]
): TypeValidator<T> {
  return (value: unknown): value is T => {
    return literals.includes(value as T);
  };
}

/**
 * 创建可空类型守卫
 *
 * @template T 非空类型
 * @param validator 基础验证器
 * @returns 可空类型守卫函数
 */
export function createNullableGuard<T>(
  validator: TypeValidator<T>
): TypeValidator<T | null | undefined> {
  return (value: unknown): value is T | null | undefined => {
    return value === null || value === undefined || validator(value);
  };
}

// ============================================================================
// 异步类型守卫
// ============================================================================

/**
 * 创建异步类型守卫
 *
 * @template T 类型参数
 * @param validator 异步验证函数
 * @returns 异步类型守卫函数
 */
export function createAsyncGuard<T>(
  validator: (value: unknown) => Promise<boolean>
): (value: unknown) => Promise<boolean> {
  return async (value: unknown): Promise<boolean> => {
    return await validator(value);
  };
}

/**
 * 创建异步验证器
 *
 * @template T 类型参数
 * @param validator 异步验证函数
 * @returns 异步验证器函数
 */
export function createAsyncValidator<T>(
  validator: (value: unknown) => Promise<ValidationResult<T>>
): AsyncValidator<T> {
  return async (value: unknown): Promise<ValidationResult<T>> => {
    return await validator(value);
  };
}

// ============================================================================
// 条件和复合类型守卫
// ============================================================================

/**
 * 创建条件类型守卫
 *
 * @template T 类型参数
 * @param condition 条件函数
 * @param thenValidator 条件为真时的验证器
 * @param elseValidator 条件为假时的验证器
 * @returns 条件类型守卫函数
 */
export function createConditionalGuard<T, U>(
  condition: (value: unknown) => boolean,
  thenValidator: TypeValidator<T>,
  elseValidator: TypeValidator<U>
): TypeValidator<T | U> {
  return (value: unknown): value is T | U => {
    if (condition(value)) {
      return thenValidator(value);
    } else {
      return elseValidator(value);
    }
  };
}

/**
 * 创建记录类型守卫（Record<string, T>）
 *
 * @template T 值类型
 * @param valueValidator 值验证器
 * @param keyValidator 键验证器（可选）
 * @returns 记录类型守卫函数
 */
export function createRecordGuard<T>(
  valueValidator: TypeValidator<T>,
  keyValidator: TypeValidator<string> = isString
): TypeValidator<Record<string, T>> {
  return (value: unknown): value is Record<string, T> => {
    if (!isObject(value)) {
      return false;
    }

    for (const [key, val] of Object.entries(value)) {
      if (!keyValidator(key)) {
        return false;
      }
      if (!valueValidator(val)) {
        return false;
      }
    }

    return true;
  };
}

// ============================================================================
// 常用验证器预设
// ============================================================================

/**
 * UUID验证器
 */
export const isUUID = (value: unknown): value is string => {
  return isString(value) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

/**
 * Email验证器
 */
export const isEmail = (value: unknown): value is string => {
  return isString(value) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

/**
 * URL验证器
 */
export const isURL = (value: unknown): value is string => {
  return isString(value) &&
    /^https?:\/\/.+\..+/i.test(value);
};

/**
 * 日期字符串验证器（ISO格式）
 */
export const isDateString = (value: unknown): value is string => {
  return isString(value) &&
    !isNaN(Date.parse(value));
};

/**
 * 时间戳验证器
 */
export const isTimestamp = (value: unknown): value is number => {
  return isNumber(value) &&
    value > 0 &&
    value <= Date.now() + 86400000; // 允许未来1天的时间
};

/**
 * Base64字符串验证器
 */
export const isBase64 = (value: unknown): value is string => {
  return isString(value) &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value) &&
    value.length % 4 === 0;
};

// ============================================================================
// 性能优化的类型守卫
// ============================================================================

/**
 * 创建带缓存的类型守卫
 *
 * @template T 类型参数
 * @param validator 基础验证器
 * @param maxSize 缓存大小
 * @returns 带缓存的类型守卫函数
 */
export function createCachedGuard<T>(
  validator: TypeValidator<T>,
  maxSize = 100
): TypeValidator<T> {
  const cache = new Map<any, boolean>();

  return (value: unknown): value is T => {
    if (cache.has(value)) {
      return cache.get(value)!;
    }

    const result = validator(value);

    // 缓存大小控制
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(value, result);
    return result;
  };
}

/**
 * 创建惰性验证器（只在需要时验证）
 *
 * @template T 类型参数
 * @param validatorFactory 验证器工厂函数
 * @returns 惰性验证器函数
 */
export function createLazyGuard<T>(
  validatorFactory: () => TypeValidator<T>
): TypeValidator<T> {
  let validator: TypeValidator<T> | null = null;

  return (value: unknown): value is T => {
    if (!validator) {
      validator = validatorFactory();
    }
    return validator(value);
  };
}

// ============================================================================
// 导出所有类型守卫和工具函数
// ============================================================================

// 重新导出基础类型守卫
export {
  isDefined,
  isOfType,
  getOrDefault,
  filterDefined,
  isArrayOf,
  filterByType,
  assertDefined,
  assertType,
  isString,
  isNumber,
  isBoolean,
  isObject,
  hasProperty,
  safeJsonParse,
  createEnumGuard,
};

// 导出类型定义
export type {
  ValidationResult,
  TypeValidator,
  SyncValidator,
  AsyncValidator,
  PropertyValidation,
  ObjectValidationConfig,
};