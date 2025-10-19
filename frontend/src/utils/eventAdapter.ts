/**
 * 事件处理适配器实现
 * 提供向后兼容的事件处理器适配方案
 */

import type {
  ChangeEventHandler,
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler,
  KeyboardEventHandler,
  ClickEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  CustomEventHandler
} from '../components/ui/ui.types';
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  FormEvent,
  SyntheticEvent
} from 'react';

// ==================== 核心适配器类 ====================

/**
 * 事件处理器适配器类
 * 负责将各种格式的事件处理器统一为标准格式
 */
export class EventAdapter {
  /**
   * 适配变更事件处理器 - 支持多种签名自动检测
   */
  static adaptChangeHandler<T = string>(
    handler?: ChangeEventHandler<T>
  ): UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
    if (!handler) return undefined;

    // 检测处理器类型并适配
    return this.createUnifiedChangeHandler(handler);
  }

  /**
   * 适配点击事件处理器 - 支持多种签名自动检测
   */
  static adaptClickHandler<T = void>(
    handler?: ClickEventHandler<T>
  ): UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>> | undefined {
    if (!handler) return undefined;

    return this.createUnifiedClickHandler(handler);
  }

  /**
   * 适配键盘事件处理器 - 支持多种签名自动检测
   */
  static adaptKeyboardHandler<T = void>(
    handler?: KeyboardEventHandler<T>
  ): UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>> | undefined {
    if (!handler) return undefined;

    return this.createUnifiedKeyboardHandler(handler);
  }

  /**
   * 适配焦点事件处理器 - 支持多种签名自动检测
   */
  static adaptFocusHandler<T = void>(
    handler?: FocusEventHandler<T>
  ): UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
    if (!handler) return undefined;

    return this.createUnifiedFocusHandler(handler);
  }

  /**
   * 适配表单提交处理器 - 支持多种签名自动检测
   */
  static adaptFormHandler<T = void>(
    handler?: FormSubmitHandler<T>
  ): UnifiedEventHandler<T, FormEvent<HTMLFormElement>> | undefined {
    if (!handler) return undefined;

    return this.createUnifiedFormHandler(handler);
  }

  // ==================== 私有方法 - 智能适配器 ====================

  /**
   * 创建统一的变更事件处理器
   */
  private static createUnifiedChangeHandler<T>(
    handler: ChangeEventHandler<T>
  ): UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> {
    return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      // 自动检测处理器签名并调用
      if (handler.length === 0) {
        // 无参数处理器 - 直接调用
        (handler as () => void)();
      } else if (handler.length === 1) {
        // 单参数处理器 - 判断是value还是event
        if (this.isValueBasedHandler(handler)) {
          (handler as SimplifiedEventHandler<T>)(value);
        } else {
          (handler as LegacyEventHandler<ChangeEvent>)(event);
        }
      } else {
        // 标准双参数处理器
        (handler as UnifiedEventHandler<T, ChangeEvent>)(value, event);
      }
    };
  }

  /**
   * 创建统一的点击事件处理器
   */
  private static createUnifiedClickHandler<T>(
    handler: ClickEventHandler<T>
  ): UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>> {
    return (data: T, event: MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      // 自动检测处理器签名并调用
      if (handler.length === 0) {
        (handler as () => void)();
      } else if (handler.length === 1) {
        if (this.isValueBasedHandler(handler)) {
          (handler as SimplifiedEventHandler<T>)(data);
        } else {
          (handler as LegacyEventHandler<MouseEvent>)(event);
        }
      } else {
        (handler as UnifiedEventHandler<T, MouseEvent>)(data, event);
      }
    };
  }

  /**
   * 创建统一的键盘事件处理器
   */
  private static createUnifiedKeyboardHandler<T>(
    handler: KeyboardEventHandler<T>
  ): UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>> {
    return (data: T, event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>) => {
      if (handler.length === 0) {
        (handler as () => void)();
      } else if (handler.length === 1) {
        if (this.isValueBasedHandler(handler)) {
          (handler as SimplifiedEventHandler<T>)(data);
        } else {
          (handler as LegacyEventHandler<KeyboardEvent>)(event);
        }
      } else {
        (handler as UnifiedEventHandler<T, KeyboardEvent>)(data, event);
      }
    };
  }

  /**
   * 创建统一的焦点事件处理器
   */
  private static createUnifiedFocusHandler<T>(
    handler: FocusEventHandler<T>
  ): UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> {
    return (data: T, event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (handler.length === 0) {
        (handler as () => void)();
      } else if (handler.length === 1) {
        if (this.isValueBasedHandler(handler)) {
          (handler as SimplifiedEventHandler<T>)(data);
        } else {
          (handler as LegacyEventHandler<FocusEvent>)(event);
        }
      } else {
        (handler as UnifiedEventHandler<T, FocusEvent>)(data, event);
      }
    };
  }

  /**
   * 创建统一的表单提交处理器
   */
  private static createUnifiedFormHandler<T>(
    handler: FormSubmitHandler<T>
  ): UnifiedEventHandler<T, FormEvent<HTMLFormElement>> {
    return (data: T, event: FormEvent<HTMLFormElement>) => {
      if (handler.length === 0) {
        (handler as () => void)();
      } else if (handler.length === 1) {
        if (this.isValueBasedHandler(handler)) {
          (handler as SimplifiedEventHandler<T>)(data);
        } else {
          (handler as LegacyEventHandler<FormEvent>)(event);
        }
      } else {
        (handler as UnifiedEventHandler<T, FormEvent>)(data, event);
      }
    };
  }

  /**
   * 判断是否为基于值的处理器
   */
  private static isValueBasedHandler(handler: Function): boolean {
    const funcStr = handler.toString();

    // 检查函数参数名
    const hasEventParams = funcStr.includes('event') || funcStr.includes('e)') || funcStr.includes('e:');
    const hasValueParams = funcStr.includes('value') || funcStr.includes('data') || funcStr.includes('val');

    // 如果没有明确的事件参数标识，倾向于认为是基于值的处理器
    return !hasEventParams || hasValueParams;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建统一的变更事件处理器 - 支持多种签名
 */
export function createChangeHandler<T = string>(
  onChange?: ChangeEventHandler<T>
): UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
  return EventAdapter.adaptChangeHandler(onChange);
}

/**
 * 创建统一的键盘事件处理器 - 支持多种签名
 */
export function createKeyboardHandler<T = void>(
  onKeyDown?: KeyboardEventHandler<T>
): UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>> | undefined {
  return EventAdapter.adaptKeyboardHandler(onKeyDown);
}

/**
 * 创建统一的点击事件处理器 - 支持多种签名
 */
export function createClickHandler<T = void>(
  onClick?: ClickEventHandler<T>
): UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>> | undefined {
  return EventAdapter.adaptClickHandler(onClick);
}

/**
 * 创建统一的焦点事件处理器 - 支持多种签名
 */
export function createFocusHandler<T = void>(
  onFocus?: FocusEventHandler<T>
): UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
  return EventAdapter.adaptFocusHandler(onFocus);
}

/**
 * 创建统一的表单提交处理器 - 支持多种签名
 */
export function createFormHandler<T = void>(
  onSubmit?: FormSubmitHandler<T>
): UnifiedEventHandler<T, FormEvent<HTMLFormElement>> | undefined {
  return EventAdapter.adaptFormHandler(onSubmit);
}

/**
 * 创建通用的统一事件处理器 - 支持任何事件类型
 */
export function createUnifiedEventHandler<T = void, E = SyntheticEvent>(
  handler?: CustomEventHandler<T, E>
): UnifiedEventHandler<T, E> | undefined {
  if (!handler) return undefined;

  return (data: T, event: E) => {
    // 自动检测处理器签名并调用
    if (handler.length === 0) {
      (handler as () => void)();
    } else if (handler.length === 1) {
      if (EventAdapter['isValueBasedHandler'](handler)) {
        (handler as SimplifiedEventHandler<T>)(data);
      } else {
        (handler as LegacyEventHandler<E>)(event);
      }
    } else {
      (handler as UnifiedEventHandler<T, E>)(data, event);
    }
  };
}

// ==================== React Hook 适配器 ====================

/**
 * 为 React 组件创建适配的事件处理器 Hook
 */
export function useAdaptedHandlers<T = string>(handlers: {
  onChange?: FlexibleChangeHandler<T>;
  onKeyDown?: (event: KeyboardEvent) => void | ((data: T, event: KeyboardEvent) => void);
  onFocus?: (event: FocusEvent) => void | ((value: T, event: FocusEvent) => void);
  onBlur?: (event: FocusEvent) => void | ((value: T, event: FocusEvent) => void);
  onClick?: (event: MouseEvent) => void | ((data: T, event: MouseEvent) => void);
  onSubmit?: (event: FormEvent) => void | ((data: T, event: FormEvent) => void);
}) {
  return {
    onChange: createChangeHandler(handlers.onChange),
    onKeyDown: createKeyboardHandler(handlers.onKeyDown),
    onFocus: createFocusHandler(handlers.onFocus),
    onBlur: createFocusHandler(handlers.onBlur),
    onClick: createClickHandler(handlers.onClick),
    onSubmit: createFormHandler(handlers.onSubmit)
  };
}

// ==================== 值提取器 ====================

/**
 * 值提取器集合
 */
export const ValueExtractors = {
  /**
   * 从输入事件中提取字符串值
   */
  fromInput: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string => {
    return event.target.value;
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
    return event.target.checked;
  },

  /**
   * 从单选框事件中提取值
   */
  fromRadio: (event: ChangeEvent<HTMLInputElement>): string => {
    return event.target.value;
  },

  /**
   * 从数字输入框中提取数字值
   */
  fromNumberInput: (event: ChangeEvent<HTMLInputElement>): number => {
    const value = event.target.value;
    return value === '' ? 0 : Number(value);
  },

  /**
   * 从日期输入框中提取日期值
   */
  fromDateInput: (event: ChangeEvent<HTMLInputElement>): Date | null => {
    const value = event.target.value;
    return value ? new Date(value) : null;
  }
};

// ==================== 便捷处理器工厂 ====================

/**
 * 创建字符串输入处理器
 */
export function createStringInputHandler(
  handler: (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  options: {
    trim?: boolean;
    maxLength?: number;
    transform?: (value: string) => string;
  } = {}
): ChangeEventHandler<string> {
  const { trim = false, maxLength, transform } = options;

  return (value: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let processedValue = value;

    if (trim) {
      processedValue = processedValue.trim();
    }

    if (maxLength && processedValue.length > maxLength) {
      processedValue = processedValue.slice(0, maxLength);
    }

    if (transform) {
      processedValue = transform(processedValue);
    }

    handler(processedValue, event);
  };
}

/**
 * 创建数字输入处理器
 */
export function createNumberInputHandler(
  handler: (value: number, event: ChangeEvent<HTMLInputElement>) => void,
  options: {
    min?: number;
    max?: number;
    step?: number;
  } = {}
): ChangeEventHandler<string> {
  const { min, max, step } = options;

  return (value: string, event: ChangeEvent<HTMLInputElement>) => {
    let numValue = Number(value);

    if (isNaN(numValue)) {
      return; // 忽略无效数字
    }

    if (min !== undefined && numValue < min) {
      numValue = min;
    }

    if (max !== undefined && numValue > max) {
      numValue = max;
    }

    if (step !== undefined) {
      const remainder = numValue % step;
      if (remainder !== 0) {
        numValue = Math.round(numValue / step) * step;
      }
    }

    handler(numValue, event);
  };
}

/**
 * 创建选择处理器
 */
export function createSelectHandler<T>(
  handler: (value: T, event: ChangeEvent<HTMLSelectElement>) => void,
  options: {
    parser?: (value: string) => T;
    validator?: (value: T) => boolean;
  } = {}
): ChangeEventHandler<T> {
  const { parser, validator } = options;

  return (value: T, event: ChangeEvent<HTMLSelectElement>) => {
    let processedValue = value;

    if (parser && typeof processedValue === 'string') {
      try {
        processedValue = parser(processedValue);
      } catch (error) {
        console.error('Failed to parse select value:', error);
        return;
      }
    }

    if (validator && !validator(processedValue)) {
      console.warn('Invalid select value:', processedValue);
      return;
    }

    handler(processedValue, event);
  };
}

// ==================== 调试工具 ====================

/**
 * 事件处理器调试工具
 */
export class EventDebugger {
  private static enabled = false;

  static enable() {
    this.enabled = true;
  }

  static disable() {
    this.enabled = false;
  }

  static log(type: string, handler: Function, ...args: any[]) {
    if (!this.enabled) return;

    console.group(`🔧 Event Debug: ${type}`);
    console.log('Handler:', handler.toString());
    console.log('Args:', args);
    console.groupEnd();
  }

  static createDebugWrapper<T extends Function>(type: string, handler: T): T {
    return ((...args: any[]) => {
      this.log(type, handler, ...args);
      return handler(...args);
    }) as unknown as T;
  }
}