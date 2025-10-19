/**
 * 统一事件处理器实现 - v2.0.0
 *
 * 🎯 基于权威类型定义的统一事件处理器实现
 * 为所有组件提供统一、类型安全的事件处理器模式
 *
 * @version 2.0.0
 * @since 2025-10-19
 */

import React from 'react';

// 🚨 重要：所有事件处理器类型现在从权威定义文件导入
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler,
  FlexibleEventHandler,
  adaptEventHandler,
  EventValueExtractor,
  isSimplifiedEventHandler,
  isUnifiedEventHandler,
  isLegacyEventHandler
} from '@/types/event-handlers';
import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  FormEvent,
  SyntheticEvent
} from 'react';

// =============================================================================
// 事件处理器适配器实现
// =============================================================================

// ==================== 统一事件处理器适配器 v2.0.0 ====================

/**
 * 🔄 统一事件处理器适配器 - 基于权威定义
 *
 * 自动检测并适配各种格式的事件处理器
 * 现在使用权威类型定义，确保类型安全和一致性
 *
 * @deprecated 建议直接使用权威类型定义中的 adaptEventHandler
 */
export class UnifiedEventAdapter {
  /**
   * 🔄 适配变更事件处理器
   */
  static adaptChangeHandler<T = string>(
    handler?: ChangeEventHandler<T>
  ): UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
    if (!handler) return undefined;

    // 直接使用权威适配器
    return adaptEventHandler(handler);
  }

  /**
   * 🔄 适配点击事件处理器
   */
  static adaptClickHandler<T = void>(
    handler?: ClickEventHandler<T>
  ): UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>> | undefined {
    if (!handler) return undefined;

    // 直接使用权威适配器
    return adaptEventHandler(handler);
  }

  /**
   * 🔄 适配键盘事件处理器
   */
  static adaptKeyboardHandler<T = void>(
    handler?: KeyboardEventHandler<T>
  ): UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>> | undefined {
    if (!handler) return undefined;

    // 直接使用权威适配器
    return adaptEventHandler(handler);
  }

  /**
   * 🔄 适配焦点事件处理器
   */
  static adaptFocusHandler<T = void>(
    handler?: FocusEventHandler<T>
  ): UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
    if (!handler) return undefined;

    // 直接使用权威适配器
    return adaptEventHandler(handler);
  }

  /**
   * 🔄 适配表单提交处理器
   */
  static adaptFormHandler<T = void>(
    handler?: FormSubmitHandler<T>
  ): UnifiedEventHandler<T, FormEvent<HTMLFormElement>> | undefined {
    if (!handler) return undefined;

    // 直接使用权威适配器
    return adaptEventHandler(handler);
  }

  /**
   * 创建统一的事件处理器
   */
  private static createUnifiedHandler<T, E>(
    handler: FlexibleEventHandler<T, E>
  ): UnifiedEventHandler<T, E> {
    return (data: T, event: E) => {
      // 自动检测处理器签名并调用
      if (handler.length === 0) {
        // 无参数处理器
        (handler as () => void)();
      } else if (handler.length === 1) {
        // 单参数处理器 - 需要判断是data还是event
        if (this.isDataBasedHandler(handler)) {
          (handler as SimplifiedEventHandler<T>)(data);
        } else {
          (handler as LegacyEventHandler<E>)(event);
        }
      } else {
        // 标准双参数处理器
        (handler as UnifiedEventHandler<T, E>)(data, event);
      }
    };
  }

  /**
   * 判断是否为基于数据的处理器
   */
  private static isDataBasedHandler(handler: Function): boolean {
    const funcStr = handler.toString();

    // 检查函数参数名
    const hasEventParams = funcStr.includes('event') || funcStr.includes('e)') || funcStr.includes('e:');
    const hasDataParams = funcStr.includes('data') || funcStr.includes('value') || funcStr.includes('val');

    // 如果没有明确的事件参数标识，倾向于认为是基于数据的处理器
    return !hasEventParams || hasDataParams;
  }
}

// =============================================================================
// 值提取器
// =============================================================================

/**
 * 🛠️ 事件值提取器 - 基于权威定义
 *
 * 提供统一的事件值提取接口
 *
 * @deprecated 建议直接使用权威类型定义中的 EventValueExtractor
 */
export const EventValueExtractorAdapter = {
  /**
   * 从输入事件中提取字符串值
   */
  fromInput: EventValueExtractor.fromInput,

  /**
   * 从选择框事件中提取值
   */
  fromSelect: EventValueExtractor.fromSelect,

  /**
   * 从复选框事件中提取布尔值
   */
  fromCheckbox: EventValueExtractor.fromCheckbox,

  /**
   * 从单选框事件中提取值
   */
  fromRadio: EventValueExtractor.fromRadio,

  /**
   * 从数字输入框中提取数字值
   */
  fromNumberInput: EventValueExtractor.fromNumber,

  /**
   * 从日期输入框中提取日期值
   */
  fromDateInput: EventValueExtractor.fromDate,

  /**
   * 从范围滑块中提取数值
   */
  fromRange: EventValueExtractor.fromRange
} as const;

/**
 * @deprecated 使用 EventValueExtractorAdapter 替代
 */
export const EventValueExtractor = EventValueExtractorAdapter;

// =============================================================================
// 事件处理器工厂函数
// =============================================================================

// ==================== 事件处理器工厂函数 v2.0.0 ====================

/**
 * 🏭 创建统一的变更事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的适配器函数
 */
export function createChangeHandler<T = string>(
  handler?: ChangeEventHandler<T>
): UnifiedEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
  return UnifiedEventAdapter.adaptChangeHandler(handler);
}

/**
 * 🏭 创建统一的点击事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的适配器函数
 */
export function createClickHandler<T = void>(
  handler?: ClickEventHandler<T>
): UnifiedEventHandler<T, MouseEvent<HTMLButtonElement | HTMLDivElement>> | undefined {
  return UnifiedEventAdapter.adaptClickHandler(handler);
}

/**
 * 🏭 创建统一的键盘事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的适配器函数
 */
export function createKeyboardHandler<T = void>(
  handler?: KeyboardEventHandler<T>
): UnifiedEventHandler<T, KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>> | undefined {
  return UnifiedEventAdapter.adaptKeyboardHandler(handler);
}

/**
 * 🏭 创建统一的焦点事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的适配器函数
 */
export function createFocusHandler<T = void>(
  handler?: FocusEventHandler<T>
): UnifiedEventHandler<T, FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> | undefined {
  return UnifiedEventAdapter.adaptFocusHandler(handler);
}

/**
 * 🏭 创建统一的表单提交处理器
 *
 * @deprecated 建议直接使用权威类型定义中的适配器函数
 */
export function createFormHandler<T = void>(
  handler?: FormSubmitHandler<T>
): UnifiedEventHandler<T, FormEvent<HTMLFormElement>> | undefined {
  return UnifiedEventAdapter.adaptFormHandler(handler);
}

// =============================================================================
// 特殊用途事件处理器
// =============================================================================

/**
 * 创建带有验证的变更事件处理器
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
 * 创建带有防抖的变更事件处理器
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
 * 创建带有节流的变更事件处理器
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

// =============================================================================
// 预设处理器
// =============================================================================

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

/**
 * URL输入处理器（自动验证URL格式）
 */
export const urlInputHandler = (handler: ChangeEventHandler<string>): ChangeEventHandler<string> => {
  try {
    const urlRegex = /^https?:\/\/.+/;
    return (value: string, event: ChangeEvent<HTMLInputElement>) => {
      if (urlRegex.test(value)) {
        handler(value, event);
      }
    };
  } catch {
    return handler;
  }
};

/**
 * 手机号输入处理器（中国手机号格式）
 */
export const phoneInputHandler = (handler: ChangeEventHandler<string>): ChangeEventHandler<string> => {
  const phoneRegex = /^1[3-9]\d{9}$/;

  return (value: string, event: ChangeEvent<HTMLInputElement>) => {
    const cleanValue = value.replace(/\D/g, '');
    if (phoneRegex.test(cleanValue)) {
      handler(cleanValue, event);
    }
  };
};

// =============================================================================
// Hook 适配器
// =============================================================================

/**
 * 为 React 组件创建适配的事件处理器 Hook
 */
export function useAdaptedEventHandlers<T = string>(handlers: {
  onChange?: ChangeEventHandler<T>;
  onKeyDown?: KeyboardEventHandler<T>;
  onFocus?: FocusEventHandler<T>;
  onBlur?: FocusEventHandler<T>;
  onClick?: ClickEventHandler<T>;
  onSubmit?: FormSubmitHandler<T>;
}) {
  return React.useMemo(() => ({
    onChange: createChangeHandler(handlers.onChange),
    onKeyDown: createKeyboardHandler(handlers.onKeyDown),
    onFocus: createFocusHandler(handlers.onFocus),
    onBlur: createFocusHandler(handlers.onBlur),
    onClick: createClickHandler(handlers.onClick),
    onSubmit: createFormHandler(handlers.onSubmit)
  }), [handlers]);
}

// =============================================================================
// 类型守卫
// =============================================================================

// ==================== 类型守卫 v2.0.0 ====================

/**
 * 🛡️ 检查是否为统一格式的事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的 isUnifiedEventHandler
 */
export const isUnifiedEventHandlerHandler = isUnifiedEventHandler;

/**
 * 🛡️ 检查是否为传统 React 事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的 isLegacyEventHandler
 */
export const isLegacyEventHandlerHandler = isLegacyEventHandler;

/**
 * 🛡️ 检查是否为简化事件处理器
 *
 * @deprecated 建议直接使用权威类型定义中的 isSimplifiedEventHandler
 */
export const isSimplifiedEventHandlerHandler = isSimplifiedEventHandler;

// 为了向后兼容，重新导出权威类型守卫
export { isUnifiedEventHandler, isLegacyEventHandler, isSimplifiedEventHandler };

// =============================================================================
// 调试工具
// =============================================================================

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
    console.log('Handler length:', handler.length);
    console.log('Args:', args);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();
  }

  static createDebugWrapper<T extends Function>(type: string, handler: T): T {
    return ((...args: any[]) => {
      this.log(type, handler, ...args);
      return handler(...args);
    }) as unknown as T;
  }
}

// ==================== 迁移指南 v2.0.0 ====================

/**
 * 📚 UnifiedEventHandlers v2.0.0 迁移指南
 *
 * 本文件已经更新为基于权威类型定义的实现，确保类型安全和一致性。
 *
 * 🔄 主要变更：
 * 1. 所有事件处理器类型现在从 @/types/event-handlers 导入
 * 2. UnifiedEventAdapter 现在使用权威适配器
 * 3. EventValueExtractor 现在使用权威定义
 * 4. 所有工厂函数标记为 @deprecated
 *
 * 📝 迁移步骤：
 *
 * 旧代码：
 * ```typescript
 * import { createChangeHandler } from '@/utils/eventHandlers.unified';
 *
 * const handler = createChangeHandler((value: string, event) => {
 *   console.log(value);
 * });
 * ```
 *
 * 新代码：
 * ```typescript
 * import { adaptChangeHandler } from '@/types/event-handlers';
 *
 * const handler = adaptChangeHandler((value: string, event) => {
 *   console.log(value);
 * });
 * ```
 *
 * 🎯 推荐做法：
 * 1. 新代码直接从 @/types/event-handlers 导入
 * 2. 现有代码可以继续使用本文件（向后兼容）
 * 3. 逐步迁移到权威类型定义
 * 4. 使用 EventValueExtractor 替代本地定义
 *
 * ⚠️ 注意事项：
 * - 本文件保持向后兼容性
 * - 所有函数签名保持不变
 * - 类型安全性得到显著提升
 * - 建议在新项目中使用权威定义
 */

// =============================================================================
// 导出说明：所有导出已在定义处声明，无需重复
// =============================================================================