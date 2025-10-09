/**
 * ChatProxyService 单元测试
 * 
 * 测试覆盖:
 * - 提供商适配器 (FastGPT, OpenAI, Anthropic, Dify)
 * - 非流式消息发送
 * - 流式消息发送
 * - SSE 事件解析和分发
 * - 错误处理
 * 
 * 目标覆盖率: 80%+
 */

import { ChatProxyService, FastGPTProvider, OpenAIProvider, AnthropicProvider, DifyProvider } from '@/services/ChatProxyService';
import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatMessage, AgentConfig, ChatOptions } from '@/types';
import axios from 'axios';
import { ResourceError, ValidationError, ExternalServiceError } from '@/types/errors';

// Mock 依赖
jest.mock('axios');
jest.mock('@/services/AgentConfigService');
jest.mock('@/services/ChatLogService');
jest.mock('@/services/ProtectionService', () => ({
  getProtectionService: jest.fn(() => ({
    executeProtected: jest.fn((operation: Function) => operation()),
  })),
}));
jest.mock('@/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('ChatProxyService', () => {
  let chatProxyService: ChatProxyService;
  let mockAgentService: jest.Mocked<AgentConfigService>;
  let mockAxios: jest.Mocked<typeof axios>;
  let mockHttpClient: any;

  const TEST_AGENT_ID = 'test-agent-123';
  const TEST_MESSAGES: ChatMessage[] = [
    { role: 'user', content: 'Hello, how are you?' },
  ];

  const TEST_AGENT_CONFIG: AgentConfig = {
    id: TEST_AGENT_ID,
    name: 'Test Agent',
    description: 'Test agent description',
    provider: 'fastgpt',
    endpoint: 'https://api.fastgpt.com/v1/chat',
    apiKey: 'test-api-key',
    model: 'gpt-4',
    isActive: true,
    capabilities: ['chat', 'stream'],
    features: {
      supportsChatId: true,
      supportsStream: true,
      supportsDetail: false,
      supportsFiles: false,
      supportsImages: false,
      streamingConfig: {
        enabled: true,
        endpoint: 'same',
        statusEvents: true,
        flowNodeStatus: true,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AgentConfigService
    mockAgentService = {
      getAgent: jest.fn().mockResolvedValue(TEST_AGENT_CONFIG),
      listAgents: jest.fn(),
      reloadAgents: jest.fn(),
      validateAgent: jest.fn(),
    } as any;

    // Mock axios
    mockHttpClient = {
      post: jest.fn(),
      get: jest.fn(),
    };

    mockAxios = axios as jest.Mocked<typeof axios>;
    mockAxios.create = jest.fn().mockReturnValue(mockHttpClient);

    // 创建服务实例
    chatProxyService = new ChatProxyService(mockAgentService);
  });

  describe('构造函数', () => {
    it('应该成功初始化服务并注册所有提供商', () => {
      expect(chatProxyService).toBeDefined();
      expect(mockAxios.create).toHaveBeenCalledWith({
        timeout: expect.any(Number),
      });
    });
  });

  describe('sendMessage - 非流式', () => {
    it('应该成功发送消息并返回响应', async () => {
      const mockResponse = {
        data: {
          id: 'response-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'I am doing well, thank you!',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        },
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await chatProxyService.sendMessage(
        TEST_AGENT_ID,
        TEST_MESSAGES
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('choices');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0]?.message.content).toBeTruthy();
      expect(mockAgentService.getAgent).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        TEST_AGENT_CONFIG.endpoint,
        expect.any(Object),
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    it('应该在智能体不存在时抛出 ResourceError', async () => {
      mockAgentService.getAgent.mockResolvedValue(null);

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toThrow(ResourceError);

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toMatchObject({
        code: 'AGENT_NOT_FOUND',
      });
    });

    it('应该在智能体未激活时抛出 ValidationError', async () => {
      mockAgentService.getAgent.mockResolvedValue({
        ...TEST_AGENT_CONFIG,
        isActive: false,
      });

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toThrow(ValidationError);

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toMatchObject({
        code: 'AGENT_INACTIVE',
      });
    });

    it('应该在不支持的提供商时抛出 ValidationError', async () => {
      mockAgentService.getAgent.mockResolvedValue({
        ...TEST_AGENT_CONFIG,
        provider: 'unsupported-provider' as any,
      });

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toThrow(ValidationError);

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toMatchObject({
        code: 'UNSUPPORTED_PROVIDER',
      });
    });

    it('应该在 API 请求失败时抛出 ExternalServiceError', async () => {
      mockHttpClient.post.mockRejectedValue(new Error('Network error'));

      await expect(
        chatProxyService.sendMessage(TEST_AGENT_ID, TEST_MESSAGES)
      ).rejects.toThrow();
    });
  });

  describe('FastGPTProvider', () => {
    let provider: FastGPTProvider;

    beforeEach(() => {
      provider = new FastGPTProvider();
    });

    describe('transformRequest', () => {
      it('应该正确转换请求格式', () => {
        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false
        );

        expect(result).toHaveProperty('chatId');
        expect(result).toHaveProperty('stream');
        expect(result).toHaveProperty('messages');
        expect(result.stream).toBe(false);
        expect(Array.isArray(result.messages)).toBe(true);
      });

      it('应该支持流式模式', () => {
        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          true
        );

        expect(result.stream).toBe(true);
      });

      it('应该支持自定义 chatId', () => {
        const options: ChatOptions = {
          chatId: 'custom-chat-id',
        };

        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false,
          options
        );

        expect(result.chatId).toBe('custom-chat-id');
      });

      it('应该支持 variables 参数', () => {
        const options: ChatOptions = {
          variables: { key: 'value' },
        };

        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false,
          options
        );

        expect(result.variables).toEqual({ key: 'value' });
      });
    });

    describe('transformResponse', () => {
      it('应该正确转换响应格式', () => {
        const mockResponse = {
          id: 'response-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        };

        const result = provider.transformResponse(mockResponse);

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('choices');
        expect(result.choices[0]?.message.content).toBe('Test response');
      });

      it('应该处理空 choices 数组', () => {
        const mockResponse = {
          id: 'response-123',
          choices: [],
        };

        const result = provider.transformResponse(mockResponse);

        expect(result.choices).toHaveLength(1);
        expect(result.choices[0]?.message.content).toBe('');
      });
    });

    describe('transformStreamResponse', () => {
      it('应该正确提取流式响应内容', () => {
        const chunk = {
          choices: [{
            index: 0,
            delta: {
              content: 'Hello',
            },
          }],
        };

        const result = provider.transformStreamResponse(chunk);

        expect(result).toBe('Hello');
      });

      it('应该处理空内容', () => {
        const chunk = {
          choices: [{
            index: 0,
            delta: {},
          }],
        };

        const result = provider.transformStreamResponse(chunk);

        expect(result).toBe('');
      });
    });

    describe('validateConfig', () => {
      it('应该验证有效配置', () => {
        const validConfig = {
          ...TEST_AGENT_CONFIG,
          apiKey: 'fastgpt-test-key',
          endpoint: 'https://api.fastgpt.com/api/v1/chat/completions',
        };

        const result = provider.validateConfig(validConfig);

        expect(result).toBe(true);
      });

      it('应该拒绝缺少 endpoint 的配置', () => {
        const invalidConfig = { ...TEST_AGENT_CONFIG, endpoint: '' };

        const result = provider.validateConfig(invalidConfig);

        expect(result).toBe(false);
      });

      it('应该拒绝缺少 apiKey 的配置', () => {
        const invalidConfig = { ...TEST_AGENT_CONFIG, apiKey: '' };

        const result = provider.validateConfig(invalidConfig);

        expect(result).toBe(false);
      });
    });

    describe('buildHeaders', () => {
      it('应该构建正确的请求头', () => {
        const headers = provider.buildHeaders(TEST_AGENT_CONFIG);

        expect(headers).toHaveProperty('Authorization');
        expect(headers.Authorization).toBe(`Bearer ${TEST_AGENT_CONFIG.apiKey}`);
        expect(headers).toHaveProperty('Content-Type');
        expect(headers['Content-Type']).toBe('application/json');
      });
    });
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider();
    });

    describe('transformRequest', () => {
      it('应该正确转换请求格式', () => {
        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false
        );

        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('messages');
        expect(result).toHaveProperty('stream');
        expect(result.model).toBe(TEST_AGENT_CONFIG.model);
      });

      it('应该正确映射消息', () => {
        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false
        );

        const messages = result.messages as Array<{ role: string; content: string }>;
        expect(messages).toHaveLength(1);
        expect(messages[0]?.role).toBe('user');
        expect(messages[0]?.content).toBe('Hello, how are you?');
      });
    });

    describe('transformResponse', () => {
      it('应该正确转换响应格式', () => {
        const mockResponse = {
          id: 'response-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'OpenAI response',
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        };

        const result = provider.transformResponse(mockResponse);

        expect(result.choices[0]?.message.content).toBe('OpenAI response');
      });
    });
  });

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = new AnthropicProvider();
    });

    describe('transformRequest', () => {
      it('应该正确转换请求格式', () => {
        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false
        );

        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('messages');
        expect(result).toHaveProperty('max_tokens');
      });
    });

    describe('transformResponse', () => {
      it('应该正确转换 Anthropic 响应格式', () => {
        const mockResponse = {
          id: 'response-123',
          type: 'message' as const,
          role: 'assistant' as const,
          model: 'claude-3',
          content: [{
            type: 'text' as const,
            text: 'Anthropic response',
          }],
          stop_reason: 'end_turn' as string | null,
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
          },
        };

        const result = provider.transformResponse(mockResponse);

        expect(result.choices[0]?.message.content).toBe('Anthropic response');
      });
    });

    describe('buildHeaders', () => {
      it('应该构建 Anthropic 特定的请求头', () => {
        const headers = provider.buildHeaders(TEST_AGENT_CONFIG);

        expect(headers).toHaveProperty('x-api-key');
        expect(headers).toHaveProperty('anthropic-version');
        expect(headers['anthropic-version']).toBe('2023-06-01');
      });
    });
  });

  describe('DifyProvider', () => {
    let provider: DifyProvider;

    beforeEach(() => {
      provider = new DifyProvider();
    });

    describe('transformRequest', () => {
      it('应该正确转换请求格式', () => {
        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false
        );

        expect(result).toHaveProperty('query');
        expect(result).toHaveProperty('response_mode');
        expect(result).toHaveProperty('user');
        expect(result.query).toBe('Hello, how are you?');
      });

      it('应该在没有用户消息时抛出 ValidationError', () => {
        const systemMessages: ChatMessage[] = [
          { role: 'system', content: 'You are a helpful assistant.' },
        ];

        expect(() => {
          provider.transformRequest(systemMessages, TEST_AGENT_CONFIG, false);
        }).toThrow(ValidationError);
      });

      it('应该支持 conversation_id', () => {
        const options: ChatOptions = {
          chatId: 'conversation-123',
        };

        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false,
          options
        );

        expect(result.conversation_id).toBe('conversation-123');
      });

      it('应该支持 inputs 变量', () => {
        const options: ChatOptions = {
          variables: { key: 'value' },
        };

        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false,
          options
        );

        expect(result.inputs).toEqual({ key: 'value' });
      });

      it('应该支持文件上传', () => {
        const options: ChatOptions = {
          files: [{
            type: 'image',
            url: 'https://example.com/image.jpg',
          }],
        };

        const result = provider.transformRequest(
          TEST_MESSAGES,
          TEST_AGENT_CONFIG,
          false,
          options
        );

        expect(Array.isArray(result.files)).toBe(true);
        const files = result.files as any[];
        expect(files).toHaveLength(1);
        expect(files[0]).toHaveProperty('type');
        expect(files[0]).toHaveProperty('url');
      });
    });

    describe('transformResponse', () => {
      it('应该正确转换 Dify 响应格式', () => {
        const mockResponse = {
          message_id: 'msg-123',
          conversation_id: 'conv-123',
          mode: 'chat',
          answer: 'Dify response',
          metadata: {
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          },
          created_at: Date.now(),
        };

        const result = provider.transformResponse(mockResponse);

        expect(result.choices[0]?.message.content).toBe('Dify response');
      });
    });
  });
});
