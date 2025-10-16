# TypeScript 安全标准与最佳实践指南

## 📋 概述

本文档定义了项目中TypeScript类型安全的强制性标准和最佳实践，旨在消除类型安全问题，提高代码质量和开发效率。

## 🚨 零容忍政策

### 严格禁止的TypeScript安全问题

1. **`no-explicit-any`** - 严禁使用`any`类型
2. **`no-unsafe-member-access`** - 严禁不安全的成员访问
3. **`no-unsafe-assignment`** - 严禁不安全的类型赋值
4. **`no-unsafe-call`** - 严禁不安全的函数调用
5. **`no-unsafe-return`** - 严禁不安全的返回值

## 📊 当前问题状态

截至2025-10-14，项目存在以下TypeScript安全问题：

| 问题类型 | 数量 | 优先级 | 影响范围 |
|---------|------|--------|----------|
| `no-unsafe-member-access` | 515 | 高 | 全局对象访问、API响应处理 |
| `no-unsafe-assignment` | 348 | 高 | 数据转换、状态更新 |
| `no-explicit-any` | 276 | 中 | 第三方库、历史代码 |

## 🛡️ 类型安全标准

### 1. 全局对象类型安全

#### ❌ 错误做法
```typescript
// 直接访问全局对象，无类型检查
if (window.gtag) {
  window.gtag('config', 'GA_MEASUREMENT_ID', { user_id: userId });
}
```

#### ✅ 正确做法
```typescript
// 使用全局类型定义
interface Window {
  gtag?: (
    command: 'config' | 'set' | 'event' | 'js',
    targetIdOrEventName: string,
    configOrParams?: Record<string, any>
  ) => void;
}

if (window.gtag) {
  window.gtag('config', 'GA_MEASUREMENT_ID', { user_id: userId });
}
```

### 2. API响应类型安全

#### ❌ 错误做法
```typescript
// 直接使用any类型
const data: any = await response.json();
const user = data.user; // 不安全的成员访问
```

#### ✅ 正确做法
```typescript
// 定义明确的接口
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

const response = await fetch('/api/users');
const apiResponse: ApiResponse<User> = await response.json();

if (apiResponse.success && apiResponse.data) {
  const user = apiResponse.data; // 类型安全
}
```

### 3. 事件处理类型安全

#### ❌ 错误做法
```typescript
// 使用any类型处理事件
const handleClick = (event: any) => {
  const target = event.target; // 不安全
  target.value = 'new value';
};
```

#### ✅ 正确做法
```typescript
// 使用具体的HTML事件类型
const handleClick = (event: React.ChangeEvent<HTMLInputElement>) => {
  const target = event.target; // 类型安全
  target.value = 'new value';
};
```

### 4. 状态管理类型安全

#### ❌ 错误做法
```typescript
// 使用any作为状态类型
const [state, setState] = useState<any>(null);
setState({ unknown: 'property' }); // 不安全
```

#### ✅ 正确做法
```typescript
// 定义明确的状态类型
interface UserState {
  id: string;
  username: string;
  isLoading: boolean;
  error: string | null;
}

const [state, setState] = useState<UserState | null>(null);

// 使用类型守卫
if (state) {
  setState({ ...state, username: 'newname' });
}
```

### 5. 第三方库集成类型安全

#### ❌ 错误做法
```typescript
// 直接使用第三方库，无类型定义
import thirdPartyLib from 'third-party-lib';
const result: any = thirdPartyLib.process(data);
```

#### ✅ 正确做法
```typescript
// 创建类型定义文件
// types/third-party-lib.d.ts
declare module 'third-party-lib' {
  interface ProcessOptions {
    strict?: boolean;
    timeout?: number;
  }

  interface ProcessResult {
    success: boolean;
    data: unknown;
    error?: string;
  }

  function process<T>(data: T, options?: ProcessOptions): ProcessResult;
}

// 使用类型安全的API
import thirdPartyLib from 'third-party-lib';
const result = thirdPartyLib.process<string>('test data');
```

## 🔧 实施策略

### 阶段1：关键基础设施（高优先级）

1. **全局类型定义完善**
   - 扩展 `src/types/global.d.ts`
   - 定义所有第三方全局变量
   - 创建安全的API类型

2. **核心服务类型安全**
   - 监控服务 (PerformanceMonitor)
   - 分析服务 (Analytics)
   - 存储服务 (HybridStorage)

3. **状态管理类型安全**
   - Zustand stores
   - React Context
   - 本地存储操作

### 阶段2：业务逻辑类型安全（中优先级）

1. **组件Props类型定义**
2. **API客户端类型安全**
3. **事件处理器类型安全**
4. **路由参数类型安全**

### 阶段3：历史代码清理（低优先级）

1. **遗留any类型替换**
2. **类型断言优化**
3. **类型推断改进**

## 📝 编码规范

### 1. 类型定义规范

```typescript
// ✅ 正确：明确的接口定义
interface UserConfig {
  readonly id: string;  // 只读属性
  username: string;
  age?: number;        // 可选属性
  role: UserRole;      // 联合类型
}

// ✅ 正确：使用泛型约束
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}

// ✅ 正确：工具类型使用
type PartialUserConfig = Partial<UserConfig>;
type UserConfigWithoutId = Omit<UserConfig, 'id'>;
```

### 2. 函数类型定义规范

```typescript
// ✅ 正确：明确的参数和返回类型
const formatUser = (user: UserConfig): string => {
  return `${user.username} (${user.age || 'unknown age'})`;
};

// ✅ 正确：泛型函数
const createCache = <K extends string, V>(): Map<K, V> => {
  return new Map();
};
```

### 3. 错误处理类型安全

```typescript
// ✅ 正确：类型安全的错误处理
class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 类型守卫
const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};

const handleError = (error: unknown): void => {
  if (isApiError(error)) {
    console.error(`API Error [${error.code}]: ${error.message}`, error.details);
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error('Unknown error occurred');
  }
};
```

## 🧪 测试策略

### 1. 类型验证测试

```typescript
// 使用typescript的type-level验证
type ValidateType<T> = T extends any ? true : false;

// 编译时类型检查
type _Test1 = ValidateType<ExpectedType>; // 应该为true
```

### 2. 运行时类型检查

```typescript
// 类型谓词
const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

// 运行时验证函数
const validateUser = (data: unknown): data is User => {
  if (!data || typeof data !== 'object') return false;

  const user = data as Record<string, unknown>;
  return typeof user.id === 'string' &&
         typeof user.username === 'string' &&
         typeof user.email === 'string';
};
```

## 📊 质量指标

### 目标指标

| 指标 | 当前值 | 目标值 | 时间线 |
|------|--------|--------|--------|
| TypeScript编译错误 | 1 | 0 | 立即 |
| `no-explicit-any`错误 | 276 | 0 | 1周 |
| `no-unsafe-member-access`错误 | 515 | 0 | 2周 |
| `no-unsafe-assignment`错误 | 348 | 0 | 2周 |
| 类型覆盖率 | 85% | 100% | 2周 |

### 监控指标

```bash
# 类型检查命令
pnpm run type-check

# ESLint类型检查
pnpm run lint --ext .ts,.tsx

# 生成类型覆盖率报告
npx type-coverage
```

## 🚀 自动化工具

### 1. Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm run type-check && pnpm run lint:fix",
      "pre-push": "pnpm test && pnpm run build"
    }
  }
}
```

### 2. CI/CD集成

```yaml
# .github/workflows/typescript.yml
name: TypeScript Security Check
on: [push, pull_request]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm run type-check
      - run: pnpm run lint --ext .ts,.tsx
      - run: pnpm run build
```

## 📚 参考资源

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [Strict Type Checking](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#strict-type-checking-options)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)

## 🔄 持续改进

### 每周审查

1. **类型错误趋势分析**
2. **新代码类型合规检查**
3. **第三方库类型定义更新**
4. **团队培训和知识分享**

### 月度评估

1. **类型安全KPI评估**
2. **开发效率影响分析**
3. **工具链优化建议**
4. **标准更新和改进**

---

**重要提醒**: 遵循这些标准不仅是技术要求，更是对代码质量和团队协作的责任。每个开发人员都有义务维护代码的类型安全性。