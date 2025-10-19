import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type {
  SelectProps as ISelectProps,
  SelectTriggerProps as ISelectTriggerProps,
  SelectValueProps as ISelectValueProps,
  SelectContentProps as ISelectContentProps,
  SelectItemProps as ISelectItemProps,
  SelectComponent,
  ForwardRefComponent,
} from './ui.types';
import { createSubComponent, attachSubComponents } from './ui.types';

// Select变体配置
const selectVariants = cva(
  'relative w-full',
  {
    variants: {
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
      state: {
        default: '',
        error: 'border-red-500 focus:border-red-600',
        success: 'border-green-500 focus:border-green-600',
        warning: 'border-yellow-500 focus:border-yellow-600',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  },
);

// SelectTrigger变体配置
const selectTriggerVariants = cva(
  'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
      },
      state: {
        default: 'border-input',
        error: 'border-red-500 focus:border-red-600',
        success: 'border-green-500 focus:border-green-600',
        warning: 'border-yellow-500 focus:border-yellow-600',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  },
);

// 扩展Props接口
export interface SelectProps
  extends ISelectProps,
    VariantProps<typeof selectVariants> {
  /** 标签 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 帮助文本 */
  helperText?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否为只读 */
  readonly?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 是否可搜索 */
  searchable?: boolean;
  /** 搜索值 */
  searchValue?: string;
  /** 搜索变化回调 */
  onSearchChange?: (value: string) => void;
  /** 是否允许清空 */
  allowClear?: boolean;
  /** 最大显示标签数量 */
  maxTagCount?: number;
}

export interface SelectTriggerProps
  extends ISelectTriggerProps,
    VariantProps<typeof selectTriggerVariants> {
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 占位符 */
  placeholder?: string;
}

export interface SelectValueProps extends ISelectValueProps {
  /** 占位符 */
  placeholder?: string;
}

export interface SelectContentProps extends ISelectContentProps {
  /** 最大高度 */
  maxHeight?: number;
  /** 是否空 */
  empty?: boolean;
  /** 空状态渲染 */
  renderEmpty?: () => React.ReactNode;
}

export interface SelectItemProps extends ISelectItemProps {
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否选中 */
  selected?: boolean;
  /** 前缀图标 */
  prefix?: React.ReactNode;
  /** 后缀图标 */
  suffix?: React.ReactNode;
  /** 描述文本 */
  description?: string;
}

// SelectContext
interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedValue: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined);

// useContext hook
const useSelectContext = () => {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a Select component');
  }
  return context;
};

// Hook for outside click detection
const useOutsideClick = (
  ref: React.RefObject<HTMLElement>,
  handler: (event: MouseEvent | TouchEvent) => void
) => {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

// Select.Trigger组件
const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  (
    {
      className,
      size,
      state,
      disabled = false,
      readonly = false,
      placeholder,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { isOpen, setIsOpen, selectedValue, disabled: ctxDisabled } = useSelectContext();

    const isDisabled = disabled || ctxDisabled;
    const displayValue = selectedValue || placeholder || '请选择';

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDisabled || readonly) return;
        e.preventDefault();
        setIsOpen(!isOpen);
        onClick?.(e);
      },
      [isDisabled, readonly, isOpen, setIsOpen, onClick]
    );

    return (
      <button
        ref={ref}
        type="button"
        className={cn(selectTriggerVariants({ size, state }), {
          'cursor-not-allowed': isDisabled,
          'cursor-default': readonly,
        }, className)}
        disabled={isDisabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={handleClick}
        {...props}
      >
        <span className={cn(
          'block truncate',
          !selectedValue && 'text-muted-foreground'
        )}>
          {children || displayValue}
        </span>
        <svg
          className={cn(
            'h-4 w-4 opacity-50 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    );
  }
);
SelectTrigger.displayName = 'Select.Trigger';

// Select.Value组件
const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, ...props }, ref) => {
    const { selectedValue } = useSelectContext();
    const displayValue = selectedValue || placeholder || '请选择';

    return (
      <span
        ref={ref}
        className={cn(
          'block truncate',
          !selectedValue && 'text-muted-foreground',
          className
        )}
        {...props}
      >
        {displayValue}
      </span>
    );
  }
);
SelectValue.displayName = 'Select.Value';

// Select.Content组件
const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  (
    {
      className,
      children,
      maxHeight = 240,
      empty = false,
      renderEmpty,
      ...props
    },
    ref
  ) => {
    const { isOpen } = useSelectContext();

    if (!isOpen) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md',
          className
        )}
        style={{ maxHeight }}
        role="listbox"
        {...props}
      >
        {empty ? (
          renderEmpty ? (
            renderEmpty()
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
              暂无数据
            </div>
          )
        ) : (
          children
        )}
      </div>
    );
  }
);
SelectContent.displayName = 'Select.Content';

// Select.Item组件
const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  (
    {
      className,
      value,
      disabled = false,
      selected = false,
      prefix,
      suffix,
      description,
      children,
      ...props
    },
    ref
  ) => {
    const { onValueChange, setIsOpen, selectedValue } = useSelectContext();
    const isSelected = selected || selectedValue === value;

    const handleClick = React.useCallback(() => {
      if (disabled) return;
      onValueChange?.(value);
      setIsOpen(false);
    }, [disabled, value, onValueChange, setIsOpen]);

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:bg-accent focus:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground',
          disabled && 'pointer-events-none opacity-50',
          className
        )}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled}
        onClick={handleClick}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        )}
        {prefix && (
          <span className="mr-2 h-4 w-4 flex-shrink-0">{prefix}</span>
        )}
        <div className="flex-1">
          <div className="font-medium">{children}</div>
          {description && (
            <div className="text-xs text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        {suffix && (
          <span className="ml-2 h-4 w-4 flex-shrink-0">{suffix}</span>
        )}
      </div>
    );
  }
);
SelectItem.displayName = 'Select.Item';

// 主Select组件
const SelectImpl = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      children,
      value,
      onValueChange,
      defaultValue,
      label,
      error,
      helperText,
      required = false,
      disabled = false,
      readonly = false,
      placeholder = '请选择',
      searchable = false,
      searchValue,
      onSearchChange,
      allowClear = false,
      maxTagCount,
      className,
      size,
      state,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');
    const [isOpen, setIsOpen] = React.useState(false);

    // 处理受控/非受控
    const currentValue = value !== undefined ? value : internalValue;

    // 处理值变化
    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (value === undefined) {
          setInternalValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [value, onValueChange]
    );

    // 处理外部点击
    const selectRef = React.useRef<HTMLDivElement>(null);
    useOutsideClick(selectRef, () => {
      setIsOpen(false);
    });

    // 键盘事件处理
    React.useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Context值
    const contextValue = React.useMemo(
      () => ({
        value: currentValue,
        onValueChange: handleValueChange,
        isOpen,
        setIsOpen,
        selectedValue: currentValue,
        placeholder,
        disabled,
        searchable,
        searchValue,
        onSearchChange,
      }),
      [
        currentValue,
        handleValueChange,
        isOpen,
        setIsOpen,
        placeholder,
        disabled,
        searchable,
        searchValue,
        onSearchChange,
      ]
    );

    return (
      <SelectContext.Provider value={contextValue}>
        <div ref={ref} className={cn('space-y-2', className)} {...props}>
          {label && (
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {label}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}

          <div className={cn(selectVariants({ size, state }))} ref={selectRef}>
            {children}
          </div>

          {(error || helperText) && (
            <div className="space-y-1">
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              {helperText && !error && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {helperText}
                </p>
              )}
            </div>
          )}
        </div>
      </SelectContext.Provider>
    );
  }
);
SelectImpl.displayName = 'Select';

// 创建子组件
const SelectTriggerComponent = createSubComponent('Select.Trigger', SelectTrigger);
const SelectValueComponent = createSubComponent('Select.Value', SelectValue);
const SelectContentComponent = createSubComponent('Select.Content', SelectContent);
const SelectItemComponent = createSubComponent('Select.Item', SelectItem);

// 附加子组件
const Select = attachSubComponents(SelectImpl, {
  Trigger: SelectTriggerComponent,
  Value: SelectValueComponent,
  Content: SelectContentComponent,
  Item: SelectItemComponent,
});

// 创建Select组件类型
export type SelectComponentType = ForwardRefComponent<HTMLDivElement, SelectProps> & {
  Trigger: typeof SelectTriggerComponent;
  Value: typeof SelectValueComponent;
  Content: typeof SelectContentComponent;
  Item: typeof SelectItemComponent;
};

// 导出（所有类型已在定义处使用 export 关键字导出）
export default Select as SelectComponentType;