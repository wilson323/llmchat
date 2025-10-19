import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import type {
  ForwardRefComponent,
} from './ui.types';
import { createSubComponent, attachSubComponents } from './ui.types';

// Dropdown变体配置
const dropdownVariants = cva(
  'relative inline-block text-left',
  {
    variants: {
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
      },
      variant: {
        default: 'bg-background border border-input',
        ghost: 'bg-transparent border-transparent',
        outline: 'bg-transparent border border-input',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  },
);

// Dropdown基础Props
export interface DropdownProps extends
  Omit<React.HTMLAttributes<HTMLDivElement>, 'size'>,
  VariantProps<typeof dropdownVariants> {
  /** 是否打开 */
  open?: boolean;
  /** 默认打开 */
  defaultOpen?: boolean;
  /** 打开变化回调 */
  onOpenChange?: (open: boolean) => void;
  /** 触发方式 */
  trigger?: 'click' | 'hover' | 'contextmenu';
  /** 是否禁用 */
  disabled?: boolean;
  /** 位置 */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'right-end' | 'left-start' | 'left-end';
  /** 偏移量 */
  offset?: [number, number];
  /** 箭头显示 */
  showArrow?: boolean;
  /** 是否在容器内 */
  getPopupContainer?: () => HTMLElement;
}

// Dropdown.Trigger Props
export interface DropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

// Dropdown.Content Props
export interface DropdownContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** 最小宽度 */
  minWidth?: number;
  /** 最大宽度 */
  maxWidth?: number;
  /** 最大高度 */
  maxHeight?: number;
}

// Dropdown.Item Props
export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否危险 */
  danger?: boolean;
  /** 是否激活 */
  active?: boolean;
  /** 图标 */
  icon?: React.ReactNode;
  /** 快捷键 */
  shortcut?: string;
}

// Dropdown.Separator Props
export interface DropdownSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

// Dropdown.Group Props
export interface DropdownGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 分组标题 */
  title?: string;
  children: React.ReactNode;
}

// Dropdown.Context
interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  trigger: 'click' | 'hover' | 'contextmenu';
  placement: string;
  offset: [number, number];
  showArrow: boolean;
  disabled: boolean;
}

const DropdownContext = React.createContext<DropdownContextType | undefined>(undefined);

// useContext hook
const useDropdownContext = () => {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a Dropdown component');
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

// Dropdown.Trigger组件
const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const { isOpen, setIsOpen, trigger, disabled } = useDropdownContext();

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        if (trigger === 'click') {
          e.preventDefault();
          setIsOpen(!isOpen);
        }

        onClick?.(e);
      },
      [disabled, trigger, isOpen, setIsOpen, onClick]
    );

    const handleContextMenu = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        if (trigger === 'contextmenu') {
          e.preventDefault();
          setIsOpen(true);
        }
      },
      [disabled, trigger, setIsOpen]
    );

    const handleMouseEnter = React.useCallback(() => {
      if (trigger === 'hover') {
        setIsOpen(true);
      }
    }, [trigger, setIsOpen]);

    const handleMouseLeave = React.useCallback(() => {
      if (trigger === 'hover') {
        setIsOpen(false);
      }
    }, [trigger, setIsOpen]);

    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn('dropdown-trigger', className)}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
DropdownTrigger.displayName = 'Dropdown.Trigger';

// Dropdown.Content组件
const DropdownContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  (
    {
      children,
      className,
      minWidth = 180,
      maxWidth,
      maxHeight = 256,
      style,
      ...props
    },
    ref
  ) => {
    const { isOpen, placement, offset, showArrow } = useDropdownContext();

    if (!isOpen) return null;

    // 计算位置样式
    const getPositionStyles = () => {
      const [offsetX, offsetY] = offset;
      const baseStyles: React.CSSProperties = {
        position: 'absolute',
        zIndex: 50,
        minWidth,
        maxHeight,
        overflowY: 'auto',
      };

      if (maxWidth) {
        baseStyles.maxWidth = maxWidth;
      }

      switch (placement) {
        case 'bottom-start':
          return { ...baseStyles, top: '100%', left: 0, marginTop: offsetY, marginLeft: offsetX };
        case 'bottom-end':
          return { ...baseStyles, top: '100%', right: 0, marginTop: offsetY, marginRight: offsetX };
        case 'top-start':
          return { ...baseStyles, bottom: '100%', left: 0, marginBottom: offsetY, marginLeft: offsetX };
        case 'top-end':
          return { ...baseStyles, bottom: '100%', right: 0, marginBottom: offsetY, marginRight: offsetX };
        case 'right-start':
          return { ...baseStyles, left: '100%', top: 0, marginLeft: offsetX, marginTop: offsetY };
        case 'right-end':
          return { ...baseStyles, left: '100%', bottom: 0, marginLeft: offsetX, marginBottom: offsetY };
        case 'left-start':
          return { ...baseStyles, right: '100%', top: 0, marginRight: offsetX, marginTop: offsetY };
        case 'left-end':
          return { ...baseStyles, right: '100%', bottom: 0, marginRight: offsetX, marginBottom: offsetY };
        default:
          return { ...baseStyles, top: '100%', left: 0, marginTop: offsetY, marginLeft: offsetX };
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'py-1 bg-popover text-popover-foreground border rounded-md shadow-md',
          className
        )}
        style={{ ...getPositionStyles(), ...style }}
        role="menu"
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownContent.displayName = 'Dropdown.Content';

// Dropdown.Item组件
const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  (
    {
      children,
      className,
      disabled = false,
      danger = false,
      active = false,
      icon,
      shortcut,
      onClick,
      ...props
    },
    ref
  ) => {
    const { setIsOpen } = useDropdownContext();

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        onClick?.(e);
        setIsOpen(false);
      },
      [disabled, onClick, setIsOpen]
    );

    return (
      <button
        ref={ref}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus:bg-accent focus:text-accent-foreground',
          active && 'bg-accent text-accent-foreground',
          disabled && 'pointer-events-none opacity-50',
          danger && 'text-destructive hover:text-destructive hover:bg-destructive/10',
          className
        )}
        role="menuitem"
        disabled={disabled}
        onClick={handleClick}
        {...props}
      >
        {icon && (
          <span className="mr-2 h-4 w-4 flex-shrink-0">{icon}</span>
        )}
        <span className="flex-1">{children}</span>
        {shortcut && (
          <span className="ml-2 text-xs tracking-widest opacity-60">
            {shortcut}
          </span>
        )}
      </button>
    );
  }
);
DropdownItem.displayName = 'Dropdown.Item';

// Dropdown.Separator组件
const DropdownSeparator = React.forwardRef<HTMLDivElement, DropdownSeparatorProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-muted', className)}
      role="separator"
      {...props}
    />
  )
);
DropdownSeparator.displayName = 'Dropdown.Separator';

// Dropdown.Group组件
const DropdownGroup = React.forwardRef<HTMLDivElement, DropdownGroupProps>(
  ({ title, children, className, ...props }, ref) => (
    <div ref={ref} className={cn('py-1', className)} role="group" {...props}>
      {title && (
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {title}
        </div>
      )}
      {children}
    </div>
  )
);
DropdownGroup.displayName = 'Dropdown.Group';

// 主Dropdown组件
const DropdownImpl = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      children,
      open: controlledOpen,
      defaultOpen = false,
      onOpenChange,
      trigger = 'click',
      disabled = false,
      placement = 'bottom-start',
      offset = [0, 4],
      showArrow = false,
      className,
      ...props
    },
    ref
  ) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;

    const setIsOpen = React.useCallback(
      (newOpen: boolean) => {
        if (!isControlled) {
          setInternalOpen(newOpen);
        }
        onOpenChange?.(newOpen);
      },
      [isControlled, onOpenChange]
    );

    // 处理外部点击
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    useOutsideClick(dropdownRef, () => {
      if (trigger !== 'contextmenu') {
        setIsOpen(false);
      }
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
    }, [isOpen, setIsOpen]);

    // Context值
    const contextValue = React.useMemo(
      () => ({
        isOpen,
        setIsOpen,
        trigger,
        placement,
        offset,
        showArrow,
        disabled,
      }),
      [isOpen, setIsOpen, trigger, placement, offset, showArrow, disabled]
    );

    return (
      <DropdownContext.Provider value={contextValue}>
        <div
          ref={dropdownRef}
          className={cn(dropdownVariants(), className)}
          {...props}
        >
          {children}
        </div>
      </DropdownContext.Provider>
    );
  }
);
DropdownImpl.displayName = 'Dropdown';

// 创建子组件
const DropdownTriggerComponent = createSubComponent('Dropdown.Trigger', DropdownTrigger);
const DropdownContentComponent = createSubComponent('Dropdown.Content', DropdownContent);
const DropdownItemComponent = createSubComponent('Dropdown.Item', DropdownItem);
const DropdownSeparatorComponent = createSubComponent('Dropdown.Separator', DropdownSeparator);
const DropdownGroupComponent = createSubComponent('Dropdown.Group', DropdownGroup);

// 附加子组件
const Dropdown = attachSubComponents(DropdownImpl, {
  Trigger: DropdownTriggerComponent,
  Content: DropdownContentComponent,
  Item: DropdownItemComponent,
  Separator: DropdownSeparatorComponent,
  Group: DropdownGroupComponent,
});

// 创建Dropdown组件类型
export type DropdownComponent = ForwardRefComponent<HTMLDivElement, DropdownProps> & {
  Trigger: typeof DropdownTriggerComponent;
  Content: typeof DropdownContentComponent;
  Item: typeof DropdownItemComponent;
  Separator: typeof DropdownSeparatorComponent;
  Group: typeof DropdownGroupComponent;
};

// 导出
export default Dropdown as DropdownComponent;