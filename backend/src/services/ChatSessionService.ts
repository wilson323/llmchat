/**
 * 聊天会话服务
 * 提供会话CRUD、消息管理、搜索功能
 * 
 * 功能：
 * - 创建/获取/更新/删除会话
 * - 添加消息到会话
 * - 全文搜索会话
 * - 会话归档和软删除
 */

import { getPool } from '@/utils/db';
import logger from '@/utils/logger';

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 聊天会话接口
 */
export interface ChatSession {
  id: string;
  userId: number;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  context?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  messageCount: number;
  tokenUsage: number;
  avgResponseTime: number;
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

/**
 * 创建会话参数
 */
export interface CreateSessionParams {
  userId: number;
  agentId: string;
  title?: string;
  context?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

/**
 * 聊天会话服务类
 */
export class ChatSessionService {
  /**
   * 创建新会话
   * 
   * @param params - 会话创建参数
   * @returns 新创建的会话
   */
  async createSession(params: CreateSessionParams): Promise<ChatSession> {
    const { userId, agentId, title = '新对话', context, settings } = params;

    try {
      const result = await getPool().query(
        `INSERT INTO chat_sessions 
         (user_id, agent_id, title) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [userId, agentId, title]
      );

      const session = this.mapRowToSession(result.rows[0]);
      
      logger.info('ChatSession created', {
        sessionId: session.id,
        userId,
        agentId,
        title,
      });

      return session;
    } catch (err) {
      logger.error('Failed to create chat session', {
        error: (err as Error).message,
        userId,
        agentId,
      });
      throw new Error(`Failed to create chat session: ${(err as Error).message}`);
    }
  }

  /**
   * 获取用户的所有会话
   * 
   * @param userId - 用户ID
   * @param agentId - 可选：智能体ID（过滤）
   * @returns 会话列表
   */
  async getUserSessions(userId: number, agentId?: string): Promise<ChatSession[]> {
    try {
      const query = agentId
        ? `SELECT * FROM chat_sessions 
           WHERE user_id = $1 AND agent_id = $2 AND status = 'active'
           ORDER BY updated_at DESC`
        : `SELECT * FROM chat_sessions 
           WHERE user_id = $1 AND status = 'active'
           ORDER BY updated_at DESC`;

      const params = agentId ? [userId, agentId] : [userId];
      const result = await getPool().query(query, params);

      return result.rows.map(row => this.mapRowToSession(row));
    } catch (err) {
      logger.error('Failed to get user sessions', {
        error: (err as Error).message,
        userId,
        agentId,
      });
      throw new Error(`Failed to fetch sessions: ${(err as Error).message}`);
    }
  }

  /**
   * 获取单个会话
   * 
   * @param sessionId - 会话ID
   * @param userId - 用户ID（权限验证）
   * @returns 会话详情
   */
  async getSession(sessionId: string, userId: number): Promise<ChatSession | null> {
    try {
      const result = await getPool().query(
        `SELECT * FROM chat_sessions 
         WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSession(result.rows[0]);
    } catch (err) {
      logger.error('Failed to get session', {
        error: (err as Error).message,
        sessionId,
        userId,
      });
      throw new Error(`Failed to get session: ${(err as Error).message}`);
    }
  }

  /**
   * 添加消息到会话
   * 
   * @param sessionId - 会话ID
   * @param message - 消息内容
   */
  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      await getPool().query(
        `UPDATE chat_sessions 
         SET messages = messages || $1::jsonb,
             message_count = message_count + 1,
             last_message_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(message), sessionId]
      );

      logger.debug('Message added to session', {
        sessionId,
        role: message.role,
        contentLength: message.content.length,
      });
    } catch (err) {
      logger.error('Failed to add message', {
        error: (err as Error).message,
        sessionId,
      });
      throw new Error(`Failed to add message: ${(err as Error).message}`);
    }
  }

  /**
   * 批量添加消息（性能优化）
   * 
   * @param sessionId - 会话ID
   * @param messages - 消息数组
   */
  async addMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    try {
      const messagesJson = JSON.stringify(messages);
      await getPool().query(
        `UPDATE chat_sessions 
         SET messages = messages || $1::jsonb,
             message_count = message_count + $2,
             last_message_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [messagesJson, messages.length, sessionId]
      );

      logger.debug('Messages batch added to session', {
        sessionId,
        count: messages.length,
      });
    } catch (err) {
      logger.error('Failed to add messages batch', {
        error: (err as Error).message,
        sessionId,
        count: messages.length,
      });
      throw new Error(`Failed to add messages: ${(err as Error).message}`);
    }
  }

  /**
   * 更新会话标题
   * 
   * @param sessionId - 会话ID
   * @param userId - 用户ID（权限验证）
   * @param title - 新标题
   */
  async updateSessionTitle(sessionId: string, userId: number, title: string): Promise<void> {
    try {
      const result = await getPool().query(
        `UPDATE chat_sessions 
         SET title = $1 
         WHERE id = $2 AND user_id = $3
         RETURNING id`,
        [title, sessionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found or access denied');
      }

      logger.info('Session title updated', {
        sessionId,
        userId,
        title,
      });
    } catch (err) {
      logger.error('Failed to update session title', {
        error: (err as Error).message,
        sessionId,
        userId,
      });
      throw new Error(`Failed to update session: ${(err as Error).message}`);
    }
  }

  /**
   * 删除会话（软删除）
   * 
   * @param sessionId - 会话ID
   * @param userId - 用户ID（权限验证）
   */
  async deleteSession(sessionId: string, userId: number): Promise<void> {
    try {
      const result = await getPool().query(
        `UPDATE chat_sessions 
         SET status = 'deleted' 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [sessionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found or access denied');
      }

      logger.info('Session deleted', {
        sessionId,
        userId,
      });
    } catch (err) {
      logger.error('Failed to delete session', {
        error: (err as Error).message,
        sessionId,
        userId,
      });
      throw new Error(`Failed to delete session: ${(err as Error).message}`);
    }
  }

  /**
   * 归档会话
   * 
   * @param sessionId - 会话ID
   * @param userId - 用户ID（权限验证）
   */
  async archiveSession(sessionId: string, userId: number): Promise<void> {
    try {
      const result = await getPool().query(
        `UPDATE chat_sessions 
         SET status = 'archived' 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [sessionId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Session not found or access denied');
      }

      logger.info('Session archived', {
        sessionId,
        userId,
      });
    } catch (err) {
      logger.error('Failed to archive session', {
        error: (err as Error).message,
        sessionId,
        userId,
      });
      throw new Error(`Failed to archive session: ${(err as Error).message}`);
    }
  }

  /**
   * 全文搜索会话
   * 
   * @param userId - 用户ID
   * @param query - 搜索关键词
   * @param limit - 返回结果数量限制
   * @returns 搜索结果（按相关性排序）
   */
  async searchSessions(userId: number, query: string, limit = 20): Promise<ChatSession[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const result = await getPool().query(
        `SELECT *, 
         ts_rank(search_vector, plainto_tsquery('english', $2)) as rank
         FROM chat_sessions
         WHERE user_id = $1
           AND status = 'active'
           AND search_vector @@ plainto_tsquery('english', $2)
         ORDER BY rank DESC, updated_at DESC
         LIMIT $3`,
        [userId, query, limit]
      );

      logger.info('Sessions searched', {
        userId,
        query,
        results: result.rows.length,
      });

      return result.rows.map(row => this.mapRowToSession(row));
    } catch (err) {
      logger.error('Failed to search sessions', {
        error: (err as Error).message,
        userId,
        query,
      });
      throw new Error(`Failed to search sessions: ${(err as Error).message}`);
    }
  }

  /**
   * 更新会话统计信息
   * 
   * @param sessionId - 会话ID
   * @param stats - 统计信息
   */
  async updateSessionStats(
    sessionId: string,
    stats: {
      tokenUsage?: number;
      avgResponseTime?: number;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (stats.tokenUsage !== undefined) {
      updates.push(`token_usage = token_usage + $${paramIndex++}`);
      values.push(stats.tokenUsage);
    }

    if (stats.avgResponseTime !== undefined) {
      updates.push(`avg_response_time = $${paramIndex++}`);
      values.push(stats.avgResponseTime);
    }

    if (updates.length === 0) {
      return;
    }

    values.push(sessionId);

    try {
      await getPool().query(
        `UPDATE chat_sessions 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        values
      );
    } catch (err) {
      logger.error('Failed to update session stats', {
        error: (err as Error).message,
        sessionId,
      });
      // 统计更新失败不抛出异常
    }
  }

  /**
   * 获取会话统计信息
   * 
   * @param userId - 用户ID
   * @returns 统计摘要
   */
  async getSessionStats(userId: number): Promise<{
    totalSessions: number;
    activeSessions: number;
    archivedSessions: number;
    totalMessages: number;
    totalTokens: number;
  }> {
    try {
      const result = await getPool().query(
        `SELECT 
           COUNT(*) as total_sessions,
           COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
           COUNT(*) FILTER (WHERE status = 'archived') as archived_sessions,
           COALESCE(SUM(message_count), 0) as total_messages,
           COALESCE(SUM(token_usage), 0) as total_tokens
         FROM chat_sessions
         WHERE user_id = $1 AND status != 'deleted'`,
        [userId]
      );

      const row = result.rows[0];
      return {
        totalSessions: parseInt(row.total_sessions),
        activeSessions: parseInt(row.active_sessions),
        archivedSessions: parseInt(row.archived_sessions),
        totalMessages: parseInt(row.total_messages),
        totalTokens: parseInt(row.total_tokens),
      };
    } catch (err) {
      logger.error('Failed to get session stats', {
        error: (err as Error).message,
        userId,
      });
      throw new Error(`Failed to get session stats: ${(err as Error).message}`);
    }
  }

  /**
   * 映射数据库行到ChatSession对象
   * 
   * @param row - 数据库查询结果行
   * @returns ChatSession对象
   */
  private mapRowToSession(row: any): ChatSession {
    return {
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      title: row.title,
      messages: row.messages || [],
      context: row.context,
      settings: row.settings,
      messageCount: row.message_count || 0,
      tokenUsage: row.token_usage || 0,
      avgResponseTime: row.avg_response_time || 0,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
    };
  }
}

// 导出单例
export const chatSessionService = new ChatSessionService();

// 默认导出
export default chatSessionService;

