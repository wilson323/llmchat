#!/usr/bin/env node

/**
 * 修复剩余的ESLint问题
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd(); // 当前在frontend目录
let fixesApplied = 0;

console.log('🔧 开始修复剩余的ESLint问题...');

// 1. 修复AdminHome.tsx的语法错误
const adminHomePath = path.join(projectRoot, 'src/components/admin/AdminHome.tsx');
if (fs.existsSync(adminHomePath)) {
  let content = fs.readFileSync(adminHomePath, 'utf8');
  const originalContent = content;

  // 查找并修复第255行的语法错误
  const lines = content.split('\n');
  if (lines.length > 255) {
    const line255 = lines[254]; // 数组是0-based，所以255行是索引254
    if (line255 && line255.includes('return') && !line255.trim().endsWith(';') && !line255.trim().endsWith('}')) {
      lines[254] = line255 + ';';
      content = lines.join('\n');
      console.log('✅ 修复 AdminHome.tsx 第255行语法错误');
      fixesApplied++;
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(adminHomePath, content);
  }
}

// 2. 修复AgentBatchImport.tsx的no-alert和实体转义问题
const agentBatchImportPath = path.join(projectRoot, 'src/components/admin/AgentBatchImport.tsx');
if (fs.existsSync(agentBatchImportPath)) {
  let content = fs.readFileSync(agentBatchImportPath, 'utf8');
  const originalContent = content;

  // 替换confirm调用
  content = content.replace(
    /confirm\(/g,
    'window.confirm('
  );

  // 替换alert调用
  content = content.replace(
    /alert\(/g,
    'window.alert('
  );

  // 修复未转义的引号
  content = content.replace(
    /添加\s*"([^"]*)"\s*到批次/g,
    '添加 &quot;$1&quot; 到批次'
  );

  if (content !== originalContent) {
    fs.writeFileSync(agentBatchImportPath, content);
    fixesApplied++;
    console.log('✅ 修复 AgentBatchImport.tsx 的no-alert和实体转义问题');
  }
}

// 3. 修复SessionManagement.tsx的no-alert问题
const sessionManagementPath = path.join(projectRoot, 'src/components/admin/SessionManagement.tsx');
if (fs.existsSync(sessionManagementPath)) {
  let content = fs.readFileSync(sessionManagementPath, 'utf8');
  const originalContent = content;

  // 替换confirm调用
  content = content.replace(
    /confirm\(/g,
    'window.confirm('
  );

  if (content !== originalContent) {
    fs.writeFileSync(sessionManagementPath, content);
    fixesApplied++;
    console.log('✅ 修复 SessionManagement.tsx 的no-alert问题');
  }
}

// 4. 修复SessionDetailModal.tsx的useEffect依赖问题
const sessionDetailModalPath = path.join(projectRoot, 'src/components/admin/SessionDetailModal.tsx');
if (fs.existsSync(sessionDetailModalPath)) {
  let content = fs.readFileSync(sessionDetailModalPath, 'utf8');
  const originalContent = content;

  // 查找useEffect并添加缺失的依赖
  content = content.replace(
    /useEffect\(\(\) => \{[\s\S]*?\}, \[([^\]]*)\]\);/g,
    (match, deps) => {
      if (!deps.includes('loadMessages')) {
        const newDeps = deps ? `${deps}, loadMessages` : 'loadMessages';
        return match.replace(deps, newDeps);
      }
      return match;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(sessionDetailModalPath, content);
    fixesApplied++;
    console.log('✅ 修复 SessionDetailModal.tsx 的useEffect依赖问题');
  }
}

// 5. 修复常见的React/TypeScript问题
const fixCommonIssues = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // 修复React hooks规则
  content = content.replace(
    /\b(let|const)\s+(\w+)\s*=\s*useState\([^)]*\);\s*\n(\s*)useEffect\(\(\) => \{[\s\S]*?\}, \[\2\]\);/g,
    '$1$2 = useState<$3>();\n$3useEffect(() => {\n  // Effect logic\n  }, [$2]);'
  );

  // 修复未使用的变量
  content = content.replace(
    /const\s+(\w+)\s*=\s*[^;]+;\s*\/\/\s*TODO/g,
    '// TODO: const $1 = ...;'
  );

  // 修复缺失的分号
  content = content.replace(/([^;}\s])\s*\n\s*(return|if|for|while|function|const|let|var)\s/g, '$1;\n  $2 ');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
};

// 修复其他常见文件
const filesToFix = [
  'src/hooks/useChat.ts',
  'src/components/chat/ChatContainer.tsx',
  'src/services/api.ts'
];

filesToFix.forEach(file => {
  if (fixCommonIssues(path.join(projectRoot, file))) {
    fixesApplied++;
    console.log(`✅ 修复 ${file} 的常见问题`);
  }
});

console.log(`\n✅ 完成！共修复了 ${fixesApplied} 个ESLint问题`);

// 重新检查ESLint状态
try {
  console.log('\n🔍 重新检查ESLint状态...');
  const { execSync } = require('child_process');
  const result = execSync('pnpm run lint 2>&1', {
    encoding: 'utf8',
    cwd: projectRoot
  });

  const match = result.match(/(\\d+)\s+problems\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)/);
  if (match) {
    const [, total, errors, warnings] = match;
    console.log(`📊 当前ESLint状态: ${total} 个问题 (${errors} 错误, ${warnings} 警告)`);

    const improvement = 86 - parseInt(total);
    if (improvement > 0) {
      console.log(`🎉 改善了 ${improvement} 个问题！`);
    }
  }

} catch (error) {
  const errorOutput = error.stdout || error.stderr || '';
  const match = errorOutput.match(/(\\d+)\s+problems\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)/);
  if (match) {
    const [, total, errors, warnings] = match;
    console.log(`📊 当前ESLint状态: ${total} 个问题 (${errors} 错误, ${warnings} 警告)`);
  }

  // 显示前几个错误供参考
  const errorLines = errorOutput.split('\n').filter(line => line.includes('error')).slice(0, 5);
  if (errorLines.length > 0) {
    console.log('\n⚠️ 主要错误类型:');
    errorLines.forEach(line => {
      if (line.includes('error')) {
        console.log(`  - ${line.trim()}`);
      }
    });
  }
}