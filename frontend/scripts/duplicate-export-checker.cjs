#!/usr/bin/env node

/**
 * 重复导出检查工具
 * 检查文件中是否存在重复的导出声明
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// 需要检查的文件类型
const CHECK_EXTENSIONS = ['.ts', '.tsx'];

// 忽略的目录
const IGNORE_DIRS = ['node_modules', 'dist', '.git', '__tests__', 'test'];

/**
 * 递归获取所有需要检查的文件
 */
function getAllFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !IGNORE_DIRS.includes(item)) {
        traverse(fullPath);
      } else if (stat.isFile() && CHECK_EXTENSIONS.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * 检查单个文件的重复导出
 */
function checkFileDuplicates(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 匹配导出声明的正则表达式
    const exportRegex = /^export\s+(?:const|let|var|class|function|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    const exportDefaultRegex = /^export\s+(?:default\s+)?(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    const namedExportRegex = /export\s*{\s*([^}]+)\s*}/g;

    const exports = new Set();
    const duplicates = [];
    let match;

    // 检查声明式导出
    while ((match = exportRegex.exec(content)) !== null) {
      const exportName = match[1];
      if (exports.has(exportName)) {
        duplicates.push({
          name: exportName,
          type: 'declaration',
          line: lines.findIndex(line => line.includes(match[0])) + 1
        });
      } else {
        exports.add(exportName);
      }
    }

    // 检查默认导出
    exportRegex.lastIndex = 0; // 重置正则表达式
    while ((match = exportDefaultRegex.exec(content)) !== null) {
      const exportName = match[1];
      if (exports.has(exportName)) {
        duplicates.push({
          name: exportName,
          type: 'default',
          line: lines.findIndex(line => line.includes(match[0])) + 1
        });
      } else {
        exports.add(exportName);
      }
    }

    // 检查命名导出
    while ((match = namedExportRegex.exec(content)) !== null) {
      const exportsString = match[1];
      const namedExports = exportsString.split(',').map(e => e.trim().split(' as ')[0]);

      for (const exportName of namedExports) {
        if (exports.has(exportName)) {
          duplicates.push({
            name: exportName,
            type: 'named',
            line: lines.findIndex(line => line.includes(match[0])) + 1
          });
        } else {
          exports.add(exportName);
        }
      }
    }

    return duplicates;
  } catch (error) {
    console.error(`检查文件 ${filePath} 时出错:`, error.message);
    return [];
  }
}

/**
 * 检查文件大小
 */
function checkFileSize(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const sizeInLines = fs.readFileSync(filePath, 'utf-8').split('\n').length;

    return {
      sizeInBytes: stat.size,
      sizeInLines,
      isTooLarge: sizeInLines > 500
    };
  } catch (error) {
    console.error(`检查文件大小 ${filePath} 时出错:`, error.message);
    return null;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查代码质量...\n');

  const allFiles = getAllFiles(SRC_DIR);
  let totalDuplicates = 0;
  let totalLargeFiles = 0;
  const problematicFiles = [];

  console.log(`📁 找到 ${allFiles.length} 个文件需要检查\n`);

  for (const filePath of allFiles) {
    const relativePath = path.relative(PROJECT_ROOT, filePath);

    // 检查重复导出
    const duplicates = checkFileDuplicates(filePath);
    if (duplicates.length > 0) {
      totalDuplicates += duplicates.length;
      problematicFiles.push({
        file: relativePath,
        type: 'duplicate_exports',
        issues: duplicates
      });
    }

    // 检查文件大小
    const sizeInfo = checkFileSize(filePath);
    if (sizeInfo && sizeInfo.isTooLarge) {
      totalLargeFiles++;
      problematicFiles.push({
        file: relativePath,
        type: 'large_file',
        issues: [{
          line: 0,
          name: 'FILE_SIZE',
          type: 'size',
          details: `文件过大: ${sizeInfo.sizeInLines} 行 (建议: < 500 行)`
        }]
      });
    }
  }

  // 输出结果
  if (problematicFiles.length === 0) {
    console.log('✅ 所有文件检查通过！没有发现重复导出或超大文件。');
    process.exit(0);
  }

  console.log(`❌ 发现 ${problematicFiles.length} 个文件存在问题:\n`);

  for (const file of problematicFiles) {
    console.log(`📄 ${file.file}`);

    if (file.type === 'duplicate_exports') {
      console.log('   ⚠️  重复导出:');
      for (const issue of file.issues) {
        console.log(`      - 第 ${issue.line} 行: ${issue.name} (${issue.type})`);
      }
    } else if (file.type === 'large_file') {
      console.log('   📏 文件过大:');
      for (const issue of file.issues) {
        console.log(`      - ${issue.details}`);
      }
    }
    console.log('');
  }

  console.log(`📊 汇总:`);
  console.log(`   - 重复导出: ${totalDuplicates} 个`);
  console.log(`   - 超大文件: ${totalLargeFiles} 个`);
  console.log(`   - 问题文件: ${problematicFiles.length} 个`);

  console.log('\n💡 建议:');
  console.log('   1. 删除重复的导出声明');
  console.log('   2. 将超大文件拆分为多个小文件');
  console.log('   3. 使用 index.ts 统一管理模块导出');

  process.exit(1);
}

// 运行检查
if (require.main === module) {
  main();
}

module.exports = { checkFileDuplicates, checkFileSize };