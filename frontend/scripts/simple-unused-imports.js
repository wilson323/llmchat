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

function findSimpleUnusedImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const unusedImports = [];

    // 查找简单的未使用导入：只导入类型但文件中不使用该类型名
    const typeImportRegex = /import\s*{\s*type\s+([^}]+)\s*}\s*from\s+['"]([^'"]+)['"];?/gm;
    let match;

    while ((match = typeImportRegex.exec(content)) !== null) {
      const fullImport = match[0];
      const types = match[1].split(',').map(t => t.trim());
      const source = match[2];

      for (const type of types) {
        const typeName = type.split(' as ')[0] || type;

        // 检查在文件其余部分是否被使用
        const importIndex = content.indexOf(typeName);
        const remainingContent = content.substring(importIndex + fullImport.length);

        // 简单检查：类型名是否出现在后面的代码中
        if (typeName && !remainingContent.includes(typeName)) {
          unusedImports.push({
            name: `type ${typeName}`,
            source,
            statement: fullImport.trim()
          });
        }
      }
    }

    return unusedImports;
  } catch (error) {
    return [];
  }
}

function main() {
  console.log('🔍 扫描简单的未使用类型导入...\n');

  const files = findFiles(SRC_DIR);
  console.log(`📁 扫描 ${files.length} 个文件\n`);

  let totalFilesWithIssues = 0;
  let totalUnusedImports = 0;

  for (const file of files) {
    const unusedImports = findSimpleUnusedImports(file);

    if (unusedImports.length > 0) {
      totalFilesWithIssues++;
      totalUnusedImports += unusedImports.length;

      console.log(`📄 ${path.relative(process.cwd(), file)}:`);
      for (const unused of unusedImports) {
        console.log(`  ❌ 未使用: ${unused.name} from '${unused.source}'`);
      }
      console.log('');
    }
  }

  console.log(`✅ 扫描完成!`);
  console.log(`📊 统计:`);
  console.log(`   - 有问题的文件: ${totalFilesWithIssues}`);
  console.log(`   - 未使用的类型导入: ${totalUnusedImports}`);

  if (totalUnusedImports > 0) {
    console.log(`\n💡 这些是明显未使用的类型导入，可以安全移除。`);
  } else {
    console.log(`\n🎉 没有发现明显的未使用类型导入！`);
  }
}

main();