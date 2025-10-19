/**
 * SpecKit引用完整性验证工具
 * 检查Markdown链接的有效性
 */

const fs = require('fs');
const path = require('path');

const SPEC_DIR = '.claude/specs/llmchat-platform';
const ROOT_DIR = process.cwd();

// 提取Markdown链接
function extractLinks(content) {
  const links = [];
  const regex = /\[([^\]]+)\]\(([^\)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({
      text: match[1],
      href: match[2],
      raw: match[0]
    });
  }
  return links;
}

// 验证链接
function verifyLink(baseFile, link) {
  const { href } = link;
  
  // 跳过外部链接
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { valid: true };
  }
  
  // 处理相对路径
  let targetPath = href.split('#')[0]; // 移除锚点
  if (!targetPath) return { valid: true }; // 仅锚点，跳过
  
  const baseDir = path.dirname(baseFile);
  const fullPath = path.resolve(baseDir, targetPath);
  
  if (fs.existsSync(fullPath)) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: `文件不存在: ${targetPath}`
  };
}

// 主函数
function main() {
  console.log(' 开始引用完整性验证...\n');
  
  const files = ['requirements.md', 'design.md', 'tasks.md', 
                'technical-details.md', 'terminology.md', 
                'api-error-codes.md', 'document-governance.md',
                'DOCUMENT_INDEX.md']
    .map(f => path.join(SPEC_DIR, f))
    .filter(f => fs.existsSync(f));
  
  files.push(path.join(ROOT_DIR, '.specify/memory/constitution.md'));
  
  let allIssues = [];
  
  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    
    const content = fs.readFileSync(file, 'utf8');
    const links = extractLinks(content);
    
    links.forEach(link => {
      const result = verifyLink(file, link);
      if (!result.valid) {
        allIssues.push({
          file: path.relative(ROOT_DIR, file),
          link: link.href,
          text: link.text,
          error: result.error
        });
      }
    });
  });
  
  if (allIssues.length === 0) {
    console.log(' 所有引用链接有效\n');
    process.exit(0);
  }
  
  console.log(` 发现 ${allIssues.length} 个无效引用:\n`);
  allIssues.forEach((issue, idx) => {
    console.log(`${idx + 1}. ${issue.file}`);
    console.log(`   链接文本: "${issue.text}"`);
    console.log(`   链接地址: ${issue.link}`);
    console.log(`   错误: ${issue.error}\n`);
  });
  
  process.exit(1);
}

main();
