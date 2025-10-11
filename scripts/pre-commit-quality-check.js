#!/usr/bin/env node

/**
 * Pre-commit 质量检查脚本
 * 在Git提交前运行质量检查，确保代码质量标准
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PreCommitQualityCheck {
  constructor() {
    this.projectRoot = process.cwd();
    this.errors = [];
    this.warnings = [];
    this.passed = true;
  }

  /**
   * 运行检查
   */
  async run() {
    console.log('🔍 Pre-commit 质量检查开始...\n');

    try {
      // 获取变更的文件
      const changedFiles = this.getChangedFiles();
      if (changedFiles.length === 0) {
        console.log('✅ 没有文件变更，跳过质量检查');
        return true;
      }

      console.log(`📁 检查变更的 ${changedFiles.length} 个文件:\n${changedFiles.map(f => `  - ${f}`).join('\n')}\n`);

      // 运行各项检查
      await this.runTypeScriptCheck(changedFiles);
      await this.runESLintCheck(changedFiles);
      await this.runImportCheck(changedFiles);
      await this.runFormatCheck(changedFiles);

      // 输出结果
      this.printResults();

      return this.passed;
    } catch (error) {
      console.error('❌ Pre-commit 检查过程中发生错误:', error.message);
      return false;
    }
  }

  /**
   * 获取变更的文件
   */
  getChangedFiles() {
    try {
      // 获取已暂存的文件
      const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.trim())
        .filter(file => /\.(ts|tsx|js|jsx)$/.test(file));

      // 获取未暂存但有变更的文件
      const unstagedFiles = execSync('git diff --name-only', { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.trim())
        .filter(file => /\.(ts|tsx|js|jsx)$/.test(file));

      // 合并并去重
      const allFiles = [...new Set([...stagedFiles, ...unstagedFiles])];
      return allFiles.filter(file => fs.existsSync(file));
    } catch (error) {
      console.warn('⚠️ 无法获取Git变更文件:', error.message);
      return [];
    }
  }

  /**
   * TypeScript类型检查
   */
  async runTypeScriptCheck(changedFiles) {
    console.log('🔍 TypeScript类型检查...');

    try {
      const result = execSync('pnpm run type-check 2>&1', { encoding: 'utf8' });
      console.log('✅ TypeScript类型检查通过');
    } catch (error) {
      const output = error.stdout || error.stderr || '';
      const errorLines = output.split('\n').filter(line => line.trim());

      // 只显示与变更文件相关的错误
      const relevantErrors = errorLines.filter(line =>
        changedFiles.some(file => line.includes(file))
      );

      if (relevantErrors.length > 0) {
        this.errors.push('TypeScript类型检查失败:');
        relevantErrors.forEach(line => this.errors.push(`  ❌ ${line}`));
        this.passed = false;
      } else {
        console.log('✅ TypeScript类型检查通过（无相关错误）');
      }
    }
  }

  /**
   * ESLint检查
   */
  async runESLintCheck(changedFiles) {
    console.log('🔍 ESLint代码质量检查...');

    const relevantFiles = changedFiles.filter(file =>
      file.includes('src/') && /\.(ts|tsx|js|jsx)$/.test(file)
    );

    if (relevantFiles.length === 0) {
      console.log('✅ ESLint检查通过（无相关文件）');
      return;
    }

    try {
      const fileList = relevantFiles.join(' ');
      const result = execSync(`ESLINT_DEV=true npx eslint ${fileList} --format=compact 2>&1`, {
        encoding: 'utf8'
      });

      if (result.trim()) {
        console.log('⚠️ ESLint发现问题:');
        const lines = result.split('\n').filter(line => line.trim());
        lines.forEach(line => this.warnings.push(`  ⚠️ ${line}`));
      } else {
        console.log('✅ ESLint检查通过');
      }
    } catch (error) {
      const output = error.stdout || error.stderr || '';
      const errorLines = output.split('\n').filter(line => line.trim());

      if (errorLines.length > 0) {
        this.errors.push('ESLint检查失败:');
        errorLines.forEach(line => {
          if (line.includes('error')) {
            this.errors.push(`  ❌ ${line}`);
            this.passed = false;
          } else {
            this.warnings.push(`  ⚠️ ${line}`);
          }
        });
      }
    }
  }

  /**
   * 导入检查
   */
  async runImportCheck(changedFiles) {
    console.log('🔍 导入规范检查...');

    const tsxFiles = changedFiles.filter(file => file.endsWith('.tsx'));

    for (const file of tsxFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        // 检查是否有未使用的导入
        const unusedImports = this.findUnusedImports(content, file);
        if (unusedImports.length > 0) {
          unusedImports.forEach(imp => {
            this.warnings.push(`  ⚠️ ${file}: 未使用的导入 ${imp}`);
          });
        }

        // 检查导入顺序
        const importOrderIssues = this.checkImportOrder(content, file);
        if (importOrderIssues.length > 0) {
          importOrderIssues.forEach(issue => {
            this.warnings.push(`  ⚠️ ${file}: ${issue}`);
          });
        }
      } catch (error) {
        console.warn(`⚠️ 无法检查文件 ${file}:`, error.message);
      }
    }

    if (tsxFiles.length === 0) {
      console.log('✅ 导入检查通过（无TSX文件）');
    } else {
      console.log('✅ 导入检查完成');
    }
  }

  /**
   * 代码格式检查
   */
  async runFormatCheck(changedFiles) {
    console.log('🔍 代码格式检查...');

    const relevantFiles = changedFiles.filter(file =>
      file.includes('src/') && /\.(ts|tsx|js|jsx)$/.test(file)
    );

    if (relevantFiles.length === 0) {
      console.log('✅ 格式检查通过（无相关文件）');
      return;
    }

    try {
      // 检查是否有格式问题（不自动修复）
      const fileList = relevantFiles.join(' ');
      const result = execSync(`npx prettier --check ${fileList} 2>&1`, { encoding: 'utf8' });

      if (result.trim()) {
        console.log('⚠️ 发现格式问题:');
        const lines = result.split('\n').filter(line => line.trim());
        lines.forEach(line => this.warnings.push(`  ⚠️ ${line}`));

        console.log('💡 提示: 运行 `pnpm run format:fix` 自动修复格式问题');
      } else {
        console.log('✅ 格式检查通过');
      }
    } catch (error) {
      const output = error.stdout || error.stderr || '';
      if (output.trim()) {
        this.errors.push('代码格式检查失败:');
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => this.errors.push(`  ❌ ${line}`));
        this.passed = false;
      }
    }
  }

  /**
   * 查找未使用的导入
   */
  findUnusedImports(content, filePath) {
    const unusedImports = [];

    // 匹配导入语句
    const importRegex = /^import\s+.*?\s+from\s+['"][^'"]+['"];?$/gm;
    const imports = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importLine = match[0];
      // 简单的未使用导入检测（实际使用中可能需要更复杂的AST分析）
      if (importLine.includes('{') && importLine.includes('}')) {
        const importsMatch = importLine.match(/\{([^}]+)\}/);
        if (importsMatch) {
          const importsList = importsMatch[1].split(',').map(imp => imp.trim());
          importsList.forEach(imp => {
            if (!content.includes(imp.split(' as ')[0] || imp)) {
              unusedImports.push(imp);
            }
          });
        }
      }
    }

    return unusedImports;
  }

  /**
   * 检查导入顺序
   */
  checkImportOrder(content, filePath) {
    const issues = [];
    const lines = content.split('\n');

    let lastImportType = null;
    const importOrder = ['react', 'next', 'third-party', 'relative', 'types'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('import ')) {
        let importType = 'relative';

        if (line.includes('from \'react\'') || line.includes('from "react"')) {
          importType = 'react';
        } else if (line.includes('next/')) {
          importType = 'next';
        } else if (line.includes('from \'@') || line.includes('from "@')) {
          importType = 'third-party';
        } else if (line.includes('from \'./') || line.includes('from "./')) {
          importType = 'relative';
        } else if (line.includes('type')) {
          importType = 'types';
        }

        const currentIndex = importOrder.indexOf(importType);
        const lastIndex = lastImportType ? importOrder.indexOf(lastImportType) : -1;

        if (currentIndex < lastIndex) {
          issues.push(`导入顺序错误: ${importType} 导入应该在 ${lastImportType} 导入之前 (第${i + 1}行)`);
        }

        lastImportType = importType;
      }
    }

    return issues;
  }

  /**
   * 打印检查结果
   */
  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Pre-commit 质量检查结果');
    console.log('='.repeat(50));

    if (this.errors.length > 0) {
      console.log('\n❌ 错误 (必须修复):');
      this.errors.forEach(error => console.log(error));
      console.log('\n💡 请修复以上错误后再次提交');
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告 (建议修复):');
      this.warnings.forEach(warning => console.log(warning));
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ 所有检查通过，代码质量良好！');
    }

    console.log('\n' + '='.repeat(50));
    console.log(`🎯 质量检查${this.passed ? '通过' : '失败'}`);
    console.log('='.repeat(50));
  }
}

// 运行检查
if (require.main === module) {
  const checker = new PreCommitQualityCheck();
  checker.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Pre-commit 检查失败:', error);
    process.exit(1);
  });
}

module.exports = PreCommitQualityCheck;