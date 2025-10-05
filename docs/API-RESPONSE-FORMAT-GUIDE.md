# API 响应格式规范与最佳实践

> **文档版本**: 1.0.0  
> **创建日期**: 2025-10-05  
> **最后更新**: 2025-10-05

---

## 📋 目录

1. [问题背景](#问题背景)
2. [统一响应格式](#统一响应格式)
3. [前端调用规范](#前端调用规范)
4. [常见错误与修复](#常见错误与修复)
5. [类型安全保障](#类型安全保障)
6. [测试验证](#测试验证)
7. [预防措施](#预防措施)

---

## 问题背景

### 发现的问题

在 2025-10-05 的认证系统修复中，发现了一个**前后端数据格式契约不一致**的严重问题：

**后端返回格式**:
```json
{
  "code": "SUCCESS",
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "1", "username": "admin", "role": "admin" },
    "expiresIn": 3600
  },
  "timestamp": "2025-10-05T03:51:09.873Z"
}
```

**前端错误代码** (`authApi.ts`):
```typescript
// ❌ 错误：直接解构 data，期望它就是业务数据
const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
return data; // 实际返回的是 { code, message, data, timestamp }
```

**影响**:
- ✅ 登录 API 返回 200 OK
- ❌ Token 未被存储到 `authStore`
- ❌ 后续请求缺少 `Authorization` header
- ❌ 管理后台 API 返回 401 Unauthorized

### 根本原因

1. **历史遗留**: `authApi.ts` 是早期编写的文件，未及时更新以适配统一响应格式
2. **类型约束不足**: 没有强制使用统一的 `ApiResponse<T>` 类型
3. **缺乏代码审查**: 这类问题应该在 PR review 中被发现
4. **测试覆盖不足**: 端到端测试未验证 token 存储逻辑

---

## 统一响应格式

### 后端响应结构

所有后端 API 都返回以下统一格式：

```typescript
interface ApiResponse<T> {
  code: string;      // 业务状态码，如 'SUCCESS', 'ERROR', 'INVALID_CREDENTIALS'
  message: string;   // 响应消息，用于日志或用户提示
  data: T;           // 业务数据（泛型）
  timestamp: string; // ISO 8601 格式的时间戳
}
```

### 成功响应示例

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "id": "123",
    "name": "示例数据"
  },
  "timestamp": "2025-10-05T03:51:09.873Z"
}
```

### 错误响应示例

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "用户名或密码错误",
  "data": null,
  "timestamp": "2025-10-05T03:51:09.873Z"
}
```

---

## 前端调用规范

### ✅ 正确的调用方式

#### 方式 1: 使用完整类型定义（推荐）

```typescript
import { ApiResponse } from '@/types/api';

export async function loginApi(username: string, password: string) {
  const response = await api.post<ApiResponse<LoginResponse>>(
    '/auth/login',
    { username, password }
  );
  return response.data.data; // 提取嵌套的 data 字段
}
```

#### 方式 2: 使用辅助函数

```typescript
import { extractData } from '@/types/api';

export async function loginApi(username: string, password: string) {
  const response = await api.post<ApiResponse<LoginResponse>>(
    '/auth/login',
    { username, password }
  );
  return extractData(response); // 自动提取 response.data.data
}
```

#### 方式 3: 内联类型定义

```typescript
export async function loginApi(username: string, password: string) {
  const response = await api.post<{
    code: string;
    message: string;
    data: LoginResponse;
  }>('/auth/login', { username, password });
  return response.data.data;
}
```

### ❌ 错误的调用方式

```typescript
// ❌ 错误 1: 直接解构 data
const { data } = await api.post<LoginResponse>('/auth/login', ...);
return data; // 返回的是整个响应体，不是业务数据

// ❌ 错误 2: 缺少类型定义
const { data } = await api.post('/auth/login', ...);
return data; // 没有类型约束，容易出错

// ❌ 错误 3: 类型定义错误
const { data } = await api.post<{ user: User }>('/auth/login', ...);
return data.user; // 期望 data 是 { user: User }，实际是 { code, message, data }
```

---

## 常见错误与修复

### 错误 1: Token 未存储

**症状**:
- 登录成功，但刷新页面后需要重新登录
- 后续 API 请求返回 401 Unauthorized

**原因**:
```typescript
// ❌ 错误代码
const { data } = await api.post<LoginResponse>('/auth/login', ...);
login(data); // data 是 { code, message, data }，不是 { token, user, expiresIn }
```

**修复**:
```typescript
// ✅ 正确代码
const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', ...);
login(response.data.data); // 正确提取 { token, user, expiresIn }
```

### 错误 2: 用户信息丢失

**症状**:
- 登录后无法获取用户信息
- 用户角色判断失败

**原因**:
```typescript
// ❌ 错误代码
const { data } = await api.get<{ user: User }>('/auth/profile');
return data.user; // data 是 { code, message, data }，没有 user 字段
```

**修复**:
```typescript
// ✅ 正确代码
const response = await api.get<ApiResponse<{ user: User }>>('/auth/profile');
return response.data.data.user; // 正确提取 user
```

### 错误 3: 分页数据处理错误

**症状**:
- 列表数据显示不完整
- 分页组件无法正常工作

**原因**:
```typescript
// ❌ 错误代码
const { data } = await api.get<{ items: T[]; total: number }>('/list');
return data.items; // data 是 { code, message, data }，没有 items 字段
```

**修复**:
```typescript
// ✅ 正确代码
const response = await api.get<ApiResponse<PaginatedData<T>>>('/list');
return response.data.data; // 返回 { items, total, page, pageSize }
```

---

## 类型安全保障

### 1. 使用统一的类型定义

在 `frontend/src/types/api.ts` 中定义了统一的类型：

```typescript
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
  timestamp: string;
}
```

### 2. 使用辅助函数

```typescript
// 提取业务数据
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}

// 提取分页数据
export function extractPaginatedData<T>(
  response: { data: ApiResponse<PaginatedData<T>> }
): PaginatedData<T> {
  return response.data.data;
}
```

### 3. 在 API 服务中强制使用

```typescript
// ✅ 推荐：所有 API 调用都使用 ApiResponse<T>
import { ApiResponse, extractData } from '@/types/api';

export async function getUser(id: string): Promise<User> {
  const response = await api.get<ApiResponse<User>>(`/users/${id}`);
  return extractData(response);
}
```

---

## 测试验证

### 1. 单元测试

```typescript
import { describe, it, expect, vi } from 'vitest';
import { loginApi } from './authApi';
import { api } from './api';

describe('authApi', () => {
  it('should extract token from nested data structure', async () => {
    // Mock API response
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        code: 'SUCCESS',
        message: '登录成功',
        data: {
          token: 'test-token',
          user: { id: '1', username: 'admin', role: 'admin' },
          expiresIn: 3600
        },
        timestamp: '2025-10-05T03:51:09.873Z'
      }
    });

    const result = await loginApi('admin', 'admin123');

    expect(result).toEqual({
      token: 'test-token',
      user: { id: '1', username: 'admin', role: 'admin' },
      expiresIn: 3600
    });
  });
});
```

### 2. 集成测试

```typescript
import { test, expect } from '@playwright/test';

test('login flow should store token correctly', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // 等待登录成功
  await page.waitForURL('**/home');

  // 验证 token 已存储
  const token = await page.evaluate(() => localStorage.getItem('auth.token'));
  expect(token).toBeTruthy();
  expect(token).toMatch(/^eyJ/); // JWT token 格式

  // 验证后续请求携带 Authorization header
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('/api/admin')),
    page.goto('http://localhost:3000/home')
  ]);

  const authHeader = request.headers()['authorization'];
  expect(authHeader).toMatch(/^Bearer eyJ/);
});
```

---

## 预防措施

### 1. 代码审查清单

在 PR review 时，检查以下项目：

- [ ] 所有 API 调用都使用 `ApiResponse<T>` 类型
- [ ] 正确提取 `response.data.data` 而不是 `response.data`
- [ ] 类型定义与后端响应格式一致
- [ ] 添加了相应的单元测试
- [ ] 更新了相关文档

### 2. ESLint 规则（建议）

创建自定义 ESLint 规则，检测不规范的 API 调用：

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'api-response-format': {
      meta: {
        type: 'problem',
        docs: {
          description: '强制使用统一的 API 响应格式',
        },
      },
      create(context) {
        return {
          // 检测 api.get/post/put/delete 调用
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'api' &&
              ['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name)
            ) {
              // 检查是否使用了 ApiResponse<T> 类型
              // ...
            }
          },
        };
      },
    },
  },
};
```

### 3. 类型检查脚本

在 CI/CD 中添加类型检查：

```bash
# 前端类型检查
npm run frontend:type-check

# 后端类型检查
npm run backend:lint
```

### 4. 文档维护

- 在 `README.md` 中添加 API 调用规范链接
- 在新人 onboarding 文档中强调此规范
- 定期 review 和更新此文档

### 5. 培训与分享

- 在团队会议中分享此次问题的根本原因
- 组织 TypeScript 类型安全培训
- 建立内部知识库，记录常见问题和解决方案

---

## 总结

### 核心原则

1. **统一响应格式**: 所有后端 API 都返回 `{ code, message, data, timestamp }`
2. **类型安全**: 使用 `ApiResponse<T>` 类型约束所有 API 调用
3. **正确提取数据**: 始终访问 `response.data.data` 而不是 `response.data`
4. **测试覆盖**: 为关键流程添加端到端测试

### 快速参考

```typescript
// ✅ 正确的 API 调用模板
import { ApiResponse, extractData } from '@/types/api';

export async function yourApi(): Promise<YourDataType> {
  const response = await api.get<ApiResponse<YourDataType>>('/your-endpoint');
  return extractData(response); // 或 response.data.data
}
```

---

## 相关文档

- [TypeScript 类型安全指南](./TYPE_SAFETY_GUIDE.md)
- [前端架构与测试规范](../.cursor/rules/04-frontend-architecture-testing.mdc)
- [API 契约演进与版本化](../.cursor/rules/api-contracts-versioning.mdc)
- [认证系统修复完整报告](./AUTHENTICATION-FIX-COMPLETE-2025-10-05.md)

---

**最后更新**: 2025-10-05  
**维护者**: LLMChat 开发团队  
**反馈**: 如发现问题或有改进建议，请提交 Issue 或 PR
