# 类型守卫工具库使用指南

**工具库位置**: `frontend/src/utils/type-guards.ts`  
**测试文件**: `frontend/src/utils/__tests__/type-guards.test.ts`  
**最后更新**: 2025-10-17

---

## 🚀 快速开始

### 导入工具

```typescript
import { TypeGuards, TypeUtils } from '@/utils/type-guards';
```

---

## 📋 常用场景

### 场景1: API响应处理

```typescript
// 安全地获取智能体列表
async function fetchAgents() {
  const response = await fetch('/api/agents');
  const data: unknown = await response.json();
  
  // 使用类型守卫验证
  if (TypeGuards.isObject(data)) {
    const agents = data.agents;
    if (TypeGuards.isAgentArray(agents)) {
      return agents.filter(TypeGuards.isActiveAgent);
    }
  }
  
  return [];
}
```

### 场景2: Store中的类型安全操作

```typescript
// 安全地查找智能体
const agent = TypeUtils.findAgentById(agents, agentId);

if (TypeGuards.isDefined(agent)) {
  console.log(agent.name); // 类型安全
}

// 安全地获取属性（带默认值）
const agentName = TypeUtils.getStringProperty(
  agent,
  'name',
  'Unknown Agent'
);
```

### 场景3: 组件中的条件渲染

```typescript
function AgentDisplay({ agent }: { agent: Agent | null }) {
  if (!TypeGuards.isDefined(agent)) {
    return <div>No agent selected</div>;
  }
  
  if (TypeGuards.isActiveAgent(agent)) {
    return <div>{agent.name} (Active)</div>;
  }
  
  return <div>{agent.name} (Inactive)</div>;
}
```

### 场景4: 消息处理

```typescript
function renderMessage(message: ChatMessage) {
  // 检查是否有AI回复
  if (TypeGuards.hasAIMessage(message)) {
    return <div>{message.AI}</div>;
  }
  
  // 检查是否有用户消息
  if (TypeGuards.hasHumanMessage(message)) {
    return <div>{message.HUMAN}</div>;
  }
  
  return null;
}
```

### 场景5: 数组过滤

```typescript
// 过滤掉null和undefined
const validMessages = TypeUtils.filterDefined(messages);

// 过滤特定类型
const validAgents = TypeUtils.filterByType(data, TypeGuards.isAgent);

// 获取数组第一个/最后一个元素
const firstAgent = TypeUtils.getFirst(agents);
const lastMessage = TypeUtils.getLast(messages);
```

---

## 🛠️ 工具函数速查

### 基础类型检查

| 函数 | 用途 | 示例 |
|------|------|------|
| `isDefined(value)` | 检查非null/undefined | `if (isDefined(data)) { ... }` |
| `isString(value)` | 检查字符串 | `if (isString(name)) { ... }` |
| `isNumber(value)` | 检查数字 | `if (isNumber(count)) { ... }` |
| `isBoolean(value)` | 检查布尔值 | `if (isBoolean(flag)) { ... }` |
| `isObject(value)` | 检查对象 | `if (isObject(data)) { ... }` |
| `isArray(value)` | 检查数组 | `if (isArray(list)) { ... }` |

### 实体类型检查

| 函数 | 用途 |
|------|------|
| `isAgent(value)` | 检查Agent类型 |
| `isChatMessage(value)` | 检查ChatMessage类型 |
| `isChatSession(value)` | 检查ChatSession类型 |
| `isAgentArray(value)` | 检查Agent数组 |
| `isChatMessageArray(value)` | 检查ChatMessage数组 |

### 安全访问

| 函数 | 用途 | 示例 |
|------|------|------|
| `getOrDefault(obj, key, default)` | 安全获取属性 | `getOrDefault(user, 'name', 'Guest')` |
| `getStringProperty(obj, key, default)` | 获取字符串属性 | `getStringProperty(agent, 'name', '')` |
| `getNumberProperty(obj, key, default)` | 获取数字属性 | `getNumberProperty(data, 'count', 0)` |
| `filterDefined(array)` | 过滤null/undefined | `filterDefined([1, null, 2])` → `[1, 2]` |

### 查找工具

| 函数 | 用途 | 示例 |
|------|------|------|
| `findAgentById(agents, id)` | 按ID查找智能体 | `findAgentById(agents, 'agent-1')` |
| `findSessionById(sessions, id)` | 按ID查找会话 | `findSessionById(sessions, 'session-1')` |
| `getFirst(array)` | 获取第一个元素 | `getFirst([1, 2, 3])` → `1` |
| `getLast(array)` | 获取最后一个元素 | `getLast([1, 2, 3])` → `3` |

### 特殊检查

| 函数 | 用途 |
|------|------|
| `hasAIMessage(message)` | 检查是否有AI回复 |
| `hasHumanMessage(message)` | 检查是否有用户消息 |
| `isActiveAgent(agent)` | 检查智能体是否激活 |
| `isEmptySession(session)` | 检查会话是否为空 |
| `isPinnedSession(session)` | 检查会话是否置顶 |

---

## 💡 使用技巧

### 技巧1: 组合使用

```typescript
// 链式使用多个守卫
if (TypeGuards.isDefined(agent) && TypeGuards.isActiveAgent(agent)) {
  console.log(`Active agent: ${agent.name}`);
}

// 使用工具函数简化
const agentName = TypeUtils.matchType(
  agent,
  TypeGuards.isAgent,
  (a) => a.name,
  () => 'No agent'
);
```

### 技巧2: 数组操作

```typescript
// 过滤并查找
const activeAgents = agents
  .filter(TypeGuards.isAgent)
  .filter(TypeGuards.isActiveAgent);

const firstActive = TypeUtils.findFirst(
  agents,
  TypeGuards.isActiveAgent
);
```

### 技巧3: 安全的属性访问

```typescript
// 多层级安全访问
const sessionTitle = session?.title ?? 'Untitled';

// 或使用工具函数
const sessionTitle = TypeUtils.getStringProperty(
  session,
  'title',
  'Untitled'
);
```

---

## ⚠️ 常见陷阱

### 陷阱1: 忘记检查null/undefined

```typescript
// ❌ 错误
const name = agent.name;

// ✅ 正确
if (TypeGuards.isDefined(agent)) {
  const name = agent.name;
}

// ✅ 或使用可选链
const name = agent?.name;
```

### 陷阱2: 使用类型断言instead of类型守卫

```typescript
// ❌ 不推荐
const agent = data as Agent;

// ✅ 推荐
if (TypeGuards.isAgent(data)) {
  const agent = data; // TypeScript知道这是Agent类型
}
```

### 陷阱3: 忘记验证数组元素

```typescript
// ❌ 假设数组元素都是有效的
const names = agents.map(a => a.name);

// ✅ 验证并过滤
const names = agents
  .filter(TypeGuards.isAgent)
  .map(a => a.name);
```

---

## 📚 完整函数列表

工具库提供**60+个函数**，分为以下类别：

1. **基础类型守卫** (6个)
2. **实体类型守卫** (8个)
3. **字面量类型守卫** (4个)
4. **数组类型守卫** (4个)
5. **过滤和转换** (4个)
6. **可选属性访问** (5个)
7. **类型断言** (6个)
8. **组合类型守卫** (6个)
9. **特殊类型守卫** (8个)
10. **查找工具** (4个)
11. **对象操作** (2个)
12. **条件处理** (2个)
13. **类型转换** (3个)
14. **验证工具** (3个)

详细函数签名请查看 `type-guards.ts` 源文件。

---

## 🎯 最佳实践

1. ✅ **优先使用类型守卫** 而非类型断言
2. ✅ **使用工具函数** 进行安全的属性访问
3. ✅ **过滤数组时使用类型守卫** 确保类型安全
4. ✅ **API响应处理中验证数据** 避免运行时错误
5. ✅ **组合使用多个工具** 提高代码可读性

---

## 📖 参考资料

- **类型定义**: `frontend/src/types/index.ts`
- **共享类型**: `shared-types/src/index.ts`
- **测试示例**: `frontend/src/utils/__tests__/type-guards.test.ts`
- **开发规范**: `frontend/TYPESCRIPT_DEVELOPMENT_STANDARDS.md`

---

**开始使用吧！祝编码愉快！** 🚀

