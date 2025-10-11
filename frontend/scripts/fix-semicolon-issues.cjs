#!/usr/bin/env node

/**
 * 修复分号问题
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd(); // 当前在frontend目录
let fixesApplied = 0;

console.log('🔧 修复分号和语法问题...');

// 修复api.ts中的分号问题
const apiPath = path.join(projectRoot, 'src/services/api.ts');
if (fs.existsSync(apiPath)) {
  let content = fs.readFileSync(apiPath, 'utf8');
  const originalContent = content;

  // 修复多余的分号
  content = content.replace(/\{;\s*\n/g, '{\n');
  content = content.replace(/\}\);\s*\n/g, '};\n');
  content = content.replace(/\);;\s*\n/g, ');\n');
  content = content.replace(/const\s+(\w+)\s*=\s*\([^)]*\)\s*{;\s*\n/g, 'const $1 = ($2) {\n');

  if (content !== originalContent) {
    fs.writeFileSync(apiPath, content);
    fixesApplied++;
    console.log('✅ 修复 api.ts 的分号问题');
  }
}

// 修复useChat.ts中的分号问题
const useChatPath = path.join(projectRoot, 'src/hooks/useChat.ts');
if (fs.existsSync(useChatPath)) {
  let content = fs.readFileSync(useChatPath, 'utf8');
  const originalContent = content;

  // 修复多余的分号
  content = content.replace(/\s*\{\s*;\s*\n/g, ' {\n');
  content = content.replace(/\s*\}\s*;\s*\n/g, '\n}\n');

  if (content !== originalContent) {
    fs.writeFileSync(useChatPath, content);
    fixesApplied++;
    console.log('✅ 修复 useChat.ts 的分号问题');
  }
}

console.log(`\n✅ 完成！共修复了 ${fixesApplied} 个语法问题`);

// 重新检查
try {
  const { execSync } = require('child_process');
  const result = execSync('pnpm run lint 2>&1', {
    encoding: 'utf8',
    cwd: projectRoot
  });

  const match = result.match(/(\\d+)\s+problems\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)/);
  if (match) {
    const [, total, errors, warnings] = match;
    console.log(`📊 当前ESLint状态: ${total} 个问题 (${errors} 错误, ${warnings} 警告)`);
  }

} catch (error) {
  const errorOutput = error.stdout || error.stderr || '';
  const match = errorOutput.match(/(\\d+)\s+problems\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)/);
  if (match) {
    const [, total, errors, warnings] = match;
    console.log(`📊 当前ESLint状态: ${total} 个问题 (${errors} 错误, ${warnings} 警告)`);
  }
}