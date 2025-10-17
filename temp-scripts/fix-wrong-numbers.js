#!/usr/bin/env node
/**
 * 修复错误的number默认值
 * 这些number应该是空字符串
 */

const fs = require('fs');
const path = require('path');

console.log('=== 修复错误的number默认值 ===\n');

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
  
  // 修复pattern: ?? 后跟4-5位数字（很可能是行号）
  // 这些应该是空字符串
  const wrongPatterns = [
    // ?? 大数字 (可能是行号)
    { pattern: /\?\? (\d{3,5})(?![.\d])/g, replacement: '?? \'\'', name: '错误的数字默认值' }
  ];
  
  wrongPatterns.forEach(({ pattern, replacement, name }) => {
    const matches = content.match(pattern);
    if (matches) {
      // 只替换看起来像行号的大数字（>100）
      content = content.replace(/\?\? (\d{3,5})(?![.\d])/g, (match, num) => {
        const number = parseInt(num);
        // 如果是大于100的数字，很可能是错误的行号
        if (number > 100) {
          fileFixed++;
          return '?? \'\'';
        }
        return match;
      });
      
      if (fileFixed > 0) {
        console.log(`  ${path.basename(file)}: 修复 ${fileFixed} 个错误的默认值`);
      }
    }
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalFiles++;
    totalFixed += fileFixed;
  }
});

console.log(`\n=== 修复完成 ===`);
console.log(`处理文件数: ${totalFiles}`);
console.log(`总修复数: ${totalFixed}`);
console.log('\n运行 "cd backend && npx tsc --noEmit" 验证修复');

