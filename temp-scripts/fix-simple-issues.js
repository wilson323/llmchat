#!/usr/bin/env node
/**
 * 修复简单的ESLint问题
 * 1. require-await: 移除不必要的async
 * 2. no-unused-vars: 标记未使用的变量
 * 3. no-useless-escape: 移除不必要的转义
 */

const fs = require('fs');
const path = require('path');

console.log('=== 开始修复简单问题 ===\n');

function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

const srcDir = path.join(__dirname, '..', 'backend', 'src');
const files = getAllTsFiles(srcDir);

let totalFiles = 0;
let totalReplacements = 0;
const stats = {
  unusedVars: 0,
  uselessEscape: 0,
  requireAwait: 0
};

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  let fileModified = false;
  
  // 1. 修复 no-useless-escape - 移除不必要的转义
  // 例如: /\:/ -> /:/
  const uselessEscapePattern = /\\([^\\nrtvfbdDsSwW0xu'"`])/g;
  if (uselessEscapePattern.test(content)) {
    const before = content;
    content = content.replace(uselessEscapePattern, '$1');
    if (content !== before) {
      const count = (before.match(uselessEscapePattern) || []).length;
      stats.uselessEscape += count;
      fileModified = true;
      console.log(`  ${path.basename(file)}: 修复 ${count} 个不必要的转义`);
    }
  }
  
  // 2. 标记未使用的变量（添加下划线前缀）
  // 这个需要更复杂的AST分析，暂时跳过，让ESLint报告
  
  // 3. require-await - 需要AST分析，暂时跳过
  
  if (fileModified && content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalFiles++;
    console.log(`  ✓ ${path.basename(file)} 已更新\n`);
  }
});

console.log('\n=== 修复完成 ===');
console.log(`处理文件数: ${totalFiles}`);
console.log(`修复的问题:`);
console.log(`  - 不必要的转义: ${stats.uselessEscape}`);
console.log('\n注意: require-await 和 no-unused-vars 需要手动或使用ESLint --fix修复');
console.log('运行: npx eslint src --fix');

