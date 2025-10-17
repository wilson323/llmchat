#!/usr/bin/env node
/**
 * 智能修复 prefer-nullish-coalescing
 * 将 || 替换为 ?? (仅在安全的情况下)
 */

const fs = require('fs');
const path = require('path');

console.log('=== 开始修复 nullish coalescing ===\n');

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

let totalFiles = 0;
let totalReplacements = 0;

// 安全的替换模式：
// 1. 数字默认值：expr || 0, expr || 1 等
// 2. 对象默认值：expr || {}, expr || []
// 3. 空字符串默认值：expr || ''
// 4. 布尔默认值：expr || false, expr || true

const safePatterns = [
  // 数字默认值
  { 
    pattern: /(\w+(?:\.\w+|\?\.\w+|\[\w+\])*)\s*\|\|\s*(\d+)/g,
    test: (expr, defaultVal) => /^\d+$/.test(defaultVal),
    name: '数字默认值'
  },
  // 空对象/数组
  {
    pattern: /(\w+(?:\.\w+|\?\.\w+|\[\w+\])*)\s*\|\|\s*(\{\}|\[\])/g,
    test: (expr, defaultVal) => defaultVal === '{}' || defaultVal === '[]',
    name: '空对象/数组默认值'
  },
  // 空字符串
  {
    pattern: /(\w+(?:\.\w+|\?\.\w+|\[\w+\])*)\s*\|\|\s*['"]{2}/g,
    test: (expr, defaultVal) => defaultVal === "''" || defaultVal === '""',
    name: '空字符串默认值'
  }
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  let fileModified = false;
  let fileReplacements = 0;
  
  safePatterns.forEach(({ pattern, test, name }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, (match, expr, defaultVal) => {
        // 跳过注释中的内容
        if (match.includes('//') || match.includes('/*')) {
          return match;
        }
        
        // 跳过字符串中的内容  
        const beforeMatch = content.substring(0, content.indexOf(match));
        const stringCount = (beforeMatch.match(/['"]/g) || []).length;
        if (stringCount % 2 !== 0) {
          return match;
        }
        
        fileReplacements++;
        return `${expr} ?? ${defaultVal}`;
      });
      
      if (fileReplacements > 0) {
        console.log(`  ${path.basename(file)}: 替换 ${fileReplacements} 个 ${name}`);
        fileModified = true;
      }
    }
  });
  
  if (fileModified && content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalFiles++;
    console.log(`  ✓ ${path.basename(file)} 已更新\n`);
  }
});

console.log('\n=== 修复完成 ===');
console.log(`处理文件数: ${totalFiles}`);
console.log(`总替换数: ${totalReplacements}`);
console.log('\n运行 "cd backend && npx eslint src" 验证修复结果');
