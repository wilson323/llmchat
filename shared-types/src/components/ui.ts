/**
 * UI组件相关类型定义
 *
 * 提供统一的UI组件类型定义，支持前后端共享使用
 */

import type { ReactNode } from 'react';
import type { Agent, ChatSession, StandardMessage, SimpleMessage } from '../entities';

// ============================================================================
// 基础UI组件类型
// ============================================================================

/**
 * 基础组件Props接口
 */
export interface BaseComponentProps {
  /** CSS类名 */
  className?: string;
  /** 子组件 */
  children?: ReactNode;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 测试ID */
  testId?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否可见 */
  visible?: boolean;
  /** 组件ID */
  id?: string;
}

/**
 * 主题相关类型
 */
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ThemeColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 主题模式 */
  mode: ThemeMode;
  /** 是否自动模式 */
  isAutoMode: boolean;
  /** 用户偏好 */
  userPreference: ThemeMode;
  /** 主色调 */
  primaryColor?: string;
  /** 自定义主题变量 */
  customColors?: Record<string, string>;
  /** 字体设置 */
  typography?: {
    fontFamily?: string;
    fontSize?: Record<ComponentSize, string>;
    lineHeight?: Record<ComponentSize, number>;
  };
  /** 间距设置 */
  spacing?: Record<string, string>;
  /** 圆角设置 */
  borderRadius?: Record<string, string>;
  /** 阴影设置 */
  shadows?: Record<string, string>;
}

/**
 * 通用按钮Props
 */
export interface ButtonProps extends BaseComponentProps {
  /** 按钮类型 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';
  /** 按钮大小 */
  size?: ComponentSize;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮图标 */
  icon?: ReactNode;
  /** 图标位置 */
  iconPosition?: 'left' | 'right';
  /** 是否块级按钮 */
  block?: boolean;
  /** 是否圆形按钮 */
  circle?: boolean;
  /** 点击处理函数 */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** HTML按钮属性 */
  htmlType?: 'button' | 'submit' | 'reset';
}

/**
 * 输入框Props
 */
export interface InputProps extends BaseComponentProps {
  /** 输入框类型 */
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
  /** 输入框大小 */
  size?: ComponentSize;
  /** 占位符文本 */
  placeholder?: string;
  /** 输入值 */
  value?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 最大长度 */
  maxLength?: number;
  /** 最小长度 */
  minLength?: number;
  /** 输入模式 */
  pattern?: string;
  /** 自动完成 */
  autoComplete?: string;
  /** 前缀图标 */
  prefix?: ReactNode;
  /** 后缀图标 */
  suffix?: ReactNode;
  /** 前缀文本 */
  addonBefore?: ReactNode;
  /** 后缀文本 */
  addonAfter?: ReactNode;
  /** 是否显示字数统计 */
  showCount?: boolean;
  /** 是否允许清除 */
  allowClear?: boolean;
  /** 变更回调 */
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** 焦点回调 */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 失焦回调 */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  /** 按键回调 */
  onPressEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * 选择器Props
 */
export interface SelectProps<T = string> extends BaseComponentProps {
  /** 选择器大小 */
  size?: ComponentSize;
  /** 占位符文本 */
  placeholder?: string;
  /** 选择值 */
  value?: T | T[];
  /** 默认值 */
  defaultValue?: T | T[];
  /** 选项列表 */
  options: Array<{
    label: string;
    value: T;
    disabled?: boolean;
    description?: string;
    icon?: ReactNode;
  }>;
  /** 是否多选 */
  multiple?: boolean;
  /** 是否可搜索 */
  searchable?: boolean;
  /** 是否允许清除 */
  allowClear?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 最大显示数量 */
  maxTagCount?: number;
  /** 过滤函数 */
  filterOption?: (input: string, option: any) => boolean;
  /** 变更回调 */
  onChange?: (value: T | T[], option: any) => void;
  /** 搜索回调 */
  onSearch?: (value: string) => void;
  /** 选择回调 */
  onSelect?: (value: T, option: any) => void;
  /** 取消选择回调 */
  onDeselect?: (value: T, option: any) => void;
}

/**
 * 对话框Props
 */
export interface DialogProps extends BaseComponentProps {
  /** 是否显示对话框 */
  open: boolean;
  /** 对话框标题 */
  title?: ReactNode;
  /** 对话框内容 */
  content?: ReactNode;
  /** 对话框宽度 */
  width?: string | number;
  /** 对话框高度 */
  height?: string | number;
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 是否显示遮罩 */
  mask?: boolean;
  /** 点击遮罩是否关闭 */
  maskClosable?: boolean;
  /** 按ESC是否关闭 */
  keyboard?: boolean;
  /** 对话框位置 */
  placement?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  /** 确认按钮文本 */
  okText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 是否显示确认按钮 */
  showOk?: boolean;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 确认按钮加载状态 */
  okLoading?: boolean;
  /** 确认按钮Props */
  okButtonProps?: Partial<ButtonProps>;
  /** 取消按钮Props */
  cancelButtonProps?: Partial<ButtonProps>;
  /** 确认回调 */
  onOk?: () => void | Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 打开后回调 */
  afterOpenChange?: (open: boolean) => void;
}

// ============================================================================
// 聊天相关组件类型
// ============================================================================

/**
 * 智能体选择器Props
 */
export interface AgentSelectorProps extends BaseComponentProps {
  /** 智能体列表 */
  agents: Agent[];
  /** 当前选中的智能体 */
  currentAgent: Agent | null;
  /** 智能体变更回调 */
  onAgentChange: (agent: Agent) => void;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 选择器大小 */
  size?: ComponentSize;
  /** 是否显示状态 */
  showStatus?: boolean;
  /** 是否显示描述 */
  showDescription?: boolean;
  /** 是否支持搜索 */
  searchable?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 分组依据 */
  groupBy?: 'provider' | 'status' | 'workspaceType';
  /** 排序依据 */
  sortBy?: 'name' | 'status' | 'lastUsed';
  /** 最大显示数量 */
  maxVisible?: number;
}

/**
 * 消息组件Props
 */
export interface MessageProps extends BaseComponentProps {
  /** 消息数据 */
  message: SimpleMessage | StandardMessage;
  /** 消息格式类型 */
  format?: 'simple' | 'standard';
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 是否显示头像 */
  showAvatar?: boolean;
  /** 是否允许重试 */
  allowRetry?: boolean;
  /** 是否允许编辑 */
  allowEdit?: boolean;
  /** 是否允许删除 */
  allowDelete?: boolean;
  /** 是否允许复制 */
  allowCopy?: boolean;
  /** 是否允许反馈 */
  allowFeedback?: boolean;
  /** 重试回调 */
  onRetry?: () => void;
  /** 编辑回调 */
  onEdit?: (content: string) => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 反馈回调 */
  onFeedback?: (type: 'good' | 'bad') => void;
  /** 复制回调 */
  onCopy?: () => void;
  /** 消息渲染器 */
  messageRenderer?: (message: SimpleMessage | StandardMessage) => ReactNode;
  /** 自定义样式类名 */
  messageClassName?: string;
}

/**
 * 消息输入框Props
 */
export interface MessageInputProps extends BaseComponentProps {
  /** 发送消息回调 */
  onSendMessage: (content: string, options?: any) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否多行输入 */
  multiline?: boolean;
  /** 最大行数 */
  maxRows?: number;
  /** 最小行数 */
  minRows?: number;
  /** 是否正在发送 */
  isSending?: boolean;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 停止流式输出回调 */
  onStopStreaming?: () => void;
  /** 输入框大小 */
  size?: ComponentSize;
  /** 是否显示字数统计 */
  showCount?: boolean;
  /** 最大长度 */
  maxLength?: number;
  /** 是否支持快捷键 */
  enableShortcuts?: boolean;
  /** 快捷键配置 */
  shortcuts?: {
    send: string[];
    newLine: string[];
    stop: string[];
  };
  /** 自定义工具栏 */
  toolbar?: ReactNode;
  /** 是否支持文件上传 */
  allowFileUpload?: boolean;
  /** 文件上传回调 */
  onFileUpload?: (files: File[]) => void;
  /** 是否支持语音输入 */
  allowVoiceInput?: boolean;
  /** 语音输入回调 */
  onVoiceInput?: (audioBlob: Blob) => void;
  /** 输入框变化回调 */
  onChange?: (value: string) => void;
  /** 焦点回调 */
  onFocus?: () => void;
  /** 失焦回调 */
  onBlur?: () => void;
}

/**
 * 消息列表Props
 */
export interface MessageListProps extends BaseComponentProps {
  /** 消息列表 */
  messages: (SimpleMessage | StandardMessage)[];
  /** 消息格式类型 */
  format?: 'simple' | 'standard';
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否加载更多 */
  loadingMore?: boolean;
  /** 是否支持无限滚动 */
  infiniteScroll?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 消息点击回调 */
  onMessageClick?: (message: SimpleMessage | StandardMessage) => void;
  /** 消息渲染器 */
  messageRenderer?: (message: SimpleMessage | StandardMessage, index: number) => ReactNode;
  /** 自定义加载组件 */
  loadingComponent?: ReactNode;
  /** 自定义空状态组件 */
  emptyComponent?: ReactNode;
  /** 虚拟滚动配置 */
  virtualScroll?: {
    enabled: boolean;
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
  };
  /** 自动滚动配置 */
  autoScroll?: {
    enabled: boolean;
    behavior: 'auto' | 'smooth' | 'instant';
    threshold?: number;
  };
}

/**
 * 会话列表Props
 */
export interface SessionListProps extends BaseComponentProps {
  /** 会话列表 */
  sessions: ChatSession[];
  /** 当前会话ID */
  currentSessionId?: string;
  /** 会话选择回调 */
  onSessionSelect: (session: ChatSession) => void;
  /** 会话删除回调 */
  onSessionDelete?: (sessionId: string) => void;
  /** 会话重命名回调 */
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否支持搜索 */
  searchable?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 搜索回调 */
  onSearch?: (keyword: string) => void;
  /** 是否支持排序 */
  sortable?: boolean;
  /** 排序字段 */
  sortBy?: 'title' | 'updatedAt' | 'messageCount';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 排序回调 */
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  /** 是否支持批量操作 */
  batchable?: boolean;
  /** 批量操作回调 */
  onBatchOperation?: (operation: string, sessionIds: string[]) => void;
  /** 会话渲染器 */
  sessionRenderer?: (session: ChatSession) => ReactNode;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 是否显示消息数量 */
  showMessageCount?: boolean;
  /** 是否显示智能体信息 */
  showAgent?: boolean;
  /** 虚拟滚动配置 */
  virtualScroll?: {
    enabled: boolean;
    itemHeight: number;
    containerHeight: number;
  };
}

// ============================================================================
// 管理后台组件类型
// ============================================================================

/**
 * 数据表格Props
 */
export interface DataTableProps<T = any> extends BaseComponentProps {
  /** 数据列表 */
  data: T[];
  /** 列配置 */
  columns: Array<{
    key: string;
    title: string;
    dataIndex?: string;
    width?: string | number;
    align?: 'left' | 'center' | 'right';
    fixed?: 'left' | 'right';
    sortable?: boolean;
    filterable?: boolean;
    render?: (value: any, record: T, index: number) => ReactNode;
  }>;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否支持选择 */
  selectable?: boolean;
  /** 选中行回调 */
  onSelectionChange?: (selectedRows: T[], selectedRowKeys: string[]) => void;
  /** 是否支持排序 */
  sortable?: boolean;
  /** 排序回调 */
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  /** 是否支持过滤 */
  filterable?: boolean;
  /** 过滤回调 */
  onFilter?: (filters: Record<string, any>) => void;
  /** 分页配置 */
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
    showTotal?: boolean;
  };
  /** 分页变更回调 */
  onPaginationChange?: (page: number, pageSize: number) => void;
  /** 行点击回调 */
  onRowClick?: (record: T, index: number) => void;
  /** 行渲染器 */
  rowRenderer?: (record: T, index: number) => ReactNode;
  /** 空状态渲染器 */
  emptyRenderer?: () => ReactNode;
  /** 行类名 */
  rowClassName?: (record: T, index: number) => string;
  /** 行键名 */
  rowKey?: string | ((record: T) => string);
}

/**
 * 表单Props
 */
export interface FormProps extends BaseComponentProps {
  /** 表单值 */
  values?: Record<string, any>;
  /** 默认值 */
  initialValues?: Record<string, any>;
  /** 表单项配置 */
  fields: Array<{
    name: string;
    label: string;
    type: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'custom';
    required?: boolean;
    rules?: Array<{
      required?: boolean;
      pattern?: string;
      min?: number;
      max?: number;
      message: string;
    }>;
    placeholder?: string;
    options?: Array<{ label: string; value: any }>;
    component?: ReactNode;
    render?: (field: any) => ReactNode;
  }>;
  /** 布局类型 */
  layout?: 'horizontal' | 'vertical' | 'inline';
  /** 标签宽度 */
  labelWidth?: string | number;
  /** 是否正在提交 */
  submitting?: boolean;
  /** 提交回调 */
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  /** 值变更回调 */
  onValuesChange?: (changedValues: Record<string, any>, allValues: Record<string, any>) => void;
  /** 验证失败回调 */
  onValidationFailed?: (errors: Record<string, string[]>) => void;
  /** 确认按钮文本 */
  submitText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 重置回调 */
  onReset?: () => void;
}

/**
 * 统计卡片Props
 */
export interface StatCardProps extends BaseComponentProps {
  /** 标题 */
  title: string;
  /** 数值 */
  value: number | string;
  /** 前缀 */
  prefix?: ReactNode;
  /** 后缀 */
  suffix?: ReactNode;
  /** 趋势值 */
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
    period?: string;
  };
  /** 图标 */
  icon?: ReactNode;
  /** 颜色主题 */
  color?: ThemeColor;
  /** 加载状态 */
  loading?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 自定义数值渲染器 */
  valueRenderer?: (value: number | string) => ReactNode;
  /** 自定义趋势渲染器 */
  trendRenderer?: (trend: any) => ReactNode;
}

// ============================================================================
// 布局组件类型
// ============================================================================

/**
 * 侧边栏Props
 */
export interface SidebarProps extends BaseComponentProps {
  /** 是否展开 */
  collapsed?: boolean;
  /** 展开回调 */
  onCollapse?: (collapsed: boolean) => void;
  /** 侧边栏宽度 */
  width?: number | string;
  /** 折叠后的宽度 */
  collapsedWidth?: number | string;
  /** 侧边栏位置 */
  placement?: 'left' | 'right';
  /** 是否可拖拽调整宽度 */
  resizable?: boolean;
  /** 最小宽度 */
  minWidth?: number;
  /** 最大宽度 */
  maxWidth?: number;
  /** 主题 */
  theme?: 'light' | 'dark';
  /** 是否固定定位 */
  fixed?: boolean;
  /** 遮罩层 */
  mask?: boolean;
  /** 点击遮罩是否关闭 */
  maskClosable?: boolean;
}

/**
 * 头部Props
 */
export interface HeaderProps extends BaseComponentProps {
  /** 头部高度 */
  height?: number | string;
  /** 固定定位 */
  fixed?: boolean;
  /** 主题 */
  theme?: 'light' | 'dark';
  /** 是否显示阴影 */
  shadow?: boolean;
  /** 左侧内容 */
  leftContent?: ReactNode;
  /** 中间内容 */
  centerContent?: ReactNode;
  /** 右侧内容 */
  rightContent?: ReactNode;
  /** Logo组件 */
  logo?: ReactNode;
  /** 导航菜单 */
  navigation?: ReactNode;
  /** 用户菜单 */
  userMenu?: ReactNode;
}

/**
 * 内容区域Props
 */
export interface ContentProps extends BaseComponentProps {
  /** 最小高度 */
  minHeight?: string | number;
  /** 内边距 */
  padding?: string | number;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 是否显示滚动条 */
  scrollable?: boolean;
  /** 滚动条配置 */
  scrollbar?: {
    trackColor?: string;
    thumbColor?: string;
    width?: number;
  };
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 组件尺寸类型
 */
export type ComponentDimensions = {
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
};

/**
 * 组件位置类型
 */
export type ComponentPosition = {
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
  zIndex?: number;
};

/**
 * 动画配置类型
 */
export interface AnimationConfig {
  /** 动画名称 */
  name: string;
  /** 动画时长（毫秒） */
  duration: number;
  /** 缓动函数 */
  easing: string;
  /** 延迟时间（毫秒） */
  delay?: number;
  /** 动画次数 */
  iterations?: number | 'infinite';
  /** 动画方向 */
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  /** 是否填充 */
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
}

/**
 * 响应式断点类型
 */
export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export type Breakpoints = Record<BreakpointKey, number>;

/**
 * 响应式值类型
 */
export type ResponsiveValue<T> = T | Partial<Record<BreakpointKey, T>>;

/**
 * 组件变体类型
 */
export type ComponentVariant<T extends string = string> = T | Record<BreakpointKey, T>;

/**
 * 事件处理器类型
 */
export type EventHandler<T = Event> = (event: T) => void;
export type AsyncEventHandler<T = Event> = (event: T) => Promise<void>;

/**
 * 渲染器类型
 */
export type Renderer<T = any> = (props: T) => ReactNode;
export type AsyncRenderer<T = any> = (props: T) => Promise<ReactNode>;