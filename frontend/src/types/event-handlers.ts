/**
 * 统一事件处理器类型定义
 * 解决项目中事件处理器签名不一致问题
 */

import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  FormEvent,
  SyntheticEvent
} from 'react';

// ==================== 通用事件处理器模式 ====================

/**
 * 通用事件处理器类型 - 支持多种签名模式
 */
export interface UnifiedEventHandler<T = void, E = SyntheticEvent> {
  (data: T, event: E): void;
}

/**
 * 简化事件处理器类型 - 只接收必要参数
 */
export interface SimplifiedEventHandler<T = void> {
  (data?: T): void;
}

/**
 * 传统React事件处理器类型
 */
export interface LegacyEventHandler<E = SyntheticEvent> {
  (event: E): void;
}

/**
 * 通用联合类型 - 支持所有事件处理器签名
 */
export type FlexibleEventHandler<T = void, E = SyntheticEvent> =
  | UnifiedEventHandler<T, E>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<E>;

// ==================== 基础事件处理器类型 ====================

/**
 * 统一变更事件处理器类型 - 支持多种签名
 */
export type ChangeEventHandler<T = string> =
  | UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>;

/**
 * 统一点击事件处理器类型 - 支持多种签名
 */
export type ClickEventHandler<T = void> =
  | UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<MouseEvent<HTMLButtonElement | HTMLDivElement>>;

/**
 * 统一键盘事件处理器类型 - 支持多种签名
 */
export type KeyboardEventHandler<T = void> =
  | UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>>;

/**
 * 统一焦点事件处理器类型 - 支持多种签名
 */
export type FocusEventHandler<T = void> =
  | UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>;

/**
 * 统一表单提交事件处理器类型 - 支持多种签名
 */
export type FormSubmitHandler<T = void> =
  | UnifiedEventHandler<T, FormEvent<HTMLFormElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<FormEvent<HTMLFormElement>>;

/**
 * 统一自定义事件处理器类型 - 支持多种签名
 */
export type CustomEventHandler<T = void, E = SyntheticEvent> =
  | UnifiedEventHandler<T, E>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<E>;

// ==================== 适配器类型 ====================

/**
 * 传统 React 事件处理器类型 (兼容现有代码)
 */
export type LegacyChangeHandler = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;

/**
 * 简化值处理器类型
 */
export type ValueHandler<T = string> = (value: T) => void;

/**
 * 事件处理器联合类型 (支持多种签名)
 */
export type FlexibleChangeHandler<T = string> =
  | ChangeEventHandler<T>
  | LegacyChangeHandler
  | ValueHandler<T>;

// ==================== 适配器函数 ====================

/**
 * 将传统 React 事件处理器适配为统一格式
 */
export function adaptLegacyChangeHandler<T = string>(
  legacyHandler: LegacyChangeHandler
): ChangeEventHandler<T> {
  return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    legacyHandler(event);
  };
}

/**
 * 将值处理器适配为统一格式
 */
export function adaptValueChangeHandler<T = string>(
  valueHandler: ValueHandler<T>
): ChangeEventHandler<T> {
  return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    valueHandler(value);
  };
}

/**
 * 自动检测并适配事件处理器
 */
export function adaptChangeHandler<T = string>(
  handler: FlexibleChangeHandler<T>
): ChangeEventHandler<T> {
  // 检测处理器签名类型并适配
  if (handler.length === 1) {
    // 可能是 LegacyChangeHandler 或 ValueHandler
    try {
      // 尝试作为传统处理器调用
      return adaptLegacyChangeHandler(handler as LegacyChangeHandler);
    } catch {
      // 如果失败，作为值处理器处理
      return adaptValueChangeHandler(handler as ValueHandler<T>);
    }
  }

  // 已经是统一格式
  return handler as ChangeEventHandler<T>;
}

/**
 * 从事件中提取值的工具函数
 */
export function extractEventValue(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
): string {
  return event.target.value;
}

/**
 * 从复选框事件中提取值
 */
export function extractCheckboxValue(
  event: ChangeEvent<HTMLInputElement>
): boolean {
  return event.target.checked;
}

/**
 * 从数字输入框事件中提取值
 */
export function extractNumberValue(
  event: ChangeEvent<HTMLInputElement>
): number {
  const value = event.target.value;
  return value === '' ? 0 : Number(value);
}

// ==================== 组件 Props 类型 ====================

/**
 * 输入组件统一 Props
 */
export interface InputProps<T = string> {
  value?: T;
  onChange?: ChangeEventHandler<T>;
  onFocus?: FocusEventHandler<T>;
  onBlur?: FocusEventHandler<T>;
  onKeyDown?: KeyboardEventHandler<T>;
  // 支持传统处理器（向后兼容）
  legacyOnChange?: LegacyChangeHandler;
  // 支持值处理器（简化版）
  onValueChange?: ValueHandler<T>;
}

/**
 * 选择器组件统一 Props
 */
export interface SelectorProps<T = any> {
  value?: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange?: ChangeEventHandler<T>;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 按钮组件统一 Props
 */
export interface ButtonProps<T = void> {
  onClick?: ClickEventHandler<T>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

// ==================== 类型守卫 ====================

/**
 * 检查是否为统一格式的事件处理器
 */
export function isUnifiedChangeHandler<T = string>(
  handler: any
): handler is ChangeEventHandler<T> {
  return typeof handler === 'function' && handler.length === 2;
}

/**
 * 检查是否为传统 React 事件处理器
 */
export function isLegacyChangeHandler(
  handler: any
): handler is LegacyChangeHandler {
  return typeof handler === 'function' && handler.length === 1;
}

/**
 * 检查是否为值处理器
 */
export function isValueHandler<T = string>(
  handler: any
): handler is ValueHandler<T> {
  return typeof handler === 'function' && handler.length === 1;
}

// ==================== 工厂函数 ====================

/**
 * 创建统一格式的事件处理器
 */
export function createChangeHandler<T = string>(
  handler: (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
): ChangeEventHandler<T> {
  return handler;
}

/**
 * 创建带有数据验证的事件处理器
 */
export function createValidatedChangeHandler<T = string>(
  validator: (value: T) => boolean,
  handler: ChangeEventHandler<T>
): ChangeEventHandler<T> {
  return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (validator(value)) {
      handler(value, event);
    }
  };
}

/**
 * 创建带有防抖的事件处理器
 */
export function createDebouncedChangeHandler<T = string>(
  handler: ChangeEventHandler<T>,
  delay: number = 300
): ChangeEventHandler<T> {
  let timeoutId: NodeJS.Timeout;

  return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      handler(value, event);
    }, delay);
  };
}

// ==================== 常用预设处理器 ====================

/**
 * 字符串输入处理器（自动去除首尾空格）
 */
export const stringInputHandler = (handler: ChangeEventHandler<string>): ChangeEventHandler<string> => {
  return (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handler(value.trim(), event);
  };
};

/**
 * 数字输入处理器（自动验证数字格式）
 */
export const numberInputHandler = (handler: ChangeEventHandler<number>): ChangeEventHandler<string> => {
  return (value: string, event: ChangeEvent<HTMLInputElement>) => {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      handler(numValue, event);
    }
  };
};

/**
 * 邮箱输入处理器（自动验证邮箱格式）
 */
export const emailInputHandler = (handler: ChangeEventHandler<string>): ChangeEventHandler<string> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return (value: string, event: ChangeEvent<HTMLInputElement>) => {
    if (emailRegex.test(value)) {
      handler(value, event);
    }
  };
};