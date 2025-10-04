# 工作区路由架构设计

## 概述

将智能体工作区从单一 ChatContainer 组件解耦，使用 React Router 实现清晰的页面划分和路由管理。

## 路由规则

### 主要路由

| 路径 | 组件 | 说明 | 工作区类型 |
|------|------|------|-----------|
| `/` | `ChatApp` | 默认聊天主页 | 通用聊天 |
| `/chat/:agentId` | `AgentWorkspace` | 智能体工作区（动态） | 根据智能体类型 |
| `/product-preview` | `ProductPreviewPage` | 产品现场预览独立页面 | 特殊工作区 |
| `/voice-call` | `VoiceCallPage` | 语音对话独立页面 | 特殊工作区 |
| `/admin/*` | `AdminRoutes` | 管理后台路由（保持不变） | 管理功能 |

### URL 参数

- `agentId`: 智能体唯一标识符
- 查询参数：
  - `?session=<sessionId>`: 指定会话ID
  - `?new=true`: 创建新会话

## 工作区类型定义

```typescript
export type WorkspaceType = 
  | 'chat'              // 标准聊天界面
  | 'product-preview'   // 产品现场预览
  | 'voice-call'        // 语音对话
  | 'custom';           // 自定义扩展

export interface Agent {
  id: string;
  name: string;
  description?: string;
  model: string;
  status: 'active' | 'inactive';
  capabilities?: string[];
  provider: string;
  workspaceType?: WorkspaceType; // 新增属性
}
```

## 组件层次结构

```
App (React Router)
├── ChatApp (主聊天应用)
│   ├── Header
│   ├── Sidebar
│   └── ChatContainer (标准聊天)
├── AgentWorkspace (智能体工作区路由)
│   ├── 根据 workspaceType 渲染：
│   │   ├── ChatContainer (默认)
│   │   ├── ProductPreviewWorkspace
│   │   └── VoiceCallWorkspace
├── ProductPreviewPage (独立页面)
├── VoiceCallPage (独立页面)
└── AdminRoutes (管理后台)
```

## 导航流程

### 1. 用户选择智能体

```typescript
// AgentSelector.tsx
const handleAgentSelect = (agent: Agent) => {
  if (agent.workspaceType === 'product-preview') {
    navigate('/product-preview', { state: { agent } });
  } else if (agent.workspaceType === 'voice-call') {
    navigate('/voice-call', { state: { agent } });
  } else {
    navigate(`/chat/${agent.id}`);
  }
  setCurrentAgent(agent);
  setAgentSelectorOpen(false);
};
```

### 2. 工作区渲染

```typescript
// AgentWorkspace.tsx
export const AgentWorkspace: React.FC = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentAgent = useAgentStore((state) => 
    state.getAgentById(agentId || '')
  );

  useEffect(() => {
    if (!currentAgent) {
      navigate('/', { replace: true });
      return;
    }
    // 设置当前智能体到全局状态
    useAgentStore.getState().setCurrentAgent(currentAgent);
  }, [currentAgent, navigate]);

  if (!currentAgent) {
    return <LoadingSpinner />;
  }

  // 根据工作区类型渲染
  switch (currentAgent.workspaceType) {
    case 'product-preview':
      return <ProductPreviewWorkspace agent={currentAgent} />;
    case 'voice-call':
      return <VoiceCallWorkspace agent={currentAgent} />;
    default:
      return <ChatContainer />;
  }
};
```

### 3. 独立页面

```typescript
// ProductPreviewPage.tsx
export const ProductPreviewPage: React.FC = () => {
  const location = useLocation();
  const agent = location.state?.agent || PRODUCT_PREVIEW_AGENT;

  return (
    <div className="min-h-screen">
      <Header />
      <ProductPreviewWorkspace agent={agent} />
    </div>
  );
};
```

## 状态管理

### 路由状态

- 使用 React Router 的 `useParams`, `useNavigate`, `useLocation`
- URL 是单一真实来源（Single Source of Truth）
- 智能体ID从URL参数获取

### 全局状态

- `currentAgent`: 从路由参数派生
- `currentSession`: 与智能体关联
- `messages`: 与会话关联

### 状态同步

```typescript
// 监听路由变化，同步全局状态
useEffect(() => {
  const agentId = params.agentId;
  if (agentId) {
    const agent = getAgentById(agentId);
    if (agent) {
      setCurrentAgent(agent);
    }
  }
}, [params.agentId]);
```

## 向后兼容

### 重定向旧路由

```typescript
// App.tsx
<Routes>
  {/* 新路由 */}
  <Route path="/chat/:agentId" element={<AgentWorkspace />} />
  
  {/* 兼容旧路由（如果有）*/}
  <Route path="/agent/:agentId" element={
    <Navigate to={`/chat/${params.agentId}`} replace />
  } />
</Routes>
```

### 保持状态持久化

- localStorage 中的会话数据结构保持不变
- 仅增加路由导航，不影响数据存储

## 性能优化

### 代码分割

```typescript
// 懒加载工作区组件
const ProductPreviewWorkspace = lazy(() => 
  import('@/components/product/ProductPreviewWorkspace')
);

const VoiceCallWorkspace = lazy(() => 
  import('@/components/voice/VoiceCallWorkspace')
);
```

### 预加载

```typescript
// 鼠标悬停时预加载
<Link 
  to={`/chat/${agent.id}`}
  onMouseEnter={() => {
    preloadAgentWorkspace(agent.id);
  }}
>
  {agent.name}
</Link>
```

## 测试策略

### 单元测试

- 测试 AgentWorkspace 组件渲染逻辑
- 测试路由参数解析
- 测试工作区类型判断

### 集成测试

- 测试智能体选择和路由跳转
- 测试刷新页面后状态恢复
- 测试浏览器前进/后退按钮

### E2E 测试

```typescript
test('用户可以选择智能体并进入对应工作区', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="agent-selector"]');
  await page.click('[data-testid="agent-normal-chat"]');
  
  await expect(page).toHaveURL(/\/chat\/.+/);
  await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
});

test('用户可以切换不同智能体', async ({ page }) => {
  await page.goto('/chat/agent-1');
  await page.click('[data-testid="agent-selector"]');
  await page.click('[data-testid="agent-2"]');
  
  await expect(page).toHaveURL('/chat/agent-2');
});
```

## 迁移步骤

1. ✅ 设计路由架构（本文档）
2. ⏳ 扩展 Agent 类型定义
3. ⏳ 创建 AgentWorkspace 组件
4. ⏳ 重构 ChatContainer
5. ⏳ 更新 App.tsx 路由配置
6. ⏳ 修改智能体选择器
7. ⏳ 创建独立页面组件
8. ⏳ 编写测试
9. ⏳ 性能优化
10. ⏳ 文档更新

## 风险评估

### 高风险

- ❌ URL 变化可能影响已分享的链接
  - **缓解**: 添加重定向规则

### 中风险

- ⚠️ 状态管理复杂度增加
  - **缓解**: 保持状态逻辑简单，URL为单一真实来源

### 低风险

- ✅ 代码分割可能影响首次加载
  - **缓解**: 预加载关键组件

## 成功标准

- ✅ 所有智能体都能正确导航
- ✅ 刷新页面后状态正确恢复
- ✅ 浏览器前进/后退按钮正常工作
- ✅ URL 可分享和书签
- ✅ 性能无明显回归
- ✅ 所有测试通过
- ✅ 代码覆盖率 > 80%

---

*设计完成时间: 2025-10-04*
*设计者: AI Architecture Assistant*

