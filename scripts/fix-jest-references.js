#!/usr/bin/env node

/**
 * 修复剩余Jest引用的脚本
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const frontendDir = path.join(projectRoot, 'frontend');
let fixesApplied = 0;

console.log('🔧 继续修复剩余的Jest引用...');

// 需要修复的文件列表
const filesToFix = [
  'src/hooks/__tests__/useChat.test.ts',
  'src/components/chat/__tests__/ChatContainer.test.tsx',
  'src/components/chat/__tests__/performance.test.tsx'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(frontendDir, filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // 替换剩余的jest引用
    content = content.replace(/jest\.clearAllMocks\(\)/g, 'vi.clearAllMocks()');
    content = content.replace(/jest\.MockedFunction</g, 'MockedFunction');
    content = content.replace(/jest\.mock</g, 'vi.mock');
    content = content.replace(/jest\.fn\(/g, 'vi.fn(');
    content = content.replace(/jest\.spyOn\(/g, 'vi.spyOn(');
    content = content.replace(/jest\.requireActual\(/g, 'vi.importActual(');
    content = content.replace(/jest\.useFakeTimers\(\)/g, 'vi.useFakeTimers()');
    content = content.replace(/jest\.useRealTimers\(\)/g, 'vi.useRealTimers()');

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content);
      fixesApplied++;
      console.log(`✅ 修复 ${filePath} 的剩余Jest引用`);
    }
  }
});

// 更新vitest配置，添加全局mock
const vitestConfigPath = path.join(frontendDir, 'vitest.config.ts');
if (fs.existsSync(vitestConfigPath)) {
  let content = fs.readFileSync(vitestConfigPath, 'utf8');

  if (!content.includes('global:')) {
    content = content.replace(
      'test: {',
      `test: {
    globals: true,
    global: true,`
    );

    fs.writeFileSync(vitestConfigPath, content);
    console.log('✅ 更新vitest.config.ts，启用全局配置');
  }
}

console.log(`\n✅ 完成！共修复了 ${fixesApplied} 个Jest引用问题`);

// 检查API mock问题
const apiTestPath = path.join(frontendDir, 'src/services/__tests__/api.test.ts');
if (fs.existsSync(apiTestPath)) {
  let content = fs.readFileSync(apiTestPath, 'utf8');

  // 修复axios mock问题
  content = content.replace(
    "vi.mock('axios');",
    `vi.mock('axios', () => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      create: vi.fn(() => ({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        defaults: {},
      })),
    }));`
  );

  fs.writeFileSync(apiTestPath, content);
  fixesApplied++;
  console.log('✅ 修复 api.test.ts 的axios mock问题');
}

console.log(`\n📊 总修复数: ${fixesApplied}`);