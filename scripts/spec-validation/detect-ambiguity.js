/**
 * SpecKit模糊术语检测工具
 * 检测文档中的模糊表述，要求量化
 */

const fs = require('fs');
const path = require('path');

const SPEC_DIR = '.claude/specs/llmchat-platform';

// 模糊词汇列表
const AMBIGUOUS_WORDS = [
  '快速', '慢', '大量', '少量', '频繁', '偶尔',
  '主流', '流行', '常用', '典型', '通常',
  '详细', '简洁', '完整', '部分',
  '<Xms>', '<X秒>', '>X%', 'X小时',
  '有经验的', '熟练的', '初级', '高级',
  '很多', '一些', '几个', '若干'
];

// 检测模糊术语
function detectAmbiguity(file, content) {
  const issues = [];
  const lines = content.split('\n');
  
  AMBIGUOUS_WORDS.forEach(word => {
    lines.forEach((line, idx) => {
      // 跳过代码块
      if (line.trim().startsWith('```') || line.trim().startsWith('|')) return;
      
      if (line.includes(word)) {
        issues.push({
          file,
          line: idx + 1,
          word,
          context: line.trim(),
          severity: 'medium',
          suggestion: '建议替换为具体的量化指标'
        });
      }
    });
  });
  
  return issues;
}

// 主函数
function main() {
  console.log(' 开始模糊术语检测...\n');
  
  const files = ['requirements.md', 'design.md', 'tasks.md']
    .map(f => path.join(SPEC_DIR, f))
    .filter(f => fs.existsSync(f));
  
  if (files.length === 0) {
    console.error(' 未找到SpecKit文档');
    process.exit(1);
  }
  
  let allIssues = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const issues = detectAmbiguity(file, content);
    allIssues = allIssues.concat(issues);
  });
  
  if (allIssues.length === 0) {
    console.log(' 未检测到模糊术语\n');
    process.exit(0);
  }
  
  console.log(`  发现 ${allIssues.length} 个模糊术语:\n`);
  
  // 按文件分组
  const byFile = {};
  allIssues.forEach(issue => {
    const fileName = path.basename(issue.file);
    if (!byFile[fileName]) byFile[fileName] = [];
    byFile[fileName].push(issue);
  });
  
  Object.entries(byFile).forEach(([fileName, issues]) => {
    console.log(` ${fileName} (${issues.length}个问题):`);
    issues.slice(0, 5).forEach(issue => {
      console.log(`    第${issue.line}行: "${issue.word}"`);
      console.log(`     上下文: ${issue.context.substring(0, 60)}...`);
      console.log(`     建议: ${issue.suggestion}\n`);
    });
    if (issues.length > 5) {
      console.log(`  ... 还有 ${issues.length - 5} 个问题\n`);
    }
  });
  
  process.exit(allIssues.length > 10 ? 1 : 0);
}

main();
