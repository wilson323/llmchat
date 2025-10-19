# 可选属性访问安全化指南

## 概述

本指南提供了在 TypeScript 严格模式下安全处理可选属性的最佳实践，旨在消除运行时错误并提高代码质量。

## 核心原则

### 1. 零容忍政策
- **禁止直接访问可选属性**: `obj.property` 是不安全的
- **强制使用安全访问模式**: `obj?.property` 或工具函数
- **编译时验证**: 所有可选属性访问必须经过类型检查

### 2. 防御性编程
- **假设数据不可信**: 总是验证外部数据
- **提供默认值**: 为所有可选属性提供合理的默认值
- **类型守卫**: 使用运行时检查确保类型安全

### 3. 可读性优先
- **清晰的意图**: 代码应该明确表达安全访问的意图
- **一致性**: 在整个项目中使用相同的安全访问模式
- **文档化**: 为复杂的数据访问逻辑提供文档

## 安全访问模式

### 基础可选属性访问

#### ❌ 危险模式
```typescript
// 直接访问 - 可能导致运行时错误
const userName = user.name;            // 错误：Object is possibly 'undefined'
const userAge = user.profile.age;      // 错误：Object is possibly 'undefined'
```

#### ✅ 安全模式
```typescript
// 可选链操作符
const userName = user?.name;
const userAge = user?.profile?.age;

// 使用空值合并运算符提供默认值
const userName = user?.name ?? 'Anonymous';
const userAge = user?.profile?.age ?? 0;

// 使用安全属性访问工具
import { safeGet, safeGetDeep } from '@/utils/safePropertyAccess';

const userName = safeGet(user, 'name', 'Anonymous');
const userAge = safeGetDeep(user, 'profile.age', 0);
```

### 数组访问安全化

#### ❌ 危险模式
```typescript
// 数组索引访问可能越界
const firstItem = items[0];              // 错误：Object is possibly 'undefined'
const lastItem = items[items.length];    // 错误：可能越界
```

#### ✅ 安全模式
```typescript
// 使用可选链和空值合并
const firstItem = items?.[0];
const lastItem = items?.[items.length - 1];

// 使用数组的 at 方法（支持负索引）
const firstItem = items?.at(0);
const lastItem = items?.at(-1);

// 提供默认值
const firstItem = items?.[0] ?? null;
```

### 函数参数安全化

#### ❌ 危险模式
```typescript
// 函数参数可能为 undefined
function processUser(user: User | undefined) {
  console.log(user.name);               // 错误：Object is possibly 'undefined'
}
```

#### ✅ 安全模式
```typescript
// 使用类型守卫
function processUser(user: User | undefined) {
  if (!user) return;
  console.log(user.name);               // 安全：user 已确保不为 undefined
}

// 使用默认参数
function processUser(user: User = DEFAULT_USER) {
  console.log(user.name);               // 安全：user 有默认值
}

// 使用解构和默认值
function processUser({ name = 'Anonymous' }: User | undefined) {
  console.log(name);                    // 安全：name 有默认值
}
```

## 工具函数使用指南

### safePropertyAccess 工具库

#### 基础工具函数
```typescript
import { safeGet, safeGetDeep, safeGetMultiple } from '@/utils/safePropertyAccess';

// 单属性安全访问
const userName = safeGet(user, 'name', 'Anonymous');
const userEmail = safeGet(user, 'email', '');

// 深度属性访问
const theme = safeGetDeep(user, 'preferences.theme', 'light');
const notificationEnabled = safeGetDeep(user, 'preferences.notifications', false);

// 批量属性访问
const userInfo = safeGetMultiple(user, [
  { key: 'name', defaultValue: 'Anonymous' },
  { key: 'email', defaultValue: '' },
  { key: 'age', defaultValue: 0 }
]);
```

#### 消息数据专用工具
```typescript
import { safeGetMessageUserProfile, safeGetUserPreference } from '@/utils/safePropertyAccess';

// 安全获取消息用户配置文件
const userProfile = safeGetMessageUserProfile(message);
if (userProfile) {
  console.log('User:', userProfile.name);

  // 安全获取用户偏好
  const theme = safeGetUserPreference(userProfile, 'theme', 'light');
  const language = safeGetUserPreference(userProfile, 'language', 'zh-CN');
}
```

#### 智能体配置专用工具
```typescript
import { safeGetAgentMetadata, safeGetAgentSetting, safeGetAgentUI } from '@/utils/safePropertyAccess';

// 安全获取智能体元数据
const metadata = safeGetAgentMetadata(agent);
console.log('Agent version:', metadata.version);

// 安全获取智能体设置
const temperature = safeGetAgentSetting(agent, 'temperature', 0.7);
const maxTokens = safeGetAgentSetting(agent, 'maxTokens', 2048);

// 安全获取智能体UI配置
const color = safeGetAgentUI(agent, 'color', '#007bff');
const icon = safeGetAgentUI(agent, 'icon', 'bot');
```

#### UI状态专用工具
```typescript
import { safeGetUIState, safeGetPagination, safeGetSelectedIds } from '@/utils/safePropertyAccess';

// 安全获取UI状态
const uiState = safeGetUIState(componentState);
console.log('Loading:', uiState.loading);
console.log('Error:', uiState.error);

// 安全获取分页信息
const pagination = safeGetPagination(componentState);
console.log('Page:', pagination.page);
console.log('Total items:', pagination.total);

// 安全获取选中项
const selectedIds = safeGetSelectedIds(componentState);
console.log('Selected:', selectedIds);
```

### 类型守卫使用指南

#### 基础类型守卫
```typescript
import { isString, isNumber, isPlainObject, isValidEmail } from '@/utils/typeGuards';

function processData(data: unknown) {
  if (isString(data)) {
    // data 在这里被推断为 string
    console.log(data.toUpperCase());
  }

  if (isNumber(data)) {
    // data 在这里被推断为 number
    console.log(data.toFixed(2));
  }

  if (isPlainObject(data)) {
    // data 在这里被推断为 Record<string, unknown>
    console.log(Object.keys(data));
  }
}
```

#### 复杂类型守卫
```typescript
import { isValidUserProfile, hasValidUserProfile, isValidAgent } from '@/utils/typeGuards';

function processMessage(message: unknown) {
  if (hasValidUserProfile(message)) {
    // message.userProfile 在这里被推断为 UserProfile
    console.log('User:', message.userProfile.name);
  }
}

function processAgent(agent: unknown) {
  if (isValidAgent(agent)) {
    // agent 在这里被推断为 Agent
    console.log('Agent:', agent.name);

    if (agent.metadata) {
      console.log('Version:', agent.metadata.version);
    }
  }
}
```

## 特定场景处理

### 1. API 响应处理

#### ❌ 危险模式
```typescript
async function fetchUser(id: string): Promise<User> {
  const response = await api.get(`/users/${id}`);
  return response.data;  // 可能返回 undefined 或不完整数据
}

function displayUser(user: User) {
  console.log(user.name);        // 可能导致运行时错误
  console.log(user.profile.age); // 可能导致运行时错误
}
```

#### ✅ 安全模式
```typescript
async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await api.get(`/users/${id}`);
    return isValidUserProfile(response.data) ? response.data : null;
  } catch {
    return null;
  }
}

function displayUser(user: User | null) {
  if (!user) {
    console.log('User not found');
    return;
  }

  const userName = user.name;
  const userAge = user.profile?.age ?? 'Unknown';

  console.log(userName);
  console.log('Age:', userAge);
}
```

### 2. React 组件中的属性访问

#### ❌ 危险模式
```typescript
function UserProfile({ user }: { user: User | undefined }) {
  return (
    <div>
      <h1>{user.name}</h1>                    {/* 错误：Object is possibly 'undefined' */}
      <p>{user.profile.bio}</p>               {/* 错误：Object is possibly 'undefined' */}
    </div>
  );
}
```

#### ✅ 安全模式
```typescript
import { safeGet, safeGetDeep } from '@/utils/safePropertyAccess';

function UserProfile({ user }: { user: User | undefined }) {
  const userName = safeGet(user, 'name', 'Anonymous User');
  const userBio = safeGetDeep(user, 'profile.bio', 'No bio available');
  const userAvatar = safeGetDeep(user, 'profile.avatar', '/default-avatar.png');

  return (
    <div>
      <h1>{userName}</h1>
      <img src={userAvatar} alt={`${userName}'s avatar`} />
      <p>{userBio}</p>
    </div>
  );
}
```

### 3. 状态管理中的数据访问

#### ❌ 危险模式
```typescript
function useUserData() {
  const { state } = useContext(UserContext);

  return {
    userName: state.user.name,           // 错误：Object is possibly 'undefined'
    userSettings: state.user.settings    // 错误：Object is possibly 'undefined'
  };
}
```

#### ✅ 安全模式
```typescript
import { safeGetDeep } from '@/utils/safePropertyAccess';

function useUserData() {
  const { state } = useContext(UserContext);

  return {
    userName: safeGetDeep(state, 'user.name', 'Guest'),
    userTheme: safeGetDeep(state, 'user.settings.theme', 'light'),
    userNotifications: safeGetDeep(state, 'user.settings.notifications', true)
  };
}
```

## 错误处理和调试

### 常见错误模式及解决方案

#### 1. "Object is possibly 'undefined'"
```typescript
// ❌ 错误
const value = obj.property;

// ✅ 解决方案
const value = obj?.property ?? defaultValue;
// 或
const value = safeGet(obj, 'property', defaultValue);
```

#### 2. "Property 'property' does not exist on type"
```typescript
// ❌ 错误
const value = (obj as any).property;

// ✅ 解决方案
if (hasProperty(obj, 'property')) {
  const value = obj.property;  // 类型安全
}
// 或
const value = safeGet(obj, 'property' as any, defaultValue);
```

#### 3. "Cannot read property 'property' of undefined" (运行时错误)
```typescript
// ❌ 错误
const value = obj.nested.property;

// ✅ 解决方案
const value = obj?.nested?.property ?? defaultValue;
// 或
const value = safeGetDeep(obj, 'nested.property', defaultValue);
```

### 调试技巧

#### 1. 使用类型断言调试
```typescript
// 临时调试 - 在确保安全的情况下
const value = obj!.property;  // 非空断言，仅在你确定值存在时使用

// 更好的调试方式
if (obj) {
  console.log('Object exists:', Object.keys(obj));
  const value = obj.property;
}
```

#### 2. 添加运行时检查
```typescript
function debugAccess<T>(obj: T | undefined, key: keyof T, defaultValue: T[keyof T]) {
  console.log(`Accessing ${String(key)} on:`, obj);
  const result = safeGet(obj, key, defaultValue);
  console.log(`Result:`, result);
  return result;
}
```

## 性能考虑

### 最佳实践

1. **避免过度嵌套的可选链**
   ```typescript
   // 可接受
   const value = obj?.a?.b?.c;

   // 更好的方式 - 分步访问，便于调试
   const a = obj?.a;
   const b = a?.b;
   const c = b?.c;
   ```

2. **缓存频繁访问的属性**
   ```typescript
   // ❌ 重复计算
   function processData(obj: ComplexObject | undefined) {
     const result1 = safeGetDeep(obj, 'a.b.c.d', 'default1');
     const result2 = safeGetDeep(obj, 'a.b.c.e', 'default2');
     const result3 = safeGetDeep(obj, 'a.b.c.f', 'default3');
   }

   // ✅ 缓存中间结果
   function processData(obj: ComplexObject | undefined) {
     const abc = safeGetDeep(obj, 'a.b.c', {});
     const result1 = safeGet(abc, 'd', 'default1');
     const result2 = safeGet(abc, 'e', 'default2');
     const result3 = safeGet(abc, 'f', 'default3');
   }
   ```

3. **使用适当的默认值**
   ```typescript
   // ❌ 不合适的默认值
   const count = safeGet(obj, 'count', null);  // 可能导致类型问题

   // ✅ 合适的默认值
   const count = safeGet(obj, 'count', 0);     // 类型一致的默认值
   ```

## 代码审查检查清单

### 提交前检查

- [ ] 所有可选属性访问都使用了安全模式
- [ ] 外部数据都有适当的类型守卫
- [ ] 提供了合理的默认值
- [ ] 没有使用 `as any` 绕过类型检查
- [ ] 没有使用非空断言 `!` 除非绝对必要
- [ ] 错误处理覆盖了所有边界情况
- [ ] 代码通过了 TypeScript 严格模式检查

### 审查要点

1. **类型安全**
   - 确保所有可选属性访问都是类型安全的
   - 检查是否有适当的类型守卫
   - 验证默认值的类型正确性

2. **运行时安全**
   - 确保外部 API 数据有验证
   - 检查错误处理的完整性
   - 验证边界情况的处理

3. **代码质量**
   - 确保代码意图清晰
   - 检查是否遵循项目的一致性标准
   - 验证是否有适当的文档和注释

## 测试策略

### 单元测试

```typescript
describe('safe property access', () => {
  it('should handle undefined objects', () => {
    expect(safeGet(undefined, 'name', 'default')).toBe('default');
    expect(safeGetDeep(undefined, 'a.b.c', 'default')).toBe('default');
  });

  it('should handle missing properties', () => {
    const obj = { a: 1 };
    expect(safeGet(obj, 'missing', 'default')).toBe('default');
    expect(safeGetDeep(obj, 'a.missing', 'default')).toBe('default');
  });

  it('should return existing values', () => {
    const obj = { name: 'John', profile: { age: 30 } };
    expect(safeGet(obj, 'name', 'default')).toBe('John');
    expect(safeGetDeep(obj, 'profile.age', 0)).toBe(30);
  });
});
```

### 集成测试

```typescript
describe('type guards integration', () => {
  it('should validate user profiles', () => {
    const validUser = { id: '123', name: 'John', email: 'john@example.com' };
    const invalidUser = { id: '123', email: 'invalid-email' };

    expect(isValidUserProfile(validUser)).toBe(true);
    expect(isValidUserProfile(invalidUser)).toBe(false);
  });

  it('should handle API responses safely', async () => {
    const mockResponse = { data: { id: '123', name: 'John' } };
    jest.spyOn(api, 'get').mockResolvedValue(mockResponse);

    const user = await fetchUser('123');
    expect(user).toEqual({ id: '123', name: 'John' });
  });
});
```

## 总结

通过遵循本指南的最佳实践，您可以：

1. **消除运行时错误**: 通过安全的属性访问模式避免 undefined 错误
2. **提高代码质量**: 通过类型守卫和验证确保数据完整性
3. **增强可维护性**: 通过一致的模式和清晰的代码意图
4. **改善开发体验**: 通过工具函数和类型检查减少调试时间

记住：**类型安全不是限制，而是保护**。投资于安全的代码模式将在项目的整个生命周期中带来回报。