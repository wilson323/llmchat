/**
 * API服务类型验证工具
 *
 * 提供运行时类型检查和数据验证功能
 */

import type { JsonValue, JsonObject } from '@llmchat/shared-types';
import type { ApiErrorType } from '../types/api-errors';
import { ApiErrorFactory } from '../types/api-errors';

// ============================================================================
// 类型验证器基础接口
// ============================================================================

/**
 * 验证结果接口
 */
export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

/**
 * 类型验证器接口
 */
export interface TypeValidator<T = any> {
  validate(value: unknown): ValidationResult<T>;
  getTypeName(): string;
}

/**
 * 验证器创建函数
 */
export type ValidatorFactory<T> = () => TypeValidator<T>;

// ============================================================================
// 基础类型验证器
// ============================================================================

/**
 * 字符串验证器
 */
export class StringValidator implements TypeValidator<string> {
  constructor(
    private options: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      required?: boolean;
      trim?: boolean;
    } = {}
  ) {}

  validate(value: unknown): ValidationResult<string> {
    const errors: string[] = [];

    // 检查必填
    if (this.options.required && (value === null || value === undefined || value === '')) {
      errors.push('字段是必填的');
      return { isValid: false, errors };
    }

    // 允许空值（非必填）
    if (!this.options.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // 类型检查
    if (typeof value !== 'string') {
      errors.push('必须是字符串类型');
      return { isValid: false, errors };
    }

    let processedValue = value;

    // 去除空格
    if (this.options.trim) {
      processedValue = value.trim();
    }

    // 长度检查
    if (this.options.minLength !== undefined && processedValue.length < this.options.minLength) {
      errors.push(`长度不能少于${this.options.minLength}个字符`);
    }

    if (this.options.maxLength !== undefined && processedValue.length > this.options.maxLength) {
      errors.push(`长度不能超过${this.options.maxLength}个字符`);
    }

    // 正则表达式检查
    if (this.options.pattern && !this.options.pattern.test(processedValue)) {
      errors.push('格式不正确');
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? processedValue : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getTypeName(): string {
    return 'string';
  }
}

/**
 * 数字验证器
 */
export class NumberValidator implements TypeValidator<number> {
  constructor(
    private options: {
      min?: number;
      max?: number;
      integer?: boolean;
      positive?: boolean;
      required?: boolean;
    } = {}
  ) {}

  validate(value: unknown): ValidationResult<number> {
    const errors: string[] = [];

    // 检查必填
    if (this.options.required && (value === null || value === undefined)) {
      errors.push('字段是必填的');
      return { isValid: false, errors };
    }

    // 允许空值（非必填）
    if (!this.options.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // 类型检查
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push('必须是数字类型');
      return { isValid: false, errors };
    }

    // 正数检查
    if (this.options.positive && value <= 0) {
      errors.push('必须是正数');
    }

    // 整数检查
    if (this.options.integer && !Number.isInteger(value)) {
      errors.push('必须是整数');
    }

    // 范围检查
    if (this.options.min !== undefined && value < this.options.min) {
      errors.push(`不能小于${this.options.min}`);
    }

    if (this.options.max !== undefined && value > this.options.max) {
      errors.push(`不能大于${this.options.max}`);
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? value : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getTypeName(): string {
    return 'number';
  }
}

/**
 * 布尔值验证器
 */
export class BooleanValidator implements TypeValidator<boolean> {
  constructor(private options: { required?: boolean } = {}) {}

  validate(value: unknown): ValidationResult<boolean> {
    const errors: string[] = [];

    // 检查必填
    if (this.options.required && (value === null || value === undefined)) {
      errors.push('字段是必填的');
      return { isValid: false, errors };
    }

    // 允许空值（非必填）
    if (!this.options.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // 类型检查
    if (typeof value !== 'boolean') {
      errors.push('必须是布尔类型');
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      data: value
    };
  }

  getTypeName(): string {
    return 'boolean';
  }
}

/**
 * 数组验证器
 */
export class ArrayValidator<T> implements TypeValidator<T[]> {
  constructor(
    private itemValidator: TypeValidator<T>,
    private options: {
      minLength?: number;
      maxLength?: number;
      required?: boolean;
    } = {}
  ) {}

  validate(value: unknown): ValidationResult<T[]> {
    const errors: string[] = [];

    // 检查必填
    if (this.options.required && (value === null || value === undefined)) {
      errors.push('字段是必填的');
      return { isValid: false, errors };
    }

    // 允许空值（非必填）
    if (!this.options.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // 类型检查
    if (!Array.isArray(value)) {
      errors.push('必须是数组类型');
      return { isValid: false, errors };
    }

    // 长度检查
    if (this.options.minLength !== undefined && value.length < this.options.minLength) {
      errors.push(`数组长度不能少于${this.options.minLength}`);
    }

    if (this.options.maxLength !== undefined && value.length > this.options.maxLength) {
      errors.push(`数组长度不能超过${this.options.maxLength}`);
    }

    // 验证每个元素
    const validatedItems: T[] = [];
    const itemErrors: string[] = [];

    value.forEach((item, index) => {
      const result = this.itemValidator.validate(item);
      if (result.isValid) {
        validatedItems.push(result.data!);
      } else {
        itemErrors.push(`索引${index}: ${result.errors?.join(', ')}`);
      }
    });

    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? validatedItems : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getTypeName(): string {
    return `${this.itemValidator.getTypeName()}[]`;
  }
}

/**
 * 对象验证器
 */
export class ObjectValidator<T extends JsonObject> implements TypeValidator<T> {
  constructor(
    private schema: Record<keyof T, TypeValidator<any>>,
    private options: {
      strict?: boolean; // 严格模式：不允许额外字段
      required?: (keyof T)[];
    } = {}
  ) {}

  validate(value: unknown): ValidationResult<T> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 类型检查
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push('必须是对象类型');
      return { isValid: false, errors };
    }

    const obj = value as Record<string, unknown>;
    const validatedObj: Partial<T> = {};

    // 验证每个字段
    Object.entries(this.schema).forEach(([key, validator]) => {
      const fieldValue = obj[key];
      const result = validator.validate(fieldValue);

      if (result.isValid && result.data !== undefined) {
        (validatedObj as any)[key] = result.data;
      } else if (result.errors) {
        errors.push(`${key}: ${result.errors.join(', ')}`);
      }
    });

    // 检查必填字段
    if (this.options.required) {
      this.options.required.forEach(key => {
        if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
          errors.push(`${key as string}: 是必填字段`);
        }
      });
    }

    // 严格模式检查
    if (this.options.strict) {
      Object.keys(obj).forEach(key => {
        if (!(key in this.schema)) {
          warnings.push(`${key}: 不允许的字段`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? validatedObj as T : undefined,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  getTypeName(): string {
    const fields = Object.entries(this.schema)
      .map(([key, validator]) => `${key}: ${validator.getTypeName()}`)
      .join(', ');
    return `{${fields}}`;
  }
}

/**
 * 枚举验证器
 */
export class EnumValidator<T extends string> implements TypeValidator<T> {
  constructor(private values: T[], private options: { required?: boolean } = {}) {}

  validate(value: unknown): ValidationResult<T> {
    const errors: string[] = [];

    // 检查必填
    if (this.options.required && (value === null || value === undefined)) {
      errors.push('字段是必填的');
      return { isValid: false, errors };
    }

    // 允许空值（非必填）
    if (!this.options.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // 类型检查
    if (typeof value !== 'string') {
      errors.push('必须是字符串类型');
      return { isValid: false, errors };
    }

    // 枚举值检查
    if (!this.values.includes(value as T)) {
      errors.push(`必须是以下值之一: ${this.values.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? (value as T) : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getTypeName(): string {
    return `enum(${this.values.join('|')})`;
  }
}

/**
 * 联合类型验证器
 */
export class UnionValidator<T> implements TypeValidator<T> {
  constructor(private validators: TypeValidator<any>[], private options: { required?: boolean } = {}) {}

  validate(value: unknown): ValidationResult<T> {
    const errors: string[] = [];

    // 检查必填
    if (this.options.required && (value === null || value === undefined)) {
      errors.push('字段是必填的');
      return { isValid: false, errors };
    }

    // 允许空值（非必填）
    if (!this.options.required && (value === null || value === undefined)) {
      return { isValid: true };
    }

    // 尝试每个验证器
    for (const validator of this.validators) {
      const result = validator.validate(value);
      if (result.isValid) {
        return {
          isValid: true,
          data: result.data
        };
      }
    }

    errors.push(`无法匹配任何类型: ${this.validators.map(v => v.getTypeName()).join(' | ')}`);

    return {
      isValid: false,
      errors
    };
  }

  getTypeName(): string {
    return this.validators.map(v => v.getTypeName()).join(' | ');
  }
}

// ============================================================================
// 便捷验证器工厂函数
// ============================================================================

/**
 * 创建字符串验证器
 */
export function string(options?: ConstructorParameters<typeof StringValidator>[0]): StringValidator {
  return new StringValidator(options);
}

/**
 * 创建数字验证器
 */
export function number(options?: ConstructorParameters<typeof NumberValidator>[0]): NumberValidator {
  return new NumberValidator(options);
}

/**
 * 创建布尔值验证器
 */
export function boolean(options?: ConstructorParameters<typeof BooleanValidator>[0]): BooleanValidator {
  return new BooleanValidator(options);
}

/**
 * 创建数组验证器
 */
export function array<T>(itemValidator: TypeValidator<T>, options?: ConstructorParameters<typeof ArrayValidator<T>>[1]): ArrayValidator<T> {
  return new ArrayValidator(itemValidator, options);
}

/**
 * 创建对象验证器
 */
export function object<T extends JsonObject>(
  schema: Record<keyof T, TypeValidator<any>>,
  options?: ConstructorParameters<typeof ObjectValidator<T>>[1]
): ObjectValidator<T> {
  return new ObjectValidator(schema, options);
}

/**
 * 创建枚举验证器
 */
export function enumValue<T extends string>(values: T[], options?: ConstructorParameters<typeof EnumValidator<T>>[1]): EnumValidator<T> {
  return new EnumValidator(values, options);
}

/**
 * 创建联合验证器
 */
export function union<T>(validators: TypeValidator<any>[], options?: ConstructorParameters<typeof UnionValidator<T>>[1]): UnionValidator<T> {
  return new UnionValidator(validators, options);
}

/**
 * 创建可选验证器
 */
export function optional<T>(validator: TypeValidator<T>): TypeValidator<T | undefined> {
  return {
    validate(value: unknown): ValidationResult<T | undefined> {
      if (value === undefined || value === null) {
        return { isValid: true };
      }
      return validator.validate(value);
    },
    getTypeName(): string {
      return `${validator.getTypeName()} | undefined`;
    }
  };
}

// ============================================================================
// API响应验证器
// ============================================================================

/**
 * API响应验证器
 */
export class ApiResponseValidator<T> {
  constructor(private dataValidator: TypeValidator<T>) {}

  validate(response: unknown): ValidationResult<{
    code: string;
    message: string;
    data: T;
    timestamp: string;
    requestId?: string;
  }> {
    const errors: string[] = [];

    // 检查响应是否为对象
    if (typeof response !== 'object' || response === null) {
      errors.push('响应必须是对象');
      return { isValid: false, errors };
    }

    const resp = response as Record<string, unknown>;

    // 验证必需字段
    const requiredFields = ['code', 'message', 'data', 'timestamp'];
    for (const field of requiredFields) {
      if (!(field in resp)) {
        errors.push(`缺少必需字段: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // 验证字段类型
    if (typeof resp.code !== 'string') {
      errors.push('code必须是字符串');
    }

    if (typeof resp.message !== 'string') {
      errors.push('message必须是字符串');
    }

    if (typeof resp.timestamp !== 'string') {
      errors.push('timestamp必须是字符串');
    }

    if (resp.requestId !== undefined && typeof resp.requestId !== 'string') {
      errors.push('requestId必须是字符串');
    }

    // 验证数据字段
    const dataResult = this.dataValidator.validate(resp.data);
    if (!dataResult.isValid) {
      errors.push(`data字段验证失败: ${dataResult.errors?.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? {
        code: resp.code as string,
        message: resp.message as string,
        data: dataResult.data!,
        timestamp: resp.timestamp as string,
        requestId: resp.requestId as string | undefined
      } : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

// ============================================================================
// 运行时类型检查工具
// ============================================================================

/**
 * 运行时类型检查工具类
 */
export class RuntimeTypeChecker {
  /**
   * 检查值是否符合指定类型
   */
  static check<T>(value: unknown, validator: TypeValidator<T>): value is T {
    const result = validator.validate(value);
    return result.isValid;
  }

  /**
   * 断言值符合指定类型
   */
  static assert<T>(value: unknown, validator: TypeValidator<T>): asserts value is T {
    const result = validator.validate(value);
    if (!result.isValid) {
      throw new Error(`类型验证失败: ${result.errors?.join(', ')}`);
    }
  }

  /**
   * 安全地转换值到指定类型
   */
  static safeConvert<T>(value: unknown, validator: TypeValidator<T>): ValidationResult<T> {
    return validator.validate(value);
  }

  /**
   * 创建API响应验证器
   */
  static createApiResponseValidator<T>(dataValidator: TypeValidator<T>): ApiResponseValidator<T> {
    return new ApiResponseValidator(dataValidator);
  }
}

// ============================================================================
// 常用验证器预设
// ============================================================================

/**
 * 常用验证器预设
 */
export const CommonValidators = {
  // ID验证器
  id: string({ required: true, minLength: 1, maxLength: 50 }),

  // 用户名验证器
  username: string({
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/
  }),

  // 邮箱验证器
  email: string({
    required: false,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  }),

  // 密码验证器
  password: string({
    required: true,
    minLength: 8,
    maxLength: 128
  }),

  // 时间戳验证器
  timestamp: string({
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
  }),

  // 状态验证器
  status: enumValue(['active', 'inactive', 'error', 'loading'], { required: false }),

  // 角色验证器
  role: enumValue(['admin', 'user', 'guest'], { required: false }),

  // 分页参数验证器
  page: number({ required: false, min: 1, integer: true }),
  pageSize: number({ required: false, min: 1, max: 100, integer: true }),

  // 布尔值验证器
  booleanField: boolean({ required: false })
};