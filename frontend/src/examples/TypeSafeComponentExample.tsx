/**
 * 类型安全组件示例
 * 展示如何在实际项目中应用React组件类型安全最佳实践
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import {
  // 类型工具
  ComponentPropsType,
  ComponentRefType,
  StrictProps,
  ConditionalRequired,
  MergeProps,
  WithDefaults,
  ValidatedProps,
  AsyncProps,

  // 事件处理器
  UnifiedEventHandler,
  FlexibleEventHandler,
  EventHandlers,

  // 子组件工具
  SubComponentProps,
  ComponentWithSubComponents,
  SubComponentFactory,
  createSubComponent,
  attachSubComponents,

  // Ref工具
  ForwardRefComponent,
  createForwardRefComponent,

  // 类型守卫
  isValidReactNode,
  hasRequiredProps,

  // 可访问性
  AriaAttributes,
  AccessibilityRequirements,
  checkAccessibility,

  // 性能工具
  useMemoizedProps,
  useStableCallback,
  useConditionalRender,

  // 调试工具
  ComponentDebugger,
} from '@/utils/componentTypeUtils';

// ==================== 示例1: 基础类型安全组件 ====================

/**
 * 基础Props接口设计
 */
interface BaseButtonProps {
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

interface ButtonEventProps {
  onClick?: FlexibleEventHandler<void, React.MouseEvent<HTMLButtonElement>>;
  onFocus?: FlexibleEventHandler<void, React.FocusEvent<HTMLButtonElement>>;
  onBlur?: FlexibleEventHandler<void, React.FocusEvent<HTMLButtonElement>>;
}

interface ButtonStyleProps extends VariantProps<typeof buttonVariants> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  shape?: 'rounded' | 'square' | 'pill';
}

/**
 * 组合式Props设计
 */
export interface ButtonProps extends
  BaseButtonProps,
  ButtonEventProps,
  ButtonStyleProps,
  AriaAttributes {
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
  /** 自定义数据属性 */
  'data-testid'?: string;
}

/**
 * CVA变体配置
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-base',
        xl: 'h-12 px-10 text-lg',
      },
      shape: {
        rounded: 'rounded-md',
        square: 'rounded-none',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'rounded',
    },
  },
);

/**
 * 类型安全的Button组件实现
 */
export const Button = createForwardRefComponent<HTMLButtonElement, ButtonProps>(
  'Button',
  (
    {
      className,
      children,
      disabled = false,
      loading = false,
      onClick,
      onFocus,
      onBlur,
      variant,
      size,
      shape,
      type = 'button',
      leftIcon,
      rightIcon,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      role,
      tabIndex,
      'data-testid': testId,
      ...props
    },
    ref
  ) => {
    // 创建适配的事件处理器
    const adaptedOnClick = React.useMemo(
      () => EventHandlers.onClick(onClick),
      [onClick]
    );

    const adaptedOnFocus = React.useMemo(
      () => EventHandlers.onFocus(onFocus),
      [onFocus]
    );

    const adaptedOnBlur = React.useMemo(
      () => EventHandlers.onBlur(onBlur),
      [onBlur]
    );

    // 渲染内容
    const renderContent = React.useMemo(() => {
      if (loading) {
        return (
          <>
            <LoadingSpinner />
            {'加载中...'}
          </>
        );
      }

      return (
        <>
          {leftIcon && <span className="button-left-icon">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="button-right-icon">{rightIcon}</span>}
        </>
      );
    }, [loading, leftIcon, rightIcon, children]);

    // 检查可访问性
    const accessibilityCheck = React.useMemo(() => {
      return checkAccessibility({
        'aria-label': ariaLabel,
        'aria-describedby': ariaDescribedBy,
        role,
        tabIndex,
        children,
      });
    }, [ariaLabel, ariaDescribedBy, role, tabIndex, children]);

    // 调试日志
    React.useEffect(() => {
      ComponentDebugger.log('Button', {
        variant,
        size,
        shape,
        disabled,
        loading,
        accessibility: accessibilityCheck,
      });
    }, [variant, size, shape, disabled, loading, accessibilityCheck]);

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, shape }), className)}
        disabled={disabled || loading}
        type={type}
        onClick={adaptedOnClick}
        onFocus={adaptedOnFocus}
        onBlur={adaptedOnBlur}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        role={role}
        tabIndex={tabIndex}
        data-testid={testId}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {renderContent}
      </button>
    );
  }
);

// ==================== 示例2: 子组件架构 ====================

/**
 * 子组件Props定义
 */
interface CardHeaderProps extends SubComponentProps {
  title?: string;
  subtitle?: string;
  extra?: React.ReactNode;
}

interface CardContentProps extends SubComponentProps {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

interface CardFooterProps extends SubComponentProps {
  actions?: React.ReactNode;
}

interface CardProps extends SubComponentProps {
  title?: string;
  hoverable?: boolean;
  clickable?: boolean;
  bordered?: boolean;
  shadow?: boolean;
  onClick?: FlexibleEventHandler<void, React.MouseEvent<HTMLDivElement>>;
}

/**
 * Card子组件实现
 */
const CardHeaderImpl = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subtitle, extra, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-6', className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {extra && <div className="flex items-center space-x-2">{extra}</div>}
        </div>
      </div>
    );
  }
);

const CardContentImpl = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, padding = 'md', children, ...props }, ref) => {
    const paddingClass = React.useMemo(() => {
      switch (padding) {
        case 'none':
          return '';
        case 'sm':
          return 'p-4';
        case 'md':
          return 'p-6';
        case 'lg':
          return 'p-8';
        default:
          return 'p-6';
      }
    }, [padding]);

    return (
      <div
        ref={ref}
        className={cn(paddingClass, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

const CardFooterImpl = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, actions, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between p-6 pt-0', className)}
        {...props}
      >
        {actions}
      </div>
    );
  }
);

/**
 * Card主组件实现
 */
const CardImpl = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      children,
      title,
      hoverable = false,
      clickable = false,
      bordered = true,
      shadow = true,
      onClick,
      ...props
    },
    ref
  ) => {
    const adaptedOnClick = React.useMemo(
      () => EventHandlers.onClick(onClick),
      [onClick]
    );

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg bg-card text-card-foreground',
          bordered && 'border',
          shadow && 'shadow-sm',
          hoverable && 'transition-shadow hover:shadow-md',
          clickable && 'cursor-pointer hover:shadow-md active:scale-[0.98] transition-transform',
          className
        )}
        onClick={adaptedOnClick}
        {...props}
      >
        {title && (
          <Card.Header title={title} />
        )}
        {children}
      </div>
    );
  }
);

/**
 * 创建子组件并附加到主组件
 */
const CardHeader = createSubComponent('Card.Header', CardHeaderImpl);
const CardContent = createSubComponent('Card.Content', CardContentImpl);
const CardFooter = createSubComponent('Card.Footer', CardFooterImpl);

export const Card = attachSubComponents(CardImpl, {
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
}) as ComponentWithSubComponents<CardProps, {
  Header: React.FC<CardHeaderProps>;
  Content: React.FC<CardContentProps>;
  Footer: React.FC<CardFooterProps>;
}>;

// ==================== 示例3: 异步组件 ====================

/**
 * 异步数据组件Props
 */
interface AsyncDataProps<T> extends AsyncProps<T> {
  fallback?: React.ReactNode;
  errorComponent?: (error: Error) => React.ReactNode;
  retryButton?: boolean;
  onRetry?: () => void;
}

/**
 * 通用异步数据组件
 */
export function AsyncDataComponent<T>({
  data,
  loading = false,
  error,
  onLoad,
  onError,
  fallback = <div>加载中...</div>,
  errorComponent = (err) => <div>错误: {err.message}</div>,
  retryButton = true,
  onRetry,
}: AsyncDataProps<T>) {
  // 加载状态
  const loadingElement = useConditionalRender(
    loading,
    true,
    () => fallback,
    null
  );

  // 错误状态
  const errorElement = useConditionalRender(
    !!error,
    error,
    (err) => (
      <div>
        {errorComponent(err)}
        {retryButton && (
          <Button onClick={onRetry} variant="outline" size="sm">
            重试
          </Button>
        )}
      </div>
    ),
    null
  );

  // 成功状态
  const successElement = useConditionalRender(
    !!data && !loading && !error,
    data,
    (dataItem) => {
      React.useEffect(() => {
        onLoad?.(dataItem);
      }, [dataItem, onLoad]);
      return <div>{JSON.stringify(dataItem)}</div>;
    },
    null
  );

  return (
    <>
      {loadingElement}
      {errorElement}
      {successElement}
    </>
  );
}

// ==================== 示例4: 表单组件 ====================

/**
 * 表单字段Props
 */
interface FormFieldProps<T = string> {
  name: string;
  label?: string;
  value?: T;
  defaultValue?: T;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  onChange?: FlexibleEventHandler<T, ChangeEvent<HTMLInputElement>>;
  validator?: (value: T) => string | null;
}

/**
 * 类型安全的表单字段组件
 */
export function FormField<T = string>({
  name,
  label,
  value,
  defaultValue,
  required = false,
  disabled = false,
  error,
  helperText,
  onChange,
  validator,
}: FormFieldProps<T>) {
  const [internalValue, setInternalValue] = React.useState<T | undefined>(
    value !== undefined ? value : defaultValue
  );
  const [validationError, setValidationError] = React.useState<string | null>(error || null);

  // 受控/非受控处理
  const currentValue = value !== undefined ? value : internalValue;

  // 验证函数
  const validateValue = useStableCallback((val: T) => {
    if (validator) {
      const validationError = validator(val);
      setValidationError(validationError);
      return validationError === null;
    }
    return true;
  }, [validator]);

  // 变更处理
  const handleChange = useStableCallback((val: T, event: ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) {
      setInternalValue(val);
    }

    // 验证新值
    validateValue(val);

    // 调用外部onChange
    onChange?.(val, event);
  }, [value, onChange, validateValue]);

  // 检查必填字段
  const hasRequiredError = required && !currentValue;
  const hasError = hasRequiredError || !!validationError;

  const adaptedOnChange = React.useMemo(
    () => EventHandlers.onChange(handleChange),
    [handleChange]
  );

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={name} className="text-sm font-medium leading-none">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <input
        id={name}
        name={name}
        value={currentValue as string}
        onChange={(e) => adaptedOnChange?.(e.target.value as T, e)}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={`${name}-helper ${name}-error`}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          hasError && 'border-red-500 focus:border-red-600'
        )}
      />

      {(error || helperText) && (
        <div className="space-y-1">
          {error && (
            <p id={`${name}-error`} className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {helperText && !error && (
            <p id={`${name}-helper`} className="text-sm text-muted-foreground">
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== 示例5: 多态组件 ====================

/**
 * 多态组件Props
 */
interface PolymorphicComponentProps<T extends React.ElementType = 'button'> {
  as?: T;
  children?: React.ReactNode;
  className?: string;
}

/**
 * 类型安全的多态组件
 */
export const PolymorphicComponent = createPolymorphicComponent<'button'>();

// ==================== 示例6: 组件使用示例 ====================

/**
 * 使用示例组件
 */
export function ComponentUsageExample() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({ name: '', email: '' });
  const [asyncData, setAsyncData] = React.useState<{ message: string } | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const handleButtonClick = useStableCallback(() => {
    console.log('按钮被点击');
  }, []);

  const handleCardClick = useStableCallback(() => {
    console.log('卡片被点击');
  }, []);

  const handleFormChange = useStableCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const loadAsyncData = useStableCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAsyncData({ message: '异步加载成功' });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('未知错误'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retryLoad = useStableCallback(() => {
    loadAsyncData();
  }, [loadAsyncData]);

  React.useEffect(() => {
    ComponentDebugger.enable();
    return () => ComponentDebugger.disable();
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* 基础按钮示例 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">按钮组件示例</h3>
        <div className="flex gap-2">
          <Button onClick={handleButtonClick}>主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="outline">边框按钮</Button>
          <Button loading>加载中按钮</Button>
          <Button disabled>禁用按钮</Button>
        </div>
      </div>

      {/* 卡片组件示例 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">卡片组件示例</h3>
        <Card clickable onClick={handleCardClick}>
          <Card.Header
            title="卡片标题"
            subtitle="这是一个副标题"
            extra={<Button size="sm">操作</Button>}
          />
          <Card.Content>
            <p>这是卡片的内容区域。</p>
          </Card.Content>
          <Card.Footer
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  取消
                </Button>
                <Button size="sm">确定</Button>
              </div>
            }
          />
        </Card>
      </div>

      {/* 表单组件示例 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">表单组件示例</h3>
        <div className="grid gap-4">
          <FormField
            name="name"
            label="姓名"
            value={formData.name}
            onChange={(value) => handleFormChange('name', value)}
            required
            validator={(value) => {
              if (!value.trim()) return '姓名不能为空';
              if (value.length < 2) return '姓名至少需要2个字符';
              return null;
            }}
          />
          <FormField
            name="email"
            label="邮箱"
            value={formData.email}
            onChange={(value) => handleFormChange('email', value)}
            type="email"
            required
            validator={(value) => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!value.trim()) return '邮箱不能为空';
              if (!emailRegex.test(value)) return '邮箱格式不正确';
              return null;
            }}
          />
        </div>
      </div>

      {/* 异步数据组件示例 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">异步数据组件示例</h3>
        <Button onClick={loadAsyncData} disabled={isLoading}>
          加载数据
        </Button>
        <AsyncDataComponent
          data={asyncData}
          loading={isLoading}
          error={error}
          onRetry={retryLoad}
          fallback={<div>正在加载数据...</div>}
          errorComponent={(err) => (
            <div className="text-red-600">
              加载失败: {err.message}
            </div>
          )}
        />
      </div>

      {/* 多态组件示例 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">多态组件示例</h3>
        <div className="flex gap-2">
          <PolymorphicComponent>按钮形式</PolymorphicComponent>
          <PolymorphicComponent as="a" href="#" className="text-blue-600">
            链接形式
          </PolymorphicComponent>
        </div>
      </div>
    </div>
  );
}

// ==================== 加载图标组件 ====================

const LoadingSpinner = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('animate-spin h-4 w-4', className)}
      {...props}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
);

LoadingSpinner.displayName = 'LoadingSpinner';

// ==================== 导出所有示例 ====================
// 注意: 所有类型和组件已在上方使用 export 关键字导出
// 无需重复导出以避免TS2484/TS2323错误