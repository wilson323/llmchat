/**
 * 类型转换工具库
 *
 * 提供安全的类型转换功能，支持不同格式之间的转换
 */

import type {
  // Agent相关
  Agent,
  AgentConfig,
  AgentStatus,
  ProviderType,
  WorkspaceType,
  AgentCapability,
  AgentFeatures,

  // Message相关
  StandardMessage,
  SimpleMessage,
  MessageRole,
  MessageStatus,
  AttachmentMetadata,
  VoiceNoteMetadata,
  InteractiveData,
  ReasoningState,

  // Session相关
  ChatSession,
  SessionStatus,
  SessionType,

  // User相关
  User,
  UserRole,
  UserStatus,
  AuthProvider,
  Permission,

  // 基础类型
  JsonValue,
  JsonObject,
} from '../index';
import { TypeSafeConverter } from './guards';

// ============================================================================
// 消息格式转换器
// ============================================================================

/**
 * 消息转换器类
 */
export class MessageConverter {
  /**
   * 标准格式转简化格式
   * @param messages 标准格式消息列表
   * @returns 简化格式消息列表
   */
  static toSimple(messages: StandardMessage[]): SimpleMessage[] {
    const result: SimpleMessage[] = [];
    let currentPair: SimpleMessage = {};

    for (const message of messages) {
      if (message.role === 'user') {
        // 如果当前对不为空，先添加到结果中
        if (Object.keys(currentPair).length > 0) {
          result.push(currentPair);
          currentPair = {};
        }
        currentPair.HUMAN = message.content;
        currentPair.timestamp = message.timestamp;
        currentPair.attachments = message.attachments;
        currentPair.voiceNote = message.voiceNote;
      } else if (message.role === 'assistant') {
        currentPair.AI = message.content;
        currentPair.id = message.metadata?.responseChatItemId || message.id;
        currentPair.interactive = message.metadata?.interactive;
        currentPair.reasoning = message.metadata?.reasoning;
        currentPair.events = message.metadata?.events;
        currentPair.status = message.status;
      }
    }

    // 添加最后一对
    if (Object.keys(currentPair).length > 0) {
      result.push(currentPair);
    }

    return result;
  }

  /**
   * 简化格式转标准格式
   * @param messages 简化格式消息列表
   * @param agentId 智能体ID
   * @param sessionId 会话ID
   * @returns 标准格式消息列表
   */
  static toStandard(messages: SimpleMessage[], agentId: string, sessionId: string): StandardMessage[] {
    const result: StandardMessage[] = [];

    for (const [index, simpleMessage] of messages.entries()) {
      const timestamp = simpleMessage.timestamp || Date.now();

      // 添加用户消息
      if (simpleMessage.HUMAN) {
        result.push({
          id: `${sessionId}-${index}-user`,
          role: 'user',
          content: simpleMessage.HUMAN,
          timestamp,
          attachments: simpleMessage.attachments,
          voiceNote: simpleMessage.voiceNote,
          metadata: {
            agentId,
            sessionId,
            messageId: simpleMessage.id,
            source: 'user_input'
          }
        });
      }

      // 添加AI消息
      if (simpleMessage.AI) {
        result.push({
          id: simpleMessage.id || `${sessionId}-${index}-assistant`,
          role: 'assistant',
          content: simpleMessage.AI,
          timestamp,
          status: simpleMessage.status,
          metadata: {
            agentId,
            sessionId,
            responseChatItemId: simpleMessage.id,
            interactive: simpleMessage.interactive,
            reasoning: simpleMessage.reasoning,
            events: simpleMessage.events,
            source: 'ai_generation'
          }
        });
      }
    }

    return result;
  }

  /**
   * 标准格式转消息对
   * @param messages 标准格式消息列表
   * @returns 消息对列表
   */
  static toPairs(messages: StandardMessage[]): Array<{user: StandardMessage; assistant: StandardMessage | null}> {
    const pairs: Array<{user: StandardMessage; assistant: StandardMessage | null}> = [];
    let currentUser: StandardMessage | null = null;

    for (const message of messages) {
      if (message.role === 'user') {
        // 如果已经有当前用户消息，先创建一个对
        if (currentUser) {
          pairs.push({ user: currentUser, assistant: null });
        }
        currentUser = message;
      } else if (message.role === 'assistant' && currentUser) {
        // 创建用户-AI对
        pairs.push({ user: currentUser, assistant: message });
        currentUser = null;
      }
    }

    // 添加最后一个用户消息（如果没有对应的AI消息）
    if (currentUser) {
      pairs.push({ user: currentUser, assistant: null });
    }

    return pairs;
  }

  /**
   * 消息对转标准格式
   * @param pairs 消息对列表
   * @returns 标准格式消息列表
   */
  static fromPairs(pairs: Array<{user: StandardMessage; assistant: StandardMessage | null}>): StandardMessage[] {
    const result: StandardMessage[] = [];

    for (const pair of pairs) {
      result.push(pair.user);
      if (pair.assistant) {
        result.push(pair.assistant);
      }
    }

    return result;
  }

  /**
   * 合并消息列表
   * @param existing 现有消息列表
   * @param newMessages 新消息列表
   * @param maxMessages 最大消息数量限制
   * @returns 合并后的消息列表
   */
  static mergeMessages(
    existing: StandardMessage[],
    newMessages: StandardMessage[],
    maxMessages?: number
  ): StandardMessage[] {
    // 合并消息，去除重复
    const messageMap = new Map<string, StandardMessage>();

    // 先添加现有消息
    for (const message of existing) {
      messageMap.set(message.id, message);
    }

    // 再添加新消息（会覆盖重复的）
    for (const message of newMessages) {
      messageMap.set(message.id, message);
    }

    // 按时间戳排序
    const merged = Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // 应用数量限制
    if (maxMessages && merged.length > maxMessages) {
      return merged.slice(-maxMessages);
    }

    return merged;
  }

  /**
   * 过滤消息
   * @param messages 消息列表
   * @param filters 过滤条件
   * @returns 过滤后的消息列表
   */
  static filterMessages(
    messages: StandardMessage[],
    filters: {
      roles?: MessageRole[];
      status?: MessageStatus[];
      startDate?: number;
      endDate?: number;
      hasAttachments?: boolean;
      searchKeyword?: string;
    }
  ): StandardMessage[] {
    return messages.filter(message => {
      // 角色过滤
      if (filters.roles && !filters.roles.includes(message.role)) {
        return false;
      }

      // 状态过滤
      if (filters.status && message.status && !filters.status.includes(message.status)) {
        return false;
      }

      // 时间范围过滤
      if (filters.startDate && message.timestamp < filters.startDate) {
        return false;
      }
      if (filters.endDate && message.timestamp > filters.endDate) {
        return false;
      }

      // 附件过滤
      if (filters.hasAttachments !== undefined) {
        const hasAttachments = message.attachments && message.attachments.length > 0;
        if (filters.hasAttachments !== hasAttachments) {
          return false;
        }
      }

      // 关键词搜索
      if (filters.searchKeyword) {
        const keyword = filters.searchKeyword.toLowerCase();
        const contentMatch = message.content.toLowerCase().includes(keyword);
        const metadataMatch = message.metadata?.model?.toLowerCase().includes(keyword);
        if (!contentMatch && !metadataMatch) {
          return false;
        }
      }

      return true;
    });
  }
}

// ============================================================================
// Agent转换器
// ============================================================================

/**
 * Agent转换器类
 */
export class AgentConverter {
  /**
   * 完整配置转简化信息
   * @param config 完整的AgentConfig
   * @returns 简化的Agent信息
   */
  static toAgent(config: AgentConfig): Agent {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      avatar: config.avatar,
      model: config.model,
      status: config.status,
      capabilities: config.capabilities,
      provider: config.provider,
      isActive: config.isActive,
      workspaceType: config.workspaceType,
      lastChecked: config.lastChecked,
      responseTime: config.responseTime,
      error: config.error
    };
  }

  /**
   * 简化信息转完整配置
   * @param agent 简化的Agent信息
   * @param additionalData 额外的配置数据
   * @returns 完整的AgentConfig（需要提供必需字段）
   */
  static toAgentConfig(
    agent: Agent,
    additionalData: {
      endpoint: string;
      apiKey: string;
      features: AgentFeatures;
      createdAt: string;
      updatedAt: string;
    }
  ): AgentConfig {
    return {
      ...agent,
      ...additionalData,
      appId: (additionalData as any).appId,
      maxTokens: (additionalData as any).maxTokens,
      temperature: (additionalData as any).temperature,
      systemPrompt: (additionalData as any).systemPrompt,
      rateLimit: (additionalData as any).rateLimit,
      type: (additionalData as any).type,
      createdBy: (additionalData as any).createdBy,
      updatedBy: (additionalData as any).updatedBy,
      version: (additionalData as any).version,
      tags: (additionalData as any).tags,
      metadata: (additionalData as any).metadata
    };
  }

  /**
   * 从API响应创建Agent
   * @param data API响应数据
   * @returns Agent实例或null
   */
  static fromApiResponse(data: unknown): Agent | null {
    if (!TypeSafeConverter.toAgent(data)) {
      return null;
    }

    const agent = data as Record<string, unknown>;
    return {
      id: TypeSafeConverter.toString(agent.id),
      name: TypeSafeConverter.toString(agent.name),
      description: TypeSafeConverter.toString(agent.description),
      avatar: agent.avatar ? TypeSafeConverter.toString(agent.avatar) : undefined,
      model: TypeSafeConverter.toString(agent.model),
      status: (agent.status as AgentStatus) || 'inactive',
      capabilities: Array.isArray(agent.capabilities) ? agent.capabilities as AgentCapability[] : [],
      provider: (agent.provider as ProviderType) || 'custom',
      isActive: TypeSafeConverter.toBoolean(agent.isActive, true),
      workspaceType: agent.workspaceType as WorkspaceType,
      lastChecked: agent.lastChecked ? TypeSafeConverter.toString(agent.lastChecked) : undefined,
      responseTime: agent.responseTime ? TypeSafeConverter.toNumber(agent.responseTime) : undefined,
      error: agent.error ? TypeSafeConverter.toString(agent.error) : undefined
    };
  }

  /**
   * 转换为API响应格式
   * @param agent Agent实例
   * @returns API响应格式数据
   */
  static toApiResponse(agent: Agent): JsonObject {
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description || undefined,
      avatar: agent.avatar || undefined,
      model: agent.model || undefined,
      status: agent.status || undefined,
      capabilities: agent.capabilities || undefined,
      provider: agent.provider || undefined,
      isActive: agent.isActive || undefined,
      workspaceType: agent.workspaceType || undefined,
      lastChecked: agent.lastChecked || undefined,
      responseTime: agent.responseTime || undefined,
      error: agent.error || undefined
    };
  }
}

// ============================================================================
// 会话转换器
// ============================================================================

/**
 * 会话转换器类
 */
export class SessionConverter {
  /**
   * 标准化会话数据
   * @param session 原始会话数据
   * @returns 标准化的会话数据
   */
  static normalize(session: unknown): ChatSession | null {
    if (!session || typeof session !== 'object') {
      return null;
    }

    const data = session as Record<string, unknown>;

    return {
      id: TypeSafeConverter.toString(data.id),
      title: TypeSafeConverter.toString(data.title),
      agentId: TypeSafeConverter.toString(data.agentId),
      userId: data.userId ? TypeSafeConverter.toString(data.userId) : undefined,
      messages: Array.isArray(data.messages) ?
        data.messages.filter((msg: unknown) => TypeSafeConverter.toStandardMessage(msg as any)) as StandardMessage[] :
        undefined,
      simpleMessages: Array.isArray(data.simpleMessages) ?
        data.simpleMessages.filter((msg: unknown) => TypeSafeConverter.toSimpleMessage(msg as any)) as SimpleMessage[] :
        undefined,
      createdAt: this.normalizeDate(data.createdAt) || new Date(),
      updatedAt: this.normalizeDate(data.updatedAt) || new Date(),
      status: (data.status as SessionStatus) || 'active',
      type: (data.type as SessionType) || 'chat',
      lastAccessedAt: data.lastAccessedAt ? TypeSafeConverter.toNumber(data.lastAccessedAt) : undefined,
      messageCount: data.messageCount ? TypeSafeConverter.toNumber(data.messageCount) : undefined,
      isPinned: TypeSafeConverter.toBoolean(data.isPinned, false),
      tags: Array.isArray(data.tags) ? data.tags.map(tag => TypeSafeConverter.toString(tag)) : undefined,
      isArchived: TypeSafeConverter.toBoolean(data.isArchived, false),
      metadata: data.metadata as any,
      settings: data.settings as any,
      sharing: data.sharing as any
    };
  }

  /**
   * 规范化日期值
   * @param date 日期值
   * @returns Date对象或undefined
   */
  private static normalizeDate(date: unknown): Date | undefined {
    if (date instanceof Date) return date;
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    if (typeof date === 'number') {
      return new Date(date);
    }
    return undefined;
  }

  /**
   * 创建会话摘要
   * @param session 会话数据
   * @param maxLength 最大摘要长度
   * @returns 会话摘要
   */
  static createSummary(session: ChatSession, maxLength: number = 100): string {
    if (session.messages && session.messages.length > 0) {
      const firstMessage = session.messages.find(msg => msg.role === 'user');
      if (firstMessage) {
        return firstMessage.content.length > maxLength
          ? firstMessage.content.substring(0, maxLength) + '...'
          : firstMessage.content;
      }
    }
    return session.title;
  }

  /**
   * 计算会话统计信息
   * @param session 会话数据
   * @returns 统计信息
   */
  static calculateStats(session: ChatSession): {
    messageCount: number;
    userMessageCount: number;
    aiMessageCount: number;
    totalTokens?: number;
    averageResponseTime?: number;
  } {
    const messages = session.messages || [];
    const userMessages = messages.filter(msg => msg.role === 'user');
    const aiMessages = messages.filter(msg => msg.role === 'assistant');

    let totalTokens = 0;
    let responseTimes: number[] = [];

    for (const message of messages) {
      if (message.metadata?.tokens) {
        totalTokens += message.metadata.tokens;
      }

      if (message.metadata?.responseTime) {
        responseTimes.push(message.metadata.responseTime);
      }
    }

    return {
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      aiMessageCount: aiMessages.length,
      totalTokens: totalTokens || undefined,
      averageResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : undefined
    };
  }

  /**
   * 按智能体分组会话
   * @param sessions 会话列表
   * @returns 按智能体分组的会话映射
   */
  static groupByAgent(sessions: ChatSession[]): Record<string, ChatSession[]> {
    const grouped: Record<string, ChatSession[]> = {};

    for (const session of sessions) {
      const agentId = session.agentId;
      if (!grouped[agentId]) {
        grouped[agentId] = [];
      }
      grouped[agentId].push(session);
    }

    // 对每个智能体的会话按更新时间排序
    for (const agentId of Object.keys(grouped)) {
      grouped[agentId].sort((a, b) => {
        const aTime = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
        const bTime = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
        return bTime - aTime; // 降序排列
      });
    }

    return grouped;
  }
}

// ============================================================================
// 用户转换器
// ============================================================================

/**
 * 用户转换器类
 */
export class UserConverter {
  /**
   * 从API响应创建用户
   * @param data API响应数据
   * @returns User实例或null
   */
  static fromApiResponse(data: unknown): User | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const user = data as Record<string, unknown>;

    return {
      id: TypeSafeConverter.toString(user.id),
      username: TypeSafeConverter.toString(user.username),
      email: TypeSafeConverter.toString(user.email),
      displayName: user.displayName ? TypeSafeConverter.toString(user.displayName) : undefined,
      avatar: user.avatar ? TypeSafeConverter.toString(user.avatar) : undefined,
      role: (user.role as UserRole) || 'user',
      status: (user.status as UserStatus) || 'active',
      permissions: Array.isArray(user.permissions) ? user.permissions as Permission[] : undefined,
      createdAt: TypeSafeConverter.toString(user.createdAt),
      updatedAt: TypeSafeConverter.toString(user.updatedAt),
      lastLoginAt: user.lastLoginAt ? TypeSafeConverter.toString(user.lastLoginAt) : undefined,
      lastLoginIp: user.lastLoginIp ? TypeSafeConverter.toString(user.lastLoginIp) : undefined,
      authProvider: (user.authProvider as AuthProvider) || 'local',
      externalId: user.externalId ? TypeSafeConverter.toString(user.externalId) : undefined,
      emailVerified: TypeSafeConverter.toBoolean(user.emailVerified, false),
      phoneVerified: user.phoneVerified ? TypeSafeConverter.toBoolean(user.phoneVerified) : undefined,
      phoneNumber: user.phoneNumber ? TypeSafeConverter.toString(user.phoneNumber) : undefined,
      timezone: user.timezone ? TypeSafeConverter.toString(user.timezone) : undefined,
      language: user.language ? TypeSafeConverter.toString(user.language) : undefined,
      tags: Array.isArray(user.tags) ? user.tags.map(tag => TypeSafeConverter.toString(tag)) : undefined,
      metadata: user.metadata as any
    };
  }

  /**
   * 转换为API响应格式
   * @param user User实例
   * @param includeSensitive 是否包含敏感信息
   * @returns API响应格式数据
   */
  static toApiResponse(user: User, includeSensitive: boolean = false): JsonObject {
    const baseData = {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      phoneNumber: user.phoneNumber,
      timezone: user.timezone,
      language: user.language,
      tags: user.tags
    };

    if (includeSensitive) {
      return {
        ...baseData,
        lastLoginIp: user.lastLoginIp || undefined,
        externalId: user.externalId || undefined,
        metadata: user.metadata ? UniversalConverter.convertToJsonObject(user.metadata) : undefined
      };
    }

    return baseData;
  }

  /**
   * 创建用户公开信息
   * @param user User实例
   * @returns 公开的用户信息
   */
  static toPublicProfile(user: User): JsonObject {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName || undefined,
      avatar: user.avatar || undefined,
      role: user.role || undefined,
      bio: user.metadata?.bio || undefined,
      organization: user.metadata?.organization || undefined,
      position: user.metadata?.position || undefined,
      website: user.metadata?.website || undefined,
      socialLinks: user.metadata?.socialLinks || undefined,
      createdAt: user.createdAt || undefined
    };
  }
}

// ============================================================================
// 通用转换器
// ============================================================================

/**
 * 通用转换器类
 */
export class UniversalConverter {
  /**
   * 深度转换对象类型
   * @param obj 源对象
   * @param schema 转换模式
   * @returns 转换后的对象
   */
  static deepConvert(obj: unknown, schema: Record<string, (value: unknown) => unknown>): JsonObject {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    const result: Record<string, JsonValue> = {};

    for (const [key, converter] of Object.entries(schema)) {
      if (key in obj) {
        const value = converter((obj as any)[key]);
        if (value !== undefined && value !== null) {
          result[key] = value as JsonValue;
        }
      }
    }

    return result;
  }

  /**
   * 将任意对象转换为JsonObject
   */
  static convertToJsonObject(obj: any): JsonObject {
    if (obj === null || obj === undefined) {
      return {};
    }

    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return { value: obj };
    }

    if (Array.isArray(obj)) {
      return { items: obj.map(item => this.convertToJsonObject(item)) };
    }

    if (typeof obj === 'object') {
      const result: Record<string, JsonValue> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertToJsonObject(value);
      }
      return result;
    }

    return { value: String(obj) };
  }

  /**
   * 安全的JSON序列化
   * @param data 要序列化的数据
   * @param space 缩进空格数
   * @returns JSON字符串
   */
  static safeJsonStringify(data: unknown, space: number = 2): string {
    try {
      return JSON.stringify(data, this.jsonReplacer, space);
    } catch (error) {
      console.error('JSON序列化失败:', error);
      return JSON.stringify({ error: 'Serialization failed' });
    }
  }

  /**
   * 安全的JSON反序列化
   * @param json JSON字符串
   * @returns 解析后的对象或null
   */
  static safeJsonParse(json: string): unknown {
    try {
      return JSON.parse(json);
    } catch (error) {
      console.error('JSON解析失败:', error);
      return null;
    }
  }

  /**
   * JSON替换函数，处理特殊值
   */
  private static jsonReplacer(key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value instanceof Map) {
      return Array.from(value.entries());
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'function') {
      return '[Function]';
    }
    if (typeof value === 'symbol') {
      return value.toString();
    }
    if (value === undefined) {
      return null;
    }
    return value;
  }

  /**
   * 复制对象（深拷贝）
   * @param obj 要复制的对象
   * @returns 复制后的对象
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }

  /**
   * 合并对象（深合并）
   * @param target 目标对象
   * @param sources 源对象列表
   * @returns 合并后的对象
   */
  static deepMerge<T extends JsonObject>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key] as JsonObject, source[key] as JsonObject);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * 检查是否为对象
   */
  private static isObject(item: unknown): boolean {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
  }
}