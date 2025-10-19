import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type {
  TabsProps as ITabsProps,
  TabsListProps as ITabsListProps,
  TabsTriggerProps as ITabsTriggerProps,
  TabsContentProps as ITabsContentProps,
  ForwardRefComponent,
} from './ui.types';
import { createSubComponent, attachSubComponents } from './ui.types';

// Tabs变体配置
const tabsVariants = cva(
  'w-full',
  {
    variants: {
      variant: {
        default: '',
        underline: 'space-y-2',
        pills: 'space-y-2',
        enclosed: 'space-y-2',
      },
      orientation: {
        horizontal: 'flex-col',
        vertical: 'flex',
      },
    },
    defaultVariants: {
      variant: 'default',
      orientation: 'horizontal',
    },
  },
);

// TabsList变体配置
const tabsListVariants = cva(
  'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        underline: 'flex h-10 items-center justify-start space-x-8 border-b border-border',
        pills: 'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        enclosed: 'inline-flex h-9 items-center justify-center rounded-lg border bg-background p-1 text-muted-foreground',
      },
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      variant: 'default',
      orientation: 'horizontal',
    },
  },
);

// TabsTrigger变体配置
const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:bg-background hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
        underline: 'border-b-2 border-transparent hover:border-border/50 data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none',
        pills: 'hover:bg-background/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
        enclosed: 'hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground',
      },
      orientation: {
        horizontal: '',
        vertical: 'w-full justify-start',
      },
    },
    defaultVariants: {
      variant: 'default',
      orientation: 'horizontal',
    },
  },
);

// Tabs组件Props - 使用类型别名避免循环引用
export type TabsProps = ITabsProps & VariantProps<typeof tabsVariants> & {
  /** 标签变化回调 */
  onValueChange?: (value: string) => void;
  /** 是否激活动画 */
  activationMode?: 'automatic' | 'manual';
};

export type TabsListProps = ITabsListProps & VariantProps<typeof tabsListVariants> & {
  /** 是否可循环 */
  loop?: boolean;
};

export type TabsTriggerProps = ITabsTriggerProps & VariantProps<typeof tabsTriggerVariants> & {
  /** 加载状态 */
  loading?: boolean;
  /** 前缀图标 */
  prefix?: React.ReactNode;
  /** 后缀图标 */
  suffix?: React.ReactNode;
  /** 徽标 */
  badge?: React.ReactNode;
};

export interface TabsContentProps extends ITabsContentProps {
  /** 是否强制渲染 */
  forceMount?: boolean;
  /** 键盘导航支持 */
  asChild?: boolean;
}

// TabsContext
interface TabsContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
  variant: string;
  activationMode: 'automatic' | 'manual';
  loop: boolean;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

// useContext hook
const useTabsContext = () => {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs component');
  }
  return context;
};

// 键盘导航Hook
const useKeyboardNavigation = (
  elements: HTMLElement[],
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  orientation: 'horizontal' | 'vertical',
  loop: boolean
) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (elements.length === 0) return;

      let newIndex = activeIndex;
      const isHorizontal = orientation === 'horizontal';

      switch (event.key) {
        case isHorizontal ? 'ArrowLeft' : 'ArrowUp':
          event.preventDefault();
          newIndex = activeIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? elements.length - 1 : 0;
          }
          break;
        case isHorizontal ? 'ArrowRight' : 'ArrowDown':
          event.preventDefault();
          newIndex = activeIndex + 1;
          if (newIndex >= elements.length) {
            newIndex = loop ? 0 : elements.length - 1;
          }
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = elements.length - 1;
          break;
        default:
          return;
      }

      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
        elements[newIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [elements, activeIndex, orientation, loop, setActiveIndex]);
};

// Tabs.List组件
const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  (
    {
      className,
      variant,
      orientation,
      loop = true,
      children,
      ...props
    },
    ref
  ) => {
    const { activationMode } = useTabsContext();
    const triggerRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
    const [activeIndex, setActiveIndex] = React.useState(0);

    // 收集所有触发器
    const triggers = React.useMemo(() =>
      triggerRefs.current.filter(Boolean) as HTMLButtonElement[],
      [triggerRefs.current]
    );

    // 键盘导航
    useKeyboardNavigation(triggers, activeIndex, setActiveIndex, orientation || 'horizontal', loop);

    return (
      <div
        ref={ref}
        className={cn(tabsListVariants({ variant, orientation }), className)}
        role="tablist"
        aria-orientation={orientation}
        {...props}
      >
        {React.Children.map(children, (child, index) =>
          React.isValidElement(child)
            ? React.cloneElement(child as any, {
                ref: (el: HTMLButtonElement | null) => {
                  triggerRefs.current[index] = el;
                  const originalRef = (child as any).ref;
                  if (typeof originalRef === 'function') {
                    originalRef(el);
                  }
                },
                isActive: index === activeIndex,
                onSelect: () => setActiveIndex(index),
              })
            : child
        )}
      </div>
    );
  }
);
TabsList.displayName = 'Tabs.List';

// Tabs.Trigger组件
const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  (
    {
      className,
      variant,
      orientation,
      value,
      disabled = false,
      loading = false,
      prefix,
      suffix,
      badge,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { value: ctxValue, onValueChange, variant: ctxVariant } = useTabsContext();
    const finalVariant = variant || ctxVariant;
    const isActive = ctxValue === value;

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || loading) return;
        onValueChange?.(value);
        onClick?.(e);
      },
      [disabled, loading, value, onValueChange, onClick]
    );

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-disabled={disabled}
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(tabsTriggerVariants({ variant: finalVariant, orientation }), {
          'opacity-50 cursor-not-allowed': disabled,
        }, className)}
        disabled={disabled}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
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
        )}
        {prefix && <span className="mr-2">{prefix}</span>}
        <span className="truncate">{children}</span>
        {suffix && <span className="ml-2">{suffix}</span>}
        {badge && (
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium min-w-[1.25rem] h-5 px-1">
            {badge}
          </span>
        )}
      </button>
    );
  }
);
TabsTrigger.displayName = 'Tabs.Trigger';

// Tabs.Content组件
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  (
    {
      className,
      value,
      forceMount = false,
      children,
      ...props
    },
    ref
  ) => {
    const { value: ctxValue, activationMode } = useTabsContext();
    const isActive = ctxValue === value;

    if (!forceMount && !isActive) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        aria-labelledby={`trigger-${value}`}
        data-state={isActive ? 'active' : 'inactive'}
        data-value={value}
        className={cn(
          'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          !isActive && 'hidden',
          className
        )}
        tabIndex={activationMode === 'manual' && isActive ? 0 : -1}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'Tabs.Content';

// 主Tabs组件
const TabsImpl = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      children,
      defaultValue,
      value,
      onValueChange,
      variant = 'default',
      orientation = 'horizontal',
      activationMode = 'automatic',
      className,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '');

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

    // Context值
    const contextValue = React.useMemo(
      () => ({
        value: currentValue,
        onValueChange: handleValueChange,
        orientation,
        variant,
        activationMode,
        loop: true,
      }),
      [currentValue, handleValueChange, orientation, variant, activationMode]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(tabsVariants({ variant, orientation }), className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
TabsImpl.displayName = 'Tabs';

// 创建子组件
const TabsListComponent = createSubComponent('Tabs.List', TabsList);
const TabsTriggerComponent = createSubComponent('Tabs.Trigger', TabsTrigger);
const TabsContentComponent = createSubComponent('Tabs.Content', TabsContent);

// 附加子组件
const Tabs = attachSubComponents(TabsImpl, {
  List: TabsListComponent,
  Trigger: TabsTriggerComponent,
  Content: TabsContentComponent,
});

// 创建Tabs组件类型
export type TabsComponentType = ForwardRefComponent<HTMLDivElement, TabsProps> & {
  List: typeof TabsListComponent;
  Trigger: typeof TabsTriggerComponent;
  Content: typeof TabsContentComponent;
};

// 导出（所有类型已在定义处使用 export 关键字导出）
export default Tabs as TabsComponentType;
export { TabsList, TabsTrigger, TabsContent };