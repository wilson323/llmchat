#!/usr/bin/env node

/**
 * 自动修复前端ESLint错误的脚本
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const frontendDir = path.join(projectRoot, 'frontend');
let fixesApplied = 0;

console.log('🔧 开始修复前端ESLint错误...');

// 修复SyncManager prefer-const问题
const syncManagerPath = path.join(frontendDir, 'src/services/sync/SyncManager.ts');
if (fs.existsSync(syncManagerPath)) {
  let content = fs.readFileSync(syncManagerPath, 'utf8');

  if (!content.includes('const conflicts = 0;')) {
    content = content.replace(
      'let created = 0, updated = 0, deleted = 0, conflicts = 0;',
      'let created = 0, updated = 0, deleted = 0;\n    const conflicts = 0;'
    );

    fs.writeFileSync(syncManagerPath, content);
    fixesApplied++;
    console.log('✅ 修复 SyncManager.ts prefer-const问题');
  }
}

// 修复等式操作符问题
const adminHomePath = path.join(frontendDir, 'src/components/admin/AdminHome.tsx');
if (fs.existsSync(adminHomePath)) {
  let content = fs.readFileSync(adminHomePath, 'utf8');
  const originalContent = content;

  content = content.replace(/!=/g, '!==');

  if (content !== originalContent) {
    fs.writeFileSync(adminHomePath, content);
    fixesApplied++;
    console.log('✅ 修复 AdminHome.tsx 等式操作符问题');
  }
}

console.log(`\n✅ 完成！共修复了 ${fixesApplied} 个问题`);

// 检查ESLint状态
try {
  console.log('\n🔍 检查ESLint状态...');
  const result = execSync('cd frontend && pnpm run lint 2>&1', {
    encoding: 'utf8',
    cwd: projectRoot
  });

  const match = result.match(/(\d+)\s+problems\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/);
  if (match) {
    const [, total, errors, warnings] = match;
    console.log(`📊 当前ESLint状态: ${total} 个问题 (${errors} 错误, ${warnings} 警告)`);
  }
} catch (error) {
  const errorOutput = error.stdout || error.stderr || '';
  const match = errorOutput.match(/(\d+)\s+problems\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/);
  if (match) {
    const [, total, errors, warnings] = match;
    console.log(`📊 当前ESLint状态: ${total} 个问题 (${errors} 错误, ${warnings} 警告)`);
  }
}