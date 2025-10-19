#!/usr/bin/env node

/**
 * LLMChat 开发工具生态系统 - 统一命令行入口
 */

import { program } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { runDevSetup } from './dev-setup.js';
import { runHealthCheck } from './health-check.js';
import { runDebugHelper } from './debug-helper.js';
import { runPerformanceProfiler } from './performance-profiler.js';
import { generateCode } from './code-generator.js';
import { createScaffold } from './scaffold.js';
import { runTaskAutomation } from './task-automation.js';
import { runCIPipeline } from './ci-pipeline.js';
import { runTeamCollaboration } from './team-collaboration.js';
import { runCommunicationCenter } from './communication-center.js';

// 显示欢迎信息
function showWelcome() {
  const welcome = `
${chalk.blue.bold('🚀 LLMChat 开发工具生态系统')}
${chalk.gray('企业级前端开发工具集 - 为 LLMChat 项目打造')}

${chalk.yellow('快速开始:')}
  ${chalk.cyan('llmchat-dev setup')}     - 设置开发环境
  ${chalk.cyan('llmchat-dev check')}      - 检查项目健康
  ${chalk.cyan('llmchat-dev generate')}   - 生成代码模板
  ${chalk.cyan('llmchat-dev debug')}      - 运行调试诊断
  ${chalk.cyan('llmchat-dev profile')}    - 性能分析
  ${chalk.cyan('llmchat-dev build')}      - 构建项目
  ${chalk.cyan('llmchat-dev test')}       - 运行测试
  ${chalk.cyan('llmchat-dev review')}     - 代码审查
  ${chalk.cyan('llmchat-dev docs')}       - 生成文档

${chalk.yellow('获取帮助:')}
  ${chalk.cyan('llmchat-dev --help')}    - 显示详细帮助
  ${chalk.cyan('llmchat-dev <command> --help')} - 查看命令帮助
`;

  console.log(boxen(welcome, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));
}

// 配置 CLI 程序
program
  .name('llmchat-dev')
  .description('LLMChat 开发工具生态系统')
  .version('1.0.0')
  .option('-v, --verbose', '详细输出模式')
  .option('--no-color', '禁用彩色输出')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.name() !== 'help' && !process.argv.includes('--help')) {
      console.log();
      console.log(chalk.blue.bold(`🔧 ${thisCommand.name()}`));
      console.log(chalk.gray('─'.repeat(50)));
    }
  });

// setup 命令
program
  .command('setup')
  .description('设置开发环境')
  .option('--quick', '快速设置模式')
  .action(async (options) => {
    try {
      await runDevSetup();
    } catch (error) {
      console.error(chalk.red('❌ 设置失败:'), error.message);
      process.exit(1);
    }
  });

// check 命令
program
  .command('check')
  .description('检查项目健康状态')
  .option('--fix', '自动修复可修复的问题')
  .action(async (options) => {
    try {
      await runHealthCheck();
    } catch (error) {
      console.error(chalk.red('❌ 检查失败:'), error.message);
      process.exit(1);
    }
  });

// generate 命令
program
  .command('generate')
  .alias('gen')
  .description('生成代码模板')
  .argument('<type>', '模板类型 (component|page|hook|service|utility)')
  .argument('[name]', '名称')
  .option('--interactive', '交互模式')
  .option('--with-props', '包含 Props 接口')
  .option('--with-styles', '包含样式文件')
  .option('--with-test', '包含测试文件')
  .option('--with-types', '包含类型定义')
  .action(async (type, name, options) => {
    try {
      if (options.interactive) {
        process.argv.push('--interactive');
      }
      await generateCode();
    } catch (error) {
      console.error(chalk.red('❌ 生成失败:'), error.message);
      process.exit(1);
    }
  });

// scaffold 命令
program
  .command('scaffold')
  .description('创建功能模块脚手架')
  .argument('<type>', '模块类型 (feature)')
  .argument('[name]', '模块名称')
  .option('--no-auto-update', '不自动更新路由和导航')
  .action(async (type, name, options) => {
    try {
      await createScaffold();
    } catch (error) {
      console.error(chalk.red('❌ 脚手架创建失败:'), error.message);
      process.exit(1);
    }
  });

// debug 命令
program
  .command('debug')
  .description('运行调试诊断')
  .argument('[command]', '调试命令 (full|system|ports|deps|ts|tests)')
  .option('--monitor', '启动实时监控')
  .action(async (command, options) => {
    try {
      if (options.monitor) {
        process.argv.push('monitor');
      }
      await runDebugHelper();
    } catch (error) {
      console.error(chalk.red('❌ 调试失败:'), error.message);
      process.exit(1);
    }
  });

// profile 命令
program
  .command('profile')
  .description('运行性能分析')
  .argument('[option]', '分析选项 (full|system|typescript|bundle|runtime|memory|deps)')
  .option('--report', '仅生成报告')
  .action(async (option, options) => {
    try {
      await runPerformanceProfiler();
    } catch (error) {
      console.error(chalk.red('❌ 性能分析失败:'), error.message);
      process.exit(1);
    }
  });

// build 命令
program
  .command('build')
  .description('构建项目')
  .action(async () => {
    try {
      await runTaskAutomation();
      process.argv.push('build');
    } catch (error) {
      console.error(chalk.red('❌ 构建失败:'), error.message);
      process.exit(1);
    }
  });

// test 命令
program
  .command('test')
  .description('运行测试')
  .action(async () => {
    try {
      await runTaskAutomation();
      process.argv.push('test');
    } catch (error) {
      console.error(chalk.red('❌ 测试失败:'), error.message);
      process.exit(1);
    }
  });

// quality 命令
program
  .command('quality')
  .description('运行代码质量检查')
  .action(async () => {
    try {
      await runTaskAutomation();
      process.argv.push('quality');
    } catch (error) {
      console.error(chalk.red('❌ 质量检查失败:'), error.message);
      process.exit(1);
    }
  });

// review 命令
program
  .command('review')
  .description('运行代码审查')
  .action(async () => {
    try {
      await runTeamCollaboration();
      process.argv.push('--review');
    } catch (error) {
      console.error(chalk.red('❌ 代码审查失败:'), error.message);
      process.exit(1);
    }
  });

// docs 命令
program
  .command('docs')
  .description('生成项目文档')
  .action(async () => {
    try {
      await runTeamCollaboration();
      process.argv.push('--docs');
    } catch (error) {
      console.error(chalk.red('❌ 文档生成失败:'), error.message);
      process.exit(1);
    }
  });

// notify 命令
program
  .command('notify')
  .description('发送团队通知')
  .argument('<type>', '通知类型')
  .argument('<title>', '通知标题')
  .argument('<message>', '通知消息')
  .option('--channel <channel>', '通知渠道 (all|email|slack|discord|teams)')
  .option('--priority <priority>', '优先级 (low|normal|high|urgent)')
  .action(async (type, title, message, options) => {
    try {
      await runCommunicationCenter();
      process.argv.splice(2, 0, '--notify', type, title, message);
      if (options.channel) process.argv.push('--channel', options.channel);
      if (options.priority) process.argv.push('--priority', options.priority);
    } catch (error) {
      console.error(chalk.red('❌ 通知发送失败:'), error.message);
      process.exit(1);
    }
  });

// kb 命令
program
  .command('kb')
  .description('知识库操作')
  .argument('<action>', '操作 (add|search)')
  .argument('[args...]', '操作参数')
  .action(async (action, args) => {
    try {
      await runCommunicationCenter();
      process.argv.splice(2, 0, `--kb-${action}`, ...args);
    } catch (error) {
      console.error(chalk.red('❌ 知识库操作失败:'), error.message);
      process.exit(1);
    }
  });

// ci 命令
program
  .command('ci')
  .description('运行 CI/CD 流水线')
  .option('--env <environment>', '环境 (development|staging|production)')
  .option('--github-actions', '生成 GitHub Actions')
  .option('--docker', '生成 Docker 配置')
  .action(async (options) => {
    try {
      await runCIPipeline();
      if (options.env) process.argv.push('--env', options.env);
      if (options.githubActions) process.argv.push('--github-actions');
      if (options.docker) process.argv.push('--docker');
      if (!options.env && !options.githubActions && !options.docker) {
        process.argv.push('--run');
      }
    } catch (error) {
      console.error(chalk.red('❌ CI/CD 流水线失败:'), error.message);
      process.exit(1);
    }
  });

// 全局选项
program
  .option('--version', '显示版本信息')
  .option('--help', '显示帮助信息');

// 解析命令行参数
program.parse(process.argv);

// 如果没有提供命令，显示欢迎信息
if (!process.argv.slice(2).length) {
  showWelcome();
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ 未捕获的异常:'));
  console.error(error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n❌ 未处理的 Promise 拒绝:'));
  console.error(reason);
  process.exit(1);
});