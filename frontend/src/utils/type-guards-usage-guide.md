# 类型守卫工具库使用指南

## 概述

本文档介绍LLMChat前端项目的完整类型守卫工具库，提供运行时类型验证、API响应验证、组件Props检查等功能，确保100%类型安全。

## 目录

1. [基础类型守卫](#基础类型守卫)
2. [高级类型守卫](#高级类型守卫)
3. [运行时类型验证](#运行时类型验证)
4. [API响应验证](#api响应验证)
5. [React组件Props验证](#react组件props验证)
6. [Store状态验证](#store状态验证)
7. [性能优化](#性能优化)
8. [最佳实践](#最佳实践)

## 基础类型守卫

基础类型守卫位于 `type-guards.ts`，提供常用的类型检查函数。

### 基本使用

```typescript
import { isString, isNumber, isObject, hasProperty } from '@/utils/type-guards';

// 检查基本类型
function processValue(value: unknown) {
  if (isString(value)) {
    // 这里 value 的类型是 string
    console.log(value.toUpperCase());
  } else if (isNumber(value)) {
    // 这里 value 的类型是 number
    console.log(value.toFixed(2));
  }
}

// 检查对象属性
function processUser(data: unknown) {
  if (isObject(data) && hasProperty(data, 'name')) {
    // 安全访问属性
    console.log(data.name);
  }
}
```

### 数组类型检查

```typescript
import { isArrayOf, filterByType, filterDefined } from '@/utils/type-guards';

// 检查数组元素类型
const isStringArray = isArrayOf(isString);
const mixedData: unknown[] = [1, 'text', 2, 'more'];

if (isStringArray(mixedData)) {
  // mixedData 的类型是 string[]
  mixedData.forEach(str => console.log(str.toUpperCase()));
}

// 过滤特定类型
const strings = filterByType(mixedData, isString); // string[]

// 过滤空值
const definedValues = filterDefined([1, null, 2, undefined, 3]); // [1, 2, 3]
```

### 枚举类型验证

```typescript
import { createEnumGuard } from '@/utils/type-guards';

type Status = 'active' | 'inactive' | 'pending';
const isStatus = createEnumGuard(['active', 'inactive', 'pending']);

function processStatus(status: unknown) {
  if (isStatus(status)) {
    // status 的类型是 Status
    console.log(`Status: ${status}`);
  }
}
```

## 高级类型守卫

高级类型守卫位于 `advanced-type-guards.ts`，提供复杂的对象和数组验证功能。

### 对象类型守卫

```typescript
import { createObjectGuard } from '@/utils/advanced-type-guards';

interface User {
  id: string;
  name: string;
  age?: number;
  email: string;
}

const isUser = createObjectGuard({
  id: { validator: isUUID, required: true },
  name: { validator: isString, required: true },
  age: { validator: isNumber, required: false, defaultValue: 0 },
  email: { validator: isEmail, required: true }
});

function processUser(data: unknown) {
  if (isUser(data)) {
    // data 的类型是 User
    console.log(`User: ${data.name}, Age: ${data.age}`);
  }
}
```

### 数组类型守卫增强

```typescript
import { createArrayGuard } from '@/utils/advanced-type-guards';

const isNonEmptyStringArray = createArrayGuard(isString, {
  minLength: 1,
  maxLength: 10,
  allowEmpty: false
});

function processTags(tags: unknown) {
  if (isNonEmptyStringArray(tags)) {
    // tags 的类型是 string[]
    console.log(`Tags: ${tags.join(', ')}`);
  }
}
```

### 联合类型守卫

```typescript
import { createUnionGuard, createLiteralGuard } from '@/utils/advanced-type-guards';

const isStringOrNumber = createUnionGuard([isString, isNumber]);
const isThemeMode = createLiteralGuard(['light', 'dark', 'auto'] as const);

function processValue(value: unknown) {
  if (isStringOrNumber(value)) {
    // value 的类型是 string | number
  }

  if (isThemeMode(value)) {
    // value 的类型是 'light' | 'dark' | 'auto'
  }
}
```

## 运行时类型验证

运行时类型验证器位于 `runtime-type-validator.ts`，提供链式API和丰富的验证功能。

### 基本验证器使用

```typescript
import { RuntimeTypeValidator, stringValidator, numberValidator } from '@/utils/runtime-type-validator';

// 创建验证器
const userValidator = RuntimeTypeValidator.create<User>()
  .required() // 确保值不为空
  .transform(value => {
    // 转换数据
    return {
      ...value,
      createdAt: new Date(value.createdAt)
    };
  })
  .validate(data => ({
    isValid: typeof data.id === 'string',
    data: data,
    errors: typeof data.id !== 'string' ? ['Invalid ID'] : []
  }));

// 使用验证器
const result = userValidator.test(userData);
if (result.isValid) {
  console.log(result.data); // 类型安全的 User 对象
} else {
  console.error(result.errors);
}

// 断言验证
userValidator.assert(userData); // 失败时抛出错误

// 安全解析
const user = userValidator.parse(userData); // 返回 User 对象或抛出错误
```

### 链式验证

```typescript
import { RuntimeTypeValidator, emailValidator, uuidValidator } from '@/utils/runtime-type-validator';

// 创建链式验证器
const complexValidator = RuntimeTypeValidator.create()
  .is(emailValidator, 'Must be a valid email')
  .default('default@example.com')
  .transform(email => email.toLowerCase())
  .pipe(
    RuntimeTypeValidator.create<string>()
      .required()
      .transform(email => ({ email, domain: email.split('@')[1] }))
  );

// 使用链式验证器
const result = complexValidator.test(inputValue);
```

### 数组验证

```typescript
import { arrayValidator } from '@/utils/runtime-type-validator';

// 创建数组验证器
const emailsValidator = arrayValidator(
  emailValidator(),
  {
    minLength: 1,
    maxLength: 5,
    allowEmpty: false
  }
);

// 验证数组
const emailsResult = emailsValidator.test(['user1@example.com', 'user2@example.com']);
```

### 对象验证

```typescript
import { objectValidatorFactory } from '@/utils/runtime-type-validator';

// 创建对象验证器
const profileValidator = objectValidatorFactory({
  id: uuidValidator().required(),
  name: RuntimeTypeValidator.create<string>().required(),
  age: RuntimeTypeValidator.create<number>().optional().default(18),
  emails: emailsValidator.required()
});

// 验证对象
const profileResult = profileValidator.test(profileData);
```

### 路径验证

```typescript
import { createPathValidator } from '@/utils/runtime-type-validator';

// 创建路径验证器
const validator = createPathValidator(userObject);

// 验证特定路径
validator.path('profile.email', emailValidator());
validator.path('settings.theme', enumValidator(['light', 'dark']));

// 获取路径值
const email = validator.get<string>('profile.email');
const safeEmail = validator.safeGet<string>('profile.invalid', 'default@email.com');
```

### 批量验证

```typescript
import { createBatchValidator } from '@/utils/runtime-type-validator';

// 创建批量验证器
const batchValidator = createBatchValidator()
  .add('user', userData, userValidator)
  .add('profile', profileData, profileValidator)
  .add('settings', settingsData, settingsValidator);

// 获取验证结果
const result = batchValidator.getResult();
if (result.isValid) {
  const validData = result.data; // { user, profile, settings }
} else {
  const errors = result.errors; // { user: [...], profile: [...] }
}
```

## API响应验证

API响应验证器位于 `api-type-validators.ts`，专门为API响应设计验证器。

### 基本API响应验证

```typescript
import { ApiResponseValidator, agentsListResponseValidator } from '@/utils/api-type-validators';

// 验证API响应
const response = await api.get('/agents');
const validation = ApiResponseValidator.safeValidate(response, agentsListResponseValidator);

if (validation.success) {
  const agents = validation.data; // Agent[]
  console.log(agents.map(agent => agent.name));
} else {
  console.error('API response validation failed:', validation.errors);
}
```

### 错误处理

```typescript
import { ApiResponseValidator } from '@/utils/api-type-validators';

// 检查错误响应
const response = await api.get('/agents');
if (ApiResponseValidator.isError(response)) {
  const error = ApiResponseValidator.extractError(response);
  console.error(`API Error [${error.code}]: ${error.message}`);
  if (error.details) {
    console.error('Details:', error.details);
  }
}
```

### 自定义API验证器

```typescript
import { createApiResponseValidator, agentValidator } from '@/utils/api-type-validators';

// 创建自定义验证器
const customAgentResponseValidator = createApiResponseValidator(
  objectValidatorFactory({
    agent: agentValidator.required(),
    metadata: RuntimeTypeValidator.create<Record<string, any>>().optional()
  })
);

// 使用自定义验证器
const response = await api.get('/agent/123');
const validation = ApiResponseValidator.safeValidate(response, customAgentResponseValidator);
```

### API客户端包装器

```typescript
import { createApiClientWrapper } from '@/utils/api-type-validators';

// 创建API客户端包装器
const apiClient = createApiClientWrapper({
  getAgents: agentsListResponseValidator,
  getAgent: agentDetailResponseValidator,
  createAgent: agentValidator,
  updateAgent: agentValidator
});

// 使用包装器
const agentsResult = apiClient.safeValidate('getAgents', await api.get('/agents'));
if (agentsResult.success) {
  const agents = agentsResult.data;
}
```

## React组件Props验证

React组件Props验证器位于 `react-props-validator.ts`，提供运行时Props验证功能。

### 基本Props验证

```typescript
import { PropsValidator, createPropsValidator } from '@/utils/react-props-validator';

// 创建Props验证器
const buttonPropsValidator = createPropsValidator<{
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}>({
  displayName: 'Button',
  strict: true,
  onError: (errors) => console.error('Button props error:', errors)
})
.required('variant', enumValidator(['primary', 'secondary']))
.required('size', enumValidator(['sm', 'md', 'lg']))
.optional('disabled', RuntimeTypeValidator.create<boolean>())
.optional('onClick', RuntimeTypeValidator.create<any>());

// 在组件中使用
function Button(props: unknown) {
  const [validatedProps, validation] = usePropsValidation(props, buttonPropsValidator);

  if (!validation.isValid) {
    return <div>Invalid props</div>;
  }

  return <button {...validatedProps}>Click me</button>;
}
```

### 使用HOC包装组件

```typescript
import { buttonPropsValidator } from '@/utils/react-props-validator';

// 原始组件
const RawButton = ({ variant, size, disabled, onClick, ...props }) => (
  <button
    className={`btn btn-${variant} btn-${size}`}
    disabled={disabled}
    onClick={onClick}
    {...props}
  >
    Click me
  </button>
);

// 包装组件
const Button = buttonPropsValidator().wrap(RawButton, {
  displayName: 'Button',
  forwardRef: true
});

// 使用包装后的组件
<Button variant="primary" size="md" onClick={handleClick} />
```

### 使用Hook

```typescript
import { useSafeProps, inputPropsValidator } from '@/utils/react-props-validator';

function Input(props: unknown) {
  const safeProps = useSafeProps(props, inputPropsValidator());

  return <input {...safeProps} />;
}

// 或者使用带验证结果的Hook
function InputWithValidation(props: unknown) {
  const [validatedProps, validation] = usePropsValidation(props, inputPropsValidator());

  if (!validation.isValid) {
    console.error('Input validation errors:', validation.errors);
  }

  return <input {...validatedProps} />;
}
```

### 复杂Props验证

```typescript
import { propsValidatorBuilder } from '@/utils/react-props-validator';

// 使用构建器创建复杂验证器
const tablePropsValidator = propsValidatorBuilder<TableProps>()
  .required('data', RuntimeTypeValidator.create<any[]>())
  .required('columns', RuntimeTypeValidator.create<any[]>())
  .optional('loading', RuntimeTypeValidator.create<boolean>())
  .optional('pagination', RuntimeTypeValidator.create<any>())
  .deprecated('oldProp', RuntimeTypeValidator.create<string>(), 'Use newProp instead')
  .build();

function DataTable(props: unknown) {
  const [validatedProps] = usePropsValidation(props, tablePropsValidator);

  return (
    <table>
      {/* 渲染表格 */}
    </table>
  );
}
```

## Store状态验证

Store状态验证器位于 `store-type-validator.ts`，专门为状态管理库设计验证功能。

### 创建Store验证器

```typescript
import { StoreTypeValidator, createStoreValidator } from '@/utils/store-type-validator';
import { RuntimeTypeValidator } from '@/utils/runtime-type-validator';

// 创建状态验证器
const chatStateValidator = createStoreValidator(
  RuntimeTypeValidator.create<ChatState>()
    .required()
    .validate(state => ({
      isValid: Array.isArray(state.messages) && typeof state.currentAgentId === 'string',
      data: state,
      errors: []
    })),
  {
    displayName: 'ChatStore',
    strict: true,
    enableAutoFix: true,
    migrationStrategies: [
      {
        version: '2.0.0',
        migrate: (oldState) => ({
          ...oldState,
          messages: oldState.messages || [],
          currentAgentId: oldState.selectedAgentId || null
        })
      }
    ]
  }
);

// 验证状态
const validation = chatStateValidator.validate(persistedState);
if (validation.isValid) {
  const chatState = validation.validatedState;
} else {
  console.error('Store validation failed:', validation.errors);
}
```

### Zustand集成

```typescript
import { createValidatedStore, useStoreValidation } from '@/utils/store-type-validator';

// 创建带有验证的Store
const useChatStore = createValidatedStore(
  {
    messages: [],
    currentAgentId: null,
    isLoading: false
  },
  (set, get) => ({
    addMessage: (message) => set(state => ({
      messages: [...state.messages, message]
    })),
    setCurrentAgent: (agentId) => set({ currentAgentId: agentId })
  }),
  chatStateValidator,
  {
    name: 'ChatStore',
    persist: {
      name: 'chat-storage'
    },
    devtools: true
  }
);

// 在组件中使用验证Hook
function ChatComponent() {
  useStoreValidation(useChatStore, chatStateValidator, {
    validateOnMount: true,
    validateOnChange: true,
    onError: (errors) => console.error('Store errors:', errors)
  });

  const messages = useChatStore(state => state.messages);
  const addMessage = useChatStore(state => state.addMessage);

  return (
    <div>
      {/* 聊天界面 */}
    </div>
  );
}
```

### 状态迁移

```typescript
import { StateMigrationStrategy, createStateMigrationStrategy } from '@/utils/store-type-validator';

// 创建状态迁移策略
const migrationStrategy = createStateMigrationStrategy<ChatState>()
  .addMigration('1.0.0', (oldState) => ({
    ...oldState,
    messages: oldState.chatHistory || [],
    currentAgentId: oldState.selectedAgent || null
  }))
  .addMigration('2.0.0', (oldState) => ({
    ...oldState,
    version: '2.0.0',
    settings: oldState.preferences || {}
  }));

// 执行迁移
const migratedState = migrationStrategy.migrate(oldState, '2.0.0');
```

### 状态快照

```typescript
import { createStateSnapshot, validateStateSnapshot } from '@/utils/store-type-validator';

// 创建状态快照
const snapshot = createStateSnapshot(currentState);
localStorage.setItem('chat-snapshot', JSON.stringify(snapshot));

// 验证和恢复快照
const snapshotData = JSON.parse(localStorage.getItem('chat-snapshot') || '{}');
const validation = validateStateSnapshot(snapshotData, chatStateValidator);

if (validation.isValid) {
  const restoredState = validation.validatedState;
  // 恢复状态
} else {
  console.error('Snapshot validation failed:', validation.errors);
}
```

## 性能优化

### 缓存验证器

```typescript
import { createCachedGuard } from '@/utils/advanced-type-guards';

// 创建带缓存的验证器
const cachedUserValidator = createCachedGuard(isUser, 100);

// 多次验证相同对象时提高性能
const result1 = cachedUserValidator(userData); // 执行验证
const result2 = cachedUserValidator(userData); // 从缓存获取结果
```

### 惰性验证器

```typescript
import { createLazyGuard } from '@/utils/advanced-type-guards';

// 创建惰性验证器（只在需要时创建验证器）
const lazyUserValidator = createLazyGuard(() => {
  // 复杂的验证器创建逻辑
  return createObjectGuard({
    id: { validator: isUUID, required: true },
    // ... 其他属性
  });
});

// 验证器只在第一次调用时创建
const result = lazyUserValidator(userData);
```

### 批量验证优化

```typescript
import { createBatchValidator } from '@/utils/runtime-type-validator';

// 使用批量验证器减少验证开销
const batchValidator = createBatchValidator()
  .add('item1', data1, validator1)
  .add('item2', data2, validator2)
  .add('item3', data3, validator3);

// 一次性获取所有验证结果
const result = batchValidator.getResult();
```

## 最佳实践

### 1. 分层验证策略

```typescript
// 在不同层级使用不同的验证策略

// API层：严格验证
const apiValidator = RuntimeTypeValidator.create<ApiResponse>()
  .required()
  .strict(true);

// Store层：宽松验证，支持迁移
const storeValidator = createStoreValidator(stateSchema, {
  enableAutoFix: true,
  migrationStrategies: [...]
});

// 组件层：宽松验证，提供默认值
const propsValidator = createPropsValidator({
  strict: false,
  allowUnknown: true
});
```

### 2. 错误处理策略

```typescript
// 统一的错误处理
class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[],
    public context?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 使用try-catch包装验证
function safeValidate<T>(validator: RuntimeTypeValidator<T>, data: unknown): T {
  try {
    return validator.parse(data);
  } catch (error) {
    if (error instanceof ValidationError) {
      // 处理验证错误
      console.error(`Validation failed in ${error.context}:`, error.errors);
      throw error;
    }
    throw error;
  }
}
```

### 3. 开发和生产环境策略

```typescript
// 开发环境：严格验证，详细错误信息
const devValidator = RuntimeTypeValidator.create<User>()
  .required()
  .strict(true);

// 生产环境：快速验证，简化错误信息
const prodValidator = RuntimeTypeValidator.create<User>()
  .required()
  .strict(false);

// 根据环境选择验证器
const userValidator = process.env.NODE_ENV === 'development' ? devValidator : prodValidator;
```

### 4. 类型守卫组合

```typescript
// 组合多个简单的类型守卫创建复杂验证
const isValidAgentData = (data: unknown): data is Agent => {
  return isObject(data) &&
    isUUID(data.id) &&
    isString(data.name) &&
    isEnumValue(data.status, ['active', 'inactive', 'error', 'loading']);
};

// 使用组合守卫
function processAgent(data: unknown) {
  if (isValidAgentData(data)) {
    // 类型安全的 Agent 对象
    console.log(`Processing agent: ${data.name} (${data.status})`);
  }
}
```

### 5. 测试策略

```typescript
// 为验证器编写测试
describe('UserValidator', () => {
  it('should validate valid user', () => {
    const validUser = {
      id: generateUUID(),
      name: 'John Doe',
      email: 'john@example.com'
    };

    const result = userValidator.test(validUser);
    expect(result.isValid).toBe(true);
    expect(result.data).toEqual(validUser);
  });

  it('should reject invalid user', () => {
    const invalidUser = { name: 'John Doe' }; // 缺少必需的id和email

    const result = userValidator.test(invalidUser);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Required property \'id\' is missing');
  });
});
```

## 总结

类型守卫工具库提供了完整的运行时类型验证解决方案，确保LLMChat前端项目的类型安全：

- **基础类型守卫**：提供常用的类型检查函数
- **高级类型守卫**：支持复杂的对象和数组验证
- **运行时验证器**：提供链式API和丰富的验证功能
- **API响应验证**：专门为API响应设计验证器
- **React组件验证**：确保组件Props的类型安全
- **Store状态验证**：为状态管理提供验证支持

通过合理使用这些工具，可以在运行时捕获类型错误，提高应用的稳定性和用户体验。