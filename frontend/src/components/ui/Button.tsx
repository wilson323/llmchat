import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium select-none transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        brand:
          'bg-brand-500 text-white border border-brand-600 shadow-lg hover:bg-brand-600 hover:border-brand-700 hover:shadow-xl focus-visible:ring-brand-300 disabled:bg-brand-300 disabled:border-brand-400',
        secondary:
          'bg-card text-foreground border border-border hover:bg-muted/50 hover:border-border/80 shadow-sm focus-visible:ring-border/50',
        outline:
          'bg-transparent text-brand-500 border border-brand-300 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-400 focus-visible:ring-brand-300 dark:hover:bg-brand-900/20 dark:hover:text-brand-400',
        ghost: 'bg-transparent text-foreground hover:bg-[var(--hover-overlay)] hover:text-foreground focus-visible:ring-border/50',
        destructive:
          'bg-error text-white border border-error-600 hover:bg-error-600 hover:border-error-700 focus-visible:ring-error-300 disabled:bg-error-300 disabled:border-error-400',
        success:
          'bg-success text-white border border-success-600 hover:bg-success-600 hover:border-success-700 focus-visible:ring-success-300 disabled:bg-success-300 disabled:border-success-400',
        warning:
          'bg-warning text-white border border-warning-600 hover:bg-warning-600 hover:border-warning-700 focus-visible:ring-warning-300 disabled:bg-warning-300 disabled:border-warning-400',
        info:
          'bg-info text-white border border-info-600 hover:bg-info-600 hover:border-info-700 focus-visible:ring-info-300 disabled:bg-info-300 disabled:border-info-400',
        glass:
          'bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 text-foreground shadow-xl hover:from-white/25 hover:to-white/10 hover:shadow-2xl dark:from-white/10 dark:to-white/5 dark:border-white/20',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
        icon: 'h-10 w-10 p-0',
      },
      radius: {
        md: 'rounded-xl',
        lg: 'rounded-2xl',
        full: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'brand',
      size: 'md',
      radius: 'md',
    },
  },
);

export interface ButtonProps
  extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'disabled'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const ButtonImpl = (
  {
    className,
    variant,
    size,
    radius,
    asChild = false,
    disabled = false,
    children,
    type = 'button',
    ...props
  }: ButtonProps,
  ref: ((instance: HTMLButtonElement | null) => void) | null | undefined
) => {
    const Comp = asChild ? Slot : 'button';

    // 确保按钮有适当的aria属性
    const buttonProps = {
      ...props,
      disabled,
      'aria-disabled': disabled,
      role: asChild ? undefined : 'button',
      type: asChild ? undefined : type,
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, radius }),
          // 添加高对比度焦点指示器
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...buttonProps}
        >
        {children}
      </Comp>
    );
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(ButtonImpl as any);
Button.displayName = 'Button';

export default Button;
