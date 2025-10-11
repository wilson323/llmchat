#!/usr/bin/env node

/**
 * 修复前端测试框架配置冲突的脚本
 * 将Jest语法迁移到Vitest
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const frontendDir = path.join(projectRoot, 'frontend');
let fixesApplied = 0;

console.log('🔧 开始修复前端测试框架配置冲突...');

// 需要修复的测试文件列表
const testFiles = [
  'src/hooks/__tests__/useChat.test.ts',
  'src/services/__tests__/api.test.ts',
  'src/components/chat/__tests__/ChatContainer.test.tsx',
  'src/components/chat/__tests__/performance.test.tsx'
];

testFiles.forEach(filePath => {
  const fullPath = path.join(frontendDir, filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // 替换Jest mock语法为Vitest语法
    content = content.replace(/jest\.mock\(/g, 'vi.mock(');
    content = content.replace(/jest\.fn\(/g, 'vi.fn(');
    content = content.replace(/jest\.spyOn\(/g, 'vi.spyOn(');

    // 替换Jest匹配器为Vitest匹配器
    content = content.replace(/\.toHaveBeenCalledTimes\(/g, '.toHaveBeenCalledTimes(');
    content = content.replace(/\.toHaveBeenCalledWith\(/g, '.toHaveBeenCalledWith(');
    content = content.replace(/\.toHaveBeenCalled\(/g, '.toHaveBeenCalled(');
    content = content.replace(/\.toBe\(/g, '.toBe(');
    content = content.replace(/\.toEqual\(/g, '.toEqual(');
    content = content.replace(/\.toBeTruthy\(/g, '.toBeTruthy(');
    content = content.replace(/\.toBeFalsy\(/g, '.toBeFalsy(');
    content = content.replace(/\.toBeNull\(/g, '.toBeNull(');
    content = content.replace(/\.toBeUndefined\(/g, '.toBeUndefined(');
    content = content.replace(/\.toBeDefined\(/g, '.toBeDefined(');
    content = content.replace(/\.toHaveLength\(/g, '.toHaveLength(');

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content);
      fixesApplied++;
      console.log(`✅ 修复 ${filePath} 的Jest语法`);
    }
  } else {
    console.log(`⚠️ 文件不存在: ${filePath}`);
  }
});

// 创建统一的vitest setup文件
const setupPath = path.join(frontendDir, 'src/test/setup.ts');
if (fs.existsSync(setupPath)) {
  let content = fs.readFileSync(setupPath, 'utf8');

  // 添加全局vitest导入
  if (!content.includes('import { vi } from \'vitest\'')) {
    content = content.replace(
      "import { afterEach, vi } from 'vitest';",
      "import { afterEach, vi } from 'vitest';\n\n// 全局暴露vitest方法\nglobal.vi = vi;\nglobal.describe = describe;\nglobal.it = it;\nglobal.test = test;\nglobal.expect = expect;"
    );
    fs.writeFileSync(setupPath, content);
    fixesApplied++;
    console.log('✅ 更新测试setup文件');
  }
}

console.log(`\n✅ 完成！共修复了 ${fixesApplied} 个测试文件`);

// 重新运行测试检查
try {
  console.log('\n🔍 检查测试状态...');
  const { execSync } = require('child_process');
  const result = execSync('cd frontend && pnpm run test:run 2>&1', {
    encoding: 'utf8',
    cwd: projectRoot
  });

  // 提取测试结果
  const lines = result.split('\n');
  const testResultLine = lines.find(line => line.includes('Test Files') || line.includes('✓') || line.includes('❯'));

  if (testResultLine) {
    console.log('📊 测试状态:', testResultLine.trim());
  }

  // 检查失败测试
  const failedTests = lines.filter(line => line.includes('❯') || line.includes('FAIL'));
  if (failedTests.length > 0) {
    console.log(`⚠️ 发现 ${failedTests.length} 个失败的测试，需要进一步修复`);
  }

} catch (error) {
  const errorOutput = error.stdout || error.stderr || '';
  console.log('❌ 测试运行失败:', errorOutput);
}