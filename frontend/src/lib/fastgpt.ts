import {
  ChatMessage,
  ChatSession,
  FastGPTChatHistoryDetail,
  FastGPTChatHistoryMessage,
  FastGPTChatHistorySummary,
} from '@/types';

const coerceTimestamp = (value: string | number | Date | undefined): number => {
  if (!value) return Date.now();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

export const mapHistorySummaryToSession = (
  agentId: string,
  summary: FastGPTChatHistorySummary
): ChatSession => ({
  id: summary.chatId,
  title: summary.title || '未命名对话',
  agentId,
  messages: [],
  createdAt: coerceTimestamp(summary.createdAt),
  updatedAt: coerceTimestamp(summary.updatedAt || summary.createdAt),
});

const mapHistoryMessageToChatMessage = (message: FastGPTChatHistoryMessage): ChatMessage => {
  if (message.role === 'assistant') {
    return {
      AI: message.content,
      id: message.dataId || message.id,
      feedback: message.feedback ?? null,
    };
  }

  if (message.role === 'system') {
    return {
      AI: message.content,
      id: message.dataId || message.id,
    };
  }

  return {
    HUMAN: message.content,
    id: message.dataId || message.id,
  };
};

export const mapHistoryDetailToMessages = (
  detail: FastGPTChatHistoryDetail
): ChatMessage[] => {
  if (!detail?.messages || !Array.isArray(detail.messages)) {
    return [];
  }
  return detail.messages.map(mapHistoryMessageToChatMessage);
};

export const mergeHistoryDetailIntoSession = (
  session: ChatSession,
  detail: FastGPTChatHistoryDetail
): ChatSession => ({
  ...session,
  id: detail.chatId || session.id,
  title: detail.title || session.title,
  messages: mapHistoryDetailToMessages(detail),
  updatedAt: detail.metadata?.updatedAt ? coerceTimestamp(detail.metadata.updatedAt) : Date.now(),
});
