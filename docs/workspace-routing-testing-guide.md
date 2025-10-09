# 工作区路由系统测试验证指南

## 测试环境

- **前端开发服务器**: http://localhost:3000
- **后端服务**: http://localhost:3001
- **浏览器**: Chrome/Edge (推荐使用开发者工具)

## 手动测试清单

### 1. 基础路由功能

#### 1.1 默认首页
- [ ] 访问 `http://localhost:3000/`
- [ ] 应该看到默认聊天页面
- [ ] 侧边栏正常显示
- [ ] 智能体选择器正常显示

#### 1.2 智能体选择
- [ ] 点击智能体选择器
- [ ] 选择任意普通智能体
- [ ] URL 应该变为 `/chat/<agentId>`
- [ ] 聊天界面正常显示
- [ ] 智能体名称正确显示

#### 1.3 智能体切换
- [ ] 在当前智能体下
- [ ] 点击智能体选择器
- [ ] 选择另一个智能体
- [ ] URL 应该更新为新的 `/chat/<newAgentId>`
- [ ] 界面应该立即切换到新智能体
- [ ] 消息列表应该清空或显示新智能体的会话

### 2. 会话管理

#### 2.1 新建对话
- [ ] 点击侧边栏的"新建对话"按钮
- [ ] URL 应该变为 `/chat/<agentId>?new=true`
- [ ] 消息列表应该清空
- [ ] 输入框可用

#### 2.2 切换会话
- [ ] 在侧边栏点击任意历史会话
- [ ] URL 应该变为 `/chat/<agentId>?session=<sessionId>`
- [ ] 消息列表应该显示该会话的历史记录
- [ ] 会话标题正确显示

#### 2.3 会话持久化
- [ ] 在任意会话中
- [ ] 刷新页面 (F5)
- [ ] 页面应该恢复到同一个智能体和会话
- [ ] 消息列表保持不变
- [ ] URL 保持不变

### 3. 浏览器导航

#### 3.1 前进/后退按钮
- [ ] 访问智能体A: `/chat/agent-a`
- [ ] 访问智能体B: `/chat/agent-b`
- [ ] 点击浏览器后退按钮
- [ ] 应该返回智能体A
- [ ] 点击浏览器前进按钮
- [ ] 应该前进到智能体B

#### 3.2 直接访问URL
- [ ] 在浏览器地址栏直接输入 `/chat/<validAgentId>`
- [ ] 应该直接进入该智能体的工作区
- [ ] 输入 `/chat/invalid-agent-id`
- [ ] 应该显示"智能体未找到"错误页面
- [ ] 错误页面有"返回首页"按钮

#### 3.3 URL 分享
- [ ] 复制当前 URL
- [ ] 在新标签页或无痕窗口中打开
- [ ] 应该看到相同的智能体和会话
- [ ] 功能正常工作

### 4. 特殊工作区

#### 4.1 产品现场预览
- [ ] 选择"产品现场预览"智能体
- [ ] URL 变为 `/chat/product-scene-preview`
- [ ] 应该显示产品预览工作区界面
- [ ] 界面功能正常（上传、选择产品等）

#### 4.2 语音对话
- [ ] 选择"电话语音对话"智能体
- [ ] URL 变为 `/chat/voice-conversation-assistant`
- [ ] 应该显示语音对话工作区界面
- [ ] 界面功能正常（开始通话等）

### 5. 错误处理

#### 5.1 智能体未找到
- [ ] 访问 `/chat/non-existent-agent`
- [ ] 应该显示错误页面
- [ ] 错误消息清晰友好
- [ ] 有返回首页的按钮

#### 5.2 加载状态
- [ ] 在慢速网络下
- [ ] 访问智能体页面
- [ ] 应该显示加载动画
- [ ] 加载完成后显示正确内容

### 6. 响应式设计

#### 6.1 移动端
- [ ] 打开浏览器开发者工具
- [ ] 切换到移动设备模拟 (F12 -> 设备工具栏)
- [ ] 所有功能正常工作
- [ ] 侧边栏正确响应
- [ ] 路由切换流畅

#### 6.2 平板
- [ ] 模拟平板设备
- [ ] 布局正确显示
- [ ] 功能正常工作

### 7. 性能测试

#### 7.1 首次加载
- [ ] 清空缓存
- [ ] 访问首页
- [ ] 打开 Network 面板
- [ ] 记录首次加载时间（应 < 3秒）

#### 7.2 路由切换
- [ ] 在不同智能体间切换
- [ ] 切换应该流畅（< 500ms）
- [ ] 无明显卡顿

#### 7.3 代码分割
- [ ] 打开 Network 面板
- [ ] 切换到 AgentWorkspace
- [ ] 应该看到按需加载的 chunk 文件
- [ ] 文件大小合理

## 自动化测试（待实施）

### 单元测试

创建 `frontend/src/components/workspace/__tests__/AgentWorkspace.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AgentWorkspace } from '../AgentWorkspace';
import { useAgentStore } from '@/store/agentStore';

// Mock stores
jest.mock('@/store/agentStore');
jest.mock('@/store/sessionStore');

describe('AgentWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该显示加载状态当智能体正在加载时', () => {
    (useAgentStore as jest.Mock).mockReturnValue({
      getAgentById: () => null,
      setCurrentAgent: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/chat/agent-1']}>
        <Routes>
          <Route path="/chat/:agentId" element={<AgentWorkspace />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('加载智能体中...')).toBeInTheDocument();
  });

  it('应该显示错误页面当智能体不存在时', async () => {
    (useAgentStore as jest.Mock).mockReturnValue({
      getAgentById: () => null,
      setCurrentAgent: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/chat/invalid-agent']}>
        <Routes>
          <Route path="/chat/:agentId" element={<AgentWorkspace />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('智能体未找到')).toBeInTheDocument();
    });
  });

  it('应该渲染标准聊天界面对于普通智能体', () => {
    const mockAgent = {
      id: 'agent-1',
      name: 'Test Agent',
      workspaceType: 'chat',
    };

    (useAgentStore as jest.Mock).mockReturnValue({
      getAgentById: () => mockAgent,
      setCurrentAgent: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/chat/agent-1']}>
        <Routes>
          <Route path="/chat/:agentId" element={<AgentWorkspace />} />
        </Routes>
      </MemoryRouter>
    );

    // 验证 ChatContainer 被渲染
    expect(screen.getByTestId('chat-container')).toBeInTheDocument();
  });

  it('应该渲染产品预览工作区对于特殊智能体', () => {
    const mockAgent = {
      id: 'product-preview',
      name: 'Product Preview',
      workspaceType: 'product-preview',
    };

    (useAgentStore as jest.Mock).mockReturnValue({
      getAgentById: () => mockAgent,
      setCurrentAgent: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/chat/product-preview']}>
        <Routes>
          <Route path="/chat/:agentId" element={<AgentWorkspace />} />
        </Routes>
      </MemoryRouter>
    );

    // 验证 ProductPreviewWorkspace 被渲染
    expect(screen.getByTestId('product-preview-workspace')).toBeInTheDocument();
  });
});
```

### E2E 测试

创建 `tests/e2e/workspace-routing.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('工作区路由系统', () => {
  test('用户可以通过选择器切换智能体', async ({ page }) => {
    await page.goto('/');
    
    // 点击智能体选择器
    await page.click('[data-testid="agent-selector"]');
    
    // 选择一个智能体
    await page.click('[data-testid="agent-item-1"]');
    
    // 验证 URL 变化
    await expect(page).toHaveURL(/\/chat\/.+/);
    
    // 验证聊天界面显示
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
  });

  test('浏览器前进后退按钮正常工作', async ({ page }) => {
    await page.goto('/chat/agent-1');
    await page.goto('/chat/agent-2');
    
    // 点击后退
    await page.goBack();
    await expect(page).toHaveURL('/chat/agent-1');
    
    // 点击前进
    await page.goForward();
    await expect(page).toHaveURL('/chat/agent-2');
  });

  test('刷新页面后状态正确恢复', async ({ page }) => {
    await page.goto('/chat/agent-1');
    
    // 刷新页面
    await page.reload();
    
    // 验证仍在同一页面
    await expect(page).toHaveURL('/chat/agent-1');
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
  });

  test('直接访问无效智能体ID显示错误页面', async ({ page }) => {
    await page.goto('/chat/invalid-agent-id');
    
    // 验证错误页面
    await expect(page.locator('text=智能体未找到')).toBeVisible();
    await expect(page.locator('text=返回首页')).toBeVisible();
  });

  test('新建对话功能正常', async ({ page }) => {
    await page.goto('/chat/agent-1');
    
    // 点击新建对话
    await page.click('[data-testid="new-chat-button"]');
    
    // 验证 URL 包含 new=true
    await expect(page).toHaveURL(/\/chat\/agent-1\?new=true/);
    
    // 验证消息列表为空
    const messages = page.locator('[data-testid="message-item"]');
    await expect(messages).toHaveCount(0);
  });

  test('切换会话更新URL', async ({ page }) => {
    await page.goto('/chat/agent-1');
    
    // 点击历史会话
    await page.click('[data-testid="session-item-1"]');
    
    // 验证 URL 包含 session 参数
    await expect(page).toHaveURL(/\/chat\/agent-1\?session=.+/);
  });
});
```

## 性能基准测试

使用 Lighthouse 进行性能评估：

```bash
# 安装 Lighthouse CLI
npm install -g lighthouse

# 运行性能测试
lighthouse http://localhost:3000 --output html --output-path ./lighthouse-report.html
```

**预期指标**:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90

## 测试报告模板

```markdown
# 测试报告 - 工作区路由系统

## 测试信息
- 测试日期: YYYY-MM-DD
- 测试人员: XXX
- 测试环境: 
  - 浏览器: Chrome 120.0
  - 操作系统: Windows 11
  - 前端版本: v1.0.0

## 测试结果

### 基础功能
- [✅/❌] 默认首页
- [✅/❌] 智能体选择
- [✅/❌] 智能体切换
- ...

### 发现的问题
1. **问题标题**
   - 严重程度: 高/中/低
   - 复现步骤: ...
   - 预期行为: ...
   - 实际行为: ...
   - 截图: ...

### 性能指标
- 首次加载时间: X秒
- 路由切换时间: X毫秒
- Lighthouse 分数: XX

### 测试结论
- 总体评价: 通过/部分通过/未通过
- 建议: ...
```

## 问题反馈

如果在测试过程中发现问题，请按以下格式反馈：

1. **问题标题**: 简短描述问题
2. **严重程度**: 致命/严重/一般/轻微
3. **复现步骤**: 详细步骤
4. **预期行为**: 应该发生什么
5. **实际行为**: 实际发生了什么
6. **环境信息**: 浏览器、操作系统、版本
7. **截图/录屏**: 如果可能

## 注意事项

1. **测试前准备**:
   - 确保后端服务正在运行
   - 清空浏览器缓存
   - 使用隐身模式测试

2. **测试中**:
   - 打开浏览器开发者工具
   - 监控 Console 面板的错误
   - 检查 Network 面板的请求
   - 注意性能问题

3. **测试后**:
   - 记录所有发现的问题
   - 提供详细的复现步骤
   - 如有可能，提供修复建议

---

**更新日期**: 2025-10-04
**文档版本**: 1.0

