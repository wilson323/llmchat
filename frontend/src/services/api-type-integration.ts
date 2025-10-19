/**
 * API类型验证器集成工具
 *
 * 安全地集成API类型验证器到现有的API服务中，确保类型安全和向后兼容性
 *
 * @module api-type-integration
 * @version 1.0.0
 * @since 2025-10-18
 */

import {
  ApiResponseValidator,
  agentsListResponseValidator,
  agentDetailResponseValidator,
  chatApiResponseValidator,
  chatHistoryResponseValidator,
  chatSessionResponseValidator,
  userPreferencesResponseValidator,
  createApiResponseValidator,
  createPaginatedDataValidator,
  createApiClientWrapper
} from '@/utils/api-type-validators';
import { Agent, AgentConfig, ChatMessage, ChatSession, UserPreferences } from '@/types';

// ============================================================================
// API类型集成配置
// =============================================================================

/**
 * API端点类型验证配置
 */
export interface ApiEndpointValidationConfig {
  /** 端点路径 */
  endpoint: string;
  /** HTTP方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** 请求体验证器 */
  requestValidator?: any;
  /** 响应验证器 */
  responseValidator: any;
  /** 是否启用验证 */
  enableValidation: boolean;
  /** 错误处理策略 */
  errorHandling: 'strict' | 'lenient' | 'ignore';
  /** 重试策略 */
  retryStrategy?: {
    maxRetries: number;
    retryDelay: number;
    retryCondition: (error: any) => boolean;
  };
}

/**
 * API类型集成结果
 */
export interface ApiTypeIntegrationResult {
  /** 端点路径 */
  endpoint: string;
  /** 是否成功 */
  success: boolean;
  /** 验证请求数 */
  requestsValidated: number;
  /** 验证响应数 */
  responsesValidated: number;
  /** 验证错误数 */
  validationErrors: number;
  /** 性能指标 */
  performance: {
    averageValidationTime: number;
    totalValidationTime: number;
    validationOverhead: number;
  };
  /** 错误详情 */
  errors: ApiIntegrationError[];
  /** 警告详情 */
  warnings: ApiIntegrationWarning[];
}

/**
 * API集成错误
 */
export interface ApiIntegrationError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 端点 */
  endpoint: string;
  /** 请求ID */
  requestId?: string;
  /** 时间戳 */
  timestamp: string;
  /** 严重程度 */
  severity: 'critical' | 'error' | 'warning';
}

/**
 * API集成警告
 */
export interface ApiIntegrationWarning {
  /** 警告代码 */
  code: string;
  /** 警告消息 */
  message: string;
  /** 端点 */
  endpoint: string;
  /** 建议操作 */
  suggestion?: string;
}

// ============================================================================
// API类型验证器包装器
// =============================================================================

/**
 * API类型验证器包装器类
 */
export class ApiTypeValidatorWrapper {
  private validationConfigs: Map<string, ApiEndpointValidationConfig> = new Map();
  private validationStats: Map<string, ApiTypeIntegrationResult> = new Map();
  private isEnabled: boolean = true;

  /**
   * 注册API端点验证配置
   */
  public registerEndpoint(config: ApiEndpointValidationConfig): void {
    this.validationConfigs.set(`${config.method}:${config.endpoint}`, config);
  }

  /**
   * 启用/禁用验证
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * 包装API请求方法
   */
  public wrapApiRequest<TRequest, TResponse>(
    originalRequest: (request: TRequest) => Promise<any>,
    endpoint: string,
    method: string = 'GET'
  ): (request: TRequest) => Promise<TResponse> {
    return async (request: TRequest): Promise<TResponse> => {
      const configKey = `${method}:${endpoint}`;
      const config = this.validationConfigs.get(configKey);

      if (!this.isEnabled || !config || !config.enableValidation) {
        // 如果未启用验证或没有配置，直接调用原始请求
        return originalRequest(request);
      }

      const startTime = Date.now();
      const result: ApiTypeIntegrationResult = this.getOrCreateStats(configKey);

      try {
        // 验证请求（如果有配置）
        if (config.requestValidator) {
          const requestValidation = config.requestValidator.safeValidate
            ? config.requestValidator.safeValidate(request)
            : { success: true, data: request };

          if (!requestValidation.success) {
            throw new Error(`请求验证失败: ${requestValidation.errors?.join(', ')}`);
          }
        }

        // 执行原始请求
        const response = await originalRequest(request);

        // 验证响应
        const responseValidation = config.responseValidator.safeValidate
          ? config.responseValidator.safeValidate(response)
          : { success: true, data: response };

        if (!responseValidation.success) {
          result.validationErrors++;
          result.errors.push({
            code: 'RESPONSE_VALIDATION_FAILED',
            message: `响应验证失败: ${responseValidation.errors?.join(', ')}`,
            endpoint,
            timestamp: new Date().toISOString(),
            severity: config.errorHandling === 'strict' ? 'error' : 'warning'
          });

          if (config.errorHandling === 'strict') {
            throw new Error(`响应验证失败: ${responseValidation.errors?.join(', ')}`);
          }
        }

        // 更新统计信息
        const validationTime = Date.now() - startTime;
        result.requestsValidated++;
        result.responsesValidated++;
        result.performance.totalValidationTime += validationTime;
        result.performance.averageValidationTime =
          result.performance.totalValidationTime / result.requestsValidated;

        return responseValidation.data || response;

      } catch (error) {
        // 处理错误和重试逻辑
        if (config.retryStrategy && this.shouldRetry(error, config.retryStrategy)) {
          return this.retryRequest(originalRequest, request, config.retryStrategy, endpoint, method);
        }

        result.errors.push({
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
          endpoint,
          timestamp: new Date().toISOString(),
          severity: 'error'
        });

        throw error;
      }
    };
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any, retryStrategy: any): boolean {
    return retryStrategy.retryCondition(error);
  }

  /**
   * 重试请求
   */
  private async retryRequest<TRequest, TResponse>(
    originalRequest: (request: TRequest) => Promise<any>,
    request: TRequest,
    retryStrategy: any,
    endpoint: string,
    method: string
  ): Promise<TResponse> {
    let lastError: any;

    for (let attempt = 1; attempt <= retryStrategy.maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, retryStrategy.retryDelay));
        return await this.wrapApiRequest(originalRequest, endpoint, method)(request);
      } catch (error) {
        lastError = error;
        if (attempt < retryStrategy.maxRetries) {
          console.warn(`API请求重试 ${attempt}/${retryStrategy.maxRetries}:`, error);
        }
      }
    }

    throw lastError;
  }

  /**
   * 获取或创建统计信息
   */
  private getOrCreateStats(configKey: string): ApiTypeIntegrationResult {
    if (!this.validationStats.has(configKey)) {
      this.validationStats.set(configKey, {
        endpoint: configKey,
        success: true,
        requestsValidated: 0,
        responsesValidated: 0,
        validationErrors: 0,
        performance: {
          averageValidationTime: 0,
          totalValidationTime: 0,
          validationOverhead: 0
        },
        errors: [],
        warnings: []
      });
    }
    return this.validationStats.get(configKey)!;
  }

  /**
   * 获取验证统计信息
   */
  public getValidationStats(): Map<string, ApiTypeIntegrationResult> {
    return new Map(this.validationStats);
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.validationStats.clear();
  }

  /**
   * 生成验证报告
   */
  public generateReport(): string {
    let report = 'API类型验证报告\n';
    report += '================\n\n';

    const totalEndpoints = this.validationStats.size;
    const stats = Array.from(this.validationStats.values());
    const totalRequests = stats.reduce((sum, stat) => sum + stat.requestsValidated, 0);
    const totalResponses = stats.reduce((sum, stat) => sum + stat.responsesValidated, 0);
    const totalErrors = stats.reduce((sum, stat) => sum + stat.validationErrors, 0);
    const averageValidationTime = stats.length > 0
      ? stats.reduce((sum, stat) => sum + stat.performance.averageValidationTime, 0) / stats.length
      : 0;

    report += `总端点数: ${totalEndpoints}\n`;
    report += `验证请求数: ${totalRequests}\n`;
    report += `验证响应数: ${totalResponses}\n`;
    report += `验证错误数: ${totalErrors}\n`;
    report += `平均验证时间: ${averageValidationTime.toFixed(2)}ms\n\n`;

    // 详细端点信息
    stats.forEach(stat => {
      report += `端点: ${stat.endpoint}\n`;
      report += `请求数: ${stat.requestsValidated}\n`;
      report += `响应数: ${stat.responsesValidated}\n`;
      report += `错误数: ${stat.validationErrors}\n`;
      report += `平均时间: ${stat.performance.averageValidationTime.toFixed(2)}ms\n`;

      if (stat.errors.length > 0) {
        report += `最近错误:\n`;
        stat.errors.slice(-3).forEach(error => {
          report += `  - [${error.severity}] ${error.code}: ${error.message}\n`;
        });
      }

      report += '---\n';
    });

    return report;
  }
}

// ============================================================================
// 预定义的API端点验证配置
// =============================================================================

/**
 * 获取预定义的API端点验证配置
 */
export const getPredefinedApiValidationConfigs = (): ApiEndpointValidationConfig[] => {
  return [
    {
      endpoint: '/api/agents',
      method: 'GET',
      responseValidator: agentsListResponseValidator,
      enableValidation: true,
      errorHandling: 'lenient'
    },
    {
      endpoint: '/api/agents/:id',
      method: 'GET',
      responseValidator: agentDetailResponseValidator,
      enableValidation: true,
      errorHandling: 'lenient'
    },
    {
      endpoint: '/api/chat/completions',
      method: 'POST',
      responseValidator: chatApiResponseValidator,
      enableValidation: true,
      errorHandling: 'strict',
      retryStrategy: {
        maxRetries: 3,
        retryDelay: 1000,
        retryCondition: (error: any) => {
          // 网络错误或5xx错误时重试
          return error.code === 'NETWORK_ERROR' ||
                 (error.status >= 500 && error.status < 600);
        }
      }
    },
    {
      endpoint: '/api/chat/history',
      method: 'GET',
      responseValidator: chatHistoryResponseValidator,
      enableValidation: true,
      errorHandling: 'lenient'
    },
    {
      endpoint: '/api/chat/sessions/:id',
      method: 'GET',
      responseValidator: chatSessionResponseValidator,
      enableValidation: true,
      errorHandling: 'lenient'
    },
    {
      endpoint: '/api/user/preferences',
      method: 'GET',
      responseValidator: userPreferencesResponseValidator,
      enableValidation: true,
      errorHandling: 'lenient'
    }
  ];
};

// ============================================================================
// API服务集成工具
// =============================================================================

/**
 * API服务集成工具类
 */
export class ApiServiceIntegrationTool {
  private validatorWrapper: ApiTypeValidatorWrapper;
  private wrappedServices: Map<string, any> = new Map();

  constructor() {
    this.validatorWrapper = new ApiTypeValidatorWrapper();
    this.initializeDefaultConfigs();
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaultConfigs(): void {
    const configs = getPredefinedApiValidationConfigs();
    configs.forEach(config => {
      this.validatorWrapper.registerEndpoint(config);
    });
  }

  /**
   * 包装API服务
   */
  public wrapApiService<T extends Record<string, any>>(
    serviceName: string,
    apiService: T,
    customConfigs?: ApiEndpointValidationConfig[]
  ): T {
    if (this.wrappedServices.has(serviceName)) {
      return this.wrappedServices.get(serviceName);
    }

    // 注册自定义配置
    if (customConfigs) {
      customConfigs.forEach(config => {
        this.validatorWrapper.registerEndpoint(config);
      });
    }

    const wrappedService: any = {};

    Object.keys(apiService).forEach(methodName => {
      const originalMethod = apiService[methodName as keyof T];

      if (typeof originalMethod === 'function') {
        wrappedService[methodName] = this.wrapApiMethod(
          originalMethod,
          serviceName,
          methodName
        );
      } else {
        wrappedService[methodName] = originalMethod;
      }
    });

    this.wrappedServices.set(serviceName, wrappedService);
    return wrappedService;
  }

  /**
   * 包装API方法
   */
  private wrapApiMethod(
    originalMethod: any,
    serviceName: string,
    methodName: string
  ): any {
    return async (...args: any[]) => {
      // 这里可以根据方法名推断端点和方法类型
      // 简化版本，实际实现中可能需要更复杂的逻辑
      const endpoint = this.inferEndpoint(serviceName, methodName);
      const method = this.inferHttpMethod(methodName);

      return this.validatorWrapper.wrapApiRequest(
        () => originalMethod.apply(apiService, args),
        endpoint,
        method
      )();
    };
  }

  /**
   * 推断API端点
   */
  private inferEndpoint(serviceName: string, methodName: string): string {
    // 简化的端点推断逻辑
    const methodMap: Record<string, string> = {
      'getAgents': '/api/agents',
      'getAgent': '/api/agents/:id',
      'sendMessage': '/api/chat/completions',
      'getChatHistory': '/api/chat/history',
      'getSession': '/api/chat/sessions/:id',
      'getUserPreferences': '/api/user/preferences'
    };

    return methodMap[methodName] || `/api/${serviceName}/${methodName}`;
  }

  /**
   * 推断HTTP方法
   */
  private inferHttpMethod(methodName: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' {
    if (methodName.startsWith('get') || methodName.startsWith('fetch')) {
      return 'GET';
    } else if (methodName.startsWith('create') || methodName.startsWith('send')) {
      return 'POST';
    } else if (methodName.startsWith('update')) {
      return 'PUT';
    } else if (methodName.startsWith('delete') || methodName.startsWith('remove')) {
      return 'DELETE';
    } else if (methodName.startsWith('patch')) {
      return 'PATCH';
    }
    return 'GET';
  }

  /**
   * 获取验证器包装器
   */
  public getValidatorWrapper(): ApiTypeValidatorWrapper {
    return this.validatorWrapper;
  }

  /**
   * 启用/禁用验证
   */
  public setValidationEnabled(enabled: boolean): void {
    this.validatorWrapper.setEnabled(enabled);
  }

  /**
   * 获取验证统计
   */
  public getValidationStats(): Map<string, ApiTypeIntegrationResult> {
    return this.validatorWrapper.getValidationStats();
  }

  /**
   * 生成验证报告
   */
  public generateReport(): string {
    return this.validatorWrapper.generateReport();
  }
}

// ============================================================================
// 工具函数
// =============================================================================

/**
 * 获取API服务集成工具实例
 */
export const getApiServiceIntegrationTool = (): ApiServiceIntegrationTool => {
  return new ApiServiceIntegrationTool();
};

/**
 * 快速集成API服务
 */
export const quickIntegrateApiService = <T extends Record<string, any>>(
  serviceName: string,
  apiService: T,
  options: {
    enableValidation?: boolean;
    customConfigs?: ApiEndpointValidationConfig[];
  } = {}
): T => {
  const integrationTool = getApiServiceIntegrationTool();

  if (options.enableValidation !== false) {
    return integrationTool.wrapApiService(serviceName, apiService, options.customConfigs);
  }

  return apiService;
};

// ============================================================================
// 导出
// =============================================================================

export {
  ApiTypeValidatorWrapper,
  ApiServiceIntegrationTool,
  getPredefinedApiValidationConfigs,
  getApiServiceIntegrationTool,
  quickIntegrateApiService
};