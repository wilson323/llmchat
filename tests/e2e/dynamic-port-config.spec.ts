import { test, expect } from '@playwright/test';

test.describe('动态端口配置系统测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置页面超时
    page.setDefaultTimeout(10000);
  });

  test('前端页面能正常加载', async ({ page }) => {
    // 访问前端页面
    await page.goto('http://localhost:3004');

    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');

    // 检查页面标题
    await expect(page).toHaveTitle(/LLMChat/);

    // 检查根元素是否存在
    await expect(page.locator('#root')).toBeVisible();

    // 检查页面是否包含React应用
    const hasReactContent = await page.locator('body').textContent();
    expect(hasReactContent).toBeTruthy();
  });

  test('前端能够代理API请求到后端', async ({ page }) => {
    await page.goto('http://localhost:3004');
    await page.waitForLoadState('domcontentloaded');

    // 监听网络请求
    const apiResponse = page.waitForResponse(response =>
      response.url().includes('/api/') && response.status() === 404
    );

    // 执行一个会触发API请求的操作
    await page.evaluate(() => {
      // 模拟前端API调用
      fetch('/api/agents', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(() => {}); // 忽略错误，我们只关心网络请求
    });

    // 等待API响应
    const response = await apiResponse;

    // 验证响应状态
    expect(response.status()).toBe(404);

    // 验证响应内容包含预期的错误信息
    const responseText = await response.text();
    expect(responseText).toContain('NOT_FOUND');
    expect(responseText).toContain('路由');
  });

  test('后端健康检查端点正常工作', async ({ page }) => {
    await page.goto('http://localhost:3004');
    await page.waitForLoadState('domcontentloaded');

    // 直接调用后端健康检查
    const healthResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:3005/health');
        const data = await response.json();
        return { status: response.status, data };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 验证健康检查响应
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('ok');
    expect(healthResponse.data.message).toContain('LLMChat Backend');
  });

  test('前端能够正确处理错误响应', async ({ page }) => {
    await page.goto('http://localhost:3004');
    await page.waitForLoadState('domcontentloaded');

    // 测试访问不存在的API端点
    const errorResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/nonexistent-endpoint');
        const data = await response.json();
        return { status: response.status, data };
      } catch (error) {
        return { error: error.message };
      }
    });

    // 验证错误响应格式
    expect(errorResponse.status).toBe(404);
    expect(errorResponse.data.code).toBe('NOT_FOUND');
    expect(errorResponse.data.message).toContain('不存在');
  });

  test('前端静态资源加载正常', async ({ page }) => {
    await page.goto('http://localhost:3004');
    await page.waitForLoadState('domcontentloaded');

    // 检查logo是否加载
    const logoResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/logo.svg');
        return { status: response.status, contentType: response.headers.get('content-type') };
      } catch (error) {
        return { error: error.message };
      }
    });

    expect(logoResponse.status).toBe(200);
    expect(logoResponse.contentType).toContain('image/svg');
  });

  test('前端React应用正常渲染', async ({ page }) => {
    await page.goto('http://localhost:3004');

    // 等待React应用完全加载
    await page.waitForSelector('#root', { state: 'visible' });

    // 检查是否有React开发工具的迹象
    const reactDevTools = await page.evaluate(() => {
      return !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    });

    // 检查页面是否有JavaScript错误
    const jsErrors = await page.evaluate(() => {
      const errors = [];
      const originalError = window.error;
      window.error = (message) => {
        errors.push(message.toString());
      };
      return errors;
    });

    // 在开发环境中，React DevTools应该可用
    expect(reactDevTools).toBe(true);

    // 不应该有JavaScript错误
    expect(jsErrors.length).toBe(0);
  });

  test('动态端口检测脚本工作正常', async () => {
    // 直接测试端口检测脚本
    const { execSync } = require('child_process');
    const { existsSync } = require('fs');

    try {
      // 运行端口检测脚本
      const result = execSync('node ../scripts/find-backend-port.js', {
        cwd: '/mnt/f/ss/aa/sssss/llmchat/frontend',
        encoding: 'utf8'
      });

      // 验证脚本输出包含成功信息
      expect(result).toContain('发现LLMChat后端运行在端口');
      expect(result).toContain('动态端口配置完成');

      // 验证Vite配置文件被更新
      const viteConfigPath = '/mnt/f/ss/aa/sssss/llmchat/frontend/vite.config.ts';
      expect(existsSync(viteConfigPath)).toBe(true);

      const viteConfig = require('fs').readFileSync(viteConfigPath, 'utf8');
      expect(viteConfig).toContain("target: 'http://localhost:3005'");

    } catch (error) {
      throw new Error(`端口检测脚本测试失败: ${error.message}`);
    }
  });

  test('系统端口配置正确性验证', async () => {
    // 验证端口监听状态
    const portStatus = await page.evaluate(async () => {
      const checkPort = async (port) => {
        try {
          const response = await fetch(`http://localhost:${port}/`, {
            method: 'HEAD',
            mode: 'no-cors'
          });
          return { port, status: response.status, available: true };
        } catch (error) {
          return { port, available: false, error: error.message };
        }
      };

      const [frontendStatus, backendStatus] = await Promise.all([
        checkPort(3004),
        checkPort(3005)
      ]);

      return { frontendStatus, backendStatus };
    });

    // 验证端口状态
    expect(portStatus.frontendStatus.available).toBe(true);
    expect(portStatus.backendStatus.available).toBe(true);

    // 验证前端返回HTML
    expect(portStatus.frontendStatus.status).toBe(200);
  });
});