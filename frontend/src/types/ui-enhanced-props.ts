/**
 * 增强的UI组件Props类型定义
 * 支持灵活的事件处理器签名，解决类型不匹配问题
 */

import * as React from 'react';
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler
} from './event-handlers';

// ==================== 基础增强Props ====================

/**
 * 增强的事件处理Props - 支持多种事件处理器签名
 */
export interface EnhancedEventHandlersProps<T = HTMLElement> {
  /** 点击事件 - 支持多种签名 */
  onClick?: ClickEventHandler<void>;
  /** 焦点事件 - 支持多种签名 */
  onFocus?: FocusEventHandler<void>;
  /** 失焦事件 - 支持多种签名 */
  onBlur?: FocusEventHandler<void>;
  /** 键盘按下事件 - 支持多种签名 */
  onKeyDown?: KeyboardEventHandler<void>;
  /** 键盘释放事件 - 支持多种签名 */
  onKeyUp?: KeyboardEventHandler<void>;
}

// ==================== 按钮组件增强Props ====================

/**
 * 增强的ButtonProps - 支持灵活的onClick签名
 */
export interface EnhancedButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'> {
  /** 点击事件 - 支持多种签名 */
  onClick?: ClickEventHandler<void>;
  /** 其他事件处理器 */
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

// ==================== 输入组件增强Props ====================

/**
 * 增强的InputProps - 支持灵活的onChange签名
 */
export interface EnhancedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'> {
  /** 变更事件 - 支持多种签名 */
  onChange?: ChangeEventHandler<string>;
  /** 焦点事件 - 支持多种签名 */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 失焦事件 - 支持多种签名 */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 键盘事件 - 支持多种签名 */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

// ==================== 表单组件增强Props ====================

/**
 * 增强的FormProps - 支持灵活的onSubmit签名
 */
export interface EnhancedFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** 提交事件 - 支持多种签名 */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}

// ==================== 选择器组件增强Props ====================

/**
 * 增强的SelectProps - 支持灵活的onChange签名
 */
export interface EnhancedSelectProps {
  /** 当前值 */
  value?: string;
  /** 变更事件 - 支持多种签名 */
  onChange?: ChangeEventHandler<string>;
  /** 焦点事件 - 支持多种签名 */
  onFocus?: FocusEventHandler<string>;
  /** 失焦事件 - 支持多种签名 */
  onBlur?: FocusEventHandler<string>;
  /** 键盘事件 - 支持多种签名 */
  onKeyDown?: KeyboardEventHandler<string>;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

// ==================== 适配器类型 ====================

/**
 * 将React标准事件处理器转换为增强处理器
 */
export type ReactToEnhancedEventAdapter<T extends React.HTMLAttributes<any>> = {
  [K in keyof T]: T[K] extends (event: infer E) => void
    ? K extends `on${string}`
      ? (event: E) => void | ((data?: any, event: E) => void)
      : T[K]
    : T[K];
};

/**
 * 将增强事件处理器转换为React标准处理器
 */
export type EnhancedToReactEventAdapter<T> = {
  [K in keyof T]: T[K] extends (data: infer D, event: infer E) => void
    ? K extends `on${string}`
      ? (event: E) => void
      : T[K]
    : T[K] extends (data?: infer D) => void
      ? () => void
      : T[K] extends (event: infer E) => void
        ? (event: E) => void
        : T[K];
};

// ==================== 类型守卫 ====================

/**
 * 检查是否为增强的点击事件处理器
 */
export function isEnhancedClickHandler(
  handler: any
): handler is ClickEventHandler<void> {
  return typeof handler === 'function';
}

/**
 * 检查是否为增强的变更事件处理器
 */
export function isEnhancedChangeHandler(
  handler: any
): handler is ChangeEventHandler<string> {
  return typeof handler === 'function';
}

/**
 * 检查是否为增强的键盘事件处理器
 */
export function isEnhancedKeyboardHandler(
  handler: any
): handler is KeyboardEventHandler<void> {
  return typeof handler === 'function';
}

// ==================== 工具类型 ====================

/**
 * 提取组件的事件处理器Props
 */
export type EventProps<T> = {
  [K in keyof T as K extends `on${string}` ? K : never]: T[K];
};

/**
 * 提取组件的非事件处理器Props
 */
export type NonEventProps<T> = {
  [K in keyof T as K extends `on${string}` ? never : K]: T[K];
};

/**
 * 将标准React组件Props转换为增强Props
 */
export type ToEnhancedProps<T> = NonEventProps<T> & EnhancedEventHandlersProps;

/**
 * 将增强Props转换为标准React组件Props
 */
export type ToReactProps<T> = Omit<T, 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp' | 'onChange' | 'onSubmit'> &
  React.HTMLAttributes<HTMLElement>;

// ==================== 预设组件类型 ====================

/**
 * 预设的通用Button类型
 */
export type UniversalButtonProps = EnhancedButtonProps & {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'brand' | 'success' | 'warning' | 'info' | 'glass';
  /** 按钮大小 */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg';
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
  /** 是否为块级按钮 */
  block?: boolean;
  /** CSS类名 */
  className?: string;
  /** 子元素 */
  children?: React.ReactNode;
};

/**
 * 预设的通用Input类型
 */
export type UniversalInputProps = EnhancedInputProps & {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local' | 'file';
  /** 输入框大小 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 输入框状态 */
  state?: 'default' | 'success' | 'warning' | 'error';
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
  /** CSS类名 */
  className?: string;
  /** 值 */
  value?: string;
  /** 默认值 */
  defaultValue?: string;
};