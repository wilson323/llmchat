/**
 * useOptimizedChat - Performance-optimized chat hook
 *
 * Features:
 * 1. Message batching and deduplication
 * 2. Intelligent caching with TTL
 * 3. Memory-efficient message management
 * 4. Performance monitoring for chat operations
 * 5. Optimized scrolling and virtualization
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '@/types';
import { useChatStore } from '@/store/chatStore';
import { usePerformanceMonitor, memoryMonitor } from '@/utils/performanceOptimizer';

interface OptimizedChatOptions {
  maxMessagesInMemory?: number;
  cacheTimeout?: number;
  batchSize?: number;
  enableScrollOptimization?: boolean;
  enablePerformanceMonitoring?: boolean;
}

interface ChatMetrics {
  totalMessages: number;
  averageMessageSize: number;
  scrollEventsCount: number;
  renderCount: number;
  cacheHitRate: number;
  memoryUsage: number;
}

/**
 * Message cache with TTL support
 */
class MessageCache {
  private cache = new Map<string, { message: ChatMessage; timestamp: number }>();
  private ttl: number;

  constructor(ttl: number = 300000) { // 5 minutes default
    this.ttl = ttl;
  }

  get(key: string): ChatMessage | null {
    const item = this.cache.get(key);
    if (!item) {
return null;
}

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.message;
  }

  set(key: string, message: ChatMessage): void {
    this.cache.set(key, {
      message: { ...message }, // Deep copy to prevent mutations
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, item] of entries) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Message batch processor for efficient updates
 */
class MessageBatchProcessor {
  private batch: ChatMessage[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private onBatchComplete: (messages: ChatMessage[]) => void;
  private batchSize: number;
  private batchDelay: number;

  constructor(onBatchComplete: (messages: ChatMessage[]) => void, batchSize: number = 10, batchDelay: number = 100) {
    this.onBatchComplete = onBatchComplete;
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
  }

  addMessage(message: ChatMessage): void {
    this.batch.push(message);

    if (this.batch.length >= this.batchSize) {
      this.flushBatch();
    } else {
      this.scheduleBatchFlush();
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimeout) {
return;
}

    this.batchTimeout = setTimeout(() => {
      this.flushBatch();
    }, this.batchDelay);
  }

  private flushBatch(): void {
    if (this.batch.length === 0) {
return;
}

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const messages = [...this.batch];
    this.batch = [];
    this.onBatchComplete(messages);
  }

  forceFlush(): void {
    this.flushBatch();
  }
}

/**
 * Main optimized chat hook
 */
export function useOptimizedChat({
  maxMessagesInMemory = 1000,
  cacheTimeout = 300000,
  batchSize = 10,
  enableScrollOptimization = true,
  enablePerformanceMonitoring = true,
}: OptimizedChatOptions = {}) {
  // Performance monitoring
  if (enablePerformanceMonitoring) {
    usePerformanceMonitor('useOptimizedChat');
  }

  const {
    messages,
    currentAgent,
    streamingStatus,
    addMessage,
  } = useChatStore.getState();

  // Local state for optimization
  const [isScrolling, setIsScrolling] = useState(false);
  const [metrics, setMetrics] = useState({
    totalMessages: 0,
    averageMessageSize: 0,
    scrollEventsCount: 0,
    renderCount: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
  });

  // Refs for optimization
  const messageCache = useRef(new MessageCache(cacheTimeout));
  const batchProcessor = useRef(
    new MessageBatchProcessor((batch) => {
      batch.forEach(msg => addMessage(msg));
    }, batchSize),
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized message list with memory management
  const optimizedMessages = useMemo(() => {
    const messageList = messages;

    // Limit messages in memory for performance
    if (messageList.length > maxMessagesInMemory) {
      return messageList.slice(-maxMessagesInMemory);
    }

    return messageList;
  }, [messages, maxMessagesInMemory]);

  // Cache hit tracking
  const cacheHits = useRef(0);
  const cacheMisses = useRef(0);

  // Optimized message addition with caching
  const addOptimizedMessage = useCallback((message: ChatMessage): void => {
    const messageKey = `${message.id || Date.now()}-${message.AI || message.HUMAN || ''}`;

    // Check cache first
    const cachedMessage = messageCache.current.get(messageKey);
    if (cachedMessage) {
      cacheHits.current++;
      return;
    }

    cacheMisses.current++;
    messageCache.current.set(messageKey, message);

    // Use batch processor for better performance
    batchProcessor.current.addMessage(message);
  }, []);

  // Optimized message update
  const updateOptimizedMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    const updatedMessage = { id: messageId, ...updates };
    const messageKey = `${messageId}-${updates.AI || updates.HUMAN || ''}`;

    // Update cache
    messageCache.current.set(messageKey, updatedMessage as ChatMessage);

    // Update store (implementation needed)
    // updateMessage(messageId, updates);
  }, []);

  // Scroll optimization
  const handleScroll = useCallback(() => {
    if (!enableScrollOptimization) {
return;
}

    setIsScrolling(true);
    setMetrics((prev: ChatMetrics) => ({ ...prev, scrollEventsCount: prev.scrollEventsCount + 1 }));

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set new timeout for scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, [enableScrollOptimization]);

  // Scroll to bottom with optimization
  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollContainerRef.current) {
return;
}

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    });
  }, []);

  // Performance metrics calculation
  const updateMetrics = useCallback(() => {
    const messageList = optimizedMessages;
    const totalMessages = messageList.length;
    const averageMessageSize = totalMessages > 0
      ? messageList.reduce((acc: number, msg: ChatMessage) => acc + JSON.stringify(msg).length, 0) / totalMessages
      : 0;

    const totalCacheRequests = cacheHits.current + cacheMisses.current;
    const cacheHitRate = totalCacheRequests > 0 ? (cacheHits.current / totalCacheRequests) * 100 : 0;

    const memoryUsage = memoryMonitor.getCurrentUsage().heapUsed;

    setMetrics((prev: ChatMetrics) => ({
      ...prev,
      totalMessages,
      averageMessageSize,
      cacheHitRate,
      memoryUsage,
      renderCount: prev.renderCount + 1,
    }));
  }, [optimizedMessages]);

  // Set up metrics interval
  useEffect(() => {
    if (!enablePerformanceMonitoring) {
return;
}

    metricsIntervalRef.current = setInterval(updateMetrics, 2000);
    updateMetrics(); // Initial update

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [enablePerformanceMonitoring, updateMetrics]);

  // Cleanup cache periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      messageCache.current.cleanup();
    }, 60000); // Cleanup every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  // Force batch flush on unmount
  useEffect(() => {
    return () => {
      batchProcessor.current.forceFlush();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, []);

  // 添加缺失的函数
  const selectAgent = useCallback((agentId: string) => {
    // 实现选择智能体的逻辑
    console.log('选择智能体:', agentId);
  }, []);

  const clearHistory = useCallback(() => {
    // 实现清除历史的逻辑
    console.log('清除聊天历史');
  }, []);

  // Memoized return object for performance
  const result = useMemo(() => ({
    // State
    messages: optimizedMessages,
    currentAgent,
    streamingStatus,
    isScrolling,
    metrics,

    // Actions
    addMessage: addOptimizedMessage,
    updateMessage: updateOptimizedMessage,
    selectAgent,
    clearHistory,
    scrollToBottom,

    // Refs
    scrollContainerRef,
    handleScroll,

    // Utility methods
    clearCache: () => messageCache.current.clear(),
    forceBatchFlush: () => batchProcessor.current.forceFlush(),
    getCacheStats: () => ({
      size: messageCache.current.size(),
      hits: cacheHits.current,
      misses: cacheMisses.current,
      hitRate: cacheHits.current + cacheMisses.current > 0
        ? (cacheHits.current / (cacheHits.current + cacheMisses.current)) * 100
        : 0,
    }),
  }), [
    optimizedMessages,
    currentAgent,
    streamingStatus,
    isScrolling,
    metrics,
    addOptimizedMessage,
    updateOptimizedMessage,
    selectAgent,
    clearHistory,
    scrollToBottom,
    handleScroll,
  ]);

  return result;
}

/**
 * Hook for optimizing message rendering
 */
export function useMessageRenderOptimization(messages: ChatMessage[]) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Memoize message groups for better performance
  const messageGroups = useMemo(() => {
    const groups: { [key: string]: ChatMessage[] } = {};
    const today = new Date().toDateString();

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp || Date.now()).toDateString();
      const groupKey = messageDate === today ? 'Today' : messageDate;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(message);
    });

    return groups;
  }, [messages]);

  // Memoize message statistics
  const messageStats = useMemo(() => {
    const totalMessages = messages.length;
    const userMessages = messages.filter(m => m.HUMAN !== undefined).length;
    const aiMessages = messages.filter(m => m.AI !== undefined).length;
    const totalChars = messages.reduce((acc, m) => acc + (m.AI || m.HUMAN || '').length, 0);
    const avgCharsPerMessage = totalMessages > 0 ? totalChars / totalMessages : 0;

    return {
      totalMessages,
      userMessages,
      aiMessages,
      totalChars,
      avgCharsPerMessage,
    };
  }, [messages]);

  return {
    messageGroups,
    messageStats,
    visibleRange,
    setVisibleRange,
  };
}

export default useOptimizedChat;