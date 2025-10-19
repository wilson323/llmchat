# 测试修复计划

## 执行时间
2025-10-17

## 当前状态
- 总测试套件: 70个
- 失败套件: 27个
- 通过套件: 43个
- 失败测试: 158个
- 通过测试: 479个
- 跳过测试: 9个

## 问题分类

### 1. TypeScript 类型错误 (高优先级)

#### 1.1 import type vs import 混淆
**问题文件:**
- `queueManager.integration.test.ts` - MessagePriority 使用 `import type` 导入但作为值使用
  
**修复方案:**
```typescript
// 错误
import type { MessagePriority } from '../../types/queue';
priority: MessagePriority.NORMAL  // ❌ 编译错误

// 正确
import { MessagePriority } from '../../types/queue';
priority: MessagePriority.NORMAL  // ✅
```

#### 1.2 Controller 方法签名不匹配
**问题文件:**
- `agentController.test.ts` - getAgent, updateAgent 等方法缺少 NextFunction 参数
- `chatController.test.ts` - sendMessage 方法不存在

**修复方案:**
```typescript
// 测试代码需要添加 next 参数
const mockNext = jest.fn() as NextFunction;
await controller.getAgent(mockRequest, mockResponse, mockNext);
```

#### 1.3 Request.user 类型不匹配
**问题文件:**
- `agentController.test.ts`
- `chatController.test.ts`

**错误:**
```typescript
mockRequest.user = { userId: 'user-123' };  // ❌ userId 不存在
```

**修复方案:**
```typescript
// 检查 @/types/express.d.ts 中的 User 接口定义
// 应该使用正确的字段名，如 id 而不是 userId
mockRequest.user = { id: 'user-123', role: 'user' };
```

### 2. 方法不存在错误 (高优先级)

#### 2.1 AgentConfigService 缺失方法
**问题:**
- syncAgents
- validateConfig  
- checkStatus

**修复方案:**
需要检查 `AgentConfigService` 源代码，这些方法可能：
1. 被重命名了
2. 移到了其他 Service
3. 需要重新实现

#### 2.2 AgentController 缺失方法
**问题:**
- listAgents
- checkStatus
- reloadConfig
- getMetrics

**修复方案:**
检查 Controller 实际实现，更新测试用例使用正确的方法名。

#### 2.3 ChatController 缺失方法
**问题:**
- sendMessage

**修复方案:**
检查实际方法名，可能是 `chat` 或其他名称。

### 3. 语法错误 (高优先级)

#### 3.1 缺少括号/分号
**文件:**
- `queueManager.integration.test.ts` (多处)
- `database.integration.test.ts` (多处)

**示例错误:**
```typescript
// 第 526 行
queueManager.createQueue(createQueueConfig(queueName);  // ❌ 缺少 )

// 第 144 行
['test@example.com')]);  // ❌ 括号不匹配
```

#### 3.2 变量未定义
**文件:**
- `queueManager.integration.test.ts`
  - userId (第145, 146行)
  - queueName (多处)
  - redis (第674行)
  - app (第651行)
  - authToken (第653行)

### 4. Mock 对象类型错误 (中优先级)

#### 4.1 Response.end Mock
**文件:** `cacheMiddleware.test.ts`

**错误:**
```typescript
mockResponse.end = jest.fn(function(this: Response) {
  // 返回类型不匹配
});
```

#### 4.2 Response.get Mock
**问题:** mockReturnValue, mockImplementation 不存在于类型定义中

### 5. 模块导入错误 (中优先级)

#### 5.1 模块不存在
**文件:** `agentController.test.ts`
```typescript
import { AgentService } from '@/services/AgentService';  
// ❌ 模块不存在或路径错误
```

#### 5.2 导出成员不存在
**文件:** `reasoning.test.ts`
```typescript
import {
  reasoningAgent,  // ❌ 不存在
  analyzeRequest,  // ❌ 不存在
  // ...
} from '../../../../frontend/src/lib/reasoning';
```

### 6. 文件引用错误 (中优先级)

**文件:** `fixDbTests.js`
```typescript
// 尝试读取已删除的文件
'databasePerformance.integration.test.ts'  // 文件已重命名为 .skip
```

### 7. Promise 类型错误 (低优先级)

**文件:** `authController.integration.test.ts`
```typescript
// 第577行
expect(rateLimitedResponse.value.status).toBe(429);
// PromiseRejectedResult 没有 value 属性
```

## 修复顺序

### 阶段1: 语法错误修复 (30分钟)
1. ✅ 修复 `queueManager.integration.test.ts` 语法错误
2. ✅ 修复 `database.integration.test.ts` 语法错误
3. ✅ 删除或修复 `fixDbTests.js`

### 阶段2: TypeScript 类型错误修复 (1小时)
1. ✅ 修复 MessagePriority 导入问题
2. ✅ 修复 Request.user 类型问题
3. ✅ 添加缺失的 NextFunction 参数
4. ✅ 修复 Mock 对象类型

### 阶段3: 方法不存在错误修复 (2小时)
1. ✅ 检查并修复 AgentConfigService 方法调用
2. ✅ 检查并修复 AgentController 方法调用
3. ✅ 检查并修复 ChatController 方法调用
4. ✅ 更新测试用例使用正确的方法签名

### 阶段4: 模块导入错误修复 (30分钟)
1. ✅ 修复 AgentService 导入路径
2. ✅ 修复 reasoning 模块导出
3. ✅ 验证所有模块路径

### 阶段5: 验证测试 (30分钟)
1. ✅ 运行所有测试
2. ✅ 确认 100% 通过率
3. ✅ 生成测试报告

## 预期结果
- 所有 70 个测试套件通过
- 所有 646+ 个测试用例通过
- 0 个跳过的测试
- 0 个失败的测试

## 执行命令
```bash
# 运行所有测试
cd backend; npm test

# 运行特定测试文件
cd backend; npm test -- src/__tests__/integration/queueManager.integration.test.ts

# 生成覆盖率报告
cd backend; npm test -- --coverage
```

