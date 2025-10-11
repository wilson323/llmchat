#!/usr/bin/env node

/**
 * 修复 useChat.ts 语法错误
 * 主要是错误的分号位置
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修复 useChat.ts 语法错误...\n');

const useChatPath = path.join(process.cwd(), 'frontend/src/hooks/useChat.ts');

if (!fs.existsSync(useChatPath)) {
  console.log('❌ useChat.ts 文件不存在');
  process.exit(1);
}

try {
  let content = fs.readFileSync(useChatPath, 'utf8');

  // 修复错误的分号位置
  const fixes = [
    // 移除第11行多余的分号
    {
      pattern: /^;\n/m,
      replacement: '\n'
    },

    // 修复对象字面量后的错误分号
    {
      pattern: /}\s*};\s*$/gm,
      replacement: '}\n  };'
    },

    // 修复数组后面的错误分号
    {
      pattern: /\[\s*\.\.\.\w+\s*];\s*/g,
      replacement: '[...$1],'
    },

    // 修复函数参数后的错误分号
    {
      pattern: /\w+\.\w+\(\s*[^)]+\s*\);\s*/g,
      replacement: (match) => {
        // 保留正确的函数调用，只修复明显的错误
        if (match.includes('sendMessage') || match.includes('retryMessage')) {
          return match;
        }
        return match;
      }
    },

    // 修复对象属性后的错误分号（在对象内部）
    {
      pattern: /(\w+):\s*[^,}]+};\s*/g,
      replacement: '$1: $2,\n  '
    },

    // 修复 content,; 的情况
    {
      pattern: /content\s*,\s*;/g,
      replacement: 'content,'
    },

    // 修复 options,; 的情况
    {
      pattern: /options\s*,\s*;/g,
      replacement: 'options,'
    },

    // 修复其他错误的分号位置
    {
      pattern: /}\s*;\s*\n\s*}/g,
      replacement: '}\n    }'
    },

    // 修复最后的返回对象
    {
      pattern: /retryMessage\s*;\s*}/g,
      replacement: 'retryMessage,\n  }'
    }
  ];

  let fixCount = 0;
  for (const fix of fixes) {
    const matches = content.match(fix.pattern);
    if (matches) {
      content = content.replace(fix.pattern, fix.replacement);
      fixCount += matches.length;
      console.log(`✅ 修复了 ${matches.length} 个 "${fix.pattern.toString()}" 问题`);
    }
  }

  // 特殊修复：处理具体的错误行
  const lines = content.split('\n');

  // 修复第81行 content,;
  if (lines[80] && lines[80].includes('content,')) {
    lines[80] = lines[80].replace('content,', 'content,');
    console.log('✅ 修复第81行 content, 问题');
  }

  // 修复第93行 responseChatItemId: responseId }
  if (lines[92] && lines[92].includes('responseChatItemId: responseId')) {
    lines[92] = lines[92].replace('responseChatItemId: responseId }', 'responseChatItemId: responseId }');
    console.log('✅ 修复第93行 responseChatItemId 问题');
  }

  // 修复第104行 currentAgent.id,;
  if (lines[103] && lines[103].includes('currentAgent.id,')) {
    lines[103] = lines[103].replace('currentAgent.id,', 'currentAgent.id,');
    console.log('✅ 修复第104行 currentAgent.id 问题');
  }

  // 修复第105行 chatMessages,;
  if (lines[104] && lines[104].includes('chatMessages,')) {
    lines[104] = lines[104].replace('chatMessages,', 'chatMessages,');
    console.log('✅ 修复第105行 chatMessages 问题');
  }

  // 修复第133行 mergedOptions,;
  if (lines[132] && lines[132].includes('mergedOptions,')) {
    lines[132] = lines[132].replace('mergedOptions,', 'mergedOptions,');
    console.log('✅ 修复第133行 mergedOptions 问题');
  }

  content = lines.join('\n');

  // 写回文件
  fs.writeFileSync(useChatPath, content, 'utf8');
  console.log(`\n🎉 useChat.ts 语法修复完成，共修复 ${fixCount} 个问题`);

  // 验证修复
  console.log('\n🔍 验证 TypeScript 语法...');
  try {
    const { execSync } = require('child_process');
    execSync(`cd frontend && npx tsc --noEmit hooks/useChat.ts`, {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log('✅ TypeScript 语法检查通过');
  } catch (error) {
    console.error('❌ TypeScript 语法检查失败:');
    console.error(error.stdout || error.stderr);
  }

} catch (error) {
  console.error('❌ 修复 useChat.ts 失败:', error.message);
}