/**
 * React组件Props验证器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  PropsValidator,
  createPropsValidator,
  usePropsValidation,
  useSafeProps,
  propsValidatorBuilder,
  basePropsValidator,
  buttonPropsValidator,
  inputPropsValidator,
  RuntimeTypeValidator,
  enumValidator
} from '../react-props-validator';

// Mock console methods to test error/warning handling
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('PropsValidator', () => {
  let onError: vi.MockedFunction<(errors: string[]) => void>;
  let onWarning: vi.MockedFunction<(warnings: string[]) => void>;

  beforeEach(() => {
    onError = vi.fn();
    onWarning = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('基本验证功能', () => {
    it('should validate required props', () => {
      const validator = createPropsValidator<{ name: string; age?: number }>({
        displayName: 'TestComponent',
        onError
      })
        .required('name', RuntimeTypeValidator.create<string>())
        .optional('age', RuntimeTypeValidator.create<number>());

      // Valid props
      const validProps = { name: 'John', age: 30 };
      const validResult = validator.validate(validProps);

      expect(validResult.isValid).toBe(true);
      expect(validResult.validatedProps).toEqual(validProps);
      expect(validResult.errors).toEqual([]);

      // Missing required prop
      const invalidProps = { age: 30 };
      const invalidResult = validator.validate(invalidProps);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain("Required prop 'name' is missing");
      expect(onError).toHaveBeenCalledWith(["Required prop 'name' is missing"]);
    });

    it('should apply default values for missing optional props', () => {
      const validator = createPropsValidator<{ name: string; role?: string }>({
        displayName: 'TestComponent'
      })
        .required('name', RuntimeTypeValidator.create<string>())
        .optional('role', RuntimeTypeValidator.create<string>(), { defaultValue: 'user' });

      const props = { name: 'John' };
      const result = validator.validate(props);

      expect(result.isValid).toBe(true);
      expect(result.validatedProps).toEqual({ name: 'John', role: 'user' });
    });

    it('should handle deprecated props with warnings', () => {
      const validator = createPropsValidator<{ name: string; oldProp?: string }>({
        displayName: 'TestComponent',
        onWarning
      })
        .required('name', RuntimeTypeValidator.create<string>())
        .deprecated('oldProp', RuntimeTypeValidator.create<string>(), 'Use newProp instead');

      const props = { name: 'John', oldProp: 'value' };
      const result = validator.validate(props);

      expect(result.isValid).toBe(true);
      expect(onWarning).toHaveBeenCalledWith([
        "Prop 'oldProp' is deprecated. Use newProp instead"
      ]);
    });

    it('should apply transformations', () => {
      const validator = createPropsValidator<{ name: string; upperName?: string }>({
        displayName: 'TestComponent'
      })
        .required('name', RuntimeTypeValidator.create<string>())
        .optional('upperName', RuntimeTypeValidator.create<string>(), {
          transform: (val: string) => val.toUpperCase()
        });

      const props = { name: 'john', upperName: 'test' };
      const result = validator.validate(props);

      expect(result.isValid).toBe(true);
      expect(result.validatedProps?.upperName).toBe('TEST');
    });

    it('should handle strict mode', () => {
      const validator = createPropsValidator<{ name: string }>({
        displayName: 'TestComponent',
        strict: true,
        allowUnknown: false,
        onError
      })
        .required('name', RuntimeTypeValidator.create<string>());

      const propsWithUnknown = { name: 'John', unknownProp: 'value' };
      const result = validator.validate(propsWithUnknown);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown props: unknownProp');
    });
  });

  describe('HOC包装', () => {
    it('should wrap component with validation', () => {
      const MockComponent = vi.fn().mockReturnValue(null);
      const validator = createPropsValidator<{ name: string }>({
        displayName: 'MockComponent'
      })
        .required('name', RuntimeTypeValidator.create<string>());

      const WrappedComponent = validator.wrap(MockComponent);

      // Test with valid props
      const validProps = { name: 'John' };
      WrappedComponent(validProps);

      expect(MockComponent).toHaveBeenCalledWith(validProps, {});
      expect(console.error).not.toHaveBeenCalled();

      // Test with invalid props
      const invalidProps = {};
      WrappedComponent(invalidProps);

      expect(console.error).toHaveBeenCalledWith(
        '[MockComponent] Props validation failed:',
        expect.arrayContaining(["Required prop 'name' is missing"])
      );
    });

    it('should handle forwardRef', () => {
      const MockComponent = React.forwardRef<HTMLDivElement, { name: string }>(
        ({ name }, ref) => <div ref={ref}>{name}</div>
      );
      MockComponent.displayName = 'MockComponent';

      const validator = createPropsValidator<{ name: string }>({
        displayName: 'MockComponent'
      })
        .required('name', RuntimeTypeValidator.create<string>());

      const WrappedComponent = validator.wrap(MockComponent, { forwardRef: true });

      expect(WrappedComponent.displayName).toBe('withPropsValidation(MockComponent)');
    });
  });

  describe('createHook', () => {
    it('should create validation hook', () => {
      const validator = createPropsValidator<{ name: string }>({
        displayName: 'TestComponent'
      })
        .required('name', RuntimeTypeValidator.create<string>());

      const useValidationHook = validator.createHook();

      const { result } = renderHook(() => useValidationHook({ name: 'John' }));

      const [validatedProps, validation] = result.current;

      expect(validation.isValid).toBe(true);
      expect(validatedProps).toEqual({ name: 'John' });
    });

    it('should handle validation errors in hook', () => {
      const validator = createPropsValidator<{ name: string }>({
        displayName: 'TestComponent'
      })
        .required('name', RuntimeTypeValidator.create<string>());

      const useValidationHook = validator.createHook();

      const { result } = renderHook(() => useValidationHook({}));

      const [validatedProps, validation] = result.current;

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Required prop 'name' is missing");
    });
  });
});

describe('usePropsValidation Hook', () => {
  it('should validate props and return results', () => {
    const validator = createPropsValidator<{ name: string; age?: number }>()
      .required('name', RuntimeTypeValidator.create<string>())
      .optional('age', RuntimeTypeValidator.create<number>());

    const { result } = renderHook(() => usePropsValidation({ name: 'John', age: 30 }, validator));

    const [validatedProps, validation] = result.current;

    expect(validation.isValid).toBe(true);
    expect(validatedProps).toEqual({ name: 'John', age: 30 });
  });

  it('should handle invalid props', () => {
    const validator = createPropsValidator<{ name: string }>()
      .required('name', RuntimeTypeValidator.create<string>());

    const { result } = renderHook(() => usePropsValidation({}, validator));

    const [validatedProps, validation] = result.current;

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain("Required prop 'name' is missing");
  });

  it('should output warnings in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const validator = createPropsValidator<{ name: string }>()
      .required('name', RuntimeTypeValidator.create<string>());

    renderHook(() => usePropsValidation({}, validator));

    expect(console.error).toHaveBeenCalledWith(
      'Props validation failed:',
      expect.arrayContaining(["Required prop 'name' is missing"])
    );

    process.env.NODE_ENV = originalNodeEnv;
  });
});

describe('useSafeProps Hook', () => {
  it('should return safe props with default values', () => {
    const validator = createPropsValidator<{ name: string; role?: string }>()
      .required('name', RuntimeTypeValidator.create<string>())
      .optional('role', RuntimeTypeValidator.create<string>(), { defaultValue: 'user' });

    const { result } = renderHook(() => useSafeProps({ name: 'John' }, validator));

    expect(result.current).toEqual({ name: 'John', role: 'user' });
  });

  it('should handle validation errors gracefully', () => {
    const validator = createPropsValidator<{ name: string }>()
      .required('name', RuntimeTypeValidator.create<string>());

    const { result } = renderHook(() => useSafeProps({}, validator));

    // Should return empty object or default values when validation fails
    expect(typeof result.current).toBe('object');
  });
});

describe('propsValidatorBuilder', () => {
  it('should build complex validators using builder pattern', () => {
    const validator = propsValidatorBuilder<{
      name: string;
      age?: number;
      email: string;
      role: 'admin' | 'user';
    }>()
      .required('name', RuntimeTypeValidator.create<string>())
      .optional('age', RuntimeTypeValidator.create<number>())
      .required('email', RuntimeTypeValidator.create<string>())
      .required('role', enumValidator(['admin', 'user'] as const))
      .build();

    const validProps = {
      name: 'John',
      age: 30,
      email: 'john@example.com',
      role: 'user' as const
    };

    const result = validator.validate(validProps);
    expect(result.isValid).toBe(true);
    expect(result.validatedProps).toEqual(validProps);
  });

  it('should handle deprecated props in builder', () => {
    const validator = propsValidatorBuilder<{ name: string; oldProp?: string }>()
      .required('name', RuntimeTypeValidator.create<string>())
      .deprecated('oldProp', RuntimeTypeValidator.create<string>(), 'Use newProp instead')
      .build();

    const props = { name: 'John', oldProp: 'value' };
    const result = validator.validate(props);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain("Prop 'oldProp' is deprecated. Use newProp instead");
  });
});

describe('预定义验证器', () => {
  describe('basePropsValidator', () => {
    it('should validate base props', () => {
      const validator = basePropsValidator();

      const validProps = {
        className: 'test-class',
        children: 'Hello',
        style: { color: 'red' }
      };

      const result = validator.validate(validProps);
      expect(result.isValid).toBe(true);
    });
  });

  describe('buttonPropsValidator', () => {
    it('should validate button props', () => {
      const validator = buttonPropsValidator();

      const validProps = {
        variant: 'primary' as const,
        size: 'md' as const,
        disabled: false,
        onClick: vi.fn()
      };

      const result = validator.validate(validProps);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid button variants', () => {
      const validator = buttonPropsValidator();

      const invalidProps = {
        variant: 'invalid' as const,
        size: 'md' as const
      };

      const result = validator.validate(invalidProps);
      expect(result.isValid).toBe(false);
    });
  });

  describe('inputPropsValidator', () => {
    it('should validate input props', () => {
      const validator = inputPropsValidator();

      const validProps = {
        value: 'test',
        placeholder: 'Enter text',
        disabled: false,
        type: 'text' as const,
        maxLength: 100,
        onChange: vi.fn()
      };

      const result = validator.validate(validProps);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid input types', () => {
      const validator = inputPropsValidator();

      const invalidProps = {
        type: 'invalid' as const,
        value: 'test'
      };

      const result = validator.validate(invalidProps);
      expect(result.isValid).toBe(false);
    });
  });
});

describe('组件集成测试', () => {
  it('should work with real React component patterns', () => {
    // 模拟一个真实的组件验证场景
    interface UserCardProps {
      user: {
        id: string;
        name: string;
        email: string;
        avatar?: string;
      };
      showEmail?: boolean;
      onEdit?: () => void;
      className?: string;
      children?: React.ReactNode;
    }

    const userCardValidator = createPropsValidator<UserCardProps>({
      displayName: 'UserCard'
    })
      .required('user', objectValidatorFactory({
        id: RuntimeTypeValidator.create<string>().required(),
        name: RuntimeTypeValidator.create<string>().required(),
        email: RuntimeTypeValidator.create<string>().required(),
        avatar: RuntimeTypeValidator.create<string>().optional()
      }))
      .optional('showEmail', RuntimeTypeValidator.create<boolean>())
      .optional('onEdit', RuntimeTypeValidator.create<any>())
      .optional('className', RuntimeTypeValidator.create<string>())
      .optional('children', RuntimeTypeValidator.create<any>());

    const validProps = {
      user: {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: 'https://example.com/avatar.jpg'
      },
      showEmail: true,
      onEdit: vi.fn(),
      className: 'user-card',
      children: '<div>Extra content</div>'
    };

    const result = userCardValidator.validate(validProps);
    expect(result.isValid).toBe(true);
    expect(result.validatedProps).toEqual(validProps);
  });

  it('should handle complex nested validation', () => {
    interface TableProps {
      data: Array<Record<string, any>>;
      columns: Array<{
        key: string;
        title: string;
        sortable?: boolean;
        width?: number;
      }>;
      pagination?: {
        current: number;
        pageSize: number;
        total: number;
      };
      loading?: boolean;
    }

    const tableValidator = createPropsValidator<TableProps>({
      displayName: 'DataTable'
    })
      .required('data', RuntimeTypeValidator.create<any[]>())
      .required('columns', RuntimeTypeValidator.create<any[]>())
      .optional('pagination', RuntimeTypeValidator.create<any>())
      .optional('loading', RuntimeTypeValidator.create<boolean>());

    const complexProps = {
      data: [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 }
      ],
      columns: [
        { key: 'name', title: 'Name', sortable: true, width: 200 },
        { key: 'value', title: 'Value', sortable: false }
      ],
      pagination: {
        current: 1,
        pageSize: 10,
        total: 2
      },
      loading: false
    };

    const result = tableValidator.validate(complexProps);
    expect(result.isValid).toBe(true);
  });
});

describe('错误处理和边界情况', () => {
  it('should handle null/undefined props', () => {
    const validator = createPropsValidator<{ name: string }>()
      .required('name', RuntimeTypeValidator.create<string>());

    const nullResult = validator.validate(null);
    expect(nullResult.isValid).toBe(false);
    expect(nullResult.errors).toContain('Props must be an object');

    const undefinedResult = validator.validate(undefined);
    expect(undefinedResult.isValid).toBe(false);
    expect(undefinedResult.errors).toContain('Props must be an object');
  });

  it('should handle transformation errors', () => {
    const validator = createPropsValidator<{ name: string }>()
      .required('name', RuntimeTypeValidator.create<string>(), {
        transform: () => {
          throw new Error('Transform failed');
        }
      });

    const result = validator.validate({ name: 'test' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Prop 'name' validation failed: Transform error: Transform failed");
  });

  it('should handle circular references in validation', () => {
    const validator = createPropsValidator<{ data: any }>()
      .required('data', RuntimeTypeValidator.create<any>());

    const circularData: any = { name: 'test' };
    circularData.self = circularData;

    // Should not cause infinite loop or stack overflow
    const result = validator.validate({ data: circularData });
    expect(result.isValid).toBe(true);
  });
});

describe('性能测试', () => {
  it('should handle large prop objects efficiently', () => {
    const validator = createPropsValidator<{ items: any[] }>()
      .required('items', RuntimeTypeValidator.create<any[]>());

    const largeProps = {
      items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
    };

    const startTime = performance.now();
    const result = validator.validate(largeProps);
    const endTime = performance.now();

    expect(result.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
  });

  it('should cache validation results for repeated props', () => {
    const validator = createPropsValidator<{ name: string }>()
      .required('name', RuntimeTypeValidator.create<string>());

    const props = { name: 'test' };

    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      validator.validate(props);
    }
    const endTime = performance.now();

    // Should be fast due to caching mechanisms
    expect(endTime - startTime).toBeLessThan(50);
  });
});

describe('开发环境行为', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should provide detailed error messages in development', () => {
    process.env.NODE_ENV = 'development';

    const validator = createPropsValidator<{ name: string; age: number }>({
      displayName: 'TestComponent'
    })
      .required('name', RuntimeTypeValidator.create<string>())
      .required('age', RuntimeTypeValidator.create<number>());

    const invalidProps = { name: 'John' }; // missing age

    const result = validator.validate(invalidProps);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Required prop 'age' is missing");
    expect(console.error).toHaveBeenCalled();
  });

  it('should be more permissive in production', () => {
    process.env.NODE_ENV = 'production';

    const validator = createPropsValidator<{ name: string }>({
      displayName: 'TestComponent',
      strict: false // In production, we might be more permissive
    })
      .required('name', RuntimeTypeValidator.create<string>());

    const propsWithExtra = { name: 'John', extraProp: 'value' };
    const result = validator.validate(propsWithExtra);

    // Should be more permissive in production
    expect(result.isValid).toBe(true);
  });
});