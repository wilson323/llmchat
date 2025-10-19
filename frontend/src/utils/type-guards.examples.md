# 类型守卫工具库 - 实际应用示例

**工具库**: `frontend/src/utils/type-guards.ts`  
**更新日期**: 2025-10-17

---

## 🎯 基础使用

### 导入工具

```typescript
import { TypeGuards, TypeUtils } from '@/utils/type-guards';
```

---

## 📋 实际场景示例

### 示例1: Store中的安全操作

```typescript
// 在 HybridChatStore.ts 中使用

// ❌ 之前的代码
setCurrentAgent: (agent: Agent | null) => {
  const state = get();
  const latestSession = state.agentSessions[agent?.id || '']?.[0];
  set({
    currentAgent: agent,
    currentSession: latestSession || null,
  });
}

// ✅ 使用类型守卫改进后
setCurrentAgent: (agent: Agent | null) => {
  const state = get();
  
  // 使用类型守卫验证agent
  if (!TypeGuards.isDefined(agent) || !TypeGuards.validateAgent(agent)) {
    set({ currentAgent: null, currentSession: null });
    return;
  }
  
  // 安全地获取会话列表
  const sessions = TypeUtils.getOrDefault(
    state.agentSessions,
    agent.id,
    []
  );
  
  // 获取第一个会话
  const latestSession = TypeUtils.getFirst(sessions);
  
  set({
    currentAgent: agent,
    currentSession: TypeGuards.isDefined(latestSession) ? latestSession : null,
  });
}
```

### 示例2: API响应处理

```typescript
// 在服务层使用

// ❌ 之前的代码
export const listAgents = async () => {
  const response = await fetch('/api/agents');
  const data = await response.json();
  return data.agents; // 不安全
};

// ✅ 使用类型守卫改进后
export const listAgents = async (): Promise<Agent[]> => {
  try {
    const response = await fetch('/api/agents');
    const data: unknown = await response.json();
    
    // 使用类型守卫验证数据
    if (TypeGuards.isObject(data) && 'agents' in data) {
      const agents = data.agents;
      
      if (TypeGuards.isAgentArray(agents)) {
        return agents.filter(TypeGuards.validateAgent);
      }
    }
    
    console.warn('Invalid agents response format');
    return [];
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return [];
  }
};
```

### 示例3: 组件中的类型安全

```typescript
// 在 React 组件中使用

// ❌ 之前的代码
const AgentCard = ({ agent }: { agent: Agent | null }) => {
  if (!agent) return null;
  return <div>{agent.name}</div>;
};

// ✅ 使用类型守卫改进后
const AgentCard = ({ agent }: { agent: Agent | null }) => {
  // 使用类型守卫
  if (!TypeGuards.isDefined(agent)) {
    return <div>No agent available</div>;
  }
  
  // 检查智能体状态
  const statusColor = TypeGuards.isActiveAgent(agent) ? 'green' : 'gray';
  
  return (
    <div>
      <h3>{agent.name}</h3>
      <span className={`status-${statusColor}`}>{agent.status}</span>
    </div>
  );
};
```

### 示例4: 消息列表处理

```typescript
// ❌ 之前的代码
const MessageList = ({ messages }: { messages: ChatMessage[] }) => {
  return messages.map((msg, i) => (
    <div key={i}>{msg.AI || msg.HUMAN}</div>
  ));
};

// ✅ 使用类型守卫改进后
const MessageList = ({ messages }: { messages: ChatMessage[] }) => {
  // 过滤有效消息
  const validMessages = messages.filter(TypeGuards.isChatMessage);
  
  return (
    <>
      {validMessages.map((msg, i) => {
        // 使用类型守卫检查消息内容
        if (TypeGuards.hasAIMessage(msg)) {
          return <AIMessage key={i} content={msg.AI} />;
        }
        
        if (TypeGuards.hasHumanMessage(msg)) {
          return <HumanMessage key={i} content={msg.HUMAN} />;
        }
        
        return null;
      })}
    </>
  );
};
```

### 示例5: 会话管理

```typescript
// ❌ 之前的代码
const sessions = agentSessions[agentId] || [];
const currentSession = sessions.find(s => s.id === sessionId);

// ✅ 使用类型守卫改进后
// 安全获取会话列表
const sessions = TypeUtils.getOrDefault(agentSessions, agentId, []);

// 验证会话列表
const validSessions = sessions.filter(TypeGuards.validateChatSession);

// 查找当前会话
const currentSession = TypeUtils.findSessionById(validSessions, sessionId);

// 检查会话状态
if (TypeGuards.isDefined(currentSession)) {
  const isEmpty = TypeGuards.isEmptySession(currentSession);
  const isPinned = TypeGuards.isPinnedSession(currentSession);
  const isArchived = TypeGuards.isArchivedSession(currentSession);
}
```

---

## 🔧 高级用法

### 组合使用

```typescript
// 多个守卫组合
if (
  TypeGuards.isDefined(agent) &&
  TypeGuards.validateAgent(agent) &&
  TypeGuards.isActiveAgent(agent)
) {
  // 安全使用agent
  processAgent(agent);
}

// 使用工具函数链式操作
const activeAgentNames = agents
  .filter(TypeGuards.isAgent)
  .filter(TypeGuards.validateAgent)
  .filter(TypeGuards.isActiveAgent)
  .map(agent => agent.name);
```

### 错误处理

```typescript
// 使用类型断言（会抛出错误）
try {
  TypeGuards.assertAgent(data);
  // 如果代码执行到这里，data一定是Agent类型
  console.log(data.name);
} catch (error) {
  console.error('Invalid agent data');
}

// 或使用类型守卫（不会抛出错误）
if (TypeGuards.isAgent(data)) {
  console.log(data.name);
} else {
  console.error('Invalid agent data');
}
```

---

## 💡 最佳实践

### DO ✅

```typescript
// 1. 使用类型守卫而非类型断言
if (TypeGuards.isAgent(data)) {
  console.log(data.name);
}

// 2. 使用工具函数安全访问
const name = TypeUtils.getStringProperty(agent, 'name', 'Unknown');

// 3. 过滤数组时使用类型守卫
const validAgents = agents.filter(TypeGuards.isAgent);

// 4. 在API处理中验证数据
if (TypeGuards.isAgentArray(response.data)) {
  return response.data;
}
```

### DON'T ❌

```typescript
// 1. 不要使用类型断言
const agent = data as Agent; // ❌

// 2. 不要直接访问可能为undefined的属性
const name = agent.name; // ❌ 如果agent可能为null

// 3. 不要假设数组元素都有效
const names = agents.map(a => a.name); // ❌ 如果agents可能包含null

// 4. 不要跳过类型验证
return response.data; // ❌ 应该先验证
```

---

## 🎯 常用模式速查

### 模式1: 安全获取属性

```typescript
// 获取字符串属性
const name = TypeUtils.getStringProperty(obj, 'name', 'default');

// 获取数字属性
const count = TypeUtils.getNumberProperty(obj, 'count', 0);

// 获取布尔属性
const active = TypeUtils.getBooleanProperty(obj, 'active', false);
```

### 模式2: 数组操作

```typescript
// 过滤null和undefined
const valid = TypeUtils.filterDefined(array);

// 获取第一个/最后一个元素
const first = TypeUtils.getFirst(array);
const last = TypeUtils.getLast(array);

// 按类型过滤
const agents = TypeUtils.filterByType(data, TypeGuards.isAgent);
```

### 模式3: 查找元素

```typescript
// 按ID查找智能体
const agent = TypeUtils.findAgentById(agents, 'agent-1');

// 按ID查找会话
const session = TypeUtils.findSessionById(sessions, 'session-1');

// 按条件查找
const firstActive = TypeUtils.findFirst(
  agents,
  TypeGuards.isActiveAgent
);
```

### 模式4: 消息检查

```typescript
// 检查消息类型
if (TypeGuards.hasAIMessage(message)) {
  console.log(message.AI);
}

if (TypeGuards.hasHumanMessage(message)) {
  console.log(message.HUMAN);
}

// 检查特殊数据
if (TypeGuards.hasInteractiveData(message)) {
  handleInteractive(message.interactive);
}

if (TypeGuards.hasReasoningState(message)) {
  displayReasoning(message.reasoning);
}
```

---

## 📚 工具库完整功能

### TypeGuards（类型守卫集合）

**基础类型**: `isDefined`, `isString`, `isNumber`, `isBoolean`, `isObject`, `isArray`

**实体类型**: `isAgent`, `isChatMessage`, `isChatSession`, `isAgentConfig`, `isOriginalChatMessage`, `isStreamStatus`, `isApiError`

**数组类型**: `isAgentArray`, `isChatMessageArray`, `isChatSessionArray`, `isArrayOf`

**字面量类型**: `isThemeMode`, `isWorkspaceType`, `isAgentStatus`, `isMessageStatus`

**特殊检查**: `hasAIMessage`, `hasHumanMessage`, `hasInteractiveData`, `hasReasoningState`, `isActiveAgent`, `isEmptySession`, `isPinnedSession`, `isArchivedSession`

**组合检查**: `hasProperty`, `hasProperties`, `isNonEmptyString`, `isPositiveNumber`, `isNonNegativeNumber`

**验证**: `validateAgent`, `validateChatSession`, `validateRequiredProperties`

**断言**: `assertDefined`, `assertType`, `assertAgent`, `assertChatMessage`, `assertChatSession`

### TypeUtils（类型工具集合）

**过滤转换**: `filterDefined`, `filterByType`, `getFirst`, `getLast`

**安全访问**: `getOrDefault`, `getNestedProperty`, `getStringProperty`, `getNumberProperty`, `getBooleanProperty`

**类型转换**: `safeCast`, `toAgent`, `toChatMessage`, `toChatSession`

**查找**: `findFirst`, `findFirstOfType`, `findAgentById`, `findSessionById`

**对象操作**: `mergeDefinedProperties`, `updateOptionalProperty`

**条件处理**: `ifType`, `matchType`

**属性检查**: `hasProperty`, `hasProperties`, `isNonEmptyString`, `isPositiveNumber`, `isNonNegativeNumber`

---

## 🎉 总结

**工具库已就绪**: `frontend/src/utils/type-guards.ts`  
**使用指南**: 本文件  
**测试套件**: `__tests__/type-guards.test.ts`

**立即开始使用**:
```typescript
import { TypeGuards, TypeUtils } from '@/utils/type-guards';
```

**祝编码愉快！** 🚀

