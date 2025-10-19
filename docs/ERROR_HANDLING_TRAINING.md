# LLMChat 异常处理培训材料

## 1. 培训目标

通过本次培训，开发团队成员将能够：
1. 理解LLMChat项目异常处理的设计原则和架构
2. 掌握后端自定义错误类型的使用方法
3. 掌握前端错误边界和错误处理Hook的使用
4. 学会在代码中正确处理和记录错误
5. 了解如何编写错误处理相关的测试

## 2. 培训内容

### 2.1 异常处理设计原则

#### 2.1.1 类型安全
- 避免使用`any`类型处理错误
- 所有错误都应继承自[BaseError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L12-L65)基类
- 使用[createErrorFromUnknown](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L269-L316)函数转换未知错误

#### 2.1.2 统一格式
- 前后端使用统一的错误响应格式
- 所有API错误遵循标准的[ApiError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/index.ts#L55-L64)接口

#### 2.1.3 可追踪性
- 每个错误都有唯一的错误ID
- 完整的错误上下文信息记录
- 结构化日志便于问题排查

### 2.2 后端异常处理

#### 2.2.1 错误类型体系

项目定义了完整的错误类型体系：

1. [BaseError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L12-L65) - 所有错误的基类
2. [ValidationError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L100-L110) - 验证错误
3. [AuthenticationError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L113-L123) - 认证错误
4. [AuthorizationError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L126-L137) - 授权错误
5. [ResourceError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L140-L151) - 资源错误
6. [ExternalServiceError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L154-L164) - 外部服务错误
7. [SystemError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L167-L177) - 系统错误
8. [BusinessLogicError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L180-L190) - 业务逻辑错误

#### 2.2.2 错误处理最佳实践

##### 2.2.2.1 使用自定义错误类型

```typescript
// 推荐：使用自定义错误类型
throw new ValidationError({
  message: 'Agent ID is required',
  field: 'agentId',
  code: 'AGENT_ID_REQUIRED',
});

// 不推荐：使用原始Error对象
throw new Error('Agent ID is required');
```

##### 2.2.2.2 类型安全的错误捕获

```typescript
// 推荐：类型安全的错误捕获
catch (unknownError: unknown) {
  const error = createErrorFromUnknown(unknownError, {
    component: 'AgentController',
    operation: 'getAgents',
  });
  logger.error('获取智能体列表失败', error.toLogObject());
  
  const apiError = error.toApiError();
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
}

// 不推荐：使用any类型
catch (error: any) {
  logger.error('获取智能体列表失败', { error });
  res.status(500).json({ 
    code: 'INTERNAL_ERROR', 
    message: 'Internal server error' 
  });
}
```

##### 2.2.2.3 使用错误处理中间件

```typescript
import { asyncErrorHandler } from '@/middleware/errorHandler';

// 使用asyncErrorHandler包装异步路由处理器
app.post('/api/chat', asyncErrorHandler(chatController.handleChat));
```

#### 2.2.3 错误处理中间件

后端使用统一的错误处理中间件[errorHandler](file:///f:/ss/aa/sssss/llmchat/backend/src/middleware/errorHandler.ts#L15-L85)，负责捕获所有未处理的错误并返回统一格式的响应。

### 2.3 前端异常处理

#### 2.3.1 错误边界组件

使用统一的[ErrorBoundary](file:///f:/ss/aa/sssss/llmchat/frontend/src/components/ErrorBoundary.tsx#L22-L112)组件捕获React组件树中的错误：

```tsx
<ErrorBoundary>
  <ChatApp />
</ErrorBoundary>
```

#### 2.3.2 错误处理Hook

使用[useErrorHandler](file:///f:/ss/aa/sssss/llmchat/frontend/src/hooks/useErrorHandler.ts#L10-L59) Hook处理函数组件中的错误：

```typescript
import { useErrorHandler } from '@/hooks/useErrorHandler';

const MyComponent = () => {
  const { handleApiError, handleGenericError } = useErrorHandler();

  const handleAsyncOperation = async () => {
    try {
      await someAsyncOperation();
    } catch (error) {
      handleApiError(error, { component: 'MyComponent' });
    }
  };

  return <div>My Component</div>;
};
```

#### 2.3.3 增强版日志记录

使用[enhancedLogger](file:///f:/ss/aa/sssss/llmchat/frontend/src/lib/enhancedLogger.ts#L55-L255)记录详细的错误信息：

```typescript
import { enhancedLogger } from '@/lib/enhancedLogger';

try {
  // 操作代码
  await apiCall();
} catch (error) {
  enhancedLogger.error('API调用失败', error, {
    component: 'UserService',
    operation: 'fetchUserData',
    userId: currentUser.id,
  });
}
```

### 2.4 错误响应格式

所有API错误响应遵循统一格式：

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述",
  "category": "错误类别",
  "severity": "错误严重性",
  "details": {},
  "timestamp": "时间戳",
  "userId": "用户ID",
  "requestId": "请求ID"
}
```

### 2.5 测试策略

#### 2.5.1 后端测试

为所有错误处理逻辑编写单元测试：

```typescript
describe('ErrorHandler Middleware', () => {
  test('should handle ValidationError correctly', async () => {
    const validationError = new ValidationError({
      message: 'Invalid input',
      field: 'email',
      value: 'invalid-email',
    });

    const mockReq = {} as Request;
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    errorHandler(validationError, mockReq, mockRes, jest.fn());

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
      })
    );
  });
});
```

#### 2.5.2 前端测试

测试错误边界组件和错误处理Hook：

```typescript
describe('ErrorBoundary', () => {
  test('should render fallback UI when error occurs', () => {
    const ThrowError: React.FC = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByText('应用遇到了错误')).toBeInTheDocument();
  });
});
```

## 3. 实际案例演示

### 3.1 后端控制器错误处理

```typescript
// AgentController.ts
getAgents = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const agents = includeInactive
      ? await this.agentService.getAllAgents()
      : await this.agentService.getAvailableAgents();

    ApiResponseHandler.sendSuccess(res, agents, {
      message: '获取智能体列表成功',
      metadata: { extra: { total: agents.length } },
    });
  } catch (unknownError: unknown) {
    // 使用类型安全的方式处理错误
    const error = createErrorFromUnknown(unknownError, {
      component: 'AgentController',
      operation: 'getAgents',
    });
    logger.error('获取智能体列表失败', error.toLogObject());
    
    const apiError = error.toApiError();
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiError);
  }
};
```

### 3.2 前端Hook错误处理

```typescript
// useChat.ts
const sendStreamMessage = useCallback(async (message: string) => {
  if (!currentAgent) return;

  try {
    // 记录流式请求开始
    enhancedLogger.serviceCall('chatService', 'sendStreamMessage', {
      agentId: currentAgent.id,
      messageLength: message.length,
    });

    const response = await chatService.sendStreamMessage(
      currentAgent.id,
      message,
      sessionId
    );

    // 处理响应...
  } catch (error) {
    // 使用错误处理Hook
    handleError(error);
    
    // 记录错误
    enhancedLogger.error('发送流式消息失败', error, {
      component: 'useChat',
      operation: 'sendStreamMessage',
      agentId: currentAgent.id,
    });
  }
}, [currentAgent, sessionId, chatService, handleError]);
```

## 4. 常见问题和解决方案

### 4.1 错误未被捕获

**问题**：异步操作中的错误未被捕获，导致应用崩溃。

**解决方案**：
1. 使用[asyncErrorHandler](file:///f:/ss/aa/sssss/llmchat/backend/src/middleware/errorHandler.ts#L246-L252)包装所有异步路由处理器
2. 在异步操作中使用try-catch语句

### 4.2 错误信息不明确

**问题**：错误信息过于简单，难以定位问题。

**解决方案**：
1. 提供详细的错误上下文信息
2. 使用具体的错误类型而非通用错误
3. 记录完整的错误堆栈信息

### 4.3 错误处理不一致

**问题**：不同模块的错误处理方式不一致。

**解决方案**：
1. 统一使用项目定义的错误类型
2. 使用统一的错误处理中间件
3. 遵循项目错误处理最佳实践

## 5. 最佳实践总结

### 5.1 后端最佳实践

1. **始终使用自定义错误类型**
   ```typescript
   throw new ValidationError({
     message: '参数验证失败',
     field: 'email',
     code: 'INVALID_EMAIL',
   });
   ```

2. **类型安全的错误捕获**
   ```typescript
   catch (unknownError: unknown) {
     const error = createErrorFromUnknown(unknownError, {
       component: 'ComponentName',
       operation: 'operationName'
     });
   }
   ```

3. **详细的错误日志记录**
   ```typescript
   logger.error('操作失败', error.toLogObject());
   ```

### 5.2 前端最佳实践

1. **使用错误边界保护组件树**
   ```tsx
   <ErrorBoundary>
     <MyApp />
   </ErrorBoundary>
   ```

2. **使用错误处理Hook**
   ```typescript
   const { handleApiError } = useErrorHandler();
   ```

3. **使用增强版日志记录**
   ```typescript
   enhancedLogger.serviceCall('serviceName', 'methodName', metadata);
   ```

## 6. 参考资料

1. [ERROR_HANDLING_GUIDE.md](file:///f:/ss/aa/sssss/llmchat/docs/ERROR_HANDLING_GUIDE.md) - 详细的异常处理指南
2. [BaseError类型定义](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L12-L65) - 后端错误类型体系
3. [ErrorHandler中间件](file:///f:/ss/aa/sssss/llmchat/backend/src/middleware/errorHandler.ts#L15-L85) - 后端错误处理实现
4. [ErrorBoundary组件](file:///f:/ss/aa/sssss/llmchat/frontend/src/components/ErrorBoundary.tsx#L22-L112) - 前端错误边界实现
5. [useErrorHandler Hook](file:///f:/ss/aa/sssss/llmchat/frontend/src/hooks/useErrorHandler.ts#L10-L59) - 前端错误处理Hook实现

## 7. 练习题

### 7.1 后端练习

1. 在一个控制器方法中，实现对用户输入的验证，如果验证失败，抛出[ValidationError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L100-L110)。
2. 在一个服务方法中，捕获数据库操作异常，并转换为[ExternalServiceError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L154-L164)。
3. 编写一个测试用例，验证错误处理中间件能正确处理[AuthorizationError](file:///f:/ss/aa/sssss/llmchat/backend/src/types/errors.ts#L126-L137)。

### 7.2 前端练习

1. 在一个React组件中使用[ErrorBoundary](file:///f:/ss/aa/sssss/llmchat/frontend/src/components/ErrorBoundary.tsx#L22-L112)保护可能出错的子组件。
2. 在一个自定义Hook中使用[useErrorHandler](file:///f:/ss/aa/sssss/llmchat/frontend/src/hooks/useErrorHandler.ts#L10-L59)处理API调用错误。
3. 在一个异步操作中使用[enhancedLogger](file:///f:/ss/aa/sssss/llmchat/frontend/src/lib/enhancedLogger.ts#L55-L255)记录操作开始和结束的日志。

通过本次培训，希望团队成员能够熟练掌握LLMChat项目的异常处理机制，并在日常开发中遵循最佳实践，提高代码质量和系统稳定性。