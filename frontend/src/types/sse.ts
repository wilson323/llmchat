/**
 * SSE (Server-Sent Events) 类型定义
 * 用于消除API层的any类型使用
 * 
 * @deprecated 此文件已被 shared-types/sse-events.ts 替代
 * 为保持向后兼容，暂时保留此文件并重新导出新类型
 */

// 从 @llmchat/shared-types 导入新的类型定义
import type {
  SSEEventType as NewSSEEventType,
  SSEInteractiveEvent,
  SSEReasoningEvent,
} from '@llmchat/shared-types';

/**
 * SSE事件类型
 */
export type SSEEventType = NewSSEEventType;

/**
 * FastGPT状态更新数据
 * 完全兼容StreamStatus接口
 */
export interface FastGPTStatusData {
  type: 'flowNodeStatus' | 'progress' | 'error' | 'complete';
  status: 'running' | 'completed' | 'error';
  message?: string;
  moduleId?: string;
  moduleName?: string;
  name?: string;
  duration?: number;
  progress?: number;
  totalSteps?: number;
  currentStep?: number;
  error?: string;
}

/**
 * FastGPT交互数据
 */
export type FastGPTInteractiveData = SSEInteractiveEvent['data'];

/**
 * FastGPT推理步骤数据
 */
export type FastGPTReasoningData = SSEReasoningEvent['data'];

/**
 * FastGPT ChatId数据
 */
export interface FastGPTChatIdData {
  chatId: string;
  appId?: string;
}

/**
 * FastGPT数据集引用数据
 */
export interface FastGPTDatasetData {
  datasetId: string;
  datasetName?: string;
  score?: number;
  content?: string;
}

/**
 * FastGPT摘要数据
 */
export interface FastGPTSummaryData {
  summary: string;
  keywords?: string[];
}

/**
 * FastGPT工具调用数据
 */
export interface FastGPTToolData {
  toolName: string;
  toolParams?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  status?: 'pending' | 'running' | 'success' | 'error';
  error?: string;
}

/**
 * FastGPT使用量数据
 */
export interface FastGPTUsageData {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

/**
 * SSE事件数据联合类型
 */
export type SSEEventData =
  | string // chunk
  | FastGPTStatusData // status
  | FastGPTInteractiveData // interactive
  | FastGPTReasoningData // reasoning
  | FastGPTChatIdData // chatId
  | FastGPTDatasetData // dataset
  | FastGPTSummaryData // summary
  | FastGPTToolData // tool
  | FastGPTUsageData // usage
  | Record<string, unknown> // 其他未知事件
  | null; // end event

/**
 * SSE回调接口
 */
export interface SSECallbacks {
  onChunk: (chunk: string) => void;
  onStatus?: (status: FastGPTStatusData) => void;
  onInteractive?: (data: FastGPTInteractiveData) => void;
  onChatId?: (chatId: string) => void;
  onReasoning?: (event: { event?: string; data: FastGPTReasoningData }) => void;
  onEvent?: (eventName: string, data: SSEEventData) => void;
}

/**
 * 解析后的SSE事件
 */
export interface SSEParsedEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * SSE错误数据
 */
export interface SSEErrorData {
  code?: string;
  message: string;
  details?: Record<string, unknown>;
}
