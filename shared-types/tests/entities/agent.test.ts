/**
 * Agent 实体类型测试
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type {
  Agent,
  AgentConfig,
  AgentStatus,
  AgentCapability,
  ProviderType,
  WorkspaceType,
  AgentFeatures,
  AgentMetadata
} from '../../src/entities/agent.js';

describe('Agent 基础类型', () => {
  const validAgent: Agent = {
    id: 'agent-123',
    name: 'Test Agent',
    description: 'A test agent for validation',
    model: 'gpt-3.5-turbo',
    status: 'active',
    capabilities: ['text-generation'],
    provider: 'openai',
    isActive: true
  };

  describe('Agent 接口验证', () => {
    it('应该接受有效的Agent对象', () => {
      const agent: Agent = validAgent;
      expect(agent.id).toBe('agent-123');
      expect(agent.name).toBe('Test Agent');
      expect(agent.description).toBe('A test agent for validation');
      expect(agent.model).toBe('gpt-3.5-turbo');
      expect(agent.status).toBe('active');
      expect(agent.capabilities).toEqual(['text-generation']);
      expect(agent.provider).toBe('openai');
      expect(agent.isActive).toBe(true);
    });

    it('应该接受可选字段', () => {
      const agentWithOptionals: Agent = {
        ...validAgent,
        avatar: 'https://example.com/avatar.png',
        workspaceType: 'chat'
      };

      expect(agentWithOptionals.avatar).toBe('https://example.com/avatar.png');
      expect(agentWithOptionals.workspaceType).toBe('chat');
    });

    it('应该支持所有Agent状态', () => {
      const statuses: AgentStatus[] = ['active', 'inactive', 'error', 'loading'];

      statuses.forEach(status => {
        const agent: Agent = { ...validAgent, status };
        expect(agent.status).toBe(status);
      });
    });

    it('应该支持所有提供商类型', () => {
      const providers: ProviderType[] = ['openai', 'anthropic', 'fastgpt', 'dify', 'custom'];

      providers.forEach(provider => {
        const agent: Agent = { ...validAgent, provider };
        expect(agent.provider).toBe(provider);
      });
    });

    it('应该支持所有工作区类型', () => {
      const workspaceTypes: WorkspaceType[] = ['chat', 'code', 'analysis', 'creative'];

      workspaceTypes.forEach(workspaceType => {
        const agent: Agent = { ...validAgent, workspaceType };
        expect(agent.workspaceType).toBe(workspaceType);
      });
    });
  });

  describe('AgentConfig 接口验证', () => {
    const validAgentConfig: AgentConfig = {
      ...validAgent,
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'sk-test-key-123456789',
      maxTokens: 2048,
      temperature: 0.7,
      features: {
        supportsStream: true,
        supportsFiles: false,
        supportsImages: false,
        maxFileSize: 10485760,
        supportedFileTypes: ['.txt', '.pdf']
      },
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };

    it('应该接受有效的AgentConfig对象', () => {
      const config: AgentConfig = validAgentConfig;

      expect(config.endpoint).toBe('https://api.openai.com/v1/chat/completions');
      expect(config.apiKey).toBe('sk-test-key-123456789');
      expect(config.maxTokens).toBe(2048);
      expect(config.temperature).toBe(0.7);
      expect(config.features.supportsStream).toBe(true);
      expect(config.features.supportsFiles).toBe(false);
      expect(config.features.supportsImages).toBe(false);
      expect(config.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(config.updatedAt).toBe('2023-01-01T00:00:00.000Z');
    });

    it('应该支持可选的配置字段', () => {
      const minimalConfig: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-minimal-key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(minimalConfig.maxTokens).toBeUndefined();
      expect(minimalConfig.temperature).toBeUndefined();
      expect(minimalConfig.features).toBeUndefined();
    });

    it('应该支持复杂的AgentFeatures配置', () => {
      const fullFeatures: AgentFeatures = {
        supportsStream: true,
        supportsFiles: true,
        supportsImages: true,
        supportsVoice: false,
        supportsVideo: false,
        maxFileSize: 52428800, // 50MB
        supportedFileTypes: ['.txt', '.pdf', '.docx', '.png', '.jpg'],
        maxTokens: 4096,
        temperatureRange: { min: 0.1, max: 2.0 },
        customParameters: {
          topP: 0.9,
          frequencyPenalty: 0.1,
          presencePenalty: 0.1
        }
      };

      const config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-full-features-key',
        features: fullFeatures,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(config.features?.supportsFiles).toBe(true);
      expect(config.features?.maxFileSize).toBe(52428800);
      expect(config.features?.supportedFileTypes).toHaveLength(5);
      expect(config.features?.temperatureRange?.min).toBe(0.1);
      expect(config.features?.customParameters?.topP).toBe(0.9);
    });
  });
});

describe('Agent 类型操作', () => {
  describe('Agent 创建和验证', () => {
    it('应该能够创建新的Agent', () => {
      const newAgent: Agent = {
        id: generateId(),
        name: 'New Assistant',
        description: 'A newly created assistant',
        model: 'gpt-4',
        status: 'inactive',
        capabilities: ['text-generation', 'code-generation'],
        provider: 'openai',
        isActive: false
      };

      expect(newAgent.id).toMatch(/^[a-zA-Z0-9-_]+$/);
      expect(newAgent.capabilities).toContain('code-generation');
      expect(newAgent.isActive).toBe(false);
    });

    it('应该能够更新Agent状态', () => {
      let agent: Agent = {
        ...validAgent,
        status: 'inactive',
        isActive: false
      };

      // 激活Agent
      agent = { ...agent, status: 'active', isActive: true };
      expect(agent.status).toBe('active');
      expect(agent.isActive).toBe(true);

      // 设置为错误状态
      agent = { ...agent, status: 'error', isActive: false };
      expect(agent.status).toBe('error');
      expect(agent.isActive).toBe(false);
    });

    it('应该能够添加和移除能力', () => {
      let agent: Agent = {
        ...validAgent,
        capabilities: ['text-generation']
      };

      // 添加新能力
      agent = { ...agent, capabilities: [...agent.capabilities, 'code-generation'] };
      expect(agent.capabilities).toHaveLength(2);
      expect(agent.capabilities).toContain('code-generation');

      // 移除能力
      agent = { ...agent, capabilities: agent.capabilities.filter(cap => cap !== 'text-generation') };
      expect(agent.capabilities).toHaveLength(1);
      expect(agent.capabilities).not.toContain('text-generation');
    });
  });

  describe('AgentConfig 配置管理', () => {
    it('应该能够创建最小配置', () => {
      const minimalConfig: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.minimal.com/v1/chat',
        apiKey: 'sk-minimal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(minimalConfig.endpoint).toBeTruthy();
      expect(minimalConfig.apiKey).toBeTruthy();
      expect(minimalConfig.createdAt).toBeTruthy();
      expect(minimalConfig.updatedAt).toBeTruthy();
    });

    it('应该能够更新配置参数', () => {
      let config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-config-test',
        maxTokens: 1024,
        temperature: 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 更新参数
      config = {
        ...config,
        maxTokens: 2048,
        temperature: 0.8,
        updatedAt: new Date().toISOString()
      };

      expect(config.maxTokens).toBe(2048);
      expect(config.temperature).toBe(0.8);
      expect(config.updatedAt).not.toBe(config.createdAt);
    });

    it('应该能够添加功能特性', () => {
      let config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-features-test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 添加基本功能
      config = {
        ...config,
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: false
        },
        updatedAt: new Date().toISOString()
      };

      expect(config.features?.supportsStream).toBe(true);

      // 添加文件支持
      config = {
        ...config,
        features: {
          ...config.features!,
          supportsFiles: true,
          maxFileSize: 10485760,
          supportedFileTypes: ['.txt', '.pdf']
        },
        updatedAt: new Date().toISOString()
      };

      expect(config.features?.supportsFiles).toBe(true);
      expect(config.features?.maxFileSize).toBe(10485760);
      expect(config.features?.supportedFileTypes).toHaveLength(2);
    });
  });
});

describe('Agent 类型约束', () => {
  describe('ID 格式验证', () => {
    it('应该支持各种ID格式', () => {
      const validIds = [
        'agent-123',
        'agent_456',
        'agent-abc-123',
        '123-456-789',
        'custom-agent-name'
      ];

      validIds.forEach(id => {
        const agent: Agent = { ...validAgent, id };
        expect(agent.id).toBe(id);
      });
    });
  });

  describe('Capability 验证', () => {
    it('应该支持标准能力类型', () => {
      const standardCapabilities: AgentCapability[] = [
        'text-generation',
        'code-generation',
        'image-generation',
        'voice-input',
        'voice-output',
        'file-processing',
        'web-search',
        'data-analysis'
      ];

      standardCapabilities.forEach(capability => {
        const agent: Agent = { ...validAgent, capabilities: [capability] };
        expect(agent.capabilities).toContain(capability);
      });
    });

    it('应该支持多个能力', () => {
      const multiCapabilityAgent: Agent = {
        ...validAgent,
        capabilities: [
          'text-generation',
          'code-generation',
          'file-processing',
          'web-search'
        ]
      };

      expect(multiCapabilityAgent.capabilities).toHaveLength(4);
      expect(multiCapabilityAgent.capabilities).toContain('text-generation');
      expect(multiCapabilityAgent.capabilities).toContain('code-generation');
    });
  });

  describe('Provider 特定验证', () => {
    it('应该支持OpenAI提供商的特定字段', () => {
      const openaiConfig: AgentConfig = {
        ...validAgent,
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-openai-key',
        model: 'gpt-4',
        maxTokens: 4096,
        temperature: 0.7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(openaiConfig.provider).toBe('openai');
      expect(openaiConfig.endpoint).toContain('openai.com');
      expect(openaiConfig.model).toContain('gpt');
    });

    it('应该支持Anthropic提供商的特定字段', () => {
      const anthropicConfig: AgentConfig = {
        ...validAgent,
        provider: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: 'sk-ant-key',
        model: 'claude-3-sonnet-20240229',
        maxTokens: 4096,
        temperature: 0.8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(anthropicConfig.provider).toBe('anthropic');
      expect(anthropicConfig.endpoint).toContain('anthropic.com');
      expect(anthropicConfig.model).toContain('claude');
    });

    it('应该支持FastGPT提供商的特定字段', () => {
      const fastgptConfig: AgentConfig = {
        ...validAgent,
        provider: 'fastgpt',
        endpoint: 'https://api.fastgpt.com/v1/chat',
        apiKey: 'fg-fastgpt-key',
        model: 'fastgpt-pro',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(fastgptConfig.provider).toBe('fastgpt');
      expect(fastgptConfig.endpoint).toContain('fastgpt.com');
    });
  });
});

describe('Agent 元数据处理', () => {
  describe('AgentMetadata 使用', () => {
    it('应该支持复杂的元数据结构', () => {
      const metadata: AgentMetadata = {
        version: '1.0.0',
        tags: ['productivity', 'coding', 'assistant'],
        category: 'development',
        language: 'en',
        region: 'us',
        performance: {
          avgResponseTime: 1500,
          successRate: 0.98,
          totalRequests: 10000
        },
        customSettings: {
          preferredTone: 'professional',
          responseLength: 'medium',
          codeStyle: 'modern'
        }
      };

      // 在实际应用中，这些元数据可能会附加到Agent对象上
      // 这里我们验证元数据结构的正确性
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.tags).toHaveLength(3);
      expect(metadata.performance.avgResponseTime).toBe(1500);
      expect(metadata.customSettings.preferredTone).toBe('professional');
    });
  });

  describe('时间戳处理', () => {
    it('应该支持ISO 8601时间格式', () => {
      const now = new Date();
      const isoString = now.toISOString();

      const config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-timestamp-test',
        createdAt: isoString,
        updatedAt: isoString
      };

      expect(config.createdAt).toBe(isoString);
      expect(config.updatedAt).toBe(isoString);

      // 验证时间戳可以被解析
      const createdDate = new Date(config.createdAt);
      expect(createdDate.toISOString()).toBe(isoString);
    });

    it('应该支持时间戳更新', () => {
      const createdTime = '2023-01-01T00:00:00.000Z';
      const updatedTime = '2023-01-02T12:30:45.000Z';

      let config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-timestamp-update',
        createdAt: createdTime,
        updatedAt: createdTime
      };

      // 更新时间戳
      config = { ...config, updatedAt: updatedTime };

      expect(config.createdAt).toBe(createdTime);
      expect(config.updatedAt).toBe(updatedTime);
      expect(config.updatedAt > config.createdAt).toBe(true);
    });
  });
});

describe('Agent 类型转换', () => {
  describe('Agent 到 AgentConfig 转换', () => {
    it('应该能够从Agent创建AgentConfig', () => {
      const config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-conversion-test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 验证基础字段保持不变
      expect(config.id).toBe(validAgent.id);
      expect(config.name).toBe(validAgent.name);
      expect(config.description).toBe(validAgent.description);
      expect(config.model).toBe(validAgent.model);
      expect(config.status).toBe(validAgent.status);
      expect(config.capabilities).toEqual(validAgent.capabilities);
      expect(config.provider).toBe(validAgent.provider);
      expect(config.isActive).toBe(validAgent.isActive);

      // 验证新增的配置字段
      expect(config.endpoint).toBeTruthy();
      expect(config.apiKey).toBeTruthy();
      expect(config.createdAt).toBeTruthy();
      expect(config.updatedAt).toBeTruthy();
    });
  });

  describe('配置序列化和反序列化', () => {
    it('应该能够序列化AgentConfig', () => {
      const config: AgentConfig = {
        ...validAgent,
        endpoint: 'https://api.example.com/v1/chat',
        apiKey: 'sk-serialization-test',
        maxTokens: 2048,
        temperature: 0.7,
        features: {
          supportsStream: true,
          supportsFiles: false,
          supportsImages: false
        },
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      // 序列化为JSON
      const serialized = JSON.stringify(config);
      expect(serialized).toBeTruthy();

      // 反序列化
      const deserialized = JSON.parse(serialized) as AgentConfig;
      expect(deserialized.id).toBe(config.id);
      expect(deserialized.name).toBe(config.name);
      expect(deserialized.endpoint).toBe(config.endpoint);
      expect(deserialized.features?.supportsStream).toBe(true);
    });
  });
});

// 辅助函数：生成唯一ID
function generateId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

describe('Agent 边界情况测试', () => {
  describe('极值处理', () => {
    it('应该处理极长名称', () => {
      const longName = 'A'.repeat(1000);
      const agent: Agent = {
        ...validAgent,
        name: longName
      };
      expect(agent.name).toHaveLength(1000);
    });

    it('应该处理极长描述', () => {
      const longDescription = 'B'.repeat(10000);
      const agent: Agent = {
        ...validAgent,
        description: longDescription
      };
      expect(agent.description).toHaveLength(10000);
    });

    it('应该处理空字符串', () => {
      const agentWithEmptyStrings: Agent = {
        ...validAgent,
        name: '',
        description: '',
        model: ''
      };
      expect(agentWithEmptyStrings.name).toBe('');
      expect(agentWithEmptyStrings.description).toBe('');
      expect(agentWithEmptyStrings.model).toBe('');
    });
  });

  describe('能力数组边界情况', () => {
    it('应该处理空能力数组', () => {
      const agentWithNoCapabilities: Agent = {
        ...validAgent,
        capabilities: []
      };
      expect(agentWithNoCapabilities.capabilities).toHaveLength(0);
    });

    it('应该处理大量能力', () => {
      const manyCapabilities = Array(100).fill(null).map((_, i) => `capability-${i}`);
      const agentWithManyCapabilities: Agent = {
        ...validAgent,
        capabilities: manyCapabilities
      };
      expect(agentWithManyCapabilities.capabilities).toHaveLength(100);
    });

    it('应该处理重复能力', () => {
      const agentWithDuplicateCapabilities: Agent = {
        ...validAgent,
        capabilities: ['text-generation', 'text-generation', 'code-generation']
      };
      expect(agentWithDuplicateCapabilities.capabilities).toHaveLength(3);
    });
  });
});