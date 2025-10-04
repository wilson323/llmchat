import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 * 轻量级配置，避免过度占用资源
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // 超时配置
  timeout: 30 * 1000,       // 单个测试30秒超时
  expect: {
    timeout: 10 * 1000,     // 断言10秒超时
  },
  
  // 失败重试（CI环境）
  retries: process.env.CI ? 2 : 0,
  
  // 并行worker数（轻量级，避免占用过多资源）
  workers: process.env.CI ? 2 : 3,
  
  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],
  
  // 全局配置
  use: {
    // 基础URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // 浏览器上下文
    trace: 'on-first-retry',        // 失败时记录追踪
    screenshot: 'only-on-failure',  // 失败时截图
    video: 'retain-on-failure',     // 失败时保留视频
    
    // 超时
    actionTimeout: 10 * 1000,       // 操作10秒超时
    navigationTimeout: 15 * 1000,   // 导航15秒超时
  },

  // 测试项目（浏览器）
  projects: [
    // 仅使用 Chromium 以节省资源
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 其他浏览器可选（需要时启用）
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // 移动端测试（可选）
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // 本地开发服务器（测试前自动启动）
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
