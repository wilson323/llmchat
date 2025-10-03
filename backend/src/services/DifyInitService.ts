import axios from 'axios';
import { AgentConfigService } from './AgentConfigService';
import { AgentConfig } from '@/types';
import { AdaptiveTtlPolicy } from '@/utils/adaptiveCache';
import logger from '@/utils/logger';

/**
 * Dify应用信息接口
 */
export interface DifyAppInfo {
  name: string;
  description: string;
  icon: string;
  icon_background: string;
  model_config: {
    model: string;
    parameters: {
      temperature: number;
      max_tokens: number;
      top_p?: number;
      presence_penalty?: number;
      frequency_penalty?: number;
    };
  };
}

/**
 * Dify应用参数接口
 */
export interface DifyAppParameters {
  user_input_form: Array<{
    variable: string;
    label: string;
    required: boolean;
    max_length?: number;
    default?: string;
    options?: string[];
  }>;
  file_upload?: {
    enabled: boolean;
    allowed_file_types: string[];
    allowed_file_extensions: string[];
    allowed_file_upload_methods: string[];
  };
  system_parameters?: {
    image_file_size_limit?: string;
    video_file_size_limit?: string;
    audio_file_size_limit?: string;
  };
}

/**
 * Dify初始化响应
 */
export interface DifyInitResponse {
  appInfo: DifyAppInfo;
  parameters: DifyAppParameters;
  // 从appInfo提取的便捷字段（测试用）
  model?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Dify初始化服务
 * 负责调用Dify的info和parameters API
 */
export class DifyInitService {
  private httpClient: ReturnType<typeof axios.create>;
  private agentService: AgentConfigService;
  private cache: Map<string, { data: DifyInitResponse; expiresAt: number }> = new Map();
  private readonly cachePolicy = new AdaptiveTtlPolicy({
    initialTtl: 5 * 60 * 1000, // 5分钟
    minTtl: 60 * 1000, // 1分钟
    maxTtl: 15 * 60 * 1000, // 15分钟
    step: 60 * 1000,
    sampleSize: 20,
    adjustIntervalMs: 2 * 60 * 1000,
  });

  constructor(agentService: AgentConfigService) {
    this.agentService = agentService;
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 获取初始化数据（包含应用信息和参数配置）
   */
  async getInitData(agentId: string): Promise<DifyInitResponse> {
    // 检查缓存
    const cached = this.cache.get(agentId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      logger.debug('✅ 使用缓存的Dify初始化数据', { agentId });
      this.cachePolicy.recordHit();
      return cached.data;
    }

    this.cachePolicy.recordMiss();

    // 获取智能体配置
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      throw new Error(`智能体不存在: ${agentId}`);
    }

    if (agent.provider !== 'dify') {
      throw new Error(`智能体 ${agentId} 不是Dify类型，无法获取初始化数据`);
    }

    // 并行调用Dify API
    const [appInfo, parameters] = await Promise.all([
      this.callDifyInfoAPI(agent),
      this.callDifyParametersAPI(agent),
    ]);

    const initData: DifyInitResponse = { appInfo, parameters };

    // 缓存结果
    this.cache.set(agentId, {
      data: initData,
      expiresAt: Date.now() + this.cachePolicy.getTtl(),
    });

    return initData;
  }

  /**
   * 调用Dify应用信息API
   */
  async callDifyInfoAPI(agent: AgentConfig): Promise<DifyAppInfo> {
    try {
      // 构建Dify API URL
      const baseUrl = agent.endpoint.replace(/\/v1\/chat-messages$/, '');
      const infoUrl = `${baseUrl}/v1/info`;

      logger.debug('🚀 调用Dify Info API', { infoUrl, agentId: agent.id });

      // 发送请求
      const response = await this.httpClient.get(infoUrl, {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`,
        },
      });

      logger.debug('✅ Dify Info API调用成功', { agentId: agent.id });
      return response.data;

    } catch (error) {
      logger.error('❌ Dify Info API调用失败', { 
        agentId: agent.id, 
        error: error instanceof Error ? error.message : error 
      });
      if (error && typeof error === 'object' && 'isAxiosError' in error && (error as any).isAxiosError) {
        const axiosError = error as any;
        const message = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;
        throw new Error(`Dify Info API调用失败 (${statusCode || 'unknown'}): ${message}`);
      }
      throw error;
    }
  }

  /**
   * 调用Dify应用参数API
   */
  async callDifyParametersAPI(agent: AgentConfig): Promise<DifyAppParameters> {
    try {
      // 构建Dify API URL
      const baseUrl = agent.endpoint.replace(/\/v1\/chat-messages$/, '');
      const parametersUrl = `${baseUrl}/v1/parameters`;

      logger.debug('🚀 调用Dify Parameters API', { parametersUrl, agentId: agent.id });

      // 发送请求
      const response = await this.httpClient.get(parametersUrl, {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`,
        },
      });

      logger.debug('✅ Dify Parameters API调用成功', { agentId: agent.id });
      return response.data;

    } catch (error) {
      logger.error('❌ Dify Parameters API调用失败', { 
        agentId: agent.id, 
        error: error instanceof Error ? error.message : error 
      });
      if (error && typeof error === 'object' && 'isAxiosError' in error && (error as any).isAxiosError) {
        const axiosError = error as any;
        const message = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;
        throw new Error(`Dify Parameters API调用失败 (${statusCode || 'unknown'}): ${message}`);
      }
      throw error;
    }
  }

  /**
   * 直接通过endpoint和apiKey获取应用信息（用于管理端自动获取）
   */
  async fetchAppInfoByCredentials(
    endpoint: string,
    apiKey: string
  ): Promise<{
    name: string;
    description: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    capabilities: string[];
    features: AgentConfig['features'];
    variables?: Array<{
      name: string;
      label: string;
      required: boolean;
      type: string;
    }>;
    fileUpload?: {
      enabled: boolean;
      allowedTypes: string[];
    };
  }> {
    try {
      // 构建Dify API URL
      const baseUrl = endpoint.replace(/\/v1\/chat-messages$/, '');
      const infoUrl = `${baseUrl}/v1/info`;
      const parametersUrl = `${baseUrl}/v1/parameters`;

      logger.debug('🔍 自动获取Dify应用信息', { endpoint });

      // 并行调用API
      const [infoResponse, paramsResponse] = await Promise.all([
        this.httpClient.get(infoUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }),
        this.httpClient.get(parametersUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }),
      ]);

      const appInfo: DifyAppInfo = infoResponse.data;
      const params: DifyAppParameters = paramsResponse.data;

      // 提取能力标签
      const capabilities: string[] = ['chat'];
      if (params.file_upload?.enabled) {
        capabilities.push('file-upload');
      }
      if (params.user_input_form && params.user_input_form.length > 0) {
        capabilities.push('variables');
      }

      // 转换变量定义
      const variables = params.user_input_form.map(field => ({
        name: field.variable,
        label: field.label,
        required: field.required,
        type: field.options ? 'select' : field.max_length ? 'textarea' : 'text',
      }));

      // 转换文件上传配置
      const fileUpload = params.file_upload ? {
        enabled: params.file_upload.enabled,
        allowedTypes: params.file_upload.allowed_file_extensions || [],
      } : undefined;

      logger.info('✅ Dify应用信息获取成功', {
        name: appInfo.name,
        model: appInfo.model_config.model,
      });

      const result: {
        name: string;
        description: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
        capabilities: string[];
        features: AgentConfig['features'];
        variables?: Array<{
          name: string;
          label: string;
          required: boolean;
          type: string;
        }>;
        fileUpload?: {
          enabled: boolean;
          allowedTypes: string[];
        };
      } = {
        name: appInfo.name,
        description: appInfo.description || `Dify应用: ${appInfo.name}`,
        model: appInfo.model_config.model,
        temperature: appInfo.model_config.parameters.temperature,
        maxTokens: appInfo.model_config.parameters.max_tokens,
        capabilities,
        features: {
          supportsChatId: true, // Dify使用conversation_id
          supportsStream: true,
          supportsDetail: false, // Dify没有detail模式
          supportsFiles: params.file_upload?.enabled || false,
          supportsImages: params.file_upload?.allowed_file_types?.includes('image') || false,
          streamingConfig: {
            enabled: true,
            endpoint: 'same',
            statusEvents: false, // Dify没有FastGPT的状态事件
            flowNodeStatus: false,
          },
        },
        variables,
      };

      // 只有在fileUpload存在时才添加
      if (fileUpload) {
        result.fileUpload = fileUpload;
      }

      return result;

    } catch (error) {
      logger.error('❌ Dify应用信息获取失败', { 
        endpoint, 
        error: error instanceof Error ? error.message : error 
      });
      if (error && typeof error === 'object' && 'isAxiosError' in error && (error as any).isAxiosError) {
        const axiosError = error as any;
        const message = axiosError.response?.data?.message || axiosError.message;
        const statusCode = axiosError.response?.status;
        throw new Error(`Dify API调用失败 (${statusCode || 'unknown'}): ${message}`);
      }
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.cachePolicy.reset();
    logger.debug('🧹 Dify初始化数据缓存已清除');
  }

  /**
   * 清除过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

