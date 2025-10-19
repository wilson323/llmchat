/**
 * API响应类型验证工具
 *
 * 专门为LLMChat前端项目的API响应设计类型验证器。
 * 确保从后端接收的数据符合预期的类型结构。
 *
 * @module api-type-validators
 * @version 2.0.0
 * @since 2025-10-18
 */

import { RuntimeTypeValidator, objectValidatorFactory, enumValidator, arrayValidator, uuidValidator, timestampValidator } from './runtime-type-validator';
import { ApiResponse, ApiErrorResponse, PaginatedData, BatchOperationResult } from '@/types/api';
import { Agent, AgentConfig, AgentStatus, ChatMessage, ChatSession, ThemeMode, MessageStatus, WorkspaceType } from '@/types';

// ============================================================================
// 基础API验证器
// ============================================================================

/**
 * 创建通用API响应验证器
 */
export const createApiResponseValidator = <T>(dataValidator: RuntimeTypeValidator<T>): RuntimeTypeValidator<ApiResponse<T>> => {
  return objectValidatorFactory({
    code: RuntimeTypeValidator.create<string>().required(),
    message: RuntimeTypeValidator.create<string>().required(),
    data: dataValidator.required(),
    timestamp: stringValidator().required()
  });
};

/**
 * API错误响应验证器
 */
export const apiErrorResponseValidator = objectValidatorFactory({
  code: RuntimeTypeValidator.create<string>().required(),
  message: RuntimeTypeValidator.create<string>().required(),
  data: RuntimeTypeValidator.create<null>(),
  timestamp: stringValidator().required(),
  error: objectValidatorFactory({
    details: RuntimeTypeValidator.create<string>().optional(),
    stack: RuntimeTypeValidator.create<string>().optional()
  }).optional()
});

/**
 * 分页数据验证器工厂
 */
export const createPaginatedDataValidator = <T>(itemValidator: RuntimeTypeValidator<T>): RuntimeTypeValidator<PaginatedData<T>> => {
  return objectValidatorFactory({
    items: arrayValidator(itemValidator).required(),
    total: RuntimeTypeValidator.create<number>().required(),
    page: RuntimeTypeValidator.create<number>().required(),
    pageSize: RuntimeTypeValidator.create<number>().required(),
    totalPages: RuntimeTypeValidator.create<number>().required()
  });
};

/**
 * 批量操作结果验证器
 */
export const batchOperationResultValidator = objectValidatorFactory({
  success: RuntimeTypeValidator.create<number>().required(),
  failed: RuntimeTypeValidator.create<number>().required(),
  errors: arrayValidator(
    objectValidatorFactory({
      id: RuntimeTypeValidator.create<string>().required(),
      error: RuntimeTypeValidator.create<string>().required()
    })
  ).optional()
});

// ============================================================================
// 智能体相关验证器
// ============================================================================

/**
 * 智能体状态验证器
 */
export const agentStatusValidator = enumValidator(['active', 'inactive', 'error', 'loading'] as const, 'AgentStatus');

/**
 * 工作区类型验证器
 */
export const workspaceTypeValidator = enumValidator(['chat', 'product-preview', 'voice-call', 'custom'] as const, 'WorkspaceType');

/**
 * 智能体验证器
 */
export const agentValidator = objectValidatorFactory({
  id: uuidValidator().required(),
  name: RuntimeTypeValidator.create<string>().required(),
  description: RuntimeTypeValidator.create<string>().required(),
  avatar: RuntimeTypeValidator.create<string>().optional(),
  model: RuntimeTypeValidator.create<string>().required(),
  status: agentStatusValidator.required(),
  capabilities: arrayValidator(RuntimeTypeValidator.create<string>()).required(),
  provider: RuntimeTypeValidator.create<string>().required(),
  isActive: RuntimeTypeValidator.create<boolean>().optional(),
  workspaceType: workspaceTypeValidator.optional()
});

/**
 * 智能体配置验证器
 */
export const agentConfigValidator = objectValidatorFactory({
  id: uuidValidator().required(),
  appId: RuntimeTypeValidator.create<string>().optional(),
  name: RuntimeTypeValidator.create<string>().required(),
  description: RuntimeTypeValidator.create<string>().required(),
  endpoint: RuntimeTypeValidator.create<string>().required(),
  apiKey: RuntimeTypeValidator.create<string>().required(),
  model: RuntimeTypeValidator.create<string>().required(),
  maxTokens: RuntimeTypeValidator.create<number>().optional(),
  temperature: RuntimeTypeValidator.create<number>().optional(),
  systemPrompt: RuntimeTypeValidator.create<string>().optional(),
  capabilities: arrayValidator(RuntimeTypeValidator.create<string>()).optional(),
  rateLimit: objectValidatorFactory({
    requestsPerMinute: RuntimeTypeValidator.create<number>().required(),
    tokensPerMinute: RuntimeTypeValidator.create<number>().required()
  }).optional(),
  provider: RuntimeTypeValidator.create<string>().required(),
  isActive: RuntimeTypeValidator.create<boolean>().optional(),
  features: objectValidatorFactory({
    supportsChatId: RuntimeTypeValidator.create<boolean>().optional(),
    supportsStream: RuntimeTypeValidator.create<boolean>().optional(),
    supportsDetail: RuntimeTypeValidator.create<boolean>().optional(),
    supportsFiles: RuntimeTypeValidator.create<boolean>().optional(),
    supportsImages: RuntimeTypeValidator.create<boolean>().optional(),
    streamingConfig: objectValidatorFactory({
      enabled: RuntimeTypeValidator.create<boolean>().required(),
      endpoint: RuntimeTypeValidator.create<string>().optional(),
      statusEvents: RuntimeTypeValidator.create<boolean>().optional(),
      flowNodeStatus: RuntimeTypeValidator.create<boolean>().optional()
    }).optional()
  }).optional(),
  createdAt: stringValidator().optional(),
  updatedAt: stringValidator().optional()
});

/**
 * 智能体列表API响应验证器
 */
export const agentsListResponseValidator = createApiResponseValidator(
  arrayValidator(agentValidator)
);

/**
 * 智能体详情API响应验证器
 */
export const agentDetailResponseValidator = createApiResponseValidator(
  agentValidator
);

// ============================================================================
// 聊天相关验证器
// ============================================================================

/**
 * 消息状态验证器
 */
export const messageStatusValidator = enumValidator(['sending', 'sent', 'delivered', 'read', 'failed'] as const, 'MessageStatus');

/**
 * 交互数据验证器
 */
export const interactiveDataValidator = RuntimeTypeValidator.create<any>() // 暂时使用any，后续可以细化;

/**
 * 推理状态验证器
 */
export const reasoningStateValidator = objectValidatorFactory({
  steps: RuntimeTypeValidator.create<any[]>().optional(), // 细化类型
  totalSteps: RuntimeTypeValidator.create<number>().optional(),
  finished: RuntimeTypeValidator.create<boolean>().optional(),
  lastUpdatedAt: RuntimeTypeValidator.create<number>().optional()
}).optional();

/**
 * 语音笔记元数据验证器
 */
export const voiceNoteMetadataValidator = objectValidatorFactory({
  id: uuidValidator().required(),
  url: RuntimeTypeValidator.create<string>().required(),
  duration: RuntimeTypeValidator.create<number>().required(),
  mimeType: RuntimeTypeValidator.create<string>().required(),
  size: RuntimeTypeValidator.create<number>().optional()
});

/**
 * 聊天附件元数据验证器
 */
export const chatAttachmentMetadataValidator = objectValidatorFactory({
  id: uuidValidator().required(),
  url: RuntimeTypeValidator.create<string>().required(),
  name: RuntimeTypeValidator.create<string>().required(),
  size: RuntimeTypeValidator.create<number>().required(),
  mimeType: RuntimeTypeValidator.create<string>().required(),
  source: enumValidator(['upload', 'voice', 'external'] as const).optional()
});

/**
 * 聊天消息验证器
 */
export const chatMessageValidator = objectValidatorFactory({
  AI: RuntimeTypeValidator.create<string>().optional(),
  HUMAN: RuntimeTypeValidator.create<string>().optional(),
  id: RuntimeTypeValidator.create<string>().optional(),
  feedback: enumValidator(['good', 'bad'] as const).optional(),
  interactive: interactiveDataValidator.optional(),
  timestamp: RuntimeTypeValidator.create<number>().optional(),
  reasoning: reasoningStateValidator.optional(),
  events: RuntimeTypeValidator.create<any[]>().optional(), // 细化类型
  attachments: arrayValidator(chatAttachmentMetadataValidator).optional(),
  voiceNote: voiceNoteMetadataValidator.optional()
});

/**
 * 聊天会话验证器
 */
export const chatSessionValidator = objectValidatorFactory({
  id: RuntimeTypeValidator.create<string>().required(),
  title: RuntimeTypeValidator.create<string>().required(),
  agentId: uuidValidator().required(),
  messages: arrayValidator(chatMessageValidator).required(),
  createdAt: RuntimeTypeValidator.create<any>().required(), // Date | number
  updatedAt: RuntimeTypeValidator.create<any>().required(), // Date | number
  lastAccessedAt: RuntimeTypeValidator.create<number>().optional(),
  messageCount: RuntimeTypeValidator.create<number>().optional(),
  isPinned: RuntimeTypeValidator.create<boolean>().optional(),
  tags: arrayValidator(RuntimeTypeValidator.create<string>()).optional(),
  isArchived: RuntimeTypeValidator.create<boolean>().optional(),
  metadata: RuntimeTypeValidator.create<Record<string, any>>().optional()
});

/**
 * 智能体会话映射验证器
 */
export const agentSessionsMapValidator = RuntimeTypeValidator.create<Record<string, ChatSession[]>>();

// ============================================================================
// 聊天API响应验证器
// ============================================================================

/**
 * 聊天历史摘要验证器
 */
export const chatHistorySummaryValidator = objectValidatorFactory({
  chatId: RuntimeTypeValidator.create<string>().required(),
  appId: RuntimeTypeValidator.create<string>().optional(),
  title: RuntimeTypeValidator.create<string>().required(),
  createdAt: RuntimeTypeValidator.create<string>().required(),
  updatedAt: RuntimeTypeValidator.create<string>().required(),
  messageCount: RuntimeTypeValidator.create<number>().optional(),
  tags: arrayValidator(RuntimeTypeValidator.create<string>()).optional(),
  raw: RuntimeTypeValidator.create<any>().optional()
});

/**
 * 聊天历史消息验证器
 */
export const chatHistoryMessageValidator = objectValidatorFactory({
  id: RuntimeTypeValidator.create<string>().optional(),
  dataId: RuntimeTypeValidator.create<string>().optional(),
  role: enumValidator(['user', 'assistant', 'system'] as const).required(),
  content: RuntimeTypeValidator.create<string>().required(),
  feedback: enumValidator(['good', 'bad'] as const).optional(),
  raw: RuntimeTypeValidator.create<any>().optional()
});

/**
 * 聊天历史详情验证器
 */
export const chatHistoryDetailValidator = objectValidatorFactory({
  chatId: RuntimeTypeValidator.create<string>().required(),
  appId: RuntimeTypeValidator.create<string>().optional(),
  title: RuntimeTypeValidator.create<string>().optional(),
  messages: arrayValidator(chatHistoryMessageValidator).required(),
  metadata: RuntimeTypeValidator.create<Record<string, any>>().optional()
});

/**
 * 聊天响应验证器
 */
export const chatResponseValidator = objectValidatorFactory({
  id: RuntimeTypeValidator.create<string>().required(),
  object: RuntimeTypeValidator.create<string>().required(),
  created: RuntimeTypeValidator.create<number>().required(),
  model: RuntimeTypeValidator.create<string>().required(),
  choices: arrayValidator(
    objectValidatorFactory({
      index: RuntimeTypeValidator.create<number>().required(),
      message: RuntimeTypeValidator.create<any>().required(), // OriginalChatMessage
      finish_reason: RuntimeTypeValidator.create<string>().required()
    })
  ).required(),
  usage: objectValidatorFactory({
    prompt_tokens: RuntimeTypeValidator.create<number>().required(),
    completion_tokens: RuntimeTypeValidator.create<number>().required(),
    total_tokens: RuntimeTypeValidator.create<number>().required()
  }).optional()
});

/**
 * 聊天API响应验证器
 */
export const chatApiResponseValidator = createApiResponseValidator(
  chatMessageValidator
);

/**
 * 聊天历史API响应验证器
 */
export const chatHistoryResponseValidator = createApiResponseValidator(
  arrayValidator(chatHistorySummaryValidator)
);

/**
 * 聊天会话API响应验证器
 */
export const chatSessionResponseValidator = createApiResponseValidator(
  chatSessionValidator
);

// ============================================================================
// 用户和设置相关验证器
// ============================================================================

/**
 * 主题模式验证器
 */
export const themeModeValidator = enumValidator(['light', 'dark', 'auto'] as const, 'ThemeMode');

/**
 * 主题配置验证器
 */
export const themeConfigValidator = objectValidatorFactory({
  mode: themeModeValidator.required(),
  isAutoMode: RuntimeTypeValidator.create<boolean>().required(),
  userPreference: themeModeValidator.required()
});

/**
 * 用户偏好设置验证器
 */
export const userPreferencesValidator = objectValidatorFactory({
  theme: themeConfigValidator.required(),
  streamingEnabled: RuntimeTypeValidator.create<boolean>().required(),
  autoThemeSchedule: objectValidatorFactory({
    enabled: RuntimeTypeValidator.create<boolean>().required(),
    lightModeStart: RuntimeTypeValidator.create<string>().required(),
    darkModeStart: RuntimeTypeValidator.create<string>().required()
  }).required(),
  defaultAgent: uuidValidator().optional(),
  language: enumValidator(['zh-CN', 'en-US'] as const).required()
});

/**
 * 用户偏好API响应验证器
 */
export const userPreferencesResponseValidator = createApiResponseValidator(
  userPreferencesValidator
);

// ============================================================================
// 管理后台相关验证器
// ============================================================================

/**
 * 统计数据验证器
 */
export const statsValidator = RuntimeTypeValidator.create<Record<string, any>>();

/**
 * 审计日志验证器
 */
export const auditLogValidator = objectValidatorFactory({
  id: uuidValidator().required(),
  userId: uuidValidator().optional(),
  action: RuntimeTypeValidator.create<string>().required(),
  resource: RuntimeTypeValidator.create<string>().required(),
  timestamp: stringValidator().required(),
  details: RuntimeTypeValidator.create<Record<string, any>>().optional(),
  ip: RuntimeTypeValidator.create<string>().optional(),
  userAgent: RuntimeTypeValidator.create<string>().optional()
});

/**
 * 统计数据API响应验证器
 */
export const statsResponseValidator = createApiResponseValidator(
  statsValidator
);

/**
 * 审计日志API响应验证器
 */
export const auditLogsResponseValidator = createApiResponseValidator(
  arrayValidator(auditLogValidator)
);

// ============================================================================
// 健康检查和状态相关验证器
// ============================================================================

/**
 * 健康状态验证器
 */
export const healthStatusValidator = objectValidatorFactory({
  status: enumValidator(['healthy', 'unhealthy', 'degraded'] as const).required(),
  timestamp: stringValidator().required(),
  services: RuntimeTypeValidator.create<Record<string, any>>().optional(),
  uptime: RuntimeTypeValidator.create<number>().optional(),
  version: RuntimeTypeValidator.create<string>().optional()
});

/**
 * 智能体健康状态验证器
 */
export const agentHealthStatusValidator = objectValidatorFactory({
  agentId: uuidValidator().required(),
  status: agentStatusValidator.required(),
  responseTime: RuntimeTypeValidator.create<number>().optional(),
  lastChecked: stringValidator().required(),
  error: RuntimeTypeValidator.create<string>().optional()
});

/**
 * 健康检查API响应验证器
 */
export const healthCheckResponseValidator = createApiResponseValidator(
  healthStatusValidator
);

/**
 * 智能体健康状态API响应验证器
 */
export const agentHealthStatusResponseValidator = createApiResponseValidator(
  agentHealthStatusValidator
);

// ============================================================================
// 通用API验证工具
// ============================================================================

/**
 * API响应验证工具类
 */
export class ApiResponseValidator {
  /**
   * 验证API响应
   */
  static validate<T>(response: unknown, dataValidator: RuntimeTypeValidator<T>): ApiResponse<T> {
    const validator = createApiResponseValidator(dataValidator);
    return validator.parse(response);
  }

  /**
   * 安全验证API响应（返回结果或错误）
   */
  static safeValidate<T>(response: unknown, dataValidator: RuntimeTypeValidator<T>): { success: boolean; data?: T; errors?: string[] } {
    try {
      const data = this.validate(response, dataValidator);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * 检查是否为错误响应
   */
  static isError(response: unknown): response is ApiErrorResponse {
    return apiErrorResponseValidator.test(response).isValid;
  }

  /**
   * 提取错误信息
   */
  static extractError(response: unknown): { code: string; message: string; details?: string } | null {
    if (!this.isError(response)) {
      return null;
    }

    const validated = apiErrorResponseValidator.parse(response);
    return {
      code: validated.code,
      message: validated.message,
      details: validated.error?.details
    };
  }
}

/**
 * 创建API客户端包装器
 */
export const createApiClientWrapper = <TConfig extends Record<string, RuntimeTypeValidator<any>>>(
  config: TConfig
) => {
  return {
    /**
     * 验证API响应
     */
    validate<K extends keyof TConfig>(endpoint: K, response: unknown): ReturnType<TConfig[K]['parse']> {
      const validator = config[endpoint];
      return validator.parse(response);
    },

    /**
     * 安全验证API响应
     */
    safeValidate<K extends keyof TConfig>(endpoint: K, response: unknown) {
      try {
        const data = this.validate(endpoint, response);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown validation error']
        };
      }
    }
  };
};

// ============================================================================
// 导出所有验证器
// ============================================================================

export {
  // 基础验证器
  agentValidator,
  agentConfigValidator,
  chatMessageValidator,
  chatSessionValidator,
  userPreferencesValidator,

  // API响应验证器
  agentsListResponseValidator,
  agentDetailResponseValidator,
  chatApiResponseValidator,
  chatHistoryResponseValidator,
  chatSessionResponseValidator,
  userPreferencesResponseValidator,
  statsResponseValidator,
  auditLogsResponseValidator,
  healthCheckResponseValidator,
  agentHealthStatusResponseValidator,

  // 工具类
  ApiResponseValidator,
  createApiClientWrapper,
};