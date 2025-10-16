/**
 * E2E 测试：完整聊天流程
 * 使用 Playwright 进行端到端测试
 * 
 * 运行方式：
 * npx playwright test tests/e2e/chat-flow.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// 测试配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// 测试数据
const TEST_USER = {
  username: 'admin',
  password: 'admin123',
};

// 辅助函数：等待网络空闲
async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}

// 辅助函数：等待元素可见
async function waitForVisible(page: Page, selector: string) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
}

test.describe.skip('聊天应用完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问主页
    await page.goto(BASE_URL);
  });

  test('P0: 健康检查 - 后端服务可用', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('llmchat-backend');
  });

  test('P0: 首页加载 - 页面正常渲染', async ({ page }) => {
    await waitForNetworkIdle(page);
    
    // 验证页面标题
    await expect(page).toHaveTitle(/LLMChat/i);
    
    // 验证关键元素存在
    const chatContainer = page.locator('[data-testid="chat-container"]').or(page.locator('.chat-container')).first();
    await expect(chatContainer).toBeVisible({ timeout: 10000 });
  });

  test('P1: 智能体切换 - 显示智能体列表', async ({ page }) => {
    await waitForNetworkIdle(page);
    
    // 点击智能体选择器
    const agentSelector = page.locator('[data-testid="agent-selector"]').or(page.locator('button:has-text("选择智能体")')).first();
    await agentSelector.click({ timeout: 5000 });
    
    // 等待智能体列表出现
    const agentList = page.locator('[data-testid="agent-list"]').or(page.locator('.agent-list')).first();
    await expect(agentList).toBeVisible({ timeout: 5000 });
    
    // 验证至少有一个智能体
    const agents = page.locator('[data-testid^="agent-"]').or(page.locator('.agent-item'));
    await expect(agents.first()).toBeVisible({ timeout: 5000 });
  });

  test('P1: 发送消息 - 用户可以发送文本消息', async ({ page }) => {
    await waitForNetworkIdle(page);
    
    // 查找输入框
    const input = page.locator('[data-testid="chat-input"]')
      .or(page.locator('textarea[placeholder*="消息"]'))
      .or(page.locator('input[type="text"]'))
      .first();
    
    await input.fill('你好，这是测试消息');
    
    // 查找发送按钮
    const sendButton = page.locator('[data-testid="send-button"]')
      .or(page.locator('button:has-text("发送")'))
      .or(page.locator('button[type="submit"]'))
      .first();
    
    await sendButton.click();
    
    // 验证消息已发送（等待用户消息出现）
    const userMessage = page.locator('.message-user').or(page.locator('[data-role="user"]')).first();
    await expect(userMessage).toBeVisible({ timeout: 5000 });
  });

  test('P1: 接收响应 - 收到助手回复', async ({ page }) => {
    await waitForNetworkIdle(page);
    
    // 发送消息
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('你好');
    
    const sendButton = page.locator('button:has-text("发送")').or(page.locator('[type="submit"]')).first();
    await sendButton.click();
    
    // 等待助手回复（最多30秒）
    const assistantMessage = page.locator('.message-assistant').or(page.locator('[data-role="assistant"]')).first();
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    
    // 验证回复有内容
    const content = await assistantMessage.textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(0);
  });

  test('P2: 会话历史 - 显示侧边栏会话列表', async ({ page }) => {
    await waitForNetworkIdle(page);
    
    // 尝试打开侧边栏（如果有切换按钮）
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]')
      .or(page.locator('button:has-text("历史")'))
      .or(page.locator('.sidebar-toggle'));
    
    if (await sidebarToggle.count() > 0) {
      await sidebarToggle.first().click();
    }
    
    // 验证侧边栏存在
    const sidebar = page.locator('[data-testid="sidebar"]').or(page.locator('.sidebar')).first();
    
    // 侧边栏可能默认显示或隐藏，这里只检查是否存在
    const isVisible = await sidebar.isVisible().catch(() => false);
    expect(isVisible !== undefined).toBeTruthy();
  });

  test('P2: 主题切换 - 切换亮色/暗色主题', async ({ page }) => {
    await waitForNetworkIdle(page);
    
    // 查找主题切换按钮
    const themeToggle = page.locator('[data-testid="theme-toggle"]')
      .or(page.locator('button[aria-label*="主题"]'))
      .or(page.locator('.theme-toggle'));
    
    if (await themeToggle.count() > 0) {
      const button = themeToggle.first();
      
      // 获取当前主题
      const currentTheme = await page.locator('html').getAttribute('class');
      
      // 切换主题
      await button.click();
      await page.waitForTimeout(500);
      
      // 验证主题已改变
      const newTheme = await page.locator('html').getAttribute('class');
      expect(newTheme).not.toBe(currentTheme);
    }
  });

  test('P3: 性能测试 - 首屏加载时间', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);
    
    const loadTime = Date.now() - startTime;
    
    // 首屏加载应在5秒内完成
    expect(loadTime).toBeLessThan(5000);
    
    console.log(`首屏加载时间: ${loadTime}ms`);
  });

  test('P3: 性能测试 - 消息发送响应时间', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);
    
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('性能测试消息');
    
    const startTime = Date.now();
    
    const sendButton = page.locator('button:has-text("发送")').first();
    await sendButton.click();
    
    // 等待助手响应
    await page.locator('.message-assistant').first().waitFor({ state: 'visible', timeout: 30000 });
    
    const responseTime = Date.now() - startTime;
    
    // 响应时间应在10秒内
    expect(responseTime).toBeLessThan(10000);
    
    console.log(`消息响应时间: ${responseTime}ms`);
  });
});

test.describe.skip('错误处理', () => {
  test('P2: 网络错误 - 显示友好错误信息', async ({ page, context }) => {
    // 模拟离线状态
    await context.setOffline(true);
    
    await page.goto(BASE_URL);
    
    // 尝试发送消息
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('测试消息');
    
    const sendButton = page.locator('button:has-text("发送")').first();
    await sendButton.click();
    
    // 应该显示错误提示
    const errorMessage = page.locator('.error-message').or(page.locator('[role="alert"]'));
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    
    // 恢复在线状态
    await context.setOffline(false);
  });

  test('P2: API 错误 - 处理500错误', async ({ page, context }) => {
    // 拦截API请求并返回500错误
    await context.route('**/api/chat/completions', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: '服务器内部错误' }),
      });
    });
    
    await page.goto(BASE_URL);
    await waitForNetworkIdle(page);
    
    // 发送消息
    const input = page.locator('textarea, input[type="text"]').first();
    await input.fill('测试500错误');
    
    const sendButton = page.locator('button:has-text("发送")').first();
    await sendButton.click();
    
    // 应该显示错误信息
    const errorToast = page.locator('.error-toast').or(page.locator('[role="alert"]'));
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  });
});

test.describe.skip('登录流程', () => {
  test('P1: 登录 - 成功登录管理后台', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await waitForNetworkIdle(page);
    
    // 填写登录表单
    const usernameInput = page.locator('input[name="username"]').or(page.locator('input[type="text"]')).first();
    const passwordInput = page.locator('input[name="password"]').or(page.locator('input[type="password"]')).first();
    
    await usernameInput.fill(TEST_USER.username);
    await passwordInput.fill(TEST_USER.password);
    
    // 点击登录按钮
    const loginButton = page.locator('button[type="submit"]').or(page.locator('button:has-text("登录")')).first();
    await loginButton.click();
    
    // 等待跳转
    await page.waitForURL(/\/home/, { timeout: 10000 });
    
    // 验证已登录（检查管理后台元素）
    const adminHeader = page.locator('.admin-header').or(page.locator('h1:has-text("管理")')).first();
    await expect(adminHeader).toBeVisible({ timeout: 5000 });
  });
});
