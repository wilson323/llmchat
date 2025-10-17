#!/usr/bin/env node
/**
 * 清理console语句脚本
 * 将console.log等替换为logger调用
 */

const fs = require('fs');
const path = require('path');

console.log('=== 开始清理console语句 ===\n');

// 获取所有需要处理的TS文件（排除测试文件）
function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过__tests__目录
      if (!file.includes('__tests__') && file !== 'test') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      // 跳过测试文件
      if (!file.includes('test') && !file.endsWith('.skip') && 
          file !== 'testUtils.ts' && file !== 'setup.ts') {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

const srcDir = path.join(__dirname, '..', 'backend', 'src');
const files = getAllTsFiles(srcDir);

let totalFiles = 0;
let totalReplacements = 0;

const patterns = [
  { pattern: /console\.log\(/g, replacement: 'logger.debug(', name: 'console.log' },
  { pattern: /console\.error\(/g, replacement: 'logger.error(', name: 'console.error' },
  { pattern: /console\.warn\(/g, replacement: 'logger.warn(', name: 'console.warn' },
  { pattern: /console\.info\(/g, replacement: 'logger.info(', name: 'console.info' },
  { pattern: /console\.debug\(/g, replacement: 'logger.debug(', name: 'console.debug' }
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  let fileModified = false;
  let fileReplacements = 0;
  
  // 检查是否已经导入logger
  const hasLoggerImport = /import.*logger.*from.*['"]@\/utils\/logger['"]/.test(content);
  
  // 检查是否有console语句
  const hasConsole = patterns.some(p => p.pattern.test(content));
  
  if (!hasConsole) {
    return;
  }
  
  // 如果有console但没有logger导入，添加导入
  if (!hasLoggerImport) {
    // 找到最后一个import语句的位置
    const importRegex = /import\s+.*?from\s+['"][^'"]+['""];?\r?\n/g;
    const importMatches = [...content.matchAll(importRegex)];
    
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const insertPos = lastImport.index + lastImport[0].length;
      content = content.slice(0, insertPos) + "import { logger } from '@/utils/logger';\n" + content.slice(insertPos);
      fileModified = true;
    }
  }
  
  // 执行替换
  patterns.forEach(({ pattern, replacement, name }) => {
    const matches = content.match(pattern);
    if (matches) {
      const replacementCount = matches.length;
      content = content.replace(pattern, replacement);
      if (replacementCount > 0) {
        console.log(`  ${path.basename(file)}: 替换 ${replacementCount} 个 ${name}`);
        fileReplacements += replacementCount;
        fileModified = true;
      }
    }
  });
  
  // 如果文件被修改，保存
  if (fileModified && content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalFiles++;
    totalReplacements += fileReplacements;
    console.log(`  ✓ ${path.basename(file)} 已更新 (${fileReplacements} 处替换)\n`);
  }
});

console.log('\n=== 清理完成 ===');
console.log(`处理文件数: ${totalFiles}`);
console.log(`总替换数: ${totalReplacements}`);
console.log('\n运行 "cd backend && npx eslint src" 验证清理结果');

