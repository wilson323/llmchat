#!/usr/bin/env node
/**
 * 修复TypeScript编译错误
 * 1. 混合使用 || 和 ?? 操作符
 * 2. string | number 类型问题
 */

const fs = require('fs');
const path = require('path');

console.log('=== 修复TypeScript编译错误 ===\n');

const fixes = [
  // RetryService.ts
  {
    file: 'backend/src/services/RetryService.ts',
    replacements: [
      {
        from: /request\.url \|\| request\.endpoint \?\? (\d+)/g,
        to: '(request.url || request.endpoint) ?? \'$1\''
      },
      {
        from: /request\.data \|\| request\.body \?\? \{\}/g,
        to: '(request.data || request.body) ?? {}'
      },
      {
        from: /request\.params \|\| request\.query \?\? \{\}/g,
        to: '(request.params || request.query) ?? {}'
      }
    ]
  },
  // RateLimitService.ts
  {
    file: 'backend/src/services/RateLimitService.ts',
    replacements: [
      {
        from: /\(now - \(metrics\.windowRecords\[0\]\?\.timestamp \|\| now\)\) \/ 1000 \?\? 1/g,
        to: '((now - (metrics.windowRecords[0]?.timestamp || now)) / 1000) ?? 1'
      }
    ]
  },
  // QueueManager.ts
  {
    file: 'backend/src/services/QueueManager.ts',
    replacements: [
      {
        from: /deadLetterQueue: options\.deadLetterQueue \|\| queue\.deadLetterQueue \?\? (\d+)/g,
        to: 'deadLetterQueue: (options.deadLetterQueue || queue.deadLetterQueue) ?? \'$1\''
      }
    ]
  },
  // FastGPTSessionService.ts
  {
    file: 'backend/src/services/FastGPTSessionService.ts',
    replacements: [
      {
        from: /const chatId = data\?\.chatId \|\| data\?\.id \|\| data\?\._id \|\| data\?\.historyId \|\| data\?\.history_id \?\? (\d+);/g,
        to: 'const chatId = (data?.chatId || data?.id || data?._id || data?.historyId || data?.history_id) ?? \'$1\';'
      },
      {
        from: /messageCount: Number\(data\?\.messageCount \|\| data\?\.msgCount \|\| data\?\.totalMessages \|\| data\?\.total \?\? 0\)/g,
        to: 'messageCount: Number((data?.messageCount || data?.msgCount || data?.totalMessages || data?.total) ?? 0)'
      },
      {
        from: /const list = data\?\.list \|\| data\?\.messages \|\| data\?\.history \|\| data\?\.chatHistoryList \|\| data\?\.detail \?\? \[\];/g,
        to: 'const list = (data?.list || data?.messages || data?.history || data?.chatHistoryList || data?.detail) ?? [];'
      },
      {
        from: /`list:\$\{params\.page \?\? 1\}:\$\{params\.pageSize \|\| 'default'\}`/g,
        to: '`list:${params.page ?? 1}:${(params.pageSize) ?? \'default\'}`'
      },
      {
        from: /const rawList = payload\?\.data\?\.list \|\| payload\?\.data \|\| payload\?\.historyList \|\| payload\?\.list \?\? \[\];/g,
        to: 'const rawList = (payload?.data?.list || payload?.data || payload?.historyList || payload?.list) ?? [];'
      },
      {
        from: /totalPages: Math\.ceil\(\(rawData\?\.total \|\| sessions\.length\) \/ \(params\?\.pageSize \?\? 20\)\)/g,
        to: 'totalPages: Math.ceil(((rawData?.total || sessions.length)) / (params?.pageSize ?? 20))'
      },
      {
        from: /hasNext: \(params\?\.page \?\? 1\) \* \(params\?\.pageSize \?\? 20\) < \(rawData\?\.total \|\| sessions\.length\)/g,
        to: 'hasNext: (params?.page ?? 1) * (params?.pageSize ?? 20) < ((rawData?.total || sessions.length))'
      }
    ]
  },
  // ChatProxyService.ts
  {
    file: 'backend/src/services/ChatProxyService.ts',
    replacements: [
      {
        from: /temperature: options\?\.temperature \|\| config\.temperature \?\? 0\.7/g,
        to: 'temperature: (options?.temperature || config.temperature) ?? 0.7'
      },
      {
        from: /max_tokens: options\?\.maxTokens \|\| config\.maxTokens \?\? (\d+)/g,
        to: 'max_tokens: (options?.maxTokens || config.maxTokens) ?? $1'
      }
    ]
  }
];

let totalFixed = 0;

fixes.forEach(({ file: filePath, replacements }) => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let fileFixed = 0;
  
  replacements.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      fileFixed += matches.length;
    }
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    totalFixed += fileFixed;
    console.log(`✓ ${path.basename(filePath)}: 修复 ${fileFixed} 处`);
  }
});

console.log(`\n=== 修复完成 ===`);
console.log(`总修复数: ${totalFixed}`);
console.log('\n运行 "cd backend && npx tsc --noEmit" 验证修复');

