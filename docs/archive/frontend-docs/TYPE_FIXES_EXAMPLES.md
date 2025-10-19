# TypeScript 类型修复示例

本文档提供具体的类型修复代码示例，帮助快速解决审计中发现的问题。

## 🔴 P0 紧急修复示例

### 1. ErrorBoundary.tsx 语法错误修复

#### 当前问题代码
```typescript
export const safeExecute = async <T>(
  fn: () => T | Promise<T>,
  context?: Partial<ErrorContext>
): Promise<{ success: true; data: T } | { success: false; error: ErrorHandlingResult }> => {
```

#### 修复方案
```typescript
// 确保类型定义完整和语法正确
interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
}

interface ErrorHandlingResult {
  success: false;
  error: {
    message: string;
    code: string;
    context?: ErrorContext;
  };
}

export const safeExecute = async <T>(
  fn: () => T | Promise<T>,
  context?: Partial<ErrorContext>
): Promise<{ success: true; data: T } | ErrorHandlingResult> => {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResult: ErrorHandlingResult = {
      success: false,
      error: {
        message: errorMessage,
        code: 'EXECUTION_ERROR',
        context
      }
    };
    return errorResult;
  }
};
```

### 2. VirtualScroll.tsx 数组访问语法修复

#### 当前问题代码
```typescript
// 问题：数组访问语法错误
const items = [];
const result = items[]; // 错误的语法
```

#### 修复方案
```typescript
interface VirtualScrollItem<T> {
  index: number;
  data: T;
  height: number;
}

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number | ((index: number, data: T) => number);
  containerHeight: number;
  renderItem: (item: VirtualScrollItem<T>) => React.ReactNode;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  onScroll
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  // 计算可见范围
  const getItemHeight = useCallback((index: number) => {
    return typeof itemHeight === 'function' ? itemHeight(index, items[index]) : itemHeight;
  }, [itemHeight, items]);

  const visibleRange = useMemo(() => {
    let start = 0;
    let accumulatedHeight = 0;

    // 找到起始索引
    for (let i = 0; i < items.length; i++) {
      if (accumulatedHeight > scrollTop) break;
      accumulatedHeight += getItemHeight(i);
      start = i;
    }

    // 找到结束索引
    let end = start;
    accumulatedHeight = 0;
    for (let i = start; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i);
      if (accumulatedHeight > containerHeight) break;
      end = i;
    }

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan)
    };
  }, [scrollTop, items.length, containerHeight, getItemHeight, overscan]);

  return (
    <div style={{ height: containerHeight, overflow: 'auto' }}>
      {items.slice(visibleRange.start, visibleRange.end + 1).map((data, index) => {
        const actualIndex = visibleRange.start + index;
        return renderItem({
          index: actualIndex,
          data,
          height: getItemHeight(actualIndex)
        });
      })}
    </div>
  );
}
```

## 🟡 P1 高风险 any 类型修复

### 1. 事件处理类型修复

#### 问题代码
```typescript
// 当前问题：使用 any 类型
const handleEvent = (event: any, data: any) => {
  console.log(event, data);
};

interface EnhancedProps {
  onClick?: (event: E) => void | ((data?: any, event: E) => void);
}
```

#### 修复方案
```typescript
// 定义通用事件类型
interface BaseEventData {
  timestamp: number;
  source: string;
}

interface ClickEventData extends BaseEventData {
  x: number;
  y: number;
  target: HTMLElement;
}

interface ChangeEventData extends BaseEventData {
  value: string;
  previousValue: string;
}

// 类型安全的事件处理器
type EventHandler<TData = void, TEvent = React.SyntheticEvent> =
  | (event: TEvent) => TData
  | (data: TData, event: TEvent) => TData;

// 具体的事件处理器类型
type ClickHandler = EventHandler<ClickEventData, React.MouseEvent>;
type ChangeHandler = EventHandler<ChangeEventData, React.ChangeEvent>;

// 修复后的组件 Props
interface EnhancedProps<T = unknown> {
  onClick?: EventHandler<T, React.MouseEvent>;
  onChange?: EventHandler<string, React.ChangeEvent>;
  onCustomEvent?: EventHandler<T, CustomEvent<T>>;
}

// 使用示例
const Component: React.FC<EnhancedProps<ClickEventData>> = ({ onClick }) => {
  const handleClick = (event: React.MouseEvent) => {
    const eventData: ClickEventData = {
      timestamp: Date.now(),
      source: 'component',
      x: event.clientX,
      y: event.clientY,
      target: event.currentTarget
    };

    if (onClick) {
      onClick(eventData, event);
    }
  };

  return <button onClick={handleClick}>Click me</button>;
};
```

### 2. 状态管理类型修复

#### 问题代码
```typescript
// 当前问题：使用 any 类型
subscribeWithSelector((set: any, get: any): HybridChatState => ({
  messages: [],
  currentAgent: null,
}));

interface StoreConfig {
  migrate?: (persistedState: any, version: number) => T | Promise<T>;
  config: any;
}
```

#### 修复方案
```typescript
// 定义状态类型
interface ChatState {
  messages: ChatMessage[];
  currentAgent: Agent | null;
  isLoading: boolean;
  error: string | null;
}

interface PersistedState {
  version: number;
  state: unknown;
  timestamp: number;
}

// 类型安全的状态管理器
interface StoreSetter<T> {
  (state: Partial<T> | ((prevState: T) => Partial<T>)): void;
}

interface StoreGetter<T> {
  (): T;
  <K extends keyof T>(key: K): T[K];
}

// 修复后的状态配置
interface StoreConfig<T> {
  name: string;
  version: number;
  migrate?: (persistedState: unknown, version: number) => T | Promise<T>;
  config: {
    storage?: Storage;
    serialize?: (state: T) => string;
    deserialize?: (str: string) => T;
    partialize?: (state: T) => Partial<T>;
  };
}

// 类型安全的状态创建函数
function createTypedStore<T>(
  initialState: T,
  config: StoreConfig<T>
) {
  return subscribeWithSelector((set: StoreSetter<T>, get: StoreGetter<T>): T => {
    return {
      ...initialState,
      setState: (updates: Partial<T>) => set(updates),
      resetState: () => set(initialState),
    };
  });
}

// 使用示例
const useChatStore = createTypedStore<ChatState>(
  {
    messages: [],
    currentAgent: null,
    isLoading: false,
    error: null,
  },
  {
    name: 'chat-store',
    version: 1,
    migrate: (persistedState: unknown, version: number): ChatState => {
      if (version === 1) {
        return persistedState as ChatState;
      }

      // 迁移逻辑
      const oldState = persistedState as { messages?: any[]; agent?: any };
      return {
        messages: oldState.messages?.map(normalizeMessage) ?? [],
        currentAgent: oldState.agent ? normalizeAgent(oldState.agent) : null,
        isLoading: false,
        error: null,
      };
    },
    config: {
      storage: localStorage,
      partialize: (state) => ({
        messages: state.messages,
        currentAgent: state.currentAgent,
      }),
    }
  }
);
```

### 3. API 响应类型修复

#### 问题代码
```typescript
// 当前问题：使用 any 类型
const handleApiResponse = (response: any) => {
  return response.data;
};

interface ApiResult {
  data: any;
  status: any;
}
```

#### 修复方案
```typescript
// 定义 API 响应类型
interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  code: string;
  timestamp: string;
}

interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// 具体的业务数据类型
interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: UserPreferences;
}

interface ChatData {
  id: string;
  messages: ChatMessage[];
  agent: Agent;
  createdAt: string;
  updatedAt: string;
}

// 类型安全的 API 处理器
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // 通用的请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  // 具体的 API 方法
  async getUser(userId: string): Promise<UserData> {
    const response = await this.request<UserData>(`/users/${userId}`);
    return response.data;
  }

  async getChat(chatId: string): Promise<ChatData> {
    const response = await this.request<ChatData>(`/chats/${chatId}`);
    return response.data;
  }

  async sendMessage(chatId: string, content: string): Promise<ChatData> {
    const response = await this.request<ChatData>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return response.data;
  }
}

// 类型安全的响应处理函数
function handleApiSuccess<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message);
  }
  return response.data;
}

function handleApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    return {
      success: false,
      message: error.message,
      code: 'CLIENT_ERROR',
      timestamp: new Date().toISOString(),
    };
  }

  return {
    success: false,
    message: 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
  };
}
```

## 🟢 P2 类型质量改进

### 1. 类型守卫系统

```typescript
// 类型守卫工具
export function isAgent(data: unknown): data is Agent {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'description' in data &&
    'model' in data &&
    'status' in data &&
    'provider' in data &&
    typeof (data as Agent).id === 'string' &&
    typeof (data as Agent).name === 'string' &&
    typeof (data as Agent).description === 'string' &&
    typeof (data as Agent).model === 'string' &&
    ['active', 'inactive', 'error', 'loading'].includes((data as Agent).status) &&
    typeof (data as Agent).provider === 'string'
  );
}

export function isChatMessage(data: unknown): data is ChatMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (('AI' in data && typeof (data as ChatMessage).AI === 'string') ||
     ('HUMAN' in data && typeof (data as ChatMessage).HUMAN === 'string'))
  );
}

export function isArrayOf<T>(
  data: unknown,
  guard: (item: unknown) => item is T
): data is T[] {
  return Array.isArray(data) && data.every(guard);
}

// 运行时类型验证器
export class TypeValidator {
  static validateAgent(data: unknown): Agent {
    if (!isAgent(data)) {
      throw new TypeError(`Invalid agent data: ${JSON.stringify(data)}`);
    }
    return data;
  }

  static validateChatMessage(data: unknown): ChatMessage {
    if (!isChatMessage(data)) {
      throw new TypeError(`Invalid chat message: ${JSON.stringify(data)}`);
    }
    return data;
  }

  static validateAgentArray(data: unknown): Agent[] {
    if (!isArrayOf(data, isAgent)) {
      throw new TypeError('Invalid agents array');
    }
    return data;
  }
}
```

### 2. 工具类型定义

```typescript
// 实用工具类型
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 深度只读类型
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// 深度可选类型
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 构建函数类型
type Constructor<T = {}> = new (...args: any[]) => T;
type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

// 异步类型
type AsyncReturnType<T extends (...args: any) => Promise<any>> =
  T extends (...args: any) => Promise<infer R> ? R : never;

// 条件类型示例
type NonNullable<T> = T extends null | undefined ? never : T;
type ValueOf<T> = T[keyof T];
type ArrayElement<T> = T extends (infer U)[] ? U : never;

// 字符串操作类型
type Capitalize<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Uppercase<First>}${Rest}`
  : S;

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
  : S;

// 函数类型
type EventHandler<T> = (event: T) => void;
type AsyncEventHandler<T> = (event: T) => Promise<void>;
type Predicate<T> = (value: T) => boolean;
type AsyncPredicate<T> = (value: T) => Promise<boolean>;
type Mapper<T, U> = (value: T, index: number) => U;
type AsyncMapper<T, U> = (value: T, index: number) => Promise<U>;
```

### 3. 配置类型安全

```typescript
// 配置系统类型
interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  features: {
    chat: boolean;
    voice: boolean;
    fileUpload: boolean;
    analytics: boolean;
  };
  ui: {
    theme: ThemeMode;
    language: 'zh-CN' | 'en-US';
    animations: boolean;
  };
}

// 配置验证器
class ConfigValidator {
  private static validateApi(config: unknown): AppConfig['api'] {
    if (typeof config !== 'object' || config === null) {
      throw new Error('API config must be an object');
    }

    const api = config as Record<string, unknown>;

    if (typeof api.baseUrl !== 'string') {
      throw new Error('API baseUrl must be a string');
    }

    if (typeof api.timeout !== 'number' || api.timeout <= 0) {
      throw new Error('API timeout must be a positive number');
    }

    if (typeof api.retries !== 'number' || api.retries < 0) {
      throw new Error('API retries must be a non-negative number');
    }

    return {
      baseUrl: api.baseUrl,
      timeout: api.timeout,
      retries: api.retries,
    };
  }

  private static validateFeatures(config: unknown): AppConfig['features'] {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Features config must be an object');
    }

    const features = config as Record<string, unknown>;

    return {
      chat: Boolean(features.chat),
      voice: Boolean(features.voice),
      fileUpload: Boolean(features.fileUpload),
      analytics: Boolean(features.analytics),
    };
  }

  private static validateUI(config: unknown): AppConfig['ui'] {
    if (typeof config !== 'object' || config === null) {
      throw new Error('UI config must be an object');
    }

    const ui = config as Record<string, unknown>;

    if (!['light', 'dark', 'auto'].includes(ui.theme as string)) {
      throw new Error('Invalid theme value');
    }

    if (!['zh-CN', 'en-US'].includes(ui.language as string)) {
      throw new Error('Invalid language value');
    }

    return {
      theme: ui.theme as ThemeMode,
      language: ui.language as 'zh-CN' | 'en-US',
      animations: Boolean(ui.animations),
    };
  }

  static validate(config: unknown): AppConfig {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Config must be an object');
    }

    const configObj = config as Record<string, unknown>;

    return {
      api: this.validateApi(configObj.api),
      features: this.validateFeatures(configObj.features),
      ui: this.validateUI(configObj.ui),
    };
  }
}

// 使用示例
const appConfig: AppConfig = ConfigValidator.validate({
  api: {
    baseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001',
    timeout: 5000,
    retries: 3,
  },
  features: {
    chat: true,
    voice: false,
    fileUpload: true,
    analytics: process.env.NODE_ENV === 'production',
  },
  ui: {
    theme: 'auto',
    language: 'zh-CN',
    animations: true,
  },
});
```

## 🔧 ESLint 类型规则配置

```json
// .eslintrc.js
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // 禁止使用 any
    '@typescript-eslint/no-explicit-any': 'error',

    // 禁止使用 implicit any
    '@typescript-eslint/no-implicit-any': 'error',

    // 要求明确的函数返回类型
    '@typescript-eslint/explicit-function-return-type': 'warn',

    // 禁止空的接口
    '@typescript-eslint/no-empty-interface': 'error',

    // 要求明确的变量类型
    '@typescript-eslint/no-inferrable-types': 'off',

    // 禁止使用 non-null 断言
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // 优先使用 type 而不是 interface
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

    // 一致的类型导入导出
    '@typescript-eslint/consistent-type-imports': 'error',

    // 避免 namespace 使用
    '@typescript-eslint/no-namespace': 'error',

    // 严格的布尔类型检查
    '@typescript-eslint/strict-boolean-expressions': 'warn',
  },
};
```

## 📋 使用检查清单

### 修复前检查
- [ ] 识别所有 any 类型使用位置
- [ ] 检查是否存在语法错误
- [ ] 验证接口定义的完整性
- [ ] 确认类型导入导出规范

### 修复过程
- [ ] 优先修复阻塞性语法错误
- [ ] 逐步替换关键路径的 any 类型
- [ ] 添加必要的类型守卫
- [ ] 更新相关的测试代码

### 修复后验证
- [ ] 运行 `tsc --noEmit` 确保无编译错误
- [ ] 运行 `eslint` 检查代码质量
- [ ] 运行测试确保功能正常
- [ ] 检查类型覆盖率是否提升

---

*本示例文档提供了具体的类型修复方案，建议按照优先级逐步实施修复。*