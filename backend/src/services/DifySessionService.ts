import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { AgentConfig } from '@/types';
import logger from '@/utils/logger';

/**
 * Dify 会话接口
 */
export interface DifyConversation {
  id: string;
  name: string;
  inputs: Record<string, any>;
  status: string;
  introduction: string;
  created_at: number;
}

/**
 * Dify 消息接口
 */
export interface DifyMessage {
  id: string;
  conversation_id: string;
  inputs: Record<string, any>;
  query: string;
  answer: string;
  message_files?: Array<{
    id: string;
    type: string;
    url: string;
    belongs_to: string;
  }>;
  feedback?: {
    rating: 'like' | 'dislike' | null;
  };
  retriever_resources?: Array<{
    position: number;
    dataset_id: string;
    dataset_name: string;
    document_id: string;
    document_name: string;
    segment_id: string;
    score: number;
    content: string;
  }>;
  created_at: number;
}

/**
 * Dify 消息详情（扩展版）
 */
export interface DifyMessageDetail extends DifyMessage {
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    retriever_resources: any[];
  };
}

/**
 * Dify 会话列表参数
 */
export interface DifyConversationListParams {
  user?: string;      // 用户标识
  limit?: number;     // 返回数量限制 (默认 20, 最大 100)
  last_id?: string;   // 上一页最后一个会话 ID，用于分页
}

/**
 * Dify 消息列表参数
 */
export interface DifyMessageListParams {
  conversation_id: string;
  user?: string;
  first_id?: string;  // 当前页第一条消息 ID
  limit?: number;
}

/**
 * Dify 反馈参数
 */
export interface DifyFeedbackParams {
  message_id: string;
  rating: 'like' | 'dislike' | null;
  user?: string;
}

/**
 * Dify 会话管理服务
 *
 * 负责管理 Dify 智能体的会话历史、消息查询、反馈等功能
 *
 * 主要功能：
 * - 获取会话列表
 * - 获取会话消息
 * - 获取单条消息详情
 * - 删除会话
 * - 提交消息反馈（点赞/点踩）
 * - 获取建议问题
 *
 * API 端点参考：
 * - GET  /v1/conversations - 会话列表
 * - GET  /v1/messages - 消息列表
 * - GET  /v1/messages/:id - 消息详情
 * - DELETE /v1/conversations/:id - 删除会话
 * - POST /v1/messages/:id/feedbacks - 提交反馈
 * - GET  /v1/messages/:id/suggested - 建议问题
 */
export class DifySessionService {
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 获取基础 URL
   */
  private getBaseUrl(agent: AgentConfig): string {
    return agent.endpoint.replace(/\/$/, '');
  }

  /**
   * 构建请求头
   */
  private buildHeaders(agent: AgentConfig): Record<string, string> {
    return {
      'Authorization': `Bearer ${agent.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 获取会话列表
   *
   * @param agent - 智能体配置
   * @param params - 查询参数
   * @returns 会话列表
   */
  async getConversations(
    agent: AgentConfig,
    params?: DifyConversationListParams,
  ): Promise<{ data: Array<DifyConversation>; has_more: boolean; limit: number }> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/conversations`;

      const response = await this.httpClient.get(url, {
        headers: this.buildHeaders(agent),
        params: {
          user: params?.user || 'default-user',
          limit: params?.limit || 20,
          ...(params?.last_id && { last_id: params.last_id }),
        },
      });

      logger.info('Dify 会话列表查询成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        count: response.data.data?.length || 0,
        hasMore: response.data.has_more,
      });

      return {
        data: response.data.data || [],
        has_more: response.data.has_more || false,
        limit: response.data.limit || 20,
      };
    } catch (error: any) {
      logger.error('Dify 会话列表查询失败', {
        component: 'DifySessionService',
        agentId: agent.id,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`获取会话列表失败: ${error.message}`);
    }
  }

  /**
   * 获取会话消息列表
   *
   * @param agent - 智能体配置
   * @param params - 查询参数
   * @returns 消息列表
   */
  async getConversationMessages(
    agent: AgentConfig,
    params: DifyMessageListParams,
  ): Promise<{ data: Array<DifyMessage>; has_more: boolean; limit: number }> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/messages`;

      const response = await this.httpClient.get(url, {
        headers: this.buildHeaders(agent),
        params: {
          conversation_id: params.conversation_id,
          user: params.user || 'default-user',
          limit: params.limit || 20,
          ...(params.first_id && { first_id: params.first_id }),
        },
      });

      logger.info('Dify 会话消息查询成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        conversationId: params.conversation_id,
        count: response.data.data?.length || 0,
      });

      return {
        data: response.data.data || [],
        has_more: response.data.has_more || false,
        limit: response.data.limit || 20,
      };
    } catch (error: any) {
      logger.error('Dify 会话消息查询失败', {
        component: 'DifySessionService',
        agentId: agent.id,
        conversationId: params.conversation_id,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`获取会话消息失败: ${error.message}`);
    }
  }

  /**
   * 获取消息详情
   *
   * @param agent - 智能体配置
   * @param messageId - 消息 ID
   * @param user - 用户标识
   * @returns 消息详情
   */
  async getMessageDetail(
    agent: AgentConfig,
    messageId: string,
    user?: string,
  ): Promise<DifyMessageDetail> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/messages/${messageId}`;

      const response = await this.httpClient.get(url, {
        headers: this.buildHeaders(agent),
        params: {
          user: user || 'default-user',
        },
      });

      logger.info('Dify 消息详情查询成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        messageId,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Dify 消息详情查询失败', {
        component: 'DifySessionService',
        agentId: agent.id,
        messageId,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`获取消息详情失败: ${error.message}`);
    }
  }

  /**
   * 删除会话
   *
   * @param agent - 智能体配置
   * @param conversationId - 会话 ID
   * @param user - 用户标识
   */
  async deleteConversation(
    agent: AgentConfig,
    conversationId: string,
    user?: string,
  ): Promise<void> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/conversations/${conversationId}`;

      await this.httpClient.delete(url, {
        headers: this.buildHeaders(agent),
        params: {
          user: user || 'default-user',
        },
      });

      logger.info('Dify 会话删除成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        conversationId,
      });
    } catch (error: any) {
      logger.error('Dify 会话删除失败', {
        component: 'DifySessionService',
        agentId: agent.id,
        conversationId,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`删除会话失败: ${error.message}`);
    }
  }

  /**
   * 提交消息反馈（点赞/点踩）
   *
   * @param agent - 智能体配置
   * @param params - 反馈参数
   * @returns 反馈结果
   */
  async submitFeedback(
    agent: AgentConfig,
    params: DifyFeedbackParams,
  ): Promise<{ result: string }> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/messages/${params.message_id}/feedbacks`;

      const response = await this.httpClient.post(
        url,
        {
          rating: params.rating,
          user: params.user || 'default-user',
        },
        {
          headers: this.buildHeaders(agent),
        },
      );

      logger.info('Dify 消息反馈提交成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        messageId: params.message_id,
        rating: params.rating,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Dify 消息反馈提交失败', {
        component: 'DifySessionService',
        agentId: agent.id,
        messageId: params.message_id,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`提交反馈失败: ${error.message}`);
    }
  }

  /**
   * 获取建议问题
   *
   * @param agent - 智能体配置
   * @param messageId - 消息 ID
   * @param user - 用户标识
   * @returns 建议问题列表
   */
  async getSuggestedQuestions(
    agent: AgentConfig,
    messageId: string,
    user?: string,
  ): Promise<Array<string>> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/messages/${messageId}/suggested`;

      const response = await this.httpClient.get(url, {
        headers: this.buildHeaders(agent),
        params: {
          user: user || 'default-user',
        },
      });

      logger.info('Dify 建议问题查询成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        messageId,
        count: response.data.data?.length || 0,
      });

      return response.data.data || [];
    } catch (error: any) {
      logger.error('Dify 建议问题查询失败', {
        component: 'DifySessionService',
        agentId: agent.id,
        messageId,
        error: error.message,
        status: error.response?.status,
      });
      // 建议问题失败不抛错，返回空数组
      return [];
    }
  }

  /**
   * 重命名会话（Dify API 可能不支持，预留接口）
   *
   * @param agent - 智能体配置
   * @param conversationId - 会话 ID
   * @param name - 新名称
   * @param user - 用户标识
   */
  async renameConversation(
    agent: AgentConfig,
    conversationId: string,
    name: string,
    user?: string,
  ): Promise<void> {
    try {
      const baseUrl = this.getBaseUrl(agent);
      const url = `${baseUrl}/v1/conversations/${conversationId}/name`;

      await this.httpClient.post(
        url,
        {
          name,
          user: user || 'default-user',
        },
        {
          headers: this.buildHeaders(agent),
        },
      );

      logger.info('Dify 会话重命名成功', {
        component: 'DifySessionService',
        agentId: agent.id,
        conversationId,
        newName: name,
      });
    } catch (error: any) {
      logger.warn('Dify 会话重命名失败（API 可能不支持）', {
        component: 'DifySessionService',
        agentId: agent.id,
        conversationId,
        error: error.message,
        status: error.response?.status,
      });
      // 不抛错，因为 Dify API 可能不支持此功能
    }
  }
}

// 导出单例实例
export const difySessionService = new DifySessionService();
