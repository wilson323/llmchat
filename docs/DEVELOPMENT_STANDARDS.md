# LLMChat 企业级开发标准与规范

> **Spec-Kit合规企业级开发标准**
> **文档版本**: v1.0.0
> **最后更新**: 2025-10-18
> **合规状态**: ✅ Spec-Kit合规
> **适用范围**: 全体开发人员、项目管理者、质量保证团队

## 📋 目录

- [1. 概述](#1-概述)
- [2. 代码质量标准](#2-代码质量标准)
- [3. TypeScript开发规范](#3-typescript开发规范)
- [4. React开发规范](#4-react开发规范)
- [5. 后端开发规范](#5-后端开发规范)
- [6. 数据库开发规范](#6-数据库开发规范)
- [7. 测试开发规范](#7-测试开发规范)
- [8. 安全开发规范](#8-安全开发规范)
- [9. Git工作流规范](#9-git工作流规范)
- [10. 文档编写规范](#10-文档编写规范)
- [11. 性能开发规范](#11-性能开发规范)
- [12. 代码审查标准](#12-代码审查标准)
- [13. 违规处理机制](#13-违规处理机制)

## 1. 概述

### 1.1 目标与原则

**目标**:
- 确保代码质量和系统稳定性
- 提高开发效率和团队协作
- 降低维护成本和技术债务
- 建立可持续发展的技术体系

**核心原则**:
- **质量优先**: 代码质量优先于开发速度
- **标准统一**: 全团队遵循统一的开发标准
- **持续改进**: 基于实践持续优化标准
- **安全第一**: 安全是所有开发活动的基础
- **用户导向**: 以用户体验为最终目标

### 1.2 强制性要求

**零容忍政策**:
- ❌ **TypeScript编译错误**: 0个错误强制要求
- ❌ **安全漏洞**: 高危漏洞必须立即修复
- ❌ **测试失败**: 核心功能测试必须100%通过
- ❌ **代码质量**: 严重质量问题必须修复

---

## 1. TypeScript编码规范和类型定义标准

### 1.1 TypeScript配置规范

#### 前端配置 (frontend/tsconfig.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### 后端配置 (backend/tsconfig.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false
  }
}
```

### 1.2 类型定义规范

#### 1.2.1 禁止使用 `any` 类型

```typescript
// ❌ 错误：禁止使用any
function processData(data: any): any {
  return data;
}

// ✅ 正确：使用具体类型或unknown
function processData<T extends JsonValue>(data: T): T {
  return data;
}

// ✅ 正确：使用未知类型需要类型守卫
function processUnknownData(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }
  return null;
}
```

#### 1.2.2 接口定义规范

```typescript
// ✅ 正确：使用明确的类型定义
interface UserConfig {
  readonly id: string;
  name: string;
  email: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ✅ 正确：使用联合类型和字面量类型
type UserRole = 'admin' | 'user' | 'moderator';
type APIStatus = 'pending' | 'success' | 'error';

// ❌ 错误：可选属性不能设置为undefined
const config: UserConfig = {
  id: '123',
  name: 'John',
  email: 'john@example.com',
  preferences: undefined, // ❌ 不能设置为undefined
  createdAt: new Date(),
  updatedAt: new Date()
};

// ✅ 正确：省略可选属性
const config: UserConfig = {
  id: '123',
  name: 'John',
  email: 'john@example.com',
  createdAt: new Date(),
  updatedAt: new Date()
  // preferences 被省略，符合规范
};
```

#### 1.2.3 泛型使用规范

```typescript
// ✅ 正确：有意义的泛型约束
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: Omit<T, 'id'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
}

// ✅ 正确：使用类型守卫
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' &&
         obj !== null &&
         'id' in obj &&
         'name' in obj &&
         'email' in obj;
}
```

### 1.3 导入导出规范

#### 1.3.1 组件导入导出

```typescript
// ✅ 正确：组件使用default export
const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return <button {...props}>{children}</button>;
};

export default Button;

// ✅ 正确：工具函数使用named export
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
```

#### 1.3.2 导入语句规范

```typescript
// ✅ 正确：组件使用default import
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// ✅ 正确：工具函数使用named import
import { formatDate, validateEmail } from '@/utils/helpers';
import type { User, UserConfig } from '@/types/user';

// ✅ 正确：第三方库导入
import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { z } from 'zod';

// ❌ 错误：混合导入方式
import { Button } from '@/components/ui/Button'; // 如果Button是default export
```

### 1.4 错误处理规范

```typescript
// ✅ 正确：使用Result模式
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await userRepository.findById(id);
    if (!user) {
      return {
        success: false,
        error: new Error(`User with id ${id} not found`)
      };
    }
    return { success: true, data: user };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error')
    };
  }
}

// ✅ 正确：使用自定义错误类型
class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NetworkError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: Response
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

### 1.5 类型守卫和验证

```typescript
// ✅ 正确：完整的类型守卫
function isApiRequest(value: unknown): value is ApiRequest {
  return typeof value === 'object' &&
         value !== null &&
         'method' in value &&
         'url' in value &&
         typeof (value as any).method === 'string' &&
         typeof (value as any).url === 'string';
}

// ✅ 正确：使用zod进行运行时验证
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    language: z.string().optional()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

type User = z.infer<typeof UserSchema>;

function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}
```

---

## 2. 组件设计模式和可复用性原则

### 2.1 React组件设计原则

#### 2.1.1 单一职责原则

```typescript
// ✅ 正确：单一职责的组件
const UserAvatar: React.FC<{ user: User; size?: 'small' | 'medium' | 'large' }> = ({
  user,
  size = 'medium'
}) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  };

  return (
    <img
      src={user.avatar}
      alt={user.name}
      className={`${sizeClasses[size]} rounded-full object-cover`}
    />
  );
};

// ✅ 正确：组合多个小组件
const UserProfileCard: React.FC<{ user: User }> = ({ user }) => {
  return (
    <Card>
      <div className="flex items-center space-x-4">
        <UserAvatar user={user} size="large" />
        <div>
          <h3 className="font-semibold">{user.name}</h3>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>
    </Card>
  );
};
```

#### 2.1.2 组件Props设计

```typescript
// ✅ 正确：明确的Props接口
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  disabled = false,
  loading = false,
  icon,
  children,
  onClick,
  type = 'button',
  className
}) => {
  // 实现逻辑...
};
```

#### 2.1.3 组件组合模式

```typescript
// ✅ 正确：使用复合组件模式
const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Content: React.FC<CardContentProps>;
  Footer: React.FC<CardFooterProps>;
} = ({ children, className, ...props }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md ${className || ''}`} {...props}>
      {children}
    </div>
  );
};

const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className || ''}`}>
      {children}
    </div>
  );
};

const CardContent: React.FC<CardContentProps> = ({ children, className }) => {
  return (
    <div className={`px-6 py-4 ${className || ''}`}>
      {children}
    </div>
  );
};

// 使用示例
<Card>
  <Card.Header>
    <h2>标题</h2>
  </Card.Header>
  <Card.Content>
    <p>内容</p>
  </Card.Content>
</Card>
```

### 2.2 自定义Hook设计

```typescript
// ✅ 正确：功能明确的自定义Hook
interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useApi<T>(
  url: string,
  options?: RequestInit
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### 2.3 状态管理规范

```typescript
// ✅ 正确：使用Zustand进行状态管理
interface ChatStore {
  // 状态
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  isLoading: boolean;

  // 计算/派生状态
  activeConversation: Conversation | null;

  // 动作
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  createConversation: (agentId: string) => string;
  deleteConversation: (id: string) => void;

  // 工具方法
  clearAll: () => void;
}

const useChatStore = create<ChatStore>((set, get) => ({
  conversations: {},
  activeConversationId: null,
  isLoading: false,

  get activeConversation() {
    const { conversations, activeConversationId } = get();
    return activeConversationId ? conversations[activeConversationId] : null;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => set((state) => ({
    conversations: {
      ...state.conversations,
      [conversationId]: {
        ...state.conversations[conversationId],
        messages: [...state.conversations[conversationId].messages, message],
        updatedAt: new Date()
      }
    }
  })),

  createConversation: (agentId) => {
    const id = generateId();
    const conversation: Conversation = {
      id,
      agentId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    set((state) => ({
      conversations: { ...state.conversations, [id]: conversation },
      activeConversationId: id
    }));

    return id;
  },

  deleteConversation: (id) => set((state) => {
    const { [id]: deleted, ...remaining } = state.conversations;
    return {
      conversations: remaining,
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
    };
  }),

  clearAll: () => set({
    conversations: {},
    activeConversationId: null
  })
}));
```

---

## 3. API设计规范和接口契约

### 3.1 RESTful API设计原则

#### 3.1.1 URL设计规范

```typescript
// ✅ 正确：RESTful URL设计
GET    /api/agents              // 获取智能体列表
GET    /api/agents/:id          // 获取特定智能体
POST   /api/agents              // 创建新智能体
PUT    /api/agents/:id          // 完整更新智能体
PATCH  /api/agents/:id          // 部分更新智能体
DELETE /api/agents/:id          // 删除智能体

GET    /api/conversations       // 获取会话列表
POST   /api/conversations       // 创建新会话
GET    /api/conversations/:id   // 获取特定会话
POST   /api/conversations/:id/messages  // 发送消息

// ❌ 错误：不符合RESTful规范
GET    /api/getAllAgents
POST   /api/agents/create
GET    /api/agents/delete/:id
```

#### 3.1.2 请求响应格式

```typescript
// ✅ 正确：统一的API响应格式
interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 成功响应示例
{
  "success": true,
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "id": "uuid",
    "name": "智能体名称"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req-uuid"
}

// 错误响应示例
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "error": {
    "code": "INVALID_EMAIL",
    "message": "邮箱格式不正确",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req-uuid"
}
```

### 3.2 请求验证规范

#### 3.2.1 使用Joi进行输入验证

```typescript
import Joi from 'joi';

// ✅ 正确：完整的请求验证schema
const CreateUserSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': '姓名不能为空',
    'string.min': '姓名长度至少1个字符',
    'string.max': '姓名长度不能超过100个字符',
    'any.required': '姓名是必填字段'
  }),
  email: Joi.string().email().required().messages({
    'string.email': '邮箱格式不正确',
    'any.required': '邮箱是必填字段'
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': '密码长度至少8个字符',
    'string.pattern.base': '密码必须包含大小写字母和数字',
    'any.required': '密码是必填字段'
  }),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    language: Joi.string().optional()
  }).optional()
});

// 控制器中使用验证
export const createUser = async (req: Request, res: Response) => {
  try {
    const { error, value } = CreateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: '请求参数验证失败',
        error: {
          code: 'INVALID_INPUT',
          message: error.details[0].message,
          details: error.details
        },
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }

    // 处理创建用户逻辑
    const user = await userService.create(value);

    res.status(201).json({
      success: true,
      code: 'USER_CREATED',
      message: '用户创建成功',
      data: user,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  } catch (error) {
    next(error);
  }
};
```

### 3.3 错误处理规范

```typescript
// ✅ 正确：自定义错误类型
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, 'NOT_FOUND', message, { resource, id });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

// 全局错误处理中间件
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      error: error.details ? {
        code: error.code,
        message: error.message,
        details: error.details
      } : undefined,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
  }

  // 未知错误处理
  console.error('Unexpected error:', error);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误',
    timestamp: new Date().toISOString(),
    requestId: req.id
  });
};
```

### 3.4 数据库操作规范

```typescript
// ✅ 正确：使用Repository模式
interface Repository<T, ID = string> {
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  findById(id: ID): Promise<T | null>;
  findAll(filters?: Partial<T>): Promise<T[]>;
  update(id: ID, updates: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
  exists(id: ID): Promise<boolean>;
}

export class UserRepository implements Repository<User> {
  constructor(private db: Database) {}

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...userData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('users').insertOne(user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.collection('users').findOne({ id });
    return result || null;
  }

  async findAll(filters: Partial<User> = {}): Promise<User[]> {
    const users = await this.db.collection('users').find(filters).toArray();
    return users;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    const result = await this.db.collection('users').findOneAndUpdate(
      { id },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new NotFoundError('User', id);
    }

    return result.value;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.collection('users').deleteOne({ id });
    if (result.deletedCount === 0) {
      throw new NotFoundError('User', id);
    }
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.db.collection('users').countDocuments({ id });
    return count > 0;
  }
}
```

---

## 4. 测试策略和质量保证标准

### 4.1 测试金字塔

#### 4.1.1 单元测试

```typescript
// ✅ 正确：完整的单元测试示例
describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn()
    } as any;

    userService = new UserService(mockUserRepository);
  });

  describe('createUser', () => {
    const validUserData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePass123'
    };

    it('should create user successfully with valid data', async () => {
      // Arrange
      const expectedUser = {
        ...validUserData,
        id: 'user-uuid',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockUserRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(validUserData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(validUserData);
    });

    it('should throw ValidationError when email is invalid', async () => {
      // Arrange
      const invalidUserData = {
        ...validUserData,
        email: 'invalid-email'
      };

      // Act & Assert
      await expect(userService.createUser(invalidUserData))
        .rejects
        .toThrow(ValidationError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when password is too short', async () => {
      // Arrange
      const invalidUserData = {
        ...validUserData,
        password: '123'
      };

      // Act & Assert
      await expect(userService.createUser(invalidUserData))
        .rejects
        .toThrow(ValidationError);
    });
  });
});
```

#### 4.1.2 集成测试

```typescript
// ✅ 正确：API集成测试
describe('User API Integration', () => {
  let app: Express;
  let testDb: Database;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createApp({ database: testDb });
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    await testDb.clear();
  });

  describe('POST /api/users', () => {
    it('should create user and return 201', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        code: 'USER_CREATED',
        data: {
          name: userData.name,
          email: userData.email
        }
      });
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'SecurePass123'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        code: 'VALIDATION_ERROR',
        error: {
          code: 'INVALID_EMAIL'
        }
      });
    });
  });
});
```

#### 4.1.3 E2E测试

```typescript
// ✅ 正确：E2E测试示例
describe('User Management E2E', () => {
  let page: Page;

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  it('should allow user to register and login', async () => {
    // 访问注册页面
    await page.goto('/register');

    // 填写注册表单
    await page.fill('[data-testid="name-input"]', 'John Doe');
    await page.fill('[data-testid="email-input"]', 'john@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123');

    // 提交表单
    await page.click('[data-testid="register-button"]');

    // 验证注册成功
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toHaveURL('/login');

    // 登录
    await page.fill('[data-testid="email-input"]', 'john@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123');
    await page.click('[data-testid="login-button"]');

    // 验证登录成功
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-welcome"]')).toContainText('John Doe');
  });
});
```

### 4.2 测试覆盖率要求

```typescript
// ✅ 正确：测试配置
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // 核心业务逻辑要求更高覆盖率
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/test/**'
  ]
};
```

### 4.3 测试数据管理

```typescript
// ✅ 正确：测试工厂模式
export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return {
      id: faker.datatype.uuid(),
      name: faker.name.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      preferences: {
        theme: 'light',
        language: 'zh-CN'
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createMany(count: number, overrides?: Partial<User>): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// 测试中使用
describe('UserService', () => {
  it('should handle multiple users', async () => {
    const users = UserFactory.createMany(5);
    // 测试逻辑...
  });
});
```

---

## 5. 性能优化最佳实践

### 5.1 前端性能优化

#### 5.1.1 组件性能优化

```typescript
// ✅ 正确：使用React.memo进行组件记忆化
const UserListItem = React.memo<{ user: User; onSelect: (user: User) => void }>(({
  user,
  onSelect
}) => {
  const handleClick = useCallback(() => {
    onSelect(user);
  }, [user, onSelect]);

  return (
    <div onClick={handleClick} className="user-item">
      <span>{user.name}</span>
      <span>{user.email}</span>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return prevProps.user.id === nextProps.user.id &&
         prevProps.user.updatedAt === nextProps.user.updatedAt;
});

// ✅ 正确：使用useMemo缓存计算结果
const UserList: React.FC<{ users: User[] }> = ({ users }) => {
  const sortedUsers = useMemo(() => {
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length
    };
  }, [users]);

  return (
    <div>
      <div className="stats">
        <span>总计: {userStats.total}</span>
        <span>活跃: {userStats.active}</span>
        <span>非活跃: {userStats.inactive}</span>
      </div>
      <div className="user-list">
        {sortedUsers.map(user => (
          <UserListItem key={user.id} user={user} onSelect={handleUserSelect} />
        ))}
      </div>
    </div>
  );
};
```

#### 5.1.2 虚拟化长列表

```typescript
// ✅ 正确：使用react-window进行虚拟化
import { FixedSizeList as List } from 'react-window';

const VirtualizedUserList: React.FC<{ users: User[] }> = ({ users }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <UserListItem user={users[index]} onSelect={handleUserSelect} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={users.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

#### 5.1.3 代码分割和懒加载

```typescript
// ✅ 正确：使用动态导入进行代码分割
const AdminPanel = lazy(() => import('@/components/admin/AdminPanel'));
const UserDashboard = lazy(() => import('@/components/dashboard/UserDashboard'));

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/admin" element={isAdmin ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="/dashboard" element={<UserDashboard />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

// ✅ 正确：组件级别的懒加载
const LazyChart = lazy(() =>
  import('@/components/charts/EChartsPlaceholder').then(module => ({
    default: module.EChartsPlaceholder
  }))
);
```

### 5.2 后端性能优化

#### 5.2.1 数据库查询优化

```typescript
// ✅ 正确：使用索引和查询优化
class UserRepository {
  // 使用复合索引优化查询
  async findByEmailAndStatus(email: string, status: 'active' | 'inactive'): Promise<User | null> {
    return this.db.collection('users').findOne({
      email,
      status
    }, {
      // 只返回需要的字段
      projection: {
        id: 1,
        name: 1,
        email: 1,
        status: 1,
        createdAt: 1
      }
    });
  }

  // 分页查询优化
  async findWithPagination(
    filters: Partial<User>,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      this.db.collection('users')
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .toArray(),
      this.db.collection('users').countDocuments(filters)
    ]);

    return { users, total };
  }
}
```

#### 5.2.2 缓存策略

```typescript
// ✅ 正确：多层缓存策略
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

class UserService {
  constructor(
    private userRepository: UserRepository,
    private cacheService: CacheService
  ) {}

  async findById(id: string): Promise<User | null> {
    // 1. 检查缓存
    const cacheKey = `user:${id}`;
    let user = await this.cacheService.get<User>(cacheKey);

    if (user) {
      return user;
    }

    // 2. 查询数据库
    user = await this.userRepository.findById(id);

    if (user) {
      // 3. 缓存结果，设置30分钟TTL
      await this.cacheService.set(cacheKey, user, 30 * 60 * 1000);
    }

    return user;
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    // 1. 更新数据库
    const user = await this.userRepository.update(id, updates);

    // 2. 更新缓存
    const cacheKey = `user:${id}`;
    await this.cacheService.set(cacheKey, user, 30 * 60 * 1000);

    // 3. 使相关缓存失效
    await this.invalidateRelatedCaches(id, updates);

    return user;
  }

  private async invalidateRelatedCaches(userId: string, updates: Partial<User>): Promise<void> {
    // 使用户列表缓存失效
    await this.cacheService.invalidate('users:list');

    // 如果邮箱更新，使邮箱相关缓存失效
    if (updates.email) {
      await this.cacheService.invalidate(`user:email:${updates.email}`);
    }
  }
}
```

#### 5.2.3 连接池管理

```typescript
// ✅ 正确：数据库连接池配置
const createDatabasePool = (): Database => {
  return new Database({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,        // 最大连接数
    min: 5,         // 最小连接数
    idle: 10000,    // 空闲超时
    acquire: 30000, // 获取连接超时
    evict: 1000     // 检查间隔
  });
};

// Redis连接池配置
const createRedisPool = (): Redis => {
  return new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    lazyConnect: true
  });
};
```

---

## 6. 安全编码规范和防护措施

### 6.1 身份认证和授权

#### 6.1.1 JWT实现

```typescript
// ✅ 正确：安全的JWT实现
class JWTService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    this.secret = process.env.JWT_SECRET!;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'llmchat-backend',
      audience: 'llmchat-frontend'
    });
  }

  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret, {
        issuer: 'llmchat-backend',
        audience: 'llmchat-frontend'
      }) as JWTPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
```

#### 6.1.2 密码安全

```typescript
// ✅ 正确：密码哈希和验证
class PasswordService {
  private readonly saltRounds = 12;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码长度至少8个字符');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

### 6.2 输入验证和清理

#### 6.2.1 XSS防护

```typescript
// ✅ 正确：XSS防护
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

export class SecurityService {
  static sanitizeHtml(html: string): string {
    return purify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre'],
      ALLOWED_ATTR: ['class'],
      KEEP_CONTENT: true
    });
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // 移除潜在的HTML标签
      .trim()
      .substring(0, 1000); // 限制长度
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
```

#### 6.2.2 SQL注入防护

```typescript
// ✅ 正确：使用参数化查询
class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    // 使用参数化查询防止SQL注入
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query(query, [email]);
    return result.rows[0] || null;
  }

  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    // 输入验证
    const sanitizedQuery = SecurityService.sanitizeInput(query);
    const safeLimit = Math.min(Math.max(limit, 1), 100); // 限制范围

    const sql = `
      SELECT id, name, email, created_at
      FROM users
      WHERE name ILIKE $1 OR email ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(sql, [`%${sanitizedQuery}%`, safeLimit]);
    return result.rows;
  }
}
```

### 6.3 速率限制

```typescript
// ✅ 正确：多层速率限制
import rateLimit from 'express-rate-limit';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 通用API速率限制
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100个请求
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 登录速率限制
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    message: '登录尝试过于频繁，请15分钟后再试'
  }
});

// 细粒度速率限制
const rateLimiters = {
  passwordReset: new RateLimiterMemory({
    keyPrefix: 'password_reset',
    points: 3,
    duration: 3600, // 1小时
  }),
  emailVerification: new RateLimiterMemory({
    keyPrefix: 'email_verification',
    points: 5,
    duration: 86400, // 24小时
  })
};

export const checkRateLimit = async (
  limiterName: keyof typeof rateLimiters,
  identifier: string
) => {
  try {
    const limiter = rateLimiters[limiterName];
    await limiter.consume(identifier);
  } catch (rejRes: any) {
    throw new AppError(429, 'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Try again in ${Math.round(rejRes.msBeforeNext / 1000)} seconds`);
  }
};
```

### 6.4 数据加密

```typescript
// ✅ 正确：敏感数据加密
import crypto from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    this.secretKey = Buffer.from(secret, 'hex');
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    cipher.setAAD(Buffer.from('llmchat', 'utf8'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
    decipher.setAAD(Buffer.from('llmchat', 'utf8'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

---

## 7. 文档化和知识管理标准

### 7.1 代码文档规范

#### 7.1.1 JSDoc注释标准

```typescript
/**
 * 用户服务类
 *
 * 提供用户管理相关的业务逻辑，包括创建、查询、更新和删除用户。
 * 所有操作都会触发相应的事件和日志记录。
 *
 * @example
 * ```typescript
 * const userService = new UserService(userRepository, eventEmitter);
 * const user = await userService.createUser({
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   password: 'SecurePass123'
 * });
 * ```
 *
 * @since 1.0.0
 * @version 1.2.0
 */
export class UserService {
  /**
   * 创建新用户
   *
   * @param userData - 用户数据，不包含ID和创建时间
   * @returns Promise<User> - 创建成功的用户对象
   *
   * @throws {ValidationError} 当用户数据验证失败时
   * @throws {DuplicateError} 当邮箱已存在时
   *
   * @example
   * ```typescript
   * const user = await userService.createUser({
   *   name: 'John Doe',
   *   email: 'john@example.com',
   *   password: 'SecurePass123'
   * });
   * ```
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // 实现...
  }

  /**
   * 根据ID查找用户
   *
   * @param id - 用户ID，必须是有效的UUID格式
   * @returns Promise<User | null> - 用户对象或null
   *
   * @example
   * ```typescript
   * const user = await userService.findById('550e8400-e29b-41d4-a716-446655440000');
   * if (user) {
   *   console.log('用户存在:', user.name);
   * }
   * ```
   */
  async findById(id: string): Promise<User | null> {
    // 实现...
  }
}
```

#### 7.1.2 API文档

```typescript
/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: 创建新用户
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: 用户姓名
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用户邮箱
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: 用户密码
 *                 example: "SecurePass123"
 *               preferences:
 *                 type: object
 *                 properties:
 *                   theme:
 *                     type: string
 *                     enum: [light, dark, auto]
 *                     description: 主题偏好
 *                   language:
 *                     type: string
 *                     description: 语言偏好
 *     responses:
 *       201:
 *         description: 用户创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: string
 *                   example: "USER_CREATED"
 *                 message:
 *                   type: string
 *                   example: "用户创建成功"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 requestId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: 请求参数验证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: 邮箱已存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

### 7.2 README文档模板

```markdown
# 项目名称

## 项目描述

简要描述项目的功能和目标。

## 技术栈

- **前端**: React 18, TypeScript, Vite, Tailwind CSS
- **后端**: Node.js, Express, TypeScript, PostgreSQL
- **测试**: Jest, Vitest, Playwright
- **其他**: Redis, Docker, GitHub Actions

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0

### 安装和运行

```bash
# 克隆项目
git clone <repository-url>
cd <project-name>

# 安装依赖
pnpm install

# 配置环境变量
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 启动数据库
docker-compose up -d postgres redis

# 运行数据库迁移
pnpm run migrate:up

# 启动开发服务
pnpm run dev
```

访问 http://localhost:3000 查看前端应用
访问 http://localhost:3001 查看后端API

## 项目结构

```
project/
├── frontend/           # 前端应用
│   ├── src/
│   │   ├── components/  # React组件
│   │   ├── hooks/      # 自定义Hooks
│   │   ├── services/   # API服务
│   │   ├── store/      # 状态管理
│   │   └── types/      # TypeScript类型
│   └── package.json
├── backend/            # 后端服务
│   ├── src/
│   │   ├── controllers/ # 控制器
│   │   ├── services/   # 业务服务
│   │   ├── models/     # 数据模型
│   │   ├── routes/     # 路由定义
│   │   └── utils/      # 工具函数
│   └── package.json
├── shared-types/       # 共享类型定义
├── docs/              # 项目文档
└── tests/             # E2E测试
```

## API文档

详细的API文档请访问: http://localhost:3001/api-docs

## 开发指南

### 代码规范

项目采用严格的TypeScript编码规范，请参考 [开发规范文档](./DEVELOPMENT_STANDARDS.md)。

### 提交规范

采用 Conventional Commits 规范：

```bash
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建过程或辅助工具的变动
```

### 测试

```bash
# 运行所有测试
pnpm test

# 运行前端测试
pnpm run frontend:test

# 运行后端测试
pnpm run backend:test

# 运行E2E测试
pnpm run test:e2e
```

## 部署

### Docker部署

```bash
# 构建镜像
docker build -t app-name .

# 运行容器
docker run -p 3000:3000 -p 3001:3001 app-name
```

### 生产环境部署

参考 [部署指南](./docs/DEPLOYMENT.md)。

## 故障排除

常见问题和解决方案请参考 [故障排除指南](./docs/TROUBLESHOOTING.md)。

## 贡献

欢迎贡献代码！请阅读 [贡献指南](./CONTRIBUTING.md)。

## 许可证

[MIT License](./LICENSE)
```

### 7.3 知识管理系统

#### 7.3.1 技术决策记录 (ADR)

```markdown
# ADR-001: 使用TypeScript严格模式

## 状态
已接受

## 背景
项目需要在类型安全和开发效率之间找到平衡。

## 决策
采用TypeScript严格模式，启用以下配置：
- `strict: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

## 后果
### 正面
- 提高代码质量和类型安全
- 减少运行时错误
- 更好的IDE支持

### 负面
- 初期开发速度可能降低
- 需要更多的类型定义

## 实施
- 更新所有tsconfig.json文件
- 添加严格的ESLint规则
- 团队培训TypeScript最佳实践
```

#### 7.3.2 架构决策记录

```markdown
# ADR-002: 采用微服务架构

## 状态
已接受

## 背景
随着业务复杂度增加，单体架构难以维护和扩展。

## 决策
采用微服务架构，按业务域拆分服务：
- 用户服务 (User Service)
- 认证服务 (Auth Service)
- 聊天服务 (Chat Service)
- 通知服务 (Notification Service)

## 后果
### 正面
- 服务独立部署和扩展
- 技术栈多样化
- 团队并行开发

### 负面
- 系统复杂性增加
- 分布式事务处理
- 服务间通信开销

## 实施
- 使用API网关统一入口
- 实现服务发现和负载均衡
- 建立分布式追踪系统
- 制定服务间通信规范
```

---

## 总结

本开发规范和最佳实践指南涵盖了TypeScript编码、组件设计、API设计、测试策略、性能优化、安全编码和文档管理等各个方面。通过遵循这些规范，我们可以：

1. **提高代码质量**: 严格的TypeScript配置和编码规范确保代码的健壮性
2. **增强可维护性**: 清晰的组件设计和文档标准使代码易于理解和修改
3. **提升开发效率**: 标准化的流程和工具减少重复工作和沟通成本
4. **保障系统安全**: 全面的安全措施保护系统和用户数据
5. **优化性能**: 前后端性能优化策略提供良好的用户体验

所有团队成员都应该熟悉并遵循这些规范，共同维护项目的高质量标准。随着项目的发展，这些规范也会持续更新和完善。