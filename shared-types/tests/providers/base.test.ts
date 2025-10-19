/**
 * Provider 基础类型测试
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type {
  BaseProvider,
  ProviderConfig,
  ProviderFeatures,
  ProviderValidationResult,
  ProviderRequest,
  ProviderResponse,
  ProviderMetrics,
  ProviderStatus,
  ProviderType,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ModelConfig,
  ProviderCapabilities
} from '../../src/providers/base.js';

describe('BaseProvider 基础提供商接口', () => {
  describe('提供商基础属性', () => {
    it('应该定义所有必需的提供商属性', () => {
      const provider: BaseProvider = {
        type: 'openai',
        name: 'OpenAI Provider',
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: false,
          supportsTools: false,
          maxTokens: 4096,
          supportedModels: ['gpt-3.5-turbo', 'gpt-4'],
          rateLimits: {
            requestsPerMinute: 60,
            tokensPerMinute: 90000
          }
        },
        validateConfig: jest.fn(),
        transformRequest: jest.fn(),
        transformResponse: jest.fn()
      };

      expect(provider.type).toBe('openai');
      expect(provider.name).toBe('OpenAI Provider');
      expect(provider.features.supportsStream).toBe(true);
      expect(provider.features.maxTokens).toBe(4096);
      expect(typeof provider.validateConfig).toBe('function');
      expect(typeof provider.transformRequest).toBe('function');
      expect(typeof provider.transformResponse).toBe('function');
    });

    it('应该支持所有提供商类型', () => {
      const providerTypes: ProviderType[] = ['openai', 'anthropic', 'fastgpt', 'dify', 'custom'];

      providerTypes.forEach(type => {
        const provider: BaseProvider = {
          type,
          name: `${type} Provider`,
          features: {
            supportsStream: true,
            supportsFiles: false,
            supportsImages: false,
            supportsTools: false,
            maxTokens: 2048,
            supportedModels: [`${type}-model`],
            rateLimits: {
              requestsPerMinute: 30,
              tokensPerMinute: 40000
            }
          },
          validateConfig: jest.fn(),
          transformRequest: jest.fn(),
          transformResponse: jest.fn()
        };

        expect(provider.type).toBe(type);
      });
    });
  });

  describe('提供商功能特性', () => {
    it('应该支持完整的功能特性配置', () => {
      const features: ProviderFeatures = {
        supportsStream: true,
        supportsFiles: true,
        supportsImages: true,
        supportsTools: true,
        supportsFunctionCalling: true,
        supportsMultiModal: true,
        maxTokens: 8192,
        maxFileSize: 10485760, // 10MB
        supportedFileTypes: ['.txt', '.pdf', '.docx', '.png', '.jpg'],
        supportedImageFormats: ['png', 'jpeg', 'webp'],
        supportedModels: [
          'gpt-3.5-turbo',
          'gpt-4',
          'gpt-4-vision-preview',
          'gpt-4-1106-preview'
        ],
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 90000,
          requestsPerHour: 3000,
          tokensPerHour: 1800000
        },
        capabilities: {
          textGeneration: true,
          codeGeneration: true,
          imageAnalysis: true,
          fileProcessing: true,
          webSearch: false,
          calculator: false,
          dataVisualization: false
        }
      };

      expect(features.supportsStream).toBe(true);
      expect(features.supportsFiles).toBe(true);
      expect(features.supportsImages).toBe(true);
      expect(features.supportsTools).toBe(true);
      expect(features.maxTokens).toBe(8192);
      expect(features.supportedFileTypes).toHaveLength(5);
      expect(features.supportedModels).toHaveLength(4);
      expect(features.rateLimits.requestsPerMinute).toBe(60);
      expect(features.capabilities.textGeneration).toBe(true);
      expect(features.capabilities.webSearch).toBe(false);
    });
  });
});

describe('ProviderConfig 提供商配置', () => {
  describe('基础配置', () => {
    it('应该支持基础配置字段', () => {
      const config: ProviderConfig = {
        type: 'openai',
        name: 'OpenAI GPT',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      };

      expect(config.type).toBe('openai');
      expect(config.name).toBe('OpenAI GPT');
      expect(config.endpoint).toBe('https://api.openai.com/v1/chat/completions');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.model).toBe('gpt-3.5-turbo');
      expect(config.maxTokens).toBe(2048);
      expect(config.temperature).toBe(0.7);
      expect(config.timeout).toBe(30000);
      expect(config.retryAttempts).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });

    it('应该支持可选配置字段', () => {
      const config: ProviderConfig = {
        type: 'anthropic',
        name: 'Anthropic Claude',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-sonnet-20240229',
        organization: 'org-test',
        headers: {
          'X-Custom-Header': 'custom-value'
        },
        proxy: {
          host: 'proxy.example.com',
          port: 8080,
          protocol: 'http'
        }
      };

      expect(config.organization).toBe('org-test');
      expect(config.headers?.['X-Custom-Header']).toBe('custom-value');
      expect(config.proxy?.host).toBe('proxy.example.com');
      expect(config.proxy?.port).toBe(8080);
    });

    it('应该支持高级配置选项', () => {
      const advancedConfig: ProviderConfig = {
        type: 'openai',
        name: 'Advanced OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-advanced-key',
        model: 'gpt-4',
        maxTokens: 4096,
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        stopSequences: ['\n\n', '---'],
        logprobs: true,
        topLogprobs: 5,
        seed: 42,
        responseFormat: { type: 'json_object' },
        tools: [
          {
            type: 'function',
            function: {
              name: 'calculate',
              description: 'Calculate mathematical expressions',
              parameters: {
                type: 'object',
                properties: {
                  expression: { type: 'string' }
                },
                required: ['expression']
              }
            }
          }
        ],
        toolChoice: 'auto'
      };

      expect(advancedConfig.topP).toBe(0.9);
      expect(advancedConfig.frequencyPenalty).toBe(0.1);
      expect(advancedConfig.stopSequences).toHaveLength(2);
      expect(advancedConfig.logprobs).toBe(true);
      expect(advancedConfig.topLogprobs).toBe(5);
      expect(advancedConfig.seed).toBe(42);
      expect(advancedConfig.responseFormat?.type).toBe('json_object');
      expect(advancedConfig.tools).toHaveLength(1);
      expect(advancedConfig.toolChoice).toBe('auto');
    });
  });
});

describe('ProviderValidationResult 配置验证结果', () => {
  describe('验证结果结构', () => {
    it('应该支持成功验证结果', () => {
      const validResult: ProviderValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        details: {
          endpoint: 'Valid endpoint',
          apiKey: 'Valid API key format',
          model: 'Model is supported'
        }
      };

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validResult.warnings).toHaveLength(0);
      expect(validResult.details?.endpoint).toBe('Valid endpoint');
    });

    it('应该支持验证错误', () => {
      const invalidResult: ProviderValidationResult = {
        isValid: false,
        errors: [
          {
            field: 'apiKey',
            message: 'API key is required',
            code: 'REQUIRED'
          },
          {
            field: 'endpoint',
            message: 'Invalid URL format',
            code: 'INVALID_FORMAT'
          }
        ],
        warnings: [
          {
            field: 'temperature',
            message: 'Temperature value is high, may affect creativity',
            code: 'HIGH_VALUE'
          }
        ]
      };

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
      expect(invalidResult.warnings).toHaveLength(1);
      expect(invalidResult.errors[0].field).toBe('apiKey');
      expect(invalidResult.errors[1].code).toBe('INVALID_FORMAT');
      expect(invalidResult.warnings[0].message).toContain('high');
    });
  });
});

describe('ChatRequest 和 ChatResponse 聊天请求响应', () => {
  describe('ChatRequest 聊天请求', () => {
    it('应该支持基础聊天请求', () => {
      const request: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ],
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.7,
        stream: false
      };

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.model).toBe('gpt-3.5-turbo');
      expect(request.maxTokens).toBe(1000);
      expect(request.stream).toBe(false);
    });

    it('应该支持多轮对话', () => {
      const multiTurnRequest: ChatRequest = {
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'What can you do?'
          },
          {
            role: 'assistant',
            content: 'I can help you with various tasks...'
          },
          {
            role: 'user',
            content: 'Tell me more.'
          }
        ],
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.5
      };

      expect(multiTurnRequest.messages).toHaveLength(4);
      expect(multiTurnRequest.messages[0].role).toBe('system');
      expect(multiTurnRequest.messages[2].role).toBe('assistant');
    });

    it('应该支持流式请求', () => {
      const streamRequest: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Explain quantum computing'
          }
        ],
        model: 'gpt-4',
        stream: true,
        maxTokens: 1500,
        temperature: 0.3
      };

      expect(streamRequest.stream).toBe(true);
      expect(streamRequest.messages[0].content).toBe('Explain quantum computing');
    });

    it('应该支持带工具的请求', () => {
      const toolRequest: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'What is the weather in New York?'
          }
        ],
        model: 'gpt-4',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
                },
                required: ['location']
              }
            }
          }
        ],
        toolChoice: 'auto'
      };

      expect(toolRequest.tools).toHaveLength(1);
      expect(toolRequest.tools![0].function.name).toBe('get_weather');
      expect(toolRequest.toolChoice).toBe('auto');
    });
  });

  describe('ChatResponse 聊天响应', () => {
    it('应该支持基础聊天响应', () => {
      const response: ChatResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I can help you with various tasks.'
            },
            finishReason: 'stop'
          }
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25
        }
      };

      expect(response.id).toBe('chatcmpl-123');
      expect(response.model).toBe('gpt-3.5-turbo');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.role).toBe('assistant');
      expect(response.choices[0].finishReason).toBe('stop');
      expect(response.usage.totalTokens).toBe(25);
    });

    it('应该支持工具调用响应', () => {
      const toolResponse: ChatResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              toolCalls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "New York", "unit": "celsius"}'
                  }
                }
              ]
            },
            finishReason: 'tool_calls'
          }
        ],
        usage: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30
        }
      };

      expect(toolResponse.choices[0].message.content).toBeNull();
      expect(toolResponse.choices[0].message.toolCalls).toHaveLength(1);
      expect(toolResponse.choices[0].message.toolCalls![0].function.name).toBe('get_weather');
      expect(toolResponse.choices[0].finishReason).toBe('tool_calls');
    });

    it('应该支持流式响应块', () => {
      const chunk: StreamChunk = {
        id: 'chunk-789',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello'
            },
            finishReason: null
          }
        ]
      };

      expect(chunk.object).toBe('chat.completion.chunk');
      expect(chunk.choices[0].delta.content).toBe('Hello');
      expect(chunk.choices[0].finishReason).toBeNull();
    });
  });
});

describe('ProviderMetrics 提供商指标', () => {
  describe('基础指标', () => {
    it('应该支持完整的提供商指标', () => {
      const metrics: ProviderMetrics = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        timestamp: new Date().toISOString(),
        requestId: 'req-123',
        duration: 1500,
        tokenUsage: {
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150
        },
        cost: {
          promptCost: 0.0001,
          completionCost: 0.0002,
          totalCost: 0.0003,
          currency: 'USD'
        },
        performance: {
          latency: 1500,
          ttfb: 500, // time to first byte
          throughput: 0.1, // tokens per second
          queueTime: 100
        },
        quality: {
          finishReason: 'stop',
          contentLength: 500,
          averageLogProbability: -0.5
        },
        status: 'success',
        errors: []
      };

      expect(metrics.provider).toBe('openai');
      expect(metrics.model).toBe('gpt-3.5-turbo');
      expect(metrics.duration).toBe(1500);
      expect(metrics.tokenUsage.totalTokens).toBe(150);
      expect(metrics.cost.totalCost).toBe(0.0003);
      expect(metrics.performance.latency).toBe(1500);
      expect(metrics.performance.ttfb).toBe(500);
      expect(metrics.quality.finishReason).toBe('stop');
      expect(metrics.status).toBe('success');
    });

    it('应该支持错误指标', () => {
      const errorMetrics: ProviderMetrics = {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        timestamp: new Date().toISOString(),
        requestId: 'req-error-456',
        duration: 5000,
        status: 'error',
        errors: [
          {
            type: 'rate_limit',
            message: 'Rate limit exceeded',
            code: 'rate_limit_exceeded',
            retryable: true,
            retryAfter: 60
          },
          {
            type: 'timeout',
            message: 'Request timeout',
            code: 'timeout',
            retryable: true
          }
        ]
      };

      expect(errorMetrics.status).toBe('error');
      expect(errorMetrics.errors).toHaveLength(2);
      expect(errorMetrics.errors[0].type).toBe('rate_limit');
      expect(errorMetrics.errors[0].retryable).toBe(true);
      expect(errorMetrics.errors[0].retryAfter).toBe(60);
    });
  });
});

describe('ProviderCapabilities 提供商能力', () => {
  describe('能力定义', () => {
    it('应该支持完整的提供商能力定义', () => {
      const capabilities: ProviderCapabilities = {
        textGeneration: {
          supported: true,
          maxTokens: 8192,
          supportedLanguages: ['en', 'zh', 'es', 'fr', 'de', 'ja'],
          features: ['creative', 'analytical', 'conversational', 'technical']
        },
        codeGeneration: {
          supported: true,
          supportedLanguages: ['javascript', 'python', 'java', 'cpp', 'go', 'rust'],
          features: ['completion', 'explanation', 'debugging', 'refactoring']
        },
        imageAnalysis: {
          supported: true,
          supportedFormats: ['png', 'jpeg', 'webp', 'gif'],
          maxImageSize: 10485760, // 10MB
          features: ['description', 'ocr', 'object_detection', 'text_extraction']
        },
        fileProcessing: {
          supported: true,
          supportedFileTypes: ['.txt', '.pdf', '.docx', '.csv', '.json'],
          maxFileSize: 20971520, // 20MB
          features: ['text_extraction', 'summarization', 'analysis']
        },
        toolUse: {
          supported: true,
          maxTools: 10,
          supportedToolTypes: ['function', 'retrieval', 'code_interpreter'],
          features: ['parallel', 'conditional', 'nested']
        },
        streaming: {
          supported: true,
          chunkSize: 100,
          supportedFormats: ['text', 'json', 'events'],
          features: ['delta', 'full_chunk', 'metadata']
        },
        multimodal: {
          supported: true,
          supportedModalities: ['text', 'image', 'audio'],
          maxConcurrentModalities: 3,
          features: ['cross_modal_reasoning', 'modal_fusion']
        },
        customization: {
          supported: true,
          customInstructions: true,
          systemPrompts: true,
          fineTuning: false,
          features: ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty']
        }
      };

      expect(capabilities.textGeneration.supported).toBe(true);
      expect(capabilities.textGeneration.maxTokens).toBe(8192);
      expect(capabilities.textGeneration.supportedLanguages).toContain('zh');
      expect(capabilities.codeGeneration.supportedLanguages).toHaveLength(6);
      expect(capabilities.imageAnalysis.supportedFormats).toHaveLength(4);
      expect(capabilities.fileProcessing.maxFileSize).toBe(20971520);
      expect(capabilities.toolUse.maxTools).toBe(10);
      expect(capabilities.streaming.chunkSize).toBe(100);
      expect(capabilities.multimodal.supportedModalities).toHaveLength(3);
      expect(capabilities.customization.customInstructions).toBe(true);
    });
  });
});

describe('ProviderStatus 提供商状态', () => {
  describe('状态管理', () => {
    it('应该支持所有提供商状态', () => {
      const statuses: ProviderStatus[] = ['active', 'inactive', 'error', 'maintenance', 'deprecated'];

      statuses.forEach(status => {
        const statusInfo = { status, timestamp: new Date().toISOString() };
        expect(statusInfo.status).toBe(status);
      });
    });

    it('应该支持详细状态信息', () => {
      const detailedStatus = {
        status: 'active' as ProviderStatus,
        timestamp: new Date().toISOString(),
        details: {
          uptime: 0.999,
          responseTime: 250,
          successRate: 0.995,
          lastError: null,
          version: '1.0.0',
          region: 'us-east-1',
          endpoint: 'https://api.openai.com/v1'
        },
        healthChecks: {
          connectivity: 'healthy',
          authentication: 'healthy',
          rateLimit: 'degraded',
          features: 'healthy'
        }
      };

      expect(detailedStatus.status).toBe('active');
      expect(detailedStatus.details?.uptime).toBe(0.999);
      expect(detailedStatus.details?.responseTime).toBe(250);
      expect(detailedStatus.healthChecks?.connectivity).toBe('healthy');
      expect(detailedStatus.healthChecks?.rateLimit).toBe('degraded');
    });
  });
});

describe('ModelConfig 模型配置', () => {
  describe('模型参数配置', () => {
    it('应该支持完整的模型配置', () => {
      const modelConfig: ModelConfig = {
        name: 'gpt-4-turbo',
        provider: 'openai',
        version: '1.0.0',
        parameters: {
          maxTokens: 4096,
          temperature: { min: 0, max: 2, default: 0.7 },
          topP: { min: 0, max: 1, default: 0.9 },
          frequencyPenalty: { min: -2, max: 2, default: 0 },
          presencePenalty: { min: -2, max: 2, default: 0 },
          stopSequences: ['\n\n', '---', '###'],
          logprobs: false,
          topLogprobs: 0
        },
        capabilities: {
          supportsStreaming: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsTools: true,
          supportsJsonMode: true,
          maxContextLength: 128000,
          trainingDataCutoff: '2023-12-01'
        },
        pricing: {
          inputTokenPrice: 0.00001, // per token
          outputTokenPrice: 0.00003,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        limits: {
          maxTokensPerRequest: 4096,
          maxRequestsPerMinute: 60,
          maxTokensPerMinute: 150000,
          maxRequestsPerHour: 3500
        }
      };

      expect(modelConfig.name).toBe('gpt-4-turbo');
      expect(modelConfig.provider).toBe('openai');
      expect(modelConfig.parameters.maxTokens).toBe(4096);
      expect(modelConfig.parameters.temperature.default).toBe(0.7);
      expect(modelConfig.capabilities.supportsStreaming).toBe(true);
      expect(modelConfig.capabilities.maxContextLength).toBe(128000);
      expect(modelConfig.pricing.inputTokenPrice).toBe(0.00001);
      expect(modelConfig.limits.maxRequestsPerMinute).toBe(60);
    });
  });
});

describe('Provider 工厂模式', () => {
  describe('提供商工厂接口', () => {
    it('应该支持提供商工厂模式', () => {
      interface ProviderFactory {
        create(config: ProviderConfig): BaseProvider;
        getSupportedTypes(): ProviderType[];
        validateConfig(config: ProviderConfig): ProviderValidationResult;
        getDefaultConfig(type: ProviderType): Partial<ProviderConfig>;
        getAvailableModels(type: ProviderType): string[];
      }

      const factory: ProviderFactory = {
        create: jest.fn(),
        getSupportedTypes: () => ['openai', 'anthropic', 'fastgpt', 'dify'],
        validateConfig: jest.fn(),
        getDefaultConfig: (type: ProviderType) => ({
          type,
          maxTokens: 2048,
          temperature: 0.7
        }),
        getAvailableModels: (type: ProviderType) => {
          switch (type) {
            case 'openai':
              return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'];
            case 'anthropic':
              return ['claude-3-sonnet', 'claude-3-opus'];
            default:
              return [];
          }
        }
      };

      const supportedTypes = factory.getSupportedTypes();
      expect(supportedTypes).toHaveLength(4);
      expect(supportedTypes).toContain('openai');

      const openaiModels = factory.getAvailableModels('openai');
      expect(openaiModels).toContain('gpt-4');

      const defaultConfig = factory.getDefaultConfig('openai');
      expect(defaultConfig.type).toBe('openai');
      expect(defaultConfig.maxTokens).toBe(2048);
    });
  });
});

describe('提供商集成测试', () => {
  describe('端到端流程', () => {
    it('应该支持完整的请求-响应流程', () => {
      const config: ProviderConfig = {
        type: 'openai',
        name: 'Test Provider',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.7
      };

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello!' }],
        model: 'gpt-3.5-turbo',
        maxTokens: 100,
        stream: false
      };

      const response: ChatResponse = {
        id: 'test-response',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finishReason: 'stop'
          }
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25
        }
      };

      const metrics: ProviderMetrics = {
        provider: config.type,
        model: config.model,
        timestamp: new Date().toISOString(),
        requestId: 'test-req',
        duration: 1200,
        tokenUsage: response.usage,
        cost: {
          promptCost: 0.00001,
          completionCost: 0.000015,
          totalCost: 0.000025,
          currency: 'USD'
        },
        status: 'success',
        errors: []
      };

      expect(config.model).toBe(request.model);
      expect(response.model).toBe(config.model);
      expect(metrics.provider).toBe(config.type);
      expect(metrics.tokenUsage.totalTokens).toBe(response.usage.totalTokens);
    });
  });
});