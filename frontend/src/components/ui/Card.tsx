import * as React from 'react';
import { cn } from '@/lib/utils';
import type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardContentProps,
  CardFooterProps,
  CardComponent,
  BaseComponentProps,
  EventHandlersProps,
} from './ui.types';
import { createSubComponent, attachSubComponents } from './ui.types';

// 子组件实现
const CardHeaderImpl = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', extra, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col space-y-1.5 p-6 pb-4',
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">{children}</div>
          {extra && <div className="flex items-center space-x-2">{extra}</div>}
        </div>
      </div>
    );
  }
);
CardHeaderImpl.displayName = 'Card.Header';

const CardTitleImpl = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = '', level = 3, ...props }, ref) => {
    const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
    return (
      <HeadingTag
        ref={ref}
        className={cn(
          'text-lg font-semibold leading-none tracking-tight text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </HeadingTag>
    );
  }
);
CardTitleImpl.displayName = 'Card.Title';

const CardContentImpl = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('p-6 pt-0', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardContentImpl.displayName = 'Card.Content';

const CardFooterImpl = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center p-6 pt-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooterImpl.displayName = 'Card.Footer';

// 主组件实现
const CardImpl = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className = '',
      title,
      hoverable = false,
      clickable = false,
      onClick,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border bg-card text-card-foreground shadow-sm',
          hoverable && 'transition-shadow hover:shadow-md',
          clickable && 'cursor-pointer hover:shadow-md active:scale-[0.98] transition-transform',
          className
        )}
        onClick={onClick}
        {...props}
      >
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        {children}
      </div>
    );
  }
);
CardImpl.displayName = 'Card';

// 创建子组件
const CardHeader = createSubComponent('Card.Header', CardHeaderImpl);
const CardTitle = createSubComponent('Card.Title', CardTitleImpl);
const CardContent = createSubComponent('Card.Content', CardContentImpl);
const CardFooter = createSubComponent('Card.Footer', CardFooterImpl);

// 附加子组件到主组件
const Card = attachSubComponents(CardImpl, {
  Header: CardHeader,
  Title: CardTitle,
  Content: CardContent,
  Footer: CardFooter,
});

export default Card;
export { CardHeader, CardTitle, CardContent, CardFooter };