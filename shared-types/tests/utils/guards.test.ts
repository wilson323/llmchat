/**
 * Type Guard 工具测试
 *
 * @version 2.0.0
 * @author LLMChat Team
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isDate,
  isFunction,
  isJsonValue,
  isUnknownValue,
  isObject as isObjectGuard,
  JsonValue,
  UnknownValue
} from '../../src/utils/guards.js';
import {
  isAgent,
  isAgentConfig,
  isStandardMessage,
  isSimpleMessage,
  isChatSession,
  isUser,
  isAgentStatus,
  isProviderType,
  isMessageRole,
  isUserRole,
  isUserStatus,
  isAuthProvider
} from '../../src/utils/guards.js';

describe('基础类型守卫', () => {
  describe('isString', () => {
    it('应该识别字符串', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString(String('test'))).toBe(true);
    });

    it('应该拒绝非字符串', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('应该识别数字', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
      expect(isNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    it('应该拒绝NaN和非数字', () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber(Infinity)).toBe(false);
      expect(isNumber(-Infinity)).toBe(false);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('应该识别布尔值', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(Boolean(1))).toBe(true);
    });

    it('应该拒绝非布尔值', () => {
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean(0)).toBe(false);
      expect(isBoolean('true')).toBe(false);
      expect(isBoolean(null)).toBe(false);
      expect(isBoolean(undefined)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('应该识别对象', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: 'value' })).toBe(true);
      expect(isObject(Object.create(null))).toBe(true);
    });

    it('应该拒绝非对象', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('应该识别数组', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(['a', 'b', 'c'])).toBe(true);
      expect(isArray(Array(5))).toBe(true);
    });

    it('应该拒绝非数组', () => {
      expect(isArray({})).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray(123)).toBe(false);
    });
  });

  describe('isDate', () => {
    it('应该识别有效日期', () => {
      const validDate = new Date('2023-01-01');
      expect(isDate(validDate)).toBe(true);
      expect(isDate(new Date())).toBe(true);
      expect(isDate(new Date(Date.now()))).toBe(true);
    });

    it('应该拒绝无效日期', () => {
      expect(isDate(new Date('invalid'))).toBe(false);
      expect(isDate(Date.now())).toBe(false);
      expect(isDate('2023-01-01')).toBe(false);
      expect(isDate(null)).toBe(false);
      expect(isDate(undefined)).toBe(false);
    });
  });

  describe('isFunction', () => {
    it('应该识别函数', () => {
      expect(isFunction(function() {})).toBe(true);
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(async function() {})).toBe(true);
      expect(isFunction(function*() {})).toBe(true);
      expect(isFunction(Date)).toBe(true);
    });

    it('应该拒绝非函数', () => {
      expect(isFunction({})).toBe(false);
      expect(isFunction(null)).toBe(false);
      expect(isFunction(undefined)).toBe(false);
      expect(isFunction('function')).toBe(false);
    });
  });
});

describe('JSON类型守卫', () => {
  describe('isJsonValue', () => {
    it('应该识别有效的JSON值', () => {
      // 基本类型
      expect(isJsonValue('string')).toBe(true);
      expect(isJsonValue(123)).toBe(true);
      expect(isJsonValue(true)).toBe(true);
      expect(isJsonValue(null)).toBe(true);

      // 数组
      expect(isJsonValue([])).toBe(true);
      expect(isJsonValue([1, 'string', true, null])).toBe(true);
      expect(isJsonValue([[[]]])).toBe(true);

      // 对象
      expect(isJsonValue({})).toBe(true);
      expect(isJsonValue({ key: 'value' })).toBe(true);
      expect(isJsonValue({ nested: { array: [] } })).toBe(true);
    });

    it('应该拒绝无效的JSON值', () => {
      expect(isJsonValue(undefined)).toBe(false);
      expect(isJsonValue(() => {})).toBe(false);
      expect(isJsonValue(new Date())).toBe(false);
      expect(isJsonValue(/regex/)).toBe(false);
      expect(isJsonValue(Symbol('symbol'))).toBe(false);
      expect(isJsonValue(BigInt(123))).toBe(false);
    });

    it('应该正确处理嵌套结构', () => {
      const complexObject = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 'two', { three: true }],
        nested: {
          deep: {
            value: 'found'
          }
        }
      };

      expect(isJsonValue(complexObject)).toBe(true);

      // 包含无效值的嵌套对象
      const invalidObject = {
        valid: 'value',
        invalid: () => {}
      };

      expect(isJsonValue(invalidObject)).toBe(false);
    });
  });

  describe('isUnknownValue', () => {
    it('应该识别所有未知值类型', () => {
      // JSON值
      expect(isUnknownValue('string')).toBe(true);
      expect(isUnknownValue(123)).toBe(true);
      expect(isUnknownValue(true)).toBe(true);
      expect(isUnknownValue(null)).toBe(true);
      expect(isUnknownValue({})).toBe(true);
      expect(isUnknownValue([])).toBe(true);

      // 额外允许的类型
      expect(isUnknownValue(undefined)).toBe(true);
      expect(isUnknownValue(() => {})).toBe(true);
      expect(isUnknownValue(Symbol('symbol'))).toBe(true);
      expect(isUnknownValue(BigInt(123))).toBe(true);
    });
  });
});

describe('实体类型守卫', () => {
  describe('isAgent', () => {
    const validAgent: any = {
      id: 'agent-123',
      name: 'Test Agent',
      description: 'A test agent',
      model: 'gpt-3.5-turbo',
      status: 'active',
      capabilities: ['text-generation'],
      provider: 'openai',
      isActive: true
    };

    it('应该识别有效的Agent', () => {
      expect(isAgent(validAgent)).toBe(true);
    });

    it('应该接受可选字段', () => {
      const agentWithOptional = {
        ...validAgent,
        avatar: 'https://example.com/avatar.png',
        workspaceType: 'chat'
      };
      expect(isAgent(agentWithOptional)).toBe(true);
    });

    it('应该拒绝无效的Agent', () => {
      // 缺少必需字段
      expect(isAgent({})).toBe(false);
      expect(isAgent({ id: '123' })).toBe(false);

      // 错误的字段类型
      expect(isAgent({ ...validAgent, id: 123 })).toBe(false);
      expect(isAgent({ ...validAgent, status: 'invalid' })).toBe(false);
      expect(isAgent({ ...validAgent, provider: 'invalid' })).toBe(false);

      // null或undefined必需字段
      expect(isAgent({ ...validAgent, id: null })).toBe(false);
      expect(isAgent({ ...validAgent, name: undefined })).toBe(false);
    });
  });

  describe('isAgentConfig', () => {
    const validAgentConfig: any = {
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

    it('应该识别有效的AgentConfig', () => {
      expect(isAgentConfig(validAgentConfig)).toBe(true);
    });

    it('应该拒绝无效的AgentConfig', () => {
      // 缺少AgentConfig特有的必需字段
      const { endpoint, apiKey, ...incompleteConfig } = validAgentConfig;
      expect(isAgentConfig(incompleteConfig)).toBe(false);

      // 错误的字段类型
      expect(isAgentConfig({ ...validAgentConfig, maxTokens: '2048' })).toBe(false);
      expect(isAgentConfig({ ...validAgentConfig, temperature: '0.7' })).toBe(false);
    });
  });

  describe('isStandardMessage', () => {
    const validStandardMessage: any = {
      id: 'msg-123',
      role: 'user',
      content: 'Hello, world!',
      timestamp: Date.now()
    };

    it('应该识别有效的标准消息', () => {
      expect(isStandardMessage(validStandardMessage)).toBe(true);
    });

    it('应该接受可选的metadata字段', () => {
      const messageWithMetadata = {
        ...validStandardMessage,
        metadata: {
          agentId: 'agent-123',
          sessionId: 'session-123',
          tokens: 10
        }
      };
      expect(isStandardMessage(messageWithMetadata)).toBe(true);
    });

    it('应该拒绝无效的标准消息', () => {
      // 缺少必需字段
      expect(isStandardMessage({})).toBe(false);
      expect(isStandardMessage({ id: 'msg-123' })).toBe(false);

      // 错误的字段类型
      expect(isStandardMessage({ ...validStandardMessage, timestamp: 'invalid' })).toBe(false);
      expect(isStandardMessage({ ...validStandardMessage, role: 'invalid' })).toBe(false);
    });
  });

  describe('isSimpleMessage', () => {
    it('应该识别有效的简化消息', () => {
      expect(isSimpleMessage({ AI: 'Hello from AI' })).toBe(true);
      expect(isSimpleMessage({ HUMAN: 'Hello from human' })).toBe(true);
      expect(isSimpleMessage({ AI: 'AI response', HUMAN: 'Human input' })).toBe(true);
    });

    it('应该接受可选字段', () => {
      const messageWithOptions = {
        AI: 'AI response',
        HUMAN: 'Human input',
        id: 'msg-123',
        feedback: 'like',
        timestamp: Date.now()
      };
      expect(isSimpleMessage(messageWithOptions)).toBe(true);
    });

    it('应该拒绝无效的简化消息', () => {
      // 空对象
      expect(isSimpleMessage({})).toBe(false);

      // 错误的字段类型
      expect(isSimpleMessage({ AI: 123 })).toBe(false);
      expect(isSimpleMessage({ HUMAN: true })).toBe(false);
      expect(isSimpleMessage({ AI: 'response', invalid: 'field' })).toBe(false);
    });
  });

  describe('isChatSession', () => {
    const validChatSession: any = {
      id: 'session-123',
      title: 'Test Conversation',
      agentId: 'agent-123',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    };

    it('应该识别有效的聊天会话', () => {
      expect(isChatSession(validChatSession)).toBe(true);
    });

    it('应该接受可选字段', () => {
      const sessionWithOptions = {
        ...validChatSession,
        userId: 'user-123',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: Date.now()
          }
        ],
        metadata: {
          tags: ['test'],
          source: 'web'
        }
      };
      expect(isChatSession(sessionWithOptions)).toBe(true);
    });

    it('应该接受不同的时间戳格式', () => {
      const sessionWithStringDate = {
        ...validChatSession,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };
      expect(isChatSession(sessionWithStringDate)).toBe(true);

      const sessionWithNumberDate = {
        ...validChatSession,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      expect(isChatSession(sessionWithNumberDate)).toBe(true);
    });

    it('应该拒绝无效的聊天会话', () => {
      // 缺少必需字段
      expect(isChatSession({})).toBe(false);
      expect(isChatSession({ id: 'session-123' })).toBe(false);

      // 错误的字段类型
      expect(isChatSession({ ...validChatSession, id: 123 })).toBe(false);
      expect(isChatSession({ ...validChatSession, messages: 'invalid' })).toBe(false);
    });
  });

  describe('isUser', () => {
    const validUser: any = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      status: 'active',
      authProvider: 'local',
      password: 'hashedpassword',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('应该识别有效的用户', () => {
      expect(isUser(validUser)).toBe(true);
    });

    it('应该接受可选字段', () => {
      const userWithOptions = {
        ...validUser,
        avatar: 'https://example.com/avatar.png',
        profile: {
          bio: 'Test user bio',
          preferences: {}
        },
        lastLoginAt: new Date()
      };
      expect(isUser(userWithOptions)).toBe(true);
    });

    it('应该拒绝无效的用户', () => {
      // 缺少必需字段
      expect(isUser({})).toBe(false);
      expect(isUser({ id: 'user-123' })).toBe(false);

      // 错误的字段类型
      expect(isUser({ ...validUser, role: 'invalid' })).toBe(false);
      expect(isUser({ ...validUser, status: 'invalid' })).toBe(false);
      expect(isUser({ ...validUser, authProvider: 'invalid' })).toBe(false);
    });
  });
});

describe('枚举类型守卫', () => {
  describe('isAgentStatus', () => {
    it('应该识别有效的Agent状态', () => {
      expect(isAgentStatus('active')).toBe(true);
      expect(isAgentStatus('inactive')).toBe(true);
      expect(isAgentStatus('error')).toBe(true);
      expect(isAgentStatus('loading')).toBe(true);
    });

    it('应该拒绝无效的Agent状态', () => {
      expect(isAgentStatus('invalid')).toBe(false);
      expect(isAgentStatus('ACTIVE')).toBe(false);
      expect(isAgentStatus('')).toBe(false);
      expect(isAgentStatus(null)).toBe(false);
      expect(isAgentStatus(undefined)).toBe(false);
    });
  });

  describe('isProviderType', () => {
    it('应该识别有效的提供商类型', () => {
      expect(isProviderType('openai')).toBe(true);
      expect(isProviderType('anthropic')).toBe(true);
      expect(isProviderType('fastgpt')).toBe(true);
      expect(isProviderType('dify')).toBe(true);
      expect(isProviderType('custom')).toBe(true);
    });

    it('应该拒绝无效的提供商类型', () => {
      expect(isProviderType('invalid')).toBe(false);
      expect(isProviderType('OpenAI')).toBe(false);
      expect(isProviderType('')).toBe(false);
      expect(isProviderType(null)).toBe(false);
      expect(isProviderType(undefined)).toBe(false);
    });
  });

  describe('isMessageRole', () => {
    it('应该识别有效的消息角色', () => {
      expect(isMessageRole('user')).toBe(true);
      expect(isMessageRole('assistant')).toBe(true);
      expect(isMessageRole('system')).toBe(true);
      expect(isMessageRole('tool')).toBe(true);
    });

    it('应该拒绝无效的消息角色', () => {
      expect(isMessageRole('invalid')).toBe(false);
      expect(isMessageRole('USER')).toBe(false);
      expect(isMessageRole('')).toBe(false);
      expect(isMessageRole(null)).toBe(false);
      expect(isMessageRole(undefined)).toBe(false);
    });
  });

  describe('isUserRole', () => {
    it('应该识别有效的用户角色', () => {
      expect(isUserRole('admin')).toBe(true);
      expect(isUserRole('user')).toBe(true);
      expect(isUserRole('guest')).toBe(true);
    });

    it('应该拒绝无效的用户角色', () => {
      expect(isUserRole('invalid')).toBe(false);
      expect(isUserRole('ADMIN')).toBe(false);
      expect(isUserRole('')).toBe(false);
      expect(isUserRole(null)).toBe(false);
      expect(isUserRole(undefined)).toBe(false);
    });
  });

  describe('isUserStatus', () => {
    it('应该识别有效的用户状态', () => {
      expect(isUserStatus('active')).toBe(true);
      expect(isUserStatus('inactive')).toBe(true);
      expect(isUserStatus('suspended')).toBe(true);
      expect(isUserStatus('pending')).toBe(true);
    });

    it('应该拒绝无效的用户状态', () => {
      expect(isUserStatus('invalid')).toBe(false);
      expect(isUserStatus('ACTIVE')).toBe(false);
      expect(isUserStatus('')).toBe(false);
      expect(isUserStatus(null)).toBe(false);
      expect(isUserStatus(undefined)).toBe(false);
    });
  });

  describe('isAuthProvider', () => {
    it('应该识别有效的认证提供商', () => {
      expect(isAuthProvider('local')).toBe(true);
      expect(isAuthProvider('google')).toBe(true);
      expect(isAuthProvider('github')).toBe(true);
      expect(isAuthProvider('saml')).toBe(true);
    });

    it('应该拒绝无效的认证提供商', () => {
      expect(isAuthProvider('invalid')).toBe(false);
      expect(isAuthProvider('LOCAL')).toBe(false);
      expect(isAuthProvider('')).toBe(false);
      expect(isAuthProvider(null)).toBe(false);
      expect(isAuthProvider(undefined)).toBe(false);
    });
  });
});

describe('边界情况和错误处理', () => {
  describe('null和undefined处理', () => {
    it('应该正确处理null值', () => {
      expect(isString(null)).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isBoolean(null)).toBe(false);
      expect(isObject(null)).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isAgent(null)).toBe(false);
      expect(isStandardMessage(null)).toBe(false);
    });

    it('应该正确处理undefined值', () => {
      expect(isString(undefined)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isBoolean(undefined)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isAgent(undefined)).toBe(false);
      expect(isStandardMessage(undefined)).toBe(false);
    });
  });

  describe('类型转换问题', () => {
    it('应该正确处理包装对象', () => {
      expect(isString(new String('hello'))).toBe(false);
      expect(isNumber(new Number(123))).toBe(false);
      expect(isBoolean(new Boolean(true))).toBe(false);
    });

    it('应该正确处理数组和对象的边界情况', () => {
      expect(isArray({ length: 0 })).toBe(false);
      expect(isObject([])).toBe(false);
    });
  });

  describe('复杂嵌套结构', () => {
    it('应该正确验证深层嵌套的对象', () => {
      const deepNestedObject = {
        level1: {
          level2: {
            level3: {
              value: 'found',
              array: [1, 2, { nested: true }]
            }
          }
        }
      };

      expect(isJsonValue(deepNestedObject)).toBe(true);
      expect(isObject(deepNestedObject)).toBe(true);
    });

    it('应该正确处理循环引用', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      // JSON值不应该有循环引用
      expect(isJsonValue(obj)).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量数据', () => {
      const largeArray = Array(10000).fill(null).map((_, i) => ({
        id: `item-${i}`,
        value: i,
        nested: { deep: { value: i } }
      }));

      const startTime = performance.now();
      const result = largeArray.every(item => isJsonValue(item));
      const endTime = performance.now();

      expect(result).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});