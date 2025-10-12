# 开发规范和最佳实践

# =============================================================================
# 项目架构规范
# =============================================================================

## 技术栈标准化
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **后端**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **状态管理**: Zustand (前端) + 本地存储持久化
- **测试**: Jest (后端) + Vitest (前端) + Playwright (E2E)
- **包管理**: pnpm with workspaces

## 目录结构标准化
```
llmchat/
├── backend/                 # 后端服务
│   └── src/
│       ├── controllers/     # 控制器层
│       ├── services/        # 业务逻辑层
│       ├── routes/          # 路由定义
│       ├── middleware/      # 中间件
│       ├── models/          # 数据模型
│       ├── utils/           # 工具函数
│       └── types/           # 类型定义
├── frontend/                # 前端应用
│   └── src/
│       ├── components/      # React组件
│       │   ├── ui/          # 基础UI组件
│       │   ├── features/    # 功能组件
│       │   └── layouts/     # 布局组件
│       ├── store/           # 状态管理
│       ├── services/        # API服务
│       ├── hooks/           # 自定义Hooks
│       ├── utils/           # 工具函数
│       └── types/           # 类型定义
├── shared-types/            # 共享类型定义
├── docs/                    # 项目文档
└── tests/                   # 测试文件
```

## 文件命名规范
- **组件文件**: PascalCase (UserProfile.tsx, Button.tsx)
- **工具文件**: camelCase (apiClient.ts, formatUtils.ts)
- **类型文件**: camelCase (types.ts, interfaces.ts)
- **常量文件**: UPPER_SNAKE_CASE (API_ENDPOINTS.ts)
- **配置文件**: kebab-case (eslint.config.js, vite.config.ts)

# =============================================================================
# TypeScript 使用规范
# =============================================================================

## 类型定义规范
```typescript
// ✅ 正确：使用interface定义对象类型
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string; // 可选属性明确标记
  createdAt: Date;
}

// ✅ 正确：使用type定义联合类型、交叉类型
type Status = 'pending' | 'approved' | 'rejected';
type ApiResponse<T> = {
  data: T;
  status: Status;
  message?: string;
};

// ✅ 正确：使用泛型提高类型复用性
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

## 组件类型规范
```typescript
// ✅ 正确：React组件使用函数声明和泛型
interface ButtonProps {
  children: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant,
  size = 'medium',
  disabled = false,
  onClick
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
```

## Hook使用规范
```typescript
// ✅ 正确：自定义Hook返回值和参数类型
interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hook实现...

  return { data, loading, error, refetch };
}
```

## 状态管理规范
```typescript
// ✅ 正确：Zustand store类型定义
interface UserStore {
  // 状态
  user: User | null;
  isAuthenticated: boolean;

  // 计算属性
  userDisplayName: string;

  // 操作方法
  setUser: (user: User | null) => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;

  // 持久化配置
  persist: {
    name: 'user-store';
    storage: createJSONStorage(() => localStorage);
  };
}

const useUserStore = create<UserStore>()(
  devtools(
    persist(
      (set, get) => ({
        // 状态初始化
        user: null,
        isAuthenticated: false,

        // 计算属性
        get userDisplayName() {
          return get().user?.name || 'Guest';
        },

        // 操作方法
        setUser: (user) => set({ user, isAuthenticated: !!user }),
        login: async (credentials) => {
          // 登录逻辑...
        },
        logout: () => set({ user: null, isAuthenticated: false }),
      }),
      {
        name: 'user-store',
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
);
```

# =============================================================================
# React 组件开发规范
# =============================================================================

## 组件设计原则
1. **单一职责**: 每个组件只负责一个功能
2. **可复用性**: 通过props和children提高复用性
3. **类型安全**: 所有props和state都有明确类型
4. **性能优化**: 合理使用memo、useMemo、useCallback
5. **可测试性**: 组件逻辑易于测试

## 组件结构规范
```typescript
// ✅ 正确的组件结构
import React, { useState, useEffect, useCallback, memo } from 'react';
import { User } from '@/types';
import Button from '@/components/ui/Button';
import { useUserStore } from '@/store/userStore';

interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
  className?: string;
}

const UserCard: React.FC<UserCardProps> = memo(({
  user,
  onEdit,
  onDelete,
  className
}) => {
  // 1. 状态管理
  const [isExpanded, setIsExpanded] = useState(false);
  const { updateUser } = useUserStore();

  // 2. 副作用
  useEffect(() => {
    // 组件挂载或更新时的副作用
  }, [user.id]);

  // 3. 事件处理函数
  const handleEdit = useCallback(() => {
    onEdit?.(user);
  }, [user, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete?.(user.id);
  }, [user.id, onDelete]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // 4. 渲染逻辑
  return (
    <div className={`user-card ${className || ''}`}>
      <div className="user-card__header">
        <h3>{user.name}</h3>
        <div className="user-card__actions">
          <Button variant="secondary" size="small" onClick={handleEdit}>
            编辑
          </Button>
          <Button variant="danger" size="small" onClick={handleDelete}>
            删除
          </Button>
        </div>
      </div>

      <div className="user-card__content">
        <p>{user.email}</p>
        {isExpanded && (
          <div className="user-card__details">
            <p>创建时间: {user.createdAt.toLocaleDateString()}</p>
            <p>更新时间: {user.updatedAt.toLocaleDateString()}</p>
          </div>
        )}
      </div>

      <Button variant="ghost" size="small" onClick={toggleExpanded}>
        {isExpanded ? '收起' : '展开'}
      </Button>
    </div>
  );
});

UserCard.displayName = 'UserCard';

export default UserCard;
```

## Hook使用规范
```typescript
// ✅ 正确的Hook使用方式
const UserProfile: React.FC = () => {
  // 1. 状态Hook
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2. 自定义Hook
  const { user, updateUser } = useUserStore();
  const { data: posts, loading: postsLoading } = useApi<Post[]>('/api/posts');

  // 3. 计算属性Hook
  const displayName = useMemo(() => {
    return user?.nickname || user?.name || '用户';
  }, [user?.nickname, user?.name]);

  // 4. 事件处理Hook
  const handleUpdateProfile = useCallback(async (data: Partial<User>) => {
    setLoading(true);
    setError(null);

    try {
      await updateUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setLoading(false);
    }
  }, [updateUser]);

  // 5. 副作用Hook
  useEffect(() => {
    if (error) {
      setTimeout(() => setError(null), 5000);
    }
  }, [error]);

  return (
    <div>
      {/* 组件渲染 */}
    </div>
  );
};
```

## 性能优化规范
```typescript
// ✅ 正确的性能优化方式
import React, { memo, useMemo, useCallback } from 'react';

// 1. 使用memo优化组件重渲染
const ExpensiveComponent = memo<{ data: any[] }>(({ data }) => {
  // 2. 使用memoize计算昂贵的值
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      computed: expensiveCalculation(item)
    }));
  }, [data]);

  // 3. 使用callback缓存事件处理函数
  const handleClick = useCallback((id: string) => {
    onItemClick(id);
  }, [onItemClick]);

  return (
    <div>
      {processedData.map(item => (
        <Item key={item.id} data={item} onClick={handleClick} />
      ))}
    </div>
  );
});

// 4. 使用React.lazy进行代码分割
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// 5. 使用Suspense处理加载状态
const App = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <LazyComponent />
  </Suspense>
);
```

# =============================================================================
# API 接口规范
# =============================================================================

## RESTful API 设计规范
```typescript
// ✅ 正确的API接口定义
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  code: string;
  timestamp: string;
}

interface PaginatedParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResponse<T> extends ApiResponse<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {}

// API 端点示例
// GET /api/users - 获取用户列表
// GET /api/users/:id - 获取特定用户
// POST /api/users - 创建用户
// PUT /api/users/:id - 更新用户
// DELETE /api/users/:id - 删除用户
```

## 错误处理规范
```typescript
// ✅ 正确的错误处理
class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 错误码标准化
export const ERROR_CODES = {
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // 业务错误
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  // 系统错误
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

// API 调用封装
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || 'Request failed',
          data.code || ERROR_CODES.UNKNOWN_ERROR,
          response.status,
          data.details
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'Network error',
        ERROR_CODES.UNKNOWN_ERROR,
        0,
        error
      );
    }
  }
}
```

# =============================================================================
# 测试规范
# =============================================================================

## 单元测试规范
```typescript
// ✅ 正确的单元测试结构
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Button from './Button';

describe('Button Component', () => {
  const defaultProps = {
    children: 'Click me',
    variant: 'primary' as const,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<Button {...defaultProps} />);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('btn', 'btn-primary', 'btn-medium');
  });

  it('handles click events correctly', async () => {
    const user = userEvent.setup();
    render(<Button {...defaultProps} />);

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('applies correct classes based on variant prop', () => {
    render(<Button {...defaultProps} variant="danger" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-danger');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button {...defaultProps} disabled />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    render(<Button {...defaultProps} disabled />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(defaultProps.onClick).not.toHaveBeenCalled();
  });
});
```

## 集成测试规范
```typescript
// ✅ 正确的集成测试结构
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import UserList from './UserList';
import { apiClient } from '@/services/apiClient';

// Mock API客户端
vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('UserList Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays user list when API call succeeds', async () => {
    const mockUsers = [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    ];

    vi.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: mockUsers,
    });

    renderWithProviders(<UserList />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('displays error message when API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<UserList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
    });
  });
});
```

## E2E测试规范
```typescript
// ✅ 正确的E2E测试结构
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users');
  });

  test('should display user list', async ({ page }) => {
    await expect(page.getByText('用户管理')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should create new user', async ({ page }) => {
    await page.getByRole('button', { name: /新增用户/i }).click();

    await page.getByLabel('姓名').fill('测试用户');
    await page.getByLabel('邮箱').fill('test@example.com');
    await page.getByRole('button', { name: /保存/i }).click();

    await expect(page.getByText('用户创建成功')).toBeVisible();
    await expect(page.getByText('测试用户')).toBeVisible();
  });

  test('should edit existing user', async ({ page }) => {
    await page.getByRole('row', { name: /john doe/i }).getByRole('button', { name: /编辑/i }).click();

    await page.getByLabel('姓名').clear();
    await page.getByLabel('姓名').fill('John Updated');
    await page.getByRole('button', { name: /保存/i }).click();

    await expect(page.getByText('用户更新成功')).toBeVisible();
    await expect(page.getByText('John Updated')).toBeVisible();
  });
});
```

# =============================================================================
# 代码审查规范
# =============================================================================

## 审查检查清单
### 功能性检查
- [ ] 功能是否按照需求正确实现
- [ ] 边界条件是否正确处理
- [ ] 错误处理是否完善
- [ ] 性能是否满足要求

### 代码质量检查
- [ ] 代码结构是否清晰易懂
- [ ] 变量和函数命名是否规范
- [ ] 是否有重复代码需要重构
- [ ] 注释是否充分且准确

### 类型安全检查
- [ ] TypeScript类型定义是否完整
- [ ] 是否有any类型需要具体化
- [ ] 可选属性是否正确使用
- [ ] 泛型使用是否合理

### 测试覆盖检查
- [ ] 单元测试覆盖率是否达标
- [ ] 测试用例是否覆盖主要场景
- [ ] 测试代码质量是否合格
- [ ] 集成测试是否充分

### 安全性检查
- [ ] 是否有安全漏洞
- [ ] 输入验证是否充分
- [ ] 权限控制是否正确
- [ ] 敏感信息是否正确处理

## 审查流程
1. **自检**: 开发者提交前自检
2. **同行审查**: 至少一名同行审查
3. **架构审查**: 复杂变更需要架构师审查
4. **安全审查**: 涉及安全的变更需要安全专家审查
5. **测试审查**: QA团队审查测试覆盖和质量

## 审查工具
- **静态分析**: ESLint, TypeScript compiler
- **安全扫描**: Snyk, OWASP ZAP
- **依赖检查**: npm audit, Snyk
- **代码质量**: SonarQube
- **性能分析**: Lighthouse, WebPageTest

# =============================================================================
# 部署和运维规范
# =============================================================================

## 环境配置
- **开发环境**: 本地开发，热重载，详细日志
- **测试环境**: 自动化测试，CI/CD集成
- **预生产环境**: 生产环境镜像，性能测试
- **生产环境**: 高可用，监控告警，日志收集

## 部署流程
1. **代码提交**: 通过所有质量检查
2. **构建**: 自动化构建和测试
3. **部署**: 自动化部署到目标环境
4. **验证**: 健康检查和功能验证
5. **监控**: 部署后监控和告警

## 监控指标
- **性能指标**: 响应时间，吞吐量，错误率
- **业务指标**: 用户活跃度，功能使用率
- **系统指标**: CPU, 内存，磁盘，网络
- **安全指标**: 攻击次数，漏洞扫描结果

## 日志规范
```typescript
// ✅ 正确的日志记录
import { logger } from '@/utils/logger';

// 不同级别的日志
logger.debug('Debug information', { userId, action });
logger.info('User action completed', { userId, action, duration });
logger.warn('Potential issue detected', { userId, issue });
logger.error('Error occurred', { userId, error: error.stack });

// 结构化日志
logger.info('API request', {
  method: 'POST',
  url: '/api/users',
  userId: '123',
  duration: 150,
  status: 200
});
```

# =============================================================================
# 团队协作规范
# =============================================================================

## Git工作流
1. **主分支保护**: main分支受保护，禁止直接提交
2. **功能分支**: 每个功能使用独立分支
3. **代码审查**: 所有变更必须经过代码审查
4. **自动化检查**: CI/CD自动运行检查
5. **合并策略**: 使用squash merge保持历史清洁

## 分支命名规范
- `feature/功能名称`: 新功能开发
- `bugfix/问题描述`: 错误修复
- `hotfix/紧急修复`: 生产环境紧急修复
- `refactor/重构内容`: 代码重构
- `docs/文档更新`: 文档更新

## 提交信息规范
```
type(scope): description

[optional body]

[optional footer]
```

**类型**:
- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**:
```
feat(auth): add JWT token refresh functionality

- Implement automatic token refresh
- Add token expiration handling
- Update auth store with refresh logic

Closes #123
```

## 版本管理规范
- **语义化版本**: MAJOR.MINOR.PATCH
- **发布分支**: release/v版本号
- **标签**: git tag v版本号
- **变更日志**: CHANGELOG.md记录所有变更

## 沟通规范
- **日常沟通**: 使用团队即时通讯工具
- **技术讨论**: 使用代码审查评论
- **问题反馈**: 使用issue跟踪系统
- **文档共享**: 使用wiki或文档平台
- **会议记录**: 重要决策需要记录并分享