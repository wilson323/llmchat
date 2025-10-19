/**
 * SpecKit文档一致性验证工具
 * 检查跨文档的一致性、重复内容、术语使用
 */

const fs = require('fs');
const path = require('path');

const SPEC_DIR = '.claude/specs/llmchat-platform';
const TERM_FILE = path.join(SPEC_DIR, 'terminology.md');

// 加载术语表
function loadTerminology() {
  if (!fs.existsSync(TERM_FILE)) return [];
  const content = fs.readFileSync(TERM_FILE, 'utf8');
  const terms = [];
  const regex = /\|\s*(\w+)\s*\|\s*([^\|]+)\s*\|/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    terms.push({ en: match[1].trim(), zh: match[2].trim() });
  }
  return terms;
}

// 检查术语使用一致性
function checkTermConsistency(file, content, terms) {
  const issues = [];
  terms.forEach(({ en, zh }) => {
    const enRegex = new RegExp(en, 'gi');
    const zhRegex = new RegExp(zh, 'g');
    const enMatches = (content.match(enRegex) || []).length;
    const zhMatches = (content.match(zhRegex) || []).length;
    
    // 中文文档中不应该用英文术语（代码示例除外）
    if (file.endsWith('.md') && enMatches > 5) {
      issues.push({
        file, type: 'terminology', severity: 'medium',
        message: `文档中使用了${enMatches}次英文术语"${en}"，建议使用中文"${zh}"`
      });
    }
  });
  return issues;
}

// 检测重复内容
function detectDuplicates(files) {
  const issues = [];
  const contentMap = new Map();
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    
    lines.forEach((line, idx) => {
      const normalized = line.trim();
      if (!contentMap.has(normalized)) {
        contentMap.set(normalized, []);
      }
      contentMap.set(normalized, [...contentMap.get(normalized), { file, line: idx + 1 }]);
    });
  });
  
  contentMap.forEach((locations, content) => {
    if (locations.length > 1) {
      issues.push({
        type: 'duplicate', severity: 'high',
        message: `重复内容："${content.substring(0, 50)}..."`,
        locations
      });
    }
  });
  
  return issues;
}

// 主函数
function main() {
  console.log(' 开始文档一致性验证...\n');
  
  const files = ['requirements.md', 'design.md', 'tasks.md']
    .map(f => path.join(SPEC_DIR, f))
    .filter(f => fs.existsSync(f));
  
  if (files.length === 0) {
    console.error(' 未找到SpecKit核心文档');
    process.exit(1);
  }
  
  const terms = loadTerminology();
  let allIssues = [];
  
  // 检查每个文档
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const issues = checkTermConsistency(file, content, terms);
    allIssues = allIssues.concat(issues);
  });
  
  // 检测重复
  const duplicates = detectDuplicates(files);
  allIssues = allIssues.concat(duplicates);
  
  // 输出报告
  if (allIssues.length === 0) {
    console.log(' 所有检查通过，无一致性问题\n');
    process.exit(0);
  }
  
  console.log(`  发现 ${allIssues.length} 个问题:\n`);
  allIssues.forEach((issue, idx) => {
    console.log(`${idx + 1}. [${issue.severity}] ${issue.message}`);
    if (issue.file) console.log(`   文件: ${issue.file}`);
    if (issue.locations) {
      issue.locations.forEach(loc => {
        console.log(`   - ${loc.file}:${loc.line}`);
      });
    }
    console.log('');
  });
  
  process.exit(allIssues.filter(i => i.severity === 'high').length > 0 ? 1 : 0);
}

main();
