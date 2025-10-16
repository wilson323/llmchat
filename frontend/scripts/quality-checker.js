#!/usr/bin/env node

/**
 * 代码质量检查工具
 * 全面的代码质量分析和建议
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class QualityChecker {
  constructor(options = {}) {
    this.options = {
      srcDir: 'src',
      testDir: 'test',
      outputDir: 'quality-reports',
      // 质量阈值
      thresholds: {
        complexity: {
          max: 10, // 最大圈复杂度
          warning: 8
        },
        functionLength: {
          max: 50, // 最大函数长度
          warning: 30
        },
        fileLength: {
          max: 300, // 最大文件长度
          warning: 200
        },
        linesOfCode: {
          max: 1000, // 最大代码行数
          warning: 500
        },
        maintainabilityIndex: {
          min: 70, // 最小可维护性指数
          warning: 80
        },
        duplication: {
          max: 0.1, // 最大重复率 10%
          warning: 0.05
        },
        testCoverage: {
          min: 80, // 最小测试覆盖率
          warning: 90
        }
      },
      // 检查项目
      checks: {
        complexity: true,
        functionLength: true,
        fileLength: true,
        maintainability: true,
        duplication: true,
        testCoverage: true,
        security: true,
        performance: true,
        naming: true,
        imports: true,
        documentation: true
      },
      ...options
    };

    this.stats = {
      totalFiles: 0,
      totalLines: 0,
      totalFunctions: 0,
      issues: {
        critical: 0,
        warning: 0,
        info: 0
      },
      metrics: {
        averageComplexity: 0,
        averageFunctionLength: 0,
        averageFileLength: 0,
        maintainabilityIndex: 0,
        duplicationRate: 0,
        testCoverage: 0
      },
      files: []
    };

    this.issues = [];
    this.metrics = new Map();
  }

  /**
   * 运行质量检查
   */
  async run() {
    console.log('🔍 代码质量检查工具启动...');

    await this.ensureDirectory(this.options.outputDir);

    const files = await this.getFiles();
    this.stats.totalFiles = files.length;

    console.log(`📁 发现 ${files.length} 个文件`);

    // 执行各项检查
    await this.performChecks(files);

    // 生成报告
    await this.generateReports();

    // 显示摘要
    this.showSummary();
  }

  /**
   * 执行检查
   */
  async performChecks(files) {
    console.log('\n🔍 执行质量检查...');

    // 1. 复杂度检查
    if (this.options.checks.complexity) {
      await this.checkComplexity(files);
    }

    // 2. 函数长度检查
    if (this.options.checks.functionLength) {
      await this.checkFunctionLength(files);
    }

    // 3. 文件长度检查
    if (this.options.checks.fileLength) {
      await this.checkFileLength(files);
    }

    // 4. 可维护性检查
    if (this.options.checks.maintainability) {
      await this.checkMaintainability(files);
    }

    // 5. 代码重复检查
    if (this.options.checks.duplication) {
      await this.checkDuplication(files);
    }

    // 6. 测试覆盖率检查
    if (this.options.checks.testCoverage) {
      await this.checkTestCoverage();
    }

    // 7. 安全性检查
    if (this.options.checks.security) {
      await this.checkSecurity(files);
    }

    // 8. 性能检查
    if (this.options.checks.performance) {
      await this.checkPerformance(files);
    }

    // 9. 命名规范检查
    if (this.options.checks.naming) {
      await this.checkNaming(files);
    }

    // 10. 导入检查
    if (this.options.checks.imports) {
      await this.checkImports(files);
    }

    // 11. 文档检查
    if (this.options.checks.documentation) {
      await this.checkDocumentation(files);
    }

    console.log('✅ 质量检查完成');
  }

  /**
   * 检查复杂度
   */
  async checkComplexity(files) {
    console.log('  🧮 检查代码复杂度...');

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileMetrics = this.analyzeComplexity(content, filePath);

        if (fileMetrics.maxComplexity > this.options.thresholds.complexity.max) {
          this.addIssue({
            type: 'complexity',
            severity: 'critical',
            file: filePath,
            line: fileMetrics.complexFunction.line,
            message: `函数复杂度过高: ${fileMetrics.maxComplexity} (阈值: ${this.options.thresholds.complexity.max})`,
            function: fileMetrics.complexFunction.name
          });
        } else if (fileMetrics.maxComplexity > this.options.thresholds.complexity.warning) {
          this.addIssue({
            type: 'complexity',
            severity: 'warning',
            file: filePath,
            line: fileMetrics.complexFunction.line,
            message: `函数复杂度偏高: ${fileMetrics.maxComplexity} (建议: < ${this.options.thresholds.complexity.warning})`,
            function: fileMetrics.complexFunction.name
          });
        }

        this.metrics.set(filePath, { ...this.metrics.get(filePath), complexity: fileMetrics });
      } catch (error) {
        console.warn(`⚠️ 复杂度检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 分析复杂度
   */
  analyzeComplexity(content, filePath) {
    const lines = content.split('\n');
    const functions = [];
    let currentFunction = null;
    let braceCount = 0;
    let lineIndex = 0;

    for (const line of lines) {
      lineIndex++;

      // 检测函数定义
      const functionMatch = line.match(
        /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\([^)]*\)\s*=>)|async\s+(\w+)\s*\()/g
      );

      if (functionMatch) {
        if (currentFunction) {
          functions.push(currentFunction);
        }

        const funcName = functionMatch[1] || functionMatch[2] || functionMatch[3] || 'anonymous';
        currentFunction = {
          name: funcName,
          line: lineIndex,
          complexity: 1,
          braceCount: 0
        };
      }

      if (currentFunction) {
        // 计算复杂度
        const complexityPatterns = [
          /\bif\b/g,
          /\belse\s+if\b/g,
          /\bfor\b/g,
          /\bwhile\b/g,
          /\bdo\b/g,
          /\bswitch\b/g,
          /\bcase\b/g,
          /\bcatch\b/g,
          /\b&&\b/g,
          /\b\|\|\b/g,
          /\?\s*:?\s*/g
        ];

        for (const pattern of complexityPatterns) {
          const matches = line.match(pattern);
          if (matches) {
            currentFunction.complexity += matches.length;
          }
        }

        // 跟踪大括号
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        currentFunction.braceCount += openBraces - closeBraces;

        if (currentFunction.braceCount === 0) {
          functions.push(currentFunction);
          currentFunction = null;
        }
      }
    }

    if (currentFunction) {
      functions.push(currentFunction);
    }

    const maxComplexity = Math.max(...functions.map(f => f.complexity), 0);
    const complexFunction = functions.find(f => f.complexity === maxComplexity) || null;
    const averageComplexity = functions.length > 0 ?
      functions.reduce((sum, f) => sum + f.complexity, 0) / functions.length : 0;

    return {
      functions,
      maxComplexity,
      complexFunction,
      averageComplexity
    };
  }

  /**
   * 检查函数长度
   */
  async checkFunctionLength(files) {
    console.log('  📏 检查函数长度...');

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const functions = this.extractFunctions(content);

        for (const func of functions) {
          const length = func.endLine - func.startLine + 1;

          if (length > this.options.thresholds.functionLength.max) {
            this.addIssue({
              type: 'functionLength',
              severity: 'critical',
              file: filePath,
              line: func.startLine,
              message: `函数过长: ${length} 行 (阈值: ${this.options.thresholds.functionLength.max})`,
              function: func.name
            });
          } else if (length > this.options.thresholds.functionLength.warning) {
            this.addIssue({
              type: 'functionLength',
              severity: 'warning',
              file: filePath,
              line: func.startLine,
              message: `函数长度偏长: ${length} 行 (建议: < ${this.options.thresholds.functionLength.warning})`,
              function: func.name
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ 函数长度检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 提取函数信息
   */
  extractFunctions(content) {
    const lines = content.split('\n');
    const functions = [];
    let currentFunction = null;
    let braceCount = 0;
    let lineIndex = 0;

    for (const line of lines) {
      lineIndex++;

      // 检测函数定义
      const functionMatch = line.match(
        /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:function|\([^)]*\)\s*=>)|async\s+(\w+)\s*\()/g
      );

      if (functionMatch) {
        if (currentFunction) {
          currentFunction.endLine = lineIndex - 1;
          functions.push(currentFunction);
        }

        const funcName = functionMatch[1] || functionMatch[2] || functionMatch[3] || 'anonymous';
        currentFunction = {
          name: funcName,
          startLine: lineIndex,
          braceCount: 0
        };
      }

      if (currentFunction) {
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        currentFunction.braceCount += openBraces - closeBraces;

        if (currentFunction.braceCount === 0) {
          currentFunction.endLine = lineIndex;
          functions.push(currentFunction);
          currentFunction = null;
        }
      }
    }

    if (currentFunction) {
      currentFunction.endLine = lineIndex;
      functions.push(currentFunction);
    }

    return functions;
  }

  /**
   * 检查文件长度
   */
  async checkFileLength(files) {
    console.log('  📄 检查文件长度...');

    for (const filePath of files) {
      try {
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lineCount = content.split('\n').length;

        if (lineCount > this.options.thresholds.fileLength.max) {
          this.addIssue({
            type: 'fileLength',
            severity: 'warning',
            file: filePath,
            message: `文件过长: ${lineCount} 行 (建议: < ${this.options.thresholds.fileLength.max})`
          });
        } else if (lineCount > this.options.thresholds.fileLength.warning) {
          this.addIssue({
            type: 'fileLength',
            severity: 'info',
            file: filePath,
            message: `文件长度偏长: ${lineCount} 行 (建议: < ${this.options.thresholds.fileLength.warning})`
          });
        }

        this.stats.totalLines += lineCount;
      } catch (error) {
        console.warn(`⚠️ 文件长度检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 检查可维护性
   */
  async checkMaintainability(files) {
    console.log('  🛠️ 检查可维护性...');

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const maintainabilityIndex = this.calculateMaintainabilityIndex(content, filePath);

        if (maintainabilityIndex < this.options.thresholds.maintainabilityIndex.min) {
          this.addIssue({
            type: 'maintainability',
            severity: 'critical',
            file: filePath,
            message: `可维护性指数过低: ${maintainabilityIndex.toFixed(1)} (阈值: ${this.options.thresholds.maintainabilityIndex.min})`
          });
        } else if (maintainabilityIndex < this.options.thresholds.maintainabilityIndex.warning) {
          this.addIssue({
            type: 'maintainability',
            severity: 'warning',
            file: filePath,
            message: `可维护性指数偏低: ${maintainabilityIndex.toFixed(1)} (建议: > ${this.options.thresholds.maintainabilityIndex.warning})`
          });
        }

        this.metrics.set(filePath, { ...this.metrics.get(filePath), maintainabilityIndex });
      } catch (error) {
        console.warn(`⚠️ 可维护性检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 计算可维护性指数
   */
  calculateMaintainabilityIndex(content, filePath) {
    // 简化的可维护性指数计算
    const lines = content.split('\n');
    const totalLines = lines.length;
    const codeLines = lines.filter(line =>
      line.trim() &&
      !line.trim().startsWith('//') &&
      !line.trim().startsWith('/*') &&
      !line.trim().startsWith('*')
    ).length;

    const complexityMetrics = this.analyzeComplexity(content, filePath);
    const averageComplexity = complexityMetrics.averageComplexity;

    // 简化的MI公式
    const volume = codeLines * Math.log2(totalLines + 1);
    const difficulty = averageComplexity;
    const effort = volume * difficulty;

    // 转换为0-100的指数
    let maintainabilityIndex = Math.max(0, 171 - 5.2 * Math.log(effort) - 0.23 * averageComplexity - 16.2 * Math.log(totalLines + 1));
    maintainabilityIndex = Math.min(100, maintainabilityIndex);

    return maintainabilityIndex;
  }

  /**
   * 检查代码重复
   */
  async checkDuplication(files) {
    console.log('  🔄 检查代码重复...');

    const codeBlocks = [];
    const blockSize = 6; // 检查6行以上的重复

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i <= lines.length - blockSize; i++) {
          const block = lines.slice(i, i + blockSize).join('\n').trim();
          if (block.length > 20) { // 忽略太短的块
            codeBlocks.push({
              file: filePath,
              line: i + 1,
              block: this.normalizeCode(block)
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ 重复检查失败 ${filePath}:`, error.message);
      }
    }

    // 查找重复块
    const duplicates = this.findDuplicates(codeBlocks);
    const duplicationRate = duplicates.length / codeBlocks.length;

    if (duplicationRate > this.options.thresholds.duplication.max) {
      this.addIssue({
        type: 'duplication',
        severity: 'warning',
        message: `代码重复率过高: ${(duplicationRate * 100).toFixed(1)}% (阈值: ${(this.options.thresholds.duplication.max * 100)}%)`,
        duplicates: duplicates.slice(0, 5) // 只显示前5个
      });
    }

    this.stats.metrics.duplicationRate = duplicationRate;
  }

  /**
   * 标准化代码（去除空格、注释等）
   */
  normalizeCode(code) {
    return code
      .replace(/\s+/g, ' ')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 查找重复块
   */
  findDuplicates(codeBlocks) {
    const blockMap = new Map();
    const duplicates = [];

    for (const block of codeBlocks) {
      if (blockMap.has(block.block)) {
        const original = blockMap.get(block.block);
        duplicates.push({ original, duplicate: block });
      } else {
        blockMap.set(block.block, block);
      }
    }

    return duplicates;
  }

  /**
   * 检查测试覆盖率
   */
  async checkTestCoverage() {
    console.log('  🧪 检查测试覆盖率...');

    try {
      // 尝试运行测试覆盖率命令
      const result = execSync('npm run test:coverage 2>/dev/null || echo "No coverage"', {
        encoding: 'utf8'
      });

      // 从输出中提取覆盖率
      const coverageMatch = result.match(/All files\s+\|\s+(\d+(?:\.\d+)?)/);
      const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

      if (coverage < this.options.thresholds.testCoverage.min) {
        this.addIssue({
          type: 'testCoverage',
          severity: 'critical',
          message: `测试覆盖率过低: ${coverage}% (阈值: ${this.options.thresholds.testCoverage.min}%)`
        });
      } else if (coverage < this.options.thresholds.testCoverage.warning) {
        this.addIssue({
          type: 'testCoverage',
          severity: 'warning',
          message: `测试覆盖率偏低: ${coverage}% (建议: > ${this.options.thresholds.testCoverage.warning}%)`
        });
      }

      this.stats.metrics.testCoverage = coverage;
    } catch (error) {
      console.warn('⚠️ 无法获取测试覆盖率:', error.message);
      this.addIssue({
        type: 'testCoverage',
        severity: 'info',
        message: '无法获取测试覆盖率，请确保测试配置正确'
      });
    }
  }

  /**
   * 检查安全性
   */
  async checkSecurity(files) {
    console.log('  🔒 检查安全性...');

    const securityPatterns = [
      {
        pattern: /eval\(/g,
        type: 'critical',
        message: '使用eval()存在安全风险'
      },
      {
        pattern: /innerHTML\s*=/g,
        type: 'critical',
        message: 'innerHTML可能存在XSS风险'
      },
      {
        pattern: /document\.write\(/g,
        type: 'critical',
        message: 'document.write()存在安全风险'
      },
      {
        pattern: /setTimeout\s*\(\s*["'].*["']/g,
        type: 'warning',
        message: 'setTimeout使用字符串参数存在安全风险'
      },
      {
        pattern: /setInterval\s*\(\s*["'].*["']/g,
        type: 'warning',
        message: 'setInterval使用字符串参数存在安全风险'
      },
      {
        pattern: /crypto\.js/g,
        type: 'warning',
        message: '使用crypto.js可能存在安全风险'
      }
    ];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];

          for (const securityRule of securityPatterns) {
            if (securityRule.pattern.test(line)) {
              this.addIssue({
                type: 'security',
                severity: securityRule.type,
                file: filePath,
                line: lineIndex + 1,
                message: securityRule.message,
                context: line.trim()
              });
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ 安全检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 检查性能
   */
  async checkPerformance(files) {
    console.log('  ⚡ 检查性能...');

    const performancePatterns = [
      {
        pattern: /for\s*\(\s*.*\s*in\s.*\)/g,
        type: 'warning',
        message: 'for...in循环可能性能较差，建议使用for...of或Array方法'
      },
      {
        pattern: /document\.getElementById\s*\(/g,
        type: 'info',
        message: '频繁的DOM查询可能影响性能，建议缓存DOM引用'
      },
      {
        pattern: /setInterval\s*\(/g,
        type: 'warning',
        message: 'setInterval可能造成内存泄漏，确保正确清理'
      },
      {
        pattern: /console\.log\s*\(/g,
        type: 'info',
        message: '生产环境应移除console.log'
      }
    ];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];

          for (const perfRule of performancePatterns) {
            if (perfRule.pattern.test(line) && !this.isInCommentOrString(line)) {
              this.addIssue({
                type: 'performance',
                severity: perfRule.type,
                file: filePath,
                line: lineIndex + 1,
                message: perfRule.message,
                context: line.trim()
              });
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ 性能检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 检查命名规范
   */
  async checkNaming(files) {
    console.log('  📝 检查命名规范...');

    const namingPatterns = [
      {
        pattern: /\bconst\s+([A-Z])\w*\b/g,
        type: 'warning',
        message: '常量应使用大写字母和下划线命名'
      },
      {
        pattern: /\blet\s+([A-Z])\w*\b/g,
        type: 'warning',
        message: '变量应使用驼峰命名法'
      },
      {
        pattern: /\bfunction\s+([A-Z])\w*\b/g,
        type: 'warning',
        message: '函数应使用驼峰命名法（构造函数除外）'
      }
    ];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];

          for (const namingRule of namingPatterns) {
            const matches = line.match(namingRule.pattern);
            if (matches && !this.isInCommentOrString(line)) {
              this.addIssue({
                type: 'naming',
                severity: namingRule.type,
                file: filePath,
                line: lineIndex + 1,
                message: namingRule.message,
                context: line.trim()
              });
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ 命名检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 检查导入
   */
  async checkImports(files) {
    console.log('  📦 检查导入...');

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        const imports = [];
        const unusedImports = new Set();

        // 收集所有导入
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          const importMatch = line.match(/import\s+.*\s+from\s+['"](.*)['"]/);

          if (importMatch) {
            imports.push({
              line: lineIndex + 1,
              module: importMatch[1],
              lineContent: line.trim()
            });
          }
        }

        // 检查未使用的导入（简化版）
        for (const importInfo of imports) {
          const moduleBase = path.basename(importInfo.module, path.extname(importInfo.module));
          const isUsed = content.includes(moduleBase) ||
                        content.includes(`from '${importInfo.module}'`) ||
                        content.includes(`from "${importInfo.module}"`);

          if (!isUsed && !importInfo.module.startsWith('.')) {
            this.addIssue({
              type: 'imports',
              severity: 'warning',
              file: filePath,
              line: importInfo.line,
              message: `可能未使用的导入: ${importInfo.module}`,
              context: importInfo.lineContent
            });
          }
        }

        // 检查导入顺序
        this.checkImportOrder(imports, filePath);
      } catch (error) {
        console.warn(`⚠️ 导入检查失败 ${filePath}:`, error.message);
      }
    }
  }

  /**
   * 检查导入顺序
   */
  checkImportOrder(imports, filePath) {
    if (imports.length < 2) return;

    const groups = {
      node: [],
      relative: [],
      local: []
    };

    // 分类导入
    for (const importInfo of imports) {
      if (importInfo.module.startsWith('.')) {
        groups.relative.push(importInfo);
      } else if (importInfo.module.includes('/')) {
        groups.node.push(importInfo);
      } else {
        groups.local.push(importInfo);
      }
    }

    // 检查顺序：node -> local -> relative
    const expectedOrder = [...groups.node, ...groups.local, ...groups.relative];
    let lastGroup = -1;

    for (let i = 0; i < imports.length; i++) {
      const currentImport = imports[i];
      const expectedIndex = expectedOrder.findIndex(imp => imp.line === currentImport.line);

      if (expectedIndex < lastGroup) {
        this.addIssue({
          type: 'imports',
          severity: 'info',
          file: filePath,
          line: currentImport.line,
          message: '导入顺序不规范，建议按: node_modules -> 本地模块 -> 相对路径排序',
          context: currentImport.lineContent
        });
      }

      lastGroup = expectedIndex;
    }
  }

  /**
   * 检查文档
   */
  async checkDocumentation(files) {
    console.log('  📚 检查文档...');

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        let hasFileDoc = false;
        let hasFunctionDocs = 0;
        let totalFunctions = 0;

        // 检查文件文档
        for (const line of lines.slice(0, 20)) { // 检查前20行
          if (line.includes('/**') && line.includes('@file')) {
            hasFileDoc = true;
            break;
          }
        }

        // 检查函数文档
        const functions = this.extractFunctions(content);
        totalFunctions = functions.length;

        for (const func of functions) {
          const funcLines = lines.slice(func.startLine - 1, Math.min(func.endLine, func.startLine + 3));
          for (const line of funcLines) {
            if (line.includes('/**')) {
              hasFunctionDocs++;
              break;
            }
          }
        }

        if (!hasFileDoc && totalFunctions > 0) {
          this.addIssue({
            type: 'documentation',
            severity: 'info',
            file: filePath,
            message: '建议添加文件级文档注释'
          });
        }

        const docRatio = totalFunctions > 0 ? hasFunctionDocs / totalFunctions : 1;
        if (docRatio < 0.5 && totalFunctions > 3) {
          this.addIssue({
            type: 'documentation',
            severity: 'info',
            file: filePath,
            message: `函数文档覆盖率较低: ${(docRatio * 100).toFixed(1)}%`,
            details: `${hasFunctionDocs}/${totalFunctions} 函数有文档`
          });
        }
      } catch (error) {
        console.warn(`⚠️ 文档检查失败 ${filePath}:`, error.message);
      }
    }
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
   * 添加问题
   */
  addIssue(issue) {
    this.issues.push(issue);
    this.stats.issues[issue.severity]++;
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
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

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
   * 生成报告
   */
  async generateReports() {
    console.log('\n📊 生成质量报告...');

    // JSON报告
    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.stats.totalFiles,
        totalLines: this.stats.totalLines,
        totalIssues: this.issues.length,
        criticalIssues: this.stats.issues.critical,
        warningIssues: this.stats.issues.warning,
        infoIssues: this.stats.issues.info
      },
      metrics: this.stats.metrics,
      issues: this.issues,
      thresholds: this.options.thresholds
    };

    const jsonReportPath = path.join(this.options.outputDir, 'quality-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));

    // HTML报告
    const htmlReport = this.generateHtmlReport(jsonReport);
    const htmlReportPath = path.join(this.options.outputDir, 'quality-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`  📄 JSON报告: ${jsonReportPath}`);
    console.log(`  🌐 HTML报告: ${htmlReportPath}`);
  }

  /**
   * 生成HTML报告
   */
  generateHtmlReport(data) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>代码质量报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .metric-label { color: #666; }
        .critical { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        .issues { margin-top: 30px; }
        .issue { border-left: 4px solid #ddd; padding: 15px; margin-bottom: 10px; background: #f9f9f9; }
        .issue.critical { border-left-color: #dc3545; }
        .issue.warning { border-left-color: #ffc107; }
        .issue.info { border-left-color: #17a2b8; }
        .issue-file { font-weight: bold; margin-bottom: 5px; }
        .issue-message { margin-bottom: 5px; }
        .issue-details { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 代码质量报告</h1>
            <p>生成时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}</p>
        </div>
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value">${data.summary.totalFiles}</div>
                    <div class="metric-label">文件总数</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${data.summary.totalLines}</div>
                    <div class="metric-label">代码行数</div>
                </div>
                <div class="metric">
                    <div class="metric-value ${data.summary.criticalIssues > 0 ? 'critical' : ''}">${data.summary.totalIssues}</div>
                    <div class="metric-label">问题总数</div>
                </div>
                <div class="metric">
                    <div class="metric-value critical">${data.summary.criticalIssues}</div>
                    <div class="metric-label">严重问题</div>
                </div>
                <div class="metric">
                    <div class="metric-value warning">${data.summary.warningIssues}</div>
                    <div class="metric-label">警告问题</div>
                </div>
                <div class="metric">
                    <div class="metric-value info">${data.summary.infoIssues}</div>
                    <div class="metric-label">信息问题</div>
                </div>
            </div>
            <div class="issues">
                <h2>🚨 问题详情</h2>
                ${data.issues.slice(0, 50).map(issue => `
                    <div class="issue ${issue.severity}">
                        <div class="issue-file">📄 ${path.relative(process.cwd(), issue.file)}:${issue.line || ''}</div>
                        <div class="issue-message">${issue.message}</div>
                        ${issue.function ? `<div class="issue-details">函数: ${issue.function}</div>` : ''}
                        ${issue.context ? `<div class="issue-details">代码: ${issue.context}</div>` : ''}
                    </div>
                `).join('')}
                ${data.issues.length > 50 ? `<p>... 还有 ${data.issues.length - 50} 个问题，详见JSON报告</p>` : ''}
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * 显示摘要
   */
  showSummary() {
    console.log('\n📈 质量检查摘要:');
    console.log('━'.repeat(50));
    console.log(`📁 文件总数: ${this.stats.totalFiles}`);
    console.log(`📝 代码行数: ${this.stats.totalLines}`);
    console.log(`🚨 问题总数: ${this.issues.length}`);
    console.log(`   - 严重: ${this.stats.issues.critical}`);
    console.log(`   - 警告: ${this.stats.issues.warning}`);
    console.log(`   - 信息: ${this.stats.issues.info}`);

    if (this.stats.metrics.testCoverage > 0) {
      console.log(`🧪 测试覆盖率: ${this.stats.metrics.testCoverage}%`);
    }

    if (this.stats.metrics.duplicationRate > 0) {
      console.log(`🔄 代码重复率: ${(this.stats.metrics.duplicationRate * 100).toFixed(1)}%`);
    }

    console.log('\n🎯 质量评级:', this.getQualityGrade());

    if (this.stats.issues.critical > 0) {
      console.log('\n⚠️ 建议优先处理严重问题，确保代码质量和安全性');
    }
  }

  /**
   * 获取质量评级
   */
  getQualityGrade() {
    const totalIssues = this.issues.length;
    const criticalIssues = this.stats.issues.critical;

    if (criticalIssues > 0) return 'D';
    if (totalIssues > 20) return 'C';
    if (totalIssues > 10) return 'B';
    if (totalIssues > 5) return 'A';
    return 'A+';
  }

  /**
   * 确保目录存在
   */
  async ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

// CLI接口
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--src':
        options.srcDir = args[++i];
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--threshold-complexity':
        options.thresholds = { ...options.thresholds, complexity: { max: parseInt(args[++i]) } };
        break;
      case '--disable-duplication':
        options.checks = { ...options.checks, duplication: false };
        break;
      case '--help':
        console.log(`
代码质量检查工具

用法:
  node quality-checker.js [选项]

选项:
  --src <dir>                    源代码目录（默认: src）
  --output <dir>                 报告输出目录（默认: quality-reports）
  --threshold-complexity <num>   复杂度阈值（默认: 10）
  --disable-duplication          禁用重复检查
  --help                         显示帮助信息

检查项目:
  ✅ 代码复杂度分析
  ✅ 函数长度检查
  ✅ 文件长度检查
  ✅ 可维护性指数
  ✅ 代码重复检测
  ✅ 测试覆盖率
  ✅ 安全性检查
  ✅ 性能检查
  ✅ 命名规范
  ✅ 导入检查
  ✅ 文档检查

报告格式:
  📄 JSON报告（详细数据）
  🌐 HTML报告（可视化报告）

示例:
  node quality-checker.js                          # 默认检查
  node quality-checker.js --src lib               # 检查lib目录
  node quality-checker.js --threshold-complexity 8 # 自定义复杂度阈值
        `);
        return;
    }
  }

  const checker = new QualityChecker(options);
  await checker.run();
}

if (require.main === module) {
  main();
}

module.exports = QualityChecker;