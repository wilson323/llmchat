/**
 * 运行时类型验证工具
 *
 * 提供全面的运行时类型验证功能，确保数据在不同层级间的类型安全。
 * 支持嵌套对象验证、数组验证、API响应验证等。
 *
 * @module runtime-type-validator
 * @version 2.0.0
 * @since 2025-10-18
 */

import {
  TypeValidator,
  SyncValidator,
  AsyncValidator,
  ValidationResult,
  createObjectValidator,
  createArrayValidator,
  createRecordGuard,
  createUnionGuard,
  createLiteralGuard,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isDefined,
  createEnumGuard,
  isUUID,
  isEmail,
  isURL,
  isDateString,
  isTimestamp,
} from './advanced-type-guards';

// ============================================================================
// 运行时验证器核心类
// ============================================================================

/**
 * 运行时类型验证器类
 *
 * 提供链式API和丰富的验证功能
 */
export class RuntimeTypeValidator<T = any> {
  private validators: Array<(value: unknown) => ValidationResult<any>> = [];
  private transformFunctions: Array<(value: any) => any> = [];
  private asyncValidators: Array<(value: unknown) => Promise<ValidationResult<any>>> = [];

  constructor(private schema?: TypeValidator<T>) {
    if (schema) {
      this.validators.push((value: unknown) => ({
        isValid: schema(value),
        data: schema(value) ? value as T : undefined,
        errors: schema(value) ? [] : ['Value does not match schema']
      }));
    }
  }

  /**
   * 添加自定义验证器
   */
  validate(validator: SyncValidator<any>): this {
    this.validators.push(validator);
    return this;
  }

  /**
   * 添加异步验证器
   */
  validateAsync(validator: AsyncValidator<any>): this {
    this.asyncValidators.push(validator);
    return this;
  }

  /**
   * 添加类型守卫验证器
   */
  is<U>(typeGuard: TypeValidator<U>, errorMessage?: string): this {
    this.validators.push((value: unknown) => ({
      isValid: typeGuard(value),
      data: typeGuard(value) ? value : undefined,
      errors: typeGuard(value) ? [] : [errorMessage || 'Type validation failed']
    }));
    return this;
  }

  /**
   * 添加必需验证
   */
  required(errorMessage = 'Value is required'): this {
    this.validators.unshift((value: unknown) => ({
      isValid: isDefined(value),
      data: value,
      errors: isDefined(value) ? [] : [errorMessage]
    }));
    return this;
  }

  /**
   * 添加可选验证
   */
  optional(): this {
    this.validators.unshift((value: unknown) => {
      if (!isDefined(value)) {
        return { isValid: true, data: value };
      }
      return { isValid: true, data: value };
    });
    return this;
  }

  /**
   * 添加默认值
   */
  default(defaultValue: T): this {
    this.validators.push((value: unknown) => ({
      isValid: true,
      data: isDefined(value) ? value as T : defaultValue
    }));
    return this;
  }

  /**
   * 添加转换函数
   */
  transform<U>(transformFn: (value: T) => U): RuntimeTypeValidator<U> {
    const newValidator = new RuntimeTypeValidator<U>();
    newValidator.validators = [...this.validators];
    newValidator.transformFunctions = [...this.transformFunctions, transformFn];
    newValidator.asyncValidators = [...this.asyncValidators];
    return newValidator;
  }

  /**
   * 添加管道验证（链式转换和验证）
   */
  pipe<U>(validator: RuntimeTypeValidator<U>): RuntimeTypeValidator<U> {
    const newValidator = new RuntimeTypeValidator<U>();
    newValidator.validators = [...this.validators, ...validator.validators];
    newValidator.transformFunctions = [...this.transformFunctions, ...validator.transformFunctions];
    newValidator.asyncValidators = [...this.asyncValidators, ...validator.asyncValidators];
    return newValidator;
  }

  /**
   * 执行同步验证
   */
  test(value: unknown): ValidationResult<T> {
    let currentValue = value;
    let allErrors: string[] = [];

    // 执行所有同步验证器
    for (const validator of this.validators) {
      const result = validator(currentValue);

      if (!result.isValid) {
        allErrors.push(...(result.errors || []));
      } else if (result.data !== undefined) {
        currentValue = result.data;
      }
    }

    // 应用转换函数
    for (const transformFn of this.transformFunctions) {
      try {
        currentValue = transformFn(currentValue);
      } catch (error) {
        allErrors.push(`Transform error: ${error}`);
      }
    }

    return {
      isValid: allErrors.length === 0,
      data: allErrors.length === 0 ? currentValue as T : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  /**
   * 执行异步验证
   */
  async testAsync(value: unknown): Promise<ValidationResult<T>> {
    // 先执行同步验证
    const syncResult = this.test(value);
    if (!syncResult.isValid) {
      return syncResult;
    }

    let currentValue = syncResult.data;
    let allErrors: string[] = [];

    // 执行异步验证器
    for (const validator of this.asyncValidators) {
      const result = await validator(currentValue);

      if (!result.isValid) {
        allErrors.push(...(result.errors || []));
      } else if (result.data !== undefined) {
        currentValue = result.data;
      }
    }

    return {
      isValid: allErrors.length === 0,
      data: allErrors.length === 0 ? currentValue as T : undefined,
      errors: allErrors.length > 0 ? allErrors : undefined
    };
  }

  /**
   * 断言验证（失败时抛出错误）
   */
  assert(value: unknown, errorMessage?: string): asserts value is T {
    const result = this.test(value);
    if (!result.isValid) {
      throw new Error(errorMessage || `Validation failed: ${result.errors?.join(', ')}`);
    }
  }

  /**
   * 安全解析（返回结果或抛出错误）
   */
  parse(value: unknown): T {
    const result = this.test(value);
    if (!result.isValid) {
      throw new Error(`Parse failed: ${result.errors?.join(', ')}`);
    }
    return result.data!;
  }

  /**
   * 安全解析异步版本
   */
  async parseAsync(value: unknown): Promise<T> {
    const result = await this.testAsync(value);
    if (!result.isValid) {
      throw new Error(`Parse failed: ${result.errors?.join(', ')}`);
    }
    return result.data!;
  }

  /**
   * 安全解析（带默认值）
   */
  safeParse(value: unknown, defaultValue: T): T {
    const result = this.test(value);
    return result.isValid ? result.data! : defaultValue;
  }

  /**
   * 创建验证器工厂函数
   */
  static create<T>(schema?: TypeValidator<T>): RuntimeTypeValidator<T> {
    return new RuntimeTypeValidator(schema);
  }
}

// ============================================================================
// 预定义验证器工厂
// ============================================================================

/**
 * 字符串验证器
 */
export const stringValidator = () => RuntimeTypeValidator.create<string>().is(isString);

/**
 * 数字验证器
 */
export const numberValidator = () => RuntimeTypeValidator.create<number>().is(isNumber);

/**
 * 布尔值验证器
 */
export const booleanValidator = () => RuntimeTypeValidator.create<boolean>().is(isBoolean);

/**
 * 对象验证器
 */
export const objectValidator = () => RuntimeTypeValidator.create<Record<string, any>>().is(isObject);

/**
 * UUID验证器
 */
export const uuidValidator = () => RuntimeTypeValidator.create<string>().is(isUUID, 'Must be a valid UUID');

/**
 * Email验证器
 */
export const emailValidator = () => RuntimeTypeValidator.create<string>().is(isEmail, 'Must be a valid email');

/**
 * URL验证器
 */
export const urlValidator = () => RuntimeTypeValidator.create<string>().is(isURL, 'Must be a valid URL');

/**
 * 日期字符串验证器
 */
export const dateStringValidator = () => RuntimeTypeValidator.create<string>().is(isDateString, 'Must be a valid date string');

/**
 * 时间戳验证器
 */
export const timestampValidator = () => RuntimeTypeValidator.create<number>().is(isTimestamp, 'Must be a valid timestamp');

/**
 * 枚举验证器工厂
 */
export const enumValidator = <T extends string>(values: readonly T[], enumName = 'enum') =>
  RuntimeTypeValidator.create<T>().is(createEnumGuard(values), `Must be a valid ${enumName}`);

/**
 * 字面量验证器工厂
 */
export const literalValidator = <T extends string | number | boolean>(values: readonly T[], literalName = 'literal') =>
  RuntimeTypeValidator.create<T>().is(createLiteralGuard(values), `Must be a valid ${literalName}`);

/**
 * 数组验证器工厂
 */
export const arrayValidator = <T>(
  elementValidator: RuntimeTypeValidator<T>,
  options?: {
    minLength?: number;
    maxLength?: number;
    exactLength?: number;
    allowEmpty?: boolean;
  }
) => {
  const validator = RuntimeTypeValidator.create<T[]>();

  if (options?.minLength !== undefined) {
    validator.validate((value: unknown) => {
      if (!Array.isArray(value)) {
        return { isValid: false, errors: ['Must be an array'] };
      }
      if (value.length < options.minLength!) {
        return { isValid: false, errors: [`Array must have at least ${options.minLength} elements`] };
      }
      return { isValid: true, data: value };
    });
  }

  if (options?.maxLength !== undefined) {
    validator.validate((value: unknown) => {
      if (!Array.isArray(value)) {
        return { isValid: false, errors: ['Must be an array'] };
      }
      if (value.length > options.maxLength!) {
        return { isValid: false, errors: [`Array must have at most ${options.maxLength} elements`] };
      }
      return { isValid: true, data: value };
    });
  }

  if (options?.exactLength !== undefined) {
    validator.validate((value: unknown) => {
      if (!Array.isArray(value)) {
        return { isValid: false, errors: ['Must be an array'] };
      }
      if (value.length !== options.exactLength!) {
        return { isValid: false, errors: [`Array must have exactly ${options.exactLength} elements`] };
      }
      return { isValid: true, data: value };
    });
  }

  if (!options?.allowEmpty) {
    validator.validate((value: unknown) => {
      if (!Array.isArray(value)) {
        return { isValid: false, errors: ['Must be an array'] };
      }
      if (value.length === 0) {
        return { isValid: false, errors: ['Array cannot be empty'] };
      }
      return { isValid: true, data: value };
    });
  }

  // 验证每个元素
  validator.validate((value: unknown) => {
    if (!Array.isArray(value)) {
      return { isValid: false, errors: ['Must be an array'] };
    }

    const results = value.map((item, index) => {
      const result = elementValidator.test(item);
      return { index, result };
    });

    const errors = results
      .filter(({ result }) => !result.isValid)
      .map(({ index, result }) => `Element at index ${index}: ${result.errors?.join(', ')}`);

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return { isValid: true, data: value };
  });

  return validator;
};

/**
 * 对象验证器工厂
 */
export const objectValidatorFactory = <T extends Record<string, any>>(
  shape: { [K in keyof T]: RuntimeTypeValidator<T[K]> },
  options?: {
    strict?: boolean;
    allowUnknown?: boolean;
  }
) => {
  const validator = RuntimeTypeValidator.create<T>();

  validator.validate((value: unknown) => {
    if (!isObject(value)) {
      return { isValid: false, errors: ['Value must be an object'] };
    }

    const result: Record<string, any> = {};
    const errors: string[] = [];

    // 验证每个属性
    for (const [key, keyValidator] of Object.entries(shape)) {
      const propValue = value[key];
      const propResult = keyValidator.test(propValue);

      if (!propResult.isValid) {
        errors.push(`Property '${key}': ${propResult.errors?.join(', ')}`);
      } else {
        result[key] = propResult.data;
      }
    }

    // 严格模式检查
    if (options?.strict && !options?.allowUnknown) {
      const allowedKeys = Object.keys(shape);
      const unknownKeys = Object.keys(value).filter(key => !allowedKeys.includes(key));

      if (unknownKeys.length > 0) {
        errors.push(`Unknown properties: ${unknownKeys.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      data: errors.length === 0 ? result as T : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  });

  return validator;
};

// ============================================================================
// 高级验证工具
// ============================================================================

/**
 * 嵌套对象路径验证器
 */
export class PathValidator {
  constructor(private obj: unknown) {}

  /**
   * 验证路径是否存在且有效
   */
  path<T>(path: string, validator: RuntimeTypeValidator<T>): PathValidator {
    const keys = path.split('.');
    let current = this.obj;

    for (const key of keys) {
      if (!isObject(current) || !(key in current)) {
        throw new Error(`Path '${path}' does not exist`);
      }
      current = current[key];
    }

    const result = validator.test(current);
    if (!result.isValid) {
      throw new Error(`Path '${path}' validation failed: ${result.errors?.join(', ')}`);
    }

    return this;
  }

  /**
   * 获取路径值
   */
  get<T>(path: string): T {
    const keys = path.split('.');
    let current = this.obj;

    for (const key of keys) {
      if (!isObject(current) || !(key in current)) {
        throw new Error(`Path '${path}' does not exist`);
      }
      current = current[key];
    }

    return current as T;
  }

  /**
   * 检查路径是否存在
   */
  has(path: string): boolean {
    const keys = path.split('.');
    let current = this.obj;

    for (const key of keys) {
      if (!isObject(current) || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    return true;
  }

  /**
   * 安全获取路径值（带默认值）
   */
  safeGet<T>(path: string, defaultValue: T): T {
    try {
      return this.get<T>(path);
    } catch {
      return defaultValue;
    }
  }
}

/**
 * 创建路径验证器
 */
export const createPathValidator = (obj: unknown): PathValidator => {
  return new PathValidator(obj);
};

// ============================================================================
// 批量验证工具
// ============================================================================

/**
 * 批量验证器
 */
export class BatchValidator {
  private results: Array<{ key: string; result: ValidationResult<any> }> = [];

  /**
   * 添加验证项
   */
  add<T>(key: string, value: unknown, validator: RuntimeTypeValidator<T>): this {
    const result = validator.test(value);
    this.results.push({ key, result });
    return this;
  }

  /**
   * 添加异步验证项
   */
  async addAsync<T>(key: string, value: unknown, validator: RuntimeTypeValidator<T>): Promise<this> {
    const result = await validator.testAsync(value);
    this.results.push({ key, result });
    return this;
  }

  /**
   * 获取所有验证结果
   */
  getResults(): Array<{ key: string; result: ValidationResult<any> }> {
    return this.results;
  }

  /**
   * 检查是否全部有效
   */
  isValid(): boolean {
    return this.results.every(({ result }) => result.isValid);
  }

  /**
   * 获取有效数据
   */
  getValidData(): Record<string, any> {
    const data: Record<string, any> = {};
    for (const { key, result } of this.results) {
      if (result.isValid && result.data !== undefined) {
        data[key] = result.data;
      }
    }
    return data;
  }

  /**
   * 获取所有错误
   */
  getErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const { key, result } of this.results) {
      if (!result.isValid && result.errors) {
        errors[key] = result.errors;
      }
    }
    return errors;
  }

  /**
   * 获取合并的验证结果
   */
  getResult(): ValidationResult<Record<string, any>> {
    const isValid = this.isValid();
    const errors = this.getErrors();

    return {
      isValid,
      data: isValid ? this.getValidData() : undefined,
      errors: isValid ? undefined : Object.values(errors).flat()
    };
  }

  /**
   * 清空结果
   */
  clear(): this {
    this.results = [];
    return this;
  }
}

/**
 * 创建批量验证器
 */
export const createBatchValidator = (): BatchValidator => {
  return new BatchValidator();
};

// ============================================================================
// 导出
// ============================================================================

export default RuntimeTypeValidator;