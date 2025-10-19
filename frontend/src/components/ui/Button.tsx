import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { ButtonProps, ForwardRefComponent } from './ui.types';
// 简化的事件处理器，避免循环依赖
const createClickHandler = (handler?: React.MouseEventHandler<HTMLButtonElement>) => handler;

// 按钮变体配置
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium select-none transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent',
        ghost:
          'hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent',
        link: 'text-primary underline-offset-4 hover:underline focus-visible:ring-primary',
        brand:
          'bg-brand-500 text-white border border-brand-600 shadow-lg hover:bg-brand-600 hover:border-brand-700 hover:shadow-xl focus-visible:ring-brand-300 disabled:bg-brand-300 disabled:border-brand-400',
        success:
          'bg-green-500 text-white border border-green-600 hover:bg-green-600 hover:border-green-700 focus-visible:ring-green-300 disabled:bg-green-300 disabled:border-green-400',
        warning:
          'bg-yellow-500 text-white border border-yellow-600 hover:bg-yellow-600 hover:border-yellow-700 focus-visible:ring-yellow-300 disabled:bg-yellow-300 disabled:border-yellow-400',
        info:
          'bg-blue-500 text-white border border-blue-600 hover:bg-blue-600 hover:border-blue-700 focus-visible:ring-blue-300 disabled:bg-blue-300 disabled:border-blue-400',
        glass:
          'bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 text-foreground shadow-xl hover:from-white/25 hover:to-white/10 hover:shadow-2xl dark:from-white/10 dark:to-white/5 dark:border-white/20',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-base',
        xl: 'h-12 px-10 text-lg',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
      shape: {
        default: 'rounded-md',
        rounded: 'rounded-lg',
        pill: 'rounded-full',
        square: 'rounded-none',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'default',
    },
  },
);

// Button变体Props类型（从ui.types.ts导入的类型已包含所有必要属性）
type ButtonVariantProps = {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  shape?: VariantProps<typeof buttonVariants>['shape'];
};

// Button实现组件
const ButtonImpl = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      shape,
      asChild = false,
      block = false,
      disabled = false,
      loading = false,
      leftIcon,
      rightIcon,
      loadingText,
      children,
      type = 'button',
      onClick,
      radius,
      ...props
    },
    ref
  ) => {
    // 创建适配的点击事件处理器
    const adaptedOnClick = React.useMemo(() => {
      return createClickHandler(onClick);
    }, [onClick]);

    // 将radius映射到对应的shape变体
    const getShapeFromRadius = (radiusValue?: string | number) => {
      if (radiusValue === undefined || radiusValue === null) return shape;
      if (typeof radiusValue === 'number') {
        if (radiusValue === 0) return 'square';
        if (radiusValue <= 4) return 'default';
        if (radiusValue <= 8) return 'rounded';
        return 'pill';
      }
      // 字符串处理
      const radiusStr = String(radiusValue);
      if (radiusStr.includes('full') || radiusStr.includes('50%')) return 'pill';
      if (radiusStr.includes('none') || radiusStr.includes('0')) return 'square';
      if (radiusStr.includes('lg') || radiusStr.includes('xl')) return 'pill';
      return 'rounded';
    };

    const finalShape = getShapeFromRadius(radius);
    const Comp = asChild ? Slot : 'button';

    // 构建按钮属性
    const buttonProps = React.useMemo(() => {
      return {
        ...props,
        disabled: disabled || loading,
        'aria-disabled': disabled || loading,
        'aria-busy': loading,
        role: asChild ? undefined : 'button',
        type: asChild ? undefined : type,
        onClick: adaptedOnClick,
      };
    }, [props, disabled, loading, asChild, type, adaptedOnClick]);

    // 渲染加载图标
    const LoadingSpinner = React.useMemo(() => (
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
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
    ), []);

    // 渲染内容
    const renderContent = React.useMemo(() => {
      if (loading) {
        return (
          <>
            {LoadingSpinner}
            {loadingText || '加载中...'}
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
    }, [loading, loadingText, leftIcon, rightIcon, children, LoadingSpinner]);

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, shape: finalShape }),
          {
            'w-full': block,
            'cursor-not-allowed': disabled || loading,
          },
          // 焦点样式增强
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
        {...buttonProps}
      >
        {renderContent}
      </Comp>
    );
  }
);

ButtonImpl.displayName = 'Button';

// 导出Button组件
export const Button = ButtonImpl as ForwardRefComponent<HTMLButtonElement, ButtonProps>;

export default Button;
