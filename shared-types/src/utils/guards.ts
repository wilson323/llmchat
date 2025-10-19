/**
 * 类型守卫工具库
 *
 * 提供运行时类型验证和安全的类型守卫函数
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
  FeedbackType,
  AttachmentMetadata,
  VoiceNoteMetadata,
  InteractiveData,
  ReasoningState,

  // Session相关
  ChatSession,
  SessionStatus,
  SessionType,
  AgentSessionsMap,

  // User相关
  User,
  UserRole,
  UserStatus,
  AuthProvider,
  Permission,

  // 基础类型
  JsonValue,
  JsonObject,
  UnknownValue,
} from '../index';

// ============================================================================
// 基础类型守卫
// ============================================================================

/**
 * 检查是否为字符串
 */
export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

/**
 * 检查是否为数字
 */
export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

/**
 * 检查是否为布尔值
 */
export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

/**
 * 检查是否为null
 */
export const isNull = (value: unknown): value is null => {
  return value === null;
};

/**
 * 检查是否为undefined
 */
export const isUndefined = (value: unknown): value is undefined => {
  return value === undefined;
};

/**
 * 检查是否为null或undefined
 */
export const isNullOrUndefined = (value: unknown): value is null | undefined => {
  return isNull(value) || isUndefined(value);
};

/**
 * 检查是否为有效的日期
 */
export const isValidDate = (value: unknown): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};

/**
 * 检查是否为有效的日期字符串
 */
export const isDateString = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
};

/**
 * 检查是否为有效的邮箱地址
 */
export const isEmail = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};

/**
 * 检查是否为有效的URL
 */
export const isUrl = (value: unknown): value is string => {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * 检查是否为有效的UUID
 */
export const isUuid = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * 检查是否为有效的JSON值
 */
export const isJsonValue = (value: unknown): value is JsonValue => {
  if (isPrimitive(value)) return true;
  if (Array.isArray(value)) return value.every(item => isJsonValue(item));
  if (isObject(value)) return Object.values(value).every(item => isJsonValue(item));
  return false;
};

/**
 * 检查是否为原始类型
 */
const isPrimitive = (value: unknown): value is string | number | boolean | null => {
  return isString(value) || isNumber(value) || isBoolean(value) || isNull(value);
};

/**
 * 检查是否为普通对象
 */
const isObject = (value: unknown): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// ============================================================================
// Agent相关类型守卫
// ============================================================================

/**
 * 检查是否为有效的ProviderType
 */
export const isProviderType = (value: unknown): value is ProviderType => {
  const validProviders: ProviderType[] = ['fastgpt', 'openai', 'anthropic', 'dify', 'dashscope', 'custom'];
  return isString(value) && validProviders.includes(value as ProviderType);
};

/**
 * 检查是否为有效的AgentStatus
 */
export const isAgentStatus = (value: unknown): value is AgentStatus => {
  const validStatuses: AgentStatus[] = ['active', 'inactive', 'error', 'loading', 'maintenance'];
  return isString(value) && validStatuses.includes(value as AgentStatus);
};

/**
 * 检查是否为有效的WorkspaceType
 */
export const isWorkspaceType = (value: unknown): value is WorkspaceType => {
  const validTypes: WorkspaceType[] = ['chat', 'product-preview', 'voice-call', 'cad-analysis', 'custom'];
  return isString(value) && validTypes.includes(value as WorkspaceType);
};

/**
 * 检查是否为有效的AgentCapability
 */
export const isAgentCapability = (value: unknown): value is AgentCapability => {
  const validCapabilities: AgentCapability[] = [
    'text-generation', 'code-generation', 'image-analysis', 'file-processing',
    'voice-support', 'streaming', 'interactive', 'reasoning', 'cad-parsing', '3d-analysis'
  ];
  return isString(value) && validCapabilities.includes(value as AgentCapability);
};

/**
 * 检查是否为有效的AgentFeatures
 */
export const isAgentFeatures = (value: unknown): value is AgentFeatures => {
  if (!isObject(value)) return false;

  const features = value as Record<string, unknown>;
  return (
    isBoolean(features.supportsChatId) &&
    isBoolean(features.supportsStream) &&
    isBoolean(features.supportsDetail) &&
    isBoolean(features.supportsFiles) &&
    isBoolean(features.supportsImages) &&
    isObject(features.streamingConfig) &&
    isBoolean((features.streamingConfig as any).enabled) &&
    isString((features.streamingConfig as any).endpoint) &&
    isBoolean((features.streamingConfig as any).statusEvents) &&
    isBoolean((features.streamingConfig as any).flowNodeStatus)
  );
};

/**
 * 检查是否为有效的Agent
 */
export const isAgent = (value: unknown): value is Agent => {
  if (!isObject(value)) return false;

  const agent = value as Record<string, unknown>;
  return (
    isString(agent.id) &&
    isString(agent.name) &&
    isString(agent.description) &&
    isString(agent.model) &&
    isAgentStatus(agent.status) &&
    isProviderType(agent.provider) &&
    isBoolean(agent.isActive) &&
    Array.isArray(agent.capabilities) &&
    (agent.capabilities as unknown[]).every(isAgentCapability) &&
    (agent.avatar === undefined || isString(agent.avatar)) &&
    (agent.workspaceType === undefined || isWorkspaceType(agent.workspaceType))
  );
};

/**
 * 检查是否为有效的AgentConfig
 */
export const isAgentConfig = (value: unknown): value is AgentConfig => {
  if (!isAgent(value)) return false;

  const config = value as unknown as Record<string, unknown>;
  return (
    isString(config.endpoint) &&
    isString(config.apiKey) &&
    isAgentFeatures(config.features) &&
    isDateString(config.createdAt) &&
    isDateString(config.updatedAt) &&
    (config.maxTokens === undefined || isNumber(config.maxTokens)) &&
    (config.temperature === undefined || isNumber(config.temperature)) &&
    (config.systemPrompt === undefined || isString(config.systemPrompt)) &&
    (config.appId === undefined || isString(config.appId))
  );
};

// ============================================================================
// Message相关类型守卫
// ============================================================================

/**
 * 检查是否为有效的MessageRole
 */
export const isMessageRole = (value: unknown): value is MessageRole => {
  const validRoles: MessageRole[] = ['user', 'assistant', 'system', 'function', 'tool'];
  return isString(value) && validRoles.includes(value as MessageRole);
};

/**
 * 检查是否为有效的MessageStatus
 */
export const isMessageStatus = (value: unknown): value is MessageStatus => {
  const validStatuses: MessageStatus[] = ['sending', 'sent', 'delivered', 'read', 'processing', 'completed', 'failed', 'cancelled'];
  return isString(value) && validStatuses.includes(value as MessageStatus);
};

/**
 * 检查是否为有效的FeedbackType
 */
export const isFeedbackType = (value: unknown): value is FeedbackType => {
  return value === 'good' || value === 'bad' || value === null;
};

/**
 * 检查是否为有效的AttachmentMetadata
 */
export const isAttachmentMetadata = (value: unknown): value is AttachmentMetadata => {
  if (!isObject(value)) return false;

  const attachment = value as Record<string, unknown>;
  return (
    isString(attachment.id) &&
    isString(attachment.url) &&
    isString(attachment.name) &&
    isNumber(attachment.size) &&
    isString(attachment.mimeType) &&
    (attachment.source === undefined || ['upload', 'voice', 'external', 'generated', 'import'].includes(attachment.source as string))
  );
};

/**
 * 检查是否为有效的VoiceNoteMetadata
 */
export const isVoiceNoteMetadata = (value: unknown): value is VoiceNoteMetadata => {
  if (!isObject(value)) return false;

  const voiceNote = value as Record<string, unknown>;
  return (
    isString(voiceNote.id) &&
    isString(voiceNote.url) &&
    isNumber(voiceNote.duration) &&
    isString(voiceNote.mimeType) &&
    (voiceNote.size === undefined || isNumber(voiceNote.size))
  );
};

/**
 * 检查是否为有效的InteractiveData
 */
export const isInteractiveData = (value: unknown): value is InteractiveData => {
  if (!isObject(value)) return false;

  const interactive = value as Record<string, unknown>;
  const type = interactive.type;

  if (type === 'userSelect') {
    return (
      isString(interactive.origin) &&
      isObject(interactive.params) &&
      Array.isArray((interactive.params as any).userSelectOptions)
    );
  } else if (type === 'userInput') {
    return (
      isString(interactive.origin) &&
      isObject(interactive.params) &&
      Array.isArray((interactive.params as any).inputForm)
    );
  }

  return false;
};

/**
 * 检查是否为有效的ReasoningState
 */
export const isReasoningState = (value: unknown): value is ReasoningState => {
  if (!isObject(value)) return false;

  const reasoning = value as Record<string, unknown>;
  return (
    Array.isArray(reasoning.steps) &&
    (reasoning.totalSteps === undefined || isNumber(reasoning.totalSteps)) &&
    (reasoning.finished === undefined || isBoolean(reasoning.finished)) &&
    (reasoning.lastUpdatedAt === undefined || isNumber(reasoning.lastUpdatedAt))
  );
};

/**
 * 检查是否为有效的StandardMessage
 */
export const isStandardMessage = (value: unknown): value is StandardMessage => {
  if (!isObject(value)) return false;

  const message = value as Record<string, unknown>;
  return (
    isString(message.id) &&
    isMessageRole(message.role) &&
    isString(message.content) &&
    isNumber(message.timestamp) &&
    (message.status === undefined || isMessageStatus(message.status)) &&
    (message.attachments === undefined || Array.isArray(message.attachments) && (message.attachments as unknown[]).every(isAttachmentMetadata)) &&
    (message.voiceNote === undefined || isVoiceNoteMetadata(message.voiceNote) || message.voiceNote === null)
  );
};

/**
 * 检查是否为有效的SimpleMessage
 */
export const isSimpleMessage = (value: unknown): value is SimpleMessage => {
  if (!isObject(value)) return false;

  const message = value as Record<string, unknown>;
  return (
    (message.AI === undefined || isString(message.AI)) &&
    (message.HUMAN === undefined || isString(message.HUMAN)) &&
    (message.id === undefined || isString(message.id)) &&
    (message.feedback === undefined || isFeedbackType(message.feedback)) &&
    (message.timestamp === undefined || isNumber(message.timestamp)) &&
    (message.interactive === undefined || isInteractiveData(message.interactive)) &&
    (message.reasoning === undefined || isReasoningState(message.reasoning))
  );
};

// ============================================================================
// Session相关类型守卫
// ============================================================================

/**
 * 检查是否为有效的SessionStatus
 */
export const isSessionStatus = (value: unknown): value is SessionStatus => {
  const validStatuses: SessionStatus[] = ['active', 'inactive', 'archived', 'deleted', 'locked'];
  return isString(value) && validStatuses.includes(value as SessionStatus);
};

/**
 * 检查是否为有效的SessionType
 */
export const isSessionType = (value: unknown): value is SessionType => {
  const validTypes: SessionType[] = ['chat', 'voice', 'file_analysis', 'cad_analysis', 'product_preview', 'custom'];
  return isString(value) && validTypes.includes(value as SessionType);
};

/**
 * 检查是否为有效的ChatSession
 */
export const isChatSession = (value: unknown): value is ChatSession => {
  if (!isObject(value)) return false;

  const session = value as Record<string, unknown>;
  return (
    isString(session.id) &&
    isString(session.title) &&
    isString(session.agentId) &&
    (session.messages === undefined || Array.isArray(session.messages) && (session.messages as unknown[]).every(isStandardMessage)) &&
    (session.simpleMessages === undefined || Array.isArray(session.simpleMessages) && (session.simpleMessages as unknown[]).every(isSimpleMessage)) &&
    (session.status === undefined || isSessionStatus(session.status)) &&
    (session.type === undefined || isSessionType(session.type))
  );
};

/**
 * 检查是否为有效的AgentSessionsMap
 */
export const isAgentSessionsMap = (value: unknown): value is AgentSessionsMap => {
  if (!isObject(value)) return false;

  const map = value as Record<string, unknown>;
  return Object.entries(map).every(([agentId, sessions]) => {
    return isString(agentId) && Array.isArray(sessions) && (sessions as unknown[]).every(isChatSession);
  });
};

// ============================================================================
// User相关类型守卫
// ============================================================================

/**
 * 检查是否为有效的UserRole
 */
export const isUserRole = (value: unknown): value is UserRole => {
  const validRoles: UserRole[] = ['admin', 'moderator', 'user', 'guest', 'developer'];
  return isString(value) && validRoles.includes(value as UserRole);
};

/**
 * 检查是否为有效的UserStatus
 */
export const isUserStatus = (value: unknown): value is UserStatus => {
  const validStatuses: UserStatus[] = ['active', 'inactive', 'suspended', 'banned', 'pending', 'deleted'];
  return isString(value) && validStatuses.includes(value as UserStatus);
};

/**
 * 检查是否为有效的AuthProvider
 */
export const isAuthProvider = (value: unknown): value is AuthProvider => {
  const validProviders: AuthProvider[] = ['local', 'oauth', 'ldap', 'saml', 'jwt', 'apikey'];
  return isString(value) && validProviders.includes(value as AuthProvider);
};

/**
 * 检查是否为有效的Permission
 */
export const isPermission = (value: unknown): value is Permission => {
  const validPermissions: Permission[] = [
    'read:agents', 'write:agents', 'delete:agents',
    'read:sessions', 'write:sessions', 'delete:sessions',
    'read:users', 'write:users', 'delete:users',
    'admin:system', 'read:analytics', 'export:data', 'import:data'
  ];
  return isString(value) && validPermissions.includes(value as Permission);
};

/**
 * 检查是否为有效的User
 */
export const isUser = (value: unknown): value is User => {
  if (!isObject(value)) return false;

  const user = value as Record<string, unknown>;
  return (
    isString(user.id) &&
    isString(user.username) &&
    isEmail(user.email) &&
    isUserRole(user.role) &&
    isUserStatus(user.status) &&
    isAuthProvider(user.authProvider) &&
    isDateString(user.createdAt) &&
    isDateString(user.updatedAt) &&
    isBoolean(user.emailVerified) &&
    (user.displayName === undefined || isString(user.displayName)) &&
    (user.avatar === undefined || isString(user.avatar)) &&
    (user.permissions === undefined || Array.isArray(user.permissions) && (user.permissions as unknown[]).every(isPermission))
  );
};

// ============================================================================
// 高级类型守卫工具类
// ============================================================================

/**
 * 动态类型守卫类
 */
export class DynamicTypeGuard {
  /**
   * 深度检查对象类型
   */
  static deepCheck(obj: unknown, schema: Record<string, (value: unknown) => boolean>): boolean {
    if (!isObject(obj)) return false;

    for (const [key, validator] of Object.entries(schema)) {
      if (!(key in obj) || !validator((obj as any)[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查数组类型
   */
  static isArray<T>(value: unknown, itemGuard: (item: unknown) => item is T): value is T[] {
    return Array.isArray(value) && value.every(itemGuard);
  }

  /**
   * 检查可选字段
   */
  static optionalField<T>(value: unknown, guard: (value: unknown) => value is T): value is T | undefined {
    return value === undefined || guard(value);
  }

  /**
   * 检查联合类型
   */
  static isUnion<T>(value: unknown, guards: Array<(value: unknown) => value is T>): value is T {
    return guards.some(guard => guard(value));
  }

  /**
   * 检查字面量类型
   */
  static isLiteral<T extends string | number | boolean>(value: unknown, literals: T[]): value is T {
    return literals.includes(value as T);
  }
}

/**
 * 类型安全转换器
 */
export class TypeSafeConverter {
  /**
   * 安全转换为Agent
   */
  static toAgent(value: unknown): Agent | null {
    if (isAgent(value)) return value;
    return null;
  }

  /**
   * 安全转换为AgentConfig
   */
  static toAgentConfig(value: unknown): AgentConfig | null {
    if (isAgentConfig(value)) return value;
    return null;
  }

  /**
   * 安全转换为StandardMessage
   */
  static toStandardMessage(value: unknown): StandardMessage | null {
    if (isStandardMessage(value)) return value;
    return null;
  }

  /**
   * 安全转换为SimpleMessage
   */
  static toSimpleMessage(value: unknown): SimpleMessage | null {
    if (isSimpleMessage(value)) return value;
    return null;
  }

  /**
   * 安全转换为ChatSession
   */
  static toChatSession(value: unknown): ChatSession | null {
    if (isChatSession(value)) return value;
    return null;
  }

  /**
   * 安全转换为User
   */
  static toUser(value: unknown): User | null {
    if (isUser(value)) return value;
    return null;
  }

  /**
   * 安全转换为JsonValue
   */
  static toJsonValue(value: unknown, defaultValue: JsonValue = null): JsonValue {
    if (isJsonValue(value)) return value;

    // 尝试转换常见类型
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (value === undefined) return null;

    return defaultValue;
  }

  /**
   * 安全转换为数组
   */
  static toArray<T>(value: unknown, itemGuard: (item: unknown) => item is T, defaultValue: T[] = []): T[] {
    if (Array.isArray(value) && value.every(itemGuard)) {
      return value as T[];
    }
    return defaultValue;
  }

  /**
   * 安全转换为字符串
   */
  static toString(value: unknown, defaultValue: string = ''): string {
    if (isString(value)) return value;
    if (isNumber(value) || isBoolean(value)) return String(value);
    return defaultValue;
  }

  /**
   * 安全转换为数字
   */
  static toNumber(value: unknown, defaultValue: number = 0): number {
    if (isNumber(value)) return value;
    if (isString(value)) {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }

  /**
   * 安全转换为布尔值
   */
  static toBoolean(value: unknown, defaultValue: boolean = false): boolean {
    if (isBoolean(value)) return value;
    if (isString(value)) {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    if (isNumber(value)) return value !== 0;
    return defaultValue;
  }
}

// ============================================================================
// 验证结果类型
// ============================================================================

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
  /** 警告列表 */
  warnings: ValidationWarning[];
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  /** 字段路径 */
  field: string;
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code: string;
  /** 错误值 */
  value?: unknown;
}

/**
 * 验证警告接口
 */
export interface ValidationWarning {
  /** 字段路径 */
  field: string;
  /** 警告消息 */
  message: string;
  /** 警告代码 */
  code: string;
  /** 警告值 */
  value?: unknown;
}

/**
 * 验证器工具类
 */
export class Validator {
  /**
   * 验证Agent
   */
  static validateAgent(value: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!isAgent(value)) {
      if (!isObject(value)) {
        errors.push({
          field: 'root',
          message: 'Agent must be an object',
          code: 'INVALID_TYPE',
          value
        });
      } else {
        const agent = value as Record<string, unknown>;

        if (!isString(agent.id)) {
          errors.push({
            field: 'id',
            message: 'Agent ID must be a string',
            code: 'INVALID_TYPE',
            value: agent.id
          });
        }

        if (!isString(agent.name)) {
          errors.push({
            field: 'name',
            message: 'Agent name must be a string',
            code: 'INVALID_TYPE',
            value: agent.name
          });
        }

        if (!isAgentStatus(agent.status)) {
          errors.push({
            field: 'status',
            message: 'Invalid agent status',
            code: 'INVALID_VALUE',
            value: agent.status
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证消息
   */
  static validateMessage(value: unknown, format: 'standard' | 'simple' = 'standard'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const guard = format === 'standard' ? isStandardMessage : isSimpleMessage;

    if (!guard(value)) {
      if (!isObject(value)) {
        errors.push({
          field: 'root',
          message: 'Message must be an object',
          code: 'INVALID_TYPE',
          value
        });
      } else {
        const message = value as Record<string, unknown>;

        if (format === 'standard') {
          if (!isString((message as any).id)) {
            errors.push({
              field: 'id',
              message: 'Message ID must be a string',
              code: 'INVALID_TYPE',
              value: (message as any).id
            });
          }

          if (!isMessageRole((message as any).role)) {
            errors.push({
              field: 'role',
              message: 'Invalid message role',
              code: 'INVALID_VALUE',
              value: (message as any).role
            });
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证会话
   */
  static validateSession(value: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!isChatSession(value)) {
      if (!isObject(value)) {
        errors.push({
          field: 'root',
          message: 'Session must be an object',
          code: 'INVALID_TYPE',
          value
        });
      } else {
        const session = value as Record<string, unknown>;

        if (!isString(session.id)) {
          errors.push({
            field: 'id',
            message: 'Session ID must be a string',
            code: 'INVALID_TYPE',
            value: session.id
          });
        }

        if (!isString(session.title)) {
          errors.push({
            field: 'title',
            message: 'Session title must be a string',
            code: 'INVALID_TYPE',
            value: session.title
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证用户
   */
  static validateUser(value: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!isUser(value)) {
      if (!isObject(value)) {
        errors.push({
          field: 'root',
          message: 'User must be an object',
          code: 'INVALID_TYPE',
          value
        });
      } else {
        const user = value as Record<string, unknown>;

        if (!isString(user.id)) {
          errors.push({
            field: 'id',
            message: 'User ID must be a string',
            code: 'INVALID_TYPE',
            value: user.id
          });
        }

        if (!isEmail(user.email)) {
          errors.push({
            field: 'email',
            message: 'Invalid email address',
            code: 'INVALID_FORMAT',
            value: user.email
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}