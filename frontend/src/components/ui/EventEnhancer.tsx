/**
 * 事件处理器增强器组件
 * 为任何UI组件提供灵活的事件处理器适配
 */

import * as React from 'react';
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  UnifiedEventHandler
} from '@/types/event-handlers';
import {
  createChangeHandler,
  createClickHandler,
  createKeyboardHandler,
  createFocusHandler,
  createFormHandler
} from '@/utils/eventAdapter';

// ==================== 事件增强器Props ====================

/**
 * 通用事件处理器增强器Props
 */
export interface EventEnhancerProps<T = HTMLElement> {
  /** 原始组件 */
  children: React.ReactElement<any>;
  /** 点击事件处理器 - 支持多种签名 */
  onClick?: ClickEventHandler<void>;
  /** 变更事件处理器 - 支持多种签名 */
  onChange?: ChangeEventHandler<string>;
  /** 键盘事件处理器 - 支持多种签名 */
  onKeyDown?: KeyboardEventHandler<void>;
  onKeyUp?: KeyboardEventHandler<void>;
  /** 焦点事件处理器 - 支持多种签名 */
  onFocus?: FocusEventHandler<void>;
  onBlur?: FocusEventHandler<void>;
  /** 表单提交事件处理器 - 支持多种签名 */
  onSubmit?: FormSubmitHandler<void>;
  /** 是否启用事件处理器适配 */
  enableAdaptation?: boolean;
  /** 自定义事件处理器映射 */
  customHandlers?: Record<string, Function>;
}

/**
 * 专用输入组件事件增强器Props
 */
export interface InputEventEnhancerProps
  extends Omit<EventEnhancerProps<HTMLInputElement>, 'onChange'> {
  /** 输入变更事件处理器 - 支持多种签名 */
  onChange?: ChangeEventHandler<string>;
  /** 输入值 */
  value?: string;
  /** 受控模式下的值变更回调 */
  onValueChange?: (value: string) => void;
}

/**
 * 专用表单组件事件增强器Props
 */
export interface FormEventEnhancerProps
  extends Omit<EventEnhancerProps<HTMLFormElement>, 'onSubmit'> {
  /** 表单提交事件处理器 - 支持多种签名 */
  onSubmit?: FormSubmitHandler<void>;
  /** 表单数据 */
  data?: Record<string, any>;
  /** 表单提交前的数据预处理 */
  preprocessData?: (data: Record<string, any>) => Record<string, any>;
}

// ==================== 事件增强器实现 ====================

/**
 * 通用事件处理器增强器组件
 */
export const EventEnhancer = React.forwardRef<any, EventEnhancerProps>(
  (
    {
      children,
      onClick,
      onChange,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      onSubmit,
      enableAdaptation = true,
      customHandlers = {},
      ...restProps
    },
    ref
  ) => {
    // 创建适配的事件处理器
    const adaptedHandlers = React.useMemo(() => {
      if (!enableAdaptation) {
        return {};
      }

      return {
        onClick: createClickHandler(onClick),
        onChange: createChangeHandler(onChange),
        onKeyDown: createKeyboardHandler(onKeyDown),
        onKeyUp: createKeyboardHandler(onKeyUp),
        onFocus: createFocusHandler(onFocus),
        onBlur: createFocusHandler(onBlur),
        onSubmit: createFormHandler(onSubmit),
        ...Object.entries(customHandlers).reduce((acc, [key, handler]) => {
          acc[key] = createUnifiedEventHandler(handler);
          return acc;
        }, {} as Record<string, any>)
      };
    }, [
      enableAdaptation,
      onClick,
      onChange,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      onSubmit,
      customHandlers
    ]);

    // 合并原始props和适配的事件处理器
    const enhancedProps = React.useMemo(() => ({
      ...restProps,
      ...adaptedHandlers,
      ref
    }), [restProps, adaptedHandlers, ref]);

    // 克隆子元素并添加增强的事件处理器
    return React.cloneElement(children, enhancedProps);
  }
);

EventEnhancer.displayName = 'EventEnhancer';

/**
 * 输入组件专用事件增强器
 */
export const InputEventEnhancer = React.forwardRef<HTMLInputElement, InputEventEnhancerProps>(
  (
    {
      children,
      onChange,
      onValueChange,
      value,
      enableAdaptation = true,
      ...props
    },
    ref
  ) => {
    // 创建适配的onChange处理器
    const adaptedOnChange = React.useMemo(() => {
      if (!enableAdaptation || (!onChange && !onValueChange)) {
        return undefined;
      }

      return createChangeHandler((newValue: string, event: React.ChangeEvent<HTMLInputElement>) => {
        // 调用原始onChange处理器
        if (onChange) {
          if (onChange.length === 0) {
            (onChange as () => void)();
          } else if (onChange.length === 1) {
            (onChange as (value: string) => void)(newValue);
          } else {
            (onChange as (value: string, event: React.ChangeEvent<HTMLInputElement>) => void)(newValue, event);
          }
        }

        // 调用onValueChange处理器
        onValueChange?.(newValue);
      });
    }, [enableAdaptation, onChange, onValueChange]);

    // 增强子元素props
    const enhancedProps = React.useMemo(() => ({
      ...props,
      value,
      onChange: adaptedOnChange,
      ref
    }), [props, value, adaptedOnChange, ref]);

    return React.cloneElement(children, enhancedProps);
  }
);

InputEventEnhancer.displayName = 'InputEventEnhancer';

/**
 * 表单组件专用事件增强器
 */
export const FormEventEnhancer = React.forwardRef<HTMLFormElement, FormEventEnhancerProps>(
  (
    {
      children,
      onSubmit,
      data = {},
      preprocessData,
      enableAdaptation = true,
      ...props
    },
    ref
  ) => {
    // 创建适配的onSubmit处理器
    const adaptedOnSubmit = React.useMemo(() => {
      if (!enableAdaptation || !onSubmit) {
        return undefined;
      }

      return createFormHandler((submitData: void, event: React.FormEvent<HTMLFormElement>) => {
        // 预处理数据
        const processedData = preprocessData ? preprocessData(data) : data;

        // 调用原始onSubmit处理器
        if (onSubmit.length === 0) {
          (onSubmit as () => void)();
        } else if (onSubmit.length === 1) {
          if (typeof processedData !== 'undefined') {
            (onSubmit as (data: any) => void)(processedData);
          } else {
            (onSubmit as (event: React.FormEvent<HTMLFormElement>) => void)(event);
          }
        } else {
          (onSubmit as (data: any, event: React.FormEvent<HTMLFormElement>) => void)(processedData, event);
        }
      });
    }, [enableAdaptation, onSubmit, data, preprocessData]);

    // 增强子元素props
    const enhancedProps = React.useMemo(() => ({
      ...props,
      onSubmit: adaptedOnSubmit,
      ref
    }), [props, adaptedOnSubmit, ref]);

    return React.cloneElement(children, enhancedProps);
  }
);

FormEventEnhancer.displayName = 'FormEventEnhancer';

// ==================== 工具函数 ====================

/**
 * 创建统一事件处理器的辅助函数
 */
function createUnifiedEventHandler<T = void, E = React.SyntheticEvent>(
  handler?: (data?: T, event?: E) => void
): UnifiedEventHandler<T, E> | undefined {
  if (!handler) return undefined;

  return (data: T, event: E) => {
    if (handler.length === 0) {
      (handler as () => void)();
    } else if (handler.length === 1) {
      (handler as (data: T) => void)(data);
    } else {
      (handler as (data: T, event: E) => void)(data, event);
    }
  };
}

// ==================== Hook ====================

/**
 * 使用事件处理器增强器的Hook
 */
export function useEventEnhancer<T = HTMLElement>(
  handlers: {
    onClick?: ClickEventHandler<void>;
    onChange?: ChangeEventHandler<string>;
    onKeyDown?: KeyboardEventHandler<void>;
    onKeyUp?: KeyboardEventHandler<void>;
    onFocus?: FocusEventHandler<void>;
    onBlur?: FocusEventHandler<void>;
    onSubmit?: FormSubmitHandler<void>;
  },
  enableAdaptation = true
) {
  return React.useMemo(() => {
    if (!enableAdaptation) {
      return handlers;
    }

    return {
      onClick: createClickHandler(handlers.onClick),
      onChange: createChangeHandler(handlers.onChange),
      onKeyDown: createKeyboardHandler(handlers.onKeyDown),
      onKeyUp: createKeyboardHandler(handlers.onKeyUp),
      onFocus: createFocusHandler(handlers.onFocus),
      onBlur: createFocusHandler(handlers.onBlur),
      onSubmit: createFormHandler(handlers.onSubmit)
    };
  }, [handlers, enableAdaptation]);
}

/**
 * 使用输入事件增强器的Hook
 */
export function useInputChangeHandler(
  value?: string,
  onChange?: ChangeEventHandler<string>,
  onValueChange?: (value: string) => void,
  enableAdaptation = true
) {
  return React.useMemo(() => {
    if (!enableAdaptation || (!onChange && !onValueChange)) {
      return undefined;
    }

    return createChangeHandler((newValue: string, event: React.ChangeEvent<HTMLInputElement>) => {
      // 调用原始onChange处理器
      if (onChange) {
        if (onChange.length === 0) {
          (onChange as () => void)();
        } else if (onChange.length === 1) {
          (onChange as (value: string) => void)(newValue);
        } else {
          (onChange as (value: string, event: React.ChangeEvent<HTMLInputElement>) => void)(newValue, event);
        }
      }

      // 调用onValueChange处理器
      onValueChange?.(newValue);
    });
  }, [enableAdaptation, onChange, onValueChange]);
}

// ==================== 导出 ====================

export default EventEnhancer;
// 已在定义处 export，无需重复导出