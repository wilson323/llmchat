#!/usr/bin/env node

/**
 * ESLint错误自动修复脚本
 * 用于快速批量修复常见的ESLint错误
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ESLintFixer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcDir = path.join(this.projectRoot, 'src');
    this.fixed = 0;
    this.failed = 0;
    this.errors = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  runCommand(command, options = {}) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        ...options
      });
      return result;
    } catch (error) {
      this.errors.push({
        command,
        error: error.message
      });
      throw error;
    }
  }

  async step1_autoFix() {
    this.log('步骤1: 运行ESLint自动修复...');
    try {
      this.runCommand('npx eslint src --ext .ts --fix', {
        stdio: 'pipe'
      });
      this.log('ESLint自动修复完成', 'success');
    } catch (error) {
      this.log('ESLint自动修复部分失败', 'warning');
    }
  }

  async step2_removeUnusedImports() {
    this.log('步骤2: 移除未使用的导入...');

    const tsFiles = this.findFiles(this.srcDir, '.ts');

    for (const file of tsFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        // 使用正则表达式匹配未使用的导入
        const fixedContent = content
          // 移除未使用的TypeScript导入
          .replace(/^import\s+.*unused.*\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
          // 移除空的import语句
          .replace(/^import\s*\{\s*\}\s*from\s+['"][^'"]+['"];?\s*$/gm, '')
          // 移除未使用的接口（简单情况）
          .replace(/^interface\s+\w+\s*\{\s*\}\s*$/gm, '');

        if (content !== fixedContent) {
          fs.writeFileSync(file, fixedContent);
          this.fixed++;
        }
      } catch (error) {
        this.failed++;
        this.errors.push({
          file,
          error: error.message
        });
      }
    }

    this.log(`移除未使用导入完成，修复了${this.fixed}个文件`, 'success');
  }

  async step3_fixConsoleStatements() {
    this.log('步骤3: 处理console语句...');

    const tsFiles = this.findFiles(this.srcDir, '.ts');

    for (const file of tsFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        // 将console.log替换为logger
        const fixedContent = content
          .replace(/console\.log/g, 'logger.info')
          .replace(/console\.error/g, 'logger.error')
          .replace(/console\.warn/g, 'logger.warn')
          .replace(/console\.debug/g, 'logger.debug');

        if (content !== fixedContent) {
          // 检查是否已导入logger
          if (!fixedContent.includes("import { logger }")) {
            const updatedContent = fixedContent.replace(
              /^/,
              "import { logger } from '@/utils/logger';\n\n"
            );
            fs.writeFileSync(file, updatedContent);
          } else {
            fs.writeFileSync(file, fixedContent);
          }
          this.fixed++;
        }
      } catch (error) {
        this.failed++;
      }
    }

    this.log(`处理console语句完成，修复了${this.fixed}个文件`, 'success');
  }

  async step4_fixAnyTypes() {
    this.log('步骤4: 修复any类型使用...');

    const tsFiles = this.findFiles(this.srcDir, '.ts');

    for (const file of tsFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        // 简单的any类型修复（需要人工审查）
        const fixedContent = content
          // 将函数参数的any改为unknown
          .replace(/(\w+):\s*any(?=,|\))/g, '$1: unknown')
          // 将变量声明的any改为unknown
          .replace(/:\s*any(?=\s*=)/g, ': unknown');

        if (content !== fixedContent) {
          fs.writeFileSync(file, fixedContent);
          this.fixed++;
        }
      } catch (error) {
        this.failed++;
      }
    }

    this.log(`修复any类型完成，修复了${this.fixed}个文件`, 'success');
  }

  async step5_addMissingImports() {
    this.log('步骤5: 添加缺失的导入...');

    // 这里可以添加自动导入缺失模块的逻辑
    // 由于复杂性较高，建议手动处理
    this.log('建议手动检查并添加缺失的导入', 'warning');
  }

  async step6_finalLint() {
    this.log('步骤6: 最终ESLint检查...');

    try {
      const result = this.runCommand('npx eslint src --ext .ts --format=json', {
        stdio: 'pipe'
      });

      const issues = JSON.parse(result);
      const errors = issues.filter(i => i.severity === 2);
      const warnings = issues.filter(i => i.severity === 1);

      console.log('\n📊 最终检查结果:');
      console.log(`- 错误: ${errors.length}`);
      console.log(`- 警告: ${warnings.length}`);

      if (errors.length > 0) {
        console.log('\n❌ 仍需手动修复的错误:');
        errors.slice(0, 10).forEach(issue => {
          console.log(`  ${issue.filePath}:${issue.line}:${issue.column} - ${issue.message}`);
        });

        if (errors.length > 10) {
          console.log(`  ... 还有${errors.length - 10}个错误`);
        }
      }

      return { errors: errors.length, warnings: warnings.length };
    } catch (error) {
      this.log('最终检查失败', 'error');
      return { errors: -1, warnings: -1 };
    }
  }

  findFiles(dir, extension) {
    const files = [];

    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(fullPath);
        } else if (stat.isFile() && item.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  generateReport(finalResult) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        fixed: this.fixed,
        failed: this.failed,
        remainingErrors: finalResult.errors,
        remainingWarnings: finalResult.warnings
      },
      errors: this.errors,
      recommendations: this.generateRecommendations(finalResult)
    };

    fs.writeFileSync(
      path.join(this.projectRoot, 'eslint-fix-report.json'),
      JSON.stringify(report, null, 2)
    );

    return report;
  }

  generateRecommendations(result) {
    const recommendations = [];

    if (result.errors > 0) {
      recommendations.push('需要手动修复' + result.errors + '个错误');
    }

    if (result.warnings > 50) {
      recommendations.push('警告数量较多，建议设置更严格的规则');
    }

    recommendations.push('配置IDE自动格式化和保存时修复');
    recommendations.push('设置pre-commit hooks防止质量问题');
    recommendations.push('定期运行代码质量检查');

    return recommendations;
  }

  async run() {
    console.log('🚀 开始ESLint错误自动修复...\n');

    const startTime = Date.now();

    try {
      await this.step1_autoFix();
      await this.step2_removeUnusedImports();
      await this.step3_fixConsoleStatements();
      await this.step4_fixAnyTypes();
      await this.step5_addMissingImports();
      const finalResult = await this.step6_finalLint();

      const duration = Date.now() - startTime;
      const report = this.generateReport(finalResult);

      console.log('\n✅ 修复完成！');
      console.log(`⏱️  耗时: ${Math.round(duration / 1000)}秒`);
      console.log(`📁 报告文件: eslint-fix-report.json`);

      if (finalResult.errors === 0) {
        console.log('\n🎉 恭喜！所有ESLint错误已修复！');
      } else {
        console.log('\n⚠️  仍有部分错误需要手动修复');
      }

    } catch (error) {
      this.log('修复过程中发生错误: ' + error.message, 'error');
      process.exit(1);
    }
  }
}

// 运行修复器
if (require.main === module) {
  new ESLintFixer().run();
}

module.exports = ESLintFixer;