import React, { useEffect, useRef } from "react";
import { ChatMessage } from "@/types";
import { MessageItem } from "./MessageItem";
import { useChatStore } from "@/store/chatStore";
import { useI18n } from "@/i18n";
import { useVirtualScroll } from "@/hooks/useVirtualScroll";
import { memoryMonitor } from "@/utils/memoryMonitor";

interface VirtualizedMessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onInteractiveSelect?: (value: any) => void;
  onInteractiveFormSubmit?: (values: any) => void;
  onRetryMessage?: (messageId: string) => void;
}

// 估算消息高度的函数
const estimateMessageHeight = (message: ChatMessage): number => {
  // 基础高度
  let height = 80;

  // 根据内容长度估算
  const content = message.AI || message.HUMAN || "";
  const contentLength = content.length;

  // 每行大约50个字符
  const estimatedLines = Math.ceil(contentLength / 50);
  height += estimatedLines * 24; // 每行24px

  // 如果有交互元素，增加高度
  if (message.interactive) {
    height += 120;
  }

  // 如果有推理步骤，增加高度
  if (message.reasoning?.steps?.length) {
    height += message.reasoning.steps.length * 40;
  }

  // 如果有事件，增加高度
  if (message.events?.length) {
    height += message.events.length * 30;
  }

  // 确保最小高度
  return Math.max(height, 80);
};

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  isStreaming = false,
  onInteractiveSelect,
  onInteractiveFormSubmit,
  onRetryMessage,
}) => {
  const { currentAgent, streamingStatus } = useChatStore();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // 记录消息数量变化时的内存使用
  useEffect(() => {
    if (import.meta.env?.DEV) {
      memoryMonitor.recordMeasurement(`虚拟列表渲染 ${messages.length} 条消息`);
    }
  }, [messages.length]);

  // 计算容器高度（考虑流式消息的特殊处理）
  const containerHeight =
    typeof window !== "undefined" ? window.innerHeight - 200 : 600;

  // 使用虚拟滚动
  const { virtualItems, totalHeight, scrollToIndex } = useVirtualScroll({
    itemHeight: (index) => estimateMessageHeight(messages[index]),
    containerHeight,
    itemCount: messages.length,
    overscan: 3,
  });

  // 自动滚动到底部
  useEffect(() => {
    if (isStreaming || messages.length === 0) return;

    // 如果是最后一条消息，滚动到底部
    if (messages.length > 0) {
      scrollToIndex(messages.length - 1);
    }
  }, [messages.length, isStreaming, scrollToIndex]);

  // 监听流式消息，自动滚动到底部
  useEffect(() => {
    if (isStreaming) {
      scrollToIndex(messages.length - 1);
    }
  }, [isStreaming, messages.length, scrollToIndex]);

  return (
    <div
      className="h-full overflow-y-auto bg-background"
      role="main"
      aria-label={t("聊天消息区域")}
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="max-w-4xl mx-auto px-4 py-6" ref={containerRef}>
        <div style={{ height: totalHeight, position: "relative" }}>
          {virtualItems.map((virtualItem) => {
            const message = messages[virtualItem.index];
            const isLastMessage = virtualItem.index === messages.length - 1;
            const isAssistantMessage = message.AI !== undefined;

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: virtualItem.start,
                  left: 0,
                  right: 0,
                  height: virtualItem.size,
                }}
                role="article"
                aria-label={isAssistantMessage ? t("AI回复") : t("用户消息")}
              >
                <MessageItem
                  message={message}
                  isStreaming={
                    isStreaming && isLastMessage && isAssistantMessage
                  }
                  currentAgent={currentAgent ?? undefined}
                  streamingStatus={streamingStatus ?? undefined}
                  onInteractiveSelect={onInteractiveSelect}
                  onInteractiveFormSubmit={onInteractiveFormSubmit}
                  onRetry={
                    message.id ? () => onRetryMessage?.(message.id!) : undefined
                  }
                />

                {/* 最后一个消息的占位元素 */}
                {isLastMessage && (
                  <div
                    ref={lastMessageRef}
                    className="h-1"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 流式状态指示器 */}
        {isStreaming &&
          (!currentAgent || currentAgent.provider !== "fastgpt") && (
            <div className="flex justify-start sticky bottom-0">
              <div className="flex items-center space-x-2 px-4 py-2 bg-background/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <div
                    className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("正在生成回答...")}
                </span>

                {streamingStatus?.type === "flowNodeStatus" && (
                  <span className="text-xs text-muted-foreground ml-3">
                    {streamingStatus.moduleName || t("未知模块")} -{" "}
                    {streamingStatus.status === "completed"
                      ? t("已完成")
                      : streamingStatus.status === "error"
                      ? t("错误")
                      : t("运行中")}
                  </span>
                )}
              </div>
            </div>
          )}

        {/* 底部留白 */}
        <div className="h-20" />
      </div>
    </div>
  );
};
