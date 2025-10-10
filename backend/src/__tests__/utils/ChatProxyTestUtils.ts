/**
 * ChatProxyService 测试工具
 * 提供 Mock 的 HTTP 客户端和测试辅助函数
 */

import { ChatProxyService } from '../../services/ChatProxyService';
import { AgentConfig, ChatMessage } from '@/types';
import { AgentConfigService } from '../../services/AgentConfigService';

/**
 * 创建模拟的 HTTP 客户端
 */
export interface MockHTTPClient {
  post: jest.Mock;
  get?: jest.Mock;
  put?: jest.Mock;
  delete?: jest.Mock;
}

/**
 * 创建 Mock HTTP 客户端
 */
export function createMockHTTPClient(): MockHTTPClient {
  return {
    post: jest.fn() as jest.Mock,
    get: jest.fn() as jest.Mock,
    put: jest.fn() as jest.Mock,
    delete: jest.fn() as jest.Mock,
  };
}

/**
 * 创建测试用的智能体配置
 */
export function createTestAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'test-agent-id',
    name: 'Test Agent',
    description: 'Test agent for unit testing',
    endpoint: 'https://api.test.com/v1/chat',
    apiKey: 'test-api-key',
    model: 'test-model',
    provider: 'openai',
    isActive: true,
    capabilities: ['chat'],
    features: {
      supportsChatId: true,
      supportsStream: true,
      supportsDetail: true,
      supportsFiles: true,
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
    ...overrides,
  };
}

/**
 * 创建测试用的消息
 */
export function createTestMessage(content: string = 'Hello', role: 'user' | 'assistant' = 'user'): ChatMessage {
  return { role, content };
}

/**
 * 创建测试用的消息数组
 */
export function createTestMessages(...contents: string[]): ChatMessage[] {
  return contents.map(content => createTestMessage(content));
}

/**
 * 创建带 Mock HTTP 客户端的 ChatProxyService
 */
export function createChatProxyServiceWithMockHTTP(
  mockHTTPClient: MockHTTPClient,
  mockAgentConfig?: AgentConfig
): ChatProxyService {
  // 创建模拟的 AgentConfigService
  const mockAgentService = new AgentConfigService('/mock/config/path');

  // 如果提供了mock配置，立即设置Mock
  if (mockAgentConfig) {
    jest.spyOn(mockAgentService, 'getAgent').mockResolvedValue(mockAgentConfig);
  }

  // 创建 ChatProxyService 实例
  const service = new ChatProxyService(mockAgentService);

  // 替换内部的 HTTP 客户端，保留一些必要属性
  const originalClient = (service as any).httpClient;
  (service as any).httpClient = {
    ...mockHTTPClient,
    defaults: originalClient?.defaults || {},
    interceptors: originalClient?.interceptors || { request: [], response: [] },
  };

  return service;
}

/**
 * 模拟网络超时错误
 */
export function createTimeoutError(message: string = 'timeout of 1000ms exceeded') {
  const error = new Error(message) as any;
  error.code = 'ECONNABORTED';
  return error;
}

/**
 * 模拟网络连接错误
 */
export function createNetworkError(message: string = 'getaddrinfo ENOTFOUND test.com') {
  const error = new Error(message) as any;
  error.code = 'ENOTFOUND';
  return error;
}

/**
 * 模拟 HTTP 错误响应
 */
export function createHTTPErrorResponse(status: number, statusText: string, data: any = {}) {
  return {
    status,
    statusText,
    data,
    headers: {},
  };
}

/**
 * 创建原始的HTTP响应（不经过ChatProxy格式化）
 */
export function createRawHTTPResponse(data: any, status: number = 200) {
  return {
    status,
    statusText: 'OK',
    data,
    headers: {},
  };
}

/**
 * 创建无效的HTTP响应
 */
export function createInvalidHTTPResponse(invalidData: any, status: number = 200) {
  return {
    status,
    statusText: 'OK',
    data: invalidData,
    headers: {},
  };
}

/**
 * 模拟成功的 HTTP 响应
 */
export function createSuccessResponse(data: any, status: number = 200) {
  // 确保响应包含ChatProxyService期望的结构
  const responseData = {
    id: data.id || 'chat-test-id',
    object: data.object || 'chat.completion',
    created: data.created || Date.now(),
    model: data.model || 'test-model',
    choices: data.choices || [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: data.content || 'Test response',
        },
        finish_reason: 'stop',
      }
    ],
    usage: data.usage || {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
    ...data,
  };

  return {
    status,
    statusText: 'OK',
    data: responseData,
    headers: {},
  };
}

/**
 * 验证错误消息包含预期内容
 */
export function expectErrorMessageContains(error: any, expectedMessage: string) {
  expect(error.message).toContain(expectedMessage);
}

/**
 * 设置 AgentConfigService Mock
 */
export function mockAgentConfigService(service: AgentConfigService, agentConfig: AgentConfig) {
  jest.spyOn(service, 'getAgent').mockResolvedValue(agentConfig);
  return service;
}

/**
 * 创建带有自定义AgentService的ChatProxyService
 */
export function createChatProxyServiceWithCustomAgent(
  mockHTTPClient: MockHTTPClient,
  getAgentMock: jest.Mock
): ChatProxyService {
  // 创建模拟的 AgentConfigService
  const mockAgentService = new AgentConfigService('/mock/config/path');

  // 设置自定义的getAgent Mock
  jest.spyOn(mockAgentService, 'getAgent').mockImplementation(getAgentMock);

  // 创建 ChatProxyService 实例
  const service = new ChatProxyService(mockAgentService);

  // 替换内部的 HTTP 客户端，保留一些必要属性
  const originalClient = (service as any).httpClient;
  (service as any).httpClient = {
    ...mockHTTPClient,
    defaults: originalClient?.defaults || {},
    interceptors: originalClient?.interceptors || { request: [], response: [] },
  };

  return service;
}

/**
 * 清理所有 Mock
 */
export function clearAllMocks() {
  jest.clearAllMocks();
}

/**
 * 重置所有 Mock
 */
export function resetAllMocks() {
  jest.resetAllMocks();
}

/**
 * 验证 Mock 调用
 */
export function expectMockCalled(mock: jest.Mock, times: number = 1) {
  expect(mock).toHaveBeenCalledTimes(times);
}

/**
 * 验证 Mock 未被调用
 */
export function expectMockNotCalled(mock: jest.Mock) {
  expect(mock).not.toHaveBeenCalled();
}