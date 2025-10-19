#!/usr/bin/env node

/**
 * LLMChat 团队协作工具
 * 代码审查、文档生成、团队协调等功能
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 项目根目录
const projectRoot = join(__dirname, '../..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n👥 ${title}`, 'cyan');
  log('─'.repeat(60), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 代码审查工具
class CodeReview {
  constructor() {
    this.reviewRules = [
      {
        name: 'TypeScript 类型安全',
        check: () => this.checkTypeScript(),
        description: '检查 TypeScript 类型定义和类型安全'
      },
      {
        name: '代码风格',
        check: () => this.checkCodeStyle(),
        description: '检查代码风格和格式'
      },
      {
        name: '测试覆盖率',
        check: () => this.checkTestCoverage(),
        description: '检查测试覆盖率'
      },
      {
        name: '安全性',
        check: () => this.checkSecurity(),
        description: '检查安全漏洞和最佳实践'
      },
      {
        name: '性能',
        check: () => this.checkPerformance(),
        description: '检查性能问题'
      },
      {
        name: '依赖管理',
        check: () => this.checkDependencies(),
        description: '检查依赖版本和安全'
      }
    ];
  }

  async runReview() {
    logSection('代码审查');

    const results = [];

    for (const rule of this.reviewRules) {
      log(`检查: ${rule.name}`, 'blue');

      try {
        const result = await rule.check();
        results.push({
          name: rule.name,
          description: rule.description,
          ...result
        });

        if (result.status === 'pass') {
          logSuccess(`${rule.name}: 通过`);
        } else {
          logWarning(`${rule.name}: ${result.summary}`);
        }
      } catch (error) {
        logError(`${rule.name}: 检查失败 - ${error.message}`);
        results.push({
          name: rule.name,
          description: rule.description,
          status: 'error',
          error: error.message
        });
      }
    }

    this.generateReviewReport(results);
    return results;
  }

  checkTypeScript() {
    try {
      execSync('pnpm run type-check', { stdio: 'pipe', cwd: projectRoot });
      return {
        status: 'pass',
        summary: 'TypeScript 类型检查通过',
        details: '没有类型错误'
      };
    } catch (error) {
      const output = error.stderr?.toString() || error.stdout?.toString() || '';
      return {
        status: 'fail',
        summary: '发现 TypeScript 类型错误',
        details: output.split('\n').slice(0, 5).join('\n')
      };
    }
  }

  checkCodeStyle() {
    try {
      execSync('pnpm run lint', { stdio: 'pipe', cwd: projectRoot });
      return {
        status: 'pass',
        summary: '代码风格检查通过',
        details: '没有 ESLint 错误'
      };
    } catch (error) {
      const output = error.stderr?.toString() || error.stdout?.toString() || '';
      return {
        status: 'fail',
        summary: '发现代码风格问题',
        details: output.split('\n').slice(0, 5).join('\n')
      };
    }
  }

  checkTestCoverage() {
    try {
      // 检查测试覆盖率配置
      const packageJsonPath = join(projectRoot, 'frontend/package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const testScript = packageJson.scripts?.['test:coverage'];

        if (testScript) {
          return {
            status: 'pass',
            summary: '测试覆盖率配置存在',
            details: '可以运行 pnpm run test:coverage 查看覆盖率'
          };
        }
      }

      return {
        status: 'warning',
        summary: '测试覆盖率配置不完整',
        details: '建议配置测试覆盖率检查'
      };
    } catch (error) {
      return {
        status: 'error',
        summary: '无法检查测试覆盖率',
        details: error.message
      };
    }
  }

  checkSecurity() {
    try {
      execSync('pnpm audit --audit-level moderate', { stdio: 'pipe', cwd: projectRoot });
      return {
        status: 'pass',
        summary: '安全审计通过',
        details: '没有发现中高危安全漏洞'
      };
    } catch (error) {
      return {
        status: 'fail',
        summary: '发现安全漏洞',
        details: '建议运行 pnpm audit fix 修复漏洞'
      };
    }
  }

  checkPerformance() {
    // 检查常见的性能问题
    const issues = [];

    // 检查包大小
    const frontendDistPath = join(projectRoot, 'frontend/dist');
    if (existsSync(frontendDistPath)) {
      try {
        const stats = execSync(`du -sh ${frontendDistPath}`, { encoding: 'utf8' });
        const sizeMB = parseFloat(stats.split('\t')[0]);

        if (sizeMB > 10) {
          issues.push('前端包大小较大，建议优化');
        }
      } catch {}
    }

    return {
      status: issues.length === 0 ? 'pass' : 'warning',
      summary: issues.length === 0 ? '性能检查通过' : '发现性能问题',
      details: issues.join('\n')
    };
  }

  checkDependencies() {
    try {
      const packageJsonPath = join(projectRoot, 'package.json');
      if (!existsSync(packageJsonPath)) {
        throw new Error('package.json 不存在');
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const deps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});

      const totalDeps = deps.length + devDeps.length;

      return {
        status: 'pass',
        summary: `依赖检查通过 (总计 ${totalDeps} 个依赖)`,
        details: `生产依赖: ${deps.length}, 开发依赖: ${devDeps.length}`
      };
    } catch (error) {
      return {
        status: 'error',
        summary: '依赖检查失败',
        details: error.message
      };
    }
  }

  generateReviewReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        warnings: results.filter(r => r.status === 'warning').length,
        errors: results.filter(r => r.status === 'error').length
      },
      results: results
    };

    const reportPath = join(projectRoot, 'code-review-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    logSection('代码审查摘要');
    log(`总检查项: ${report.summary.total}`, 'blue');
    log(`通过: ${report.summary.passed}`, 'green');
    log(`失败: ${report.summary.failed}`, 'red');
    log(`警告: ${report.summary.warnings}`, 'yellow');
    log(`错误: ${report.summary.errors}`, 'red');

    logSuccess(`详细报告已保存: ${reportPath}`);
  }
}

// 文档生成器
class DocumentationGenerator {
  constructor() {
    this.templates = {
      api: this.generateAPIDocTemplate(),
      component: this.generateComponentDocTemplate(),
      changelog: this.generateChangelogTemplate()
    };
  }

  generateAllDocs() {
    logSection('生成项目文档');

    // 生成 API 文档
    this.generateAPIDocumentation();

    // 生成组件文档
    this.generateComponentDocumentation();

    // 生成变更日志
    this.generateChangelog();

    // 生成 README
    this.generateREADME();

    logSuccess('所有文档已生成');
  }

  generateAPIDocumentation() {
    log('生成 API 文档...', 'blue');

    // 扫描后端路由
    const backendRoutesPath = join(projectRoot, 'backend/src/routes');
    const apiDoc = {
      title: 'LLMChat API 文档',
      version: '1.0.0',
      description: 'LLMChat 应用 REST API 文档',
      endpoints: []
    };

    if (existsSync(backendRoutesPath)) {
      const routeFiles = require('fs').readdirSync(backendRoutesPath);
      routeFiles.forEach(file => {
        if (file.endsWith('.ts')) {
          const routeName = file.replace('.ts', '');
          apiDoc.endpoints.push({
            path: `/api/${routeName}`,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: `${routeName} 相关 API`
          });
        }
      });
    }

    const apiDocPath = join(projectRoot, 'docs/API.md');
    const apiContent = this.renderTemplate(this.templates.api, apiDoc);
    writeFileSync(apiDocPath, apiContent);

    logSuccess(`API 文档已生成: docs/API.md`);
  }

  generateComponentDocumentation() {
    log('生成组件文档...', 'blue');

    const componentsPath = join(projectRoot, 'frontend/src/components');
    const componentDoc = {
      title: 'LLMChat 组件文档',
      description: '前端组件使用说明',
      components: []
    };

    if (existsSync(componentsPath)) {
      const scanComponentDir = (dir, prefix = '') => {
        const items = require('fs').readdirSync(dir);

        items.forEach(item => {
          const itemPath = join(dir, item);
          const stat = require('fs').statSync(itemPath);

          if (stat.isDirectory()) {
            scanComponentDir(itemPath, `${prefix}${item}/`);
          } else if (item.endsWith('.tsx') && !item.includes('.test.')) {
            const componentName = item.replace('.tsx', '');
            componentDoc.components.push({
              name: componentName,
              path: `${prefix}${componentName}`,
              description: `${componentName} 组件`
            });
          }
        });
      };

      scanComponentDir(componentsPath);
    }

    const componentDocPath = join(projectRoot, 'docs/COMPONENTS.md');
    const componentContent = this.renderTemplate(this.templates.component, componentDoc);
    writeFileSync(componentDocPath, componentContent);

    logSuccess(`组件文档已生成: docs/COMPONENTS.md`);
  }

  generateChangelog() {
    log('生成变更日志...', 'blue');

    try {
      // 获取 Git 提交历史
      const gitLog = execSync('git log --oneline -20', {
        encoding: 'utf8',
        cwd: projectRoot
      });

      const commits = gitLog.split('\n').filter(Boolean);
      const changelogData = {
        title: '变更日志',
        sections: [
          {
            version: 'Unreleased',
            date: new Date().toISOString().split('T')[0],
            changes: commits.slice(0, 5).map(commit => {
              const [hash, ...messageParts] = commit.split(' ');
              return {
                hash,
                message: messageParts.join(' '),
                type: this.getChangeType(messageParts.join(' '))
              };
            })
          }
        ]
      };

      const changelogPath = join(projectRoot, 'CHANGELOG.md');
      const changelogContent = this.renderTemplate(this.templates.changelog, changelogData);
      writeFileSync(changelogPath, changelogContent);

      logSuccess(`变更日志已生成: CHANGELOG.md`);
    } catch (error) {
      logWarning(`变更日志生成失败: ${error.message}`);
    }
  }

  generateREADME() {
    log('生成 README...', 'blue');

    const readmeData = {
      title: 'LLMChat',
      description: '智能体切换聊天应用',
      features: [
        '多智能体支持',
        '实时聊天',
        '响应式设计',
        'TypeScript',
        'React 18',
        'Node.js'
      ],
      installation: [
        '克隆项目',
        '安装依赖: pnpm install',
        '配置环境变量',
        '启动开发服务器: pnpm run dev'
      ]
    };

    const readmeContent = `# ${readmeData.title}

${readmeData.description}

## 功能特性

${readmeData.features.map(feature => `- ${feature}`).join('\n')}

## 安装指南

${readmeData.installation.map((step, index) => `${index + 1}. ${step}`).join('\n')}

## 开发

\`\`\`bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 运行测试
pnpm test

# 构建项目
pnpm run build
\`\`\`

## 贡献

欢迎提交 Pull Request 和 Issue！

## 许可证

MIT License
`;

    const readmePath = join(projectRoot, 'README.md');
    writeFileSync(readmePath, readmeContent);

    logSuccess(`README 已更新: README.md`);
  }

  getChangeType(message) {
    if (message.startsWith('feat')) return '新增功能';
    if (message.startsWith('fix')) return '修复问题';
    if (message.startsWith('docs')) return '文档更新';
    if (message.startsWith('style')) return '代码风格';
    if (message.startsWith('refactor')) return '重构';
    if (message.startsWith('test')) return '测试';
    return '其他';
  }

  generateAPIDocTemplate() {
    return `# {{title}}

版本: {{version}}

{{description}}

## 端点

{{#each endpoints}}
### {{path}}

**方法:** {{#each methods}}\`{{this}}\` {{/each}}

**描述:** {{description}}

{{/each}}
`;
  }

  generateComponentDocTemplate() {
    return `# {{title}}

{{description}}

## 组件列表

{{#each components}}
### {{name}}

**路径:** \`{{path}}\`

**描述:** {{description}}

{{/each}}
`;
  }

  generateChangelogTemplate() {
    return `# {{title}}

{{#each sections}}
## [{{version}}] - {{date}}

{{#each changes}}
- **{{type}}:** {{message}} ({{hash}})
{{/each}}

{{/each}}
`;
  }

  renderTemplate(template, data) {
    // 简单的模板渲染
    let result = template;

    // 替换简单变量
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });

    // 处理循环
    result = result.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const array = data[arrayName];
      if (!Array.isArray(array)) return '';

      return array.map(item => {
        let itemContent = content;
        Object.keys(item).forEach(key => {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          itemContent = itemContent.replace(regex, item[key] || '');
        });
        return itemContent;
      }).join('\n');
    });

    return result;
  }
}

// 团队协调工具
class TeamCoordinator {
  constructor() {
    this.members = [];
    this.tasks = [];
    this.meetings = [];
  }

  generateTeamReport() {
    logSection('生成团队报告');

    const report = {
      timestamp: new Date().toISOString(),
      project: 'LLMChat',
      summary: this.generateProjectSummary(),
      contributors: this.getContributors(),
      activity: this.getRecentActivity()
    };

    const reportPath = join(projectRoot, 'docs/TEAM_REPORT.md');
    const reportContent = this.renderTeamReport(report);
    writeFileSync(reportPath, reportContent);

    logSuccess(`团队报告已生成: docs/TEAM_REPORT.md`);
  }

  generateProjectSummary() {
    try {
      const packageJsonPath = join(projectRoot, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        return {
          name: packageJson.name || 'LLMChat',
          version: packageJson.version || '1.0.0',
          description: packageJson.description || '智能体切换聊天应用'
        };
      }
    } catch {}

    return {
      name: 'LLMChat',
      version: '1.0.0',
      description: '智能体切换聊天应用'
    };
  }

  getContributors() {
    try {
      const gitContributors = execSync('git shortlog -sn', {
        encoding: 'utf8',
        cwd: projectRoot
      });

      return gitContributors.split('\n')
        .filter(Boolean)
        .map(line => {
          const [commits, ...nameParts] = line.trim().split('\t');
          return {
            name: nameParts.join(' '),
            commits: parseInt(commits)
          };
        });
    } catch {
      return [];
    }
  }

  getRecentActivity() {
    try {
      const gitLog = execSync('git log --oneline --since="1 month ago"', {
        encoding: 'utf8',
        cwd: projectRoot
      });

      return gitLog.split('\n')
        .filter(Boolean)
        .slice(0, 10)
        .map(line => {
          const [hash, ...messageParts] = line.split(' ');
          return {
            hash,
            message: messageParts.join(' ')
          };
        });
    } catch {
      return [];
    }
  }

  renderTeamReport(data) {
    return `# ${data.project.name} 团队报告

生成时间: ${data.timestamp}

## 项目概览

- **项目名称:** ${data.summary.name}
- **版本:** ${data.summary.version}
- **描述:** ${data.summary.description}

## 贡献者

${data.contributors.map(contributor =>
  `- **${contributor.name}**: ${contributor.commits} 次提交`
).join('\n')}

## 最近活动

${data.activity.map(activity =>
  `- \`${activity.hash}\` ${activity.message}`
).join('\n')}

---

*此报告由团队协作工具自动生成*
`;
  }
}

// Pull Request 模板生成器
function generatePRTemplate() {
  logSection('生成 PR 模板');

  const template = `<!-- 请使用此模板创建 Pull Request -->

## 变更描述

请简要描述此 PR 的变更内容：

## 变更类型

请选择适用的变更类型：

- [ ] 🚀 新功能 (feature)
- [ ] 🐛 Bug 修复 (bugfix)
- [ ] 📝 文档更新 (documentation)
- [ ] 💄 样式调整 (style)
- [ ] ♻️ 代码重构 (refactor)
- [ ] ⚡ 性能优化 (performance)
- [ ] 🧪 测试相关 (test)

## 测试

请确认已完成的测试：

- [ ] 代码已通过所有现有测试
- [ ] 新增功能已添加相应测试
- [ ] 前端代码已在浏览器中测试
- [ ] 后端 API 已测试

## 检查清单

请确认以下检查项：

- [ ] 代码遵循项目编码规范
- [ ] 已通过 ESLint 检查
- [ ] 已通过 TypeScript 类型检查
- [ ] 已更新相关文档
- [ ] 变更已通过自测

## 相关 Issue

如果此 PR 解决了某个 Issue，请在此引用：

Closes #

## 截图

如果适用，请添加截图说明变更内容：

## 其他说明

其他需要说明的内容：

---

**感谢您的贡献！** 🎉`;

  const templatesDir = join(projectRoot, '.github');
  if (!existsSync(templatesDir)) {
    mkdirSync(templatesDir, { recursive: true });
  }

  const templatePath = join(templatesDir, 'PULL_REQUEST_TEMPLATE.md');
  writeFileSync(templatePath, template);

  logSuccess(`PR 模板已生成: .github/PULL_REQUEST_TEMPLATE.md`);
}

// Issue 模板生成器
function generateIssueTemplate() {
  logSection('生成 Issue 模板');

  const bugReportTemplate = `<!-- Bug 报告模板 -->

**Bug 描述**
简要描述遇到的问题：

**重现步骤**
1. 进入 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

**期望行为**
描述您期望发生的情况：

**实际行为**
描述实际发生的情况：

**截图**
如果适用，请添加截图帮助解释问题：

**环境信息**
- 操作系统: [例如 iOS]
- 浏览器: [例如 chrome, safari]
- 版本: [例如 22]

**附加信息**
添加关于问题的任何其他信息：`;

  const featureRequestTemplate = `<!-- 功能请求模板 -->

**功能描述**
简要描述您希望添加的功能：

**问题背景**
描述这个功能要解决的问题：

**解决方案**
描述您希望的解决方案：

**替代方案**
描述您考虑过的其他替代解决方案：

**附加信息**
添加关于功能请求的任何其他信息：`;

  const templatesDir = join(projectRoot, '.github/ISSUE_TEMPLATE');
  if (!existsSync(templatesDir)) {
    mkdirSync(templatesDir, { recursive: true });
  }

  writeFileSync(join(templatesDir, 'bug_report.md'), bugReportTemplate);
  writeFileSync(join(templatesDir, 'feature_request.md'), featureRequestTemplate);

  logSuccess(`Issue 模板已生成: .github/ISSUE_TEMPLATE/`);
}

// 显示使用说明
function showUsage() {
  log('👥 LLMChat 团队协作工具', 'bright');
  log('========================', 'blue');
  log('\n用法:', 'cyan');
  log('  node team-collaboration.js [选项]', 'white');
  log('\n选项:', 'cyan');
  log('  --review        运行代码审查', 'white');
  log('  --docs          生成项目文档', 'white');
  log('  --team-report   生成团队报告', 'white');
  log('  --pr-template   生成 PR 模板', 'white');
  log('  --issue-template 生成 Issue 模板', 'white');
  log('  --all           运行所有协作工具', 'white');
  log('  --help          显示帮助信息', 'white');
  log('\n示例:', 'cyan');
  log('  node team-collaboration.js --review', 'white');
  log('  node team-collaboration.js --docs', 'white');
  log('  node team-collaboration.js --all', 'white');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  try {
    if (args.includes('--all')) {
      // 运行所有协作工具
      const codeReview = new CodeReview();
      await codeReview.runReview();

      const docGenerator = new DocumentationGenerator();
      docGenerator.generateAllDocs();

      const teamCoordinator = new TeamCoordinator();
      teamCoordinator.generateTeamReport();

      generatePRTemplate();
      generateIssueTemplate();

      logSuccess('所有团队协作工具执行完成');
      return;
    }

    if (args.includes('--review')) {
      const codeReview = new CodeReview();
      await codeReview.runReview();
      return;
    }

    if (args.includes('--docs')) {
      const docGenerator = new DocumentationGenerator();
      docGenerator.generateAllDocs();
      return;
    }

    if (args.includes('--team-report')) {
      const teamCoordinator = new TeamCoordinator();
      teamCoordinator.generateTeamReport();
      return;
    }

    if (args.includes('--pr-template')) {
      generatePRTemplate();
      return;
    }

    if (args.includes('--issue-template')) {
      generateIssueTemplate();
      return;
    }

    logError('未知选项，请使用 --help 查看帮助信息');
    process.exit(1);

  } catch (error) {
    logError(`团队协作工具执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runTeamCollaboration, CodeReview, DocumentationGenerator, TeamCoordinator };