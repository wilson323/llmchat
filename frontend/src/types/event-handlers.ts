/**
 * 统一事件处理器类型定义 - 权威类型定义文件
 *
 * 🎯 核心原则：
 * 1. 本文件是所有事件处理器类型的唯一真实来源
 * 2. 所有其他文件必须从此文件导入事件处理器类型
 * 3. 禁止在别处重新定义相同的事件处理器类型
 * 4. 确保类型安全和向后兼容性
 *
 * @version 2.0.0
 * @since 2025-10-19
 */

import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  FormEvent,
  SyntheticEvent,
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  FormHTMLAttributes,
  HTMLAttributes
} from 'react';

// ==================== 核心事件处理器架构 ====================

/**
 * 🎯 统一事件处理器模式 - 支持多种签名
 *
 * 这是项目中最核心的事件处理器类型，所有其他事件处理器都基于此定义
 */
export interface UnifiedEventHandler<T = void, E = SyntheticEvent> {
  (data: T, event: E): void;
}

/**
 * 🎯 简化事件处理器类型 - 只接收数据参数
 *
 * 用于不需要访问事件对象的简单场景
 */
export interface SimplifiedEventHandler<T = void> {
  (data?: T): void;
}

/**
 * 🎯 传统React事件处理器类型 - 只接收事件对象
 *
 * 用于向后兼容现有React代码
 */
export interface LegacyEventHandler<E = SyntheticEvent> {
  (event: E): void;
}

/**
 * 🎯 通用联合类型 - 支持所有事件处理器签名
 *
 * 这是组件Props中使用的类型，允许开发者选择最适合的签名
 */
export type FlexibleEventHandler<T = void, E = SyntheticEvent> =
  | UnifiedEventHandler<T, E>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<E>;

// ==================== 事件处理器类型守卫 ====================

/**
 * 🛡️ 检查是否为统一格式的事件处理器
 */
export function isUnifiedEventHandler<T = any, E = SyntheticEvent>(
  handler: any
): handler is UnifiedEventHandler<T, E> {
  return typeof handler === 'function' && handler.length === 2;
}

/**
 * 🛡️ 检查是否为传统React事件处理器
 */
export function isLegacyEventHandler<E = SyntheticEvent>(
  handler: any
): handler is LegacyEventHandler<E> {
  return typeof handler === 'function' && handler.length === 1;
}

/**
 * 🛡️ 检查是否为简化事件处理器
 */
export function isSimplifiedEventHandler<T = any>(
  handler: any
): handler is SimplifiedEventHandler<T> {
  return typeof handler === 'function' && handler.length <= 1;
}

// ==================== 标准化事件处理器类型 ====================

/**
 * 🎯 统一变更事件处理器类型 - 支持多种签名
 *
 * 用于处理输入框、选择器、文本域等元素的值变更事件
 */
export type ChangeEventHandler<T = string> =
  | UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>;

/**
 * 🎯 统一点击事件处理器类型 - 支持多种签名
 *
 * 用于处理按钮、链接、可点击区域等元素的点击事件
 */
export type ClickEventHandler<T = void> =
  | UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<MouseEvent<HTMLButtonElement | HTMLDivElement>>;

/**
 * 🎯 统一键盘事件处理器类型 - 支持多种签名
 *
 * 用于处理键盘按键事件，如回车、ESC、方向键等
 */
export type KeyboardEventHandler<T = void> =
  | UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>>;

/**
 * 🎯 统一焦点事件处理器类型 - 支持多种签名
 *
 * 用于处理元素获得或失去焦点的事件
 */
export type FocusEventHandler<T = void> =
  | UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>;

/**
 * 🎯 统一表单提交事件处理器类型 - 支持多种签名
 *
 * 用于处理表单提交事件
 */
export type FormSubmitHandler<T = void> =
  | UnifiedEventHandler<T, FormEvent<HTMLFormElement>>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<FormEvent<HTMLFormElement>>;

/**
 * 🎯 统一自定义事件处理器类型 - 支持多种签名
 *
 * 用于处理自定义事件或特殊场景的事件处理
 */
export type CustomEventHandler<T = void, E = SyntheticEvent> =
  | UnifiedEventHandler<T, E>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<E>;

// ==================== 统一组件Props类型 ====================

/**
 * 🎯 统一输入组件Props
 *
 * 为所有输入类组件提供标准化的事件处理器接口
 */
export interface StandardInputProps<T = string> {
  /** 当前值 */
  value?: T;
  /** 变更事件 - 支持多种签名 */
  onChange?: ChangeEventHandler<T>;
  /** 焦点事件 - 支持多种签名 */
  onFocus?: FocusEventHandler<T>;
  /** 失焦事件 - 支持多种签名 */
  onBlur?: FocusEventHandler<T>;
  /** 键盘事件 - 支持多种签名 */
  onKeyDown?: KeyboardEventHandler<T>;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否必填 */
  required?: boolean;
}

/**
 * 🎯 统一按钮组件Props
 *
 * 为所有按钮类组件提供标准化的事件处理器接口
 */
export interface StandardButtonProps<T = void> {
  /** 点击事件 - 支持多种签名 */
  onClick?: ClickEventHandler<T>;
  /** 焦点事件 - 支持多种签名 */
  onFocus?: FocusEventHandler<T>;
  /** 失焦事件 - 支持多种签名 */
  onBlur?: FocusEventHandler<T>;
  /** 键盘事件 - 支持多种签名 */
  onKeyDown?: KeyboardEventHandler<T>;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** 子元素 */
  children?: ReactNode;
}

/**
 * 🎯 统一表单组件Props
 *
 * 为所有表单类组件提供标准化的事件处理器接口
 */
export interface StandardFormProps<T = Record<string, any>> {
  /** 表单数据 */
  data?: T;
  /** 提交事件 - 支持多种签名 */
  onSubmit?: FormSubmitHandler<T>;
  /** 变更事件 - 支持多种签名 */
  onChange?: ChangeEventHandler<T>;
  /** 重置事件 - 支持多种签名 */
  onReset?: SimplifiedEventHandler<void>;
  /** 是否禁用 */
  disabled?: boolean;
  /** 子元素 */
  children?: ReactNode;
}

// ==================== 事件处理器适配器函数 ====================

/**
 * 🔄 自动适配事件处理器 - 统一为UnifiedEventHandler格式
 *
 * 智能检测处理器签名并适配为统一格式，确保组件内部处理的一致性
 */
export function adaptEventHandler<T = void, E = SyntheticEvent>(
  handler?: FlexibleEventHandler<T, E>
): UnifiedEventHandler<T, E> | undefined {
  if (!handler) return undefined;

  return (data: T, event: E) => {
    // 自动检测处理器签名并调用
    if (handler.length === 0) {
      // 无参数处理器 - 直接调用
      (handler as () => void)();
    } else if (handler.length === 1) {
      // 单参数处理器 - 判断是data还是event
      if (isSimplifiedEventHandler(handler)) {
        (handler as SimplifiedEventHandler<T>)(data);
      } else {
        (handler as unknown as LegacyEventHandler<E>)(event);
      }
    } else {
      // 标准双参数处理器
      (handler as UnifiedEventHandler<T, E>)(data, event);
    }
  };
}

/**
 * 🔄 适配变更事件处理器
 */
export function adaptChangeHandler<T = string>(
  handler?: ChangeEventHandler<T>
): UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
  return adaptEventHandler(handler);
}

/**
 * 🔄 适配点击事件处理器
 */
export function adaptClickHandler<T = void>(
  handler?: ClickEventHandler<T>
): UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>> | undefined {
  return adaptEventHandler(handler);
}

/**
 * 🔄 适配键盘事件处理器
 */
export function adaptKeyboardHandler<T = void>(
  handler?: KeyboardEventHandler<T>
): UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>> | undefined {
  return adaptEventHandler(handler);
}

/**
 * 🔄 适配焦点事件处理器
 */
export function adaptFocusHandler<T = void>(
  handler?: FocusEventHandler<T>
): UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
  return adaptEventHandler(handler);
}

/**
 * 🔄 适配表单提交处理器
 */
export function adaptFormHandler<T = void>(
  handler?: FormSubmitHandler<T>
): UnifiedEventHandler<T, FormEvent<HTMLFormElement>> | undefined {
  return adaptEventHandler(handler);
}

// ==================== 事件值提取工具 ====================

/**
 * 🛠️ 从事件中提取值的工具函数
 *
 * 提供统一的值提取接口，支持各种HTML输入元素
 */
export const EventValueExtractor = {
  /**
   * 从文本输入框事件中提取字符串值
   */
  fromInput: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): string => {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  },

  /**
   * 从选择框事件中提取值
   */
  fromSelect: (event: ChangeEvent<HTMLSelectElement>): string => {
    return event.target.value;
  },

  /**
   * 从复选框事件中提取布尔值
   */
  fromCheckbox: (event: ChangeEvent<HTMLInputElement>): boolean => {
    return (event.target as HTMLInputElement).checked;
  },

  /**
   * 从单选框事件中提取值
   */
  fromRadio: (event: ChangeEvent<HTMLInputElement>): string => {
    return (event.target as HTMLInputElement).value;
  },

  /**
   * 从数字输入框中提取数字值
   */
  fromNumber: (event: ChangeEvent<HTMLInputElement>): number => {
    const value = (event.target as HTMLInputElement).value;
    return value === '' ? 0 : Number(value);
  },

  /**
   * 从日期输入框中提取日期值
   */
  fromDate: (event: ChangeEvent<HTMLInputElement>): Date | null => {
    const value = (event.target as HTMLInputElement).value;
    return value ? new Date(value) : null;
  },

  /**
   * 从范围滑块中提取数值
   */
  fromRange: (event: ChangeEvent<HTMLInputElement>): number => {
    return Number(event.target.value);
  }
} as const;

/**
 * 🛠️ 通用事件值提取函数
 *
 * @deprecated 建议使用 EventValueExtractor 中的具体方法
 */
export function extractEventValue(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
): string {
  return EventValueExtractor.fromInput(event);
}

/**
 * 🛠️ 从复选框事件中提取值
 *
 * @deprecated 建议使用 EventValueExtractor.fromCheckbox
 */
export function extractCheckboxValue(
  event: ChangeEvent<HTMLInputElement>
): boolean {
  return EventValueExtractor.fromCheckbox(event);
}

/**
 * 🛠️ 从数字输入框事件中提取值
 *
 * @deprecated 建议使用 EventValueExtractor.fromNumber
 */
export function extractNumberValue(
  event: ChangeEvent<HTMLInputElement>
): number {
  return EventValueExtractor.fromNumber(event);
}

// ==================== 高级事件处理器工厂 ====================

/**
 * 🏭 创建带有验证的变更事件处理器
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
 * 🏭 创建带有防抖的变更事件处理器
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

/**
 * 🏭 创建带有节流的变更事件处理器
 */
export function createThrottledChangeHandler<T = string>(
  handler: ChangeEventHandler<T>,
  delay: number = 300
): ChangeEventHandler<T> {
  let lastCall = 0;

  return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      handler(value, event);
    }
  };
}

// ==================== 预设事件处理器 ====================

/**
 * 📝 字符串输入处理器（自动去除首尾空格）
 */
export const stringInputHandler = (handler: ChangeEventHandler<string>): ChangeEventHandler<string> => {
  return (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    handler(value.trim(), event);
  };
};

/**
 * 🔢 数字输入处理器（自动验证数字格式）
 */
export const numberInputHandler = (handler: ChangeEventHandler<number>): ChangeEventHandler<string> => {
  return (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      handler(numValue, event);
    }
  };
};

/**
 * 📧 邮箱输入处理器（自动验证邮箱格式）
 */
export const emailInputHandler = (handler: ChangeEventHandler<string>): ChangeEventHandler<string> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (emailRegex.test(value)) {
      handler(value, event);
    }
  };
};

// ==================== 导出总结 ====================

/**
 * 📦 统一事件处理器类型系统导出
 *
 * 本文件提供了完整的事件处理器类型定义和工具函数：
 *
 * 核心类型：
 * - UnifiedEventHandler<T, E> - 统一事件处理器 (data, event) => void
 * - SimplifiedEventHandler<T> - 简化事件处理器 (data?) => void
 * - LegacyEventHandler<E> - 传统事件处理器 (event) => void
 * - FlexibleEventHandler<T, E> - 联合类型，支持所有签名
 *
 * 标准事件处理器：
 * - ChangeEventHandler<T> - 变更事件处理器
 * - ClickEventHandler<T> - 点击事件处理器
 * - KeyboardEventHandler<T> - 键盘事件处理器
 * - FocusEventHandler<T> - 焦点事件处理器
 * - FormSubmitHandler<T> - 表单提交处理器
 *
 * 工具函数：
 * - adaptEventHandler() - 智能适配器
 * - EventValueExtractor - 值提取工具
 * - createValidatedChangeHandler() - 验证处理器
 * - createDebouncedChangeHandler() - 防抖处理器
 *
 * 使用指南：
 * 1. 所有组件应从此文件导入事件处理器类型
 * 2. 使用FlexibleEventHandler允许开发者选择最适合的签名
 * 3. 使用adaptEventHandler统一处理器格式
 * 4. 使用EventValueExtractor安全提取事件值
 */