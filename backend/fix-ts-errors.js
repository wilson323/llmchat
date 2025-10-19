/**
 * 自动修复TypeScript编译错误
 * 1. 修复 || 和 ?? 混用的括号问题
 * 2. 修复数字默认值导致的 string | number 类型错误
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  'src/services/ChatProxyService.ts',
  'src/services/AgentConfigService.ts',
  'src/services/AuthServiceV2.ts',
  'src/services/FastGPTSessionService.ts',
  'src/middleware/jwtAuthOptimized.ts',
  'src/utils/envHelper.ts',
  'src/__tests__/integration/tokenRefresh.test.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // 1. 修复 || 和 ?? 混用问题 - 添加括号
  const mixedOperators = [
    // temperature: options?.temperature || config.temperature ?? 0.7
    {
      pattern: /(\w+):\s*(\w+\??\.?\w+)\s+\|\|\s+([^\s]+)\s+\?\?\s+([^,}\n]+)/g,
      replacement: '$1: ($2 || $3) ?? $4'
    },
    // id: cached.payload.sub || cached.payload.userId ?? 2641
    {
      pattern: /(\w+):\s*([^\s]+\.\w+)\s+\|\|\s+([^\s]+\.\w+)\s+\?\?\s+(\d+)/g,
      replacement: '$1: ($2 || $3) ?? \'$4\''
    },
  ];

  mixedOperators.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  // 2. 修复所有数字默认值 - 改为字符串
  const numberDefaults = [
    // ?? 6011 -> ?? ''
    {
      pattern: /\?\?\s+(\d+)(?=[,;\n\s})])/g,
      replacement: '?? \'\''
    },
  ];

  numberDefaults.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ 修复完成: ${filePath}`);
  } else {
    console.log(`ℹ️  无需修复: ${filePath}`);
  }
}

// 修复所有文件
console.log('🚀 开始自动修复TypeScript编译错误...\n');
filesToFix.forEach(fixFile);
console.log('\n✨ 修复完成！');

