/**
 * SSE (Server-Sent Events) 完整类型定义系统
 * 
 * 本文件定义了所有SSE事件的强类型接口，消除any类型使用
 * 支持FastGPT、OpenAI、Anthropic等多种提供商的流式响应
 * 
 * @module shared-types/sse-events
 */

import type { JsonValue } from './index';

// ============================================================================
// 基础SSE事件类型
// ============================================================================

/**
 * SSE事件类型枚举
 */
export type SSEEventType =
  | 'chunk'        // 文本块
  | 'end'          // 流结束
  | 'error'        // 错误
  | 'status'       // 状态更新
  | 'interactive'  // 交互请求
  | 'reasoning'    // 推理步骤
  | 'chatId'       // 会话ID
  | 'dataset'      // 数据集引用
  | 'summary'      // 摘要
  | 'tool'         // 工具调用
  | 'usage'        // Token使用统计
  | 'progress'     // 进度更新
  | 'complete';    // 完成

/**
 * SSE事件基础接口
 */
export interface SSEEventBase {
  /** 事件类型 */
  event: SSEEventType;
  /** 时间戳 (ISO 8601) */
  timestamp: string;
}

// ============================================================================
// 文本块事件 (Chunk)
// ============================================================================

/**
 * 文本块事件 - 流式响应的主要内容
 */
export interface SSEChunkEvent extends SSEEventBase {
  event: 'chunk';
  data: {
    /** 文本内容 */
    content: string;
    /** 角色 */
    role: 'assistant' | 'user' | 'system';
    /** 增量内容 (可选) */
    delta?: string;
    /** 是否完成 */
    finished?: boolean;
  };
}

// ============================================================================
// 状态更新事件 (Status)
// ============================================================================

/**
 * 状态类型
 */
export type StatusType =
  | 'flowNodeStatus'  // 流程节点状态
  | 'progress'        // 进度
  | 'error'           // 错误
  | 'complete'        // 完成
  | 'processing'      // 处理中
  | 'waiting';        // 等待中

/**
 * 状态更新事件 - FastGPT工作流状态
 */
export interface SSEStatusEvent extends SSEEventBase {
  event: 'status';
  data: {
    /** 状态类型 */
    type: StatusType;
    /** 状态值 */
    status: 'running' | 'completed' | 'failed' | 'waiting';
    /** 模块名称 */
    moduleName?: string;
    /** 节点名称 */
    name?: string;
    /** 状态消息 */
    message?: string;
    /** 进度百分比 (0-100) */
    progress?: number;
    /** 总步骤数 */
    totalSteps?: number;
    /** 当前步骤 */
    currentStep?: number;
    /** 原始数据 */
    raw?: JsonValue;
  };
}

// ============================================================================
// 推理步骤事件 (Reasoning)
// ============================================================================

/**
 * 推理步骤事件 - AI思考过程
 */
export interface SSEReasoningEvent extends SSEEventBase {
  event: 'reasoning';
  data: {
    /** 推理内容 */
    content: string;
    /** 步骤序号 */
    step?: number;
    /** 总步骤数 */
    totalSteps?: number;
    /** 标题 */
    title?: string;
    /** 思考内容 */
    thought?: string;
    /** 行动 */
    action?: string;
    /** 观察结果 */
    observation?: string;
    /** 是否完成 */
    finished?: boolean;
    /** 是否需要下一步 */
    nextThoughtNeeded?: boolean;
    /** 原始数据 */
    raw?: JsonValue;
  };
}

// ============================================================================
// 交互事件 (Interactive)
// ============================================================================

/**
 * 交互类型
 */
export type InteractiveType =
  | 'input_required'    // 需要输入
  | 'confirmation'      // 需要确认
  | 'selection'         // 需要选择
  | 'file_upload'       // 需要上传文件
  | 'custom';           // 自定义交互

/**
 * 交互事件 - 需要用户输入
 */
export interface SSEInteractiveEvent extends SSEEventBase {
  event: 'interactive';
  data: {
    /** 交互类型 */
    type: InteractiveType;
    /** 提示信息 */
    prompt: string;
    /** 描述 */
    description?: string;
    /** 选项列表 (用于selection类型) */
    options?: Array<{
      label: string;
      value: string;
      description?: string;
    }>;
    /** 默认值 */
    defaultValue?: string;
    /** 是否必填 */
    required?: boolean;
    /** 输入验证规则 */
    validation?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
      message?: string;
    };
    /** 原始数据 */
    raw?: JsonValue;
  };
}

// ============================================================================
// 错误事件 (Error)
// ============================================================================

/**
 * 错误事件
 */
export interface SSEErrorEvent extends SSEEventBase {
  event: 'error';
  data: {
    /** 错误码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 错误详情 */
    details?: string;
    /** 错误类型 */
    type?: 'validation' | 'authentication' | 'authorization' | 'external' | 'internal';
    /** 是否可重试 */
    retryable?: boolean;
    /** 建议操作 */
    suggestion?: string;
    /** 原始错误 */
    originalError?: JsonValue;
  };
}

// ============================================================================
// 结束事件 (End)
// ============================================================================

/**
 * 结束原因
 */
export type EndReason =
  | 'completed'    // 正常完成
  | 'stopped'      // 用户停止
  | 'error'        // 错误终止
  | 'timeout'      // 超时
  | 'length'       // 达到长度限制
  | 'content_filter'; // 内容过滤

/**
 * 结束事件
 */
export interface SSEEndEvent extends SSEEventBase {
  event: 'end';
  data: {
    /** 结束原因 */
    reason: EndReason;
    /** 总Token数 */
    totalTokens?: number;
    /** 提示Token数 */
    promptTokens?: number;
    /** 完成Token数 */
    completionTokens?: number;
    /** 成本 */
    cost?: number;
    /** 持续时间 (毫秒) */
    duration?: number;
    /** 完成消息 */
    message?: string;
  };
}

// ============================================================================
// 会话ID事件 (ChatId)
// ============================================================================

/**
 * 会话ID事件 - FastGPT特有
 */
export interface SSEChatIdEvent extends SSEEventBase {
  event: 'chatId';
  data: {
    /** 会话ID */
    chatId: string;
    /** 应用ID */
    appId?: string;
    /** 流程ID */
    flowId?: string;
  };
}

// ============================================================================
// 数据集引用事件 (Dataset)
// ============================================================================

/**
 * 数据集引用事件 - FastGPT知识库引用
 */
export interface SSEDatasetEvent extends SSEEventBase {
  event: 'dataset';
  data: {
    /** 数据集ID */
    datasetId: string;
    /** 数据集名称 */
    datasetName?: string;
    /** 引用的文档 */
    documents?: Array<{
      id: string;
      title: string;
      content: string;
      score?: number;
    }>;
    /** 相似度分数 */
    score?: number;
  };
}

// ============================================================================
// 摘要事件 (Summary)
// ============================================================================

/**
 * 摘要事件
 */
export interface SSESummaryEvent extends SSEEventBase {
  event: 'summary';
  data: {
    /** 摘要内容 */
    content: string;
    /** 摘要类型 */
    type?: 'conversation' | 'document' | 'query';
    /** 关键词 */
    keywords?: string[];
    /** 主题 */
    topics?: string[];
  };
}

// ============================================================================
// 工具调用事件 (Tool)
// ============================================================================

/**
 * 工具调用事件
 */
export interface SSEToolEvent extends SSEEventBase {
  event: 'tool';
  data: {
    /** 工具名称 */
    name: string;
    /** 工具描述 */
    description?: string;
    /** 输入参数 */
    input?: JsonValue;
    /** 输出结果 */
    output?: JsonValue;
    /** 状态 */
    status: 'calling' | 'success' | 'failed';
    /** 错误信息 */
    error?: string;
    /** 执行时间 (毫秒) */
    duration?: number;
  };
}

// ============================================================================
// Token使用统计事件 (Usage)
// ============================================================================

/**
 * Token使用统计事件
 */
export interface SSEUsageEvent extends SSEEventBase {
  event: 'usage';
  data: {
    /** 提示Token数 */
    promptTokens: number;
    /** 完成Token数 */
    completionTokens: number;
    /** 总Token数 */
    totalTokens: number;
    /** 成本 (美元) */
    cost?: number;
    /** 模型名称 */
    model?: string;
  };
}

// ============================================================================
// 进度更新事件 (Progress)
// ============================================================================

/**
 * 进度更新事件
 */
export interface SSEProgressEvent extends SSEEventBase {
  event: 'progress';
  data: {
    /** 当前步骤 */
    current: number;
    /** 总步骤数 */
    total: number;
    /** 百分比 (0-100) */
    percentage: number;
    /** 当前任务描述 */
    message?: string;
    /** 预计剩余时间 (秒) */
    estimatedTimeRemaining?: number;
  };
}

// ============================================================================
// 完成事件 (Complete)
// ============================================================================

/**
 * 完成事件
 */
export interface SSECompleteEvent extends SSEEventBase {
  event: 'complete';
  data: {
    /** 完成消息 */
    message?: string;
    /** 最终结果 */
    result?: JsonValue;
    /** 统计信息 */
    stats?: {
      totalTokens?: number;
      duration?: number;
      cost?: number;
    };
  };
}

// ============================================================================
// SSE事件联合类型
// ============================================================================

/**
 * 所有SSE事件的联合类型
 */
export type SSEEvent =
  | SSEChunkEvent
  | SSEStatusEvent
  | SSEReasoningEvent
  | SSEInteractiveEvent
  | SSEErrorEvent
  | SSEEndEvent
  | SSEChatIdEvent
  | SSEDatasetEvent
  | SSESummaryEvent
  | SSEToolEvent
  | SSEUsageEvent
  | SSEProgressEvent
  | SSECompleteEvent;

// ============================================================================
// SSE回调接口
// ============================================================================

/**
 * SSE事件处理器类型
 */
export interface SSEEventHandlers {
  /** 文本块回调 */
  onChunk?: (event: SSEChunkEvent) => void;
  /** 状态更新回调 */
  onStatus?: (event: SSEStatusEvent) => void;
  /** 推理步骤回调 */
  onReasoning?: (event: SSEReasoningEvent) => void;
  /** 交互请求回调 */
  onInteractive?: (event: SSEInteractiveEvent) => void;
  /** 错误回调 */
  onError?: (event: SSEErrorEvent) => void;
  /** 结束回调 */
  onEnd?: (event: SSEEndEvent) => void;
  /** 会话ID回调 */
  onChatId?: (event: SSEChatIdEvent) => void;
  /** 数据集引用回调 */
  onDataset?: (event: SSEDatasetEvent) => void;
  /** 摘要回调 */
  onSummary?: (event: SSESummaryEvent) => void;
  /** 工具调用回调 */
  onTool?: (event: SSEToolEvent) => void;
  /** Token使用回调 */
  onUsage?: (event: SSEUsageEvent) => void;
  /** 进度更新回调 */
  onProgress?: (event: SSEProgressEvent) => void;
  /** 完成回调 */
  onComplete?: (event: SSECompleteEvent) => void;
  /** 通用事件回调 */
  onEvent?: (event: SSEEvent) => void;
}

// ============================================================================
// 兼容性类型 (向后兼容)
// ============================================================================

/**
 * FastGPT状态数据 (向后兼容)
 * @deprecated 使用 SSEStatusEvent['data'] 替代
 */
export type FastGPTStatusData = SSEStatusEvent['data'];

/**
 * FastGPT交互数据 (向后兼容)
 * @deprecated 使用 SSEInteractiveEvent['data'] 替代
 */
export type FastGPTInteractiveData = SSEInteractiveEvent['data'];

/**
 * FastGPT推理数据 (向后兼容)
 * @deprecated 使用 SSEReasoningEvent['data'] 替代
 */
export type FastGPTReasoningData = SSEReasoningEvent['data'];

/**
 * FastGPT会话ID数据 (向后兼容)
 * @deprecated 使用 SSEChatIdEvent['data'] 替代
 */
export type FastGPTChatIdData = SSEChatIdEvent['data'];

/**
 * FastGPT数据集数据 (向后兼容)
 * @deprecated 使用 SSEDatasetEvent['data'] 替代
 */
export type FastGPTDatasetData = SSEDatasetEvent['data'];

/**
 * FastGPT摘要数据 (向后兼容)
 * @deprecated 使用 SSESummaryEvent['data'] 替代
 */
export type FastGPTSummaryData = SSESummaryEvent['data'];

/**
 * FastGPT工具数据 (向后兼容)
 * @deprecated 使用 SSEToolEvent['data'] 替代
 */
export type FastGPTToolData = SSEToolEvent['data'];

/**
 * FastGPT使用统计数据 (向后兼容)
 * @deprecated 使用 SSEUsageEvent['data'] 替代
 */
export type FastGPTUsageData = SSEUsageEvent['data'];

/**
 * SSE回调接口 (向后兼容)
 * @deprecated 使用 SSEEventHandlers 替代
 */
export interface SSECallbacks {
  onChunk: (chunk: string) => void;
  onStatus?: (status: FastGPTStatusData) => void;
  onInteractive?: (data: FastGPTInteractiveData) => void;
  onReasoning?: (data: { event: string; data: FastGPTReasoningData }) => void;
  onChatId?: (chatId: string) => void;
  onEvent?: (eventName: string, data: JsonValue) => void;
}

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 检查是否为文本块事件
 */
export function isChunkEvent(event: SSEEvent): event is SSEChunkEvent {
  return event.event === 'chunk';
}

/**
 * 检查是否为状态事件
 */
export function isStatusEvent(event: SSEEvent): event is SSEStatusEvent {
  return event.event === 'status';
}

/**
 * 检查是否为推理事件
 */
export function isReasoningEvent(event: SSEEvent): event is SSEReasoningEvent {
  return event.event === 'reasoning';
}

/**
 * 检查是否为交互事件
 */
export function isInteractiveEvent(event: SSEEvent): event is SSEInteractiveEvent {
  return event.event === 'interactive';
}

/**
 * 检查是否为错误事件
 */
export function isErrorEvent(event: SSEEvent): event is SSEErrorEvent {
  return event.event === 'error';
}

/**
 * 检查是否为结束事件
 */
export function isEndEvent(event: SSEEvent): event is SSEEndEvent {
  return event.event === 'end';
}

/**
 * 检查是否为会话ID事件
 */
export function isChatIdEvent(event: SSEEvent): event is SSEChatIdEvent {
  return event.event === 'chatId';
}

/**
 * 检查是否为工具调用事件
 */
export function isToolEvent(event: SSEEvent): event is SSEToolEvent {
  return event.event === 'tool';
}

/**
 * 检查是否为Token使用事件
 */
export function isUsageEvent(event: SSEEvent): event is SSEUsageEvent {
  return event.event === 'usage';
}
