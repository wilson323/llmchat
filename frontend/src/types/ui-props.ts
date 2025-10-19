/**
 * 基础UI组件统一接口定义
 *
 * 提供所有UI组件的通用属性接口，确保类型安全和一致性
 * 基于shared-types包(v2.0.0)扩展，适配前端组件需求
 */

import * as React from 'react';
import type { SyntheticEvent } from 'react';

// =============================================================================
// 基础类型定义（补充缺失的类型）
// =============================================================================

/** React事件类型定义 */
export type ReactEvent = SyntheticEvent;

/** 通用事件处理器类型 */
export type EventHandler<T = any> = (event: T) => void;

/** 变更事件处理器类型 */
export type ChangeHandler<T = string> = (value: T, event?: ReactEvent) => void;

// =============================================================================
// 基础组件Props接口 (基于shared-types扩展)
// =============================================================================

/** 基础组件Props接口 - 继承shared-types并扩展前端特有属性 */
export interface BaseUIProps {
  /** CSS类名 */
  className?: string;
  /** 子组件 */
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

/** 按钮专用基础属性 */
export interface BaseButtonProps extends BaseUIProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger' | 'brand' | 'success' | 'warning' | 'info' | 'glass' | 'destructive';
  /** 按钮大小 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg';
  /** 按钮形状/圆角 */
  shape?: 'default' | 'rounded' | 'pill' | 'square' | 'circle';
  /** 圆角大小 - 兼容属性 */
  radius?: string | number;
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
  /** 点击处理函数 */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/** 输入框专用基础属性 */
export interface BaseInputProps extends BaseUIProps {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
  /** 输入框大小 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** 占位符文本 */
  placeholder?: string;
  /** 输入值 */
  value?: string;
  /** 默认值 */
  defaultValue?: string;
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
  prefix?: React.ReactNode;
  /** 后缀图标 */
  suffix?: React.ReactNode;
  /** 变更回调 - 标准化签名 */
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 焦点回调 */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 失焦回调 */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 按键回调 */
  onPressEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

/** 卡片专用基础属性 */
export interface BaseCardProps extends BaseUIProps {
  /** 卡片标题 */
  title?: string;
  /** 是否可悬停 */
  hoverable?: boolean;
  /** 是否可点击 */
  clickable?: boolean;
  /** 点击事件 */
  onClick?: () => void;
  /** 卡片变体 */
  variant?: 'default' | 'outlined' | 'elevated' | 'filled';
  /** 卡片阴影 */
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

// =============================================================================
// 子组件类型架构定义
// =============================================================================

/** 子组件基础Props */
export interface SubComponentProps extends BaseUIProps {
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

/** 创建子组件的通用函数 */
export function createSubComponent<P extends object>(
  displayName: string,
  component: React.FC<P>
): React.FC<P> & { displayName: string } {
  const Component = component as React.FC<P> & { displayName: string };
  Component.displayName = displayName;
  return Component;
}

/** 为组件附加子组件的通用函数 */
export function attachSubComponents<
  TMainProps extends object,
  TSubComponents extends Record<string, React.FC<any>>
>(
  MainComponent: React.FC<TMainProps>,
  subComponents: TSubComponents
): ComponentWithSubComponents<TMainProps, TSubComponents> {
  const Component = MainComponent as ComponentWithSubComponents<TMainProps, TSubComponents>;

  Object.entries(subComponents).forEach(([key, SubComponent]) => {
    Component[key] = SubComponent;
  });

  return Component;
}

// =============================================================================
// 特定组件子组件类型定义
// =============================================================================

/** Card子组件Props */
export interface CardHeaderProps extends SubComponentProps {
  /** 额外操作区域 */
  extra?: React.ReactNode;
}

export interface CardTitleProps extends SubComponentProps {
  /** 标题级别 */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface CardContentProps extends SubComponentProps {}

export interface CardFooterProps extends SubComponentProps {}

/** Card完整组件类型 */
export interface CardComponent extends React.FC<BaseCardProps> {
  Header: React.FC<CardHeaderProps>;
  Title: React.FC<CardTitleProps>;
  Content: React.FC<CardContentProps>;
  Footer: React.FC<CardFooterProps>;
}

/** Select子组件Props */
export interface SelectTriggerProps extends SubComponentProps {}

export interface SelectValueProps extends SubComponentProps {
  /** 占位符 */
  placeholder?: string;
}

export interface SelectContentProps extends SubComponentProps {}

export interface SelectItemProps extends SubComponentProps {
  /** 选项值 */
  value: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/** Select完整组件类型 */
export interface SelectComponent extends React.FC<BaseUIProps> {
  Trigger: React.FC<SelectTriggerProps>;
  Value: React.FC<SelectValueProps>;
  Content: React.FC<SelectContentProps>;
  Item: React.FC<SelectItemProps>;
}

/** Tabs子组件Props */
export interface TabsListProps extends SubComponentProps {}

export interface TabsTriggerProps extends SubComponentProps {
  /** 标签值 */
  value: string;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface TabsContentProps extends SubComponentProps {
  /** 标签值 */
  value: string;
}

/** Tabs完整组件类型 */
export interface TabsComponent extends React.FC<BaseUIProps> {
  List: React.FC<TabsListProps>;
  Trigger: React.FC<TabsTriggerProps>;
  Content: React.FC<TabsContentProps>;
}

// =============================================================================
// Toast组件类型定义
// =============================================================================

/** Toast类型 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast选项 */
export interface ToastOptions {
  /** Toast ID */
  id?: string;
  /** Toast类型 */
  type?: ToastType;
  /** 标题 */
  title?: string;
  /** 描述内容 */
  description?: string;
  /** 持续时间(ms) */
  duration?: number;
  /** 是否可关闭 */
  closable?: boolean;
  /** 操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** Toast状态管理 */
export interface ToastState {
  /** Toast列表 */
  toasts: Array<Required<Omit<ToastOptions, 'duration' | 'closable' | 'action'> & {
    duration: number;
    closable: boolean;
    action?: {
      label: string;
      onClick: () => void;
    };
  }>>;
  /** 添加Toast */
  add: (toast: ToastOptions) => void;
  /** 移除Toast */
  remove: (id: string) => void;
  /** 清空所有Toast */
  clear: () => void;
  /** 获取状态 */
  getState: () => ToastState;
}

/** Toast完整组件类型 */
export interface ToastComponent {
  /** Toast函数 */
  toast: (options: ToastOptions) => string;
  /** Toast状态 */
  toasts: ToastState;
  /** 成功Toast */
  success: (title: string, description?: string) => string;
  /** 错误Toast */
  error: (title: string, description?: string) => string;
  /** 警告Toast */
  warning: (title: string, description?: string) => string;
  /** 信息Toast */
  info: (title: string, description?: string) => string;
  /** Toaster组件 */
  Toaster: React.FC;
}

// =============================================================================
// 导出所有类型
// =============================================================================

export type {
  // 基础类型
  BaseUIProps,
  BaseButtonProps,
  BaseInputProps,
  BaseCardProps,

  // 子组件类型
  SubComponentProps,
  ComponentWithSubComponents,
  SubComponentFactory,

  // Card组件类型
  CardHeaderProps,
  CardTitleProps,
  CardContentProps,
  CardFooterProps,
  CardComponent,

  // Select组件类型
  SelectTriggerProps,
  SelectValueProps,
  SelectContentProps,
  SelectItemProps,
  SelectComponent,

  // Tabs组件类型
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  TabsComponent,

  // Toast组件类型
  ToastType,
  ToastOptions,
  ToastState,
  ToastComponent,
};

// 导出工具函数
export { createSubComponent, attachSubComponents };