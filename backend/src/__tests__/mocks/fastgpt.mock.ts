/**
 * FastGPT Mock - 用于测试的FastGPT客户端模拟
 * 
 * 提供：
 * - 聊天接口Mock
 * - 会话初始化Mock
 * - 智能体列表Mock
 * - 流式响应Mock
 */

import { EventEmitter } from 'events';

/**
 * Mock响应数据
 */
export const mockFastGPTResponses = {
  chatSuccess: {
    choices: [{
      message: {
        role: 'assistant',
        content: '这是一个测试回复'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  },
  
  streamChunk: (text: string) => ({
    choices: [{
      delta: { content: text },
      finish_reason: null
    }]
  }),
  
  streamEnd: {
    choices: [{
      delta: {},
      finish_reason: 'stop'
    }]
  },
  
  initSession: {
    sessionId: 'test-session-id',
    appId: 'test-app-id',
    agentInfo: {
      name: '测试智能体',
      description: '用于测试的智能体',
      model: 'FastAI-4k',
      systemPrompt: '你是一个测试助手'
    }
  },
  
  agentList: [
    {
      id: 'agent-1',
      name: '智能体1',
      description: '测试智能体1',
      status: 'active'
    },
    {
      id: 'agent-2',
      name: '智能体2',
      description: '测试智能体2',
      status: 'active'
    }
  ]
};

/**
 * FastGPT客户端Mock类
 */
export class MockFastGPTClient {
  private delay: number;
  private shouldFail: boolean;
  
  constructor(config?: { delay?: number; shouldFail?: boolean }) {
    this.delay = config?.delay ?? 10;
    this.shouldFail = config?.shouldFail || false;
  }
  
  /**
   * 模拟聊天请求
   */
  async chat(messages: any[], options?: any): Promise<any> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('FastGPT API Error');
    }
    
    return mockFastGPTResponses.chatSuccess;
  }
  
  /**
   * 模拟流式聊天
   */
  async *chatStream(messages: any[], options?: any): AsyncGenerator<any> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('FastGPT Stream Error');
    }
    
    const testResponse = '这是一个流式响应测试';
    const words = testResponse.split('');
    
    for (const char of words) {
      yield mockFastGPTResponses.streamChunk(char);
      await this.simulateDelay(5);
    }
    
    yield mockFastGPTResponses.streamEnd;
  }
  
  /**
   * 模拟初始化会话
   */
  async initSession(agentId: string): Promise<any> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Init Session Failed');
    }
    
    return {
      ...mockFastGPTResponses.initSession,
      agentId
    };
  }
  
  /**
   * 模拟获取智能体列表
   */
  async getAgentList(): Promise<any[]> {
    await this.simulateDelay();
    
    if (this.shouldFail) {
      throw new Error('Get Agent List Failed');
    }
    
    return mockFastGPTResponses.agentList;
  }
  
  /**
   * 模拟延迟
   */
  private async simulateDelay(ms?: number): Promise<void> {
    const delayTime = ms || this.delay;
    return new Promise(resolve => setTimeout(resolve, delayTime));
  }
  
  /**
   * 设置失败模式
   */
  setFailMode(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  /**
   * 设置延迟
   */
  setDelay(ms: number): void {
    this.delay = ms;
  }
}

/**
 * 创建默认的FastGPT Mock实例
 */
export function createMockFastGPTClient(config?: { delay?: number; shouldFail?: boolean }): MockFastGPTClient {
  return new MockFastGPTClient(config);
}

/**
 * Jest Mock工厂函数
 */
export const mockFastGPTClientFactory = {
  chat: jest.fn().mockResolvedValue(mockFastGPTResponses.chatSuccess),
  chatStream: jest.fn().mockImplementation(async function* () {
    yield mockFastGPTResponses.streamChunk('测');
    yield mockFastGPTResponses.streamChunk('试');
    yield mockFastGPTResponses.streamEnd;
  }),
  initSession: jest.fn().mockResolvedValue(mockFastGPTResponses.initSession),
  getAgentList: jest.fn().mockResolvedValue(mockFastGPTResponses.agentList)
};

