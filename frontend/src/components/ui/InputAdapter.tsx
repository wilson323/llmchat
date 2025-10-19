/**
 * Input组件适配器
 *
 * 提供统一的onChange签名，适配不同使用场景
 */

import * as React from 'react';
import { Input, type InputProps } from './Input';

/**
 * 扩展InputProps，支持多种onChange签名
 */
export interface InputAdapterProps extends Omit<InputProps, 'onChange'> {
  /** 变化回调 - 支持多种签名 */
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void | ((event: React.ChangeEvent<HTMLInputElement>) => void);
  /** 是否自动适配onChange签名 */
  adaptOnChange?: boolean;
}

/**
 * Input组件适配器
 * 自动适配不同的onChange签名
 */
export const InputAdapter = React.forwardRef<HTMLInputElement, InputAdapterProps>(
  ({ onChange, adaptOnChange = true, ...props }, ref) => {
    // 适配onChange回调
    const handleChange = React.useCallback(
      (value: string, event: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) {
          // 检测onChange函数的参数数量来决定调用方式
          if (onChange.length === 1) {
            // 如果只接受一个参数，假设是event格式
            (onChange as (event: React.ChangeEvent<HTMLInputElement>) => void)(event);
          } else {
            // 标准调用方式
            onChange(value, event);
          }
        }
      },
      [onChange]
    );

    // 如果不需要适配，直接传递原始onChange
    if (!adaptOnChange && onChange) {
      return (
        <Input
          ref={ref}
          {...props}
          onChange={onChange as (value: string, event: React.ChangeEvent<HTMLInputElement>) => void}
        />
      );
    }

    return (
      <Input
        ref={ref}
        {...props}
        onChange={handleChange}
      />
    );
  }
);

InputAdapter.displayName = 'InputAdapter';

/**
 * 创建受控Input的便捷Hook
 */
export const useControlledInput = (
  initialValue: string = '',
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void
) => {
  const [value, setValue] = React.useState(initialValue);

  const handleChange = React.useCallback(
    (newValue: string, event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(newValue);
      onChange?.(newValue, event);
    },
    [onChange]
  );

  return {
    value,
    onChange: handleChange,
    setValue,
  };
};

/**
 * 创建表单字段的便捷Hook
 */
export const useFormField = (
  name: string,
  initialValue: string = '',
  onChange?: (fieldName: string, value: string, event: React.ChangeEvent<HTMLInputElement>) => void
) => {
  const [value, setValue] = React.useState(initialValue);
  const [error, setError] = React.useState<string>();
  const [touched, setTouched] = React.useState(false);

  const handleChange = React.useCallback(
    (newValue: string, event: React.ChangeEvent<HTMLInputElement>) => {
      setValue(newValue);
      setTouched(true);
      onChange?.(name, newValue, event);
    },
    [name, onChange]
  );

  const handleBlur = React.useCallback(
    () => {
      setTouched(true);
    },
    []
  );

  const reset = React.useCallback(
    () => {
      setValue(initialValue);
      setError(undefined);
      setTouched(false);
    },
    [initialValue]
  );

  return {
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    setError,
    reset,
    touched,
    error,
    props: {
      name,
      value,
      onChange: handleChange,
      onBlur: handleBlur,
      error: touched ? error : undefined,
    } as InputAdapterProps,
  };
};

export default InputAdapter;
// InputAdapterProps 已在定义处 export，无需重复