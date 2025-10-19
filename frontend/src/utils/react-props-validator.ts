/**
 * React组件Props类型检查工具
 *
 * 提供运行时React组件Props类型验证，确保组件接收的props符合类型要求。
 * 支持复杂Props结构验证、默认值设置、条件验证等。
 *
 * @module react-props-validator
 * @version 2.0.0
 * @since 2025-10-18
 */

import React from 'react';
import { RuntimeTypeValidator, objectValidatorFactory, enumValidator } from './runtime-type-validator';
import { ComponentType, ReactNode, ElementRef, ComponentProps } from 'react';

// ============================================================================
// Props验证配置类型
// ============================================================================

/**
 * Props属性验证配置
 */
export interface PropValidationConfig<T = unknown> {
  required?: boolean;
  validator: RuntimeTypeValidator<T>;
  defaultValue?: T;
  deprecated?: boolean;
  deprecationMessage?: string;
  transform?: (value: unknown) => T;
  description?: string;
}

/**
 * Props验证器配置
 */
export interface PropsValidatorConfig<T extends Record<string, any>> {
  displayName?: string;
  strict?: boolean;
  allowUnknown?: boolean;
  onError?: (errors: string[]) => void;
  onWarning?: (warnings: string[]) => void;
}

/**
 * 验证结果
 */
export interface PropsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedProps: Record<string, any>;
}

// ============================================================================
// Props验证器核心类
// ============================================================================

/**
 * React Props验证器类
 */
export class PropsValidator<T extends Record<string, any> = Record<string, any>> {
  private propConfigs: Map<string, PropValidationConfig> = new Map();
  private config: PropsValidatorConfig<T>;

  constructor(config: PropsValidatorConfig<T> = {}) {
    this.config = {
      strict: false,
      allowUnknown: true,
      ...config
    };
  }

  /**
   * 添加属性验证配置
   */
  prop<K extends keyof T>(
    name: K,
    config: PropValidationConfig<T[K]>
  ): this {
    this.propConfigs.set(name as string, config);
    return this;
  }

  /**
   * 添加必需属性
   */
  required<K extends keyof T>(
    name: K,
    validator: RuntimeTypeValidator<T[K]>,
    options: Omit<PropValidationConfig<T[K]>, 'required' | 'validator'> = {}
  ): this {
    return this.prop(name, {
      required: true,
      validator,
      ...options
    });
  }

  /**
   * 添加可选属性
   */
  optional<K extends keyof T>(
    name: K,
    validator: RuntimeTypeValidator<T[K]>,
    options: Omit<PropValidationConfig<T[K]>, 'required' | 'validator'> = {}
  ): this {
    return this.prop(name, {
      required: false,
      validator,
      ...options
    });
  }

  /**
   * 添加已弃用的属性
   */
  deprecated<K extends keyof T>(
    name: K,
    validator: RuntimeTypeValidator<T[K]>,
    deprecationMessage: string,
    options: Omit<PropValidationConfig<T[K]>, 'deprecated' | 'deprecationMessage' | 'validator'> = {}
  ): this {
    return this.prop(name, {
      validator,
      deprecated: true,
      deprecationMessage,
      ...options
    });
  }

  /**
   * 验证Props
   */
  validate(props: unknown): PropsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedProps: Record<string, any> = {};

    if (!props || typeof props !== 'object') {
      errors.push('Props must be an object');
      return { isValid: false, errors, warnings, validatedProps };
    }

    const propsObj = props as Record<string, any>;

    // 验证已配置的属性
    for (const [propName, propConfig] of this.propConfigs) {
      const hasProp = propName in propsObj;
      const propValue = propsObj[propName];

      // 检查必需属性
      if (propConfig.required && !hasProp) {
        if (propConfig.defaultValue !== undefined) {
          validatedProps[propName] = propConfig.defaultValue;
        } else {
          errors.push(`Required prop '${propName}' is missing`);
        }
        continue;
      }

      // 检查已弃用属性
      if (propConfig.deprecated && hasProp) {
        warnings.push(
          `Prop '${propName}' is deprecated. ${propConfig.deprecationMessage || 'Please refer to documentation.'}`
        );
      }

      // 如果属性存在，进行验证
      if (hasProp) {
        try {
          // 应用转换函数
          const finalValue = propConfig.transform ? propConfig.transform(propValue) : propValue;

          // 验证类型
          const validationResult = propConfig.validator.test(finalValue);

          if (validationResult.isValid) {
            validatedProps[propName] = validationResult.data;
          } else {
            errors.push(
              `Prop '${propName}' is invalid: ${validationResult.errors?.join(', ')}`
            );

            // 使用默认值
            if (propConfig.defaultValue !== undefined) {
              validatedProps[propName] = propConfig.defaultValue;
            }
          }
        } catch (error) {
          errors.push(
            `Prop '${propName}' validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );

          // 使用默认值
          if (propConfig.defaultValue !== undefined) {
            validatedProps[propName] = propConfig.defaultValue;
          }
        }
      } else if (propConfig.defaultValue !== undefined) {
        validatedProps[propName] = propConfig.defaultValue;
      }
    }

    // 严格模式检查未知属性
    if (this.config.strict && !this.config.allowUnknown) {
      const knownProps = Array.from(this.propConfigs.keys());
      const unknownProps = Object.keys(propsObj).filter(key => !knownProps.includes(key));

      if (unknownProps.length > 0) {
        errors.push(`Unknown props: ${unknownProps.join(', ')}`);
      }
    }

    // 处理错误和警告
    if (errors.length > 0 && this.config.onError) {
      this.config.onError(errors);
    }

    if (warnings.length > 0 && this.config.onWarning) {
      this.config.onWarning(warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedProps
    };
  }

  /**
   * 创建HOC（高阶组件）包装器
   */
  wrap<P extends T>(
    Component: ComponentType<P>,
    options: {
      displayName?: string;
      forwardRef?: boolean;
    } = {}
  ): ComponentType<P> {
    const { displayName = Component.displayName || Component.name, forwardRef = false } = options;

    if (forwardRef) {
      const ForwardedComponent = React.forwardRef<ElementRef<ComponentType<P>>, P>((props, ref) => {
        const validation = this.validate(props);

        if (!validation.isValid) {
          console.error(
            `[${displayName}] Props validation failed:`,
            validation.errors
          );
        }

        if (validation.warnings.length > 0) {
          console.warn(
            `[${displayName}] Props warnings:`,
            validation.warnings
          );
        }

        return React.createElement(Component, {
          ...validation.validatedProps,
          ref
        } as unknown as P);
      });

      ForwardedComponent.displayName = `withPropsValidation(${displayName})`;
      return ForwardedComponent as unknown as ComponentType<P>;
    }

    const FunctionComponent: ComponentType<P> = (props: P) => {
      const validation = this.validate(props);

      if (!validation.isValid) {
        console.error(
          `[${displayName}] Props validation failed:`,
          validation.errors
        );
      }

      if (validation.warnings.length > 0) {
        console.warn(
          `[${displayName}] Props warnings:`,
          validation.warnings
        );
      }

      return React.createElement(Component, validation.validatedProps as P);
    };

    FunctionComponent.displayName = `withPropsValidation(${displayName})`;

    return FunctionComponent;
  }

  /**
   * 创建Hook
   */
  createHook(): (props: unknown) => [T, PropsValidationResult] {
    return (props: unknown) => {
      const validation = React.useMemo(() => this.validate(props), [props]);

      // 开发环境下输出警告
      React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
          if (!validation.isValid) {
            console.error('Props validation failed:', validation.errors);
          }

          if (validation.warnings.length > 0) {
            console.warn('Props warnings:', validation.warnings);
          }
        }
      }, [validation]);

      return [validation.validatedProps as T, validation];
    };
  }
}

// ============================================================================
// 预定义Props验证器工厂
// ============================================================================

/**
 * 创建Props验证器
 */
export const createPropsValidator = <T extends Record<string, any>>(
  config?: PropsValidatorConfig<T>
): PropsValidator<T> => {
  return new PropsValidator(config);
};

/**
 * 基础Props验证器
 */
export const basePropsValidator = () =>
  createPropsValidator<{
    className?: string;
    children?: ReactNode;
    style?: React.CSSProperties;
  }>();

/**
 * 按钮Props验证器
 */
export const buttonPropsValidator = () =>
  createPropsValidator<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    onClick?: (event: React.MouseEvent) => void;
    type?: 'button' | 'submit' | 'reset';
  }>().optional('variant', enumValidator(['primary', 'secondary', 'outline', 'ghost'] as const))
    .optional('size', enumValidator(['sm', 'md', 'lg'] as const))
    .optional('disabled', RuntimeTypeValidator.create<boolean>())
    .optional('loading', RuntimeTypeValidator.create<boolean>())
    .optional('onClick', RuntimeTypeValidator.create<any>()) // Function类型
    .optional('type', enumValidator(['button', 'submit', 'reset'] as const));

/**
 * 输入框Props验证器
 */
export const inputPropsValidator = () =>
  createPropsValidator<{
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  }>().optional('value', RuntimeTypeValidator.create<string>())
    .optional('defaultValue', RuntimeTypeValidator.create<string>())
    .optional('placeholder', RuntimeTypeValidator.create<string>())
    .optional('disabled', RuntimeTypeValidator.create<boolean>())
    .optional('required', RuntimeTypeValidator.create<boolean>())
    .optional('type', enumValidator(['text', 'email', 'password', 'number', 'tel', 'url'] as const))
    .optional('maxLength', RuntimeTypeValidator.create<number>())
    .optional('minLength', RuntimeTypeValidator.create<number>())
    .optional('pattern', RuntimeTypeValidator.create<string>())
    .optional('onChange', RuntimeTypeValidator.create<any>())
    .optional('onFocus', RuntimeTypeValidator.create<any>())
    .optional('onBlur', RuntimeTypeValidator.create<any>());

/**
 * 对话框Props验证器
 */
export const dialogPropsValidator = () =>
  createPropsValidator<{
    open: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closable?: boolean;
    maskClosable?: boolean;
    children?: ReactNode;
  }>().required('open', RuntimeTypeValidator.create<boolean>())
    .required('onClose', RuntimeTypeValidator.create<any>())
    .optional('title', RuntimeTypeValidator.create<string>())
    .optional('size', enumValidator(['sm', 'md', 'lg', 'xl'] as const))
    .optional('closable', RuntimeTypeValidator.create<boolean>())
    .optional('maskClosable', RuntimeTypeValidator.create<boolean>())
    .optional('children', RuntimeTypeValidator.create<any>());

/**
 * 表格Props验证器
 */
export const tablePropsValidator = <T>() =>
  createPropsValidator<{
    data: T[];
    columns: Array<{
      key: string;
      title: string;
      dataIndex?: string;
      render?: (value: unknown, record: T, index: number) => ReactNode;
      sortable?: boolean;
      filterable?: boolean;
      width?: string | number;
    }>;
    loading?: boolean;
    pagination?: {
      current: number;
      pageSize: number;
      total: number;
      onChange: (page: number, pageSize: number) => void;
    };
    rowSelection?: {
      selectedRowKeys: string[];
      onChange: (selectedRowKeys: string[], selectedRows: T[]) => void;
    };
    onRowClick?: (record: T, index: number) => void;
  }>().required('data', RuntimeTypeValidator.create<any[]>())
    .required('columns', RuntimeTypeValidator.create<any[]>())
    .optional('loading', RuntimeTypeValidator.create<boolean>())
    .optional('pagination', RuntimeTypeValidator.create<any>())
    .optional('rowSelection', RuntimeTypeValidator.create<any>())
    .optional('onRowClick', RuntimeTypeValidator.create<any>());

// ============================================================================
// 自定义Hook
// ============================================================================

/**
 * 使用Props验证的Hook
 */
export const usePropsValidation = <T extends Record<string, unknown>>(
  props: unknown,
  validator: PropsValidator<T>
): [T, PropsValidationResult] => {
  const hook = validator.createHook();
  return hook(props);
};

/**
 * 使用安全Props的Hook（自动应用默认值和验证）
 */
export const useSafeProps = <T extends Record<string, unknown>>(
  props: unknown,
  validator: PropsValidator<T>
): T => {
  const [safeProps] = usePropsValidation(props, validator);
  return safeProps;
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 自动推断组件Props类型并创建验证器
 */
export const createPropsValidatorFromComponent = <P extends object>(
  Component: ComponentType<P>
): PropsValidator<P> => {
  // 这是一个示例实现，实际项目中可能需要更复杂的类型推断逻辑
  const validator = new PropsValidator<P>();

  // 可以通过分析组件的PropTypes或TypeScript类型来自动创建验证规则
  // 这里提供一个基础框架

  return validator;
};

/**
 * 创建Props验证器构建器
 */
export const propsValidatorBuilder = <T extends Record<string, unknown>>() => ({
  validator: new PropsValidator<T>(),

  required<K extends keyof T>(
    name: K,
    typeValidator: RuntimeTypeValidator<T[K]>,
    options: Omit<PropValidationConfig<T[K]>, 'required' | 'validator'> = {}
  ) {
    this.validator.required(name, typeValidator, options);
    return this;
  },

  optional<K extends keyof T>(
    name: K,
    typeValidator: RuntimeTypeValidator<T[K]>,
    options: Omit<PropValidationConfig<T[K]>, 'required' | 'validator'> = {}
  ) {
    this.validator.optional(name, typeValidator, options);
    return this;
  },

  deprecated<K extends keyof T>(
    name: K,
    typeValidator: RuntimeTypeValidator<T[K]>,
    message: string,
    options: Omit<PropValidationConfig<T[K]>, 'deprecated' | 'deprecationMessage' | 'validator'> = {}
  ) {
    this.validator.deprecated(name, typeValidator, message, options);
    return this;
  },

  build(): PropsValidator<T> {
    return this.validator;
  }
});

// ============================================================================
// 开发环境警告和错误处理
// ============================================================================

/**
 * 开发环境Props验证警告
 */
if (process.env.NODE_ENV === 'development') {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.error = (...args: unknown[]) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Props validation failed')) {
      // 可以添加自定义错误处理逻辑，比如发送错误报告
    }
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Props warnings')) {
      // 可以添加自定义警告处理逻辑
    }
    originalConsoleWarn.apply(console, args);
  };
}

// ============================================================================
// 导出（所有导出已在定义处使用 export 关键字）
// ============================================================================