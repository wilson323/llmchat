#!/usr/bin/env node

/**
 * 自动化代码格式化工具
 * 统一代码格式，提升代码质量
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CodeFormatter {
  constructor(options = {}) {
    this.options = {
      srcDir: 'src',
      testDir: 'test',
      backupDir: '.format-backups',
      enableBackup: true,
      dryRun: true,
      // 格式化规则
      formatRules: {
        // 基础格式化
        indentation: {
          type: 'spaces',
          size: 2
        },
        quotes: {
          type: 'single',
          avoidEscape: true
        },
        semicolons: {
          insert: true
        },
        trailingCommas: {
          style: 'es5' // none|es5|all
        },
        // 行长度
        maxLineLength: 100,
        // 空行规则
        blankLines: {
          max: 2,
          maxEOF: 1,
          maxBOF: 0
        },
        // 括号空格
        spaceBeforeFunctionParen: false,
        spaceInParens: false,
        // 其他规则
        jsxQuotes: 'double',
        jsxBracketSameLine: false,
        arrowParens: 'avoid',
        endOfLine: 'lf'
      },
      // 文件类型特定规则
      fileSpecificRules: {
        '.ts': {
          trailingCommas: 'es5'
        },
        '.tsx': {
          trailingCommas: 'es5',
          jsxQuotes: 'double'
        },
        '.js': {
          trailingCommas: 'none'
        },
        '.jsx': {
          trailingCommas: 'es5'
        }
      },
      ...options
    };

    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      formattedFiles: 0,
      changes: {
        indentation: 0,
        quotes: 0,
        semicolons: 0,
        trailingCommas: 0,
        lineLength: 0,
        blankLines: 0,
        spacing: 0,
        other: 0
      },
      errors: 0
    };
  }

  /**
   * 运行格式化
   */
  async run() {
    console.log('🎨 代码格式化工具启动...');

    if (this.options.enableBackup) {
      await this.ensureDirectory(this.options.backupDir);
    }

    const files = await this.getFiles();
    this.stats.totalFiles = files.length;

    console.log(`📁 发现 ${files.length} 个文件`);

    // 预处理：检查是否安装了格式化工具
    const hasPrettier = this.checkTool('prettier');
    const hasEslint = this.checkTool('eslint');

    if (hasPrettier || hasEslint) {
      console.log('🔧 使用现有格式化工具');
      await this.formatWithExistingTools(files, hasPrettier, hasEslint);
    } else {
      console.log('🔧 使用内置格式化工具');
      await this.formatWithBuiltInTools(files);
    }

    await this.generateReport();
  }

  /**
   * 检查工具是否可用
   */
  checkTool(tool) {
    try {
      execSync(`${tool} --version`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 使用现有工具格式化
   */
  async formatWithExistingTools(files, hasPrettier, hasEslint) {
    const formatCommands = [];

    if (hasPrettier) {
      formatCommands.push({
        name: 'Prettier',
        command: 'npx prettier --write',
        files: files.filter(f => ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.less', '.html', '.md'].some(ext => f.endsWith(ext)))
      });
    }

    if (hasEslint) {
      formatCommands.push({
        name: 'ESLint',
        command: 'npx eslint --fix',
        files: files.filter(f => ['.ts', '.tsx', '.js', '.jsx'].some(ext => f.endsWith(ext)))
      });
    }

    for (const formatter of formatCommands) {
      console.log(`🔨 使用 ${formatter.name} 格式化...`);

      if (this.options.dryRun) {
        await this.previewFormatWithTool(formatter);
      } else {
        await this.formatWithTool(formatter);
      }
    }
  }

  /**
   * 预览工具格式化
   */
  async previewFormatWithTool(formatter) {
    const sampleFiles = formatter.files.slice(0, 3);

    for (const filePath of sampleFiles) {
      try {
        const originalContent = fs.readFileSync(filePath, 'utf8');

        // 使用--check模式检查格式
        const result = execSync(
          `${formatter.command.replace('--write', '--check')} "${filePath}"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );

        if (result.includes('formatted')) {
          console.log(`  📝 ${path.relative(process.cwd(), filePath)} 需要格式化`);
        }
      } catch (error) {
        if (error.status === 1) {
          console.log(`  📝 ${path.relative(process.cwd(), filePath)} 需要格式化`);
        }
      }
    }

    if (formatter.files.length > 3) {
      console.log(`  ... 还有 ${formatter.files.length - 3} 个文件待格式化`);
    }
  }

  /**
   * 使用工具格式化
   */
  async formatWithTool(formatter) {
    try {
      const fileList = formatter.files.map(f => `"${f}"`).join(' ');
      const command = `${formatter.command} ${fileList}`;

      execSync(command, { stdio: 'inherit' });
      this.stats.formattedFiles += formatter.files.length;

      console.log(`✅ ${formatter.name} 格式化完成: ${formatter.files.length} 个文件`);
    } catch (error) {
      console.error(`❌ ${formatter.name} 格式化失败:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * 使用内置工具格式化
   */
  async formatWithBuiltInTools(files) {
    console.log('🔨 使用内置格式化规则...');

    for (const filePath of files) {
      try {
        await this.formatFile(filePath);
        this.stats.processedFiles++;
      } catch (error) {
        console.error(`❌ 格式化文件失败 ${filePath}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  /**
   * 格式化单个文件
   */
  async formatFile(filePath) {
    const ext = path.extname(filePath);
    const rules = { ...this.options.formatRules, ...this.options.fileSpecificRules[ext] };

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // 应用格式化规则
    content = this.applyFormattingRules(content, rules, filePath);

    // 如果内容有变化，写入文件
    if (content !== originalContent) {
      if (this.options.enableBackup && !this.options.dryRun) {
        await this.createBackup(filePath);
      }

      if (!this.options.dryRun) {
        fs.writeFileSync(filePath, content, 'utf8');
        this.stats.formattedFiles++;
        console.log(`✅ 已格式化: ${path.relative(process.cwd(), filePath)}`);
      } else {
        console.log(`📝 需要格式化: ${path.relative(process.cwd(), filePath)}`);
      }
    }
  }

  /**
   * 应用格式化规则
   */
  applyFormattingRules(content, rules, filePath) {
    let formattedContent = content;

    // 1. 处理行结束符
    if (rules.endOfLine === 'lf') {
      formattedContent = formattedContent.replace(/\r\n/g, '\n');
      formattedContent = formattedContent.replace(/\r/g, '\n');
    }

    // 2. 处理缩进
    formattedContent = this.applyIndentation(formattedContent, rules);

    // 3. 处理引号
    formattedContent = this.applyQuotes(formattedContent, rules, filePath);

    // 4. 处理分号
    formattedContent = this.applySemicolons(formattedContent, rules);

    // 5. 处理尾随逗号
    formattedContent = this.applyTrailingCommas(formattedContent, rules, filePath);

    // 6. 处理行长度
    formattedContent = this.applyLineLength(formattedContent, rules);

    // 7. 处理空行
    formattedContent = this.applyBlankLines(formattedContent, rules);

    // 8. 处理空格
    formattedContent = this.applySpacing(formattedContent, rules);

    return formattedContent;
  }

  /**
   * 应用缩进规则
   */
  applyIndentation(content, rules) {
    if (rules.indentation.type === 'spaces') {
      // 将制表符替换为空格
      return content.replace(/\t/g, ' '.repeat(rules.indentation.size));
    } else {
      // 将空格替换为制表符
      return content.replace(/ {2}/g, '\t');
    }
  }

  /**
   * 应用引号规则
   */
  applyQuotes(content, rules, filePath) {
    const isJsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
    const quoteType = isJsx ? rules.jsxQuotes : rules.quotes.type;

    const lines = content.split('\n');
    const formattedLines = [];

    for (const line of lines) {
      let formattedLine = line;

      // 跳过注释和字符串
      if (this.isInCommentOrString(line)) {
        formattedLines.push(formattedLine);
        continue;
      }

      // 替换引号
      const targetQuote = quoteType === 'single' ? "'" : '"';
      const oppositeQuote = quoteType === 'single' ? '"' : "'";

      // 简单的引号替换（避免字符串内引号）
      if (!formattedLine.includes(oppositeQuote) || rules.quotes.avoidEscape) {
        const pattern = new RegExp(`(?<!\\)${oppositeQuote}([^${oppositeQuote}]*)${oppositeQuote}`, 'g');
        formattedLine = formattedLine.replace(pattern, `${targetQuote}$1${targetQuote}`);
      }

      formattedLines.push(formattedLine);
    }

    return formattedLines.join('\n');
  }

  /**
   * 应用分号规则
   */
  applySemicolons(content, rules) {
    const lines = content.split('\n');
    const formattedLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // 跳过空行、注释、特定语句
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') ||
          trimmed.startsWith('*') || trimmed.includes('import ') ||
          trimmed.includes('export ') || trimmed.includes('break') ||
          trimmed.includes('continue') || trimmed.includes('return') ||
          trimmed.includes('throw')) {
        formattedLines.push(line);
        continue;
      }

      let formattedLine = line;

      if (rules.semicolons.insert) {
        // 添加分号
        if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
          formattedLine = line + ';';
        }
      } else {
        // 移除分号
        if (trimmed.endsWith(';')) {
          formattedLine = line.slice(0, -1);
        }
      }

      formattedLines.push(formattedLine);
    }

    return formattedLines.join('\n');
  }

  /**
   * 应用尾随逗号规则
   */
  applyTrailingCommas(content, rules, filePath) {
    if (rules.trailingCommas === 'none') {
      return content;
    }

    const lines = content.split('\n');
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 查找对象或数组的结束
      if (trimmed === '}' || trimmed === ']') {
        const prevLine = i > 0 ? lines[i - 1].trim() : '';

        if (prevLine && !prevLine.endsWith(',') &&
            (prevLine.includes(':') || prevLine.match(/[a-zA-Z_$]\w*\s*$/))) {
          // 添加尾随逗号
          const indent = line.match(/^(\s*)/)[1];
          formattedLines.push(lines[i - 1] + ',');
          formattedLines.push(line);
          continue;
        }
      }

      formattedLines.push(line);
    }

    return formattedLines.join('\n');
  }

  /**
   * 应用行长度规则
   */
  applyLineLength(content, rules) {
    if (!rules.maxLineLength) {
      return content;
    }

    const lines = content.split('\n');
    const formattedLines = [];

    for (const line of lines) {
      if (line.length <= rules.maxLineLength) {
        formattedLines.push(line);
        continue;
      }

      // 尝试分割长行
      const splitLines = this.splitLongLine(line, rules.maxLineLength);
      formattedLines.push(...splitLines);
    }

    return formattedLines.join('\n');
  }

  /**
   * 分割长行
   */
  splitLongLine(line, maxLength) {
    // 简单的行分割逻辑
    const splitPoints = [
      ' && ',
      ' || ',
      ' + ',
      ' - ',
      ' = ',
      ' , ',
      '; ',
      ' ? ',
      ' : '
    ];

    for (const splitPoint of splitPoints) {
      const index = line.lastIndexOf(splitPoint, maxLength);
      if (index > 0) {
        const indent = line.match(/^(\s*)/)[1];
        return [
          line.substring(0, index + splitPoint.length),
          indent + line.substring(index + splitPoint.length).trim()
        ];
      }
    }

    // 如果没有合适的分割点，强制分割
    const indent = line.match(/^(\s*)/)[1];
    return [
      line.substring(0, maxLength),
      indent + line.substring(maxLength).trim()
    ];
  }

  /**
   * 应用空行规则
   */
  applyBlankLines(content, rules) {
    const lines = content.split('\n');
    const formattedLines = [];

    // 移除文件开头的空行
    let start = 0;
    while (start < lines.length && lines[start].trim() === '') {
      start++;
    }

    // 移除文件末尾的多余空行
    let end = lines.length;
    while (end > start && lines[end - 1].trim() === '') {
      end--;
    }

    for (let i = start; i < end; i++) {
      const line = lines[i];
      const isEmpty = line.trim() === '';

      // 检查空行数量
      if (isEmpty) {
        let consecutiveEmpty = 1;
        while (i + consecutiveEmpty < end && lines[i + consecutiveEmpty].trim() === '') {
          consecutiveEmpty++;
        }

        if (consecutiveEmpty <= rules.blankLines.max) {
          for (let j = 0; j < consecutiveEmpty; j++) {
            formattedLines.push('');
          }
        }

        i += consecutiveEmpty - 1;
      } else {
        formattedLines.push(line);
      }
    }

    // 添加文件末尾的空行
    if (rules.blankLines.maxEOF > 0 && formattedLines.length > 0) {
      const lastLineEmpty = formattedLines[formattedLines.length - 1].trim() === '';
      if (!lastLineEmpty) {
        formattedLines.push('');
      }
    }

    return formattedLines.join('\n');
  }

  /**
   * 应用空格规则
   */
  applySpacing(content, rules) {
    let formattedContent = content;

    // 函数括号前的空格
    if (!rules.spaceBeforeFunctionParen) {
      formattedContent = formattedContent.replace(/\bfunction\s+\(/g, 'function(');
    }

    // 括号内的空格
    if (!rules.spaceInParens) {
      formattedContent = formattedContent.replace(/\(\s+/g, '(');
      formattedContent = formattedContent.replace(/\s+\)/g, ')');
    }

    // 操作符周围的空格
    formattedContent = formattedContent.replace(/([=+\-*/%<>!&|^])=/g, ' $1= ');
    formattedContent = formattedContent.replace(/([=+\-*/%<>!&|^]) /g, ' $1 ');
    formattedContent = formattedContent.replace(/ ,/g, ',');

    return formattedContent;
  }

  /**
   * 检查是否在注释或字符串中
   */
  isInCommentOrString(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') ||
           trimmed.startsWith('*') || trimmed.includes('"') || trimmed.includes("'");
  }

  /**
   * 获取所有文件
   */
  async getFiles() {
    const dirs = [this.options.srcDir];
    if (fs.existsSync(this.options.testDir)) {
      dirs.push(this.options.testDir);
    }

    const files = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.less', '.html', '.md'];

    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        files.push(...await this.getAllFiles(dir, extensions));
      }
    }

    return files;
  }

  /**
   * 递归获取所有文件
   */
  async getAllFiles(dir, extensions) {
    const files = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 跳过特定目录
        if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
          files.push(...await this.getAllFiles(fullPath, extensions));
        }
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * 创建备份
   */
  async createBackup(filePath) {
    const backupPath = path.join(
      this.options.backupDir,
      `${path.basename(filePath)}.backup.${Date.now()}`
    );

    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }

  /**
   * 确保目录存在
   */
  async ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 生成报告
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      options: this.options
    };

    const reportPath = 'code-format-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 格式化报告已生成:', reportPath);

    console.log('\n📈 格式化统计:');
    console.log(`  - 总文件数: ${this.stats.totalFiles}`);
    console.log(`  - 已处理文件: ${this.stats.processedFiles}`);
    console.log(`  - 已格式化文件: ${this.stats.formattedFiles}`);
    console.log(`  - 错误数: ${this.stats.errors}`);

    if (this.options.dryRun) {
      console.log('\n💡 这是干运行模式，文件未被实际修改');
      console.log('   使用 --fix 参数执行实际格式化');
    }
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--fix':
        options.dryRun = false;
        break;
      case '--no-backup':
        options.enableBackup = false;
        break;
      case '--src':
        options.srcDir = args[++i];
        break;
      case '--max-line-length':
        options.formatRules = { ...options.formatRules, maxLineLength: parseInt(args[++i]) };
        break;
      case '--help':
        console.log(`
代码格式化工具

用法:
  node code-formatter.js [选项]

选项:
  --dry-run                预览模式，不修改文件（默认）
  --fix                    实际格式化文件
  --no-backup              不创建备份文件
  --src <dir>              源代码目录（默认: src）
  --max-line-length <num>  最大行长度（默认: 100）
  --help                   显示帮助信息

特性:
  - 自动检测并使用 Prettier、ESLint
  - 内置格式化规则作为备选方案
  - 支持 TypeScript、JavaScript、CSS 等多种文件类型
  - 可配置的格式化规则
  - 安全的备份机制

示例:
  node code-formatter.js --dry-run                     # 预览格式化
  node code-formatter.js --fix                          # 执行格式化
  node code-formatter.js --fix --max-line-length 120    # 自定义行长度
        `);
        return;
    }
  }

  // 默认干运行模式
  if (options.dryRun === undefined) {
    options.dryRun = true;
  }

  const formatter = new CodeFormatter(options);
  await formatter.run();
}

if (require.main === module) {
  main();
}

module.exports = CodeFormatter;