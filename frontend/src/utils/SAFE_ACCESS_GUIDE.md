# SafeAccess 使用指南

## 概述

SafeAccess是一个全面的可选属性安全访问工具类，旨在解决TypeScript中可选属性访问可能导致的运行时错误。它提供了类型安全的属性访问、运行时类型验证和错误处理机制。

## 核心功能

### 1. 类型守卫函数

```typescript
import { SafeAccess } from '@/utils/SafeAccess';

// 基础类型检查
SafeAccess.isValidString(value)     // 检查是否为有效字符串
SafeAccess.isValidNumber(value)     // 检查是否为有效数字
SafeAccess.isValidArray(value)      // 检查是否为有效数组
SafeAccess.isValidObject(value)     // 检查是否为有效对象
SafeAccess.isValidDate(value)       // 检查是否为有效日期
SafeAccess.isValidBoolean(value)    // 检查是否为有效布尔值
SafeAccess.isNullOrUndefined(value) // 检查是否为null或undefined
```

### 2. 安全属性访问

```typescript
// 基础用法
const user = { name: 'John', profile: { age: 30, settings: { theme: 'dark' } } };

// 安全获取嵌套属性
const theme = SafeAccess.getString(user, 'profile.settings.theme', 'light');
const age = SafeAccess.getNumber(user, 'profile.age', 0);
const hasSettings = SafeAccess.getBoolean(user, 'profile.settings.enabled', false);

// 数组访问
const tags = SafeAccess.getArray(user, 'profile.tags', []);

// 对象访问
const settings = SafeAccess.getObject(user, 'profile.settings', {});
```

### 3. 运行时类型验证

```typescript
// 字符串验证
const stringValidation = SafeAccess.validateString(input, {
  required: true,
  minLength: 3,
  maxLength: 50,
  pattern: /^[a-zA-Z]+$/,
  allowedValues: ['admin', 'user', 'guest']
});

// 数字验证
const numberValidation = SafeAccess.validateNumber(age, {
  required: true,
  min: 0,
  max: 120,
  customValidator: (value) => value % 2 === 0 || '年龄必须是偶数'
});

// 数组验证
const arrayValidation = SafeAccess.validateArray(items, {
  required: true,
  minLength: 1,
  maxLength: 10,
  itemValidator: (item) => SafeAccess.validateString(item, { required: true })
});
```

### 4. 安全执行和错误处理

```typescript
// 安全执行同步函数
const result = SafeAccess.execute(
  () => JSON.parse(jsonString),
  {},
  (error) => console.error('JSON解析失败:', error.message)
);

// 安全执行异步函数
const asyncResult = await SafeAccess.executeAsync(
  () => fetch('/api/data').then(res => res.json()),
  null,
  (error) => console.error('API调用失败:', error.message)
);

// 安全解析
const parsed = SafeAccess.parseJSON('{"key": "value"}', {});
const number = SafeAccess.parseNumber('123', 0);
const integer = SafeAccess.parseInt('123.45', 0);
```

## 最佳实践

### 1. 替换不安全的可选链访问

**❌ 不安全的写法:**
```typescript
const username = user?.profile?.name || '';
const age = user?.profile?.age || 0;
const isActive = user?.profile?.settings?.active ?? false;
```

**✅ 安全的写法:**
```typescript
const username = SafeAccess.getString(user, 'profile.name', '');
const age = SafeAccess.getNumber(user, 'profile.age', 0);
const isActive = SafeAccess.getBoolean(user, 'profile.settings.active', false);
```

### 2. 处理API响应数据

```typescript
interface ApiResponse {
  data?: {
    users?: Array<{
      id?: string;
      name?: string;
      profile?: {
        age?: number;
        settings?: {
          theme?: string;
        };
      };
    }>;
  };
}

function processApiResponse(response: ApiResponse) {
  const users = SafeAccess.getArray(response, 'data.users', []);

  return users.map(user => ({
    id: SafeAccess.getString(user, 'id', ''),
    name: SafeAccess.getString(user, 'name', '未知用户'),
    age: SafeAccess.getNumber(user, 'profile.age', 0),
    theme: SafeAccess.getString(user, 'profile.settings.theme', 'light')
  }));
}
```

### 3. 处理表单数据

```typescript
function validateFormData(formData: unknown) {
  const nameValidation = SafeAccess.validateString(
    SafeAccess.get(formData, 'name'),
    { required: true, minLength: 2, maxLength: 50 }
  );

  const emailValidation = SafeAccess.validateString(
    SafeAccess.get(formData, 'email'),
    {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      customValidator: (value) => !value.includes('admin') || '邮箱不能包含admin'
    }
  );

  const ageValidation = SafeAccess.validateNumber(
    SafeAccess.get(formData, 'age'),
    { required: true, min: 18, max: 100 }
  );

  const errors = [
    ...nameValidation.errors,
    ...emailValidation.errors,
    ...ageValidation.errors
  ];

  return { isValid: errors.length === 0, errors };
}
```

### 4. 处理LocalStorage数据

```typescript
function getStoredSettings() {
  try {
    const stored = localStorage.getItem('app-settings');
    if (!stored) return {};

    const parsed = SafeAccess.parseJSON(stored, {});

    return {
      theme: SafeAccess.getString(parsed, 'theme', 'light'),
      language: SafeAccess.getString(parsed, 'language', 'zh-CN'),
      notifications: SafeAccess.getBoolean(parsed, 'notifications', true),
      autoSave: SafeAccess.getBoolean(parsed, 'autoSave', false)
    };
  } catch {
    return {};
  }
}
```

## 常见使用场景

### 1. 处理配置对象

```typescript
interface AppConfig {
  api?: {
    baseUrl?: string;
    timeout?: number;
    retries?: number;
  };
  ui?: {
    theme?: string;
    language?: string;
    animations?: boolean;
  };
}

function createAppConfig(rawConfig: unknown) {
  return {
    api: {
      baseUrl: SafeAccess.getString(rawConfig, 'api.baseUrl', 'https://api.example.com'),
      timeout: SafeAccess.getNumber(rawConfig, 'api.timeout', 5000),
      retries: SafeAccess.getNumber(rawConfig, 'api.retries', 3)
    },
    ui: {
      theme: SafeAccess.getString(rawConfig, 'ui.theme', 'light'),
      language: SafeAccess.getString(rawConfig, 'ui.language', 'zh-CN'),
      animations: SafeAccess.getBoolean(rawConfig, 'ui.animations', true)
    }
  };
}
```

### 2. 处理路由参数

```typescript
function useRouteParams() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  return {
    page: SafeAccess.parseNumber(searchParams.get('page'), 1),
    limit: SafeAccess.parseNumber(searchParams.get('limit'), 20),
    filter: searchParams.get('filter') || '',
    sort: searchParams.get('sort') || 'createdAt'
  };
}
```

### 3. 处理事件数据

```typescript
function handleEvent(event: unknown) {
  const eventType = SafeAccess.getString(event, 'type', '');
  const payload = SafeAccess.getObject(event, 'payload', {});

  switch (eventType) {
    case 'user_login':
      const userId = SafeAccess.getString(payload, 'userId', '');
      const timestamp = SafeAccess.getDate(payload, 'timestamp');
      console.log(`用户 ${userId} 在 ${timestamp} 登录`);
      break;

    case 'error':
      const error = SafeAccess.getString(payload, 'error', '未知错误');
      const stack = SafeAccess.getString(payload, 'stack', '');
      console.error(`错误: ${error}\n${stack}`);
      break;

    default:
      console.warn('未知事件类型:', eventType);
  }
}
```

## 性能考虑

1. **避免过度验证**: 只在数据边界（如API响应、用户输入）进行验证
2. **缓存验证结果**: 对于重复验证的数据，可以缓存验证结果
3. **使用合适的默认值**: 提供合理的默认值可以减少后续的检查
4. **批量操作**: 对于数组数据，使用批量验证而不是逐个验证

## 错误处理

SafeAccess提供了多层错误处理机制：

1. **静默失败**: 大部分函数提供默认值，避免程序中断
2. **错误回调**: `safeExecute`和`safeExecuteAsync`支持错误回调
3. **验证结果**: 验证函数返回详细的错误信息
4. **控制台输出**: 所有错误都会输出到控制台，便于调试

## 与现有代码集成

1. **渐进式替换**: 可以逐步替换现有的不安全访问
2. **包装现有代码**: 可以包装现有的不安全函数
3. **类型兼容**: 与现有TypeScript类型完全兼容
4. **零依赖**: 不依赖任何第三方库，可以安全集成

## 测试建议

```typescript
describe('SafeAccess', () => {
  it('should safely access nested properties', () => {
    const data = { user: { profile: { name: 'John' } } };

    expect(SafeAccess.getString(data, 'user.profile.name')).toBe('John');
    expect(SafeAccess.getString(data, 'user.profile.email', '')).toBe('');
    expect(SafeAccess.getString(data, 'user.missing.path', 'default')).toBe('default');
  });

  it('should validate data correctly', () => {
    const result = SafeAccess.validateString('test', {
      required: true,
      minLength: 3,
      maxLength: 5
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle errors gracefully', () => {
    const result = SafeAccess.execute(() => {
      throw new Error('Test error');
    }, 'default');

    expect(result).toBe('default');
  });
});
```

通过使用SafeAccess，你可以显著提高代码的健壮性和类型安全性，减少运行时错误，并提供更好的用户体验。