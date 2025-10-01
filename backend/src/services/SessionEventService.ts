import { randomUUID } from 'crypto';
import {
  SessionEvent,
  SessionEventType,
  EventQueryParams,
  PaginatedResponse
} from '@/types';

/**
 * 会话事件追踪服务
 * 负责记录、存储和查询会话相关的事件
 */
export class SessionEventService {
  private events: Map<string, SessionEvent[]> = new Map();
  private maxEventsPerAgent = 10000; // 每个智能体最大事件数量

  /**
   * 记录会话事件
   */
  async recordEvent(
    agentId: string,
    sessionId: string,
    eventType: SessionEventType,
    metadata?: {
      oldData?: any;
      newData?: any;
      reason?: string;
      feedbackType?: 'good' | 'bad';
      feedbackValue?: string;
      tags?: string[];
      exportFormat?: string;
      [key: string]: any;
    },
    context?: {
      userId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<SessionEvent> {
    const event: SessionEvent = {
      id: randomUUID(),
      sessionId,
      agentId,
      eventType,
      timestamp: new Date().toISOString(),
      ...(context?.userId && { userId: context.userId }),
      ...(metadata && { metadata }),
      ...(context?.userAgent && { userAgent: context.userAgent }),
      ...(context?.ipAddress && { ipAddress: context.ipAddress }),
    };

    // 存储事件（内存存储，实际生产环境应使用数据库）
    if (!this.events.has(agentId)) {
      this.events.set(agentId, []);
    }

    const agentEvents = this.events.get(agentId)!;
    agentEvents.push(event);

    // 限制事件数量，防止内存溢出
    if (agentEvents.length > this.maxEventsPerAgent) {
      const excessCount = agentEvents.length - this.maxEventsPerAgent;
      agentEvents.splice(0, excessCount);
    }

    console.log(`[事件记录] Agent: ${agentId}, Session: ${sessionId}, Type: ${eventType}`);

    return event;
  }

  /**
   * 查询会话事件
   */
  async queryEvents(
    agentId: string,
    params: EventQueryParams
  ): Promise<PaginatedResponse<SessionEvent>> {
    let agentEvents = this.events.get(agentId) || [];

    // 过滤条件
    if (params.sessionIds && params.sessionIds.length > 0) {
      agentEvents = agentEvents.filter(event =>
        params.sessionIds!.includes(event.sessionId)
      );
    }

    if (params.eventTypes && params.eventTypes.length > 0) {
      agentEvents = agentEvents.filter(event =>
        params.eventTypes!.includes(event.eventType)
      );
    }

    if (params.startDate) {
      const startDate = new Date(params.startDate);
      agentEvents = agentEvents.filter(event =>
        new Date(event.timestamp) >= startDate
      );
    }

    if (params.endDate) {
      const endDate = new Date(params.endDate);
      agentEvents = agentEvents.filter(event =>
        new Date(event.timestamp) <= endDate
      );
    }

    if (params.userId) {
      agentEvents = agentEvents.filter(event =>
        event.userId === params.userId
      );
    }

    // 排序
    const sortBy = params.sortBy || 'timestamp';
    const sortOrder = params.sortOrder || 'desc';

    agentEvents.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
          break;
        default:
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // 分页
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = agentEvents.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: agentEvents.length,
      page,
      pageSize,
      totalPages: Math.ceil(agentEvents.length / pageSize),
      hasNext: endIndex < agentEvents.length,
      hasPrev: page > 1,
    };
  }

  /**
   * 获取会话的所有事件
   */
  async getSessionEvents(
    agentId: string,
    sessionId: string
  ): Promise<SessionEvent[]> {
    const agentEvents = this.events.get(agentId) || [];
    return agentEvents
      .filter(event => event.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * 获取事件统计信息
   */
  async getEventStats(
    agentId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalEvents: number;
    eventTypeStats: Array<{ type: SessionEventType; count: number }>;
    dailyActivity: Array<{ date: string; count: number }>;
    topSessions: Array<{ sessionId: string; eventCount: number }>;
    userActivity: Array<{ userId?: string; eventCount: number }>;
  }> {
    let agentEvents = this.events.get(agentId) || [];

    // 日期范围过滤
    if (dateRange) {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);

      agentEvents = agentEvents.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    // 事件类型统计
    const eventTypeStats = new Map<SessionEventType, number>();
    agentEvents.forEach(event => {
      eventTypeStats.set(event.eventType, (eventTypeStats.get(event.eventType) || 0) + 1);
    });

    // 每日活动统计
    const dailyActivity = new Map<string, number>();
    agentEvents.forEach(event => {
      const date = event.timestamp.split('T')[0];
      if (date) {
        dailyActivity.set(date, (dailyActivity.get(date) || 0) + 1);
      }
    });

    // 会话活动统计
    const sessionActivity = new Map<string, number>();
    agentEvents.forEach(event => {
      sessionActivity.set(event.sessionId, (sessionActivity.get(event.sessionId) || 0) + 1);
    });

    // 用户活动统计
    const userActivity = new Map<string | undefined, number>();
    agentEvents.forEach(event => {
      userActivity.set(event.userId, (userActivity.get(event.userId) || 0) + 1);
    });

    return {
      totalEvents: agentEvents.length,
      eventTypeStats: Array.from(eventTypeStats.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      dailyActivity: Array.from(dailyActivity.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30),
      topSessions: Array.from(sessionActivity.entries())
        .map(([sessionId, eventCount]) => ({ sessionId, eventCount }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10),
      userActivity: Array.from(userActivity.entries())
        .map(([userId, eventCount]) => {
          const userActivityData: any = { eventCount };
          if (userId) {
            userActivityData.userId = userId;
          }
          return userActivityData;
        })
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10),
    };
  }

  /**
   * 清理旧事件（防止内存溢出）
   */
  async cleanupOldEvents(agentId: string, olderThanDays: number = 30): Promise<number> {
    const agentEvents = this.events.get(agentId) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const originalCount = agentEvents.length;
    const filteredEvents = agentEvents.filter((event: SessionEvent) =>
      new Date(event.timestamp) >= cutoffDate
    );

    this.events.set(agentId, filteredEvents);
    const deletedCount = originalCount - filteredEvents.length;

    if (deletedCount > 0) {
      console.log(`清理旧事件: Agent ${agentId}, 删除 ${deletedCount} 个事件`);
    }

    return deletedCount;
  }

  /**
   * 批量删除事件
   */
  async deleteEvents(
    agentId: string,
    eventIds: string[]
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const agentEvents = this.events.get(agentId) || [];
    const results = { success: 0, failed: 0, errors: [] as string[] };

    const originalLength = agentEvents.length;

    // 过滤掉要删除的事件
    const remainingEvents = agentEvents.filter((event: SessionEvent) => {
      if (eventIds.includes(event.id)) {
        results.success++;
        return false;
      }
      return true;
    });

    this.events.set(agentId, remainingEvents);
    results.failed = eventIds.length - results.success;

    if (results.failed > 0) {
      results.errors.push(`${results.failed} 个事件未找到`);
    }

    return results;
  }

  /**
   * 导出事件数据
   */
  async exportEvents(
    agentId: string,
    params: EventQueryParams & { format: 'json' | 'csv' }
  ): Promise<{ filename: string; data: string }> {
    const result = await this.queryEvents(agentId, params);
    const events = result.data;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (params.format === 'json') {
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          totalEvents: events.length,
          agentId,
          filters: params
        },
        events
      };

      return {
        filename: `events_${agentId}_${timestamp}.json`,
        data: JSON.stringify(exportData, null, 2)
      };
    } else {
      // CSV格式
      const headers = [
        'Event ID',
        'Session ID',
        'Event Type',
        'Timestamp',
        'User ID',
        'User Agent',
        'IP Address',
        'Metadata'
      ];

      const csvRows = [headers.join(',')];

      events.forEach((event: SessionEvent) => {
        const row = [
          `"${event.id}"`,
          `"${event.sessionId}"`,
          `"${event.eventType}"`,
          event.timestamp,
          event.userId || '',
          `"${this.escapeCsv(event.userAgent || '')}"`,
          `"${event.ipAddress || ''}"`,
          `"${this.escapeCsv(JSON.stringify(event.metadata || {}))}"`
        ];
        csvRows.push(row.join(','));
      });

      return {
        filename: `events_${agentId}_${timestamp}.csv`,
        data: csvRows.join('\n')
      };
    }
  }

  /**
   * 转义CSV字段
   */
  private escapeCsv(field: string): string {
    return field.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  /**
   * 获取实时事件流（用于WebSocket或SSE）
   */
  async getEventStream(
    agentId: string,
    params: {
      sessionIds?: string[];
      eventTypes?: SessionEventType[];
      since?: string;
    } = {}
  ): Promise<AsyncIterable<SessionEvent>> {
    const since = params.since ? new Date(params.since) : new Date(Date.now() - 60000); // 默认最近1分钟

    // 这里应该实现实时事件流
    // 当前返回一个模拟的异步可迭代对象
    const agentEvents = this.events.get(agentId) || [];

    const filteredEvents = agentEvents.filter(event => {
      const eventDate = new Date(event.timestamp);

      if (eventDate < since) return false;
      if (params.sessionIds && !params.sessionIds.includes(event.sessionId)) return false;
      if (params.eventTypes && !params.eventTypes.includes(event.eventType)) return false;

      return true;
    });

    return {
      [Symbol.asyncIterator]() {
        let index = 0;
        return {
          async next(): Promise<IteratorResult<SessionEvent, any>> {
            if (index < filteredEvents.length) {
              const event = filteredEvents[index++];
              if (event) {
                return { value: event, done: false };
              }
            }
            return { value: undefined, done: true };
          }
        };
      }
    };
  }
}