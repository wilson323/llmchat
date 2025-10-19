/**
 * 组件类型安全工具集
 * 提供React组件开发中常用的类型安全工具函数
 */

import * as React from 'react';
import type {
  ComponentProps,
  ComponentRef,
  ReactElement,
  ReactNode,
  SyntheticEvent,
  MouseEvent,
  FocusEvent,
  ChangeEvent,
  KeyboardEvent,
  FormEvent,
  HTMLAttributes,
} from 'react';

// ==================== 基础类型工具 ====================

/**
 * 提取组件Props类型
 */
export type ComponentPropsType<T extends React.ComponentType<any>> =
  T extends React.ComponentType<infer P> ? P : never;

/**
 * 提取组件Ref类型
 */
export type ComponentRefType<T extends React.ComponentType<any>> =
  T extends React.ForwardRefExoticComponent<infer P>
    ? React.RefAttributes<infer R> extends P
      ? R
      : never
    : never;

/**
 * 创建严格的Props类型（不允许额外属性）
 */
export type StrictProps<T> = T & Record<string, never>;

/**
 * 条件Required类型
 */
export type ConditionalRequired<T, K extends keyof T, C extends boolean> =
  C extends true ? Required<Pick<T, K>> & Omit<T, K> : T;

// ==================== 事件处理器工具 ====================

/**
 * 统一事件处理器类型
 */
export interface UnifiedEventHandler<T = void, E = SyntheticEvent> {
  (data: T, event: E): void;
}

/**
 * 简化事件处理器类型
 */
export interface SimplifiedEventHandler<T = void> {
  (data?: T): void;
}

/**
 * 传统事件处理器类型
 */
export interface LegacyEventHandler<E = SyntheticEvent> {
  (event: E): void;
}

/**
 * 灵活事件处理器类型（支持多种签名）
 */
export type FlexibleEventHandler<T = void, E = SyntheticEvent> =
  | UnifiedEventHandler<T, E>
  | SimplifiedEventHandler<T>
  | LegacyEventHandler<E>;

/**
 * 自动适配事件处理器
 */
export function createEventHandler<T = void, E = SyntheticEvent>(
  handler?: FlexibleEventHandler<T, E>
): UnifiedEventHandler<T, E> | undefined {
  if (!handler) return undefined;

  return (data: T, event: E) => {
    // 自动检测处理器类型并调用
    if (handler.length === 2) {
      (handler as UnifiedEventHandler<T, E>)(data, event);
    } else if (handler.length === 1) {
      // 简单启发式判断：如果是基于数据的处理器
      const handlerStr = handler.toString();
      const hasEventParam = handlerStr.includes('event') || handlerStr.includes('e)');

      if (hasEventParam) {
        (handler as LegacyEventHandler<E>)(event);
      } else {
        (handler as SimplifiedEventHandler<T>)(data);
      }
    } else {
      (handler as LegacyEventHandler<E>)(event);
    }
  };
}

/**
 * 专门的事件处理器创建器
 */
export const EventHandlers = {
  /** 点击事件处理器 */
  onClick: <T = void>(handler?: FlexibleEventHandler<T, MouseEvent>) =>
    createEventHandler(handler),

  /** 焦点事件处理器 */
  onFocus: <T = void>(handler?: FlexibleEventHandler<T, FocusEvent>) =>
    createEventHandler(handler),

  /** 失焦事件处理器 */
  onBlur: <T = void>(handler?: FlexibleEventHandler<T, FocusEvent>) =>
    createEventHandler(handler),

  /** 变更事件处理器 */
  onChange: <T = string>(handler?: FlexibleEventHandler<T, ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>) =>
    createEventHandler(handler),

  /** 键盘事件处理器 */
  onKeyDown: <T = void>(handler?: FlexibleEventHandler<T, KeyboardEvent>) =>
    createEventHandler(handler),

  /** 表单提交事件处理器 */
  onSubmit: <T = void>(handler?: FlexibleEventHandler<T, FormEvent>) =>
    createEventHandler(handler),
};

// ==================== 组件Props增强工具 ====================

/**
 * 排除冲突属性的Props
 */
export type PropsWithoutConflicts<T, K extends string> =
  Omit<T, K> & { [P in K]?: never };

/**
 * 合并Props类型
 */
export type MergeProps<T, U> = Omit<T, keyof U> & U;

/**
 * 为组件添加默认Props
 */
export type WithDefaults<T, D extends Partial<T>> =
  Omit<T, keyof D> & Required<Pick<T, keyof D>>;

/**
 * 创建带有验证的Props类型
 */
export interface ValidatedProps<T, V> {
  value: T;
  onChange: (value: T, isValid: boolean) => void;
  validator: (value: T) => V;
}

/**
 * 创建异步Props类型
 */
export interface AsyncProps<T> {
  data?: T;
  loading?: boolean;
  error?: Error;
  onLoad?: (data: T) => void;
  onError?: (error: Error) => void;
}

// ==================== 子组件类型工具 ====================

/**
 * 子组件基础Props
 */
export interface SubComponentProps {
  subComponent?: string;
}

/**
 * 带子组件的组件类型
 */
export type ComponentWithSubComponents<
  TMainProps,
  TSubComponents extends Record<string, React.FC<any>>
> = React.FC<TMainProps> & { [K in keyof TSubComponents]: TSubComponents[K] };

/**
 * 子组件工厂
 */
export interface SubComponentFactory<P = {}> {
  displayName: string;
  Component: React.FC<P>;
}

/**
 * 创建子组件
 */
export function createSubComponent<P extends object>(
  displayName: string,
  component: React.FC<P>
): React.FC<P> & { displayName: string } {
  const Component = component as React.FC<P> & { displayName: string };
  Component.displayName = displayName;
  return Component;
}

/**
 * 附加子组件到主组件
 */
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

// ==================== Ref类型工具 ====================

/**
 * 多态Ref类型
 */
export type PolymorphicRef<T> = React.Ref<T>;

/**
 * 转发Ref组件类型
 */
export type ForwardRefComponent<T, P> = React.ForwardRefExoticComponent<
  P & React.RefAttributes<T>
>;

/**
 * 创建类型安全的forwardRef组件
 */
export function createForwardRefComponent<T, P>(
  displayName: string,
  render: (props: P, ref: React.Ref<T>) => React.ReactElement | null
): ForwardRefComponent<T, P> {
  const Component = React.forwardRef<T, P>(render);
  Component.displayName = displayName;
  return Component;
}

/**
 * 多态组件创建器
 */
export function createPolymorphicComponent<
  T extends React.ElementType = 'button'
>(defaultElement: T = 'button' as T) {
  return React.forwardRef<
    PolymorphicRef<React.ElementType<T>>,
    {
      as?: React.ElementType;
      children?: React.ReactNode;
    } & React.ComponentPropsWithoutRef<T>
  >(({ as: Component = defaultElement, children, ...props }, ref) => {
    return React.createElement(Component, { ...props, ref }, children);
  });
}

// ==================== 类型守卫工具 ====================

/**
 * 检查是否为有效的React节点
 */
export function isValidReactNode(node: unknown): node is ReactNode {
  return (
    node === null ||
    node === undefined ||
    typeof node === 'string' ||
    typeof node === 'number' ||
    typeof node === 'boolean' ||
    React.isValidElement(node) ||
    Array.isArray(node)
  );
}

/**
 * 检查是否为有效的CSS类名
 */
export function isValidClassName(className: unknown): className is string {
  return typeof className === 'string';
}

/**
 * 检查是否为有效的事件处理器
 */
export function isValidEventHandler<T = any, E = SyntheticEvent>(
  handler: unknown
): handler is (data: T, event: E) => void {
  return typeof handler === 'function';
}

/**
 * 检查Props对象是否包含必要属性
 */
export function hasRequiredProps<T extends Record<string, any>, K extends keyof T>(
  props: T,
  requiredProps: K[]
): props is T & Required<Pick<T, K>> {
  return requiredProps.every(prop => prop in props && props[prop] !== undefined);
}

// ==================== 性能优化工具 ====================

/**
 * 创建记忆化的Props对象
 */
export function useMemoizedProps<T extends Record<string, any>>(
  props: T,
  deps: React.DependencyList = []
): T {
  return React.useMemo(() => props, deps);
}

/**
 * 创建稳定的回调函数
 */
export function useStableCallback<T extends readonly unknown[], R>(
  callback: (...args: T) => R,
  deps: React.DependencyList = []
): (...args: T) => R {
  return React.useCallback(callback, deps);
}

/**
 * 条件渲染类型安全的Hook
 */
export function useConditionalRender<T>(
  condition: boolean,
  data: T | undefined,
  render: (data: T) => ReactNode,
  fallback?: ReactNode
): ReactNode {
  return React.useMemo(() => {
    if (condition && data) {
      return render(data);
    }
    return fallback;
  }, [condition, data, render, fallback]);
}

// ==================== 可访问性工具 ====================

/**
 * ARIA属性类型
 */
export interface AriaAttributes {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-disabled'?: boolean;
  'aria-pressed'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-busy'?: boolean;
  'aria-atomic'?: boolean;
  'aria-relevant'?: string;
  'aria-dropeffect'?: string;
  'aria-grabbed'?: boolean;
  'aria-activedescendant'?: string;
  'aria-colcount'?: number;
  'aria-colindex'?: number;
  'aria-colspan'?: number;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-posinset'?: number;
  'aria-rowcount'?: number;
  'aria-rowindex'?: number;
  'aria-rowspan'?: number;
  'aria-setsize'?: number;
  'aria-valuemax'?: number;
  'aria-valuemin'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
  role?: string;
  tabIndex?: number;
}

/**
 * 验证可访问性要求
 */
export interface AccessibilityRequirements {
  hasLabel: boolean;
  hasKeyboardSupport: boolean;
  hasScreenReaderSupport: boolean;
  hasFocusManagement: boolean;
  hasColorContrast: boolean;
  hasErrorAnnouncement: boolean;
}

/**
 * 检查可访问性要求
 */
export function checkAccessibility(
  props: AriaAttributes & { children?: ReactNode }
): AccessibilityRequirements {
  const hasLabel = !!props['aria-label'] || !!props['aria-labelledby'];
  const hasScreenReaderSupport = hasLabel;
  const hasFocusManagement = props.tabIndex !== undefined;
  const hasKeyboardSupport = true; // 需要根据具体组件实现
  const hasColorContrast = true; // 需要根据样式检查
  const hasErrorAnnouncement = !!props['aria-live'];

  return {
    hasLabel,
    hasKeyboardSupport,
    hasScreenReaderSupport,
    hasFocusManagement,
    hasColorContrast,
    hasErrorAnnouncement,
  };
}

// ==================== 调试工具 ====================

/**
 * 组件Props调试工具
 */
export class ComponentDebugger {
  private static enabled = false;

  static enable() {
    this.enabled = true;
  }

  static disable() {
    this.enabled = false;
  }

  static log<T extends Record<string, any>>(
    componentName: string,
    props: T,
    changes?: Partial<T>
  ) {
    if (!this.enabled) return;

    console.group(`🔧 Component Debug: ${componentName}`);
    console.log('Props:', props);
    if (changes) {
      console.log('Changes:', changes);
    }
    console.groupEnd();
  }

  static createPropsLogger<T extends Record<string, any>>(
    componentName: string
  ) {
    return (props: T, prevProps?: T) => {
      if (!this.enabled) return props;

      const changes = prevProps
        ? Object.entries(props).reduce((acc, [key, value]) => {
            if (prevProps[key] !== value) {
              acc[key] = { from: prevProps[key], to: value };
            }
            return acc;
          }, {} as Record<string, { from: any; to: any }>)
        : undefined;

      this.log(componentName, props, changes);
      return props;
    };
  }
}

/**
 * 类型测试工具
 */
export type Expect<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

// ==================== 导出所有工具 ====================

export {
  // 类型工具
  ComponentPropsType,
  ComponentRefType,
  StrictProps,
  ConditionalRequired,

  // 事件处理器
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler,
  FlexibleEventHandler,
  EventHandlers,

  // Props增强
  PropsWithoutConflicts,
  MergeProps,
  WithDefaults,
  ValidatedProps,
  AsyncProps,

  // 子组件
  SubComponentProps,
  ComponentWithSubComponents,
  SubComponentFactory,

  // Ref工具
  PolymorphicRef,
  ForwardRefComponent,

  // 类型守卫
  isValidReactNode,
  isValidClassName,
  isValidEventHandler,
  hasRequiredProps,

  // 可访问性
  AriaAttributes,
  AccessibilityRequirements,

  // 调试
  ComponentDebugger,
  Expect,
  Equal,
};