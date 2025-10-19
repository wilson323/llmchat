#!/usr/bin/env node

/**
 * 文件大小限制检查工具
 * 检查代码文件是否超过合理的行数限制
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// 文件大小限制
const LIMITS = {
  components: 300,    // React 组件
  utils: 500,        // 工具函数
  services: 400,     // API 服务
  stores: 300,       // 状态管理
  types: 200,        // 类型定义
  hooks: 200,        // 自定义 Hooks
  default: 400       // 默认限制
};

// 需要检查的文件类型
const CHECK_EXTENSIONS = ['.ts', '.tsx'];

// 忽略的目录
const IGNORE_DIRS = ['node_modules', 'dist', '.git', '__tests__', 'test', 'generated'];

/**
 * 获取文件类型
 */
function getFileType(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath);
  const segments = relativePath.split(path.sep);

  if (segments.includes('components')) return 'components';
  if (segments.includes('utils')) return 'utils';
  if (segments.includes('services')) return 'services';
  if (segments.includes('store') || segments.includes('stores')) return 'stores';
  if (segments.includes('types')) return 'types';
  if (segments.includes('hooks')) return 'hooks';

  return 'default';
}

/**
 * 获取文件大小信息
 */
function getFileSizeInfo(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const sizeInBytes = fs.statSync(filePath).size;

    return {
      sizeInBytes,
      sizeInLines: lines.length,
      emptyLines: lines.filter(line => line.trim() === '').length,
      commentLines: lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('*')).length,
      effectiveLines: lines.filter(line => line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('*')).length
    };
  } catch (error) {
    console.error(`读取文件 ${filePath} 失败:`, error.message);
    return null;
  }
}

/**
 * 递归获取所有需要检查的文件
 */
function getAllFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    try {
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
    } catch (error) {
      console.warn(`无法读取目录 ${currentDir}:`, error.message);
    }
  }

  traverse(dir);
  return files;
}

/**
 * 生成文件拆分建议
 */
function generateSplitSuggestions(filePath, sizeInfo, fileType) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const dirPath = path.dirname(relativePath);
  const fileName = path.basename(relativePath, path.extname(relativePath));

  const suggestions = [];

  // 根据文件类型生成不同的拆分建议
  if (fileType === 'components') {
    suggestions.push(`${dirPath}/${fileName}Provider.tsx - 状态管理`);
    suggestions.push(`${dirPath}/${fileName}Component.tsx - UI 组件`);
    suggestions.push(`${dirPath}/${fileName}Types.ts - 类型定义`);
    suggestions.push(`${dirPath}/${fileName}Utils.ts - 工具函数`);
    suggestions.push(`${dirPath}/index.ts - 统一导出`);
  } else if (fileType === 'utils') {
    suggestions.push(`${dirPath}/${fileName}Types.ts - 类型定义`);
    suggestions.push(`${dirPath}/${fileName}Helpers.ts - 辅助函数`);
    suggestions.push(`${dirPath}/${fileName}Validators.ts - 验证函数`);
    suggestions.push(`${dirPath}/${fileName}Constants.ts - 常量定义`);
  } else if (fileType === 'services') {
    suggestions.push(`${dirPath}/${fileName}Client.ts - API 客户端`);
    suggestions.push(`${dirPath}/${fileName}Types.ts - 类型定义`);
    suggestions.push(`${dirPath}/${fileName}Utils.ts - 工具函数`);
  }

  return suggestions;
}

/**
 * 主函数
 */
function main() {
  console.log('📏 开始检查文件大小...\n');

  const allFiles = getAllFiles(SRC_DIR);
  let oversizedFiles = [];
  let totalSize = 0;
  let totalLines = 0;

  console.log(`📁 扫描 ${allFiles.length} 个文件\n`);

  for (const filePath of allFiles) {
    const sizeInfo = getFileSizeInfo(filePath);
    if (!sizeInfo) continue;

    const fileType = getFileType(filePath);
    const limit = LIMITS[fileType] || LIMITS.default;
    const relativePath = path.relative(PROJECT_ROOT, filePath);

    totalSize += sizeInfo.sizeInBytes;
    totalLines += sizeInfo.sizeInLines;

    if (sizeInfo.sizeInLines > limit) {
      oversizedFiles.push({
        path: relativePath,
        fileType,
        sizeInfo,
        limit,
        excess: sizeInfo.sizeInLines - limit
      });
    }
  }

  // 输出结果
  if (oversizedFiles.length === 0) {
    console.log('✅ 所有文件大小都在合理范围内！');
    console.log(`📊 项目统计: ${totalLines} 行代码, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    process.exit(0);
  }

  // 按文件大小排序
  oversizedFiles.sort((a, b) => b.sizeInfo.sizeInLines - a.sizeInfo.sizeInLines);

  console.log(`❌ 发现 ${oversizedFiles.length} 个文件超过大小限制:\n`);

  for (const file of oversizedFiles) {
    const { path, fileType, sizeInfo, limit, excess } = file;

    console.log(`📄 ${path}`);
    console.log(`   📏 大小: ${sizeInfo.sizeInLines} 行 (${fileType}, 限制: ${limit} 行)`);
    console.log(`   📊 超出: ${excess} 行 (${((excess / limit) * 100).toFixed(1)}%)`);
    console.log(`   📈 有效代码: ${sizeInfo.effectiveLines} 行 (${((sizeInfo.effectiveLines / sizeInfo.sizeInLines) * 100).toFixed(1)}%)`);

    if (excess > 100) {
      console.log(`   💡 拆分建议:`);
      const suggestions = generateSplitSuggestions(path, sizeInfo, fileType);
      suggestions.forEach(suggestion => console.log(`      - ${suggestion}`));
    }
    console.log('');
  }

  console.log(`📊 汇总统计:`);
  console.log(`   - 超大文件: ${oversizedFiles.length} 个`);
  console.log(`   - 总代码行数: ${totalLines} 行`);
  console.log(`   - 总文件大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - 超大文件占比: ${((oversizedFiles.length / allFiles.length) * 100).toFixed(1)}%`);

  console.log('\n💡 改进建议:');
  console.log('   1. 将大文件拆分为多个小文件，每个文件专注于单一职责');
  console.log('   2. 使用 index.ts 统一管理模块导出');
  console.log('   3. 保持文件在建议的行数限制内');
  console.log('   4. 定期重构，避免文件继续增长');

  process.exit(1);
}

// 运行检查
if (require.main === module) {
  main();
}

module.exports = { getFileSizeInfo, getFileType };