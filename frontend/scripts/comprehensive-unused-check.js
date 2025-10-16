#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

function findFiles(dir, extensions = ['.ts', '.tsx']) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略无法读取的目录
    }
  }
  traverse(dir);
  return files;
}

function findUnusedImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const unusedImports = [];

    // 查找所有导入语句
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));

    for (const importLine of importLines) {
      // 查找类型导入
      const typeImportMatch = importLine.match(/import\s*{\s*type\s+([^}]+)\s*}\s*from\s+['"]([^'"]+)['"];?/);
      if (typeImportMatch) {
        const fullImport = typeImportMatch[0];
        const types = typeImportMatch[1].split(',').map(t => t.trim());
        const source = typeImportMatch[2];

        for (const type of types) {
          const typeName = type.split(' as ')[0] || type;

          // 检查在文件其余部分是否被使用
          const remainingContent = content.substring(content.indexOf(fullImport) + fullImport.length);

          if (typeName && !remainingContent.includes(typeName)) {
            unusedImports.push({
              name: `type ${typeName}`,
              source,
              statement: fullImport.trim(),
              line: content.split('\n').findIndex(line => line.includes(fullImport)) + 1
            });
          }
        }
      }

      // 查找普通导入
      const normalImportMatch = importLine.match(/import\s*{\s*([^}]+)\s*}\s*from\s+['"]([^'"]+)['"];?/);
      if (normalImportMatch && !normalImportMatch[0].includes('type ')) {
        const fullImport = normalImportMatch[0];
        const imports = normalImportMatch[1].split(',').map(imp => imp.trim());
        const source = normalImportMatch[2];

        for (const imp of imports) {
          const importName = imp.split(' as ')[0] || imp;

          // 特殊情况：React导入通常总是需要的
          if (importName === 'React' && source === 'react') {
            continue;
          }

          // 检查在文件其余部分是否被使用
          const remainingContent = content.substring(content.indexOf(fullImport) + fullImport.length);

          if (importName && !remainingContent.includes(importName)) {
            unusedImports.push({
              name: importName,
              source,
              statement: fullImport.trim(),
              line: content.split('\n').findIndex(line => line.includes(fullImport)) + 1
            });
          }
        }
      }
    }

    return unusedImports;
  } catch (error) {
    return [];
  }
}

function main() {
  console.log('🔍 全面扫描未使用的导入...\n');

  const files = findFiles(SRC_DIR);
  console.log(`📁 扫描 ${files.length} 个文件\n`);

  let totalFilesWithIssues = 0;
  let totalUnusedImports = 0;
  const allUnusedImports = [];

  for (const file of files) {
    const unusedImports = findUnusedImports(file);

    if (unusedImports.length > 0) {
      totalFilesWithIssues++;
      totalUnusedImports += unusedImports.length;
      allUnusedImports.push(...unusedImports.map(imp => ({ ...imp, file })));
    }
  }

  if (allUnusedImports.length > 0) {
    console.log('📄 发现的未使用导入:');

    // 按文件分组显示
    const importsByFile = {};
    for (const imp of allUnusedImports) {
      if (!importsByFile[imp.file]) {
        importsByFile[imp.file] = [];
      }
      importsByFile[imp.file].push(imp);
    }

    for (const [file, imports] of Object.entries(importsByFile)) {
      console.log(`\n${path.relative(process.cwd(), file)}:`);
      for (const imp of imports) {
        console.log(`  第${imp.line}行: ❌ ${imp.name} from '${imp.source}'`);
      }
    }

    console.log(`\n✅ 扫描完成!`);
    console.log(`📊 统计:`);
    console.log(`   - 有问题的文件: ${totalFilesWithIssues}`);
    console.log(`   - 未使用的导入: ${totalUnusedImports}`);

    console.log(`\n💡 可以安全移除这些未使用的导入来提高代码质量。`);
  } else {
    console.log(`🎉 没有发现未使用的导入！代码质量很好。`);
  }
}

main();