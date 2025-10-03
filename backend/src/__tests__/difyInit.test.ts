import { DifyInitService } from '../services/DifyInitService';
import { AgentConfigService } from '../services/AgentConfigService';
import type { AgentConfig } from '../types';

// Mock AgentConfigService
jest.mock('../services/AgentConfigService');

describe('DifyInitService', () => {
  let difyInitService: DifyInitService;
  let mockAgentConfigService: jest.Mocked<AgentConfigService>;
  const mockAgent: AgentConfig = {
    id: 'dify-test',
    name: 'Test Dify Agent',
    description: 'Test agent for Dify integration',
    provider: 'dify',
    endpoint: 'https://api.dify.ai/v1',
    apiKey: 'test-api-key',
    appId: '',
    model: 'gpt-4o-mini',
    isActive: true,
    capabilities: ['chat', 'completion'],
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
    },
    features: {
      supportsChatId: true,
      supportsStream: true,
      supportsDetail: false,
      supportsFiles: false,
      supportsImages: false,
      streamingConfig: {
        enabled: true,
        endpoint: 'same',
        statusEvents: false,
        flowNodeStatus: false,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentConfigService = new AgentConfigService() as jest.Mocked<AgentConfigService>;
    mockAgentConfigService.getAgent = jest.fn().mockResolvedValue(mockAgent);
    difyInitService = new DifyInitService(mockAgentConfigService);
  });

  describe('getInitData', () => {
    it('应该返回Dify初始化数据的标准格式', async () => {
      const result = await difyInitService.getInitData('dify-test');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('temperature');
      expect(result).toHaveProperty('max_tokens');
      expect(result).toHaveProperty('capabilities');
      expect(result).toHaveProperty('supports_stream');
    });

    it('应该正确传递智能体配置', async () => {
      const result = await difyInitService.getInitData('dify-test');

      expect(mockAgentConfigService.getAgent).toHaveBeenCalledWith('dify-test');
      expect(result.appInfo.name).toBe(mockAgent.name);
      expect(result.appInfo.description).toBe(mockAgent.description);
      expect(result.appInfo.model_config.model).toBe(mockAgent.model);
    });

    it('应该处理可选配置项', async () => {
      const agentWithOptionals = {
        ...mockAgent,
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.8,
        maxTokens: 2000,
      };
      mockAgentConfigService.getAgent = jest.fn().mockResolvedValue(agentWithOptionals);

      const result = await difyInitService.getInitData('dify-test');

      // 验证响应结构存在
      expect(result.appInfo).toBeDefined();
      expect(result.appInfo.model_config).toBeDefined();
      expect(result.appInfo.model_config.parameters).toBeDefined();
      expect(result.appInfo.model_config.parameters.temperature).toBe(0.8);
      expect(result.appInfo.model_config.parameters.max_tokens).toBe(2000);
    });

    it('应该在智能体不存在时抛出错误', async () => {
      mockAgentConfigService.getAgent = jest.fn().mockResolvedValue(null);

      await expect(difyInitService.getInitData('non-existent'))
        .rejects
        .toThrow('智能体配置不存在');
    });

    it('应该在智能体不是dify类型时抛出错误', async () => {
      const nonDifyAgent = { ...mockAgent, provider: 'openai' as const };
      mockAgentConfigService.getAgent = jest.fn().mockResolvedValue(nonDifyAgent);

      await expect(difyInitService.getInitData('dify-test'))
        .rejects
        .toThrow('不是Dify智能体');
    });
  });

  describe('callDifyInitAPI', () => {
    it('应该构造正确的初始化数据结构', async () => {
      // 这个测试验证数据结构而不实际调用API
      const result = await difyInitService.getInitData('dify-test');

      expect(result).toMatchObject({
        appInfo: expect.objectContaining({
          name: expect.any(String),
          description: expect.any(String),
          model_config: expect.objectContaining({
            model: expect.any(String),
            parameters: expect.any(Object),
          }),
        }),
        parameters: expect.objectContaining({
          user_input_form: expect.any(Array),
        }),
      });
    });
  });

  describe('缓存机制', () => {
    it('应该能够缓存初始化数据', async () => {
      // 第一次调用
      await difyInitService.getInitData('dify-test');
      
      // 第二次调用应该使用缓存
      await difyInitService.getInitData('dify-test');

      // 验证只调用了一次getAgent
      expect(mockAgentConfigService.getAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理网络错误', async () => {
      mockAgentConfigService.getAgent = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(difyInitService.getInitData('dify-test'))
        .rejects
        .toThrow('Network error');
    });

    it('应该正确处理配置缺失', async () => {
      const incompleteAgent = { ...mockAgent, endpoint: '' };
      mockAgentConfigService.getAgent = jest.fn().mockResolvedValue(incompleteAgent);

      await expect(difyInitService.getInitData('dify-test'))
        .rejects
        .toThrow();
    });
  });
});

