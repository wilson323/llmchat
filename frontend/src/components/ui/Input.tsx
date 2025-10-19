import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type {
  InputProps as IInputProps,
  SizeVariant,
  ForwardRefComponent,
} from './ui.types';

// Input变体配置
const inputVariants = cva(
  'flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-sm',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
        xl: 'h-12 px-5 text-lg',
      },
      state: {
        default: 'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        success: 'border-green-500 focus-visible:border-green-600 focus-visible:ring-green-500/20',
        warning: 'border-yellow-500 focus-visible:border-yellow-600 focus-visible:ring-yellow-500/20',
        error: 'border-red-500 focus-visible:border-red-600 focus-visible:ring-red-500/20',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  },
);

// 扩展InputProps接口
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants>,
    Omit<IInputProps, 'size'> {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local' | 'file';
  /** 是否显示清除按钮 */
  allowClear?: boolean;
  /** 前缀元素 */
  prefix?: React.ReactNode;
  /** 后缀元素 */
  suffix?: React.ReactNode;
  /** 标签 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 帮助文本 */
  helperText?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 最大长度 */
  maxLength?: number;
  /** 最小长度 */
  minLength?: number;
  /** 输入模式 */
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'search' | 'none';
  /** 自动完成 */
  autoComplete?: string;
  /** 自动纠正 */
  autoCorrect?: 'on' | 'off';
  /** 自动大写 */
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  /** 是否检查拼写 */
  spellCheck?: boolean;
  /** 清除回调 */
  onClear?: () => void;
  /** 变化回调 */
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 焦点回调 */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 失焦回调 */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

// 清除按钮组件
const ClearButton = React.forwardRef<HTMLButtonElement, {
  onClear: () => void;
  className?: string;
}>(({ onClear, className }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClear}
    className={cn(
      'absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600',
      className
    )}
    aria-label="清除输入"
  >
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  </button>
));
ClearButton.displayName = 'ClearButton';

// Input实现组件
const InputImpl = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      size,
      state,
      allowClear = false,
      prefix,
      suffix,
      label,
      error,
      helperText,
      required = false,
      readonly = false,
      disabled = false,
      placeholder,
      maxLength,
      minLength,
      inputMode,
      autoComplete,
      autoCorrect = 'off',
      autoCapitalize = 'off',
      spellCheck = false,
      id,
      name,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      onClear,
      ...props
    },
    ref
  ) => {
    // 生成唯一ID
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const labelId = `${inputId}-label`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // 内部状态管理
    const [internalValue, setInternalValue] = React.useState(
      value !== undefined ? value : defaultValue || ''
    );
    const [isFocused, setIsFocused] = React.useState(false);

    // 受控/非受控处理
    const currentValue = value !== undefined ? value : internalValue;
    const hasValue = currentValue !== '' && currentValue !== undefined && currentValue !== null;

    // 确定实际状态
    const actualState = error ? 'error' : state;

    // 清除处理
    const handleClear = React.useCallback(() => {
      if (disabled || readonly) return;

      if (value === undefined) {
        setInternalValue('');
      }

      onClear?.();

      // 触发change事件
      const syntheticEvent = {
        target: { value: '' },
        currentTarget: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>;

      onChange?.('', syntheticEvent);
    }, [disabled, readonly, value, onClear, onChange]);

    // 变化处理
    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;

        if (value === undefined) {
          setInternalValue(newValue);
        }

        onChange?.(newValue, event);
      },
      [value, onChange]
    );

    // 焦点处理
    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(event);
      },
      [onFocus]
    );

    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        onBlur?.(event);
      },
      [onBlur]
    );

    // 构建输入框属性
    const inputProps = React.useMemo(() => ({
      ...props,
      id: inputId,
      name: name || inputId,
      type,
      value: currentValue,
      disabled,
      readOnly: readonly,
      required,
      placeholder,
      maxLength,
      minLength,
      inputMode,
      autoComplete,
      autoCorrect,
      autoCapitalize,
      spellCheck,
      'aria-invalid': error ? 'true' : 'false',
      'aria-required': required,
      'aria-describedby': cn(
        error && errorId,
        helperText && helperId,
        props['aria-describedby']
      ),
      'aria-label': props['aria-label'] || label,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
    }), [
      props,
      inputId,
      name,
      type,
      currentValue,
      disabled,
      readonly,
      required,
      placeholder,
      maxLength,
      minLength,
      inputMode,
      autoComplete,
      autoCorrect,
      autoCapitalize,
      spellCheck,
      error,
      errorId,
      helperId,
      label,
      handleChange,
      handleFocus,
      handleBlur,
    ]);

    // 渲染前缀和后缀
    const renderPrefix = prefix && (
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
        {prefix}
      </div>
    );

    const renderSuffix = suffix && (
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
        {suffix}
      </div>
    );

    // 渲染清除按钮
    const renderClearButton = allowClear && hasValue && !disabled && !readonly && !suffix && (
      <ClearButton onClear={handleClear} />
    );

    // 计算padding
    const paddingClass = cn({
      'pl-10': prefix,
      'pr-10': suffix || (allowClear && hasValue && !disabled && !readonly),
    });

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            id={labelId}
            className={cn(
              'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
              error && 'text-red-600 dark:text-red-400',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {renderPrefix}
          <input
            ref={ref}
            className={cn(
              inputVariants({ size, state: actualState }),
              paddingClass,
              {
                'pr-10': renderClearButton,
                'text-gray-500': disabled,
                'cursor-not-allowed': disabled || readonly,
              },
              'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30',
              className
            )}
            data-slot="input"
            {...inputProps}
          />
          {renderClearButton}
          {renderSuffix}
        </div>

        {(error || helperText) && (
          <div className="space-y-1">
            {error && (
              <p
                id={errorId}
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {error}
              </p>
            )}
            {helperText && !error && (
              <p
                id={helperId}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

InputImpl.displayName = 'Input';

// 创建Input组件类型
export type InputComponent = ForwardRefComponent<HTMLInputElement, InputProps>;

// 导出Input组件
export const Input = InputImpl as InputComponent;

export default Input;
// InputProps 已在定义处 export，无需重复
