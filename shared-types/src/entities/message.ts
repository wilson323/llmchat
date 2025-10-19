/**
 * 消息相关核心实体类型定义
 *
 * 提供统一的消息类型定义，支持多种消息格式和转换
 */

import type { JsonValue, JsonObject } from '../index';

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 消息角色类型
 */
export type MessageRole =
  | 'user'        // 用户消息
  | 'assistant'   // AI助手消息
  | 'system'      // 系统消息
  | 'function'    // 函数调用消息
  | 'tool';       // 工具调用消息

/**
 * 消息状态类型
 */
export type MessageStatus =
  | 'sending'     // 发送中
  | 'sent'        // 已发送
  | 'delivered'   // 已送达
  | 'read'        // 已读
  | 'processing'  // 处理中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled';  // 已取消

/**
 * 反馈类型
 */
export type FeedbackType =
  | 'good'        // 点赞
  | 'bad'         // 点踩
  | null;         // 无反馈

/**
 * 消息来源类型
 */
export type MessageSource =
  | 'user_input'      // 用户输入
  | 'ai_generation'   // AI生成
  | 'system_message'  // 系统消息
  | 'file_upload'     // 文件上传
  | 'voice_input'     // 语音输入
  | 'api_call'        // API调用
  | 'template'        // 模板消息
  | 'import';         // 导入消息

/**
 * 附件来源类型
 */
export type AttachmentSource =
  | 'upload'      // 用户上传
  | 'voice'       // 语音转文字
  | 'external'    // 外部链接
  | 'generated'   // AI生成
  | 'import';     // 导入文件

// ============================================================================
// 核心实体接口
// ============================================================================

/**
 * 附件元数据
 */
export interface AttachmentMetadata {
  /** 附件唯一标识 */
  id: string;
  /** 文件URL */
  url: string;
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** MIME类型 */
  mimeType: string;
  /** 文件来源 */
  source?: AttachmentSource;
  /** 上传时间戳 */
  uploadedAt?: number;
  /** 缩略图URL */
  thumbnailUrl?: string;
  /** 文件预览URL */
  previewUrl?: string;
  /** 下载URL */
  downloadUrl?: string;
  /** 文件扩展信息 */
  metadata?: JsonObject;
}

/**
 * 语音笔记元数据
 */
export interface VoiceNoteMetadata {
  /** 语音唯一标识 */
  id: string;
  /** 音频文件URL */
  url: string;
  /** 音频时长（秒） */
  duration: number;
  /** MIME类型 */
  mimeType: string;
  /** 文件大小（字节） */
  size?: number;
  /** 录制时间戳 */
  recordedAt?: number;
  /** 转文字结果 */
  transcription?: string;
  /** 转文字置信度 */
  confidence?: number;
  /** 语言代码 */
  language?: string;
  /** 音频质量评分 */
  quality?: number;
  /** 说话人识别 */
  speaker?: string;
}

/**
 * 交互数据类型定义 - FastGPT特定
 */
export interface InteractiveSelectOption {
  /** 选项键值 */
  key?: string;
  /** 选项值 */
  value: string;
  /** 选项描述 */
  description?: string;
  /** 是否为默认选项 */
  isDefault?: boolean;
}

export interface InteractiveFormOption {
  /** 选项值 */
  value: string;
  /** 选项标签 */
  label: string;
  /** 选项描述 */
  description?: string;
}

export interface InteractiveFormItem {
  /** 表单项类型 */
  type: 'input' | 'numberInput' | 'select' | 'textarea' | 'checkbox' | 'radio';
  /** 表单项键名 */
  key: string;
  /** 表单项标签 */
  label: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 选项列表（用于select、radio类型） */
  list?: InteractiveFormOption[];
  /** 默认值 */
  defaultValue?: string;
  /** 是否必填 */
  required?: boolean;
  /** 验证规则 */
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface InteractiveSelectParams {
  /** 选择描述 */
  description?: string;
  /** 变量键名 */
  varKey?: string;
  /** 用户选择选项 */
  userSelectOptions: InteractiveSelectOption[];
  /** 是否多选 */
  multiple?: boolean;
}

export interface InteractiveInputParams {
  /** 输入描述 */
  description?: string;
  /** 输入表单 */
  inputForm: InteractiveFormItem[];
  /** 提交按钮文本 */
  submitText?: string;
}

export type InteractiveData =
  | { type: 'userSelect'; origin?: 'init' | 'chat'; params: InteractiveSelectParams }
  | { type: 'userInput'; origin?: 'init' | 'chat'; params: InteractiveInputParams };

/**
 * 推理状态数据
 */
export interface ReasoningState {
  /** 推理步骤列表 */
  steps: Array<{
    id: string;
    index: number;
    order: number;
    content: string;
    title?: string;
    text: string;
    status: 'error' | 'pending' | 'running' | 'completed';
    raw?: JsonValue;
  }>;
  /** 总步骤数 */
  totalSteps?: number;
  /** 是否已完成 */
  finished?: boolean;
  /** 最后更新时间 */
  lastUpdatedAt?: number;
}

/**
 * FastGPT事件数据
 */
export interface FastGPTEvent {
  /** 事件类型 */
  type: string;
  /** 事件标签 */
  label: string;
  /** 事件级别 */
  level: 'info' | 'success' | 'warning' | 'error';
  /** 事件摘要 */
  summary?: string;
  /** 事件载荷 */
  payload?: JsonValue;
  /** 事件时间戳 */
  timestamp: string;
  /** 原始数据 */
  raw?: JsonValue;
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  /** 使用的模型 */
  model?: string;
  /** 消耗的令牌数 */
  tokens?: number;
  /** 提供商标识 */
  provider?: string;
  /** 关联的智能体ID */
  agentId?: string;
  /** 聊天会话ID */
  chatId?: string;
  /** 会话ID（别名，兼容性） */
  sessionId?: string;
  /** 消息ID */
  messageId?: string;
  /** 响应消息ID（用于反馈） */
  responseChatItemId?: string;
  /** 附件列表 */
  attachments?: AttachmentMetadata[];
  /** 语音笔记 */
  voiceNote?: VoiceNoteMetadata | null;
  /** 交互数据 */
  interactive?: InteractiveData;
  /** 推理状态 */
  reasoning?: ReasoningState;
  /** 事件列表 */
  events?: FastGPTEvent[];
  /** 消息来源 */
  source?: MessageSource;
  /** 创建时间戳 */
  createdAt?: number;
  /** 更新时间戳 */
  updatedAt?: number;
  /** 处理开始时间 */
  processingStartedAt?: number;
  /** 处理结束时间 */
  processingCompletedAt?: number;
  /** 响应时间（毫秒） */
  responseTime?: number;
  /** 成本信息 */
  cost?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    currency?: string;
    amount?: number;
  };
  /** 自定义元数据 */
  custom?: Record<string, JsonValue>;
}

/**
 * 标准消息格式（后端使用，遵循OpenAI格式）
 */
export interface StandardMessage {
  /** 消息唯一标识 */
  id: string;
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 消息时间戳 */
  timestamp: number;
  /** 消息状态 */
  status?: MessageStatus;
  /** 消息元数据 */
  metadata?: MessageMetadata;
  /** 附件列表 */
  attachments?: AttachmentMetadata[];
  /** 语音笔记 */
  voiceNote?: VoiceNoteMetadata | null;
  /** 父消息ID（用于回复关系） */
  parentMessageId?: string;
  /** 子消息ID列表 */
  childMessageIds?: string[];
  /** 是否已编辑 */
  isEdited?: boolean;
  /** 编辑时间戳 */
  editedAt?: number;
  /** 消息版本 */
  version?: number;
}

/**
 * 简化消息格式（前端使用，huihua.md格式）
 */
export interface SimpleMessage {
  /** AI回复内容 */
  AI?: string;
  /** 用户输入内容 */
  HUMAN?: string;
  /** 消息ID（用于反馈） */
  id?: string;
  /** 点赞/点踩反馈 */
  feedback?: FeedbackType;
  /** 消息时间戳 */
  timestamp?: number;
  /** 交互数据 */
  interactive?: InteractiveData;
  /** 推理状态 */
  reasoning?: ReasoningState;
  /** 事件列表 */
  events?: FastGPTEvent[];
  /** 附件列表 */
  attachments?: AttachmentMetadata[];
  /** 语音笔记 */
  voiceNote?: VoiceNoteMetadata | null;
  /** 消息状态 */
  status?: MessageStatus;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 消息对（用户-AI对话对）
 */
export interface MessagePair {
  /** 用户消息 */
  user: StandardMessage;
  /** AI助手消息 */
  assistant: StandardMessage;
  /** 对话ID */
  pairId: string;
  /** 创建时间 */
  createdAt: number;
  /** 是否完成 */
  isCompleted: boolean;
}

/**
 * 消息创建请求
 */
export interface CreateMessageRequest {
  /** 消息角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
  /** 关联的会话ID */
  sessionId: string;
  /** 关联的智能体ID */
  agentId: string;
  /** 父消息ID */
  parentMessageId?: string;
  /** 附件列表 */
  attachments?: AttachmentMetadata[];
  /** 语音笔记 */
  voiceNote?: VoiceNoteMetadata;
  /** 消息元数据 */
  metadata?: Partial<MessageMetadata>;
  /** 是否临时消息 */
  isTemporary?: boolean;
}

/**
 * 消息更新请求
 */
export interface UpdateMessageRequest {
  /** 消息内容 */
  content?: string;
  /** 消息状态 */
  status?: MessageStatus;
  /** 消息元数据 */
  metadata?: Partial<MessageMetadata>;
  /** 附件列表 */
  attachments?: AttachmentMetadata[];
  /** 语音笔记 */
  voiceNote?: VoiceNoteMetadata | null;
  /** 反馈类型 */
  feedback?: FeedbackType;
  /** 是否标记为已编辑 */
  markAsEdited?: boolean;
}

/**
 * 消息查询参数
 */
export interface MessageQueryParams {
  /** 会话ID */
  sessionId: string;
  /** 分页参数 */
  page?: number;
  pageSize?: number;
  /** 消息角色过滤 */
  role?: MessageRole[];
  /** 消息状态过滤 */
  status?: MessageStatus[];
  /** 消息来源过滤 */
  source?: MessageSource[];
  /** 开始时间 */
  startDate?: string;
  /** 结束时间 */
  endDate?: string;
  /** 搜索关键词 */
  search?: string;
  /** 是否包含附件 */
  hasAttachments?: boolean;
  /** 是否包含语音 */
  hasVoice?: boolean;
  /** 排序字段 */
  sortBy?: 'timestamp' | 'createdAt' | 'updatedAt' | 'tokens';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 消息搜索结果
 */
export interface MessageSearchResult {
  /** 消息列表 */
  messages: StandardMessage[];
  /** 总数量 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
  /** 搜索耗时 */
  searchTime: number;
  /** 高亮关键词 */
  highlights?: Array<{
    messageId: string;
    field: string;
    fragments: string[];
  }>;
}

/**
 * 消息批量操作请求
 */
export interface BatchMessageOperation {
  /** 操作类型 */
  operation: 'delete' | 'update' | 'export' | 'move';
  /** 消息ID列表 */
  messageIds: string[];
  /** 目标会话ID（用于move操作） */
  targetSessionId?: string;
  /** 更新数据（用于update操作） */
  updateData?: Partial<UpdateMessageRequest>;
  /** 导出格式（用于export操作） */
  exportFormat?: 'json' | 'csv' | 'txt';
  /** 操作原因 */
  reason?: string;
}

/**
 * 消息导出格式
 */
export interface MessageExportFormat {
  /** 导出版本 */
  version: string;
  /** 导出时间 */
  exportedAt: string;
  /** 会话信息 */
  sessionInfo: {
    sessionId: string;
    agentId: string;
    title: string;
  };
  /** 消息列表 */
  messages: (StandardMessage | SimpleMessage)[];
  /** 导出格式 */
  format: 'standard' | 'simple';
  /** 导出元数据 */
  metadata: {
    exportedBy?: string;
    totalMessages: number;
    totalTokens?: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 消息转换器接口
 */
export interface MessageConverter {
  /** 标准格式转简化格式 */
  toSimple(messages: StandardMessage[]): SimpleMessage[];
  /** 简化格式转标准格式 */
  toStandard(messages: SimpleMessage[], agentId: string, sessionId: string): StandardMessage[];
  /** 标准格式转消息对 */
  toPairs(messages: StandardMessage[]): MessagePair[];
  /** 消息对转标准格式 */
  fromPairs(pairs: MessagePair[]): StandardMessage[];
}

/**
 * 消息验证结果
 */
export interface MessageValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 警告列表 */
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 验证时间戳 */
  timestamp: string;
}

/**
 * 消息统计信息
 */
export interface MessageStatistics {
  /** 会话ID */
  sessionId: string;
  /** 总消息数 */
  totalMessages: number;
  /** 用户消息数 */
  userMessages: number;
  /** AI消息数 */
  aiMessages: number;
  /** 系统消息数 */
  systemMessages: number;
  /** 总令牌数 */
  totalTokens: number;
  /** 平均消息长度 */
  averageMessageLength: number;
  /** 附件总数 */
  totalAttachments: number;
  /** 语音消息数 */
  voiceMessages: number;
  /** 平均响应时间 */
  averageResponseTime?: number;
  /** 按日期分组的统计 */
  dailyStats?: Array<{
    date: string;
    messageCount: number;
    tokenCount: number;
    userMessages: number;
    aiMessages: number;
  }>;
}