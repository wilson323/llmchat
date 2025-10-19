/**
 * 核心组件类型定义
 * 为ChatApp、Header、Sidebar等核心组件提供统一的类型定义
 */

import * as React from 'react';
import type { BaseComponentProps, EventHandlersProps } from '@/components/ui/ui.types';

// 类型别名以保持向后兼容
type BaseUIProps = BaseComponentProps;
import type { ChatMessage, Agent, ChatSession } from '@/types';
import type { KeyboardShortcut } from '@/hooks/useKeyboardManager';

// =============================================================================
// ChatApp 组件类型
// =============================================================================

export interface ChatAppProps extends BaseUIProps {
  /** 主题Provider配置 */
  themeProvider?: {
    defaultTheme?: 'light' | 'dark' | 'auto';
  };
  /** 快捷键配置 */
  shortcuts?: KeyboardShortcut[];
  /** 是否启用键盘快捷键 */
  enableKeyboardShortcuts?: boolean;
  /** 是否显示帮助面板 */
  showHelpPanel?: boolean;
  /** 帮助面板配置 */
  helpPanelConfig?: {
    categories?: string[];
    showAdvanced?: boolean;
  };
}

export interface ChatAppState {
  /** 帮助面板是否打开 */
  helpPanelOpen: boolean;
  /** 已注册的快捷键 */
  registeredShortcuts: KeyboardShortcut[];
  /** 确认对话框是否打开 */
  confirmDialogOpen: boolean;
  /** 待删除的会话ID */
  sessionToDelete: string | null;
  /** 键盘管理器状态 */
  keyboardManagerState: {
    enabled: boolean;
    activeShortcuts: KeyboardShortcut[];
  };
}

// =============================================================================
// Header 组件类型
// =============================================================================

export interface HeaderProps extends BaseUIProps, EventHandlersProps<HTMLElement> {
  /** 是否显示侧边栏切换按钮 */
  showSidebarToggle?: boolean;
  /** 是否显示用户菜单 */
  showUserMenu?: boolean;
  /** 是否显示通知 */
  showNotifications?: boolean;
  /** 通知数量 */
  notificationCount?: number;
  /** 是否显示搜索框 */
  showSearch?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 左侧操作区域 */
  leftActions?: React.ReactNode;
  /** 右侧操作区域 */
  rightActions?: React.ReactNode;
  /** 是否固定在顶部 */
  fixed?: boolean;
  /** 是否透明背景 */
  transparent?: boolean;
  /** Logo配置 */
  logo?: {
    src?: string;
    alt?: string;
    onClick?: () => void;
  };
  /** 用户信息 */
  user?: {
    name?: string;
    avatar?: string;
    email?: string;
    status?: 'online' | 'offline' | 'away' | 'busy';
  };
  /** 搜索配置 */
  searchConfig?: {
    onSearch?: (query: string) => void;
    onClear?: () => void;
    suggestions?: string[];
    maxSuggestions?: number;
  };
  /** 通知配置 */
  notificationConfig?: {
    onNotificationClick?: (notification: any) => void;
    onMarkAsRead?: (id: string) => void;
    onClearAll?: () => void;
  };
}

export interface HeaderState {
  /** 搜索框是否聚焦 */
  searchFocused: boolean;
  /** 搜索查询 */
  searchQuery: string;
  /** 用户菜单是否打开 */
  userMenuOpen: boolean;
  /** 通知面板是否打开 */
  notificationPanelOpen: boolean;
  /** 搜索建议 */
  searchSuggestions: string[];
}

// =============================================================================
// Sidebar 组件类型
// =============================================================================

export interface SidebarProps extends BaseUIProps, EventHandlersProps<HTMLElement> {
  /** 是否展开 */
  expanded?: boolean;
  /** 侧边栏位置 */
  position?: 'left' | 'right';
  /** 侧边栏宽度 */
  width?: string | number;
  /** 折叠时的宽度 */
  collapsedWidth?: string | number;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 是否可拖拽调整宽度 */
  resizable?: boolean;
  /** 最小宽度 */
  minWidth?: string | number;
  /** 最大宽度 */
  maxWidth?: string | number;
  /** 是否显示Logo */
  showLogo?: boolean;
  /** Logo配置 */
  logo?: {
    src?: string;
    alt?: string;
    href?: string;
  };
  /** 导航配置 */
  navigation?: {
    items: NavigationItem[];
    activeKey?: string;
    onNavigate?: (key: string) => void;
  };
  /** 会话列表配置 */
  sessions?: {
    show?: boolean;
    showArchived?: boolean;
    maxItems?: number;
    onSessionSelect?: (session: ChatSession) => void;
    onSessionDelete?: (sessionId: string) => void;
    onSessionRename?: (sessionId: string, newTitle: string) => void;
  };
  /** 智能体列表配置 */
  agents?: {
    show?: boolean;
    showInactive?: boolean;
    onAgentSelect?: (agent: Agent) => void;
    onAgentToggle?: (agentId: string) => void;
  };
  /** 底部操作区 */
  footerActions?: React.ReactNode;
  /** 自定义内容 */
  customContent?: React.ReactNode;
}

export interface NavigationItem {
  /** 导航项键值 */
  key: string;
  /** 导航项标题 */
  title: string;
  /** 导航项图标 */
  icon?: React.ReactNode;
  /** 导航项徽章 */
  badge?: string | number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 子导航项 */
  children?: NavigationItem[];
  /** 导航项URL */
  href?: string;
  /** 点击事件 */
  onClick?: () => void;
  /** 是否外部链接 */
  external?: boolean;
  /** 提示文本 */
  tooltip?: string;
}

export interface SidebarState {
  /** 是否展开 */
  expanded: boolean;
  /** 当前宽度 */
  currentWidth: number;
  /** 活跃的导航项 */
  activeNavigationKey: string;
  /** 搜索查询 */
  searchQuery: string;
  /** 是否正在搜索 */
  isSearching: boolean;
  /** 搜索结果 */
  searchResults: {
    sessions: ChatSession[];
    agents: Agent[];
  };
}

// =============================================================================
// ChatContainer 组件类型
// =============================================================================

export interface ChatContainerProps extends BaseUIProps, EventHandlersProps<HTMLElement> {
  /** 当前会话 */
  currentSession?: ChatSession;
  /** 当前智能体 */
  currentAgent?: Agent;
  /** 消息列表 */
  messages?: ChatMessage[];
  /** 是否正在加载 */
  loading?: boolean;
  /** 错误状态 */
  error?: string | null;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 输入框配置 */
  inputConfig?: {
    placeholder?: string;
    maxLength?: number;
    showSendButton?: boolean;
    showVoiceButton?: boolean;
    showFileButton?: boolean;
    enableShortcuts?: boolean;
    autoResize?: boolean;
    minHeight?: number;
    maxHeight?: number;
  };
  /** 消息配置 */
  messageConfig?: {
    showTimestamp?: boolean;
    showAvatar?: boolean;
    showRole?: boolean;
    enableCopy?: boolean;
    enableEdit?: boolean;
    enableDelete?: boolean;
    enableRegenerate?: boolean;
    enableReaction?: boolean;
  };
  /** 虚拟化配置 */
  virtualization?: {
    enabled?: boolean;
    itemHeight?: number | ((message: ChatMessage, index: number) => number);
    overscan?: number;
  };
  /** 事件回调 */
  onSendMessage?: (content: string, files?: File[]) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  onCopyMessage?: (content: string) => void;
  onReactToMessage?: (messageId: string, reaction: string) => void;
  onScrollToBottom?: () => void;
  onLoadMoreMessages?: () => void;
}

export interface ChatContainerState {
  /** 输入框值 */
  inputValue: string;
  /** 输入框是否聚焦 */
  inputFocused: boolean;
  /** 是否正在发送 */
  isSending: boolean;
  /** 滚动位置 */
  scrollTop: number;
  /** 是否在底部 */
  isAtBottom: boolean;
  /** 选中的消息 */
  selectedMessageId: string | null;
  /** 编辑的消息 */
  editingMessageId: string | null;
  /** 回复的消息 */
  replyingToMessageId: string | null;
  /** 拖拽的文件 */
  draggedFiles: File[];
  /** 语音录制状态 */
  voiceRecording: {
    isRecording: boolean;
    duration: number;
    blob?: Blob;
  };
}

// =============================================================================
// MessageList 组件类型
// =============================================================================

export interface MessageListProps extends BaseUIProps, EventHandlersProps<HTMLElement> {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 当前用户ID */
  currentUserId?: string;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否有更多消息 */
  hasMore?: boolean;
  /** 是否正在加载更多 */
  loadingMore?: boolean;
  /** 虚拟化配置 */
  virtualization?: {
    enabled?: boolean;
    itemHeight?: number | ((message: ChatMessage, index: number) => number);
    overscan?: number;
  };
  /** 消息渲染配置 */
  messageConfig?: {
    showTimestamp?: boolean;
    showAvatar?: boolean;
    showRole?: boolean;
    enableCopy?: boolean;
    enableEdit?: boolean;
    enableDelete?: boolean;
    enableRegenerate?: boolean;
    enableReaction?: boolean;
    enableQuote?: boolean;
    groupMessages?: boolean;
    groupInterval?: number; // 分组间隔时间（毫秒）
  };
  /** 自定义消息渲染器 */
  messageRenderer?: (message: ChatMessage, index: number) => React.ReactNode;
  /** 自定义头像渲染器 */
  avatarRenderer?: (message: ChatMessage) => React.ReactNode;
  /** 自定义时间渲染器 */
  timeRenderer?: (timestamp: string) => React.ReactNode;
  /** 事件回调 */
  onMessageClick?: (message: ChatMessage) => void;
  onMessageDoubleClick?: (message: ChatMessage) => void;
  onMessageEdit?: (message: ChatMessage) => void;
  onMessageDelete?: (message: ChatMessage) => void;
  onMessageCopy?: (content: string) => void;
  onMessageRegenerate?: (message: ChatMessage) => void;
  onMessageReact?: (message: ChatMessage, reaction: string) => void;
  onMessageQuote?: (message: ChatMessage) => void;
  onLoadMore?: () => void;
  onScroll?: (scrollTop: number) => void;
}

export interface MessageListState {
  /** 滚动位置 */
  scrollTop: number;
  /** 是否在底部 */
  isAtBottom: boolean;
  /** 是否正在自动滚动 */
  isAutoScrolling: boolean;
  /** 可见的消息索引范围 */
  visibleRange: {
    start: number;
    end: number;
  };
  /** 消息高度缓存 */
  messageHeights: Map<string, number>;
}

// =============================================================================
// MessageInput 组件类型
// =============================================================================

export interface MessageInputProps extends BaseUIProps, EventHandlersProps<HTMLElement> {
  /** 输入值 */
  value?: string;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大长度 */
  maxLength?: number;
  /** 是否多行 */
  multiline?: boolean;
  /** 最小行数 */
  minRows?: number;
  /** 最大行数 */
  maxRows?: number;
  /** 是否自动调整高度 */
  autoResize?: boolean;
  /** 是否显示发送按钮 */
  showSendButton?: boolean;
  /** 是否显示语音按钮 */
  showVoiceButton?: boolean;
  /** 是否显示文件按钮 */
  showFileButton?: boolean;
  /** 支持的文件类型 */
  acceptFileTypes?: string;
  /** 最大文件大小 */
  maxFileSize?: number;
  /** 是否启用快捷键 */
  enableShortcuts?: boolean;
  /** 自定义快捷键 */
  customShortcuts?: Record<string, () => void>;
  /** 是否启用emoji */
  enableEmoji?: boolean;
  /** 是否启用@提及 */
  enableMention?: boolean;
  /** 提及配置 */
  mentionConfig?: {
    users?: Array<{ id: string; name: string; avatar?: string }>;
    onSelect?: (user: any) => void;
  };
  /** 事件回调 */
  onSend?: (content: string, files?: File[]) => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyPress?: (event: React.KeyboardEvent) => void;
  onFileSelect?: (files: File[]) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: (blob: Blob) => void;
}

export interface MessageInputState {
  /** 输入值 */
  value: string;
  /** 是否聚焦 */
  focused: boolean;
  /** 是否正在录音 */
  isRecording: boolean;
  /** 录音时长 */
  recordingDuration: number;
  /** 拖拽的文件 */
  draggedFiles: File[];
  /** 提及建议 */
  mentionSuggestions: any[];
  /** 选中的提及 */
  selectedMentionIndex: number;
  /** emoji面板是否打开 */
  emojiPanelOpen: boolean;
}

// =============================================================================
// 键盘管理相关类型
// =============================================================================

export interface KeyboardManagerProps {
  /** 是否启用 */
  enabled?: boolean;
  /** 快捷键列表 */
  shortcuts?: KeyboardShortcut[];
  /** 全局快捷键 */
  globalShortcuts?: KeyboardShortcut[];
  /** 作用域 */
  scope?: string;
  /** 阻止默认行为 */
  preventDefault?: boolean;
  /** 停止事件传播 */
  stopPropagation?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

export interface KeyboardManagerState {
  /** 是否启用 */
  enabled: boolean;
  /** 当前作用域 */
  currentScope: string;
  /** 已注册的快捷键 */
  registeredShortcuts: Map<string, KeyboardShortcut>;
  /** 按键状态 */
  keyStates: Map<string, boolean>;
  /** 组合键状态 */
  combinationStates: Map<string, boolean>;
}

// =============================================================================
// 确认对话框类型
// =============================================================================

export interface ConfirmDialogProps extends BaseUIProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 标题 */
  title: string;
  /** 消息内容 */
  message?: string;
  /** 描述内容 */
  description?: React.ReactNode;
  /** 确认按钮文本 */
  confirmText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 是否为危险操作 */
  destructive?: boolean;
  /** 确认按钮类型 */
  confirmType?: 'default' | 'primary' | 'destructive';
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 确认回调 */
  onConfirm?: () => void | Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 自定义确认按钮 */
  confirmButton?: React.ReactNode;
  /** 自定义取消按钮 */
  cancelButton?: React.ReactNode;
  /** 自定义内容 */
  customContent?: React.ReactNode;
}

// =============================================================================
// 导出（所有类型已在定义处使用 export 关键字导出）
// =============================================================================