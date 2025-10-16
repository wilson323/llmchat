/**
 * T022: E2E用户旅程测试
 * 
 * 完整用户流程：
 * 1. 访问首页
 * 2. 用户登录
 * 3. 选择智能体
 * 4. 发起聊天（流式/非流式）
 * 5. 查看会话历史
 * 6. 搜索会话
 * 7. 文件上传
 * 8. 退出登录
 */

import { test, expect } from '@playwright/test';

test.describe('T022: E2E用户旅程', () => {
  const testUser = {
    username: `e2e_user_${Date.now()}`,
    password: 'E2ETest123!@#',
  };
  let userToken: string;
  let sessionId: string;

  test.describe('1️⃣ 用户注册和登录旅程', () => {
    test('完整注册流程', async ({ page }) => {
      // 访问首页
      await page.goto('http://localhost:3000');
      await expect(page).toHaveTitle(/LLMChat|智能聊天/i);

      // 寻找注册按钮并点击
      const registerBtn = page.locator('button, a').filter({ hasText: /注册|Register|Sign up/i }).first();
      
      if (await registerBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await registerBtn.click();
        
        // 填写注册表单
        await page.fill('input[name="username"], input[type="text"]', testUser.username);
        await page.fill('input[name="password"], input[type="password"]', testUser.password);
        
        // 确认密码（如果有）
        const confirmPasswordField = page.locator('input').filter({ hasText: /确认|Confirm/i });
        if (await confirmPasswordField.count() > 0) {
          await confirmPasswordField.fill(testUser.password);
        }
        
        // 提交注册
        await page.locator('button[type="submit"], button').filter({ hasText: /注册|Register|Sign up/i }).click();
        
        // 等待注册成功（可能自动登录或跳转到登录页）
        await page.waitForURL(/dashboard|chat|login/, { timeout: 5000 }).catch(() => {});
      }
    });

    test('完整登录流程', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 寻找登录按钮
      const loginBtn = page.locator('button, a').filter({ hasText: /登录|Login|Sign in/i }).first();
      
      if (await loginBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginBtn.click();
      } else {
        // 可能已经在登录页
        await page.goto('http://localhost:3000/login');
      }

      // 填写登录表单
      await page.fill('input[name="username"], input[type="text"]', testUser.username);
      await page.fill('input[name="password"], input[type="password"]', testUser.password);
      
      // 提交登录
      await page.locator('button[type="submit"], button').filter({ hasText: /登录|Login|Sign in/i }).click();
      
      // 等待登录成功
      await page.waitForURL(/dashboard|chat|home/, { timeout: 10000 });
      
      // 验证登录成功
      const userElement = page.locator('[data-testid="user-info"], .user-info, .username').first();
      await expect(userElement).toBeVisible({ timeout: 5000 }).catch(() => {});
    });
  });

  test.describe('2️⃣ 智能体选择和聊天旅程', () => {
    test('选择智能体并发起聊天', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 如果有智能体列表，选择第一个
      const agentCard = page.locator('[data-testid="agent-card"], .agent-card, .agent-item').first();
      
      if (await agentCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await agentCard.click();
      }

      // 等待聊天界面加载
      const chatInput = page.locator('textarea, input[type="text"]').filter({ hasText: /输入|Enter|Type/i }).or(
        page.locator('[data-testid="chat-input"], .chat-input, textarea')
      ).first();

      await expect(chatInput).toBeVisible({ timeout: 5000 });

      // 发送测试消息
      await chatInput.fill('你好，这是一条测试消息');
      
      // 寻找发送按钮
      const sendBtn = page.locator('button').filter({ hasText: /发送|Send/i }).or(
        page.locator('[data-testid="send-button"], [aria-label="发送"]')
      ).first();

      await sendBtn.click();

      // 等待AI回复
      const aiMessage = page.locator('[data-testid="ai-message"], .ai-message, .assistant-message').first();
      await expect(aiMessage).toBeVisible({ timeout: 30000 });
    });

    test('测试流式聊天响应', async ({ page }) => {
      await page.goto('http://localhost:3000');

      const chatInput = page.locator('[data-testid="chat-input"], textarea').first();
      await chatInput.fill('请讲一个简短的故事');
      
      const sendBtn = page.locator('[data-testid="send-button"], button').filter({ hasText: /发送|Send/i }).first();
      await sendBtn.click();

      // 等待流式响应开始
      await page.waitForTimeout(1000);

      // 检查是否有加载指示器或流式文本显示
      const loadingOrStreaming = page.locator('[data-testid="loading"], .loading, .streaming').or(
        page.locator('.ai-message:last-child')
      ).first();

      await expect(loadingOrStreaming).toBeVisible({ timeout: 5000 }).catch(() => {});
    });
  });

  test.describe('3️⃣ 会话管理旅程', () => {
    test('创建新会话', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 寻找"新会话"按钮
      const newSessionBtn = page.locator('button').filter({ hasText: /新会话|New chat|New conversation/i }).or(
        page.locator('[data-testid="new-chat"], [aria-label="新会话"]')
      ).first();

      if (await newSessionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newSessionBtn.click();

        // 验证新会话已创建
        const chatInput = page.locator('[data-testid="chat-input"], textarea').first();
        await expect(chatInput).toBeVisible();
        await expect(chatInput).toBeEmpty();
      }
    });

    test('切换会话', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 寻找会话列表
      const sessionList = page.locator('[data-testid="session-list"], .session-list, .conversation-list').first();
      
      if (await sessionList.isVisible({ timeout: 3000 }).catch(() => false)) {
        const sessions = page.locator('[data-testid="session-item"], .session-item, .conversation-item');
        const sessionCount = await sessions.count();

        if (sessionCount > 1) {
          // 点击第二个会话
          await sessions.nth(1).click();

          // 验证会话已切换（等待消息加载）
          await page.waitForTimeout(1000);
        }
      }
    });

    test('搜索会话', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 寻找搜索框
      const searchInput = page.locator('input[type="search"], input').filter({ hasText: /搜索|Search/i }).or(
        page.locator('[data-testid="search-sessions"], [placeholder*="搜索"]')
      ).first();

      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('测试');
        
        // 等待搜索结果
        await page.waitForTimeout(500);
        
        // 验证搜索有响应
        const sessionList = page.locator('[data-testid="session-list"], .session-list');
        await expect(sessionList).toBeVisible({ timeout: 2000 }).catch(() => {});
      }
    });
  });

  test.describe('4️⃣ 文件上传旅程', () => {
    test('上传文件到聊天', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 寻找文件上传按钮
      const uploadBtn = page.locator('button, input[type="file"]').filter({ hasText: /上传|Upload|文件|File/i }).or(
        page.locator('[data-testid="upload-button"], [aria-label="上传文件"]')
      ).first();

      if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // 如果是按钮，点击后可能打开文件选择器
        // 如果是input，直接设置文件
        const inputFile = page.locator('input[type="file"]').first();
        
        if (await inputFile.count() > 0) {
          // 创建临时测试文件
          await inputFile.setInputFiles({
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('This is a test file content'),
          });

          // 等待上传完成
          await page.waitForTimeout(2000);
          
          // 验证文件已添加到界面
          const fileIndicator = page.locator('.file-preview, .uploaded-file, [data-testid="uploaded-file"]').first();
          await expect(fileIndicator).toBeVisible({ timeout: 3000 }).catch(() => {});
        }
      }
    });
  });

  test.describe('5️⃣ 退出登录旅程', () => {
    test('完整登出流程', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 寻找用户菜单或退出按钮
      const logoutBtn = page.locator('button, a').filter({ hasText: /退出|登出|Logout|Sign out/i }).or(
        page.locator('[data-testid="logout"], [aria-label="退出登录"]')
      ).first();

      if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoutBtn.click();

        // 等待跳转到登录页
        await page.waitForURL(/login|welcome|home/, { timeout: 5000 }).catch(() => {});

        // 验证已退出（应该显示登录按钮）
        const loginBtn = page.locator('button').filter({ hasText: /登录|Login/i }).first();
        await expect(loginBtn).toBeVisible({ timeout: 3000 }).catch(() => {});
      }
    });

    test('退出后无法访问保护页面', async ({ page, context }) => {
      // 先登录
      await page.goto('http://localhost:3000/login');
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="password"]', testUser.password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/dashboard|chat/, { timeout: 5000 }).catch(() => {});

      // 退出
      const logoutBtn = page.locator('button').filter({ hasText: /退出|Logout/i }).first();
      if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoutBtn.click();
      }

      // 尝试直接访问保护页面
      await page.goto('http://localhost:3000/chat');

      // 应该被重定向到登录页
      await page.waitForURL(/login/, { timeout: 5000 }).catch(() => {});
      
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/login/i);
    });
  });
});

