import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';
import { translate } from '@/i18n';
import { logger } from '@/lib/logger';
import type { ApiSuccessPayload } from '@/types/dynamic';
import { requestMonitor } from '@/utils/performanceOptimizer';
import {
  Agent,
  OriginalChatMessage,
  ChatOptions,
  ChatResponse,
  ChatAttachmentMetadata,
  FastGPTChatHistorySummary,
  FastGPTChatHistoryDetail,

  ProductPreviewRequest,
  ProductPreviewResponse,

} from '@/types';
import type {
  SSECallbacks,
  SSEParsedEvent,
  FastGPTStatusData,
  FastGPTInteractiveData,
  FastGPTReasoningData,
} from '@/types/sse';
import {
  getNormalizedEventKey,
  isChatIdEvent,
  isChunkLikeEvent,
  isDatasetEvent,
  isEndEvent,
  isInteractiveEvent,
  isReasoningEvent,
  isStatusEvent,
  isSummaryEvent,
  isToolEvent,
  isUsageEvent,
} from '@/lib/fastgptEvents';

type ApiResponse<T> = ApiSuccessPayload<T>;

const debugLog = (...args: unknown[]) => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    logger.debug('[chatService]', { args });
  }
};

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Converts a Blob to a base64-encoded string by reading it as a data URL and returning the data portion.
 *
 * @param blob - The Blob or File to convert
 * @returns The base64-encoded data extracted from the Blob's data URL
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      } else {
        reject(new Error(translate('无法读取文件内容')));
      }
    };
    reader.onerror = () => reject(reader.error || new Error(translate('文件读取失败')));
    reader.readAsDataURL(blob);
  });
}

api.interceptors.request.use((config) => {
  // 🚀 性能监控：记录请求开始时间
  const requestId = `${config.method?.toUpperCase()}-${config.url}-${Date.now()}`;
  requestMonitor.startRequest(requestId);

  // 添加请求ID到header
  config.headers = config.headers || {};
  (config.headers as Record<string, string>)['X-Request-ID'] = requestId;

  const token = useAuthStore.getState().token;
  if (token) {
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // 🚀 性能监控：记录请求完成
    const requestId = response.config.headers?.['X-Request-ID'] as string;
    if (requestId) {
      requestMonitor.endRequest(requestId, response.config.method?.toUpperCase() || 'GET', response.status);
    }
    return response;
  },
  (error) => {
    // 🚀 性能监控：记录请求失败
    const requestId = error.config?.headers?.['X-Request-ID'] as string;
    if (requestId) {
      requestMonitor.endRequest(requestId, error.config?.method?.toUpperCase() || 'GET', error.response?.status || 0);
    }

    logger.error(translate('API请求错误'), error, {
      url: error?.config?.url,
      method: error?.config?.method,
      status: error?.response?.status,
    });
    const status = error?.response?.status;
    if (status === 401) {
      const { logout } = useAuthStore.getState();
      logout();
      toast({ type: 'warning', title: translate('登录状态已过期，请重新登录') });
      const target = window.location.pathname + (window.location.search || '');
      window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
      return Promise.reject(error);
    }
    if (error.code === 'ECONNABORTED' || (typeof error.message === 'string' && error.message.includes('timeout'))) {
      error.message = translate('请求超时，请检查网络连接');
    } else if (error.code === 'ERR_NETWORK') {
      error.message = translate('网络连接失败，请检查后端服务是否启动');
    }
    return Promise.reject(error);
  },
);

const findNextEventBoundary = (buffer: string): { index: number; length: number } | null => {
  const lfIndex = buffer.indexOf('\n\n');
  const crlfIndex = buffer.indexOf('\r\n\r\n');

  if (lfIndex === -1 && crlfIndex === -1) {
    return null;
  }

  if (lfIndex === -1) {
    return { index: crlfIndex, length: 4 };
  }

  if (crlfIndex === -1) {
    return { index: lfIndex, length: 2 };
  }

  return crlfIndex < lfIndex
    ? { index: crlfIndex, length: 4 }
    : { index: lfIndex, length: 2 };
};

const parseSSEEventBlock = (rawBlock: string): SSEParsedEvent | null => {
  const lines = rawBlock.split(/\r?\n/);
  let event = '';
  const dataLines: string[] = [];
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    switch (field) {
      case 'event':
        event = value.trim();
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        id = value.trim();
        break;
      case 'retry': {
        const parsedRetry = parseInt(value, 10);
        if (!Number.isNaN(parsedRetry)) {
          retry = parsedRetry;
        }
        break;
      }
      default:
        break;
    }
  }

  const data = dataLines.join('\n');
  if (!event && !data) {
    return null;
  }

  return { event, data, id, retry };
};

const extractReasoningPayload = (payload: Record<string, unknown> | string | null): string | null => {
  if (!payload || typeof payload === 'string') {
    return null;
  }

  const choices = payload.choices as Array<{ delta?: { reasoning_content?: string } }> | undefined;
  const delta = payload.delta as { reasoning_content?: string } | undefined;

  return (
    choices?.[0]?.delta?.reasoning_content ||
    delta?.reasoning_content ||
    (payload.reasoning_content as string) ||
    (payload.reasoning as string) ||
    null
  );
};

const resolveEventName = (eventName: string, payload: Record<string, unknown> | string | null): string => {
  if (!payload || typeof payload === 'string') {
    return eventName.trim();
  }
  const payloadEvent = payload.event;
  return (eventName || (typeof payloadEvent === 'string' ? payloadEvent : '') || '').trim();
};

const dispatchSSEEvent = (callbacks: SSECallbacks, incomingEvent: string, payload: Record<string, unknown> | string | null) => {
  const { onChunk, onStatus, onInteractive, onChatId, onReasoning, onEvent } = callbacks;
  const resolvedEvent = resolveEventName(incomingEvent, payload);
  const eventKey = getNormalizedEventKey(resolvedEvent || 'message');

  const emitReasoning = (data: FastGPTReasoningData | string | Record<string, unknown>, eventNameOverride?: string) => {
    if (!onReasoning || data == null) {
      return;
    }
    try {
      // 将字符串或对象转换为 FastGPTReasoningData 格式
      const reasoningData: FastGPTReasoningData = typeof data === 'string'
        ? { content: data }
        : typeof data === 'object' && 'content' in data
          ? data as FastGPTReasoningData
          : { content: JSON.stringify(data) };

      onReasoning({ event: eventNameOverride || resolvedEvent || 'reasoning', data: reasoningData });
    } catch (reasoningError) {
      logger.warn('reasoning 回调执行失败', { error: reasoningError });
    }
  };

  if (isChatIdEvent(resolvedEvent)) {
    const chatIdValue = typeof payload === 'string' ? payload :
      (payload && typeof payload === 'object' ?
        (payload).chatId ||
        (payload).id ||
        ((payload).data as Record<string, unknown> | undefined)?.chatId :
        null);
    if (typeof chatIdValue === 'string') {
      onChatId?.(chatIdValue);
    }
    onEvent?.('chatId', payload);
    return;
  }

  if (isInteractiveEvent(resolvedEvent) && payload && typeof payload === 'object') {
    onInteractive?.(payload as FastGPTInteractiveData);
    onEvent?.('interactive', payload);
    return;
  }

  if (isStatusEvent(resolvedEvent) && payload && typeof payload === 'object') {
    const payloadObj = payload;
    const rawStatus = payloadObj.status as string | undefined;
    // 将'loading'和'error'映射为StreamStatus支持的状态
    let mappedStatus: 'running' | 'completed' | 'error' = 'running';
    if (rawStatus === 'completed') {
      mappedStatus = 'completed';
    } else if (rawStatus === 'error' || rawStatus === 'failed') {
      mappedStatus = 'error';
    } else if (rawStatus === 'loading' || rawStatus === 'running') {
      mappedStatus = 'running';
    }

    const statusData: FastGPTStatusData = {
      type: 'flowNodeStatus',
      status: mappedStatus,
      message: payloadObj.message as string | undefined,
      moduleId: payloadObj.id as string | undefined,
      moduleName: (payloadObj.name || payloadObj.moduleName || payloadObj.id || translate('未知模块')) as string,
    };
    onStatus?.(statusData);
    onEvent?.(resolvedEvent || 'flowNodeStatus', payload);
    return;
  }

  if (eventKey === getNormalizedEventKey('flowResponses')) {
    const statusData: FastGPTStatusData = {
      type: 'progress',
      status: 'completed',
      message: '执行完成',
      moduleName: '执行完成',
    };
    onStatus?.(statusData);
    onEvent?.(resolvedEvent || 'flowResponses', payload);
    return;
  }

  if (eventKey === getNormalizedEventKey('answer')) {
    if (payload && typeof payload === 'object') {
      const payloadObj = payload;
      const choices = payloadObj.choices as Array<{ delta?: { content?: string } }> | undefined;
      const answerContent = choices?.[0]?.delta?.content || (payloadObj.content as string) || '';
      if (answerContent) {
        onChunk(answerContent);
      }
    }
    const reasoningContent = extractReasoningPayload(payload);
    if (reasoningContent) {
      emitReasoning(reasoningContent, 'reasoning');
    }
    onEvent?.('answer', payload);
    return;
  }

  if (isReasoningEvent(resolvedEvent)) {
    if (payload) {
      emitReasoning(payload, resolvedEvent || 'reasoning');
      onEvent?.('reasoning', { event: resolvedEvent || 'reasoning', data: payload });
    }
    return;
  }

  if (isDatasetEvent(resolvedEvent) || isSummaryEvent(resolvedEvent) || isToolEvent(resolvedEvent)) {
    onEvent?.(resolvedEvent || 'event', payload);
    return;
  }

  if (isUsageEvent(resolvedEvent)) {
    onEvent?.('usage', payload);
    return;
  }

  if (isEndEvent(resolvedEvent)) {
    const statusData: FastGPTStatusData = {
      type: 'complete',
      status: 'completed',
      moduleName: 'complete',
    };
    onStatus?.(statusData);
    onEvent?.(resolvedEvent || 'end', payload);
    return;
  }

  const reasoningContent = extractReasoningPayload(payload);

  if (!resolvedEvent || isChunkLikeEvent(resolvedEvent)) {
    let chunkContent = '';
    if (typeof payload === 'string') {
      chunkContent = payload;
    } else if (payload && typeof payload === 'object') {
      const payloadObj = payload;
      const choices = payloadObj.choices as Array<{ delta?: { content?: string } }> | undefined;
      chunkContent = (payloadObj.content as string) || choices?.[0]?.delta?.content || '';
    }

    if (chunkContent) {
      onChunk(chunkContent);
    }
    if (reasoningContent) {
      emitReasoning(reasoningContent, resolvedEvent || 'reasoning');
    }
    if (resolvedEvent && !isChunkLikeEvent(resolvedEvent)) {
      onEvent?.(resolvedEvent, payload);
    }
    return;
  }

  if (typeof payload === 'string') {
    if (payload) {
      onChunk(payload);
    }
    if (reasoningContent) {
      emitReasoning(reasoningContent, resolvedEvent || 'reasoning');
    }
    onEvent?.(resolvedEvent, payload);
    return;
  }

  if (payload && typeof payload === 'object') {
    const payloadObj = payload;
    const choices = payloadObj.choices as Array<{ delta?: { content?: string } }> | undefined;
    const fallbackContent = (payloadObj.content as string) || choices?.[0]?.delta?.content;
    if (fallbackContent) {
      onChunk(fallbackContent);
    }
  }
  if (reasoningContent) {
    emitReasoning(reasoningContent, resolvedEvent || 'reasoning');
  }
  onEvent?.(resolvedEvent, payload);
};

const consumeChatSSEStream = async (response: Response, callbacks: SSECallbacks): Promise<void> => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  const flushEventBlock = (rawBlock: string) => {
    const parsed = parseSSEEventBlock(rawBlock.replace(/\r/g, ''));
    if (!parsed || typeof parsed.data !== 'string') {
      return;
    }

    const trimmed = parsed.data.trim();
    if (!trimmed) {
      return;
    }

    if (trimmed === '[DONE]') {
      if (!completed) {
        completed = true;
        callbacks.onStatus?.({ type: 'complete', status: 'completed' });
        callbacks.onEvent?.('end', { done: true });
      }
      return;
    }

    let payload: Record<string, unknown> | string | null = parsed.data;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        payload = JSON.parse(parsed.data) as Record<string, unknown>;
      } catch (error) {
        logger.warn('解析 SSE 数据失败', { error, rawData: parsed.data });
        payload = parsed.data;
      }
    }

    dispatchSSEEvent(callbacks, parsed.event, payload);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let boundary: { index: number; length: number } | null;
      while ((boundary = findNextEventBoundary(buffer)) !== null) {
        const rawBlock = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);

        if (rawBlock.trim().length === 0) {
          continue;
        }

        flushEventBlock(rawBlock);
      }
    }

    if (buffer.trim().length > 0) {
      flushEventBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }
};

export const agentService = {
  async getAgents(): Promise<Agent[]> {
    const response = await api.get<ApiResponse<Agent[]>>('/agents');
    return response.data.data;
  },

  async getAgent(id: string): Promise<Agent> {
    const response = await api.get<ApiResponse<Agent>>(`/agents/${id}`);
    return response.data.data;
  },

  async checkAgentStatus(id: string) {
    debugLog('检查智能体状态', id);
    try {
      const response = await api.get<ApiResponse<any>>(`/agents/${id}/status`);
      debugLog('智能体状态响应', response.data);
      return response.data.data;
    } catch (error) {
      logger.error(translate('检查智能体状态失败'), error as Error, { agentId: id });
      throw error;
    }
  },
};

export const chatService = {
  async sendMessage(
    agentId: string,
    messages: OriginalChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const { attachments, voiceNote, ...restOptions } = options || {};
    const response = await api.post<ApiResponse<ChatResponse>>('/chat/completions', {
      agentId,
      messages,
      stream: false,
      ...(restOptions.chatId ? { chatId: restOptions.chatId } : {}),
      ...(typeof restOptions.detail === 'boolean' ? { detail: restOptions.detail } : {}),
      ...(typeof restOptions.temperature === 'number' ? { temperature: restOptions.temperature } : {}),
      ...(typeof restOptions.maxTokens === 'number' ? { maxTokens: restOptions.maxTokens } : {}),
      ...(restOptions.variables ? { variables: restOptions.variables } : {}),
      ...(restOptions.responseChatItemId ? { responseChatItemId: restOptions.responseChatItemId } : {}),
      ...(attachments?.length ? { attachments } : {}),
      ...(voiceNote ? { voiceNote } : {}),
    });
    return response.data.data;
  },

  async sendStreamMessage(
    agentId: string,
    messages: OriginalChatMessage[],
    callbacks: SSECallbacks & { signal?: AbortSignal },
    options?: ChatOptions,
  ): Promise<void> {
    const { onChunk, onStatus, onInteractive, onChatId, onReasoning, onEvent, signal } = callbacks;
    const { attachments, voiceNote, ...restOptions } = options || {};

    const payload = {
      agentId,
      messages,
      stream: true,
      ...(restOptions.chatId ? { chatId: restOptions.chatId } : {}),
      ...(typeof restOptions.detail === 'boolean' ? { detail: restOptions.detail } : {}),
      ...(typeof restOptions.temperature === 'number' ? { temperature: restOptions.temperature } : {}),
      ...(typeof restOptions.maxTokens === 'number' ? { maxTokens: restOptions.maxTokens } : {}),
      ...(restOptions.variables ? { variables: restOptions.variables } : {}),
      ...(restOptions.responseChatItemId ? { responseChatItemId: restOptions.responseChatItemId } : {}),
      ...(attachments?.length ? { attachments } : {}),
      ...(voiceNote ? { voiceNote } : {}),
    };

    const authToken = useAuthStore.getState().token;
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: translate('登录状态已过期，请重新登录') });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
      const errorText = await response.text();
      logger.error('Stream request failed', new Error(errorText), {
        status: response.status,
        agentId,
        messagesCount: messages.length,
      });
      throw new Error(`Stream request failed: ${response.status} ${errorText}`);
    }

    await consumeChatSSEStream(response, {
      onChunk,
      onStatus,
      onInteractive,
      onChatId,
      onReasoning,
      onEvent,
    });
  },

  async init(agentId: string, chatId?: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>('/chat/init', {
      params: {
        appId: agentId,
        ...(chatId ? { chatId } : {}),
        stream: false,
      },
    });
    return response.data.data;
  },

  async initStream(
    agentId: string,
    chatId: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete?: (data: Record<string, unknown>) => void,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    const search = new URLSearchParams({ appId: agentId, stream: 'true' });
    if (chatId) {
      search.set('chatId', chatId);
    }

    const authToken = useAuthStore.getState().token;
    const response = await fetch(`/api/chat/init?${search.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      signal: opts?.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: translate('登录状态已过期，请重新登录') });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
      const errorText = await response.text();
      logger.error('Init stream request failed', new Error(errorText), {
        status: response.status,
        agentId,
        chatId,
      });
      throw new Error(`Init stream request failed: ${response.status} ${errorText}`);
    }

    await consumeChatSSEStream(response, {
      onChunk,
      onEvent: (eventName, payload) => {
        if (eventName === 'complete') {
          onComplete?.((payload as any)?.data ?? payload);
        }
        if (eventName === 'end' && payload && typeof payload === 'object' && 'data' in payload) {
          onComplete?.((payload as any).data);
        }
      },
      onChatId: (value) => {
        onComplete?.({ chatId: value });
      },
    });
  },

  async updateUserFeedback(
    agentId: string,
    chatId: string,
    dataId: string,
    type: 'good' | 'bad',
    cancel: boolean = false,
  ): Promise<void> {
    try {
      const payload: Record<string, any> = {
        agentId,
        chatId,
        dataId,
        ...(type === 'good' && !cancel ? { userGoodFeedback: 'yes' } : {}),
        ...(type === 'bad' && !cancel ? { userBadFeedback: 'yes' } : {}),
      };
      await api.post('/chat/feedback', payload);
    } catch (error) {
      logger.error(translate('提交点赞/点踩反馈失败'), error as Error, {
        dataId,
        feedbackType: type,
      });
      throw error;
    }
  },

  async listHistories(agentId: string): Promise<FastGPTChatHistorySummary[]> {
    const response = await api.get<ApiResponse<FastGPTChatHistorySummary[]>>('/chat/history', { params: { agentId } });
    return response.data.data;
  },

  async getHistoryDetail(agentId: string, chatId: string): Promise<FastGPTChatHistoryDetail> {
    const response = await api.get<ApiResponse<FastGPTChatHistoryDetail>>(`/chat/history/${chatId}`, { params: { agentId } });
    return response.data.data;
  },

  async deleteHistory(agentId: string, chatId: string): Promise<void> {
    await api.delete(`/chat/history/${chatId}`, { params: { agentId } });
  },

  async clearHistories(agentId: string): Promise<void> {
    await api.delete('/chat/history', { params: { agentId } });
  },

  async retryMessage(
    agentId: string,
    chatId: string,
    dataId: string,
    options?: { detail?: boolean },
  ): Promise<ChatResponse> {
    const payload: Record<string, any> = {
      agentId,
      dataId,
      stream: false,
    };

    if (typeof options?.detail === 'boolean') {
      payload.detail = options.detail;
    }

    const response = await api.post<ApiResponse<ChatResponse>>(`/chat/history/${chatId}/retry`, payload);
    return response.data.data;
  },

  async retryStreamMessage(
    agentId: string,
    chatId: string,
    dataId: string,
    callbacks: SSECallbacks,
    options?: { detail?: boolean },
  ): Promise<void> {
    const { onChunk, onStatus, onInteractive, onChatId, onReasoning, onEvent } = callbacks;
    const authToken = useAuthStore.getState().token;
    const payload: Record<string, unknown> = {
      agentId,
      dataId,
      stream: true,
    };

    if (typeof options?.detail === 'boolean') {
      payload.detail = options.detail;
    }

    const response = await fetch(`/api/chat/history/${chatId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Retry stream request failed', new Error(errorText), {
        status: response.status,
        agentId,
        chatId,
        dataId,
      });
      throw new Error(`Retry stream request failed: ${response.status} ${errorText}`);
    }

    await consumeChatSSEStream(response, {
      onChunk,
      onStatus,
      onInteractive,
      onChatId,
      onReasoning,
      onEvent,
    });
  },

};

export const productPreviewService = {
  async generatePreview(payload: ProductPreviewRequest): Promise<ProductPreviewResponse> {
    const response = await api.post<ApiResponse<ProductPreviewResponse>>('/product-preview/generate', payload);
    return response.data.data;
  },

};

/**
 * Uploads a file or blob as a chat attachment and returns its stored metadata.
 *
 * @param file - The File or Blob to upload.
 * @param opts - Optional upload settings.
 * @param opts.source - Origin of the attachment; `'upload'` or `'voice'`. Defaults to `'upload'`.
 * @param opts.filename - Optional filename to use instead of the file's name.
 * @returns The uploaded attachment's metadata
 */
export async function uploadAttachment(
  file: File | Blob,
  opts?: { source?: 'upload' | 'voice'; filename?: string },
): Promise<ChatAttachmentMetadata> {
  const base64 = await blobToBase64(file);
  const name = opts?.filename || ('name' in file ? (file).name : 'attachment');
  const mimeType = 'type' in file && file.type ? file.type : 'application/octet-stream';
  const size = 'size' in file && typeof file.size === 'number' ? file.size : base64.length * 0.75;

  const { data } = await api.post<ApiResponse<ChatAttachmentMetadata>>(
    '/chat/attachments',
    {
      filename: name,
      mimeType,
      size,
      data: base64,
      source: opts?.source ?? 'upload',
    },
  );

  return data.data;
}
