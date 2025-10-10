/**
 * 极致优化的流式响应处理器
 * 专注于优化流式响应性能，减少延迟和内存占用
 */

import { Response } from 'express';
import { performance } from 'perf_hooks';
import { Transform, TransformCallback } from 'stream';
import { once } from 'events';

import logger from '@/utils/logger';
import { memoryResourceManager } from '@/utils/MemoryResourceManager';
import { performanceOptimizer } from '@/utils/PerformanceOptimizer';

// 流式处理配置
const CHUNK_BUFFER_SIZE = 16 * 1024; // 16KB
const MAX_BUFFER_TIME = 100; // 100ms
const COMPRESSION_THRESHOLD = 512; // 512字节
const FLUSH_INTERVAL = 50; // 50ms

// 流式事件类型
interface StreamEvent {
  type: 'chunk' | 'status' | 'interactive' | 'chatId' | 'error' | 'complete' | 'end';
  data: any;
  timestamp: number;
  size?: number;
}

// 流式统计信息
interface StreamStats {
  totalChunks: number;
  totalSize: number;
  startTime: number;
  endTime?: number;
  averageChunkSize: number;
  throughput: number;
  errorCount: number;
}

/**
 * 流式数据缓冲器
 */
class StreamBuffer {
  private buffer: string[] = [];
  private size: number = 0;
  private lastFlush: number = 0;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly maxSize: number,
    private readonly maxTime: number,
    private readonly onFlush: (chunks: string[]) => void
  ) {}

  /**
   * 添加数据到缓冲区
   */
  add(chunk: string): void {
    this.buffer.push(chunk);
    this.size += Buffer.byteLength(chunk);

    // 检查是否需要立即刷新
    if (this.shouldFlush()) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * 检查是否应该刷新
   */
  private shouldFlush(): boolean {
    const now = performance.now();
    return (
      this.size >= this.maxSize ||
      (now - this.lastFlush) >= this.maxTime ||
      this.buffer.length >= 10
    );
  }

  /**
   * 安排延迟刷新
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, FLUSH_INTERVAL);
  }

  /**
   * 立即刷新缓冲区
   */
  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const chunks = [...this.buffer];
    this.buffer = [];
    this.size = 0;
    this.lastFlush = performance.now();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.onFlush(chunks);
  }

  /**
   * 强制刷新所有缓冲数据
   */
  flushAll(): void {
    this.flush();
  }

  /**
   * 获取缓冲区状态
   */
  getStats() {
    return {
      bufferSize: this.size,
      chunkCount: this.buffer.length,
      lastFlush: this.lastFlush,
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
    this.size = 0;
  }
}

/**
 * 极致优化的流式响应处理器
 */
export class OptimizedStreamProcessor {
  private static instance: OptimizedStreamProcessor;

  // 活跃流管理
  private activeStreams = new Map<string, {
    stats: StreamStats;
    buffer: StreamBuffer;
    lastActivity: number;
    cleanupTimer?: NodeJS.Timeout;
  }>();

  // 性能统计
  private globalStats = {
    totalStreams: 0,
    activeStreams: 0,
    averageLatency: 0,
    averageThroughput: 0,
    errorRate: 0,
    memoryUsage: 0,
  };

  // 配置
  private readonly maxStreamDuration = 30 * 60 * 1000; // 30分钟
  private readonly maxConcurrentStreams = 1000;

  private constructor() {
    // 定期清理超时的流
    setInterval(() => this.cleanupExpiredStreams(), 30 * 1000);

    // 定期更新统计信息
    setInterval(() => this.updateGlobalStats(), 10 * 1000);

    // 监控内存使用
    memoryResourceManager.start({
      cleanupInterval: 60 * 1000,
      enableMetrics: true,
    });
  }

  static getInstance(): OptimizedStreamProcessor {
    if (!OptimizedStreamProcessor.instance) {
      OptimizedStreamProcessor.instance = new OptimizedStreamProcessor();
    }
    return OptimizedStreamProcessor.instance;
  }

  /**
   * 创建优化的流式处理器
   */
  createStream(
    streamId: string,
    res: Response,
    options: {
      enableCompression?: boolean;
      enableMetrics?: boolean;
      bufferSize?: number;
      flushInterval?: number;
    } = {}
  ): {
    onChunk: (chunk: string) => void;
    onStatus: (status: any) => void;
    onEvent: (event: string, data: any) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
    end: () => void;
  } {
    const startTime = performance.now();

    // 检查并发限制
    if (this.activeStreams.size >= this.maxConcurrentStreams) {
      throw new Error(`达到最大并发流限制: ${this.maxConcurrentStreams}`);
    }

    this.globalStats.totalStreams++;
    this.globalStats.activeStreams++;

    // 设置SSE响应头
    this.setOptimizedSSEHeaders(res);

    // 创建统计信息
    const stats: StreamStats = {
      totalChunks: 0,
      totalSize: 0,
      startTime,
      averageChunkSize: 0,
      throughput: 0,
      errorCount: 0,
    };

    // 创建数据缓冲器
    const buffer = new StreamBuffer(
      options.bufferSize || CHUNK_BUFFER_SIZE,
      options.flushInterval || MAX_BUFFER_TIME,
      (chunks) => {
        // 批量发送数据块
        this.sendBatchedEvents(res, chunks, streamId);
      }
    );

    // 创建流上下文
    const streamContext = {
      stats,
      buffer,
      lastActivity: startTime,
    };

    this.activeStreams.set(streamId, streamContext);

    // 设置清理定时器
    streamContext.cleanupTimer = setTimeout(() => {
      this.cleanupStream(streamId);
    }, this.maxStreamDuration);

    logger.debug('创建优化流式处理器', {
      streamId,
      options,
      activeStreams: this.activeStreams.size,
    });

    return {
      onChunk: (chunk: string) => this.handleChunk(streamId, chunk, stats, buffer),
      onStatus: (status: any) => this.handleStatus(streamId, status, res, stats, streamContext),
      onEvent: (event: string, data: any) => this.handleEvent(streamId, event, data, res, stats, streamContext),
      onError: (error: Error) => this.handleError(streamId, error, res, stats, streamContext),
      onComplete: () => this.handleComplete(streamId, res, stats, streamContext),
      end: () => this.endStream(streamId, res, stats, streamContext),
    };
  }

  /**
   * 处理数据块
   */
  private handleChunk(
    streamId: string,
    chunk: string,
    stats: StreamStats,
    buffer: StreamBuffer
  ): void {
    try {
      stats.totalChunks++;
      stats.totalSize += Buffer.byteLength(chunk);

      // 添加到缓冲区
      buffer.add(chunk);

      // 更新平均块大小
      stats.averageChunkSize = stats.totalSize / stats.totalChunks;

      // 更新吞吐量
      const elapsed = performance.now() - stats.startTime;
      stats.throughput = (stats.totalSize / 1024) / (elapsed / 1000); // KB/s

      logger.debug('处理数据块', {
        streamId,
        chunkSize: Buffer.byteLength(chunk),
        totalChunks: stats.totalChunks,
        throughput: stats.throughput.toFixed(2),
      });

    } catch (error) {
      logger.error('处理数据块失败', {
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 处理状态更新
   */
  private handleStatus(
    streamId: string,
    status: any,
    res: Response,
    stats: StreamStats,
    streamContext: any
  ): void {
    try {
      const event: StreamEvent = {
        type: 'status',
        data: status,
        timestamp: Date.now(),
      };

      // 立即发送状态事件（不缓冲）
      this.sendEvent(res, event);

      // 如果是完成或错误状态，结束流
      if (status.type === 'complete' || status.type === 'error') {
        buffer.flushAll();
        this.endStream(streamId, res, stats, streamContext);
      }

      logger.debug('处理状态更新', {
        streamId,
        status: status.type,
        timestamp: event.timestamp,
      });

    } catch (error) {
      logger.error('处理状态更新失败', {
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 处理事件
   */
  private handleEvent(
    streamId: string,
    eventName: string,
    data: any,
    res: Response,
    stats: StreamStats,
    streamContext: any
  ): void {
    try {
      const event: StreamEvent = {
        type: eventName as any,
        data,
        timestamp: Date.now(),
        size: JSON.stringify(data).length,
      };

      // 重要事件立即发送，其他事件可以缓冲
      if (['interactive', 'chatId', 'error', 'complete'].includes(eventName)) {
        this.sendEvent(res, event);
      } else {
        const eventString = this.formatEvent(event);
        streamContext.buffer.add(eventString);
      }

      logger.debug('处理事件', {
        streamId,
        eventName,
        dataSize: event.size,
      });

    } catch (error) {
      logger.error('处理事件失败', {
        streamId,
        eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 处理错误
   */
  private handleError(
    streamId: string,
    error: Error,
    res: Response,
    stats: StreamStats,
    streamContext: any
  ): void {
    try {
      stats.errorCount++;
      this.globalStats.errorRate = (this.globalStats.errorRate * 9 + 1) / 10;

      const event: StreamEvent = {
        type: 'error',
        data: {
          code: 'STREAM_ERROR',
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        timestamp: Date.now(),
      };

      this.sendEvent(res, event);
      this.endStream(streamId, res, stats, streamContext);

      logger.error('流式处理错误', {
        streamId,
        error: error.message,
        stack: error.stack,
        errorCount: stats.errorCount,
      });

    } catch (err) {
      logger.error('处理流式错误失败', {
        streamId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * 处理完成
   */
  private handleComplete(
    streamId: string,
    res: Response,
    stats: StreamStats,
    streamContext: any
  ): void {
    try {
      stats.endTime = performance.now();
      this.globalStats.activeStreams--;

      // 计算最终统计
      const duration = stats.endTime - stats.startTime;
      stats.averageChunkSize = stats.totalSize / stats.totalChunks;
      stats.throughput = (stats.totalSize / 1024) / (duration / 1000);

      // 更新全局统计
      this.updateGlobalLatency(duration);
      this.updateGlobalThroughput(stats.throughput);

      const event: StreamEvent = {
        type: 'complete',
        data: {
          duration,
          totalChunks: stats.totalChunks,
          totalSize: stats.totalSize,
          averageChunkSize: stats.averageChunkSize,
          throughput: stats.throughput,
        },
        timestamp: Date.now(),
      };

      this.sendEvent(res, event);
      this.endStream(streamId, res, stats, streamContext);

      logger.info('流式处理完成', {
        streamId,
        duration,
        totalChunks: stats.totalChunks,
        totalSize: stats.totalSize,
        throughput: stats.throughput.toFixed(2),
      });

    } catch (error) {
      logger.error('处理流式完成失败', {
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 结束流
   */
  private endStream(
    streamId: string,
    res: Response,
    stats: StreamStats,
    streamContext: any
  ): void {
    try {
      // 确保所有缓冲数据都已发送
      streamContext.buffer.flushAll();

      // 发送结束事件
      const endEvent: StreamEvent = {
        type: 'end',
        data: {
          timestamp: Date.now(),
          finalStats: {
            duration: stats.endTime ? stats.endTime - stats.startTime : 0,
            totalChunks: stats.totalChunks,
            totalSize: stats.totalSize,
            errorCount: stats.errorCount,
          },
        },
        timestamp: Date.now(),
      };

      this.sendEvent(res, endEvent);

      // 结束响应
      if (!res.headersSent) {
        res.end();
      } else if (!res.destroyed) {
        res.end();
      }

      // 清理资源
      this.cleanupStream(streamId);

    } catch (error) {
      logger.error('结束流失败', {
        streamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 设置优化的SSE响应头
   */
  private setOptimizedSSEHeaders(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 性能优化头部
    res.setHeader('X-Stream-Optimized', 'true');
    res.setHeader('X-Processor-Version', '1.0');

    // 立即刷新头部
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }
  }

  /**
   * 格式化事件
   */
  private formatEvent(event: StreamEvent): string {
    const eventLine = `event: ${event.type}\n`;
    const dataLine = `data: ${JSON.stringify(event.data)}\n\n`;
    return eventLine + dataLine;
  }

  /**
   * 发送单个事件
   */
  private sendEvent(res: Response, event: StreamEvent): void {
    try {
      const eventData = this.formatEvent(event);
      res.write(eventData);
    } catch (error) {
      logger.error('发送事件失败', {
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 批量发送事件
   */
  private sendBatchedEvents(res: Response, chunks: string[], streamId: string): void {
    try {
      // 合并多个事件
      const batchData = chunks.join('');
      res.write(batchData);

      logger.debug('批量发送事件', {
        streamId,
        chunkCount: chunks.length,
        size: Buffer.byteLength(batchData),
      });

    } catch (error) {
      logger.error('批量发送事件失败', {
        streamId,
        chunkCount: chunks.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 清理过期的流
   */
  private cleanupExpiredStreams(): void {
    const now = Date.now();
    const expiredStreams: string[] = [];

    for (const [streamId, context] of this.activeStreams.entries()) {
      const elapsed = now - context.lastActivity;
      if (elapsed > this.maxStreamDuration) {
        expiredStreams.push(streamId);
      }
    }

    if (expiredStreams.length > 0) {
      logger.info('清理过期流', {
        expiredCount: expiredStreams.length,
        remainingStreams: this.activeStreams.size - expiredStreams.length,
      });

      expiredStreams.forEach(streamId => this.cleanupStream(streamId));
    }
  }

  /**
   * 清理流资源
   */
  private cleanupStream(streamId: string): void {
    const context = this.activeStreams.get(streamId);
    if (context) {
      // 清理缓冲区
      context.buffer.destroy();

      // 清理定时器
      if (context.cleanupTimer) {
        clearTimeout(context.cleanupTimer);
      }

      // 从活跃流中移除
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * 更新全局延迟统计
   */
  private updateGlobalLatency(duration: number): void {
    const alpha = 0.1;
    this.globalStats.averageLatency =
      this.globalStats.averageLatency * (1 - alpha) + (duration * alpha);
  }

  /**
   * 更新全局吞吐量统计
   */
  private updateGlobalThroughput(throughput: number): void {
    const alpha = 0.1;
    this.globalStats.averageThroughput =
      this.globalStats.averageThroughput * (1 - alpha) + (throughput * alpha);
  }

  /**
   * 更新全局统计信息
   */
  private updateGlobalStats(): void {
    try {
      // 获取内存使用情况
      const memoryUsage = memoryResourceManager.getMetrics();
      this.globalStats.memoryUsage = memoryUsage.heapUsed / (1024 * 1024); // MB

      // 计算错误率
      this.globalStats.errorRate = this.globalStats.activeStreams > 0
        ? this.globalStats.errorRate
        : this.globalStats.errorRate * 0.9; // 逐渐减少错误率

      logger.debug('流式处理器统计更新', {
        ...this.globalStats,
        memoryUsageMB: this.globalStats.memoryUsage,
      });

    } catch (error) {
      logger.error('更新全局统计失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    const activeStreamsStats = Array.from(this.activeStreams.entries()).map(([id, context]) => ({
      streamId: id,
      stats: context.stats,
      bufferStats: context.buffer.getStats(),
      duration: performance.now() - context.stats.startTime,
    }));

    return {
      global: this.globalStats,
      activeStreams: activeStreamsStats,
      memoryUsage: {
        total: this.globalStats.memoryUsage,
        perStream: this.globalStats.activeStreams > 0
          ? this.globalStats.memoryUsage / this.globalStats.activeStreams
          : 0,
      },
      limits: {
        maxConcurrentStreams: this.maxConcurrentStreams,
        maxStreamDuration: this.maxStreamDuration,
      },
    };
  }

  /**
   * 获取特定流的统计
   */
  getStreamStats(streamId: string) {
    const context = this.activeStreams.get(streamId);
    if (!context) {
      return null;
    }

    return {
      stats: context.stats,
      bufferStats: context.buffer.getStats(),
      duration: performance.now() - context.stats.startTime,
      isActive: true,
    };
  }

  /**
   * 强制结束所有流
   */
  forceEndAllStreams(): void {
    const streamIds = Array.from(this.activeStreams.keys());

    logger.warn('强制结束所有流', {
      streamCount: streamIds.length,
    });

    streamIds.forEach(streamId => {
      const context = this.activeStreams.get(streamId);
      if (context) {
        // 发送强制结束事件
        this.cleanupStream(streamId);
      }
    });
  }

  /**
   * 清理所有资源
   */
  cleanup(): void {
    // 强制结束所有流
    this.forceEndAllStreams();

    // 清理统计
    this.globalStats = {
      totalStreams: 0,
      activeStreams: 0,
      averageLatency: 0,
      averageThroughput: 0,
      errorRate: 0,
      memoryUsage: 0,
    };

    logger.info('流式处理器资源清理完成');
  }
}

// 导出单例实例
export const optimizedStreamProcessor = OptimizedStreamProcessor.getInstance();

// 导出工具函数
export const createOptimizedStream = (
  streamId: string,
  res: Response,
  options?: {
    enableCompression?: boolean;
    enableMetrics?: boolean;
    bufferSize?: number;
    flushInterval?: number;
  }
) => {
  return optimizedStreamProcessor.createStream(streamId, res, options);
};