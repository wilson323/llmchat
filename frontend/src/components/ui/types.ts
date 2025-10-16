/**
 * UI组件类型定义
 * 提供统一的类型安全和接口定义
 */

import React from 'react';

// 基础UI组件props
export interface BaseUIProps {
  className?: string;
  children?: React.ReactNode;
}

// 按钮大小类型
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

// 按钮变体类型
export type ButtonVariant =
  | 'brand'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'info'
  | 'glass';

// 按钮圆角类型
export type ButtonRadius = 'md' | 'lg' | 'full';

// 前向ref类型
export type ForwardRefComponent<T, P> = React.ForwardRefExoticComponent<
  P & React.RefAttributes<T>
>;

// 组件工厂类型
export interface ComponentFactory<T = {}> {
  (props: T): React.ReactElement | null;
  displayName?: string;
}

// 安全的React.cloneElement类型
export function safeCloneElement<T extends React.ReactElement>(
  element: T,
  props: Partial<T['props']>
): T {
  return React.cloneElement(element, props) as T;
}

// 类型守卫
export function isValidElement<P>(
  child: React.ReactNode
): child is React.ReactElement<P> {
  return React.isValidElement(child);
}

// 事件处理器类型
export type EventHandler<T = React.SyntheticEvent> = (event: T) => void;

// 动画状态类型
export type AnimationState = 'entering' | 'entered' | 'exiting' | 'exited';

// 方位类型
export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';