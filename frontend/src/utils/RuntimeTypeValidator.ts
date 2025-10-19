/**
 * 运行时类型验证机制
 *
 * 提供全面的运行时类型验证，确保数据结构的安全性和一致性
 * 支持复杂嵌套类型、自定义验证器和详细的错误报告
 */

import { SafeAccess, ValidationResult } from './SafeAccess';

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 验证器函数类型
 */
export type ValidatorFunction<T = any> = (value: unknown) => ValidationResult & { data?: T };

/**
 * 对象属性验证器配置
 */
export interface PropertyValidator {
  validator: ValidatorFunction;
  required?: boolean;
  description?: string;
}

/**
 * 对象验证器配置
 */
export interface ObjectValidatorConfig {
  [key: string]: PropertyValidator | ValidatorFunction;
}

/**
 * 数组验证器配置
 */
export interface ArrayValidatorConfig {
  itemValidator: ValidatorFunction;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

/**
 * 联合类型验证器配置
 */
export interface UnionValidatorConfig {
  validators: ValidatorFunction[];
  description?: string;
}

// ============================================================================
// 内置验证器
// ============================================================================

/**
 * 字符串验证器
 */
export const stringValidator = (
  config: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowedValues?: string[];
    trim?: boolean;
  } = {}
): ValidatorFunction<string> => {
  return (value: unknown): ValidationResult & { data?: string } => {
    const result = SafeAccess.validateString(value, {
      required: true,
      minLength: config.minLength,
      maxLength: config.maxLength,
      pattern: config.pattern,
      allowedValues: config.allowedValues,
      customValidator: config.trim && SafeAccess.isValidString(value)
        ? (val) => val.trim() === val || '字符串不能包含前后空格'
        : undefined
    });

    return {
      ...result,
      data: result.isValid && SafeAccess.isValidString(value) && config.trim
        ? value.trim()
        : value as string
    };
  };
};

/**
 * 数字验证器
 */
export const numberValidator = (
  config: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
    negative?: boolean;
    allowedValues?: number[];
  } = {}
): ValidatorFunction<number> => {
  return (value: unknown): ValidationResult & { data?: number } => {
    const result = SafeAccess.validateNumber(value, {
      required: true,
      min: config.min,
      max: config.max,
      allowedValues: config.allowedValues,
      customValidator: (val) => {
        if (config.integer && val !== Math.floor(val)) {
          return '必须是整数';
        }
        if (config.positive && val <= 0) {
          return '必须是正数';
        }
        if (config.negative && val >= 0) {
          return '必须是负数';
        }
        return true;
      }
    });

    return {
      ...result,
      data: value as number
    };
  };
};

/**
 * 布尔值验证器
 */
export const booleanValidator = (): ValidatorFunction<boolean> => {
  return (value: unknown): ValidationResult & { data?: boolean } => {
    const isValid = SafeAccess.isValidBoolean(value);

    return {
      isValid,
      errors: isValid ? [] : ['值必须是布尔类型'],
      warnings: [],
      data: isValid ? value : false
    };
  };
};

/**
 * 日期验证器
 */
export const dateValidator = (
  config: {
    min?: Date;
    max?: Date;
    format?: 'iso' | 'timestamp' | 'date';
  } = {}
): ValidatorFunction<Date> => {
  return (value: unknown): ValidationResult & { data?: Date } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let dateValue: Date | undefined;

    if (value instanceof Date) {
      dateValue = value;
    } else if (SafeAccess.isValidString(value)) {
      dateValue = new Date(value);
    } else if (SafeAccess.isValidNumber(value)) {
      dateValue = new Date(value);
    }

    if (!dateValue || !SafeAccess.isValidDate(dateValue)) {
      errors.push('无效的日期格式');
      return { isValid: false, errors, warnings };
    }

    if (config.min && dateValue < config.min) {
      errors.push(`日期不能早于 ${config.min.toISOString()}`);
    }

    if (config.max && dateValue > config.max) {
      errors.push(`日期不能晚于 ${config.max.toISOString()}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: dateValue
    };
  };
};

/**
 * 数组验证器
 */
export const arrayValidator = <T>(
  config: ArrayValidatorConfig
): ValidatorFunction<T[]> => {
  return (value: unknown): ValidationResult & { data?: T[] } => {
    const arrayResult = SafeAccess.validateArray(value, {
      required: config.required,
      minLength: config.minLength,
      maxLength: config.maxLength,
      itemValidator: (item) => {
        const itemResult = config.itemValidator(item);
        return itemResult;
      }
    });

    const validatedData: T[] = [];

    if (SafeAccess.isValidArray(value)) {
      value.forEach((item, index) => {
        const itemResult = config.itemValidator(item);
        if (itemResult.isValid && itemResult.data !== undefined) {
          validatedData.push(itemResult.data);
        }
      });
    }

    return {
      ...arrayResult,
      data: validatedData
    };
  };
};

/**
 * 对象验证器
 */
export const objectValidator = <T extends Record<string, any>>(
  config: ObjectValidatorConfig
): ValidatorFunction<T> => {
  return (value: unknown): ValidationResult & { data?: T } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedData: Partial<T> = {};

    if (!SafeAccess.isValidObject(value)) {
      errors.push('值必须是对象类型');
      return { isValid: false, errors, warnings };
    }

    // 验证每个属性
    Object.entries(config).forEach(([key, validatorConfig]) => {
      const propertyValue = value[key];
      const isRequired = typeof validatorConfig === 'object'
        ? validatorConfig.required
        : true;

      const validator = typeof validatorConfig === 'object'
        ? validatorConfig.validator
        : validatorConfig;

      const description = typeof validatorConfig === 'object'
        ? validatorConfig.description
        : key;

      if (propertyValue === undefined || propertyValue === null) {
        if (isRequired) {
          errors.push(`${description} 是必需的`);
        }
        return;
      }

      const result = validator(propertyValue);

      if (result.isValid && result.data !== undefined) {
        (validatedData as any)[key] = result.data;
      } else {
        errors.push(...result.errors.map(error => `${description}: ${error}`));
        warnings.push(...result.warnings.map(warning => `${description}: ${warning}`));
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: validatedData as T
    };
  };
};

/**
 * 联合类型验证器
 */
export const unionValidator = <T>(
  config: UnionValidatorConfig
): ValidatorFunction<T> => {
  return (value: unknown): ValidationResult & { data?: T } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const validator of config.validators) {
      const result = validator(value);
      if (result.isValid) {
        return {
          ...result,
          data: result.data as T
        };
      }
      errors.push(...result.errors);
    }

    return {
      isValid: false,
      errors: [config.description ? `${config.description}: 无效的值` : '值不匹配任何允许的类型', ...errors],
      warnings
    };
  };
};

/**
 * 字面量类型验证器
 */
export const literalValidator = <T extends string | number | boolean>(
  allowedValues: T[],
  description?: string
): ValidatorFunction<T> => {
  return unionValidator<T>({
    validators: allowedValues.map(value =>
      (val: unknown): ValidationResult & { data?: T } => ({
        isValid: val === value,
        errors: val === value ? [] : [`期望值 ${JSON.stringify(value)}, 实际值 ${JSON.stringify(val)}`],
        warnings: [],
        data: val === value ? value : undefined
      })
    ),
    description: description || `字面量值 [${allowedValues.map(v => JSON.stringify(v)).join(', ')}]`
  });
};

/**
 * 可选类型验证器
 */
export const optionalValidator = <T>(
  validator: ValidatorFunction<T>
): ValidatorFunction<T | undefined> => {
  return (value: unknown): ValidationResult & { data?: T | undefined } => {
    if (value === undefined || value === null) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        data: undefined
      };
    }

    return validator(value);
  };
};

// ============================================================================
// 高级验证器
// ============================================================================

/**
 * 邮箱验证器
 */
export const emailValidator = stringValidator({
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  description: '邮箱地址'
});

/**
 * URL验证器
 */
export const urlValidator = stringValidator({
  pattern: /^https?:\/\/.+/,
  description: 'URL地址'
});

/**
 * ID验证器（UUID或字符串ID）
 */
export const idValidator = unionValidator({
  validators: [
    stringValidator({
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9_-]+$/
    }),
    stringValidator({
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    })
  ],
  description: 'ID'
});

/**
 * API响应验证器
 */
export interface ApiResponseStructure<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    duration: number;
  };
}

export const apiResponseValidator = <T>(
  dataValidator?: ValidatorFunction<T>
): ValidatorFunction<ApiResponseStructure<T>> => {
  return objectValidator<ApiResponseStructure<T>>({
    success: booleanValidator(),
    data: optionalValidator(dataValidator || ((val: unknown) => ({
      isValid: true,
      errors: [],
      warnings: [],
      data: val as T
    }))),
    error: optionalValidator(objectValidator({
      code: stringValidator({ required: true }),
      message: stringValidator({ required: true }),
      details: (val: unknown) => ({
        isValid: true,
        errors: [],
        warnings: [],
        data: val
      })
    })),
    metadata: optionalValidator(objectValidator({
      timestamp: dateValidator(),
      requestId: stringValidator(),
      duration: numberValidator({ min: 0 })
    }))
  });
};

// ============================================================================
// 验证器组合器
// ============================================================================

/**
 * 创建记录类型验证器
 */
export const recordValidator = <T>(
  keyValidator: ValidatorFunction<string>,
  valueValidator: ValidatorFunction<T>
): ValidatorFunction<Record<string, T>> => {
  return (value: unknown): ValidationResult & { data?: Record<string, T> } => {
    if (!SafeAccess.isValidObject(value)) {
      return {
        isValid: false,
        errors: ['值必须是对象类型'],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedData: Record<string, T> = {};

    Object.entries(value).forEach(([key, val]) => {
      const keyResult = keyValidator(key);
      if (!keyResult.isValid) {
        errors.push(...keyResult.errors.map(error => `键 "${key}": ${error}`));
        return;
      }

      const valueResult = valueValidator(val);
      if (!valueResult.isValid) {
        errors.push(...valueResult.errors.map(error => `值 "${key}": ${error}`));
        warnings.push(...valueResult.warnings.map(warning => `值 "${key}": ${warning}`));
        return;
      }

      if (valueResult.data !== undefined && keyResult.data !== undefined) {
        validatedData[keyResult.data] = valueResult.data;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: validatedData
    };
  };
};

/**
 * 创建元组验证器
 */
export const tupleValidator = <T extends readonly any[]>(
  validators: { [K in keyof T]: ValidatorFunction<T[K]> }
): ValidatorFunction<T> => {
  return (value: unknown): ValidationResult & { data?: T } => {
    if (!SafeAccess.isValidArray(value)) {
      return {
        isValid: false,
        errors: ['值必须是数组类型'],
        warnings: []
      };
    }

    if (value.length !== validators.length) {
      return {
        isValid: false,
        errors: [`数组长度必须为 ${validators.length}, 实际长度为 ${value.length}`],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedData: any[] = [];

    validators.forEach((validator, index) => {
      const result = validator(value[index]);
      if (!result.isValid) {
        errors.push(...result.errors.map(error => `索引 ${index}: ${error}`));
        warnings.push(...result.warnings.map(warning => `索引 ${index}: ${warning}`));
      } else if (result.data !== undefined) {
        validatedData[index] = result.data;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data: validatedData as T
    };
  };
};

// ============================================================================
// 验证器工厂和实用函数
// ============================================================================

/**
 * 验证器类 - 提供链式API
 */
export class ValidatorBuilder<T = any> {
  private validator: ValidatorFunction<T>;

  constructor(validator: ValidatorFunction<T>) {
    this.validator = validator;
  }

  /**
   * 执行验证
   */
  validate(value: unknown): ValidationResult & { data?: T } {
    return this.validator(value);
  }

  /**
   * 转换为可选类型
   */
  optional(): ValidatorBuilder<T | undefined> {
    return new ValidatorBuilder(optionalValidator(this.validator));
  }

  /**
   * 添加自定义验证
   */
  custom(customValidator: (value: T) => boolean | string): ValidatorBuilder<T> {
    return new ValidatorBuilder((value: unknown) => {
      const result = this.validator(value);
      if (!result.isValid || result.data === undefined) {
        return result;
      }

      const customResult = customValidator(result.data);
      if (typeof customResult === 'string') {
        return {
          ...result,
          isValid: false,
          errors: [...result.errors, customResult]
        };
      } else if (!customResult) {
        return {
          ...result,
          isValid: false,
          errors: [...result.errors, '自定义验证失败']
        };
      }

      return result;
    });
  }

  /**
   * 转换数据
   */
  transform<R>(transformer: (value: T) => R): ValidatorBuilder<R> {
    return new ValidatorBuilder((value: unknown) => {
      const result = this.validator(value);
      if (!result.isValid || result.data === undefined) {
        return result as ValidationResult & { data?: R };
      }

      try {
        const transformed = transformer(result.data);
        return {
          isValid: true,
          errors: [],
          warnings: [],
          data: transformed
        };
      } catch (error) {
        return {
          isValid: false,
          errors: [`数据转换失败: ${error instanceof Error ? error.message : '未知错误'}`],
          warnings: []
        };
      }
    });
  }
}

/**
 * 创建验证器构建器
 */
export function createValidator<T>(validator: ValidatorFunction<T>): ValidatorBuilder<T> {
  return new ValidatorBuilder(validator);
}

// ============================================================================
// 运行时类型守卫生成器
// ============================================================================

/**
 * 生成类型守卫函数
 */
export function createTypeGuard<T>(
  validator: ValidatorFunction<T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    const result = validator(value);
    return result.isValid && result.data !== undefined;
  };
}

/**
 * 生成异步类型守卫函数
 */
export function createAsyncTypeGuard<T>(
  validator: (value: unknown) => Promise<ValidationResult & { data?: T }>
): (value: unknown) => Promise<boolean> {
  return async (value: unknown): Promise<boolean> => {
    try {
      const result = await validator(value);
      return result.isValid && result.data !== undefined;
    } catch {
      return false;
    }
  };
}

// ============================================================================
// 导出便捷对象
// ============================================================================

export const RuntimeTypeValidator = {
  // 基础验证器
  string: stringValidator,
  number: numberValidator,
  boolean: booleanValidator,
  date: dateValidator,
  array: arrayValidator,
  object: objectValidator,
  union: unionValidator,
  literal: literalValidator,
  optional: optionalValidator,

  // 常用验证器
  email: emailValidator,
  url: urlValidator,
  id: idValidator,
  apiResponse: apiResponseValidator,

  // 高级验证器
  record: recordValidator,
  tuple: tupleValidator,

  // 工厂函数
  createValidator,
  createTypeGuard,
  createAsyncTypeGuard,
  ValidatorBuilder,
};

export default RuntimeTypeValidator;