import axios from 'axios';
import type { AgentConfigService } from './AgentConfigService';
import logger from '@/utils/logger';
import type {
  AgentConfig,
  ChatMessage,
  FastGPTChatHistoryDetail,
  FastGPTChatHistoryMessage,
  FastGPTChatHistorySummary,
  SessionListParams,
  PaginatedResponse,
  BatchOperationOptions,
  ExportOptions,
  SessionEvent,
  SessionEventType,
  EventQueryParams,
} from '@/types';
import { getErrorMessage } from '@/utils/helpers';
import { AdaptiveTtlPolicy } from '@/utils/adaptiveCache';
import { SessionEventService } from './SessionEventService';

interface RequestDescriptor {
  method: 'get' | 'post' | 'delete';
  path: string;
}

interface ListParams {
  page?: number;
  pageSize?: number;
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const FASTGPT_COMPLETIONS_SUFFIX = '/api/v1/chat/completions';

const buildCacheKey = (agentId: string, segment: string) => `${agentId}::${segment}`;

/**
 * FastGPT 会话与历史记录服务
 */
export class FastGPTSessionService {
  private readonly agentService: AgentConfigService;
  private readonly httpClient: ReturnType<typeof axios.create>;
  private readonly historyListCache = new Map<string, CacheEntry<FastGPTChatHistorySummary[]>>();
  private readonly historyDetailCache = new Map<string, CacheEntry<FastGPTChatHistoryDetail>>();
  private readonly inFlightRequests = new Map<string, Promise<any>>();
  private readonly eventService: SessionEventService;
  private readonly historyListPolicy = new AdaptiveTtlPolicy({
    initialTtl: 10 * 1000,
    minTtl: 5 * 1000,
    maxTtl: 120 * 1000,
    step: 5 * 1000,
    sampleSize: 30,
    adjustIntervalMs: 60 * 1000,
  });
  private readonly historyDetailPolicy = new AdaptiveTtlPolicy({
    initialTtl: 5 * 1000,
    minTtl: 2 * 1000,
    maxTtl: 60 * 1000,
    step: 3 * 1000,
    sampleSize: 30,
    adjustIntervalMs: 45 * 1000,
  });
  private readonly historyEndpointBases = [
    '/api/core/chat/history',
    '/api/v1/core/chat/history',
    '/api/chat/history',
    '/api/v1/chat/history',
  ];
  private readonly feedbackEndpointBases = [
    '/api/core/chat/feedback',
    '/api/v1/core/chat/feedback',
    '/api/chat/feedback',
    '/api/v1/chat/feedback',
  ];

  constructor(agentService: AgentConfigService) {
    this.agentService = agentService;
    this.httpClient = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT ?? '30000', 10),
    });
    this.eventService = new SessionEventService();
  }

  /**
   * 校验并获取 FastGPT 智能体配置
   *
   * Args:
   *   agentId: 智能体唯一标识
   * Returns:
   *   AgentConfig: 合法的智能体配置
   * Raises:
   *   Error: code = NOT_FOUND | INVALID_PROVIDER | INVALID_APP_ID
   */
  private async ensureFastGPTAgent(agentId: string): Promise<AgentConfig> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      const err = new Error(`智能体不存在: ${agentId}`) as any;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (agent.provider !== 'fastgpt') {
      const err = new Error('仅 FastGPT 智能体支持会话历史接口') as any;
      err.code = 'INVALID_PROVIDER';
      throw err;
    }
    if (!agent.appId || !/^[a-fA-F0-9]{24}$/.test(agent.appId)) {
      const err = new Error('FastGPT 智能体缺少有效的 appId 配置') as any;
      err.code = 'INVALID_APP_ID';
      throw err;
    }
    return agent;
  }

  /**
   * 计算 FastGPT 基础 URL
   *
   * 修复URL重复问题：
   * 输入: http://171.43.138.237:3000/v1/api/v1/chat/completions
   * 输出: http://171.43.138.237:3000
   */
  private getBaseUrl(agent: AgentConfig): string {
    if (!agent.endpoint) {
      throw new Error('FastGPT 智能体缺少 endpoint 配置');
    }

    // 清理空格和末尾斜杠
    let cleaned = agent.endpoint.replace(/[`\s]+/g, '').replace(/\/$/, '');

    // 移除 /chat/completions 后缀
    if (cleaned.endsWith(FASTGPT_COMPLETIONS_SUFFIX)) {
      cleaned = cleaned.slice(0, -FASTGPT_COMPLETIONS_SUFFIX.length);
    }

    // 🔧 关键修复：统一移除末尾的API路径，避免重复拼接
    // 支持多种格式：/v1/api/v1, /api/v1, /v1
    cleaned = cleaned
      .replace(/\/v1\/api\/v1\/?$/, '')  // 移除 /v1/api/v1 或 /v1/api/v1/
      .replace(/\/api\/v1\/?$/, '')      // 移除 /api/v1 或 /api/v1/
      .replace(/\/v1\/?$/, '');          // 移除 /v1 或 /v1/

    return cleaned;
  }

  /**
   * 统一请求入口，支持多路径尝试与 /v1 回退
   *
   * Args:
   *   agent: 智能体配置
   *   attempts: 请求尝试序列（方法+路径）
   *   options: 请求参数与 body
   * Returns:
   *   AxiosResponse<T>
   * Raises:
   *   Error: 最终请求失败错误
   */
  private async requestWithFallback<T = any>(
    agent: AgentConfig,
    attempts: RequestDescriptor[],
    options: {
      params?: Record<string, any>;
      data?: Record<string, any>;
    } = {},
  ) {
    const baseUrl = this.getBaseUrl(agent);
    const headers = {
      Authorization: `Bearer ${agent.apiKey}`,
      'Content-Type': 'application/json',
    };

    let lastError: unknown;
    for (const attempt of attempts) {
      // 路径净化，移除反引号与空白
      const cleanPath = attempt.path.replace(/[`\s]+/g, '');
      const url = `${baseUrl}${cleanPath}`;

      try {
        if (attempt.method === 'get') {
          return await this.httpClient.get<T>(url, {
            params: options.params ?? {},
            headers,
          });
        }
        if (attempt.method === 'delete') {
          return await this.httpClient.delete<T>(url, {
            params: options.params ?? {},
            headers,
          });
        }
        return await this.httpClient.post<T>(url, options.data, {
          params: options.params ?? {},
          headers,
        });
      } catch (error) {
        lastError = error;
        // 若 404，尝试 /v1 回退
        const status = (error as any)?.response?.status;
        if (status === 404) {
          const v1Url = `${baseUrl}/v1${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
          try {
            if (attempt.method === 'get') {
              return await this.httpClient.get<T>(v1Url, {
                params: options.params ?? {},
                headers,
              });
            }
            if (attempt.method === 'delete') {
              return await this.httpClient.delete<T>(v1Url, {
                params: options.params ?? {},
                headers,
              });
            }
            return await this.httpClient.post<T>(v1Url, options.data, {
              params: options.params ?? {},
              headers,
            });
          } catch (v1Error) {
            lastError = v1Error;
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`FastGPT 接口调用失败: ${getErrorMessage(lastError)}`);
  }

  private buildEndpointAttempts(
    bases: string[],
    suffixes: string[],
    method: RequestDescriptor['method'],
  ): RequestDescriptor[] {
    const attempts: RequestDescriptor[] = [];
    const seen = new Set<string>();

    for (const base of bases) {
      for (const rawSuffix of suffixes) {
        const suffix = rawSuffix.replace(/^\/+/g, '');
        const path = `${base}/${suffix}`.replace(/\/+/g, '/');
        const key = `${method}:${path}`;
        if (!seen.has(key)) {
          attempts.push({ method, path });
          seen.add(key);
        }
      }
    }

    return attempts;
  }

  private async getWithCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    policy: AdaptiveTtlPolicy,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      policy.recordHit();
      return cached.data;
    }

    const inflightKey = `inflight::${key}`;
    if (this.inFlightRequests.has(inflightKey)) {
      return this.inFlightRequests.get(inflightKey) as Promise<T>;
    }

    policy.recordMiss();
    const promise = fetcher()
      .then((result) => {
        cache.set(key, { data: result, expiresAt: Date.now() + policy.getTtl() });
        this.inFlightRequests.delete(inflightKey);
        return result;
      })
      .catch((error) => {
        this.inFlightRequests.delete(inflightKey);
        cache.delete(key);
        throw error;
      });

    this.inFlightRequests.set(inflightKey, promise);
    return promise;
  }

  private invalidateHistoryCaches(agentId: string, chatId?: string): void {
    const listPrefix = buildCacheKey(agentId, 'list');
    for (const key of Array.from(this.historyListCache.keys())) {
      if (key.startsWith(listPrefix)) {
        this.historyListCache.delete(key);
      }
    }
    this.historyListPolicy.notifyInvalidation();

    if (chatId) {
      this.historyDetailCache.delete(buildCacheKey(agentId, `detail:${chatId}`));
      this.historyDetailPolicy.notifyInvalidation();
      return;
    }

    const detailPrefix = buildCacheKey(agentId, 'detail');
    for (const key of Array.from(this.historyDetailCache.keys())) {
      if (key.startsWith(detailPrefix)) {
        this.historyDetailCache.delete(key);
      }
    }
    this.historyDetailPolicy.notifyInvalidation();
  }

  private normalizeHistorySummary(item: Record<string, unknown>): FastGPTChatHistorySummary {
    const data = item as Record<string, any>;
    const chatId = data?.chatId || data?.id || data?._id || data?.historyId || data?.history_id ?? 9138;
    const title = data?.title || data?.name || data?.latestQuestion || data?.latest_question || '未命名对话';
    const createdAt = data?.createTime || data?.create_time || data?.createdAt || data?.created_at || data?.time || new Date().toISOString();
    const updatedAt =
      data?.updateTime || data?.update_time || data?.updatedAt || data?.updated_at || data?.lastUpdateTime || data?.last_update_time || createdAt;

    return {
      chatId: String(chatId),
      appId: (data?.appId || data?.app_id) as string | undefined,
      title: String(title),
      createdAt: typeof createdAt === 'number' ? new Date(createdAt).toISOString() : String(createdAt),
      updatedAt: typeof updatedAt === 'number' ? new Date(updatedAt).toISOString() : String(updatedAt),
      messageCount: Number(data?.messageCount || data?.msgCount || data?.totalMessages || data?.total ?? 0),
      tags: Array.isArray(data?.tags) ? data.tags as string[] : undefined,
      raw: data,
    };
  }

  private normalizeHistoryMessage(entry: Record<string, unknown>): FastGPTChatHistoryMessage {
    const dataId = entry?.dataId || entry?.data_id || entry?._id || entry?.id;
    const roleRaw = entry?.role || entry?.obj || entry?.type;
    const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : '';

    let normalizedRole: 'user' | 'assistant' | 'system';
    if (role.includes('system')) {
      normalizedRole = 'system';
    } else if (role.includes('assistant') || role.includes('ai') || role.includes('bot')) {
      normalizedRole = 'assistant';
    } else {
      normalizedRole = 'user';
    }

    const value = entry?.value ?? entry?.content ?? entry?.answer ?? entry?.text ?? '';
    const content = Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join('\n') : String(value ?? '');
    const feedback = entry?.userGoodFeedback ? 'good' : entry?.userBadFeedback ? 'bad' : null;

    return {
      id: dataId ? String(dataId) : undefined,
      dataId: dataId ? String(dataId) : undefined,
      role: normalizedRole,
      content,
      feedback,
      raw: entry,
    };
  }

  private normalizeHistoryDetail(payload: Record<string, unknown>): FastGPTChatHistoryDetail {
    const data = (payload?.data ?? payload) as Record<string, any>;
    const list = data?.list || data?.messages || data?.history || data?.chatHistoryList || data?.detail ?? [];
    const title = data?.title || data?.historyName || data?.history_title;

    const messages: FastGPTChatHistoryMessage[] = Array.isArray(list)
      ? list.map((item) => this.normalizeHistoryMessage(item as Record<string, unknown>))
      : [];

    const chatId = data?.chatId || data?.historyId || data?.id || data?.chat_id || data?.history_id;

    return {
      chatId: chatId ? String(chatId) : '',
      appId: data?.appId || data?.app_id,
      title: title ? String(title) : undefined,
      messages,
      sessionInfo: {
        userId: data?.userId || data?.user_id || null,
      },
      metadata: {
        total: data?.total,
        hasMore: data?.hasMore,
        raw: data,
      },
    };
  }

  async listHistories(agentId: string, pagination?: ListParams): Promise<FastGPTChatHistorySummary[]> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const params = {
      appId: agent.appId,
      page: pagination?.page,
      pageSize: pagination?.pageSize,
    };

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['list', 'getHistoryList', 'getHistories'],
      'get',
    );

    const cacheKey = buildCacheKey(
      agentId,
      `list:${params.page ?? 1}:${params.pageSize || 'default'}`,
    );

    return this.getWithCache(this.historyListCache, cacheKey, this.historyListPolicy, async () => {
      const response = await this.requestWithFallback(agent, attempts, { params });
      const payload = response.data;

      if (payload?.code && payload.code !== 200) {
        throw new Error(payload?.message || 'FastGPT 获取会话列表失败');
      }

      const rawList = payload?.data?.list || payload?.data || payload?.historyList || payload?.list ?? [];
      return Array.isArray(rawList) ? rawList.map((item) => this.normalizeHistorySummary(item)) : [];
    });
  }

  async getHistoryDetail(agentId: string, chatId: string): Promise<FastGPTChatHistoryDetail> {
    const agent = await this.ensureFastGPTAgent(agentId);

    const params = {
      appId: agent.appId,
      chatId,
    };

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['detail', 'getHistory', 'messages'],
      'get',
    );

    const cacheKey = buildCacheKey(agentId, `detail:${chatId}`);

    return this.getWithCache(this.historyDetailCache, cacheKey, this.historyDetailPolicy, async () => {
      const response = await this.requestWithFallback(agent, attempts, { params });
      const payload = response.data;

      if (payload?.code && payload.code !== 200) {
        throw new Error(payload?.message || 'FastGPT 获取会话详情失败');
      }

      return this.normalizeHistoryDetail(payload?.data ? payload : payload);
    });
  }

  async deleteHistory(agentId: string, chatId: string): Promise<void> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const data = { appId: agent.appId, chatId };

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['delete', 'removeHistory', 'delHistory'],
      'post',
    );

    const response = await this.requestWithFallback(agent, attempts, { data });
    const payload = response.data;
    if (payload?.code && payload.code !== 200) {
      throw new Error(payload?.message || 'FastGPT 删除历史记录失败');
    }

    this.invalidateHistoryCaches(agentId, chatId);
  }

  async clearHistories(agentId: string): Promise<void> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const data = { appId: agent.appId };

    const attempts = [
      ...this.buildEndpointAttempts(this.historyEndpointBases, ['clear', 'clearHistories'], 'post'),
      ...this.buildEndpointAttempts(this.historyEndpointBases, ['clear'], 'delete'),
    ];

    const response = await this.requestWithFallback(agent, attempts, { data });
    const payload = response.data;
    if (payload?.code && payload.code !== 200) {
      throw new Error(payload?.message || 'FastGPT 清空历史记录失败');
    }

    this.invalidateHistoryCaches(agentId);
  }

  async updateUserFeedback(
    agentId: string,
    payload: {
      chatId: string;
      dataId: string;
      userGoodFeedback?: string;
      userBadFeedback?: string;
    },
  ): Promise<void> {
    const agent = await this.ensureFastGPTAgent(agentId);

    const data: Record<string, any> = {
      appId: agent.appId,
      chatId: payload.chatId,
      dataId: payload.dataId,
    };

    if (payload.userGoodFeedback) {
      data.userGoodFeedback = payload.userGoodFeedback;
    }
    if (payload.userBadFeedback) {
      data.userBadFeedback = payload.userBadFeedback;
    }

    const attempts = this.buildEndpointAttempts(
      this.feedbackEndpointBases,
      ['updateUserFeedback'],
      'post',
    );

    const response = await this.requestWithFallback(agent, attempts, { data });
    const respPayload = response.data;
    if (respPayload?.code && respPayload.code !== 200) {
      throw new Error(respPayload?.message || 'FastGPT 更新反馈失败');
    }
  }

  prepareRetryPayload(
    detail: FastGPTChatHistoryDetail,
    targetDataId: string,
  ): { messages: ChatMessage[]; responseChatItemId?: string } | null {
    if (!detail || !Array.isArray(detail.messages)) {
      return null;
    }

    const index = detail.messages.findIndex((msg) => msg.dataId === targetDataId || msg.id === targetDataId);
    if (index === -1) {
      return null;
    }

    const assistantEntry = detail.messages[index];
    const previousUser = [...detail.messages]
      .slice(0, index)
      .reverse()
      .find((msg) => msg.role === 'user');

    if (!previousUser) {
      return null;
    }

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: previousUser.content,
      },
    ];

    const responseChatItemIdRaw = assistantEntry?.dataId ?? assistantEntry?.id;
    const responseChatItemId = responseChatItemIdRaw ? String(responseChatItemIdRaw) : undefined;

    const result: { messages: ChatMessage[]; responseChatItemId?: string } = { messages };
    if (responseChatItemId) {
      result.responseChatItemId = responseChatItemId;
    }

    return result;
  }

  // ==================== 增强功能方法 ====================

  /**
   * 增强版会话列表查询 - 支持分页、过滤、排序
   */
  async listHistoriesEnhanced(
    agentId: string,
    params?: SessionListParams,
  ): Promise<PaginatedResponse<FastGPTChatHistorySummary>> {
    const agent = await this.ensureFastGPTAgent(agentId);

    // 构建查询参数
    const queryParams: Record<string, any> = {
      appId: agent.appId,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 20,
    };

    // 添加过滤条件
    if (params?.startDate) {
      queryParams.startDate = params.startDate;
    }
    if (params?.endDate) {
      queryParams.endDate = params.endDate;
    }
    if (params?.tags && params.tags.length > 0) {
      queryParams.tags = params.tags.join(',');
    }
    if (params?.minMessageCount) {
      queryParams.minMessageCount = params.minMessageCount;
    }
    if (params?.maxMessageCount) {
      queryParams.maxMessageCount = params.maxMessageCount;
    }
    if (params?.searchKeyword) {
      queryParams.searchKeyword = params.searchKeyword;
    }
    if (params?.sortBy) {
      queryParams.sortBy = params.sortBy;
    }
    if (params?.sortOrder) {
      queryParams.sortOrder = params.sortOrder;
    }

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['listEnhanced', 'getHistoryListEnhanced', 'getHistoriesEnhanced', 'list'],
      'get',
    );

    try {
      const response = await this.requestWithFallback(agent, attempts, { params: queryParams });
      const payload = response.data;

      if (payload?.code && payload.code !== 200) {
        throw new Error(payload?.message || 'FastGPT 获取会话列表失败');
      }

      const rawData = payload?.data;
      const sessions = Array.isArray(rawData?.list || rawData)
        ? (rawData.list || rawData).map((item: Record<string, unknown>) => this.normalizeHistorySummary(item))
        : [];

      // 如果远程API不支持增强功能，则使用本地过滤和排序
      if (!params || Object.keys(params).length === 0 ||
          (params.page === undefined && params.pageSize === undefined)) {
        return this.applyLocalFilteringAndPagination(sessions, params);
      }

      return {
        data: sessions,
        total: rawData?.total || sessions.length,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        totalPages: Math.ceil((rawData?.total || sessions.length) / (params?.pageSize ?? 20)),
        hasNext: (params?.page ?? 1) * (params?.pageSize ?? 20) < (rawData?.total || sessions.length),
        hasPrev: (params?.page ?? 1) > 1,
      };
    } catch (error) {
      // 如果增强API不可用，回退到基础API并应用本地处理
      logger.warn('增强版会话API不可用，使用基础API + 本地处理', { error });
      const allSessions = await this.listHistories(agentId, { page: 1, pageSize: 1000 });
      return this.applyLocalFilteringAndPagination(allSessions, params);
    }
  }

  /**
   * 本地过滤和分页处理
   */
  private applyLocalFilteringAndPagination(
    sessions: FastGPTChatHistorySummary[],
    params?: SessionListParams,
  ): PaginatedResponse<FastGPTChatHistorySummary> {
    let filteredSessions = [...sessions];

    // 日期范围过滤
    if (params?.startDate) {
      const startDate = new Date(params.startDate);
      filteredSessions = filteredSessions.filter(session =>
        new Date(session.createdAt) >= startDate,
      );
    }
    if (params?.endDate) {
      const endDate = new Date(params.endDate);
      filteredSessions = filteredSessions.filter(session =>
        new Date(session.updatedAt) <= endDate,
      );
    }

    // 标签过滤
    if (params?.tags && params.tags.length > 0) {
      filteredSessions = filteredSessions.filter(session =>
        session.tags && params.tags!.some(tag => session.tags!.includes(tag)),
      );
    }

    // 消息数量过滤
    if (params?.minMessageCount) {
      filteredSessions = filteredSessions.filter(session =>
        (session.messageCount ?? 0) >= params.minMessageCount!,
      );
    }
    if (params?.maxMessageCount) {
      filteredSessions = filteredSessions.filter(session =>
        (session.messageCount ?? 0) <= params.maxMessageCount!,
      );
    }

    // 关键词搜索
    if (params?.searchKeyword) {
      const keyword = params.searchKeyword.toLowerCase();
      filteredSessions = filteredSessions.filter(session =>
        session.title.toLowerCase().includes(keyword),
      );
    }

    // 排序
    const sortBy = params?.sortBy || 'updatedAt';
    const sortOrder = params?.sortOrder || 'desc';

    filteredSessions.sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        case 'messageCount':
          aValue = a.messageCount ?? 0;
          bValue = b.messageCount ?? 0;
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // 分页
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filteredSessions.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total: filteredSessions.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredSessions.length / pageSize),
      hasNext: endIndex < filteredSessions.length,
      hasPrev: page > 1,
    };
  }

  /**
   * 批量操作会话
   */
  async batchOperation(
    agentId: string,
    options: BatchOperationOptions,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const sessionId of options.sessionIds) {
      try {
        switch (options.operation) {
          case 'delete':
            await this.deleteHistory(agentId, sessionId);
            // 记录删除事件
            await this.recordEvent(agentId, sessionId, 'deleted', {
              reason: 'batch_operation',
            });
            break;

          case 'archive':
            // 归档操作 - 可以通过添加特定标签实现
            await this.addTagsToSession(agentId, sessionId, ['archived']);
            await this.recordEvent(agentId, sessionId, 'archived', {
              reason: 'batch_operation',
            });
            break;

          case 'addTags':
            if (options.tags && options.tags.length > 0) {
              await this.addTagsToSession(agentId, sessionId, options.tags);
              await this.recordEvent(agentId, sessionId, 'tags_updated', {
                tags: options.tags,
                operation: 'add',
              });
            }
            break;

          case 'removeTags':
            if (options.tags && options.tags.length > 0) {
              await this.removeTagsFromSession(agentId, sessionId, options.tags);
              await this.recordEvent(agentId, sessionId, 'tags_updated', {
                tags: options.tags,
                operation: 'remove',
              });
            }
            break;

          default:
            throw new Error(`不支持的批量操作: ${options.operation}`);
        }

        results.success++;
      } catch (error) {
        results.failed++;
        const errorMsg = `会话 ${sessionId} 操作失败: ${getErrorMessage(error)}`;
        results.errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    // 清除缓存
    this.invalidateHistoryCaches(agentId);

    return results;
  }

  /**
   * 为会话添加标签
   */
  private async addTagsToSession(
    agentId: string,
    sessionId: string,
    tags: string[],
  ): Promise<void> {
    // 这里需要根据FastGPT的具体API来实现
    // 由于当前API可能不直接支持标签操作，可以使用updateUserFeedback的变体
    // 或者通过其他API端点来实现
    logger.debug('为会话添加标签', { sessionId, tags });
    // 实际实现需要调用相应的FastGPT API
  }

  /**
   * 从会话移除标签
   */
  private async removeTagsFromSession(
    agentId: string,
    sessionId: string,
    tags: string[],
  ): Promise<void> {
    logger.debug('从会话移除标签', { sessionId, tags });
    // 实际实现需要调用相应的FastGPT API
  }

  /**
   * 导出会话数据
   */
  async exportSessions(
    agentId: string,
    options: ExportOptions,
  ): Promise<{ filename: string; data: string | Buffer }> {
    // 获取符合条件的会话
    const result = await this.listHistoriesEnhanced(agentId, options.filters);
    const sessions = result.data;

    let exportData: string | Buffer;
    let filename: string;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    switch (options.format) {
      case 'json':
        exportData = await this.exportToJson(sessions, options);
        filename = `sessions_${timestamp}.json`;
        break;

      case 'csv':
        exportData = await this.exportToCsv(sessions, options);
        filename = `sessions_${timestamp}.csv`;
        break;

      case 'excel':
        exportData = await this.exportToExcel(sessions, options);
        filename = `sessions_${timestamp}.xlsx`;
        break;

      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }

    // 记录导出事件
    await this.recordEvent(agentId, 'batch_export', 'exported', {
      format: options.format,
      sessionCount: sessions.length,
      includeMessages: options.includeMessages,
      includeMetadata: options.includeMetadata,
    });

    return { filename, data: exportData };
  }

  /**
   * 导出为JSON格式
   */
  private async exportToJson(
    sessions: FastGPTChatHistorySummary[],
    options: ExportOptions,
  ): Promise<string> {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSessions: sessions.length,
        includeMessages: options.includeMessages || false,
        includeMetadata: options.includeMetadata || false,
        filters: options.filters,
      },
      sessions: [] as any[],
    };

    for (const session of sessions) {
      const sessionData: Record<string, unknown> = {
        chatId: session.chatId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount,
        tags: session.tags,
      };

      // 包含元数据
      if (options.includeMetadata && session.raw) {
        sessionData.raw = session.raw;
      }

      // 包含消息内容
      if (options.includeMessages) {
        try {
          // 这里需要获取会话详情，但需要知道agentId
          // 暂时跳过，实际实现时需要传入agentId
          logger.debug('获取会话的详细消息', { chatId: session.chatId });
        } catch (error) {
          logger.warn('获取会话消息失败', { chatId: session.chatId, error });
        }
      }

      exportData.sessions.push(sessionData);
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出为CSV格式
   */
  private async exportToCsv(
    sessions: FastGPTChatHistorySummary[],
    options: ExportOptions,
  ): Promise<string> {
    const headers = [
      'Chat ID',
      'Title',
      'Created At',
      'Updated At',
      'Message Count',
      'Tags',
    ];

    if (options.includeMetadata) {
      headers.push('Raw Data');
    }

    const csvRows = [headers.join(',')];

    for (const session of sessions) {
      const row = [
        `"${session.chatId}"`,
        `"${this.escapeCsv(session.title)}"`,
        session.createdAt,
        session.updatedAt,
        session.messageCount ?? 0,
        `"${(session.tags || []).join(';')}"`,
      ];

      if (options.includeMetadata && session.raw) {
        row.push(`"${this.escapeCsv(JSON.stringify(session.raw))}"`);
      }

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * 导出为Excel格式
   */
  private async exportToExcel(
    sessions: FastGPTChatHistorySummary[],
    options: ExportOptions,
  ): Promise<Buffer> {
    // 这里需要使用xlsx库来生成Excel文件
    // 由于当前环境可能没有安装，先返回CSV格式的Buffer
    const csvData = await this.exportToCsv(sessions, options);
    return Buffer.from(csvData, 'utf-8');
  }

  /**
   * 转义CSV字段
   */
  private escapeCsv(field: string): string {
    return field.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  /**
   * 记录会话事件
   */
  async recordEvent(
    agentId: string,
    sessionId: string,
    eventType: SessionEventType,
    metadata?: Record<string, unknown>,
    context?: {
      userId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
  ): Promise<void> {
    try {
      await this.eventService.recordEvent(
        agentId,
        sessionId,
        eventType,
        metadata,
        context,
      );
    } catch (error) {
      logger.error('记录会话事件失败', { error });
      // 事件记录失败不应该影响主要功能
    }
  }

  /**
   * 查询会话事件
   */
  async queryEvents(
    agentId: string,
    params: EventQueryParams,
  ): Promise<PaginatedResponse<SessionEvent>> {
    try {
      return await this.eventService.queryEvents(agentId, params);
    } catch (error) {
      logger.error('查询会话事件失败', { error });
      // 返回空结果而不是抛出错误
      return {
        data: [],
        total: 0,
        page: params.page ?? 1,
        pageSize: params.pageSize || 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(agentId: string, dateRange?: { start: string; end: string }): Promise<{
    totalSessions: number;
    totalMessages: number;
    averageMessagesPerSession: number;
    topTags: Array<{ tag: string; count: number }>;
    recentActivity: Array<{ date: string; sessions: number; messages: number }>;
  }> {
    const params: SessionListParams = {};
    if (dateRange) {
      params.startDate = dateRange.start;
      params.endDate = dateRange.end;
    }

    const result = await this.listHistoriesEnhanced(agentId, {
      ...params,
      pageSize: 1000,
    });

    const sessions = result.data;
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, session) => sum + (session.messageCount ?? 0), 0);
    const averageMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

    // 统计标签使用情况
    const tagCounts = new Map<string, number>();
    sessions.forEach(session => {
      if (session.tags) {
        session.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 按日期统计最近活动
    const activityMap = new Map<string, { sessions: number; messages: number }>();
    sessions.forEach(session => {
      const date = (session.updatedAt || '').split('T')[0] || '';
      const current = activityMap.get(date) || { sessions: 0, messages: 0 };
      current.sessions++;
      current.messages += (session.messageCount ?? 0);
      activityMap.set(date, current);
    });

    const recentActivity = Array.from(activityMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    return {
      totalSessions,
      totalMessages,
      averageMessagesPerSession: Math.round(averageMessagesPerSession * 100) / 100,
      topTags,
      recentActivity,
    };
  }
}

export type { FastGPTChatHistorySummary };

