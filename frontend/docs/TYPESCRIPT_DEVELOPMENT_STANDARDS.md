# TypeScript 开发标准

## 📋 概述

本文档定义了 LLMChat 前端项目的 TypeScript 开发标准，确保代码质量、类型安全和开发效率。项目采用零容忍类型错误政策，始终保持 0 个 TypeScript 编译错误。

## 🎯 核心原则

### 1. 零容忍类型错误政策
- **强制要求**: 项目必须保持 0 个 TypeScript 编译错误
- **提交门禁**: 任何包含类型错误的代码都禁止提交
- **自动化检查**: CI/CD 流水线强制执行类型检查

### 2. 严格类型优先
- 所有变量、函数参数和返回值必须有明确类型
- 避免使用 `any` 类型，优先使用具体类型或 `unknown`
- 使用类型守卫和断言确保运行时类型安全

### 3. 可读性和维护性
- 优先选择类型安全而非开发便利性
- 编写自文档化的类型定义
- 保持接口设计的一致性和直观性

## ⚙️ TypeScript 配置标准

### 编译器选项

```json
{
  "compilerOptions": {
    // 基础设置
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",

    // 严格类型检查
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitThis": true,

    // 性能优化
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,

    // 路径映射
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["components/*"],
      "@/hooks/*": ["hooks/*"],
      "@/store/*": ["store/*"],
      "@/services/*": ["services/*"],
      "@/types/*": ["types/*"],
      "@/utils/*": ["utils/*"]
    }
  }
}
```

### 配置说明

| 选项 | 值 | 说明 | 必要性 |
|------|----|------|--------|
| `strict` | `true` | 启用所有严格类型检查 | **必需** |
| `exactOptionalPropertyTypes` | `true` | 精确可选属性类型 | **必需** |
| `noUncheckedIndexedAccess` | `true` | 禁止未检查的索引访问 | **必需** |
| `noImplicitReturns` | `true` | 禁止隐式返回 | **必需** |
| `noUnusedLocals` | `true` | 禁止未使用的局部变量 | **必需** |

## 📝 代码编写规范

### 1. 变量和函数声明

#### ✅ 正确示例

```typescript
// 明确的类型注解
const userName: string = 'John Doe';
const userAge: number = 30;
const isActive: boolean = true;

// 函数类型注解
function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}

// 箭头函数
const formatMessage = (message: string, prefix?: string): string => {
  return prefix ? `${prefix}: ${message}` : message;
};

// 异步函数
async function fetchUserData(id: string): Promise<User | null> {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
```

#### ❌ 错误示例

```typescript
// 缺少类型注解
const userName = 'John Doe'; // ❌ 应该明确指定类型
const userAge = 30; // ❌ 应该明确指定类型

// 函数缺少返回类型
function calculateTotal(price, quantity) { // ❌ 参数和返回值缺少类型
  return price * quantity;
}

// 使用 any 类型
function processData(data: any): any { // ❌ 避免使用 any
  return data;
}
```

### 2. 接口和类型定义

#### ✅ 正确示例

```typescript
// 用户接口定义
interface User {
  readonly id: string;
  name: string;
  email: string;
  age?: number; // 可选属性
  preferences: UserPreferences;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  language: string;
}

// 使用泛型接口
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: ApiError;
}

// 联合类型
type ThemeMode = 'light' | 'dark' | 'auto';
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// 工具类型使用
type PartialUser = Partial<User>;
type UserWithoutId = Omit<User, 'id'>;
type UserKeys = keyof User;
```

#### ❌ 错误示例

```typescript
// 接口定义不完整
interface User { // ❌ 缺少必要属性的类型定义
  id;
  name;
  email;
}

// 可选属性使用错误
interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto'; // ❌ 主题应该是必需的
  notifications?: boolean; // ❌ 通知设置应该是必需的
}

// 类型过于宽泛
interface ApiResponse { // ❌ 缺少泛型，类型不够具体
  success: boolean;
  data: any; // ❌ 避免使用 any
}
```

### 3. 组件类型定义

#### ✅ 正确示例

```typescript
// 组件 Props 接口
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

// 函数组件定义
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className || ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

// 使用泛型的组件
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

function List<T>({ items, renderItem, keyExtractor, emptyMessage }: ListProps<T>) {
  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage || 'No items'}</div>;
  }

  return (
    <ul className="list">
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  );
}
```

#### ❌ 错误示例

```typescript
// 组件 Props 缺少类型定义
const Button = ({ children, variant, onClick }) => { // ❌ Props 没有类型定义
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
};

// 使用 any 类型
const Button: React.FC<any> = ({ children, variant, onClick }) => { // ❌ 避免使用 any
  // ...
};

// 可选属性缺少默认值处理
interface ButtonProps {
  variant: 'primary' | 'secondary'; // ❌ 应该是可选的
  size: 'sm' | 'md' | 'lg'; // ❌ 应该是可选的
}
```

### 4. React Hooks 类型定义

#### ✅ 正确示例

```typescript
// useState 类型定义
const [count, setCount] = useState<number>(0);
const [user, setUser] = useState<User | null>(null);
const [loading, setLoading] = useState<boolean>(false);

// useReducer 类型定义
interface State {
  count: number;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'DECREMENT':
      return { ...state, count: state.count - 1 };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

const [state, dispatch] = useReducer(reducer, {
  count: 0,
  loading: false,
  error: null
});

// useEffect 类型定义
useEffect(() => {
  const handleResize = (): void => {
    console.log('Window resized');
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []); // 空依赖数组

// 自定义 Hook 类型定义
interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

#### ❌ 错误示例

```typescript
// useState 缺少类型
const [count, setCount] = useState(0); // ❌ 应该明确指定类型

// useReducer 类型不完整
const [state, dispatch] = useReducer(reducer, {}); // ❌ 初始状态类型不匹配

// useEffect 缺少清理函数类型
useEffect(() => {
  const timer = setTimeout(() => {
    console.log('Timer fired');
  }, 1000);

  // ❌ 清理函数没有返回类型注解
  return () => {
    clearTimeout(timer);
  };
}, []);
```

## 🛡️ 类型安全最佳实践

### 1. 运行时类型检查

使用 Zod 进行运行时类型验证：

```typescript
import { z } from 'zod';

// 定义 Schema
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']),
    notifications: z.boolean()
  })
});

// 类型推断
type User = z.infer<typeof UserSchema>;

// 验证函数
function validateUser(data: unknown): User {
  const result = UserSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid user data: ${result.error.message}`);
  }

  return result.data;
}

// API 响应验证
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();

  return validateUser(data);
}
```

### 2. 类型守卫

```typescript
// 基础类型守卫
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 复杂类型守卫
function isUser(value: unknown): value is User {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string'
  );
}

// 类型断言函数
function assertUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new Error('Value is not a valid User');
  }
}

// 使用示例
function processUserData(data: unknown): void {
  if (isUser(data)) {
    // 这里 data 的类型被推断为 User
    console.log(`User: ${data.name} (${data.email})`);
  }

  // 或者使用断言
  assertUser(data);
  console.log(`User ID: ${data.id}`);
}
```

### 3. 工具类型使用

```typescript
// 常用工具类型
type PartialUser = Partial<User>; // 所有属性变为可选
type RequiredUser = Required<User>; // 所有属性变为必需
type UserWithoutId = Omit<User, 'id'>; // 排除指定属性
type UserWithEmail = Pick<User, 'name' | 'email'>; // 选择指定属性

// 高级工具类型
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

// 使用示例
interface UpdateUserRequest {
  id: string;
  data: DeepPartial<User>;
}

function updateUser(request: UpdateUserRequest): Promise<User> {
  // 实现...
}

// 条件类型
type NonNullable<T> = T extends null | undefined ? never : T;

type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error';
};

type SuccessResponse<T> = Extract<ApiResponse<T>, { status: 'success' }>;
type ErrorResponse = Extract<ApiResponse<any>, { status: 'error' }>;
```

## 🔧 开发工具配置

### ESLint 配置

```javascript
// .eslintrc.cjs
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking'
  ],
  rules: {
    // TypeScript 规则
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',

    // 复杂度控制
    'complexity': ['warn', 15],
    'max-params': ['warn', 4]
  }
};
```

### Prettier 配置

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## 📋 开发检查清单

### 提交前检查

- [ ] 所有 TypeScript 编译错误已修复
- [ ] ESLint 检查通过，无严重警告
- [ ] 所有 `any` 类型已被具体类型替换
- [ ] 函数参数和返回值类型完整
- [ ] 组件 Props 接口定义完整
- [ ] 运行时类型检查已添加（如需要）
- [ ] 测试覆盖关键类型逻辑

### 代码审查要点

- [ ] 类型定义是否准确反映业务逻辑
- [ ] 是否避免了不必要的类型断言
- [ ] 泛型使用是否合理
- [ ] 类型守卫是否正确实现
- [ ] 错误处理类型是否完整
- [ ] API 接口类型是否与后端一致

## 🚨 常见问题与解决方案

### 问题 1: 类型 "X" 上不存在属性 "Y"

**原因**: 对象类型定义不完整或索引访问问题

**解决方案**:
```typescript
// 错误示例
const user: any = fetchData();
console.log(user.name); // ❌ 使用 any

// 正确示例
interface User {
  name: string;
  email: string;
}
const user = fetchData() as User; // 或使用类型守卫
console.log(user.name); // ✅ 类型安全
```

### 问题 2: 不能将类型 "X" 分配给类型 "Y"

**原因**: 类型不匹配或类型过于宽泛

**解决方案**:
```typescript
// 错误示例
const theme: 'light' | 'dark' = 'auto'; // ❌ 'auto' 不在联合类型中

// 正确示例
type Theme = 'light' | 'dark' | 'auto';
const theme: Theme = 'auto'; // ✅ 包含所有可能的值
```

### 问题 3: 对象字面量只能指定已知属性

**原因**: 多余属性检查

**解决方案**:
```typescript
// 错误示例
interface User {
  name: string;
  email: string;
}
const user: User = {
  name: 'John',
  email: 'john@example.com',
  age: 30 // ❌ 多余属性
};

// 解决方案 1: 使用类型断言
const user = {
  name: 'John',
  email: 'john@example.com',
  age: 30
} as User;

// 解决方案 2: 扩展接口
interface ExtendedUser extends User {
  age?: number;
}
const user: ExtendedUser = {
  name: 'John',
  email: 'john@example.com',
  age: 30
};
```

## 📚 推荐阅读

- [TypeScript 官方手册](https://www.typescriptlang.org/docs/)
- [TypeScript 深入浅出](https://basarat.gitbook.io/typescript/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Zod 文档](https://zod.dev/)

---

本标准会随着项目发展持续更新。如有疑问或建议，请联系开发团队。

最后更新: 2025-10-18