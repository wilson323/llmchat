/**
 * AgentService - 智能体服务适配器
 *
 * 为测试和旧代码提供向后兼容的AgentService接口
 * 实际功能委托给AgentConfigService
 */

import { AgentConfigService } from './AgentConfigService';
import type { AgentConfig } from '@/types';
import logger from '@/utils/logger';

export interface SyncResult {
  synced: number;
  failed?: number;
  agents?: AgentConfig[];
}

export interface AgentStatus {
  id: string;
  status: 'active' | 'inactive' | 'error';
  lastCheck: Date;
  responseTime?: number;
  errorMessage?: string;
}

/**
 * AgentService类 - 智能体服务适配器
 */
export class AgentService {
  private readonly configService: AgentConfigService;

  constructor() {
    this.configService = new AgentConfigService();
  }

  /**
   * 同步智能体
   */
  async syncAgents(): Promise<SyncResult> {
    try {
      logger.info('[AgentService] 开始同步智能体');

      // 重新加载配置
      await this.configService.reloadAgents();
      const agents = await this.configService.loadAgents();

      logger.info('[AgentService] 智能体同步完成', {
        count: agents.length
      });

      return {
        synced: agents.length,
        agents
      };

    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'AgentService',
        operation: 'syncAgents',
      });
      logger.error('[AgentService] 同步失败', error.toLogObject());
      throw error;
    }
  }

  /**
   * 验证配置
   */
  validateConfig(config: Partial<AgentConfig>): void {
    if (!config.id) {
      throw new ValidationError({
        message: '智能体ID是必需的',
        code: 'AGENT_ID_REQUIRED',
        field: 'id',
      });
    }
    if (!config.name) {
      throw new ValidationError({
        message: '智能体名称是必需的',
        code: 'AGENT_NAME_REQUIRED',
        field: 'name',
      });
    }
    if (!config.endpoint) {
      throw new ValidationError({
        message: '智能体端点是必需的',
        code: 'AGENT_ENDPOINT_REQUIRED',
        field: 'endpoint',
      });
    }
    if (!config.apiKey) {
      throw new ValidationError({
        message: '智能体API密钥是必需的',
        code: 'AGENT_API_KEY_REQUIRED',
        field: 'apiKey',
      });
    }
  }

  /**
   * 获取智能体列表
   */
  async getAgents(): Promise<AgentConfig[]> {
    return this.configService.loadAgents();
  }

  /**
   * 根据ID获取智能体
   */
  async getAgent(id: string): Promise<AgentConfig | null> {
    return this.configService.getAgent(id);
  }

  /**
   * 检查智能体状态
   */
  async checkStatus(agentId: string): Promise<AgentStatus> {
    try {
      logger.info('[AgentService] 检查智能体状态', { agentId });

      const agent = await this.configService.getAgent(agentId);

      if (!agent) {
        return {
          id: agentId,
          status: 'error',
          lastCheck: new Date(),
          errorMessage: 'Agent not found'
        };
      }

      // 简化的状态检查 - 实际应该ping endpoint
      return {
        id: agentId,
        status: 'active',
        lastCheck: new Date(),
        responseTime: 100
      };

    } catch (unknownError: unknown) {
      const error = createErrorFromUnknown(unknownError, {
        component: 'AgentService',
        operation: 'checkStatus',
      });
      logger.error('[AgentService] 状态检查失败', error.toLogObject());

      return {
        id: agentId,
        status: 'error',
        lastCheck: new Date(),
        errorMessage: error.message
      };
    }
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<void> {
    await this.configService.reloadAgents();
  }
}


