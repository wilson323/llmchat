#!/usr/bin/env node
/**
 * 智能修复TypeScript类型错误
 * 根据上下文判断正确的默认值类型
 */

const fs = require('fs');
const path = require('path');

console.log('=== 智能修复TypeScript类型错误 ===\n');

function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
      getAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

const srcDir = path.join(__dirname, '..', 'backend', 'src');
const files = getAllTsFiles(srcDir);

let totalFixed = 0;
let totalFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  let fileFixed = 0;
  
  // 修复错误的''在number类型上下文中
  // Pattern 1: number类型字段被赋值为 ''
  const numberContextPatterns = [
    // xxx: number | "" → xxx: 0 (在数值运算、比较、赋值给number类型的场景)
    {
      pattern: /: (number \| ""|"" \| number)(?=\s*[;,)])/g,
      replacement: ': number',
      name: '移除错误的空字符串联合类型'
    },
    // \?\? "" 在需要number的地方 → ?? 0
    {
      pattern: /(\w+\s*:\s*\w+(?:\.\w+)*)\s*\?\?\s*""/g,
      replacement: (match, expr) => {
        // 如果表达式看起来是数字相关的，用0
        if (expr.includes('count') || expr.includes('size') || expr.includes('limit') || 
            expr.includes('timeout') || expr.includes('interval') || expr.includes('delay')) {
          return `${expr} ?? 0`;
        }
        return match;
      },
      name: '修复数字字段的空字符串默认值'
    }
  ];
  
  numberContextPatterns.forEach(({ pattern, replacement, name }) => {
    const before = content;
    content = content.replace(pattern, replacement);
    if (content !== before) {
      const changesCount = (before.match(pattern) || []).length;
      fileFixed += changesCount;
      console.log(`  ${path.basename(file)}: ${name} (${changesCount}处)`);
    }
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalFiles++;
    totalFixed += fileFixed;
  }
});

console.log(`\n=== 智能修复完成 ===`);
console.log(`处理文件数: ${totalFiles}`);
console.log(`总修复数: ${totalFixed}`);
console.log('\n运行 "cd backend && npx tsc --noEmit" 验证');

