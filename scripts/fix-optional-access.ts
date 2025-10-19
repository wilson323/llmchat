#!/usr/bin/env ts-node

/**
 * 自动化可选属性访问修复脚本
 *
 * 专门用于修复TypeScript中的可选属性访问问题，
 * 自动将不安全的属性访问转换为安全的可选链操作
 *
 * @author Type Safety Expert
 * @since 2025-10-18
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// ==================== 配置 ====================

const CONFIG = {
  // 要处理的目录
  includeDirs: ['frontend/src', 'backend/src', 'shared-types/src'],

  // 要排除的目录
  excludeDirs: [
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
    '__tests__',
    'test'
  ],

  // 要排除的文件模式
  excludePatterns: [
    '*.test.ts',
    '*.spec.ts',
    '*.stories.ts',
    '*.d.ts',
    'node_modules/**/*'
  ],

  // 修复选项
  fixOptions: {
    convertToOptionalChaining: true,        // 转换为可选链操作符
    addNullChecks: true,                   // 添加空值检查
    useTypeGuards: true,                   // 使用类型守卫
    preserveComments: true,                // 保留注释
    createBackup: true                     // 创建备份
  }
};

// ==================== 类型定义 ====================

interface FixResult {
  readonly file: string;
  readonly fixes: Fix[];
  readonly success: boolean;
  readonly error?: string;
  readonly backupPath?: string;
}

interface Fix {
  readonly type: FixType;
  readonly line: number;
  readonly column: number;
  readonly original: string;
  readonly fixed: string;
  readonly description: string;
  readonly confidence: number; // 0-100
}

type FixType =
  | 'optional-chaining'
  | 'null-check'
  | 'type-guard'
  | 'default-value'
  | 'non-null-assertion'
  | 'property-access';

interface OptionalAccessIssue {
  readonly node: ts.Node;
  readonly parent: ts.Node;
  readonly propertyName: string;
  readonly line: number;
  readonly column: number;
  readonly text: string;
  readonly suggestion: FixType;
  readonly confidence: number;
}

// ==================== 核心类 ====================

class OptionalAccessFixer {
  private program: ts.Program;
  private checker: ts.TypeChecker;
  private fixes: FixResult[] = [];

  constructor(
    private readonly projectRoot: string,
    private readonly options: Partial<typeof CONFIG.fixOptions> = {}
  ) {
    // 创建TypeScript程序
    const configPath = ts.findConfigFile(
      projectRoot,
      ts.sys.fileExists,
      'tsconfig.json'
    );

    if (!configPath) {
      throw new Error('无法找到tsconfig.json文件');
    }

    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(configPath)
    );

    this.program = ts.createProgram(
      parsedConfig.fileNames,
      parsedConfig.options
    );

    this.checker = this.program.getTypeChecker();
  }

  /**
   * 运行修复
   */
  async run(): Promise<FixResult[]> {
    console.log('🔧 开始自动修复可选属性访问问题...\n');

    try {
      // 1. 查找所有需要修复的文件
      const files = this.findFilesToFix();
      console.log(`📁 找到 ${files.length} 个文件需要检查\n`);

      // 2. 对每个文件进行修复
      for (const file of files) {
        const result = await this.fixFile(file);
        this.fixes.push(result);

        if (result.success) {
          console.log(`   ✅ ${file}: ${result.fixes.length} 个修复`);
        } else {
          console.log(`   ❌ ${file}: ${result.error}`);
        }
      }

      // 3. 生成报告
      this.generateReport();

    } catch (error) {
      console.error('❌ 修复过程中出现错误:', error);
      throw error;
    }

    return this.fixes;
  }

  /**
   * 查找需要修复的文件
   */
  private findFilesToFix(): string[] {
    const files: string[] = [];

    for (const dir of CONFIG.includeDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      this.scanDirectory(fullPath, files);
    }

    return files;
  }

  /**
   * 递归扫描目录
   */
  private scanDirectory(dir: string, files: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 检查是否在排除列表中
        if (!CONFIG.excludeDirs.includes(entry.name)) {
          this.scanDirectory(fullPath, files);
        }
      } else if (entry.isFile()) {
        // 检查是否为TypeScript文件且不在排除模式中
        if (this.shouldProcessFile(fullPath)) {
          files.push(fullPath);
        }
      }
    }
  }

  /**
   * 检查文件是否应该处理
   */
  private shouldProcessFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (ext !== '.ts' && ext !== '.tsx') {
      return false;
    }

    const relativePath = path.relative(this.projectRoot, filePath);

    for (const pattern of CONFIG.excludePatterns) {
      if (this.matchPattern(relativePath, pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 匹配文件模式
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // 简单的glob匹配实现
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\./g, '\\.')
    );

    return regex.test(filePath);
  }

  /**
   * 修复单个文件
   */
  private async fixFile(filePath: string): Promise<FixResult> {
    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');

      // 创建备份
      let backupPath: string | undefined;
      if (CONFIG.fixOptions.createBackup) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, content);
      }

      // 解析为AST
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      // 查找问题
      const issues = this.findOptionalAccessIssues(sourceFile);

      if (issues.length === 0) {
        return {
          file: filePath,
          fixes: [],
          success: true,
          backupPath
        };
      }

      // 生成修复
      const fixes = this.generateFixes(sourceFile, issues);

      // 应用修复
      const fixedContent = this.applyFixes(content, fixes);

      // 写入修复后的内容
      fs.writeFileSync(filePath, fixedContent);

      return {
        file: filePath,
        fixes,
        success: true,
        backupPath
      };

    } catch (error) {
      return {
        file: filePath,
        fixes: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 查找可选属性访问问题
   */
  private findOptionalAccessIssues(sourceFile: ts.SourceFile): OptionalAccessIssue[] {
    const issues: OptionalAccessIssue[] = [];

    const visit = (node: ts.Node) => {
      // 检查属性访问
      if (ts.isPropertyAccessExpression(node)) {
        const propertyType = this.checker.getTypeAtLocation(node.expression);

        // 如果属性可能是undefined/null
        if (this.isPossiblyUndefined(propertyType)) {
          const suggestion = this.suggestFix(node, propertyType);

          issues.push({
            node,
            parent: node.parent,
            propertyName: node.name.text,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character,
            text: node.getText(),
            suggestion,
            confidence: this.calculateConfidence(node, propertyType)
          });
        }
      }

      // 检查元素访问
      if (ts.isElementAccessExpression(node)) {
        const elementType = this.checker.getTypeAtLocation(node.expression);

        if (this.isPossiblyUndefined(elementType)) {
          const suggestion = this.suggestFix(node, elementType);

          issues.push({
            node,
            parent: node.parent,
            propertyName: node.argumentExpression?.getText() || '',
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character,
            text: node.getText(),
            suggestion,
            confidence: this.calculateConfidence(node, elementType)
          });
        }
      }

      // 递归访问子节点
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return issues;
  }

  /**
   * 检查类型是否可能是undefined/null
   */
  private isPossiblyUndefined(type: ts.Type): boolean {
    // 检查是否有undefined类型
    if (type.flags & ts.TypeFlags.Undefined) {
      return true;
    }

    // 检查是否有null类型
    if (type.flags & ts.TypeFlags.Null) {
      return true;
    }

    // 检查联合类型
    if (type.isUnion()) {
      return type.types.some(t => this.isPossiblyUndefined(t));
    }

    // 检查可选属性
    const symbol = type.getSymbol();
    if (symbol && symbol.flags & ts.SymbolFlags.Property) {
      const declarations = symbol.getDeclarations();
      if (declarations) {
        return declarations.some(decl =>
          ts.isPropertyDeclaration(decl) && decl.questionToken !== undefined
        );
      }
    }

    return false;
  }

  /**
   * 建议修复类型
   */
  private suggestFix(node: ts.PropertyAccessExpression | ts.ElementAccessExpression, type: ts.Type): FixType {
    // 如果父节点是可选链，已经安全
    if (node.parent && ts.isPropertyAccessExpression(node.parent) &&
        node.parent.dotToken && node.parent.dotToken.kind === ts.SyntaxKind.QuestionDotToken) {
      return 'optional-chaining';
    }

    // 如果在条件表达式中，建议类型守卫
    if (this.isInConditional(node)) {
      return 'type-guard';
    }

    // 如果有合理的默认值，建议使用默认值
    if (this.hasReasonableDefaultValue(type)) {
      return 'default-value';
    }

    // 默认建议可选链
    return CONFIG.fixOptions.convertToOptionalChaining ? 'optional-chaining' : 'null-check';
  }

  /**
   * 检查节点是否在条件表达式中
   */
  private isInConditional(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent) {
      if (ts.isIfStatement(parent) ||
          ts.isWhileStatement(parent) ||
          ts.isConditionalExpression(parent)) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 检查是否有合理的默认值
   */
  private hasReasonableDefaultValue(type: ts.Type): boolean {
    // 字符串类型可以使用空字符串
    if (type.flags & ts.TypeFlags.String) {
      return true;
    }

    // 数字类型可以使用0
    if (type.flags & ts.TypeFlags.Number) {
      return true;
    }

    // 布尔类型可以使用false
    if (type.flags & ts.TypeFlags.Boolean) {
      return true;
    }

    // 数组类型可以使用空数组
    if (type.flags & ts.TypeFlags.Array) {
      return true;
    }

    return false;
  }

  /**
   * 计算修复置信度
   */
  private calculateConfidence(node: ts.Node, type: ts.Type): number {
    let confidence = 50; // 基础置信度

    // 如果类型明确包含undefined/null，增加置信度
    if (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) {
      confidence += 30;
    }

    // 如果是可选属性，增加置信度
    const symbol = type.getSymbol();
    if (symbol && symbol.flags & ts.SymbolFlags.Property) {
      const declarations = symbol.getDeclarations();
      if (declarations?.some(decl =>
        ts.isPropertyDeclaration(decl) && decl.questionToken !== undefined)) {
        confidence += 20;
      }
    }

    // 如果在安全的上下文中，降低置信度
    if (this.isInSafeContext(node)) {
      confidence -= 20;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * 检查是否在安全上下文中
   */
  private isInSafeContext(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent) {
      // 如果在typeof表达式中，是安全的
      if (ts.isTypeOfExpression(parent)) {
        return true;
      }

      // 如果在delete操作符中，是安全的
      if (ts.isDeleteExpression(parent)) {
        return true;
      }

      // 如果在void表达式中，是安全的
      if (ts.isVoidExpression(parent)) {
        return true;
      }

      parent = parent.parent;
    }
    return false;
  }

  /**
   * 生成修复
   */
  private generateFixes(sourceFile: ts.SourceFile, issues: OptionalAccessIssue[]): Fix[] {
    const fixes: Fix[] = [];

    // 按位置排序，从后往前修复以避免位置偏移
    const sortedIssues = issues.sort((a, b) => {
      const posA = sourceFile.getLineAndCharacterOfPosition(a.node.getStart()).line;
      const posB = sourceFile.getLineAndCharacterOfPosition(b.node.getStart()).line;
      return posB - posA;
    });

    for (const issue of sortedIssues) {
      const fix = this.createFix(sourceFile, issue);
      if (fix) {
        fixes.push(fix);
      }
    }

    return fixes;
  }

  /**
   * 创建单个修复
   */
  private createFix(sourceFile: ts.SourceFile, issue: OptionalAccessIssue): Fix | null {
    const { node, suggestion, confidence } = issue;

    switch (suggestion) {
      case 'optional-chaining':
        return this.createOptionalChainingFix(sourceFile, issue);

      case 'null-check':
        return this.createNullCheckFix(sourceFile, issue);

      case 'type-guard':
        return this.createTypeGuardFix(sourceFile, issue);

      case 'default-value':
        return this.createDefaultValueFix(sourceFile, issue);

      default:
        return null;
    }
  }

  /**
   * 创建可选链修复
   */
  private createOptionalChainingFix(sourceFile: ts.SourceFile, issue: OptionalAccessIssue): Fix {
    const { node, text } = issue;

    let fixed: string;
    if (ts.isPropertyAccessExpression(node)) {
      fixed = text.replace('.', '?.');
    } else if (ts.isElementAccessExpression(node)) {
      fixed = text.replace('[', '?.[');
    } else {
      fixed = text;
    }

    return {
      type: 'optional-chaining',
      line: issue.line,
      column: issue.column,
      original: text,
      fixed,
      description: '转换为可选链操作符',
      confidence: issue.confidence
    };
  }

  /**
   * 创建空值检查修复
   */
  private createNullCheckFix(sourceFile: ts.SourceFile, issue: OptionalAccessIssue): Fix {
    const { node, text, parent } = issue;

    // 生成条件检查
    const checkCondition = this.generateNullCheckCondition(node);
    const fullExpression = parent.getText();

    const fixed = `${checkCondition} ? ${fullExpression} : undefined`;

    return {
      type: 'null-check',
      line: issue.line,
      column: issue.column,
      original: fullExpression,
      fixed,
      description: '添加空值检查',
      confidence: issue.confidence
    };
  }

  /**
   * 创建类型守卫修复
   */
  private createTypeGuardFix(sourceFile: ts.SourceFile, issue: OptionalAccessIssue): Fix {
    const { node, text } = issue;

    const condition = this.generateTypeGuardCondition(node);
    const fixed = `${condition}`;

    return {
      type: 'type-guard',
      line: issue.line,
      column: issue.column,
      original: text,
      fixed,
      description: '添加类型守卫',
      confidence: issue.confidence
    };
  }

  /**
   * 创建默认值修复
   */
  private createDefaultValueFix(sourceFile: ts.SourceFile, issue: OptionalAccessIssue): Fix {
    const { node, text } = issue;

    const defaultValue = this.getDefaultValue(node);
    const fixed = text + ` ?? ${defaultValue}`;

    return {
      type: 'default-value',
      line: issue.line,
      column: issue.column,
      original: text,
      fixed,
      description: '添加默认值',
      confidence: issue.confidence
    };
  }

  /**
   * 生成空值检查条件
   */
  private generateNullCheckCondition(node: ts.Node): string {
    if (ts.isPropertyAccessExpression(node)) {
      return `${node.expression.getText()} != null`;
    } else if (ts.isElementAccessExpression(node)) {
      return `${node.expression.getText()} != null`;
    }
    return 'true';
  }

  /**
   * 生成类型守卫条件
   */
  private generateTypeGuardCondition(node: ts.Node): string {
    if (ts.isPropertyAccessExpression(node)) {
      return `${node.expression.getText()} != null`;
    } else if (ts.isElementAccessExpression(node)) {
      return `${node.expression.getText()} != null`;
    }
    return 'true';
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(node: ts.Node): string {
    const type = this.checker.getTypeAtLocation(node);

    if (type.flags & ts.TypeFlags.String) {
      return "''";
    }

    if (type.flags & ts.TypeFlags.Number) {
      return '0';
    }

    if (type.flags & ts.TypeFlags.Boolean) {
      return 'false';
    }

    if (type.flags & ts.TypeFlags.Array) {
      return '[]';
    }

    return 'undefined';
  }

  /**
   * 应用修复到内容
   */
  private applyFixes(content: string, fixes: Fix[]): string {
    let result = content;
    const lines = result.split('\n');

    // 按行号分组修复
    const fixesByLine = new Map<number, Fix[]>();
    for (const fix of fixes) {
      const lineNum = fix.line - 1; // 转换为0基索引
      if (!fixesByLine.has(lineNum)) {
        fixesByLine.set(lineNum, []);
      }
      fixesByLine.get(lineNum)!.push(fix);
    }

    // 应用修复（从后往前以避免位置偏移）
    const sortedLines = Array.from(fixesByLine.keys()).sort((a, b) => b - a);

    for (const lineNum of sortedLines) {
      const lineFixes = fixesByLine.get(lineNum)!;
      const originalLine = lines[lineNum];

      // 对同一行的多个修复，按列号排序
      lineFixes.sort((a, b) => b.column - a.column);

      let modifiedLine = originalLine;
      for (const fix of lineFixes) {
        modifiedLine = modifiedLine.replace(fix.original, fix.fixed);
      }

      lines[lineNum] = modifiedLine;
    }

    return lines.join('\n');
  }

  /**
   * 生成报告
   */
  private generateReport(): void {
    console.log('\n📊 修复报告');
    console.log('='.repeat(50));

    const totalFiles = this.fixes.length;
    const successfulFiles = this.fixes.filter(f => f.success).length;
    const totalFixes = this.fixes.reduce((sum, f) => sum + f.fixes.length, 0);

    console.log(`📁 处理文件数: ${totalFiles}`);
    console.log(`✅ 成功修复: ${successfulFiles}`);
    console.log(`❌ 失败文件: ${totalFiles - successfulFiles}`);
    console.log(`🔧 总修复数: ${totalFixes}`);
    console.log('');

    // 按修复类型统计
    const fixesByType = new Map<FixType, number>();
    for (const result of this.fixes) {
      for (const fix of result.fixes) {
        fixesByType.set(fix.type, (fixesByType.get(fix.type) || 0) + 1);
      }
    }

    console.log('📈 修复类型统计:');
    for (const [type, count] of fixesByType) {
      const typeNames = {
        'optional-chaining': '可选链操作符',
        'null-check': '空值检查',
        'type-guard': '类型守卫',
        'default-value': '默认值',
        'non-null-assertion': '非空断言',
        'property-access': '属性访问'
      };
      console.log(`   ${typeNames[type]}: ${count}`);
    }

    console.log('');

    // 显示失败的文件
    const failedFiles = this.fixes.filter(f => !f.success);
    if (failedFiles.length > 0) {
      console.log('❌ 失败的文件:');
      for (const file of failedFiles) {
        console.log(`   ${file.file}: ${file.error}`);
      }
      console.log('');
    }

    // 显示高置信度修复
    const highConfidenceFixes = this.fixes
      .flatMap(f => f.fixes)
      .filter(f => f.confidence >= 80)
      .slice(0, 10);

    if (highConfidenceFixes.length > 0) {
      console.log('🎯 高置信度修复 (前10个):');
      for (const fix of highConfidenceFixes) {
        console.log(`   ${fix.file}:${fix.line}:${fix.column}`);
        console.log(`      ${fix.original} → ${fix.fixed}`);
        console.log(`      ${fix.description} (置信度: ${fix.confidence}%)`);
        console.log('');
      }
    }

    console.log('✅ 修复完成！');
  }
}

// ==================== CLI接口 ====================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    convertToOptionalChaining: !args.includes('--no-optional-chaining'),
    addNullChecks: !args.includes('--no-null-checks'),
    useTypeGuards: !args.includes('--no-type-guards'),
    preserveComments: !args.includes('--no-preserve-comments'),
    createBackup: !args.includes('--no-backup')
  };

  const projectRoot = process.cwd();

  const fixer = new OptionalAccessFixer(projectRoot, options);

  try {
    const results = await fixer.run();

    // 设置退出码
    const hasErrors = results.some(r => !r.success);
    const hasFixes = results.some(r => r.fixes.length > 0);

    if (hasErrors) {
      process.exit(1);
    } else if (hasFixes) {
      process.exit(0);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(2);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

export { OptionalAccessFixer, FixResult, Fix };