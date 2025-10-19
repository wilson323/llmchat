# API 类型设计指南

## 📋 概述

本指南定义了 LLMChat 前端项目中 API 类型设计的原则、模式和最佳实践。通过统一的类型设计，确保前后端接口的一致性、类型安全和开发效率。

## 🎯 设计原则

### 1. 类型驱动开发
优先设计类型定义，然后实现功能逻辑。类型即文档，类型即契约。

```typescript
// ✅ 正确 - 先定义接口类型
interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  preferences?: UserPreferences;
}

interface CreateUserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

// 然后实现 API 函数
const createUser = async (
  request: CreateUserRequest
): Promise<CreateUserResponse> => {
  // 实现...
};
```

### 2. 渐进式类型增强
从基础类型开始，逐步增强类型安全性。

```typescript
// 阶段 1: 基础类型
interface User {
  id: string;
  name: string;
  email: string;
}

// 阶段 2: 增强类型
interface User {
  id: string;
  name: string;
  email: string;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// 阶段 3: 完整类型
interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly preferences?: Readonly<UserPreferences>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### 3. 前后端类型一致性
确保前端类型定义与后端 API 契约保持一致。

```typescript
// shared-types/index.ts - 共享类型定义
export interface User {
  id: string;
  name: string;
  email: string;
  preferences: UserPreferences;
  createdAt: string; // ISO 8601 字符串
  updatedAt: string; // ISO 8601 字符串
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  language: string;
}

// 前端适配层
export interface FrontendUser extends Omit<User, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

export const toFrontendUser = (user: User): FrontendUser => ({
  ...user,
  createdAt: new Date(user.createdAt),
  updatedAt: new Date(user.updatedAt),
});
```

## 📝 基础类型定义

### 1. HTTP 相关类型

```typescript
// HTTP 方法类型
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// HTTP 状态码类型
export type HttpSuccessCode = 200 | 201 | 202 | 204;
export type HttpErrorCode = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 | 503;
export type HttpStatusCode = HttpSuccessCode | HttpErrorCode;

// HTTP 头部类型
export interface HttpHeaders {
  'Content-Type'?: string;
  'Authorization'?: string;
  'Accept'?: string;
  'X-Request-ID'?: string;
  [key: string]: string | undefined;
}

// 请求配置
export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers?: HttpHeaders;
  params?: Record<string, string | number>;
  data?: unknown;
  timeout?: number;
  retries?: number;
}
```

### 2. API 响应类型

```typescript
// 基础 API 响应
export interface ApiResponse<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: ApiError;
  meta?: ResponseMeta;
}

// 成功响应
export interface SuccessResponse<TData> {
  success: true;
  data: TData;
  meta?: ResponseMeta;
}

// 错误响应
export interface ErrorResponse {
  success: false;
  error: ApiError;
}

// API 错误
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

// 响应元数据
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
  pagination?: PaginationMeta;
}

// 分页元数据
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 分页响应
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: PaginationMeta;
  };
}
```

### 3. 实体类型

```typescript
// 用户实体
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar?: string;
  readonly preferences: UserPreferences;
  readonly status: UserStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// 用户状态
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

// 用户偏好设置
export interface UserPreferences {
  readonly theme: ThemeMode;
  readonly notifications: NotificationSettings;
  readonly language: string;
  readonly timezone: string;
}

// 主题模式
export type ThemeMode = 'light' | 'dark' | 'auto';

// 通知设置
export interface NotificationSettings {
  readonly email: boolean;
  readonly push: boolean;
  readonly inApp: boolean;
  readonly types: NotificationType[];
}

// 通知类型
export type NotificationType = 'message' | 'mention' | 'system' | 'security';

// 会话实体
export interface Session {
  readonly id: string;
  readonly title: string;
  readonly agentId: string;
  readonly userId?: string;
  readonly messages: Message[];
  readonly status: SessionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// 会话状态
export type SessionStatus = 'active' | 'archived' | 'deleted';

// 消息实体
export interface Message {
  readonly id: string;
  readonly sessionId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly metadata?: MessageMetadata;
  readonly timestamp: number;
}

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system';

// 消息元数据
export interface MessageMetadata {
  readonly wordCount?: number;
  readonly tokenCount?: number;
  readonly model?: string;
  readonly temperature?: number;
  readonly hasCode?: boolean;
  readonly hasLinks?: boolean;
}

// 智能体实体
export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly provider: AgentProvider;
  readonly model: string;
  readonly capabilities: AgentCapability[];
  readonly config: AgentConfig;
  readonly status: AgentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// 智能体提供商
export type AgentProvider = 'openai' | 'anthropic' | 'fastgpt' | 'dify' | 'custom';

// 智能体能力
export type AgentCapability = 'text' | 'image' | 'code' | 'reasoning' | 'multimodal';

// 智能体配置
export interface AgentConfig {
  readonly temperature: number;
  readonly maxTokens: number;
  readonly systemPrompt?: string;
  readonly tools?: ToolConfig[];
}

// 工具配置
export interface ToolConfig {
  readonly name: string;
  readonly type: 'function' | 'api';
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

// 智能体状态
export type AgentStatus = 'online' | 'offline' | 'maintenance' | 'error';
```

## 🔧 API 客户端设计

### 1. 类型安全的 API 客户端

```typescript
// api/ApiClient.ts
import { z } from 'zod';

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HttpHeaders;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 通用请求方法
   */
  private async request<TData, TResponse>(
    config: RequestConfig,
    responseSchema: z.ZodSchema<TResponse>
  ): Promise<TResponse> {
    const url = new URL(config.url, this.baseUrl);

    // 添加查询参数
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const requestInit: RequestInit = {
      method: config.method,
      headers: { ...this.defaultHeaders, ...config.headers },
      body: config.data ? JSON.stringify(config.data) : undefined,
    };

    try {
      const response = await fetch(url.toString(), requestInit);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.code || 'HTTP_ERROR',
          errorData.message || `HTTP ${response.status}`,
          response.status
        );
      }

      const rawData = await response.json();

      // 使用 Zod 验证响应数据
      return responseSchema.parse(rawData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network error'
      );
    }
  }

  /**
   * GET 请求
   */
  async get<TData, TResponse>(
    url: string,
    params?: Record<string, string | number>,
    responseSchema: z.ZodSchema<TResponse>
  ): Promise<TResponse> {
    return this.request<TData, TResponse>(
      { method: 'GET', url, params },
      responseSchema
    );
  }

  /**
   * POST 请求
   */
  async post<TData, TResponse>(
    url: string,
    data: TData,
    responseSchema: z.ZodSchema<TResponse>
  ): Promise<TResponse> {
    return this.request<TData, TResponse>(
      { method: 'POST', url, data },
      responseSchema
    );
  }

  /**
   * PUT 请求
   */
  async put<TData, TResponse>(
    url: string,
    data: TData,
    responseSchema: z.ZodSchema<TResponse>
  ): Promise<TResponse> {
    return this.request<TData, TResponse>(
      { method: 'PUT', url, data },
      responseSchema
    );
  }

  /**
   * DELETE 请求
   */
  async delete<TResponse>(
    url: string,
    responseSchema: z.ZodSchema<TResponse>
  ): Promise<TResponse> {
    return this.request<undefined, TResponse>(
      { method: 'DELETE', url },
      responseSchema
    );
  }
}

// API 错误类
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### 2. API 服务定义

```typescript
// api/UserService.ts
import { z } from 'zod';
import { ApiClient } from './ApiClient';
import { User, UserPreferences, CreateUserRequest, UpdateUserRequest } from '../types';

// 请求 Schema
const CreateUserRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      inApp: z.boolean(),
      types: z.array(z.enum(['message', 'mention', 'system', 'security']))
    }),
    language: z.string().length(2),
    timezone: z.string()
  }).optional()
});

const UpdateUserRequestSchema = CreateUserRequestSchema.partial().extend({
  id: z.string().uuid()
});

// 响应 Schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  avatar: z.string().url().optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      inApp: z.boolean(),
      types: z.array(z.enum(['message', 'mention', 'system', 'security']))
    }),
    language: z.string(),
    timezone: z.string()
  }),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  createdAt: z.string(),
  updatedAt: z.string()
});

const UsersListSchema = z.array(UserSchema);

const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string()
  }).optional(),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string(),
    version: z.string(),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    }).optional()
  }).optional()
});

const UserResponseSchema = ApiResponseSchema.extend({
  data: UserSchema
});

const UsersListResponseSchema = ApiResponseSchema.extend({
  data: UsersListSchema
});

// 类型推断
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UsersListResponse = z.infer<typeof UsersListResponseSchema>;

// 用户服务
export class UserService {
  constructor(private apiClient: ApiClient) {}

  /**
   * 获取用户列表
   */
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<UsersListResponse> {
    return this.apiClient.get(
      '/users',
      params,
      UsersListResponseSchema
    );
  }

  /**
   * 获取单个用户
   */
  async getUser(id: string): Promise<UserResponse> {
    return this.apiClient.get(
      `/users/${id}`,
      undefined,
      UserResponseSchema
    );
  }

  /**
   * 创建用户
   */
  async createUser(request: CreateUserRequest): Promise<UserResponse> {
    CreateUserRequestSchema.parse(request); // 验证请求数据

    return this.apiClient.post(
      '/users',
      request,
      UserResponseSchema
    );
  }

  /**
   * 更新用户
   */
  async updateUser(request: UpdateUserRequest): Promise<UserResponse> {
    UpdateUserRequestSchema.parse(request); // 验证请求数据

    const { id, ...data } = request;
    return this.apiClient.put(
      `/users/${id}`,
      data,
      UserResponseSchema
    );
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.apiClient.delete(
      `/users/${id}`,
      z.object({ success: z.boolean() })
    );
  }

  /**
   * 更新用户偏好设置
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserResponse> {
    return this.apiClient.put(
      `/users/${userId}/preferences`,
      preferences,
      UserResponseSchema
    );
  }
}
```

## 🔄 数据转换与适配

### 1. 前后端数据转换

```typescript
// utils/dataTransform.ts
import { User as ApiUser, UserPreferences as ApiPreferences } from '../types/api';
import { User as FrontendUser, UserPreferences as FrontendPreferences } from '../types/frontend';

/**
 * API 用户数据转换为前端用户数据
 */
export const transformApiUserToFrontend = (
  apiUser: ApiUser
): FrontendUser => ({
  ...apiUser,
  createdAt: new Date(apiUser.createdAt),
  updatedAt: new Date(apiUser.updatedAt),
  preferences: transformApiPreferencesToFrontend(apiUser.preferences),
});

/**
 * API 用户偏好转换为前端用户偏好
 */
export const transformApiPreferencesToFrontend = (
  apiPreferences: ApiPreferences
): FrontendPreferences => ({
  ...apiPreferences,
  notificationSettings: {
    email: apiPreferences.notifications.email,
    push: apiPreferences.notifications.push,
    inApp: apiPreferences.notifications.inApp,
    types: new Set(apiPreferences.notifications.types),
  },
});

/**
 * 前端用户数据转换为 API 用户数据
 */
export const transformFrontendUserToApi = (
  frontendUser: Partial<FrontendUser>
): Partial<ApiUser> => {
  const { preferences, ...rest } = frontendUser;

  return {
    ...rest,
    ...(preferences && {
      preferences: transformFrontendPreferencesToApi(preferences),
    }),
    ...(frontendUser.createdAt && {
      createdAt: frontendUser.createdAt.toISOString(),
    }),
    ...(frontendUser.updatedAt && {
      updatedAt: frontendUser.updatedAt.toISOString(),
    }),
  };
};

/**
 * 前端用户偏好转换为 API 用户偏好
 */
export const transformFrontendPreferencesToApi = (
  frontendPreferences: FrontendPreferences
): ApiPreferences => ({
  ...frontendPreferences,
  notifications: {
    email: frontendPreferences.notificationSettings.email,
    push: frontendPreferences.notificationSettings.push,
    inApp: frontendPreferences.notificationSettings.inApp,
    types: Array.from(frontendPreferences.notificationSettings.types),
  },
});
```

### 2. 适配器模式

```typescript
// adapters/SessionAdapter.ts
import { Session as ApiSession, Message as ApiMessage } from '../types/api';
import { Session as UISession, Message as UIMessage } from '../types/ui';

/**
 * 会话适配器 - 将 API 数据转换为 UI 组件所需格式
 */
export class SessionAdapter {
  /**
   * 将 API 会话转换为 UI 会话
   */
  static toUISession(apiSession: ApiSession): UISession {
    return {
      id: apiSession.id,
      title: apiSession.title,
      agentId: apiSession.agentId,
      userId: apiSession.userId,
      messages: apiSession.messages.map(SessionAdapter.toUIMessage),
      status: this.mapApiStatusToUIStatus(apiSession.status),
      createdAt: new Date(apiSession.createdAt),
      updatedAt: new Date(apiSession.updatedAt),
      lastActivity: this.calculateLastActivity(apiSession.messages),
      messageCount: apiSession.messages.length,
      unreadCount: this.calculateUnreadCount(apiSession.messages),
    };
  }

  /**
   * 将 API 消息转换为 UI 消息
   */
  static toUIMessage(apiMessage: ApiMessage): UIMessage {
    return {
      id: apiMessage.id,
      sessionId: apiMessage.sessionId,
      role: apiMessage.role,
      content: apiMessage.content,
      timestamp: new Date(apiMessage.timestamp),
      status: 'delivered', // UI 特有状态
      metadata: {
        ...apiMessage.metadata,
        isStreaming: false, // UI 特有状态
        reactions: [], // UI 特有状态
      },
    };
  }

  /**
   * 映射 API 状态到 UI 状态
   */
  private static mapApiStatusToUIStatus(apiStatus: string): UISession['status'] {
    switch (apiStatus) {
      case 'active':
        return 'active';
      case 'archived':
        return 'archived';
      case 'deleted':
        return 'deleted';
      default:
        return 'unknown';
    }
  }

  /**
   * 计算最后活动时间
   */
  private static calculateLastActivity(messages: ApiMessage[]): Date {
    if (messages.length === 0) {
      return new Date();
    }

    const lastMessage = messages[messages.length - 1];
    return new Date(lastMessage.timestamp);
  }

  /**
   * 计算未读消息数量
   */
  private static calculateUnreadCount(messages: ApiMessage[]): number {
    // 这里需要根据实际业务逻辑计算未读消息
    // 例如，基于用户最后阅读时间等
    return 0;
  }
}
```

## 📊 高级类型模式

### 1. 条件类型

```typescript
// 基于操作类型定义不同的请求/响应类型
type ApiOperation = 'create' | 'read' | 'update' | 'delete';

type ApiRequest<T extends ApiOperation> = T extends 'create'
  ? { data: unknown }
  : T extends 'update'
  ? { id: string; data: Partial<unknown> }
  : T extends 'read'
  ? { id?: string; params?: Record<string, unknown> }
  : T extends 'delete'
  ? { id: string }
  : never;

type ApiResponse<T extends ApiOperation> = T extends 'create' | 'read'
  ? { data: unknown }
  : T extends 'update'
  ? { data: Partial<unknown> }
  : T extends 'delete'
  ? { success: boolean }
  : never;

// 使用示例
type CreateUserRequest = ApiRequest<'create'>; // { data: unknown }
type UpdateUserRequest = ApiRequest<'update'>; // { id: string; data: Partial<unknown> }
type DeleteUserResponse = ApiResponse<'delete'>; // { success: boolean }
```

### 2. 映射类型

```typescript
// 创建可更新类型（所有属性变为可选）
type Updatable<T> = {
  [K in keyof T]?: T[K];
};

// 创建只读类型（所有属性变为只读）
type ReadOnly<T> = {
  readonly [K in keyof T]: T[K];
};

// 创建可选类型（所有属性变为可选）
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// 使用示例
type CreateUserRequest = {
  name: string;
  email: string;
  password: string;
};

type UpdateUserRequest = Updatable<CreateUserRequest>;
// 等价于:
// type UpdateUserRequest = {
//   name?: string;
//   email?: string;
//   password?: string;
// };
```

### 3. 模板字面量类型

```typescript
// 创建 API 路径类型
type ApiEndpoint = `/api/${string}`;

type UserEndpoint = `/api/users/${string}`;
type MessageEndpoint = `/api/messages/${string}`;
type SessionEndpoint = `/api/sessions/${string}`;

// 创建事件类型
type ApiEventType = `api:${'request' | 'response' | 'error'}`;
type UserEventType = `user:${'login' | 'logout' | 'update'}`;
type SessionEventType = `session:${'create' | 'update' | 'delete'}`;

// 使用示例
type ApiEvent = {
  type: ApiEventType;
  timestamp: number;
  data?: unknown;
};

const event: ApiEvent = {
  type: 'api:request',
  timestamp: Date.now(),
  data: { url: '/api/users' }
};
```

## 🧪 类型测试

### 1. 类型测试工具

```typescript
// 类型测试工具
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// API 响应类型测试
type TestApiResponse = Expect<Equal<
  ApiResponse<string>,
  {
    success: boolean;
    data?: string;
    error?: ApiError;
    meta?: ResponseMeta;
  }
>>;

// 分页响应类型测试
type TestPaginatedResponse = Expect<Equal<
  PaginatedResponse<User>,
  {
    success: boolean;
    data?: User[];
    error?: ApiError;
    meta: ResponseMeta & {
      pagination: PaginationMeta;
    };
  }
>>;
```

### 2. 运行时类型验证测试

```typescript
// api/UserService.test.ts
import { UserService } from '../UserService';
import { ApiClient } from '../ApiClient';
import { CreateUserRequestSchema, UserResponseSchema } from '../types/schemas';

describe('UserService', () => {
  let userService: UserService;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    mockApiClient = new ApiClient({ baseUrl: 'http://localhost:3000' }) as jest.Mocked<ApiClient>;
    userService = new UserService(mockApiClient);
  });

  describe('createUser', () => {
    it('should validate request data with schema', async () => {
      const invalidRequest = {
        name: '', // 无效：空字符串
        email: 'invalid-email', // 无效：格式错误
        password: '123', // 无效：太短
      };

      // Schema 验证应该失败
      expect(() => CreateUserRequestSchema.parse(invalidRequest)).toThrow();

      // 应该不会发送请求
      await expect(userService.createUser(invalidRequest as any)).rejects.toThrow();
    });

    it('should validate response data with schema', async () => {
      const validRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const invalidResponse = {
        success: true,
        data: {
          // 缺少必需字段
          name: 'John Doe',
        },
      };

      mockApiClient.post.mockResolvedValue(invalidResponse);

      // 响应验证应该失败
      await expect(userService.createUser(validRequest)).rejects.toThrow();
    });

    it('should handle valid request and response', async () => {
      const validRequest = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        preferences: {
          theme: 'light' as const,
          notifications: {
            email: true,
            push: false,
            inApp: true,
            types: ['message' as const],
          },
          language: 'en',
          timezone: 'UTC',
        },
      };

      const validResponse = {
        success: true,
        data: {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
          preferences: validRequest.preferences,
          status: 'active' as const,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      };

      mockApiClient.post.mockResolvedValue(validResponse);

      const result = await userService.createUser(validRequest);

      expect(result).toEqual(validResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/users',
        validRequest,
        UserResponseSchema
      );
    });
  });
});
```

## 📋 API 类型检查清单

### 设计阶段

- [ ] 所有 API 端点都有对应的类型定义
- [ ] 请求和响应类型准确反映 API 契约
- [ ] 使用 Zod Schema 进行运行时验证
- [ ] 考虑了分页、错误处理、元数据等通用模式
- [ ] 类型定义有完整的文档注释

### 开发阶段

- [ ] API 客户端实现类型安全
- [ ] 使用类型守卫验证外部数据
- [ ] 实现了适当的数据转换层
- [ ] 错误处理有明确的类型定义
- [ ] 添加了类型测试覆盖

### 集成阶段

- [ ] 前后端类型定义保持同步
- [ ] API 版本控制考虑类型兼容性
- [ ] 变更日志包含类型变更说明
- [ ] 开发工具有正确的类型提示
- [ ] 文档和示例代码类型正确

## 🚨 常见问题与解决方案

### 问题 1: 前后端类型不同步

**原因**: 前后端独立开发，类型定义不一致

**解决方案**:
```typescript
// 使用共享类型定义
// shared-types/index.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

// 前端项目引用共享类型
// package.json
{
  "dependencies": {
    "@project/shared-types": "file:../shared-types"
  }
}

// 使用时导入
import { User } from '@project/shared-types';
```

### 问题 2: 运行时类型不安全

**原因**: 只依赖 TypeScript 编译时检查，没有运行时验证

**解决方案**:
```typescript
// 使用 Zod 进行运行时验证
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

function processUser(data: unknown): User {
  return UserSchema.parse(data); // 运行时验证
}
```

### 问题 3: API 响应格式不一致

**原因**: 不同端点返回不同的响应格式

**解决方案**:
```typescript
// 标准化 API 响应格式
interface StandardApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ResponseMeta;
}

// 使用响应适配器统一处理
class ApiResponseAdapter {
  static adapt<T>(response: unknown, schema: z.ZodSchema<T>): StandardApiResponse<T> {
    return StandardApiResponseSchema.parse(response);
  }
}
```

## 📚 扩展阅读

- [Zod 文档](https://zod.dev/)
- [OpenAPI 规范](https://swagger.io/specification/)
- [JSON Schema](https://json-schema.org/)
- [TypeScript 高级类型](https://www.typescriptlang.org/docs/handbook/advanced-types.html)

---

本指南会随着项目发展持续更新。如有疑问或建议，请联系开发团队。

最后更新: 2025-10-18