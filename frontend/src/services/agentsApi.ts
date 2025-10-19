
import { api } from './api';
import type {
  AgentPayload as IAgentPayload,
  AgentListParams,
  PaginatedResponse
} from './types/api-common';
import type {
  ApiErrorType
} from './types/api-errors';
import {
  ApiErrorFactory,
  ApiErrorHandler
} from './types/api-errors';
import type {
  ApiResponse,
  ApiResult
} from './types/api-response';

// ============================================================================
// 智能体相关类型定义
// ============================================================================

/**
 * 智能体项目接口（从后端返回的完整数据）
 */
export interface AgentItem {
  id: string;
  name: string;
  description?: string;
  model?: string;
  status: 'active' | 'inactive' | 'error' | 'loading';
  provider: string;
  capabilities?: string[];
  features?: Record<string, any>;
  rateLimit?: { requestsPerMinute?: number; tokensPerMinute?: number };
  endpoint?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  appId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  avatar?: string;
  workspaceType?: 'chat' | 'product-preview' | 'voice-call' | 'custom';
}

/**
 * 智能体创建/更新载荷（使用统一类型）
 */
export type AgentPayload = Omit<IAgentPayload, 'id'> & {
  id?: string;
};

/**
 * 智能体验证结果
 */
export interface AgentValidationResult {
  agentId: string;
  isValid: boolean;
  exists: boolean;
  isActive: boolean;
  errors?: string[];
  warnings?: string[];
  lastChecked?: string;
}

/**
 * 智能体信息
 */
export interface AgentInfo {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  capabilities: Array<string>;
  features: Record<string, any>;
  supportedFeatures?: {
    supportsStream?: boolean;
    supportsFiles?: boolean;
    supportsImages?: boolean;
    supportsChatId?: boolean;
    supportsDetail?: boolean;
  };
}

/**
 * 智能体导入结果
 */
export interface AgentImportResult {
  total: number;
  success: number;
  failed: number;
  agents: AgentItem[];
  errors?: Array<{
    index: number;
    agent: AgentPayload;
    error: string;
  }>;
}

/**
 * 智能体重载结果
 */
export interface AgentReloadResult {
  totalAgents: number;
  activeAgents: number;
  inactiveAgents: number;
  errorAgents: number;
  reloadTime: string;
  errors?: string[];
}

// ============================================================================
// 智能体API服务类
// ============================================================================

/**
 * 智能体API服务 - 提供类型安全的智能体管理功能
 */
export class AgentsApiService {
  /**
   * 获取智能体列表
   */
  static async listAgents(params?: AgentListParams): Promise<ApiResult<AgentItem[]>> {
    try {
      const { data } = await api.get<ApiResponse<AgentItem[]>>(
        '/agents',
        {
          params: {
            includeInactive: params?.includeInactive ? 'true' : undefined,
            provider: params?.provider,
            status: params?.status,
            search: params?.search,
            page: params?.page,
            pageSize: params?.pageSize,
            ...params?.filters
          }
        }
      );

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration,
          cached: false
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/agents',
        method: 'GET',
        additional: { params }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取单个智能体详情
   */
  static async getAgent(id: string): Promise<ApiResult<AgentItem>> {
    try {
      const { data } = await api.get<ApiResponse<AgentItem>>(`/agents/${id}`);

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/agents/${id}`,
        method: 'GET',
        additional: { agentId: id }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 重新加载智能体配置
   */
  static async reloadAgents(): Promise<ApiResult<AgentReloadResult>> {
    try {
      const { data } = await api.post<ApiResponse<AgentReloadResult>>(
        '/agents/reload',
        {}
      );

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/agents/reload',
        method: 'POST'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 创建智能体
   */
  static async createAgent(payload: AgentPayload): Promise<ApiResult<AgentItem>> {
    try {
      const { data } = await api.post<ApiResponse<AgentItem>>('/agents', payload);

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/agents',
        method: 'POST',
        additional: { agentName: payload.name, provider: payload.provider }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 更新智能体
   */
  static async updateAgent(id: string, updates: Partial<AgentPayload>): Promise<ApiResult<AgentItem>> {
    try {
      const { data } = await api.put<ApiResponse<AgentItem>>(`/agents/${id}`, updates);

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/agents/${id}`,
        method: 'PUT',
        additional: { agentId: id, updates }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 删除智能体
   */
  static async deleteAgent(id: string): Promise<ApiResult<void>> {
    try {
      await api.delete(`/agents/${id}`);

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/agents/${id}`,
        method: 'DELETE',
        additional: { agentId: id }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 批量导入智能体
   */
  static async importAgents(payload: { agents: AgentPayload[] }): Promise<ApiResult<AgentImportResult>> {
    try {
      const { data } = await api.post<ApiResponse<AgentItem[]>>('/agents/import', payload);

      const result: AgentImportResult = {
        total: payload.agents.length,
        success: data.data.length,
        failed: payload.agents.length - data.data.length,
        agents: data.data
      };

      return {
        success: true,
        data: result,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/agents/import',
        method: 'POST',
        additional: { agentCount: payload.agents.length }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 验证智能体配置
   */
  static async validateAgent(id: string): Promise<ApiResult<AgentValidationResult>> {
    try {
      const { data } = await api.get<ApiResponse<AgentValidationResult>>(
        `/agents/${id}/validate`
      );

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/agents/${id}/validate`,
        method: 'GET',
        additional: { agentId: id }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取智能体信息
   */
  static async fetchAgentInfo(params: {
    provider: 'fastgpt' | 'dify';
    endpoint: string;
    apiKey: string;
    appId?: string;
  }): Promise<ApiResult<AgentInfo>> {
    try {
      const { data } = await api.post<ApiResponse<AgentInfo>>('/agents/fetch-info', params);

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/agents/fetch-info',
        method: 'POST',
        additional: { provider: params.provider, endpoint: params.endpoint }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 批量操作智能体
   */
  static async batchOperation(
    operation: 'activate' | 'deactivate' | 'delete',
    agentIds: string[]
  ): Promise<ApiResult<{ success: number; failed: number; errors?: string[] }>> {
    try {
      const { data } = await api.post<ApiResponse<{ success: number; failed: number; errors?: string[] }>>(
        '/agents/batch',
        { operation, agentIds }
      );

      return {
        success: true,
        data: data.data,
        metadata: {
          requestId: data.requestId,
          timestamp: data.timestamp,
          duration: data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/agents/batch',
        method: 'POST',
        additional: { operation, agentCount: agentIds.length }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }
}

// ============================================================================
// 向后兼容的函数式API
// ============================================================================

/**
 * @deprecated 使用 AgentsApiService.listAgents 替代
 */
export async function listAgents(opts?: { includeInactive?: boolean }): Promise<AgentItem[]> {
  const result = await AgentsApiService.listAgents({
    includeInactive: opts?.includeInactive
  });

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AgentsApiService.reloadAgents 替代
 */
export async function reloadAgents(): Promise<{ totalAgents: number; activeAgents: number }> {
  const result = await AgentsApiService.reloadAgents();

  if (!result.success) {
    throw result.error;
  }

  return {
    totalAgents: result.data.totalAgents,
    activeAgents: result.data.activeAgents
  };
}

/**
 * @deprecated 使用 AgentsApiService.updateAgent 替代
 */
export async function updateAgent(id: string, updates: Partial<AgentPayload>): Promise<AgentItem> {
  const result = await AgentsApiService.updateAgent(id, updates);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AgentsApiService.createAgent 替代
 */
export async function createAgent(payload: AgentPayload): Promise<AgentItem> {
  const result = await AgentsApiService.createAgent(payload);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AgentsApiService.deleteAgent 替代
 */
export async function deleteAgent(id: string): Promise<void> {
  const result = await AgentsApiService.deleteAgent(id);

  if (!result.success) {
    throw result.error;
  }
}

/**
 * @deprecated 使用 AgentsApiService.importAgents 替代
 */
export async function importAgents(payload: { agents: AgentPayload[] }): Promise<AgentItem[]> {
  const result = await AgentsApiService.importAgents(payload);

  if (!result.success) {
    throw result.error;
  }

  return result.data.agents;
}

/**
 * @deprecated 使用 AgentsApiService.validateAgent 替代
 */
export async function validateAgent(id: string): Promise<{ agentId: string; isValid: boolean; exists: boolean; isActive: boolean }> {
  const result = await AgentsApiService.validateAgent(id);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AgentsApiService.fetchAgentInfo 替代
 */
export async function fetchAgentInfo(params: {
  provider: 'fastgpt' | 'dify';
  endpoint: string;
  apiKey: string;
  appId?: string;
}): Promise<AgentInfo> {
  const result = await AgentsApiService.fetchAgentInfo(params);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
