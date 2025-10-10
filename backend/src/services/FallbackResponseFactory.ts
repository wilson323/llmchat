/**
 * 降级响应工厂
 * 专门用于生成各种错误场景下的降级响应
 */

import { generateId } from '@/utils/helpers';
import { FallbackStrategy, ErrorCategory } from './OptimizedErrorHandlingService';
import { ChatMessage, ChatOptions } from '@/types';

/**
 * 降级响应类型
 */
export interface FallbackResponse {
  id: string;
  success: boolean;
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    timestamp: string;
    fallback?: boolean;
    simplified?: boolean;
    alternative?: boolean;
    degraded?: boolean;
  };
  data?: any;
  metadata?: {
    strategy: FallbackStrategy;
    responseTime: number;
    cached: boolean;
    originalError?: string;
  };
}

/**
 * 聊天降级响应
 */
export interface ChatFallbackResponse extends FallbackResponse {
  data?: {
    chatId?: string;
    message?: string;
    suggestions?: string[];
    alternatives?: string[];
    limited?: boolean;
    retryAfter?: number;
  };
}

/**
 * 系统降级响应
 */
export interface SystemFallbackResponse extends FallbackResponse {
  data?: {
    status: string;
    message: string;
    affectedServices?: string[];
    estimatedRecoveryTime?: number;
    maintenanceMode?: boolean;
  };
}

/**
 * 降级响应工厂
 */
export class FallbackResponseFactory {
  // 预定义的降级消息
  private static readonly FALLBACK_MESSAGES = {
    [ErrorCategory.VALIDATION]: {
      short: '请求参数无效',
      detailed: '请求参数格式不正确，请检查输入内容',
      suggestions: ['检查输入格式', '确认必填字段', '联系技术支持']
    },
    [ErrorCategory.AUTHENTICATION]: {
      short: '认证失败',
      detailed: '身份验证失败，请重新登录',
      suggestions: ['重新登录', '检查网络连接', '清除缓存']
    },
    [ErrorCategory.AUTHORIZATION]: {
      short: '权限不足',
      detailed: '您没有权限执行此操作',
      suggestions: ['联系管理员', '检查账户权限', '确认操作范围']
    },
    [ErrorCategory.NETWORK]: {
      short: '网络异常',
      detailed: '网络连接不稳定，请稍后重试',
      suggestions: ['检查网络连接', '稍后重试', '尝试其他网络']
    },
    [ErrorCategory.EXTERNAL_SERVICE]: {
      short: '外部服务异常',
      detailed: '依赖的外部服务暂时不可用',
      suggestions: ['稍后重试', '使用备用功能', '联系技术支持']
    },
    [ErrorCategory.RESOURCE]: {
      short: '资源不足',
      detailed: '系统资源紧张，功能受限',
      suggestions: ['稍后重试', '简化操作', '减少并发请求']
    },
    [ErrorCategory.SYSTEM]: {
      short: '系统异常',
      detailed: '系统遇到问题，正在处理中',
      suggestions: ['稍后重试', '联系技术支持', '查看系统状态']
    },
    [ErrorCategory.BUSINESS_LOGIC]: {
      short: '业务规则限制',
      detailed: '当前操作不符合业务规则',
      suggestions: ['检查操作规范', '联系业务支持', '确认操作条件']
    }
  };

  /**
   * 创建聊天降级响应
   */
  static createChatFallback(
    category: ErrorCategory,
    strategy: FallbackStrategy,
    originalError?: string,
    context?: {
      chatId?: string;
      userId?: string;
      messageCount?: number;
      operation?: string;
    }
  ): ChatFallbackResponse {
    const timestamp = new Date().toISOString();
    const messageId = generateId();
    const fallbackMessage = this.FALLBACK_MESSAGES[category];

    const baseResponse: ChatFallbackResponse = {
      id: messageId,
      success: false,
      error: {
        code: this.getErrorCode(category, strategy),
        message: fallbackMessage.short,
        category,
        timestamp,
        fallback: true
      },
      metadata: {
        strategy,
        responseTime: 0,
        cached: false,
        originalError
      }
    };

    // 根据策略添加特定属性
    switch (strategy) {
      case FallbackStrategy.SIMPLIFIED_RESPONSE:
        baseResponse.error.simplified = true;
        baseResponse.error.message = '服务简化处理中';
        baseResponse.data = this.createSimplifiedChatResponse(category, context);
        break;

      case FallbackStrategy.CACHED_RESPONSE:
        baseResponse.error.message = '使用缓存响应';
        baseResponse.metadata.cached = true;
        baseResponse.data = this.createCachedChatResponse(category, context);
        break;

      case FallbackStrategy.ALTERNATIVE_SERVICE:
        baseResponse.error.alternative = true;
        baseResponse.error.message = '切换到备用服务';
        baseResponse.data = this.createAlternativeChatResponse(category, context);
        break;

      case FallbackStrategy.GRACEFUL_DEGRADATION:
        baseResponse.error.degraded = true;
        baseResponse.error.message = '服务性能下降';
        baseResponse.data = this.createDegradedChatResponse(category, context);
        break;

      default:
        baseResponse.data = this.createDefaultChatResponse(category, context);
        break;
    }

    return baseResponse;
  }

  /**
   * 创建系统降级响应
   */
  static createSystemFallback(
    category: ErrorCategory,
    strategy: FallbackStrategy,
    originalError?: string,
    context?: {
      service?: string;
      component?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      estimatedRecoveryTime?: number;
    }
  ): SystemFallbackResponse {
    const timestamp = new Date().toISOString();
    const messageId = generateId();
    const fallbackMessage = this.FALLBACK_MESSAGES[category];

    const baseResponse: SystemFallbackResponse = {
      id: messageId,
      success: false,
      error: {
        code: this.getErrorCode(category, strategy),
        message: fallbackMessage.short,
        category,
        timestamp,
        fallback: true
      },
      metadata: {
        strategy,
        responseTime: 0,
        cached: false,
        originalError
      }
    };

    // 根据策略添加特定属性
    switch (strategy) {
      case FallbackStrategy.GRACEFUL_DEGRADATION:
        baseResponse.error.degraded = true;
        baseResponse.data = this.createDegradedSystemResponse(category, context);
        break;

      case FallbackStrategy.ALTERNATIVE_SERVICE:
        baseResponse.error.alternative = true;
        baseResponse.data = this.createAlternativeSystemResponse(category, context);
        break;

      default:
        baseResponse.data = this.createDefaultSystemResponse(category, context);
        break;
    }

    return baseResponse;
  }

  /**
   * 创建通用降级响应
   */
  static createGenericFallback(
    category: ErrorCategory,
    strategy: FallbackStrategy,
    originalError?: string,
    customMessage?: string
  ): FallbackResponse {
    const timestamp = new Date().toISOString();
    const messageId = generateId();
    const fallbackMessage = this.FALLBACK_MESSAGES[category];

    const response: FallbackResponse = {
      id: messageId,
      success: false,
      error: {
        code: this.getErrorCode(category, strategy),
        message: customMessage || fallbackMessage.short,
        category,
        timestamp,
        fallback: true
      },
      metadata: {
        strategy,
        responseTime: 0,
        cached: false,
        originalError
      }
    };

    // 根据策略添加特定属性
    switch (strategy) {
      case FallbackStrategy.SIMPLIFIED_RESPONSE:
        response.error.simplified = true;
        break;
      case FallbackStrategy.CACHED_RESPONSE:
        response.error.message = '使用缓存响应';
        response.metadata.cached = true;
        break;
      case FallbackStrategy.ALTERNATIVE_SERVICE:
        response.error.alternative = true;
        break;
      case FallbackStrategy.GRACEFUL_DEGRADATION:
        response.error.degraded = true;
        break;
    }

    return response;
  }

  /**
   * 创建简化的聊天响应
   */
  private static createSimplifiedChatResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    return {
      chatId: context?.chatId || generateId(),
      message: '服务简化处理中，功能可能受限',
      suggestions: ['简化消息内容', '稍后重试', '联系技术支持'],
      limited: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建缓存的聊天响应
   */
  private static createCachedChatResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    return {
      chatId: context?.chatId || generateId(),
      message: '使用缓存数据，可能不是最新信息',
      cached: true,
      suggestions: ['刷新页面重试', '稍后重试', '检查网络连接'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建备用服务的聊天响应
   */
  private static createAlternativeChatResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    return {
      chatId: context?.chatId || generateId(),
      message: '正在使用备用服务，响应可能较慢',
      alternative: true,
      suggestions: ['耐心等待', '稍后重试', '使用主服务'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建降级的聊天响应
   */
  private static createDegradedChatResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    return {
      chatId: context?.chatId || generateId(),
      message: '服务性能下降，部分功能受限',
      degraded: true,
      suggestions: ['减少并发请求', '简化操作', '稍后重试'],
      limited: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建默认聊天响应
   */
  private static createDefaultChatResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    const fallbackMessage = this.FALLBACK_MESSAGES[category];

    return {
      chatId: context?.chatId || generateId(),
      message: fallbackMessage.detailed,
      suggestions: fallbackMessage.suggestions,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建降级的系统响应
   */
  private static createDegradedSystemResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    return {
      status: 'degraded',
      message: '系统性能下降，功能受限',
      affectedServices: [context?.service || 'unknown'],
      limited: true,
      suggestions: ['减少并发请求', '稍后重试', '联系技术支持'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建备用服务的系统响应
   */
  private static createAlternativeSystemResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    return {
      status: 'alternative',
      message: '主服务不可用，使用备用服务',
      affectedServices: [context?.service || 'unknown'],
      alternative: true,
      suggestions: ['耐心等待', '稍后重试主服务', '联系技术支持'],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建默认系统响应
   */
  private static createDefaultSystemResponse(
    category: ErrorCategory,
    context?: any
  ): any {
    const fallbackMessage = this.FALLBACK_MESSAGES[category];

    return {
      status: 'error',
      message: fallbackMessage.detailed,
      affectedServices: [context?.service || 'unknown'],
      suggestions: fallbackMessage.suggestions,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取错误代码
   */
  private static getErrorCode(category: ErrorCategory, strategy: FallbackStrategy): string {
    const baseCode = category.toUpperCase();
    const strategySuffix = strategy.toUpperCase().replace('_', '_');

    return `${baseCode}_FALLBACK_${strategySuffix}`;
  }

  /**
   * 创建健康检查降级响应
   */
  static createHealthCheckFallback(
    category: ErrorCategory,
    strategy: FallbackStrategy,
    checks?: Array<{ name: string; status: 'ok' | 'error'; message?: string }>
  ): FallbackResponse {
    const timestamp = new Date().toISOString();
    const messageId = generateId();

    return {
      id: messageId,
      success: false,
      error: {
        code: this.getErrorCode(category, strategy),
        message: '健康检查服务异常',
        category,
        timestamp,
        fallback: true
      },
      data: {
        status: 'unhealthy',
        message: '部分健康检查失败',
        checks: checks || [
          {
            name: 'general',
            status: 'error',
            message: '系统健康检查异常'
          }
        ],
        timestamp
      },
      metadata: {
        strategy,
        responseTime: 0,
        cached: false
      }
    };
  }

  /**
   * 创建配置服务降级响应
   */
  static createConfigFallback(
    category: ErrorCategory,
    strategy: FallbackStrategy,
    configKey?: string,
    context?: {
      service?: string;
      environment?: string;
    }
  ): FallbackResponse {
    const timestamp = new Date().toISOString();
    const messageId = generateId();

    return {
      id: messageId,
      success: false,
      error: {
        code: this.getErrorCode(category, strategy),
        message: `配置服务异常${configKey ? `: ${configKey}` : ''}`,
        category,
        timestamp,
        fallback: true
      },
      data: {
        configKey,
        fallbackValue: this.getFallbackConfigValue(configKey),
        message: '使用默认配置',
        suggestions: ['稍后重试', '联系管理员', '检查配置服务']
      },
      metadata: {
        strategy,
        responseTime: 0,
        cached: false
      }
    };
  }

  /**
   * 获取降级配置值
   */
  private static getFallbackConfigValue(configKey?: string): any {
    const fallbackConfigs: Record<string, any> = {
      'chat.timeout': 30000,
      'chat.maxTokens': 2000,
      'chat.temperature': 0.7,
      'cache.ttl': 300000,
      'rate.limit': 100,
      'retry.maxAttempts': 3,
      'retry.delay': 1000
    };

    return configKey ? fallbackConfigs[configKey] : null;
  }

  /**
   * 创建流式响应降级消息
   */
  static createStreamFallback(
    category: ErrorCategory,
    strategy: FallbackStrategy,
    streamId?: string,
    originalError?: string
  ): {
    event: string;
    data: any;
  } {
    const timestamp = new Date().toISOString();
    const messageId = generateId();
    const fallbackMessage = this.FALLBACK_MESSAGES[category];

    return {
      event: 'error',
      data: {
        id: streamId || messageId,
        error: {
          code: this.getErrorCode(category, strategy),
          message: fallbackMessage.short,
          category,
          timestamp,
          fallback: true,
          originalError
        },
        metadata: {
          strategy,
          stream: true,
          timestamp
        }
      }
    };
  }
}

export default FallbackResponseFactory;