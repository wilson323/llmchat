# Dify 智能体集成方案

## 概述

本文档描述如何在现有系统中集成 Dify 智能体，并确保与 FastGPT 智能体功能对齐，提供一致的用户体验。

## Dify API 规范分析

### 1. API 端点

```
基础 URL: https://api.dify.ai/v1 (云服务)
或: http://your-dify-instance/v1 (私有部署)
```

#### 主要接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/chat-messages` | POST | 发送聊天消息(支持流式) |
| `/messages` | GET | 获取历史消息列表 |
| `/messages/:id` | GET | 获取单条消息详情 |
| `/messages/:id/feedbacks` | POST | 提交反馈(点赞/点踩) |
| `/conversations` | GET | 获取会话列表 |
| `/conversations/:id` | DELETE | 删除会话 |
| `/parameters` | GET | 获取应用参数 |

### 2. 认证方式

```http
Authorization: Bearer {api_key}
```

- API Key 在 Dify 应用的"访问 API"页面获取
- 每个应用有独立的 API Key
- 支持多个 API Key 用于不同环境

### 3. 聊天消息请求格式

#### 非流式请求

```typescript
POST /v1/chat-messages
Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json

Request Body:
{
  "inputs": {},                    // 输入变量(可选)
  "query": "用户消息内容",
  "response_mode": "blocking",     // "blocking" | "streaming"
  "conversation_id": "",           // 会话ID(可选,新会话留空)
  "user": "user-123",              // 用户标识
  "files": []                      // 文件列表(可选)
}
```

#### 流式请求

```typescript
POST /v1/chat-messages
Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json

Request Body:
{
  "inputs": {},
  "query": "用户消息内容",
  "response_mode": "streaming",    // 流式模式
  "conversation_id": "",
  "user": "user-123"
}

Response: SSE Stream
event: message
data: {"event": "message", "message_id": "...", "conversation_id": "...", "answer": "部分内容"}

event: message_end
data: {"event": "message_end", "id": "...", "conversation_id": "...", "metadata": {...}}
```

### 4. 响应格式

#### 非流式响应

```typescript
{
  "message_id": "5ad4cb98-f0c7-4085-b384-88c403be6290",
  "conversation_id": "45701982-8118-4bc5-8e9b-64562b4555f2",
  "mode": "chat",
  "answer": "AI 回复内容",
  "metadata": {
    "usage": {
      "prompt_tokens": 100,
      "completion_tokens": 50,
      "total_tokens": 150
    },
    "retriever_resources": []  // 知识库检索结果
  },
  "created_at": 1679586595
}
```

#### 流式响应事件

| 事件类型 | 说明 | 数据示例 |
|---------|------|---------|
| `message` | 消息内容片段 | `{"answer": "片段文本"}` |
| `message_end` | 消息结束 | `{"metadata": {...}}` |
| `message_file` | 文件消息 | `{"type": "image", "url": "..."}` |
| `error` | 错误 | `{"status": 400, "message": "..."}` |
| `ping` | 心跳 | `{}` |

### 5. 反馈接口

```typescript
POST /v1/messages/:message_id/feedbacks
Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json

Request Body:
{
  "rating": "like" | "dislike" | null,  // 评分
  "user": "user-123"                     // 用户标识
}

Response:
{
  "result": "success"
}
```

## 技术实现方案

### 1. DifyProvider 实现

```typescript
// backend/src/services/providers/DifyProvider.ts

import { AIProvider } from '../ChatProxyService';
import { AgentConfig, ChatMessage, ChatOptions, ChatResponse, RequestHeaders } from '@/types';
import { generateId, generateTimestamp } from '@/utils/id';

export interface DifyRequest {
  inputs?: Record<string, any>;
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user: string;
  files?: Array<{
    type: 'image' | 'file';
    transfer_method: 'remote_url' | 'local_file';
    url?: string;
    upload_file_id?: string;
  }>;
}

export interface DifyResponse {
  message_id: string;
  conversation_id: string;
  mode: 'chat';
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    retriever_resources: any[];
  };
  created_at: number;
}

export interface DifyStreamEvent {
  event: 'message' | 'message_end' | 'message_file' | 'error' | 'ping';
  message_id?: string;
  conversation_id?: string;
  answer?: string;
  metadata?: any;
  status?: number;
  message?: string;
}

/**
 * Dify 提供商适配器
 * 
 * 功能对齐:
 * - ✅ 聊天消息发送(流式/非流式)
 * - ✅ 会话管理(conversation_id)
 * - ✅ 输入变量支持(inputs)
 * - ✅ 文件上传支持
 * - ✅ 消息反馈(点赞/点踩)
 * - ✅ 历史记录查询
 */
export class DifyProvider implements AIProvider {
  name = 'Dify';

  /**
   * 转换请求格式
   * 将统一的 ChatMessage[] 转换为 Dify API 格式
   */
  transformRequest(
    messages: ChatMessage[],
    config: AgentConfig,
    stream: boolean = false,
    options?: ChatOptions
  ): DifyRequest {
    // 提取最后一条用户消息作为 query
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) {
      throw new Error('至少需要一条用户消息');
    }

    // 构建基础请求
    const request: DifyRequest = {
      query: lastUserMessage.content,
      response_mode: stream ? 'streaming' : 'blocking',
      user: options?.userId || 'default-user',
    };

    // 会话ID
    if (options?.chatId) {
      request.conversation_id = options.chatId;
    }

    // 输入变量(Dify 特有)
    if (options?.variables) {
      request.inputs = options.variables;
    }

    // 文件支持
    if (options?.files && options.files.length > 0) {
      request.files = options.files.map(file => ({
        type: file.type || 'file',
        transfer_method: 'remote_url',
        url: file.url
      }));
    }

    console.log('Dify 请求数据:', JSON.stringify(request, null, 2));
    return request;
  }

  /**
   * 转换非流式响应
   */
  transformResponse(response: DifyResponse): ChatResponse {
    return {
      id: response.message_id || generateId(),
      object: 'chat.completion',
      created: response.created_at || generateTimestamp(),
      model: 'dify',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.answer || '',
        },
        finish_reason: 'stop',
      }],
      usage: response.metadata?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      // 保留 Dify 特有的元数据
      metadata: {
        conversation_id: response.conversation_id,
        retriever_resources: response.metadata?.retriever_resources || []
      }
    };
  }

  /**
   * 转换流式响应片段
   */
  transformStreamResponse(chunk: DifyStreamEvent): string {
    // Dify 流式响应: event: message, data: {"answer": "..."}
    if (chunk.event === 'message' && chunk.answer) {
      return chunk.answer;
    }
    return '';
  }

  /**
   * 构建请求头
   */
  buildHeaders(config: AgentConfig): RequestHeaders {
    return {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 获取聊天端点
   */
  getChatEndpoint(config: AgentConfig): string {
    const baseUrl = config.endpoint.replace(/\/$/, '');
    return `${baseUrl}/v1/chat-messages`;
  }

  /**
   * 获取反馈端点
   */
  getFeedbackEndpoint(config: AgentConfig, messageId: string): string {
    const baseUrl = config.endpoint.replace(/\/$/, '');
    return `${baseUrl}/v1/messages/${messageId}/feedbacks`;
  }

  /**
   * 获取历史记录端点
   */
  getHistoryEndpoint(config: AgentConfig, conversationId?: string): string {
    const baseUrl = config.endpoint.replace(/\/$/, '');
    if (conversationId) {
      return `${baseUrl}/v1/conversations/${conversationId}/messages`;
    }
    return `${baseUrl}/v1/conversations`;
  }

  /**
   * 解析 SSE 事件
   */
  parseSSEEvent(rawData: string): DifyStreamEvent | null {
    try {
      // Dify SSE 格式: event: xxx\ndata: {...}
      const lines = rawData.split('\n');
      let event = 'message';
      let data = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.substring(6).trim();
        } else if (line.startsWith('data:')) {
          data = line.substring(5).trim();
        }
      }

      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        event: event as any,
        ...parsed
      };
    } catch (error) {
      console.warn('解析 Dify SSE 事件失败:', error);
      return null;
    }
  }

  /**
   * 转换为统一的流式状态事件
   */
  transformStreamStatus(event: DifyStreamEvent): {
    type: 'chunk' | 'complete' | 'error' | 'metadata';
    data: any;
  } | null {
    switch (event.event) {
      case 'message':
        return {
          type: 'chunk',
          data: { text: event.answer || '' }
        };
      
      case 'message_end':
        return {
          type: 'complete',
          data: {
            message_id: event.message_id,
            conversation_id: event.conversation_id,
            metadata: event.metadata
          }
        };
      
      case 'error':
        return {
          type: 'error',
          data: {
            status: event.status,
            message: event.message
          }
        };
      
      case 'message_file':
        return {
          type: 'metadata',
          data: event
        };
      
      case 'ping':
        // 心跳事件,不需要处理
        return null;
      
      default:
        return null;
    }
  }
}
```

### 2. Dify Session Service 实现

```typescript
// backend/src/services/DifySessionService.ts

import axios, { AxiosInstance } from 'axios';
import { AgentConfig } from '@/types';
import logger from '@/utils/logger';

export interface DifyConversation {
  id: string;
  name: string;
  inputs: Record<string, any>;
  status: string;
  created_at: number;
}

export interface DifyMessage {
  id: string;
  conversation_id: string;
  inputs: Record<string, any>;
  query: string;
  answer: string;
  created_at: number;
  feedback?: {
    rating: 'like' | 'dislike' | null;
  };
}

/**
 * Dify 会话管理服务
 * 
 * 功能:
 * - 会话列表查询
 * - 会话消息查询
 * - 会话删除
 * - 消息反馈
 */
export class DifySessionService {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 获取会话列表
   */
  async getConversations(
    agent: AgentConfig,
    options?: {
      limit?: number;
      user?: string;
    }
  ): Promise<DifyConversation[]> {
    try {
      const baseUrl = agent.endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/v1/conversations`;

      const response = await this.httpClient.get(url, {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`
        },
        params: {
          user: options?.user || 'default-user',
          limit: options?.limit || 20
        }
      });

      logger.info('Dify 会话列表查询成功', {
        agentId: agent.id,
        count: response.data.data?.length || 0
      });

      return response.data.data || [];
    } catch (error: any) {
      logger.error('Dify 会话列表查询失败', {
        agentId: agent.id,
        error: error.message
      });
      throw new Error(`获取会话列表失败: ${error.message}`);
    }
  }

  /**
   * 获取会话消息
   */
  async getConversationMessages(
    agent: AgentConfig,
    conversationId: string,
    options?: {
      limit?: number;
      user?: string;
    }
  ): Promise<DifyMessage[]> {
    try {
      const baseUrl = agent.endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/v1/messages`;

      const response = await this.httpClient.get(url, {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`
        },
        params: {
          conversation_id: conversationId,
          user: options?.user || 'default-user',
          limit: options?.limit || 20
        }
      });

      logger.info('Dify 会话消息查询成功', {
        agentId: agent.id,
        conversationId,
        count: response.data.data?.length || 0
      });

      return response.data.data || [];
    } catch (error: any) {
      logger.error('Dify 会话消息查询失败', {
        agentId: agent.id,
        conversationId,
        error: error.message
      });
      throw new Error(`获取会话消息失败: ${error.message}`);
    }
  }

  /**
   * 删除会话
   */
  async deleteConversation(
    agent: AgentConfig,
    conversationId: string,
    user?: string
  ): Promise<void> {
    try {
      const baseUrl = agent.endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/v1/conversations/${conversationId}`;

      await this.httpClient.delete(url, {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`
        },
        params: {
          user: user || 'default-user'
        }
      });

      logger.info('Dify 会话删除成功', {
        agentId: agent.id,
        conversationId
      });
    } catch (error: any) {
      logger.error('Dify 会话删除失败', {
        agentId: agent.id,
        conversationId,
        error: error.message
      });
      throw new Error(`删除会话失败: ${error.message}`);
    }
  }

  /**
   * 提交消息反馈
   */
  async submitFeedback(
    agent: AgentConfig,
    messageId: string,
    rating: 'like' | 'dislike' | null,
    user?: string
  ): Promise<void> {
    try {
      const baseUrl = agent.endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/v1/messages/${messageId}/feedbacks`;

      await this.httpClient.post(
        url,
        {
          rating,
          user: user || 'default-user'
        },
        {
          headers: {
            'Authorization': `Bearer ${agent.apiKey}`
          }
        }
      );

      logger.info('Dify 消息反馈提交成功', {
        agentId: agent.id,
        messageId,
        rating
      });
    } catch (error: any) {
      logger.error('Dify 消息反馈提交失败', {
        agentId: agent.id,
        messageId,
        rating,
        error: error.message
      });
      throw new Error(`提交反馈失败: ${error.message}`);
    }
  }

  /**
   * 获取消息详情
   */
  async getMessageDetail(
    agent: AgentConfig,
    messageId: string,
    user?: string
  ): Promise<DifyMessage> {
    try {
      const baseUrl = agent.endpoint.replace(/\/$/, '');
      const url = `${baseUrl}/v1/messages/${messageId}`;

      const response = await this.httpClient.get(url, {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`
        },
        params: {
          user: user || 'default-user'
        }
      });

      logger.info('Dify 消息详情查询成功', {
        agentId: agent.id,
        messageId
      });

      return response.data;
    } catch (error: any) {
      logger.error('Dify 消息详情查询失败', {
        agentId: agent.id,
        messageId,
        error: error.message
      });
      throw new Error(`获取消息详情失败: ${error.message}`);
    }
  }
}
```

### 3. ChatProxyService 集成

```typescript
// backend/src/services/ChatProxyService.ts (修改)

import { DifyProvider } from './providers/DifyProvider';

export class ChatProxyService {
  constructor(agentService: AgentConfigService) {
    // ... 现有代码

    // 注册 Dify 提供商
    this.registerProvider(new DifyProvider());
  }

  /**
   * 处理 Dify 流式响应
   */
  private async handleDifyStream(
    stream: any,
    provider: DifyProvider,
    onChunk: (chunk: string) => void,
    onStatus?: (status: StreamStatus) => void,
    onEvent?: (eventName: string, data: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = '';

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');

        // 按双换行符分割事件块
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!block.trim()) continue;

          const event = provider.parseSSEEvent(block);
          if (!event) continue;

          const status = provider.transformStreamStatus(event);
          if (!status) continue;

          switch (status.type) {
            case 'chunk':
              onChunk(status.data.text);
              break;

            case 'complete':
              onStatus?.({ type: 'complete', status: 'completed' });
              onEvent?.('dify:message_end', status.data);
              resolve();
              break;

            case 'error':
              reject(new Error(status.data.message));
              break;

            case 'metadata':
              onEvent?.('dify:metadata', status.data);
              break;
          }
        }
      });

      stream.on('end', () => {
        if (buffer.trim()) {
          const event = provider.parseSSEEvent(buffer);
          if (event) {
            const status = provider.transformStreamStatus(event);
            if (status?.type === 'complete') {
              resolve();
            }
          }
        }
        resolve();
      });

      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }
}
```

### 4. 配置示例

```jsonc
// config/agents.json

{
  "agents": [
    {
      "id": "dify-assistant",
      "appId": "dify-app-123",  // Dify 应用ID(可选)
      "name": "Dify 智能助手",
      "description": "基于 Dify 平台的智能助手",
      "provider": "dify",
      "endpoint": "https://api.dify.ai",  // 或私有部署地址
      "apiKey": "app-xxx",  // Dify API Key
      "model": "gpt-4",  // 显示用,实际模型在 Dify 应用中配置
      "maxTokens": 4096,
      "temperature": 0.7,
      "systemPrompt": "",  // Dify 中已配置提示词,此处可留空
      "capabilities": ["chat", "file-upload", "knowledge-base"],
      "rateLimit": {
        "requestsPerMinute": 60,
        "tokensPerMinute": 100000
      },
      "isActive": true,
      "features": {
        "supportsChatId": true,
        "supportsStream": true,
        "supportsDetail": false,  // Dify 没有 detail 模式
        "supportsFiles": true,
        "supportsImages": true,
        "streamingConfig": {
          "enabled": true,
          "endpoint": "same",
          "statusEvents": true,
          "flowNodeStatus": false  // Dify 不支持工作流节点状态
        }
      },
      "metadata": {
        "difyVersion": "0.6.0",
        "deploymentType": "cloud"  // "cloud" | "self-hosted"
      },
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## 功能对齐表

### 核心功能对比

| 功能 | FastGPT | Dify | 对齐状态 |
|------|---------|------|----------|
| **聊天消息** | ✅ | ✅ | ✅ 完全对齐 |
| **流式响应** | ✅ | ✅ | ✅ 完全对齐 |
| **会话管理** | ✅ chatId | ✅ conversation_id | ✅ 完全对齐 |
| **历史记录** | ✅ | ✅ | ✅ 完全对齐 |
| **消息反馈** | ✅ | ✅ | ✅ 完全对齐 |
| **输入变量** | ✅ variables | ✅ inputs | ✅ 完全对齐 |
| **文件上传** | ✅ | ✅ | ✅ 完全对齐 |
| **工作流状态** | ✅ | ❌ | ⚠️ FastGPT 独有 |
| **知识库检索** | ✅ | ✅ | ✅ 完全对齐 |
| **工具调用** | ✅ | ✅ | ✅ 完全对齐 |

### API 接口对比

| 接口 | FastGPT | Dify |
|------|---------|------|
| 聊天消息 | `POST /api/v1/chat/completions` | `POST /v1/chat-messages` |
| 历史列表 | `GET /api/core/chat/getHistoryList` | `GET /v1/conversations` |
| 历史详情 | `GET /api/core/chat/getHistory` | `GET /v1/messages` |
| 删除会话 | `DELETE /api/core/chat/delHistory` | `DELETE /v1/conversations/:id` |
| 消息反馈 | `POST /api/core/chat/feedback/updateUserFeedback` | `POST /v1/messages/:id/feedbacks` |

## 测试用例

### 1. Dify Provider 单元测试

```typescript
// backend/src/__tests__/providers/DifyProvider.test.ts

import { DifyProvider } from '@/services/providers/DifyProvider';
import { ChatMessage, AgentConfig } from '@/types';

describe('DifyProvider', () => {
  let provider: DifyProvider;
  let mockAgent: AgentConfig;

  beforeEach(() => {
    provider = new DifyProvider();
    mockAgent = {
      id: 'dify-test',
      name: 'Dify Test',
      provider: 'dify',
      endpoint: 'https://api.dify.ai',
      apiKey: 'app-test-key',
      model: 'gpt-4',
      isActive: true,
      features: {
        supportsStream: true,
        streamingConfig: {
          enabled: true,
          endpoint: 'same',
          statusEvents: true
        }
      }
    } as AgentConfig;
  });

  describe('transformRequest', () => {
    it('应该正确转换非流式请求', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' }
      ];

      const request = provider.transformRequest(messages, mockAgent, false);

      expect(request).toEqual({
        query: '你好',
        response_mode: 'blocking',
        user: 'default-user'
      });
    });

    it('应该正确转换流式请求', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' }
      ];

      const request = provider.transformRequest(messages, mockAgent, true);

      expect(request.response_mode).toBe('streaming');
    });

    it('应该支持会话ID', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' }
      ];

      const request = provider.transformRequest(messages, mockAgent, false, {
        chatId: 'conv-123'
      });

      expect(request.conversation_id).toBe('conv-123');
    });

    it('应该支持输入变量', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '你好' }
      ];

      const request = provider.transformRequest(messages, mockAgent, false, {
        variables: { name: 'Alice', age: 25 }
      });

      expect(request.inputs).toEqual({ name: 'Alice', age: 25 });
    });

    it('应该支持文件上传', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '分析这个图片' }
      ];

      const request = provider.transformRequest(messages, mockAgent, false, {
        files: [
          { type: 'image', url: 'https://example.com/image.jpg' }
        ]
      });

      expect(request.files).toHaveLength(1);
      expect(request.files![0]).toEqual({
        type: 'image',
        transfer_method: 'remote_url',
        url: 'https://example.com/image.jpg'
      });
    });

    it('应该抛出错误当没有用户消息时', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是助手' }
      ];

      expect(() => {
        provider.transformRequest(messages, mockAgent, false);
      }).toThrow('至少需要一条用户消息');
    });
  });

  describe('transformResponse', () => {
    it('应该正确转换响应', () => {
      const difyResponse = {
        message_id: 'msg-123',
        conversation_id: 'conv-456',
        mode: 'chat' as const,
        answer: 'Hello!',
        metadata: {
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          },
          retriever_resources: []
        },
        created_at: 1609459200
      };

      const response = provider.transformResponse(difyResponse);

      expect(response.id).toBe('msg-123');
      expect(response.choices[0].message.content).toBe('Hello!');
      expect(response.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      });
      expect(response.metadata).toHaveProperty('conversation_id', 'conv-456');
    });
  });

  describe('transformStreamResponse', () => {
    it('应该提取消息内容', () => {
      const event = {
        event: 'message' as const,
        answer: 'Hello '
      };

      const text = provider.transformStreamResponse(event);
      expect(text).toBe('Hello ');
    });

    it('应该忽略非消息事件', () => {
      const event = {
        event: 'ping' as const
      };

      const text = provider.transformStreamResponse(event);
      expect(text).toBe('');
    });
  });

  describe('parseSSEEvent', () => {
    it('应该正确解析 SSE 事件', () => {
      const rawData = 'event: message\ndata: {"answer": "Hello"}';

      const event = provider.parseSSEEvent(rawData);

      expect(event).toEqual({
        event: 'message',
        answer: 'Hello'
      });
    });

    it('应该处理无效数据', () => {
      const rawData = 'invalid data';

      const event = provider.parseSSEEvent(rawData);

      expect(event).toBeNull();
    });
  });

  describe('transformStreamStatus', () => {
    it('应该转换消息事件', () => {
      const event = {
        event: 'message' as const,
        answer: 'Hello'
      };

      const status = provider.transformStreamStatus(event);

      expect(status).toEqual({
        type: 'chunk',
        data: { text: 'Hello' }
      });
    });

    it('应该转换结束事件', () => {
      const event = {
        event: 'message_end' as const,
        message_id: 'msg-123',
        conversation_id: 'conv-456',
        metadata: {}
      };

      const status = provider.transformStreamStatus(event);

      expect(status).toEqual({
        type: 'complete',
        data: {
          message_id: 'msg-123',
          conversation_id: 'conv-456',
          metadata: {}
        }
      });
    });

    it('应该转换错误事件', () => {
      const event = {
        event: 'error' as const,
        status: 500,
        message: 'Internal error'
      };

      const status = provider.transformStreamStatus(event);

      expect(status).toEqual({
        type: 'error',
        data: {
          status: 500,
          message: 'Internal error'
        }
      });
    });

    it('应该忽略心跳事件', () => {
      const event = {
        event: 'ping' as const
      };

      const status = provider.transformStreamStatus(event);

      expect(status).toBeNull();
    });
  });

  describe('buildHeaders', () => {
    it('应该构建正确的请求头', () => {
      const headers = provider.buildHeaders(mockAgent);

      expect(headers).toEqual({
        'Authorization': 'Bearer app-test-key',
        'Content-Type': 'application/json'
      });
    });
  });

  describe('getChatEndpoint', () => {
    it('应该返回正确的聊天端点', () => {
      const endpoint = provider.getChatEndpoint(mockAgent);
      expect(endpoint).toBe('https://api.dify.ai/v1/chat-messages');
    });

    it('应该处理带尾部斜杠的端点', () => {
      mockAgent.endpoint = 'https://api.dify.ai/';
      const endpoint = provider.getChatEndpoint(mockAgent);
      expect(endpoint).toBe('https://api.dify.ai/v1/chat-messages');
    });
  });
});
```

### 2. Dify Session Service 集成测试

```typescript
// backend/src/__tests__/services/DifySessionService.test.ts

import { DifySessionService } from '@/services/DifySessionService';
import { AgentConfig } from '@/types';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DifySessionService', () => {
  let service: DifySessionService;
  let mockAgent: AgentConfig;

  beforeEach(() => {
    service = new DifySessionService();
    mockAgent = {
      id: 'dify-test',
      name: 'Dify Test',
      provider: 'dify',
      endpoint: 'https://api.dify.ai',
      apiKey: 'app-test-key',
      model: 'gpt-4',
      isActive: true
    } as AgentConfig;

    // Mock axios.create
    mockedAxios.create.mockReturnValue(mockedAxios as any);
  });

  describe('getConversations', () => {
    it('应该成功获取会话列表', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          name: '对话1',
          inputs: {},
          status: 'normal',
          created_at: 1609459200
        }
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: { data: mockConversations }
      });

      const conversations = await service.getConversations(mockAgent);

      expect(conversations).toEqual(mockConversations);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.dify.ai/v1/conversations',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer app-test-key'
          }
        })
      );
    });

    it('应该处理错误', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getConversations(mockAgent)).rejects.toThrow(
        '获取会话列表失败'
      );
    });
  });

  describe('submitFeedback', () => {
    it('应该成功提交点赞反馈', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { result: 'success' }
      });

      await service.submitFeedback(mockAgent, 'msg-123', 'like');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.dify.ai/v1/messages/msg-123/feedbacks',
        { rating: 'like', user: 'default-user' },
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer app-test-key'
          }
        })
      );
    });
  });
});
```

### 3. 端到端测试

```typescript
// tests/e2e/dify-integration.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Dify 智能体集成', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('应该能够选择 Dify 智能体', async ({ page }) => {
    // 点击智能体选择器
    await page.click('[data-testid="agent-selector"]');

    // 选择 Dify 智能体
    await page.click('text=Dify 智能助手');

    // 验证已选中
    await expect(page.locator('[data-testid="current-agent"]')).toContainText(
      'Dify 智能助手'
    );
  });

  test('应该能够发送消息并接收回复', async ({ page }) => {
    // 选择 Dify 智能体
    await page.click('[data-testid="agent-selector"]');
    await page.click('text=Dify 智能助手');

    // 输入消息
    await page.fill('[data-testid="message-input"]', '你好');
    await page.click('[data-testid="send-button"]');

    // 等待回复
    await expect(page.locator('[data-testid="message-list"]')).toContainText(
      '你好',
      { timeout: 10000 }
    );

    // 验证有 AI 回复
    await expect(page.locator('[data-role="assistant"]')).toBeVisible();
  });

  test('应该支持流式响应', async ({ page }) => {
    // 启用流式模式
    await page.click('[data-testid="settings"]');
    await page.click('[data-testid="enable-streaming"]');

    // 选择 Dify 智能体并发送消息
    await page.click('[data-testid="agent-selector"]');
    await page.click('text=Dify 智能助手');
    await page.fill('[data-testid="message-input"]', '讲个故事');
    await page.click('[data-testid="send-button"]');

    // 验证流式输出(内容逐步增加)
    const messageElement = page.locator('[data-role="assistant"]').last();
    await messageElement.waitFor({ state: 'visible' });

    // 记录初始长度
    const initialLength = (await messageElement.textContent())?.length || 0;

    // 等待一段时间后验证内容增加
    await page.waitForTimeout(1000);
    const finalLength = (await messageElement.textContent())?.length || 0;

    expect(finalLength).toBeGreaterThan(initialLength);
  });

  test('应该能够点赞消息', async ({ page }) => {
    // 发送消息并等待回复
    await page.click('[data-testid="agent-selector"]');
    await page.click('text=Dify 智能助手');
    await page.fill('[data-testid="message-input"]', '测试');
    await page.click('[data-testid="send-button"]');

    await page.locator('[data-role="assistant"]').waitFor();

    // 点赞
    await page.click('[data-testid="like-button"]');

    // 验证点赞状态
    await expect(page.locator('[data-testid="like-button"]')).toHaveClass(
      /liked/
    );
  });

  test('应该能够查看会话历史', async ({ page }) => {
    // 点击侧边栏
    await page.click('[data-testid="sidebar-toggle"]');

    // 验证会话列表可见
    await expect(page.locator('[data-testid="session-list"]')).toBeVisible();

    // 点击某个历史会话
    await page.click('[data-testid="session-item"]');

    // 验证消息加载
    await expect(page.locator('[data-testid="message-list"]')).not.toBeEmpty();
  });
});
```

## 部署检查清单

### 开发环境
- [ ] 安装 Dify(云服务或私有部署)
- [ ] 创建 Dify 应用并获取 API Key
- [ ] 配置 `config/agents.json`,添加 Dify 智能体
- [ ] 启动后端服务,验证 Dify Provider 加载成功
- [ ] 前端选择 Dify 智能体,测试聊天功能
- [ ] 测试流式响应
- [ ] 测试会话历史
- [ ] 测试消息反馈

### 测试覆盖
- [ ] DifyProvider 单元测试 >80%
- [ ] DifySessionService 单元测试 >80%
- [ ] ChatProxyService Dify 集成测试
- [ ] 端到端测试覆盖核心流程
- [ ] 性能测试(并发请求)
- [ ] 异常场景测试(网络故障、超时等)

### 生产环境
- [ ] 配置生产环境 Dify 端点
- [ ] 使用环境变量管理 API Key
- [ ] 配置日志采集和监控
- [ ] 配置熔断和降级策略
- [ ] 压测验证性能
- [ ] 灰度发布验证
- [ ] 文档更新

## 性能优化建议

### 1. 请求缓存
```typescript
// 对于相同的输入,缓存响应结果
const cacheKey = `dify:${conversationId}:${hash(query)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... 调用 API ...

await redis.setex(cacheKey, 300, JSON.stringify(response));
```

### 2. 连接池
```typescript
// 使用 axios 连接池优化
const httpClient = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});
```

### 3. 批量请求
```typescript
// 批量获取会话历史
async getBatchConversations(
  agent: AgentConfig,
  conversationIds: string[]
): Promise<Map<string, DifyMessage[]>> {
  const results = await Promise.allSettled(
    conversationIds.map(id => this.getConversationMessages(agent, id))
  );
  
  return new Map(
    results.map((result, index) => [
      conversationIds[index],
      result.status === 'fulfilled' ? result.value : []
    ])
  );
}
```

## 故障排查指南

### 1. API 调用失败
```
错误: Request failed with status code 401
原因: API Key 无效或过期
解决: 
1. 检查 config/agents.json 中的 apiKey
2. 登录 Dify 平台重新生成 API Key
3. 确认 API Key 格式正确(app-xxx)
```

### 2. 流式响应中断
```
错误: Stream ended unexpectedly
原因: 网络不稳定或服务器超时
解决:
1. 检查网络连接
2. 增加请求超时时间
3. 实现自动重试机制
4. 检查 Dify 服务状态
```

### 3. 会话ID不匹配
```
错误: Conversation not found
原因: conversation_id 无效或已删除
解决:
1. 验证 conversation_id 格式
2. 检查会话是否已被删除
3. 创建新会话重试
```

---

**文档状态**: 设计完成 - 待实施  
**创建时间**: 2025-10-02  
**创建人**: AI 架构师  
**最后更新**: 2025-10-02  
**版本**: v1.0

**相关文档**:
- [DESIGN_全局审计.md](./DESIGN_全局审计.md)
- [CONSENSUS_全局审计.md](./CONSENSUS_全局审计.md)
- [FastGPT 集成文档](../fastgpt.md)


