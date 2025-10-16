# LLMChat API 错误代码规范

**版本**: 1.0.0  
**创建日期**: 2025-01-16  
**状态**: 生效

---

## 错误响应格式

所有API错误必须返回统一格式：

```typescript
{
  success: false,
  error: {
    code: string;        // 错误代码（见下方列表）
    message: string;     // 用户友好的错误消息
    details?: unknown;   // 仅开发环境返回详细信息
  },
  timestamp: string;     // ISO 8601格式
}
```

---

## HTTP状态码使用规范

| HTTP Code | 使用场景 | 说明 |
|-----------|---------|------|
| 200 | 成功 | 请求成功处理 |
| 201 | 创建成功 | 资源创建成功 |
| 400 | 请求错误 | 参数验证失败、格式错误 |
| 401 | 未认证 | Token缺失、无效或过期 |
| 403 | 无权限 | 已认证但无操作权限 |
| 404 | 资源不存在 | 请求的资源未找到 |
| 409 | 冲突 | 资源冲突（如重复邮箱） |
| 422 | 语义错误 | 请求格式正确但语义错误 |
| 429 | 频率限制 | 超出速率限制 |
| 500 | 服务器错误 | 内部服务器错误 |
| 502 | 网关错误 | 上游服务错误 |
| 503 | 服务不可用 | 服务临时不可用 |

---

## 错误代码列表

### 认证相关 (AUTH_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| AUTH_INVALID_CREDENTIALS | 401 | 邮箱或密码错误 | 登录凭据不正确 |
| AUTH_INVALID_TOKEN | 401 | 认证令牌无效 | JWT验证失败 |
| AUTH_TOKEN_EXPIRED | 401 | 认证令牌已过期 | JWT已过期 |
| AUTH_TOKEN_MISSING | 401 | 缺少认证令牌 | 请求头无Token |
| AUTH_REFRESH_FAILED | 401 | Token刷新失败 | Refresh token无效 |
| AUTH_ALREADY_EXISTS | 409 | 该邮箱已被注册 | 注册时邮箱重复 |
| AUTH_PERMISSION_DENIED | 403 | 权限不足 | 非管理员访问管理API |

**实现示例**:
```typescript
// backend/src/middleware/jwtAuth.ts
if (!token) {
  return res.status(401).json({
    success: false,
    error: {
      code: 'AUTH_TOKEN_MISSING',
      message: '缺少认证令牌',
    },
    timestamp: new Date().toISOString(),
  });
}
```

---

### 验证相关 (VALIDATION_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| VALIDATION_REQUIRED_FIELD | 400 | 缺少必需字段: {field} | 必需参数缺失 |
| VALIDATION_INVALID_FORMAT | 400 | 字段格式错误: {field} | 格式验证失败 |
| VALIDATION_INVALID_EMAIL | 400 | 邮箱格式不正确 | 邮箱验证失败 |
| VALIDATION_PASSWORD_WEAK | 400 | 密码强度不足 | 密码不符合要求 |
| VALIDATION_MESSAGE_TOO_LONG | 400 | 消息长度超出限制 | 消息>10000字符 |
| VALIDATION_MESSAGE_EMPTY | 400 | 消息内容不能为空 | 空消息 |

**实现示例**:
```typescript
// backend/src/middleware/validateInput.ts
if (!req.body.message || req.body.message.trim() === '') {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_MESSAGE_EMPTY',
      message: '消息内容不能为空',
    },
    timestamp: new Date().toISOString(),
  });
}
```

---

### 智能体相关 (AGENT_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| AGENT_NOT_FOUND | 404 | 智能体不存在 | 请求的智能体ID无效 |
| AGENT_INACTIVE | 503 | 智能体当前不可用 | 智能体健康检查失败 |
| AGENT_CONFIG_INVALID | 400 | 智能体配置无效 | 配置验证失败 |
| AGENT_API_ERROR | 502 | 智能体API调用失败 | 上游AI服务错误 |
| AGENT_TIMEOUT | 504 | 智能体响应超时 | 请求超时 |

---

### 会话相关 (SESSION_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| SESSION_NOT_FOUND | 404 | 会话不存在 | 请求的会话ID无效 |
| SESSION_UNAUTHORIZED | 403 | 无权访问此会话 | 会话不属于当前用户 |
| SESSION_LIMIT_EXCEEDED | 429 | 会话数量超出限制 | 用户创建过多会话 |

---

### 资源相关 (RESOURCE_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| RESOURCE_NOT_FOUND | 404 | 请求的资源不存在 | 通用404错误 |
| RESOURCE_CONFLICT | 409 | 资源冲突 | 通用409错误 |

---

### 速率限制 (RATE_LIMIT_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| RATE_LIMIT_EXCEEDED | 429 | 请求过于频繁，请稍后再试 | 超出速率限制 |

**响应头**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705392000
Retry-After: 60
```

---

### 系统相关 (SYSTEM_*)

| 错误代码 | HTTP | 消息 | 场景 |
|---------|------|------|------|
| SYSTEM_INTERNAL_ERROR | 500 | 内部服务器错误 | 未预期的服务器错误 |
| SYSTEM_DATABASE_ERROR | 500 | 数据库操作失败 | 数据库连接或查询错误 |
| SYSTEM_REDIS_ERROR | 500 | 缓存服务错误 | Redis操作失败 |
| SYSTEM_CONFIG_ERROR | 500 | 配置加载失败 | 配置文件错误 |
| SYSTEM_UNAVAILABLE | 503 | 服务暂时不可用 | 系统维护或过载 |

---

## 错误处理最佳实践

### 1. 统一错误构造函数

```typescript
// backend/src/utils/errors.ts
export class ApiError extends Error {
  constructor(
    public httpCode: number,
    public errorCode: string,
    public userMessage: string,
    public details?: unknown
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }
}

export function createError(
  code: string,
  message: string,
  httpCode: number = 500,
  details?: unknown
): ApiError {
  return new ApiError(httpCode, code, message, details);
}
```

### 2. 全局错误处理中间件

```typescript
// backend/src/middleware/errorHandler.ts
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof ApiError) {
    res.status(err.httpCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.userMessage,
        details: isProduction ? undefined : err.details,
      },
      timestamp: new Date().toISOString(),
    });
  } else {
    // 未预期的错误
    logger.error('Unexpected error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_INTERNAL_ERROR',
        message: '内部服务器错误',
        details: isProduction ? undefined : err.stack,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 3. 客户端错误处理

```typescript
// frontend/src/services/apiClient.ts
async function handleApiError(response: Response) {
  const error = await response.json();
  
  switch (error.error.code) {
    case 'AUTH_TOKEN_EXPIRED':
      // 自动刷新token
      await refreshToken();
      break;
    case 'AUTH_INVALID_TOKEN':
      // 跳转到登录页
      redirectToLogin();
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // 显示友好提示
      showToast('请求过于频繁，请稍后再试');
      break;
    default:
      // 显示通用错误
      showToast(error.error.message);
  }
}
```

---

## 日志记录规范

**错误日志必须包含**:
- 错误代码
- HTTP状态码
- 请求路径
- 用户ID（如适用）
- 时间戳
- 堆栈跟踪（开发环境）

**示例**:
```typescript
logger.error('API Error', {
  code: 'AUTH_INVALID_TOKEN',
  httpCode: 401,
  path: req.path,
  userId: req.user?.id,
  timestamp: new Date().toISOString(),
  stack: err.stack,
});
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-01-16 | 初始版本 |

---

**维护者**: LLMChat 开发团队  
**相关文档**: [技术规范](technical-details.md)
