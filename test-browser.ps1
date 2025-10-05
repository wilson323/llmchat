# 浏览器自动化测试脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开始浏览器自动化测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否安装了 Playwright
Write-Host "检查 Playwright 是否安装..." -ForegroundColor Yellow
Set-Location frontend
$playwrightInstalled = Test-Path "node_modules\@playwright"

if (-not $playwrightInstalled) {
    Write-Host "⚠️ Playwright 未安装，正在安装..." -ForegroundColor Yellow
    pnpm add -D @playwright/test
    pnpm exec playwright install chromium
}

Write-Host "✅ Playwright 已就绪" -ForegroundColor Green
Write-Host ""

# 创建临时测试文件
$testContent = @'
import { test, expect } from '@playwright/test';

test.describe('完整页面流程测试', () => {
  test('测试登录流程和页面跳转', async ({ page }) => {
    console.log('1️⃣ 访问登录页面...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    // 截图：登录页面
    await page.screenshot({ path: 'test-results/01-login-page.png', fullPage: true });
    console.log('✅ 登录页面截图已保存');
    
    // 检查登录页面元素
    const usernameInput = await page.locator('input[placeholder*="用户名"]');
    const passwordInput = await page.locator('input[type="password"]');
    const loginButton = await page.locator('button[type="submit"]');
    
    expect(await usernameInput.count()).toBeGreaterThan(0);
    expect(await passwordInput.count()).toBeGreaterThan(0);
    expect(await loginButton.count()).toBeGreaterThan(0);
    console.log('✅ 登录页面元素检查通过');
    
    console.log('2️⃣ 输入管理员账号密码...');
    await usernameInput.fill('admin');
    await passwordInput.fill('admin123');
    
    // 截图：填写表单
    await page.screenshot({ path: 'test-results/02-login-filled.png', fullPage: true });
    console.log('✅ 表单填写截图已保存');
    
    console.log('3️⃣ 点击登录按钮...');
    await loginButton.click();
    
    // 等待跳转
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // 获取当前URL
    const currentUrl = page.url();
    console.log(`📍 当前URL: ${currentUrl}`);
    
    // 截图：登录后页面
    await page.screenshot({ path: 'test-results/03-after-login.png', fullPage: true });
    console.log('✅ 登录后页面截图已保存');
    
    // 检查页面内容
    const pageContent = await page.content();
    console.log('📄 页面标题:', await page.title());
    
    // 检查是否有管理后台特征
    const hasAdminFeatures = pageContent.includes('管理') || 
                             pageContent.includes('后台') || 
                             pageContent.includes('Admin') ||
                             pageContent.includes('Dashboard');
    
    // 检查是否有聊天界面特征
    const hasChatFeatures = pageContent.includes('发送') || 
                            pageContent.includes('消息') || 
                            pageContent.includes('聊天');
    
    console.log('');
    console.log('========================================');
    console.log('📊 测试结果分析');
    console.log('========================================');
    console.log(`URL: ${currentUrl}`);
    console.log(`包含管理后台特征: ${hasAdminFeatures ? '✅ 是' : '❌ 否'}`);
    console.log(`包含聊天界面特征: ${hasChatFeatures ? '✅ 是' : '❌ 否'}`);
    console.log('');
    
    if (currentUrl.includes('/home')) {
      console.log('✅ 跳转正确：管理员登录后跳转到 /home');
    } else if (currentUrl === 'http://localhost:3000/') {
      console.log('❌ 跳转错误：管理员登录后跳转到了用户聊天界面 /');
    } else {
      console.log(`⚠️ 跳转异常：跳转到了 ${currentUrl}`);
    }
    
    // 测试用户聊天页面
    console.log('');
    console.log('4️⃣ 测试用户聊天页面...');
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/04-chat-page.png', fullPage: true });
    console.log('✅ 用户聊天页面截图已保存');
    
    // 测试管理后台页面
    console.log('5️⃣ 测试管理后台页面...');
    await page.goto('http://localhost:3000/home');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/05-admin-home.png', fullPage: true });
    console.log('✅ 管理后台页面截图已保存');
    
    console.log('');
    console.log('========================================');
    console.log('✅ 所有截图已保存到 test-results/ 目录');
    console.log('========================================');
  });
});
'@

# 创建测试目录
New-Item -ItemType Directory -Force -Path "test-results" | Out-Null
$testContent | Out-File -FilePath "e2e-test.spec.ts" -Encoding UTF8

Write-Host "运行 Playwright 测试..." -ForegroundColor Yellow
pnpm exec playwright test e2e-test.spec.ts --headed

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成！请查看 frontend/test-results/ 目录的截图" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 返回根目录
Set-Location ..
