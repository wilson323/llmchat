/**
 * SpecKit需求-任务覆盖率检查工具
 * 分析每个需求是否有对应任务覆盖
 */

const fs = require('fs');
const path = require('path');

const SPEC_DIR = '.claude/specs/llmchat-platform';
const REQ_FILE = path.join(SPEC_DIR, 'requirements.md');
const TASK_FILE = path.join(SPEC_DIR, 'tasks.md');

// 提取需求ID
function extractRequirements(content) {
  const reqs = [];
  const regex = /(\*\*FR-\d+\*\*|\*\*NFR-\d+\*\*|\*\*US-\d+\*\*):([^\n]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    reqs.push({
      id: match[1].replace(/\*\*/g, ''),
      desc: match[2].trim()
    });
  }
  return reqs;
}

// 提取任务及其引用的需求
function extractTasks(content) {
  const tasks = [];
  const regex = /-\s*\[\s*\]\s*\*\*T\d+.*?\*\*:([^\n]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const taskDesc = match[1].trim();
    const refMatch = taskDesc.match(/\[Ref:\s*([\w-,\s]+)\]/);
    tasks.push({
      desc: taskDesc,
      refs: refMatch ? refMatch[1].split(',').map(r => r.trim()) : []
    });
  }
  return tasks;
}

// 主函数
function main() {
  console.log(' 开始需求覆盖率分析...\n');
  
  if (!fs.existsSync(REQ_FILE) || !fs.existsSync(TASK_FILE)) {
    console.error(' 未找到需求或任务文档');
    process.exit(1);
  }
  
  const reqContent = fs.readFileSync(REQ_FILE, 'utf8');
  const taskContent = fs.readFileSync(TASK_FILE, 'utf8');
  
  const requirements = extractRequirements(reqContent);
  const tasks = extractTasks(taskContent);
  
  console.log(` 总需求数: ${requirements.length}`);
  console.log(` 总任务数: ${tasks.length}\n`);
  
  // 分析覆盖率
  const coverage = new Map();
  requirements.forEach(req => coverage.set(req.id, []));
  
  tasks.forEach(task => {
    task.refs.forEach(ref => {
      if (coverage.has(ref)) {
        coverage.get(ref).push(task.desc);
      }
    });
  });
  
  // 统计
  const covered = Array.from(coverage.entries()).filter(([_, tasks]) => tasks.length > 0);
  const uncovered = Array.from(coverage.entries()).filter(([_, tasks]) => tasks.length === 0);
  
  const coverageRate = (covered.length / requirements.length * 100).toFixed(1);
  
  console.log(` 覆盖率: ${coverageRate}% (${covered.length}/${requirements.length})\n`);
  
  if (uncovered.length > 0) {
    console.log('  未覆盖的需求:\n');
    uncovered.forEach(([reqId]) => {
      const req = requirements.find(r => r.id === reqId);
      console.log(`   ${reqId}: ${req ? req.desc : '未知需求'}`);
    });
    console.log('');
  }
  
  // 输出覆盖矩阵
  console.log(' 详细覆盖矩阵:\n');
  covered.slice(0, 10).forEach(([reqId, taskList]) => {
    console.log(` ${reqId}: ${taskList.length}个任务`);
  });
  
  process.exit(uncovered.length > 0 ? 1 : 0);
}

main();
