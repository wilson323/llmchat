/**
 * Type Converter 工具测试
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  MessageConverter,
  TypeSafeConverter,
  DynamicConverter,
  DateConverter,
  AgentConverter,
  SessionConverter
} from '../../src/utils/converters.js';
import type {
  StandardMessage,
  SimpleMessage,
  Agent,
  AgentConfig,
  ChatSession,
  JsonValue
} from '../../src/index.js';

describe('MessageConverter', () => {
  const standardMessages: StandardMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, AI!',
      timestamp: Date.now() - 2000,
      metadata: { agentId: 'agent-1', sessionId: 'session-1' }
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      timestamp: Date.now() - 1000,
      metadata: {
        agentId: 'agent-1',
        sessionId: 'session-1',
        responseChatItemId: 'response-123'
      }
    },
    {
      id: 'msg-3',
      role: 'user',
      content: 'What is the weather today?',
      timestamp: Date.now(),
      metadata: { agentId: 'agent-1', sessionId: 'session-1' }
    }
  ];

  describe('toSimple', () => {
    it('应该正确转换标准消息为简化格式', () => {
      const simpleMessages = MessageConverter.toSimple(standardMessages);

      expect(simpleMessages).toHaveLength(2);
      expect(simpleMessages[0]).toEqual({
        HUMAN: 'Hello, AI!',
        AI: 'Hello! How can I help you?',
        id: 'response-123',
        timestamp: expect.any(Number)
      });
      expect(simpleMessages[1]).toEqual({
        HUMAN: 'What is the weather today?',
        timestamp: expect.any(Number)
      });
    });

    it('应该正确处理只有用户输入的消息', () => {
      const onlyUserMessages: StandardMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now()
        }
      ];

      const simpleMessages = MessageConverter.toSimple(onlyUserMessages);

      expect(simpleMessages).toHaveLength(1);
      expect(simpleMessages[0]).toEqual({
        HUMAN: 'Hello',
        timestamp: expect.any(Number)
      });
    });

    it('应该正确处理只有AI回复的消息', () => {
      const onlyAIMessages: StandardMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello!',
          timestamp: Date.now(),
          metadata: { responseChatItemId: 'response-123' }
        }
      ];

      const simpleMessages = MessageConverter.toSimple(onlyAIMessages);

      expect(simpleMessages).toHaveLength(1);
      expect(simpleMessages[0]).toEqual({
        AI: 'Hello!',
        id: 'response-123',
        timestamp: expect.any(Number)
      });
    });

    it('应该正确处理空消息数组', () => {
      const simpleMessages = MessageConverter.toSimple([]);
      expect(simpleMessages).toEqual([]);
    });

    it('应该正确处理连续的用户消息', () => {
      const consecutiveUserMessages: StandardMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          timestamp: Date.now() - 2000
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'Second message',
          timestamp: Date.now() - 1000
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: 'AI response',
          timestamp: Date.now(),
          metadata: { responseChatItemId: 'response-123' }
        }
      ];

      const simpleMessages = MessageConverter.toSimple(consecutiveUserMessages);

      expect(simpleMessages).toHaveLength(2);
      expect(simpleMessages[0]).toEqual({
        HUMAN: 'First message',
        AI: 'AI response',
        id: 'response-123',
        timestamp: expect.any(Number)
      });
      expect(simpleMessages[1]).toEqual({
        HUMAN: 'Second message',
        timestamp: expect.any(Number)
      });
    });

    it('应该正确处理多个AI回复', () => {
      const multipleAIMessages: StandardMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: Date.now() - 3000
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'First AI response',
          timestamp: Date.now() - 2000,
          metadata: { responseChatItemId: 'response-1' }
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: 'Second AI response',
          timestamp: Date.now() - 1000,
          metadata: { responseChatItemId: 'response-2' }
        }
      ];

      const simpleMessages = MessageConverter.toSimple(multipleAIMessages);

      expect(simpleMessages).toHaveLength(1);
      expect(simpleMessages[0].AI).toBe('First AI response');
      expect(simpleMessages[0].id).toBe('response-1');
    });
  });

  describe('toStandard', () => {
    const agentId = 'agent-123';
    const sessionId = 'session-123';

    it('应该正确转换简化消息为标准格式', () => {
      const simpleMessages: SimpleMessage[] = [
        {
          HUMAN: 'Hello, AI!',
          AI: 'Hello! How can I help you?',
          id: 'response-123',
          timestamp: Date.now() - 1000
        },
        {
          HUMAN: 'What is the weather today?',
          timestamp: Date.now()
        }
      ];

      const standardMessages = MessageConverter.toStandard(simpleMessages, agentId, sessionId);

      expect(standardMessages).toHaveLength(3);

      // 第一对消息
      expect(standardMessages[0]).toEqual({
        id: expect.stringMatching(/session-123-0-user/),
        role: 'user',
        content: 'Hello, AI!',
        timestamp: expect.any(Number),
        metadata: { agentId, sessionId }
      });

      expect(standardMessages[1]).toEqual({
        id: 'response-123',
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: expect.any(Number),
        metadata: { agentId, sessionId }
      });

      // 第二对消息
      expect(standardMessages[2]).toEqual({
        id: expect.stringMatching(/session-123-2-user/),
        role: 'user',
        content: 'What is the weather today?',
        timestamp: expect.any(Number),
        metadata: { agentId, sessionId }
      });
    });

    it('应该正确处理只有AI内容的消息', () => {
      const simpleMessages: SimpleMessage[] = [
        {
          AI: 'Welcome!',
          id: 'response-123'
        }
      ];

      const standardMessages = MessageConverter.toStandard(simpleMessages, agentId, sessionId);

      expect(standardMessages).toHaveLength(1);
      expect(standardMessages[0]).toEqual({
        id: 'response-123',
        role: 'assistant',
        content: 'Welcome!',
        timestamp: expect.any(Number),
        metadata: { agentId, sessionId }
      });
    });

    it('应该正确处理只有人类内容的消息', () => {
      const simpleMessages: SimpleMessage[] = [
        {
          HUMAN: 'Hello!'
        }
      ];

      const standardMessages = MessageConverter.toStandard(simpleMessages, agentId, sessionId);

      expect(standardMessages).toHaveLength(1);
      expect(standardMessages[0]).toEqual({
        id: expect.stringMatching(/session-123-0-user/),
        role: 'user',
        content: 'Hello!',
        timestamp: expect.any(Number),
        metadata: { agentId, sessionId }
      });
    });

    it('应该正确处理空消息数组', () => {
      const standardMessages = MessageConverter.toStandard([], agentId, sessionId);
      expect(standardMessages).toEqual([]);
    });

    it('应该正确处理没有时间戳的消息', () => {
      const simpleMessages: SimpleMessage[] = [
        {
          HUMAN: 'Hello',
          AI: 'Hi there!'
        }
      ];

      const standardMessages = MessageConverter.toStandard(simpleMessages, agentId, sessionId);

      expect(standardMessages).toHaveLength(2);
      expect(standardMessages[0].timestamp).toBeGreaterThan(0);
      expect(standardMessages[1].timestamp).toBeGreaterThan(0);
    });
  });

  describe('双向转换测试', () => {
    it('应该能够进行双向转换而不丢失数据', () => {
      const originalSimple: SimpleMessage[] = [
        {
          HUMAN: 'Question 1',
          AI: 'Answer 1',
          id: 'response-1',
          feedback: 'like',
          timestamp: Date.now() - 2000
        },
        {
          HUMAN: 'Question 2',
          timestamp: Date.now() - 1000
        }
      ];

      const standard = MessageConverter.toStandard(originalSimple, agentId, sessionId);
      const convertedBack = MessageConverter.toSimple(standard);

      // 注意：双向转换可能会丢失一些信息（如feedback），这是预期的行为
      expect(convertedBack).toHaveLength(2);
      expect(convertedBack[0].HUMAN).toBe('Question 1');
      expect(convertedBack[0].AI).toBe('Answer 1');
      expect(convertedBack[0].id).toBe('response-1');
      expect(convertedBack[1].HUMAN).toBe('Question 2');
    });
  });
});

describe('TypeSafeConverter', () => {
  describe('toAgent', () => {
    const validAgent: Agent = {
      id: 'agent-123',
      name: 'Test Agent',
      description: 'A test agent',
      model: 'gpt-3.5-turbo',
      status: 'active',
      capabilities: ['text-generation'],
      provider: 'openai',
      isActive: true
    };

    it('应该正确转换有效的Agent', () => {
      const result = TypeSafeConverter.toAgent(validAgent);
      expect(result).toEqual(validAgent);
    });

    it('应该拒绝无效的Agent', () => {
      const invalidAgent = { id: 'agent-123' };
      const result = TypeSafeConverter.toAgent(invalidAgent);
      expect(result).toBeNull();
    });

    it('应该处理null和undefined', () => {
      expect(TypeSafeConverter.toAgent(null)).toBeNull();
      expect(TypeSafeConverter.toAgent(undefined)).toBeNull();
    });
  });

  describe('toStandardMessage', () => {
    const validMessage: StandardMessage = {
      id: 'msg-123',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now()
    };

    it('应该正确转换有效的标准消息', () => {
      const result = TypeSafeConverter.toStandardMessage(validMessage);
      expect(result).toEqual(validMessage);
    });

    it('应该拒绝无效的消息', () => {
      const invalidMessage = { id: 'msg-123' };
      const result = TypeSafeConverter.toStandardMessage(invalidMessage);
      expect(result).toBeNull();
    });
  });

  describe('toJsonValue', () => {
    it('应该正确转换JSON兼容值', () => {
      expect(TypeSafeConverter.toJsonValue('string')).toBe('string');
      expect(TypeSafeConverter.toJsonValue(123)).toBe(123);
      expect(TypeSafeConverter.toJsonValue(true)).toBe(true);
      expect(TypeSafeConverter.toJsonValue(null)).toBe(null);
      expect(TypeSafeConverter.toJsonValue({})).toEqual({});
      expect(TypeSafeConverter.toJsonValue([])).toEqual([]);
    });

    it('应该转换非JSON值为字符串', () => {
      expect(TypeSafeConverter.toJsonValue(undefined)).toBeNull();
      expect(TypeSafeConverter.toJsonValue(() => {})).toBe('() => {}');
      expect(TypeSafeConverter.toJsonValue(Symbol('test'))).toBe('Symbol(test)');
      expect(TypeSafeConverter.toJsonValue(BigInt(123))).toBe('123');
    });

    it('应该使用默认值', () => {
      expect(TypeSafeConverter.toJsonValue(undefined, 'default')).toBe('default');
      expect(TypeSafeConverter.toJsonValue(() => {}, 'default')).toBe('default');
    });
  });
});

describe('DynamicConverter', () => {
  describe('toSafeJson', () => {
    it('应该正确处理基本类型', () => {
      expect(DynamicConverter.toSafeJson('string')).toBe('string');
      expect(DynamicConverter.toSafeJson(123)).toBe(123);
      expect(DynamicConverter.toSafeJson(true)).toBe(true);
      expect(DynamicConverter.toSafeJson(null)).toBeNull();
    });

    it('应该正确处理数组', () => {
      const arr = [1, 'string', true, null, { nested: 'value' }];
      const result = DynamicConverter.toSafeJson(arr);
      expect(result).toEqual(arr);
    });

    it('应该正确处理嵌套对象', () => {
      const obj = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: {
          deep: 'value'
        }
      };
      const result = DynamicConverter.toSafeJson(obj);
      expect(result).toEqual(obj);
    });

    it('应该转换非JSON值为字符串', () => {
      const obj = {
        func: () => 'test',
        symbol: Symbol('test'),
        bigint: BigInt(123),
        date: new Date('2023-01-01')
      };
      const result = DynamicConverter.toSafeJson(obj);

      expect(typeof result.func).toBe('string');
      expect(typeof result.symbol).toBe('string');
      expect(typeof result.bigint).toBe('string');
      expect(typeof result.date).toBe('string');
    });

    it('应该处理null和undefined', () => {
      expect(DynamicConverter.toSafeJson(null)).toBeNull();
      expect(DynamicConverter.toSafeJson(undefined)).toBeNull();
    });
  });

  describe('cloneSafe', () => {
    it('应该创建深拷贝', () => {
      const original = {
        value: 42,
        nested: {
          array: [1, 2, 3]
        }
      };

      const cloned = DynamicConverter.cloneSafe(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.nested.array).not.toBe(original.nested.array);
    });

    it('应该处理循环引用', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      // 应该抛出错误或返回null
      expect(() => {
        DynamicConverter.cloneSafe(obj);
      }).toThrow();
    });
  });
});

describe('DateConverter', () => {
  describe('toISOString', () => {
    it('应该正确转换Date为ISO字符串', () => {
      const date = new Date('2023-01-01T12:00:00.000Z');
      const result = DateConverter.toISOString(date);
      expect(result).toBe('2023-01-01T12:00:00.000Z');
    });

    it('应该处理时间戳', () => {
      const timestamp = Date.now();
      const result = DateConverter.toISOString(timestamp);
      expect(typeof result).toBe('string');
      expect(new Date(result).getTime()).toBe(timestamp);
    });

    it('应该处理ISO字符串', () => {
      const isoString = '2023-01-01T12:00:00.000Z';
      const result = DateConverter.toISOString(isoString);
      expect(result).toBe(isoString);
    });

    it('应该处理无效输入', () => {
      expect(DateConverter.toISOString(null)).toBe('');
      expect(DateConverter.toISOString(undefined)).toBe('');
      expect(DateConverter.toISOString('invalid')).toBe('');
    });
  });

  describe('fromString', () => {
    it('应该正确解析ISO字符串', () => {
      const isoString = '2023-01-01T12:00:00.000Z';
      const result = DateConverter.fromString(isoString);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(isoString);
    });

    it('应该处理无效字符串', () => {
      expect(DateConverter.fromString('invalid')).toBeNull();
      expect(DateConverter.fromString('')).toBeNull();
      expect(DateConverter.fromString(null as any)).toBeNull();
      expect(DateConverter.fromString(undefined as any)).toBeNull();
    });
  });

  describe('isValid', () => {
    it('应该识别有效日期', () => {
      expect(DateConverter.isValid(new Date())).toBe(true);
      expect(DateConverter.isValid(new Date('2023-01-01'))).toBe(true);
    });

    it('应该拒绝无效日期', () => {
      expect(DateConverter.isValid(new Date('invalid'))).toBe(false);
      expect(DateConverter.isValid(null as any)).toBe(false);
      expect(DateConverter.isValid(undefined as any)).toBe(false);
      expect(DateConverter.isValid('2023-01-01' as any)).toBe(false);
    });
  });
});

describe('AgentConverter', () => {
  describe('fromConfig', () => {
    const agentConfig: AgentConfig = {
      id: 'agent-123',
      name: 'Test Agent',
      description: 'A test agent',
      avatar: 'https://example.com/avatar.png',
      model: 'gpt-3.5-turbo',
      status: 'active',
      capabilities: ['text-generation'],
      provider: 'openai',
      isActive: true,
      workspaceType: 'chat',
      endpoint: 'https://api.openai.com/v1/chat',
      apiKey: 'sk-test-key',
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

    it('应该正确从配置转换为Agent', () => {
      const agent = AgentConverter.fromConfig(agentConfig);

      expect(agent).toEqual({
        id: 'agent-123',
        name: 'Test Agent',
        description: 'A test agent',
        avatar: 'https://example.com/avatar.png',
        model: 'gpt-3.5-turbo',
        status: 'active',
        capabilities: ['text-generation'],
        provider: 'openai',
        isActive: true,
        workspaceType: 'chat'
      });
    });

    it('应该处理null和undefined', () => {
      expect(AgentConverter.fromConfig(null as any)).toBeNull();
      expect(AgentConverter.fromConfig(undefined as any)).toBeNull();
    });
  });

  describe('toConfig', () => {
    const agent: Agent = {
      id: 'agent-123',
      name: 'Test Agent',
      description: 'A test agent',
      model: 'gpt-3.5-turbo',
      status: 'active',
      capabilities: ['text-generation'],
      provider: 'openai',
      isActive: true
    };

    it('应该正确从Agent转换为配置', () => {
      const config = AgentConverter.toConfig(agent, 'sk-test-key', 'https://api.openai.com/v1/chat');

      expect(config).toEqual({
        id: 'agent-123',
        name: 'Test Agent',
        description: 'A test agent',
        model: 'gpt-3.5-turbo',
        status: 'active',
        capabilities: ['text-generation'],
        provider: 'openai',
        isActive: true,
        endpoint: 'https://api.openai.com/v1/chat',
        apiKey: 'sk-test-key',
        maxTokens: undefined,
        temperature: undefined,
        features: undefined,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('应该处理null和undefined', () => {
      expect(AgentConverter.toConfig(null as any, 'key', 'endpoint')).toBeNull();
      expect(AgentConverter.toConfig(undefined as any, 'key', 'endpoint')).toBeNull();
    });
  });
});

describe('SessionConverter', () => {
  describe('fromStorage', () => {
    it('应该正确从存储格式转换', () => {
      const storageFormat = {
        id: 'session-123',
        title: 'Test Session',
        agentId: 'agent-123',
        messages: [
          { role: 'user', content: 'Hello', timestamp: Date.now() },
          { role: 'assistant', content: 'Hi!', timestamp: Date.now() }
        ],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      const session = SessionConverter.fromStorage(storageFormat);

      expect(session).toEqual({
        id: 'session-123',
        title: 'Test Session',
        agentId: 'agent-123',
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            role: 'user',
            content: 'Hello',
            timestamp: expect.any(Number),
            metadata: expect.any(Object)
          }),
          expect.objectContaining({
            id: expect.any(String),
            role: 'assistant',
            content: 'Hi!',
            timestamp: expect.any(Number),
            metadata: expect.any(Object)
          })
        ]),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('应该处理null和undefined', () => {
      expect(SessionConverter.fromStorage(null as any)).toBeNull();
      expect(SessionConverter.fromStorage(undefined as any)).toBeNull();
    });
  });

  describe('toStorage', () => {
    it('应该正确转换为存储格式', () => {
      const session: ChatSession = {
        id: 'session-123',
        title: 'Test Session',
        agentId: 'agent-123',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: Date.now(),
            metadata: { agentId: 'agent-123', sessionId: 'session-123' }
          }
        ],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      };

      const storageFormat = SessionConverter.toStorage(session);

      expect(storageFormat).toEqual({
        id: 'session-123',
        title: 'Test Session',
        agentId: 'agent-123',
        messages: [
          {
            role: 'user',
            content: 'Hello',
            timestamp: expect.any(Number)
          }
        ],
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      });
    });

    it('应该处理null和undefined', () => {
      expect(SessionConverter.toStorage(null as any)).toBeNull();
      expect(SessionConverter.toStorage(undefined as any)).toBeNull();
    });
  });
});

describe('边界情况和错误处理', () => {
  describe('数据完整性测试', () => {
    it('应该处理空对象和空数组', () => {
      expect(TypeSafeConverter.toAgent({})).toBeNull();
      expect(TypeSafeConverter.toStandardMessage({})).toBeNull();
      expect(MessageConverter.toSimple([])).toEqual([]);
      expect(MessageConverter.toStandard([], 'agent-1', 'session-1')).toEqual([]);
    });

    it('应该处理部分数据', () => {
      const partialMessage = {
        id: 'msg-123',
        role: 'user'
        // 缺少content和timestamp
      };

      expect(TypeSafeConverter.toStandardMessage(partialMessage as any)).toBeNull();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量消息', () => {
      const largeMessageArray: StandardMessage[] = Array(1000).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: Date.now() - (1000 - i) * 1000
      }));

      const startTime = performance.now();
      const result = MessageConverter.toSimple(largeMessageArray);
      const endTime = performance.now();

      expect(result).toHaveLength(500);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('类型安全测试', () => {
    it('应该防止类型注入攻击', () => {
      const maliciousObject = {
        id: 'msg-123',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
        __proto__: { polluted: true }
      };

      const result = TypeSafeConverter.toStandardMessage(maliciousObject as any);

      if (result) {
        expect((result as any).polluted).toBeUndefined();
      }
    });
  });
});