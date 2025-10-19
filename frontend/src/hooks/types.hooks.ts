/**
 * Hook 类型定义
 * 为所有自定义Hook提供统一的类型定义
 */

import * as React from 'react';
import type { ChatMessage, Agent, Session } from '@/types';
import type {
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler
} from '@/types/event-handlers';
import type {
  VirtualScrollItem,
  VirtualScrollProps,
  VirtualScrollRef
} from '@/components/ui/ui.types';

// =============================================================================
// 虚拟化 Hook 类型
// =============================================================================

export interface UseVirtualScrollOptions {
  /** 项目高度计算函数 */
  itemHeight: (index: number) => number;
  /** 容器高度 */
  containerHeight: number;
  /** 项目总数 */
  itemCount: number;
  /** 预渲染项目数 */
  overscan?: number;
}

export interface VirtualScrollResult {
  /** 虚拟项目列表 */
  virtualItems: Array<{
    index: number;
    key: string;
    start: number;
    size: number;
  }>;
  /** 总高度 */
  totalHeight: number;
  /** 滚动到指定索引 */
  scrollToIndex: (index: number) => void;
  /** 滚动到顶部 */
  scrollToTop: () => void;
}

// =============================================================================
// 主题 Hook 类型
// =============================================================================

export interface UseThemeResult {
  /** 当前主题 */
  theme: 'light' | 'dark';
  /** 用户偏好 */
  userPreference: 'light' | 'dark' | 'auto';
  /** 是否为自动模式 */
  isAutoMode: boolean;
  /** 切换主题 */
  toggleTheme: () => void;
  /** 设置主题 */
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

// =============================================================================
// 键盘管理 Hook 类型
// =============================================================================

export interface KeyboardShortcut {
  /** 按键 */
  key: string;
  /** 是否需要Ctrl键 */
  ctrlKey?: boolean;
  /** 是否需要Shift键 */
  shiftKey?: boolean;
  /** 是否需要Alt键 */
  altKey?: boolean;
  /** 是否需要Meta键 */
  metaKey?: boolean;
  /** 回调函数 */
  action: () => void;
  /** 描述 */
  description: string;
  /** 分类 */
  category: 'navigation' | 'editing' | 'conversation' | 'accessibility' | 'custom';
  /** 是否启用 */
  enabled?: boolean;
  /** 作用域 */
  scope?: string;
}

export interface UseKeyboardManagerOptions {
  /** 是否启用 */
  enabled?: boolean;
  /** 作用域 */
  scope?: string;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
  /** 是否停止事件传播 */
  stopPropagation?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

export interface UseKeyboardManagerResult {
  /** 注册快捷键 */
  registerShortcuts: (shortcuts: KeyboardShortcut[]) => () => void;
  /** 注销快捷键 */
  unregisterShortcuts: (shortcuts: KeyboardShortcut[]) => void;
  /** 检查快捷键是否启用 */
  isShortcutEnabled: (shortcut: KeyboardShortcut) => boolean;
  /** 获取当前作用域 */
  getCurrentScope: () => string;
  /** 设置作用域 */
  setScope: (scope: string) => void;
}

// =============================================================================
// 聊天 Hook 类型
// =============================================================================

export interface UseChatOptions {
  /** 初始消息 */
  initialMessages?: ChatMessage[];
  /** 当前会话 */
  currentSession?: Session;
  /** 当前智能体 */
  currentAgent?: Agent;
  /** 自动发送 */
  autoSend?: boolean;
  /** 消息保存回调 */
  onSaveMessage?: (message: ChatMessage) => void;
  /** 错误处理回调 */
  onError?: (error: Error) => void;
}

export interface UseChatResult {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 当前输入值 */
  input: string;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 发送消息 */
  sendMessage: (content: string, files?: File[]) => Promise<void>;
  /** 重试发送 */
  retryMessage: (messageId: string) => Promise<void>;
  /** 删除消息 */
  deleteMessage: (messageId: string) => void;
  /** 编辑消息 */
  editMessage: (messageId: string, newContent: string) => void;
  /** 设置输入值 */
  setInput: (value: string) => void;
  /** 清空消息 */
  clearMessages: () => void;
  /** 滚动到底部 */
  scrollToBottom: () => void;
  /** 添加消息 */
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => ChatMessage;
}

// =============================================================================
// 输入框 Hook 类型
// =============================================================================

export interface UseInputOptions<T = string> {
  /** 初始值 */
  initialValue?: T;
  /** 最大长度 */
  maxLength?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 验证函数 */
  validator?: (value: T) => string | null;
  /** 变更回调 */
  onChange?: ChangeEventHandler<T>;
  /** 焦点回调 */
  onFocus?: FocusEventHandler<T>;
  /** 失焦回调 */
  onBlur?: FocusEventHandler<T>;
  /** 键盘回调 */
  onKeyDown?: KeyboardEventHandler<T>;
  /** 防抖延迟 */
  debounceDelay?: number;
  /** 是否自动去除空格 */
  trim?: boolean;
}

export interface UseInputResult<T = string> {
  /** 当前值 */
  value: T;
  /** 是否聚焦 */
  focused: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否有效 */
  isValid: boolean;
  /** 设置值 */
  setValue: (value: T) => void;
  /** 重置值 */
  reset: () => void;
  /** 清空值 */
  clear: () => void;
  /** 聚焦 */
  focus: () => void;
  /** 失焦 */
  blur: () => void;
  /** 事件处理器 */
  handlers: {
    onChange: ChangeEventHandler<T>;
    onFocus: FocusEventHandler<T>;
    onBlur: FocusEventHandler<T>;
    onKeyDown: KeyboardEventHandler<T>;
  };
}

// =============================================================================
// 防抖 Hook 类型
// =============================================================================

export interface UseDebounceOptions {
  /** 延迟时间（毫秒） */
  delay: number;
  /** 是否在延迟开始前立即执行 */
  leading?: boolean;
  /** 是否在延迟结束后立即执行 */
  trailing?: boolean;
  /** 最大等待时间 */
  maxWait?: number;
}

export interface UseDebounceResult<T> {
  /** 防抖后的值 */
  debouncedValue: T;
  /** 是否正在等待 */
  isWaiting: boolean;
  /** 取消防抖 */
  cancel: () => void;
  /** 立即执行 */
  flush: () => void;
}

// =============================================================================
// 节流 Hook 类型
// =============================================================================

export interface UseThrottleOptions {
  /** 延迟时间（毫秒） */
  delay: number;
  /** 是否在开始时立即执行 */
  leading?: boolean;
  /** 是否在结束时执行 */
  trailing?: boolean;
}

export interface UseThrottleResult<T> {
  /** 节流后的值 */
  throttledValue: T;
  /** 是否被节流 */
  isThrottled: boolean;
  /** 取消节流 */
  cancel: () => void;
}

// =============================================================================
// 本地存储 Hook 类型
// =============================================================================

export interface UseLocalStorageOptions<T> {
  /** 序列化函数 */
  serializer?: {
    read: (value: string) => T;
    write: (value: T) => string;
  };
  /** 默认值 */
  defaultValue?: T;
  /** 错误处理 */
  onError?: (error: Error) => void;
}

export interface UseLocalStorageResult<T> {
  /** 当前值 */
  value: T;
  /** 设置值 */
  setValue: (value: T | ((prev: T) => T)) => void;
  /** 移除值 */
  removeValue: () => void;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
}

// =============================================================================
// 异步状态 Hook 类型
// =============================================================================

export interface UseAsyncOptions<T, E = Error> {
  /** 立即执行 */
  immediate?: boolean;
  /** 成功回调 */
  onSuccess?: (data: T) => void;
  /** 错误回调 */
  onError?: (error: E) => void;
  /** 完成回调 */
  onSettled?: () => void;
  /** 重置状态 */
  resetOnExecute?: boolean;
}

export interface UseAsyncResult<T, E = Error> {
  /** 数据 */
  data: T | null;
  /** 错误 */
  error: E | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否成功 */
  isSuccess: boolean;
  /** 是否失败 */
  isError: boolean;
  /** 是否完成 */
  isSettled: boolean;
  /** 执行异步函数 */
  execute: (...args: any[]) => Promise<T>;
  /** 重置状态 */
  reset: () => void;
  /** 设置数据 */
  setData: (data: T) => void;
  /** 设置错误 */
  setError: (error: E) => void;
}

// =============================================================================
// 窗口大小 Hook 类型
// =============================================================================

export interface UseWindowSizeOptions {
  /** 防抖延迟 */
  debounceDelay?: number;
  /** 初始宽度 */
  initialWidth?: number;
  /** 初始高度 */
  initialHeight?: number;
}

export interface UseWindowSizeResult {
  /** 窗口宽度 */
  width: number;
  /** 窗口高度 */
  height: number;
  /** 是否为移动设备 */
  isMobile: boolean;
  /** 是否为平板设备 */
  isTablet: boolean;
  /** 是否为桌面设备 */
  isDesktop: boolean;
}

// =============================================================================
// 媒体查询 Hook 类型
// =============================================================================

export interface UseMediaQueryOptions {
  /** 默认值（服务端渲染时使用） */
  defaultValue?: boolean;
  /** 初始化时立即执行 */
  initializeWithValue?: boolean;
}

// =============================================================================
// 拖拽 Hook 类型
// =============================================================================

export interface UseDragOptions {
  /** 是否启用拖拽 */
  disabled?: boolean;
  /** 拖拽轴限制 */
  axis?: 'x' | 'y' | 'both';
  /** 边界限制 */
  bounds?: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
  /** 开始拖拽回调 */
  onDragStart?: (event: MouseEvent | TouchEvent) => void;
  /** 拖拽中回调 */
  onDrag?: (event: MouseEvent | TouchEvent) => void;
  /** 结束拖拽回调 */
  onDragEnd?: (event: MouseEvent | TouchEvent) => void;
}

export interface UseDragResult {
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 位置 */
  position: { x: number; y: number };
  /** 拖拽元素ref */
  dragRef: React.RefObject<HTMLElement>;
  /** 设置位置 */
  setPosition: (position: { x: number; y: number }) => void;
  /** 重置位置 */
  resetPosition: () => void;
}

// =============================================================================
// 复制到剪贴板 Hook 类型
// =============================================================================

export interface UseClipboardOptions {
  /** 成功回调 */
  onSuccess?: () => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 复制延迟 */
  timeout?: number;
}

export interface UseClipboardResult {
  /** 是否已复制 */
  isCopied: boolean;
  /** 复制文本 */
  copy: (text: string) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

// =============================================================================
// 导出所有类型
// =============================================================================

export type {
  // 虚拟化
  UseVirtualScrollOptions,
  VirtualScrollResult,

  // 主题
  UseThemeResult,

  // 键盘管理
  KeyboardShortcut,
  UseKeyboardManagerOptions,
  UseKeyboardManagerResult,

  // 聊天
  UseChatOptions,
  UseChatResult,

  // 输入框
  UseInputOptions,
  UseInputResult,

  // 防抖
  UseDebounceOptions,
  UseDebounceResult,

  // 节流
  UseThrottleOptions,
  UseThrottleResult,

  // 本地存储
  UseLocalStorageOptions,
  UseLocalStorageResult,

  // 异步状态
  UseAsyncOptions,
  UseAsyncResult,

  // 窗口大小
  UseWindowSizeOptions,
  UseWindowSizeResult,

  // 媒体查询
  UseMediaQueryOptions,

  // 拖拽
  UseDragOptions,
  UseDragResult,

  // 复制到剪贴板
  UseClipboardOptions,
  UseClipboardResult,
};