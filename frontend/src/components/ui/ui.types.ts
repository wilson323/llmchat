/**
 * 统一的UI组件核心类型定义 - v2.0.0
 *
 * 🎯 基于权威事件处理器类型的UI组件类型定义
 * 整合和统一所有UI组件的类型定义，解决类型冲突和重复问题
 *
 * @version 2.0.0
 * @since 2025-10-19
 */

import * as React from 'react';

// 🚨 重要：所有事件处理器类型现在从权威定义文件导入
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  CustomEventHandler,
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler,
  FlexibleEventHandler
} from '../../types/event-handlers';

// =============================================================================
// 主题相关类型定义
// =============================================================================

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** 主题上下文类型 */
export interface ThemeContextType {
  /** 当前主题 */
  theme: 'light' | 'dark';
  /** 用户偏好 */
  userPreference: ThemeMode;
  /** 是否为自动模式 */
  isAutoMode: boolean;
  /** 切换主题 */
  toggleTheme: () => void;
  /** 设置主题 */
  setTheme: (theme: ThemeMode) => void;
}

/** 主题提供者Props */
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}

// =============================================================================
// 基础组件类型定义
// =============================================================================

/** 基础组件Props接口 */
export interface BaseComponentProps {
  /** CSS类名 */
  className?: string;
  /** 子元素 */
  children?: React.ReactNode;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 测试ID */
  'data-testid'?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否可见 */
  visible?: boolean;
  /** 组件ID */
  id?: string;
  /** 圆角大小 - 统一radius属性 */
  radius?: string | number;
  /** 变体类型 */
  variant?: string;
  /** 尺寸大小 */
  size?: string;
}

/** 可访问性Props */
export interface AccessibilityProps {
  /** ARIA标签 */
  'aria-label'?: string;
  /** ARIA描述 */
  'aria-describedby'?: string;
  /** ARIA详细描述 */
  'aria-details'?: string;
  /** 元素角色 */
  role?: string;
  /** 制表符索引 */
  tabIndex?: number;
}

/** 事件处理Props - 使用React标准事件处理器类型 */
export interface EventHandlersProps<T = HTMLElement> {
  /** 点击事件 */
  onClick?: React.MouseEventHandler<T>;
  /** 焦点事件 */
  onFocus?: React.FocusEventHandler<T>;
  /** 失焦事件 */
  onBlur?: React.FocusEventHandler<T>;
  /** 键盘按下事件 */
  onKeyDown?: React.KeyboardEventHandler<T>;
  /** 键盘释放事件 */
  onKeyUp?: React.KeyboardEventHandler<T>;
  /** 变化事件 */
  onChange?: React.ChangeEventHandler<T>;
}

// =============================================================================
// 通用变体定义
// =============================================================================

/** 大小变体 */
export type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg';

/** 颜色变体 */
export type ColorVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'info'
  | 'brand'
  | 'ghost'
  | 'outline'
  | 'destructive'
  | 'link'
  | 'glass';

/** 形状变体 */
export type ShapeVariant = 'rounded' | 'square' | 'pill' | 'default';

// =============================================================================
// 子组件类型架构
// =============================================================================

/** 子组件基础Props */
export interface SubComponentProps extends BaseComponentProps {
  /** 子组件标识 */
  subComponent?: string;
}

/** 带子组件的组件类型定义 */
export type ComponentWithSubComponents<TMainProps, TSubComponents extends Record<string, React.FC<any>>> =
  React.FC<TMainProps & React.RefAttributes<HTMLElement>> &
  { [K in keyof TSubComponents]: TSubComponents[K] };

/** 子组件工厂函数类型 */
export interface SubComponentFactory<P = {}> {
  displayName: string;
  Component: React.FC<P>;
}

/** 创建子组件工厂函数 */
export function createSubComponent<P extends object>(
  displayName: string,
  component: React.FC<P>
): React.FC<P> & { displayName: string } {
  const Component = component as React.FC<P> & { displayName: string };
  Component.displayName = displayName;
  return Component;
}

/** 附加子组件工具函数 */
export function attachSubComponents<
  TMainProps,
  TSubComponents extends Record<string, React.FC<any>>
>(
  MainComponent: React.FC<TMainProps>,
  subComponents: TSubComponents
): ComponentWithSubComponents<TMainProps, TSubComponents> {
  const Component = MainComponent as ComponentWithSubComponents<TMainProps, TSubComponents>;

  // 附加子组件到主组件
  Object.entries(subComponents).forEach(([key, SubComponent]) => {
    (Component as any)[key] = SubComponent;
  });

  // 附加displayName
  Component.displayName = MainComponent.displayName || 'Component';

  return Component;
}

// =============================================================================
// 前向Ref类型定义
// =============================================================================

/** 前向ref组件类型 */
export type ForwardRefComponent<T, P> = React.ForwardRefExoticComponent<
  P & React.RefAttributes<T>
>;

// =============================================================================
// 通用组件Props接口
// =============================================================================

/** 通用组件Props */
export interface UIComponentProps extends
  BaseComponentProps,
  AccessibilityProps,
  EventHandlersProps {
  /** 组件标题 */
  title?: string;
  /** 组件描述 */
  description?: string;
  /** 自定义数据属性 */
  [key: `data-${string}`]: string | undefined;
}

// =============================================================================
// Button组件类型定义
// =============================================================================

/** Button组件基础Props */
export interface BaseButtonProps extends UIComponentProps {
  /** 按钮变体 */
  variant?: ColorVariant;
  /** 按钮大小 */
  size?: SizeVariant;
  /** 按钮形状/圆角 */
  shape?: ShapeVariant;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否为块级按钮 */
  block?: boolean;
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
  /** 加载文本 */
  loadingText?: string;
  /** 是否作为子组件渲染 */
  asChild?: boolean;
}

/** Button组件Props - 继承HTMLButtonElement属性但排除冲突项 */
export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'variant'> & BaseButtonProps;

/** IconButton组件Props */
export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'leftIcon' | 'rightIcon' | 'loadingText'> {
  /** 图标按钮变体 */
  variant?: ColorVariant | 'glass';
  /** 图标 */
  icon?: React.ReactNode;
}

// =============================================================================
// Input组件类型定义
// =============================================================================

/** Input组件基础Props */
export interface BaseInputProps extends UIComponentProps {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'file';
  /** 输入框大小 */
  size?: SizeVariant;
  /** 占位符文本 */
  placeholder?: string;
  /** 输入值 */
  value?: string | number;
  /** 默认值 */
  defaultValue?: string | number;
  /** 是否必填 */
  required?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大长度 */
  maxLength?: number;
  /** 最小长度 */
  minLength?: number;
  /** 是否允许清除 */
  allowClear?: boolean;
  /** 前缀图标 */
  prefixIcon?: React.ReactNode;
  /** 后缀图标 */
  suffixIcon?: React.ReactNode;
  /** 是否自动聚焦 */
  autoFocus?: boolean;
  /** 输入状态 */
  state?: 'default' | 'success' | 'warning' | 'error';
}

/** Input组件Props - 继承HTMLInputElement属性但排除冲突项 */
export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'state' | 'onChange'> & 
  Omit<BaseInputProps, 'onChange'> & {
    /** 变化事件处理器 - 支持简化签名和标准事件 */
    onChange?: ((value: string) => void) | React.ChangeEventHandler<HTMLInputElement>;
  };

// =============================================================================
// Card组件类型定义
// =============================================================================

/** Card组件基础Props */
export interface BaseCardProps extends UIComponentProps {
  /** 卡片变体 */
  variant?: 'default' | 'outlined' | 'elevated' | 'filled';
  /** 卡片大小 */
  size?: SizeVariant;
  /** 是否可点击 */
  clickable?: boolean;
  /** 悬停效果 */
  hoverable?: boolean;
  /** 卡片标题 */
  title?: string;
  /** 卡片副标题 */
  subtitle?: string;
  /** 卡片图片 */
  image?: string;
  /** 卡片描述 */
  description?: string;
}

/** Card组件Props */
export type CardProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & BaseCardProps;

/** Card Header组件Props */
export interface CardHeaderProps extends BaseComponentProps {
  /** 额外内容 */
  extra?: React.ReactNode;
}

/** Card Title组件Props */
export interface CardTitleProps extends BaseComponentProps {
  /** 标题级别 */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Card Content组件Props */
export interface CardContentProps extends BaseComponentProps {}

/** Card Footer组件Props */
export interface CardFooterProps extends BaseComponentProps {}

/** Card Description组件Props */
export interface CardDescriptionProps extends BaseComponentProps {}

/** Card组件类型（带子组件） */
export type CardComponent = ComponentWithSubComponents<CardProps, {
  Header: React.FC<CardHeaderProps>;
  Title: React.FC<CardTitleProps>;
  Content: React.FC<CardContentProps>;
  Footer: React.FC<CardFooterProps>;
  Description: React.FC<CardDescriptionProps>;
}>;

// =============================================================================
// Tabs组件类型定义
// =============================================================================

/** Tabs组件基础Props */
export interface BaseTabsProps extends UIComponentProps {
  /** 标签页变体 */
  variant?: 'default' | 'underline' | 'pills' | 'enclosed';
  /** 标签页方向 */
  orientation?: 'horizontal' | 'vertical';
  /** 默认激活标签 */
  defaultValue?: string;
  /** 当前激活标签 */
  value?: string;
  /** 标签变化回调 */
  onValueChange?: (value: string) => void;
  /** 是否激活动画 */
  activationMode?: 'automatic' | 'manual';
}

/** Tabs组件Props */
export type TabsProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'> & BaseTabsProps;

/** TabsList组件Props */
export interface TabsListProps extends UIComponentProps {
  /** 标签列表变体 */
  variant?: 'default' | 'underline' | 'pills' | 'enclosed';
  /** 标签列表方向 */
  orientation?: 'horizontal' | 'vertical';
  /** 是否可循环 */
  loop?: boolean;
}

/** TabsTrigger组件Props */
export interface TabsTriggerProps extends UIComponentProps {
  /** 标签触发器值 */
  value: string;
  /** 标签触发器变体 */
  variant?: 'default' | 'underline' | 'pills' | 'enclosed';
  /** 标签触发器方向 */
  orientation?: 'horizontal' | 'vertical';
  /** 是否禁用 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 前缀图标 */
  prefix?: React.ReactNode;
  /** 后缀图标 */
  suffix?: React.ReactNode;
  /** 徽标 */
  badge?: React.ReactNode;
}

/** TabsContent组件Props */
export interface TabsContentProps extends UIComponentProps {
  /** 标签内容值 */
  value: string;
  /** 是否强制渲染 */
  forceMount?: boolean;
  /** 是否作为子组件渲染 */
  asChild?: boolean;
}

// =============================================================================
// Modal组件类型定义
// =============================================================================

/** Modal组件基础Props */
export interface BaseModalProps extends UIComponentProps {
  /** 模态框变体 */
  variant?: 'default' | 'fullscreen' | 'drawer';
  /** 模态框大小 */
  size?: SizeVariant;
  /** 是否显示 */
  open?: boolean;
  /** 是否可关闭 */
  closable?: boolean;
  /** 是否显示遮罩 */
  showOverlay?: boolean;
  /** 确认回调 */
  onConfirm?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 按ESC键是否关闭 */
  closeOnEscape?: boolean;
  /** 模态框标题 */
  title?: string;
  /** 模态框描述 */
  description?: string;
}

/** Modal组件Props */
export type ModalProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'size'> & BaseModalProps;

// =============================================================================
// Select组件类型定义
// =============================================================================

/** Select组件基础Props */
export interface BaseSelectProps extends UIComponentProps {
  /** 选择框变体 */
  variant?: 'default' | 'outlined' | 'filled';
  /** 选择框大小 */
  size?: SizeVariant;
  /** 选择框值 */
  value?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否多选 */
  multiple?: boolean;
  /** 是否可搜索 */
  searchable?: boolean;
  /** 是否可清除 */
  clearable?: boolean;
  /** 加载状态 */
  loading?: boolean;
}

/** Select组件Props */
export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'variant' | 'onChange'> & 
  BaseSelectProps & {
    /** 值变化回调 */
    onValueChange?: (value: string) => void;
    /** 是否只读 */
    readonly?: boolean;
  };

/** Select Trigger组件Props */
export interface SelectTriggerProps extends BaseComponentProps {
  /** 只读 */
  readonly?: boolean;
}

/** Select Value组件Props */
export interface SelectValueProps extends BaseComponentProps {
  /** 占位符 */
  placeholder?: string;
}

/** Select Content组件Props */
export interface SelectContentProps extends BaseComponentProps {}

/** Select Item组件Props */
export interface SelectItemProps extends BaseComponentProps {
  /** 选项值 */
  value: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/** Select组件类型（带子组件） */
export type SelectComponent = ComponentWithSubComponents<SelectProps, {
  Trigger: React.FC<SelectTriggerProps>;
  Value: React.FC<SelectValueProps>;
  Content: React.FC<SelectContentProps>;
  Item: React.FC<SelectItemProps>;
}>;

// =============================================================================
// Toast组件类型定义
// =============================================================================

/** Toast类型 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast位置 */
export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

/** Toast项目基础Props */
export interface BaseToastItemProps {
  /** Toast ID */
  id: string;
  /** Toast 类型 */
  type: ToastType;
  /** Toast 标题 */
  title?: string;
  /** Toast 描述 */
  description?: string;
  /** Toast 位置 */
  position?: ToastPosition;
  /** Toast 持续时间（毫秒） */
  duration?: number;
  /** 是否可关闭 */
  closable?: boolean;
  /** 创建时间 */
  createdAt: Date;
}

/** Toast项目Props */
export interface ToastItemProps extends BaseToastItemProps {
  /** Toast 操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  };
  /** Toast 图标 */
  icon?: React.ReactNode;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 自定义渲染函数 */
  render?: (toast: ToastItem) => React.ReactNode;
  /** 是否正在悬停 */
  isPaused?: boolean;
}

/** Toast项接口（用于状态管理） */
export interface ToastItem extends Omit<ToastItemProps, 'createdAt'> {
  /** 创建时间（时间戳） */
  createdAt: number;
}

/** Toast状态接口 */
export interface ToastState {
  /** Toast列表 */
  toasts: ToastItem[];
  /** 添加Toast */
  add: (toast: ToastItem) => void;
  /** 移除Toast */
  remove: (id: string) => void;
  /** 暂停计时器 */
  pauseTimer: (id: string) => void;
  /** 恢复计时器 */
  resumeTimer: (id: string) => void;
  /** 清空所有 */
  clear: () => void;
  /** 设置位置 */
  setPosition: (position: string) => void;
  /** 获取指定位置的Toasts */
  getToastsByPosition: (position: string) => ToastItem[];
  /** 获取当前状态 */
  getState: () => ToastState;
}

/** Toast选项 */
export interface ToastOptions {
  /** Toast 类型 */
  type?: ToastType;
  /** Toast 标题 */
  title?: string;
  /** Toast 描述 */
  description?: string;
  /** Toast 位置 */
  position?: ToastPosition;
  /** Toast 持续时间（毫秒） */
  duration?: number;
  /** 是否可关闭 */
  closable?: boolean;
  /** Toast 操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  };
  /** Toast 图标 */
  icon?: React.ReactNode;
  /** 自定义渲染函数 */
  render?: (toast: ToastItem) => React.ReactNode;
  /** 是否在挂载时显示 */
  showWhenMounted?: boolean;
}

// =============================================================================
// 虚拟滚动组件类型定义
// =============================================================================

/** 虚拟滚动项目类型 */
export interface VirtualItem {
  /** 项目索引 */
  index: number;
  /** 项目键 */
  key: string;
  /** 项目数据 */
  data: any;
  /** 项目高度 */
  size?: number;
  /** 项目起始位置 */
  start?: number;
}

/** 虚拟滚动项目渲染参数 */
export interface VirtualScrollItem<T = unknown> {
  /** 项目数据 */
  item: T;
  /** 项目索引 */
  index: number;
  /** 项目样式 */
  style?: React.CSSProperties;
}

/** 虚拟滚动引用接口 */
export interface VirtualScrollRef {
  /** 滚动容器元素 */
  element: HTMLDivElement | null;
  /** 滚动到指定索引 */
  scrollToIndex: (index: number, alignment?: 'start' | 'center' | 'end') => void;
  /** 滚动到指定偏移 */
  scrollToOffset: (offset: number) => void;
  /** 获取当前滚动位置 */
  getScrollTop: () => number;
  /** 获取滚动容器高度 */
  getScrollHeight: () => number;
  /** 获取可视区域高度 */
  getClientHeight: () => number;
}

// VirtualScrollResult已移至 @/hooks/types.hooks.ts 避免重复定义

/** 虚拟滚动选项 */
export interface VirtualScrollOptions {
  /** 项目列表 */
  items: any[];
  /** 项目键提取函数 */
  itemKey: (item: any, index: number) => string;
  /** 项目高度 */
  itemHeight?: number | ((item: any, index: number) => number);
  /** 滚动容器高度 */
  height: number;
  /** 滚动条宽度 */
  scrollWidth?: number;
  /** 滚动回调 */
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  /** 到达底部回调 */
  onEndReached?: () => void;
  /** 触发到达底部的阈值 */
  endReachedThreshold?: number;
  /** 预渲染项目数量 */
  overscan?: number;
  /** 估算项目高度 */
  estimatedItemHeight?: number;
  /** 空状态组件 */
  emptyComponent?: React.ReactNode;
  /** 加载组件 */
  loadingComponent?: React.ReactNode;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否有更多数据 */
  hasMore?: boolean;
}

/** 虚拟滚动组件Props */
export interface VirtualScrollProps {
  /** 项目列表 */
  items: any[];
  /** 项目键提取函数 */
  itemKey: (item: any, index: number) => string;
  /** 项目高度 */
  itemHeight?: number | ((item: any, index: number) => number);
  /** 滚动容器高度 */
  height?: number;
  /** 渲染项目函数 */
  renderItem: (item: any, index: number, style?: React.CSSProperties) => React.ReactNode;
  /** 自定义样式 */
  className?: string;
  /** 行内样式 */
  style?: React.CSSProperties;
  /** 滚动回调 */
  onScroll?: (scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  /** 到达底部回调 */
  onEndReached?: () => void;
  /** 触发到达底部的阈值 */
  endReachedThreshold?: number;
  /** 预渲染项目数量 */
  overscan?: number;
  /** 估算项目高度 */
  estimatedItemHeight?: number;
  /** 空状态组件 */
  emptyComponent?: React.ReactNode | (() => React.ReactNode);
  /** 加载组件 */
  loadingComponent?: React.ReactNode | (() => React.ReactNode);
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否有更多数据 */
  hasMore?: boolean;
}

// EventEnhancer相关类型定义已删除（组件未使用，属于过度工程化）

// =============================================================================
// 组件组件工厂类型
// =============================================================================

/** 组件工厂选项 */
export interface ComponentFactoryOptions {
  /** 组件名称 */
  name: string;
  /** 组件描述 */
  description?: string;
  /** 组件版本 */
  version?: string;
  /** 组件作者 */
  author?: string;
  /** 组件标签 */
  tags?: string[];
  /** 组件分类 */
  category?: string;
}

/** 组件工厂结果 */
export interface ComponentFactoryResult {
  /** 创建的组件 */
  component: React.FC<any>;
  /** 组件配置 */
  config: ComponentFactoryOptions;
  /** 组件类型 */
  type: 'component' | 'composite' | 'layout';
  /** 创建时间 */
  createdAt: Date;
}

/** 组件工厂类型 */
export interface ComponentFactory {
  /** 创建组件 */
  create: (options: ComponentFactoryOptions) => ComponentFactoryResult;
  /** 注册组件 */
  register: (name: string, component: React.FC<any>) => void;
  /** 获取组件 */
  get: (name: string) => React.FC<any> | undefined;
  /** 列出所有组件 */
  list: () => string[];
}

// =============================================================================
// ConfirmDialog组件类型定义
// =============================================================================

/** ConfirmDialog组件Props */
export interface ConfirmDialogProps extends UIComponentProps {
  /** 是否显示对话框 */
  open?: boolean;
  /** 对话框标题 */
  title?: string;
  /** 对话框内容 */
  content?: string;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 确认按钮类型 */
  confirmVariant?: ColorVariant;
  /** 确认回调 */
  onConfirm?: () => void | Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 对话框变体 */
  variant?: 'default' | 'destructive';
  /** 是否显示遮罩 */
  showOverlay?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
}

// =============================================================================
// Dropdown组件类型定义
// =============================================================================

/** Dropdown组件基础Props */
export interface BaseDropdownProps extends UIComponentProps {
  /** 下拉框变体 */
  variant?: 'default' | 'outlined' | 'filled';
  /** 下拉框大小 */
  size?: SizeVariant;
  /** 是否显示 */
  open?: boolean;
  /** 触发器 */
  trigger?: React.ReactNode;
  /** 下拉框位置 */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  /** 点击外部是否关闭 */
  closeOnClickOutside?: boolean;
}

/** Dropdown组件Props */
export type DropdownProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'size'> & BaseDropdownProps;

// =============================================================================
// 重新导出权威事件处理器类型
// =============================================================================

// 重新导出权威事件处理器类型，方便UI组件使用
export type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  CustomEventHandler,
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler,
  FlexibleEventHandler
} from '../../types/event-handlers';

// =============================================================================
// 导出所有类型
// =============================================================================

export type {
  // React类型
  ComponentType,
  ReactNode,
  DetailedHTMLProps,
  InputHTMLAttributes,
  ButtonHTMLAttributes,
  ChangeEvent,
  MouseEvent,
  FocusEvent,
  KeyboardEvent,
  FormEvent,
} from 'react';

// ==================== UI组件类型迁移指南 v2.0.0 ====================

/**
 * 📚 UI组件类型 v2.0.0 迁移指南
 *
 * 本文件已经更新为基于权威事件处理器类型定义，确保类型安全和一致性。
 *
 * 🔄 主要变更：
 * 1. 所有事件处理器类型现在从 @/types/event-handlers 导入
 * 2. EventHandlersProps 现在使用权威类型定义
 * 3. 移除了重复的事件处理器类型定义
 * 4. 提供了统一的事件处理器接口
 *
 * 📝 使用示例：
 *
 * ```typescript
 * import type { ClickEventHandler, ChangeEventHandler } from '@/components/ui/ui.types';
 *
 * interface MyComponentProps {
 *   onClick?: ClickEventHandler<string>;
 *   onChange?: ChangeEventHandler<string>;
 * }
 * ```
 *
 * 🎯 推荐做法：
 * 1. 从本文件导入UI组件相关的事件处理器类型
 * 2. 使用权威类型定义确保类型安全
 * 3. 支持多种事件处理器签名格式
 *
 * ⚠️ 注意事项：
 * - 本文件现在重新导出权威类型定义
 * - 保持向后兼容性
 * - 类型安全性得到显著提升
 */