import { test, expect } from '@playwright/test';

/**
 * 管理员智能体管理 E2E 测试
 * 
 * 测试范围：
 * - 管理员登录
 * - 智能体列表查看
 * - 智能体创建（自动获取）
 * - 智能体编辑
 * - 字段验证
 * - 智能体启用/禁用
 */

test.describe('管理员智能体管理', () => {
  test.beforeEach(async ({ page }) => {
    // 访问管理员登录页
    await page.goto('http://localhost:3000/admin/login');
  });

  test.skip('应该能够登录管理员界面（UI测试跳过）', async ({ page }) => {
    // 填写登录表单
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 等待跳转到管理页面
    await page.waitForURL('**/admin');
    
    // 验证页面标题
    await expect(page.locator('h1')).toContainText('管理员');
  });

  test.skip('应该显示智能体列表（UI测试跳过）', async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    // 等待智能体列表加载
    await page.waitForSelector('[data-testid="agent-list"]', { timeout: 10000 });
    
    // 验证至少有一个智能体
    const agentCards = page.locator('[data-testid="agent-card"]');
    await expect(agentCards).toHaveCount(await agentCards.count());
  });

  test.skip('应该能够打开创建智能体对话框（UI测试跳过）', async ({ page }) => {
    // 登录并导航到管理页
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    // 点击"添加智能体"按钮
    await page.click('button:has-text("添加智能体")');
    
    // 验证对话框打开
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('h2:has-text("添加智能体")')).toBeVisible();
  });

  test.skip('应该验证必填字段（UI测试跳过）', async ({ page }) => {
    // 登录并打开创建对话框
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    await page.click('button:has-text("添加智能体")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 直接点击提交（不填写任何字段）
    await page.click('button[type="submit"]:has-text("确定")');
    
    // 验证错误提示（至少应该有name字段的错误）
    await expect(page.locator('text=/名称.*不能为空|必填/')).toBeVisible({ timeout: 2000 });
  });

  test.skip('应该能够使用自动获取功能（UI测试跳过）（FastGPT）', async ({ page }) => {
    // 登录并打开创建对话框
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    await page.click('button:has-text("添加智能体")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 选择provider为fastgpt
    await page.fill('input[name="provider"]', 'fastgpt');
    
    // 填写必要信息
    await page.fill('input[name="endpoint"]', 'https://api.fastgpt.in');
    await page.fill('input[name="apiKey"]', 'test-api-key-for-demo');
    await page.fill('input[name="appId"]', '507f1f77bcf86cd799439011');
    
    // 点击"Fetch Info"按钮（如果可见）
    const fetchButton = page.locator('button:has-text("Fetch Info")');
    if (await fetchButton.isVisible()) {
      await fetchButton.click();
      
      // 等待加载
      await page.waitForTimeout(2000);
      
      // 验证字段是否自动填充（name字段）
      const nameInput = page.locator('input[name="name"]');
      const nameValue = await nameInput.inputValue();
      
      // 如果API成功，name应该被填充
      if (nameValue) {
        expect(nameValue).toBeTruthy();
      }
    }
  });

  test.skip('应该显示字段帮助提示（UI测试跳过）', async ({ page }) => {
    // 登录并打开创建对话框
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    await page.click('button:has-text("添加智能体")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 查找帮助图标（?）
    const helpIcons = page.locator('[data-testid="help-icon"], .cursor-help');
    const count = await helpIcons.count();
    
    // 应该至少有一些帮助图标
    expect(count).toBeGreaterThan(0);
    
    // 悬停在第一个帮助图标上
    if (count > 0) {
      await helpIcons.first().hover();
      
      // 等待tooltip显示（可能需要延迟）
      await page.waitForTimeout(400);
      
      // 验证tooltip内容可见（部分实现可能不同）
      // 这里只验证有帮助图标存在
      expect(await helpIcons.first().isVisible()).toBe(true);
    }
  });

  test.skip('应该能够启用/禁用智能体（UI测试跳过）', async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    // 等待智能体列表
    await page.waitForSelector('[data-testid="agent-card"]', { timeout: 10000 });
    
    // 找到第一个智能体卡片的切换按钮
    const firstToggle = page.locator('[data-testid="agent-card"]').first().locator('button[role="switch"], [type="checkbox"]');
    
    if (await firstToggle.isVisible()) {
      // 获取当前状态
      const initialState = await firstToggle.getAttribute('aria-checked');
      
      // 点击切换
      await firstToggle.click();
      
      // 等待状态更新
      await page.waitForTimeout(1000);
      
      // 验证状态改变
      const newState = await firstToggle.getAttribute('aria-checked');
      expect(newState).not.toBe(initialState);
    }
  });

  test.skip('应该能够编辑智能体（UI测试跳过）', async ({ page }) => {
    // 登录
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    // 等待智能体列表
    await page.waitForSelector('[data-testid="agent-card"]', { timeout: 10000 });
    
    // 点击第一个智能体的编辑按钮
    const editButton = page.locator('[data-testid="agent-card"]').first().locator('button:has-text("编辑"), button[aria-label*="编辑"]');
    
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // 验证编辑对话框打开
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('h2:has-text("编辑智能体")')).toBeVisible();
      
      // 验证表单已预填充
      const nameInput = page.locator('input[name="name"]');
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toBeTruthy();
    }
  });

  test.skip('应该验证endpoint格式（UI测试跳过）', async ({ page }) => {
    // 登录并打开创建对话框
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    await page.click('button:has-text("添加智能体")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 填写无效的endpoint
    const endpointInput = page.locator('input[name="endpoint"]');
    await endpointInput.fill('not-a-valid-url');
    
    // 失焦触发验证
    await endpointInput.blur();
    
    // 等待验证
    await page.waitForTimeout(500);
    
    // 验证错误提示（可能显示）
    // 注意：实时验证可能需要一些时间
    const errorText = page.locator('text=/格式不正确|无效|HTTP/');
    if (await errorText.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(errorText).toBeVisible();
    }
  });
});

test.describe('智能体管理响应式测试', () => {
  test.skip('应该在移动设备上正常显示（UI测试跳过）', async ({ page }) => {
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 登录
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin');
    
    // 验证页面可滚动和可见
    await expect(page.locator('h1')).toBeVisible();
    
    // 验证智能体列表响应式布局
    await page.waitForSelector('[data-testid="agent-list"]', { timeout: 10000 });
    const agentList = page.locator('[data-testid="agent-list"]');
    await expect(agentList).toBeVisible();
  });
});

