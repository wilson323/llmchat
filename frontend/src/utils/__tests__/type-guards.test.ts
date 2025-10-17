/**
 * 类型守卫工具库测试
 */

import { describe, it, expect } from 'vitest';
import {
  // 基础类型守卫
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  
  // 实体类型守卫
  isAgent,
  isAgentConfig,
  isChatMessage,
  isOriginalChatMessage,
  isChatSession,
  isAgentSessionsMap,
  isStreamStatus,
  isApiError,
  
  // 字面量类型守卫
  isThemeMode,
  isWorkspaceType,
  isAgentStatus,
  isMessageStatus,
  
  // 数组类型守卫
  isArrayOf,
  isAgentArray,
  isChatMessageArray,
  isChatSessionArray,
  
  // 过滤和转换工具
  filterDefined,
  filterByType,
  getFirst,
  getLast,
  
  // 可选属性安全访问
  getOrDefault,
  getNestedProperty,
  getStringProperty,
  getNumberProperty,
  getBooleanProperty,
  
  // 类型断言
  assertDefined,
  assertType,
  assertAgent,
  assertChatMessage,
  assertChatSession,
  
  // 组合类型守卫
  hasProperty,
  hasProperties,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  
  // 特殊类型守卫
  hasHumanMessage,
  hasAIMessage,
  hasInteractiveData,
  hasReasoningState,
  isActiveAgent,
  isEmptySession,
  isArchivedSession,
  isPinnedSession,
  
  // 查找工具
  findFirst,
  findFirstOfType,
  findAgentById,
  findSessionById,
  
  // 对象操作
  mergeDefinedProperties,
  updateOptionalProperty,
  
  // 条件处理
  ifType,
  matchType,
  
  // 类型转换
  safeCast,
  toAgent,
  toChatMessage,
  toChatSession,
  
  // 验证
  validateAgent,
  validateChatSession,
  validateRequiredProperties,
} from '../type-guards';

import type { Agent, ChatMessage, ChatSession } from '@/types';

// ============================================================================
// 测试数据
// ============================================================================

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  description: 'A test agent',
  model: 'gpt-4',
  status: 'active',
  capabilities: ['chat', 'reasoning'],
  provider: 'openai',
  isActive: true,
};

const mockChatMessage: ChatMessage = {
  AI: 'Hello from AI',
  HUMAN: 'Hello from human',
  id: 'msg-1',
  timestamp: Date.now(),
};

const mockChatSession: ChatSession = {
  id: 'session-1',
  title: 'Test Session',
  agentId: 'agent-1',
  messages: [mockChatMessage],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// 基础类型守卫测试
// ============================================================================

describe('基础类型守卫', () => {
  describe('isDefined', () => {
    it('应该正确识别已定义的值', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined([])).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it('应该正确识别未定义的值', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isString', () => {
    it('应该正确识别字符串', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString(String(123))).toBe(true);
    });

    it('应该拒绝非字符串', () => {
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString({})).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('应该正确识别数字', () => {
      expect(isNumber(0)).toBe(true);
      expect(isNumber(123)).toBe(true);
      expect(isNumber(-456)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    it('应该拒绝NaN和非数字', () => {
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('应该正确识别布尔值', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('应该拒绝非布尔值', () => {
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean('true')).toBe(false);
      expect(isBoolean(null)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('应该正确识别对象', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('应该拒绝非对象', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject('object')).toBe(false);
    });
  });

  describe('isArray', () => {
    it('应该正确识别数组', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('应该拒绝非数组', () => {
      expect(isArray({})).toBe(false);
      expect(isArray(null)).toBe(false);
      expect(isArray('array')).toBe(false);
    });
  });
});

// ============================================================================
// 实体类型守卫测试
// ============================================================================

describe('实体类型守卫', () => {
  describe('isAgent', () => {
    it('应该正确识别有效的Agent', () => {
      expect(isAgent(mockAgent)).toBe(true);
    });

    it('应该拒绝无效的Agent', () => {
      expect(isAgent({})).toBe(false);
      expect(isAgent({ id: 'agent-1' })).toBe(false);
      expect(isAgent(null)).toBe(false);
    });
  });

  describe('isChatMessage', () => {
    it('应该正确识别有效的ChatMessage', () => {
      expect(isChatMessage(mockChatMessage)).toBe(true);
      expect(isChatMessage({ AI: 'Hello' })).toBe(true);
      expect(isChatMessage({ HUMAN: 'Hi' })).toBe(true);
    });

    it('应该拒绝无效的ChatMessage', () => {
      expect(isChatMessage({})).toBe(false);
      expect(isChatMessage({ id: 'msg-1' })).toBe(false);
      expect(isChatMessage(null)).toBe(false);
    });
  });

  describe('isChatSession', () => {
    it('应该正确识别有效的ChatSession', () => {
      expect(isChatSession(mockChatSession)).toBe(true);
    });

    it('应该拒绝无效的ChatSession', () => {
      expect(isChatSession({})).toBe(false);
      expect(isChatSession({ id: 'session-1' })).toBe(false);
      expect(isChatSession(null)).toBe(false);
    });
  });

  describe('isStreamStatus', () => {
    it('应该正确识别有效的StreamStatus', () => {
      expect(isStreamStatus({
        type: 'progress',
        status: 'running',
      })).toBe(true);
    });

    it('应该拒绝无效的StreamStatus', () => {
      expect(isStreamStatus({
        type: 'invalid',
        status: 'running',
      })).toBe(false);
      expect(isStreamStatus({})).toBe(false);
    });
  });

  describe('isApiError', () => {
    it('应该正确识别有效的ApiError', () => {
      expect(isApiError({
        code: 'ERR_001',
        message: 'Error message',
        timestamp: new Date().toISOString(),
      })).toBe(true);
    });

    it('应该拒绝无效的ApiError', () => {
      expect(isApiError({
        code: 'ERR_001',
      })).toBe(false);
      expect(isApiError(null)).toBe(false);
    });
  });
});

// ============================================================================
// 字面量类型守卫测试
// ============================================================================

describe('字面量类型守卫', () => {
  describe('isThemeMode', () => {
    it('应该正确识别有效的主题模式', () => {
      expect(isThemeMode('light')).toBe(true);
      expect(isThemeMode('dark')).toBe(true);
      expect(isThemeMode('auto')).toBe(true);
    });

    it('应该拒绝无效的主题模式', () => {
      expect(isThemeMode('invalid')).toBe(false);
      expect(isThemeMode(null)).toBe(false);
    });
  });

  describe('isAgentStatus', () => {
    it('应该正确识别有效的智能体状态', () => {
      expect(isAgentStatus('active')).toBe(true);
      expect(isAgentStatus('inactive')).toBe(true);
      expect(isAgentStatus('error')).toBe(true);
      expect(isAgentStatus('loading')).toBe(true);
    });

    it('应该拒绝无效的智能体状态', () => {
      expect(isAgentStatus('unknown')).toBe(false);
      expect(isAgentStatus(null)).toBe(false);
    });
  });
});

// ============================================================================
// 数组操作测试
// ============================================================================

describe('数组操作工具', () => {
  describe('filterDefined', () => {
    it('应该过滤掉null和undefined', () => {
      const input = [1, null, 2, undefined, 3];
      const result = filterDefined(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('应该保留0和空字符串', () => {
      const input = [0, '', false, null, undefined];
      const result = filterDefined(input);
      expect(result).toEqual([0, '', false]);
    });
  });

  describe('getFirst', () => {
    it('应该返回数组的第一个元素', () => {
      expect(getFirst([1, 2, 3])).toBe(1);
      expect(getFirst(['a', 'b'])).toBe('a');
    });

    it('应该处理空数组和undefined', () => {
      expect(getFirst([])).toBeUndefined();
      expect(getFirst(undefined)).toBeUndefined();
      expect(getFirst(null)).toBeUndefined();
    });
  });

  describe('getLast', () => {
    it('应该返回数组的最后一个元素', () => {
      expect(getLast([1, 2, 3])).toBe(3);
      expect(getLast(['a', 'b'])).toBe('b');
    });

    it('应该处理空数组和undefined', () => {
      expect(getLast([])).toBeUndefined();
      expect(getLast(undefined)).toBeUndefined();
      expect(getLast(null)).toBeUndefined();
    });
  });

  describe('findAgentById', () => {
    const agents: Agent[] = [
      { ...mockAgent, id: 'agent-1' },
      { ...mockAgent, id: 'agent-2' },
    ];

    it('应该找到匹配的智能体', () => {
      const found = findAgentById(agents, 'agent-2');
      expect(found).toBeDefined();
      expect(found?.id).toBe('agent-2');
    });

    it('应该处理未找到的情况', () => {
      expect(findAgentById(agents, 'not-exist')).toBeUndefined();
      expect(findAgentById(undefined, 'agent-1')).toBeUndefined();
      expect(findAgentById(agents, undefined)).toBeUndefined();
    });
  });

  describe('findSessionById', () => {
    const sessions: ChatSession[] = [
      { ...mockChatSession, id: 'session-1' },
      { ...mockChatSession, id: 'session-2' },
    ];

    it('应该找到匹配的会话', () => {
      const found = findSessionById(sessions, 'session-2');
      expect(found).toBeDefined();
      expect(found?.id).toBe('session-2');
    });

    it('应该处理未找到的情况', () => {
      expect(findSessionById(sessions, 'not-exist')).toBeUndefined();
      expect(findSessionById(undefined, 'session-1')).toBeUndefined();
      expect(findSessionById(sessions, undefined)).toBeUndefined();
    });
  });
});

// ============================================================================
// 可选属性安全访问测试
// ============================================================================

describe('可选属性安全访问', () => {
  describe('getOrDefault', () => {
    it('应该返回存在的属性值', () => {
      const obj = { name: 'test', count: 10 };
      expect(getOrDefault(obj, 'name', 'default')).toBe('test');
      expect(getOrDefault(obj, 'count', 0)).toBe(10);
    });

    it('应该返回默认值当属性不存在', () => {
      const obj: { name?: string; count?: number } = {};
      expect(getOrDefault(obj, 'name', 'default')).toBe('default');
      expect(getOrDefault(obj, 'count', 0)).toBe(0);
    });

    it('应该处理null和undefined对象', () => {
      expect(getOrDefault(null, 'name' as any, 'default')).toBe('default');
      expect(getOrDefault(undefined, 'count' as any, 0)).toBe(0);
    });
  });

  describe('getNestedProperty', () => {
    const obj = {
      user: {
        profile: {
          name: 'John',
          age: 30,
        },
      },
    };

    it('应该访问嵌套属性', () => {
      expect(getNestedProperty(obj, ['user', 'profile', 'name'], '')).toBe('John');
      expect(getNestedProperty(obj, ['user', 'profile', 'age'], 0)).toBe(30);
    });

    it('应该返回默认值当路径不存在', () => {
      expect(getNestedProperty(obj, ['user', 'invalid', 'name'], 'default')).toBe('default');
      expect(getNestedProperty(obj, ['invalid'], 'default')).toBe('default');
    });

    it('应该处理null和undefined', () => {
      expect(getNestedProperty(null, ['user'], 'default')).toBe('default');
      expect(getNestedProperty(undefined, ['user'], 'default')).toBe('default');
    });
  });

  describe('getStringProperty', () => {
    it('应该返回字符串属性', () => {
      const obj = { name: 'test', age: 10 };
      expect(getStringProperty(obj, 'name')).toBe('test');
    });

    it('应该返回默认值当属性不是字符串', () => {
      const obj = { name: 123, age: 10 };
      expect(getStringProperty(obj, 'name')).toBe('');
      expect(getStringProperty(obj, 'name', 'default')).toBe('default');
    });

    it('应该处理undefined对象', () => {
      expect(getStringProperty(undefined, 'name')).toBe('');
    });
  });

  describe('getNumberProperty', () => {
    it('应该返回数字属性', () => {
      const obj = { count: 10, name: 'test' };
      expect(getNumberProperty(obj, 'count')).toBe(10);
    });

    it('应该返回默认值当属性不是数字', () => {
      const obj = { count: 'ten', name: 'test' };
      expect(getNumberProperty(obj, 'count')).toBe(0);
      expect(getNumberProperty(obj, 'count', 99)).toBe(99);
    });
  });

  describe('getBooleanProperty', () => {
    it('应该返回布尔属性', () => {
      const obj = { active: true, disabled: false };
      expect(getBooleanProperty(obj, 'active')).toBe(true);
      expect(getBooleanProperty(obj, 'disabled')).toBe(false);
    });

    it('应该返回默认值当属性不是布尔值', () => {
      const obj = { active: 'true' };
      expect(getBooleanProperty(obj, 'active')).toBe(false);
      expect(getBooleanProperty(obj, 'active', true)).toBe(true);
    });
  });
});

// ============================================================================
// 类型断言测试
// ============================================================================

describe('类型断言工具', () => {
  describe('assertDefined', () => {
    it('应该通过已定义的值', () => {
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined('')).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
    });

    it('应该抛出错误当值未定义', () => {
      expect(() => assertDefined(null)).toThrow();
      expect(() => assertDefined(undefined)).toThrow();
    });

    it('应该使用自定义错误消息', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('assertAgent', () => {
    it('应该通过有效的Agent', () => {
      expect(() => assertAgent(mockAgent)).not.toThrow();
    });

    it('应该抛出错误当Agent无效', () => {
      expect(() => assertAgent({})).toThrow('Value is not a valid Agent');
      expect(() => assertAgent(null)).toThrow();
    });
  });

  describe('assertChatMessage', () => {
    it('应该通过有效的ChatMessage', () => {
      expect(() => assertChatMessage(mockChatMessage)).not.toThrow();
    });

    it('应该抛出错误当ChatMessage无效', () => {
      expect(() => assertChatMessage({})).toThrow('Value is not a valid ChatMessage');
      expect(() => assertChatMessage(null)).toThrow();
    });
  });

  describe('assertChatSession', () => {
    it('应该通过有效的ChatSession', () => {
      expect(() => assertChatSession(mockChatSession)).not.toThrow();
    });

    it('应该抛出错误当ChatSession无效', () => {
      expect(() => assertChatSession({})).toThrow('Value is not a valid ChatSession');
      expect(() => assertChatSession(null)).toThrow();
    });
  });
});

// ============================================================================
// 组合类型守卫测试
// ============================================================================

describe('组合类型守卫', () => {
  describe('hasProperty', () => {
    it('应该正确检查属性存在', () => {
      const obj = { name: 'test', age: 10 };
      expect(hasProperty(obj, 'name')).toBe(true);
      expect(hasProperty(obj, 'age')).toBe(true);
    });

    it('应该正确检查属性不存在', () => {
      const obj = { name: 'test' };
      expect(hasProperty(obj, 'age')).toBe(false);
      expect(hasProperty(null, 'name')).toBe(false);
    });
  });

  describe('hasProperties', () => {
    it('应该正确检查多个属性存在', () => {
      const obj = { name: 'test', age: 10, active: true };
      expect(hasProperties(obj, ['name', 'age'])).toBe(true);
    });

    it('应该正确检查多个属性不全存在', () => {
      const obj = { name: 'test' };
      expect(hasProperties(obj, ['name', 'age'])).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('应该识别非空字符串', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString(' test ')).toBe(true);
    });

    it('应该拒绝空字符串和非字符串', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('应该识别正数', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(3.14)).toBe(true);
    });

    it('应该拒绝零、负数和非数字', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber('1')).toBe(false);
    });
  });

  describe('isNonNegativeNumber', () => {
    it('应该识别非负数', () => {
      expect(isNonNegativeNumber(0)).toBe(true);
      expect(isNonNegativeNumber(1)).toBe(true);
    });

    it('应该拒绝负数和非数字', () => {
      expect(isNonNegativeNumber(-1)).toBe(false);
      expect(isNonNegativeNumber('0')).toBe(false);
    });
  });
});

// ============================================================================
// 特殊类型守卫测试
// ============================================================================

describe('特殊类型守卫', () => {
  describe('hasHumanMessage', () => {
    it('应该识别包含用户消息的ChatMessage', () => {
      expect(hasHumanMessage({ HUMAN: 'Hello' })).toBe(true);
      expect(hasHumanMessage(mockChatMessage)).toBe(true);
    });

    it('应该拒绝不包含用户消息的ChatMessage', () => {
      expect(hasHumanMessage({ AI: 'Hello' })).toBe(false);
      expect(hasHumanMessage({ HUMAN: '' })).toBe(false);
      expect(hasHumanMessage({})).toBe(false);
    });
  });

  describe('hasAIMessage', () => {
    it('应该识别包含AI消息的ChatMessage', () => {
      expect(hasAIMessage({ AI: 'Hello' })).toBe(true);
      expect(hasAIMessage(mockChatMessage)).toBe(true);
    });

    it('应该拒绝不包含AI消息的ChatMessage', () => {
      expect(hasAIMessage({ HUMAN: 'Hello' })).toBe(false);
      expect(hasAIMessage({ AI: '' })).toBe(false);
    });
  });

  describe('isActiveAgent', () => {
    it('应该识别激活的智能体', () => {
      expect(isActiveAgent(mockAgent)).toBe(true);
    });

    it('应该识别未激活的智能体', () => {
      expect(isActiveAgent({ ...mockAgent, status: 'inactive' })).toBe(false);
      expect(isActiveAgent({ ...mockAgent, isActive: false })).toBe(false);
    });
  });

  describe('isEmptySession', () => {
    it('应该识别空会话', () => {
      expect(isEmptySession({ ...mockChatSession, messages: [] })).toBe(true);
    });

    it('应该识别非空会话', () => {
      expect(isEmptySession(mockChatSession)).toBe(false);
    });
  });

  describe('isPinnedSession', () => {
    it('应该识别置顶会话', () => {
      expect(isPinnedSession({ ...mockChatSession, isPinned: true })).toBe(true);
    });

    it('应该识别非置顶会话', () => {
      expect(isPinnedSession(mockChatSession)).toBe(false);
      expect(isPinnedSession({ ...mockChatSession, isPinned: false })).toBe(false);
    });
  });

  describe('isArchivedSession', () => {
    it('应该识别归档会话', () => {
      expect(isArchivedSession({ ...mockChatSession, isArchived: true })).toBe(true);
    });

    it('应该识别非归档会话', () => {
      expect(isArchivedSession(mockChatSession)).toBe(false);
      expect(isArchivedSession({ ...mockChatSession, isArchived: false })).toBe(false);
    });
  });
});

// ============================================================================
// 类型转换测试
// ============================================================================

describe('类型转换工具', () => {
  describe('safeCast', () => {
    it('应该转换符合类型的值', () => {
      const result = safeCast(mockAgent, isAgent, { ...mockAgent, id: 'default' });
      expect(result.id).toBe('agent-1');
    });

    it('应该返回默认值当类型不匹配', () => {
      const defaultAgent = { ...mockAgent, id: 'default' };
      const result = safeCast({}, isAgent, defaultAgent);
      expect(result.id).toBe('default');
    });
  });

  describe('toAgent', () => {
    it('应该转换有效的Agent', () => {
      const result = toAgent(mockAgent, { ...mockAgent, id: 'default' });
      expect(result.id).toBe('agent-1');
    });

    it('应该返回默认Agent当转换失败', () => {
      const defaultAgent = { ...mockAgent, id: 'default' };
      const result = toAgent({}, defaultAgent);
      expect(result.id).toBe('default');
    });
  });
});

// ============================================================================
// 对象操作测试
// ============================================================================

describe('对象操作工具', () => {
  describe('mergeDefinedProperties', () => {
    it('应该只合并已定义的属性', () => {
      const target = { a: 1, b: 2, c: 3 };
      const source = { b: 20, c: undefined, d: 40 };
      const result = mergeDefinedProperties(target, source);
      
      expect(result.a).toBe(1);
      expect(result.b).toBe(20);
      expect(result.c).toBe(3); // 保持原值，因为source.c是undefined
    });
  });

  describe('updateOptionalProperty', () => {
    it('应该更新已定义的属性', () => {
      const obj = { name: 'test', age: 10 };
      const result = updateOptionalProperty(obj, 'age', 20);
      expect(result.age).toBe(20);
    });

    it('应该保持原对象当值未定义', () => {
      const obj = { name: 'test', age: 10 };
      const result = updateOptionalProperty(obj, 'age', undefined);
      expect(result.age).toBe(10);
    });
  });
});

// ============================================================================
// 条件处理测试
// ============================================================================

describe('条件处理工具', () => {
  describe('ifType', () => {
    it('应该在类型匹配时执行回调', () => {
      let executed = false;
      ifType(mockAgent, isAgent, () => {
        executed = true;
      });
      expect(executed).toBe(true);
    });

    it('应该在类型不匹配时不执行回调', () => {
      let executed = false;
      ifType({}, isAgent, () => {
        executed = true;
      });
      expect(executed).toBe(false);
    });
  });

  describe('matchType', () => {
    it('应该在类型匹配时执行onMatch', () => {
      const result = matchType(
        mockAgent,
        isAgent,
        (agent) => agent.name,
        () => 'default'
      );
      expect(result).toBe('Test Agent');
    });

    it('应该在类型不匹配时执行onMismatch', () => {
      const result = matchType(
        {},
        isAgent,
        (agent) => agent.name,
        () => 'default'
      );
      expect(result).toBe('default');
    });
  });
});

// ============================================================================
// 验证工具测试
// ============================================================================

describe('验证工具', () => {
  describe('validateAgent', () => {
    it('应该通过完整的有效Agent', () => {
      expect(validateAgent(mockAgent)).toBe(true);
    });

    it('应该拒绝不完整的Agent', () => {
      expect(validateAgent({ ...mockAgent, id: '' })).toBe(false);
      expect(validateAgent({ ...mockAgent, name: '' })).toBe(false);
      expect(validateAgent({ ...mockAgent, capabilities: [] })).toBe(false);
      expect(validateAgent({ ...mockAgent, status: 'invalid' })).toBe(false);
    });
  });

  describe('validateChatSession', () => {
    it('应该通过完整的有效ChatSession', () => {
      expect(validateChatSession(mockChatSession)).toBe(true);
    });

    it('应该拒绝不完整的ChatSession', () => {
      expect(validateChatSession({ ...mockChatSession, id: '' })).toBe(false);
      expect(validateChatSession({ ...mockChatSession, title: '' })).toBe(false);
      expect(validateChatSession({ ...mockChatSession, createdAt: undefined })).toBe(false);
    });
  });

  describe('validateRequiredProperties', () => {
    it('应该验证必需属性存在', () => {
      const obj = { id: '1', name: 'test', age: 10 };
      expect(validateRequiredProperties(obj, ['id', 'name'])).toBe(true);
    });

    it('应该拒绝缺少必需属性的对象', () => {
      const obj = { id: '1' };
      expect(validateRequiredProperties(obj, ['id', 'name'])).toBe(false);
    });
  });
});

// ============================================================================
// 数组类型守卫测试
// ============================================================================

describe('数组类型守卫', () => {
  describe('isArrayOf', () => {
    it('应该正确识别同类型数组', () => {
      expect(isArrayOf([1, 2, 3], isNumber)).toBe(true);
      expect(isArrayOf(['a', 'b'], isString)).toBe(true);
    });

    it('应该拒绝混合类型数组', () => {
      expect(isArrayOf([1, 'a', 3], isNumber)).toBe(false);
    });

    it('应该处理空数组', () => {
      expect(isArrayOf([], isNumber)).toBe(true);
    });
  });

  describe('isAgentArray', () => {
    it('应该正确识别Agent数组', () => {
      const agents = [mockAgent, { ...mockAgent, id: 'agent-2' }];
      expect(isAgentArray(agents)).toBe(true);
    });

    it('应该拒绝无效的数组', () => {
      expect(isAgentArray([{}])).toBe(false);
      expect(isAgentArray([mockAgent, {}])).toBe(false);
    });
  });

  describe('isChatMessageArray', () => {
    it('应该正确识别ChatMessage数组', () => {
      const messages = [mockChatMessage, { AI: 'Another message' }];
      expect(isChatMessageArray(messages)).toBe(true);
    });

    it('应该拒绝无效的数组', () => {
      expect(isChatMessageArray([{}])).toBe(false);
    });
  });

  describe('isChatSessionArray', () => {
    it('应该正确识别ChatSession数组', () => {
      const sessions = [mockChatSession, { ...mockChatSession, id: 'session-2' }];
      expect(isChatSessionArray(sessions)).toBe(true);
    });

    it('应该拒绝无效的数组', () => {
      expect(isChatSessionArray([{}])).toBe(false);
    });
  });
});

// ============================================================================
// 集成测试
// ============================================================================

describe('类型守卫工具库集成测试', () => {
  it('应该支持链式类型检查', () => {
    const data: unknown = {
      agents: [mockAgent],
      currentAgent: mockAgent,
      sessions: [mockChatSession],
    };

    if (isObject(data) && hasProperty(data, 'agents')) {
      expect(isAgentArray(data.agents)).toBe(true);
    }

    if (isObject(data) && hasProperty(data, 'currentAgent')) {
      expect(isAgent(data.currentAgent)).toBe(true);
    }
  });

  it('应该支持安全的数据提取', () => {
    const data = {
      user: {
        profile: {
          agent: mockAgent,
        },
      },
    };

    const agentName = getNestedProperty(data, ['user', 'profile', 'agent'], mockAgent);
    expect(isAgent(agentName) && agentName.name).toBe('Test Agent');
  });

  it('应该支持类型安全的数组操作', () => {
    const mixed: unknown[] = [mockAgent, {}, null, mockAgent];
    const agents = filterByType(mixed, isAgent);
    
    expect(agents).toHaveLength(2);
    expect(agents[0].id).toBe('agent-1');
  });
});

