#!/usr/bin/env ts-node

/**
 * Type Safety Enhancement Script
 *
 * This script automatically enhances type safety by:
 * 1. Replacing common 'any' usages with proper types
 * 2. Adding missing type annotations
 * 3. Suggesting improvements for complex type patterns
 *
 * Usage: ts-node src/scripts/typeSafetyEnhancer.ts [--dry-run] [--fix]
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface TypeSafetyIssue {
  file: string;
  line: number;
  column: number;
  type: 'any_usage' | 'missing_type' | 'unsafe_assertion' | 'complex_type';
  description: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

interface EnhancementResult {
  issues: TypeSafetyIssue[];
  fixed: number;
  errors: string[];
}

class TypeSafetyEnhancer {
  private readonly program: ts.Program;
  private readonly checker: ts.TypeChecker;
  private issues: TypeSafetyIssue[] = [];
  private dryRun = true;

  constructor(configPath: string) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));

    this.program = ts.createProgram(
      parsedConfig.fileNames,
      parsedConfig.options,
    );
    this.checker = this.program.getTypeChecker();
  }

  /**
   * Analyze all source files for type safety issues
   */
  public analyze(options: { dryRun?: boolean } = {}): EnhancementResult {
    this.dryRun = options.dryRun !== false;
    this.issues = [];

    const sourceFiles = this.program.getSourceFiles()
      .filter(file => !file.isDeclarationFile && file.fileName.endsWith('.ts'));

    for (const sourceFile of sourceFiles) {
      this.analyzeSourceFile(sourceFile);
    }

    // Sort issues by severity and file
    this.issues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.file.localeCompare(b.file);
    });

    return {
      issues: this.issues,
      fixed: 0,
      errors: [],
    };
  }

  /**
   * Analyze a single source file
   */
  private analyzeSourceFile(sourceFile: ts.SourceFile): void {
    ts.forEachChild(sourceFile, (node) => {
      this.analyzeNode(node, sourceFile);
    });
  }

  /**
   * Analyze a TypeScript node for type safety issues
   */
  private analyzeNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Check for 'any' type usage
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      this.addIssue({
        file: sourceFile.fileName,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character,
        type: 'any_usage',
        description: 'Using "any" type reduces type safety',
        suggestion: this.suggestAnyReplacement(node, sourceFile),
        severity: 'warning',
        code: node.getText(),
      });
    }

    // Check for missing return type annotations
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
      if (!node.type) {
        this.addIssue({
          file: sourceFile.fileName,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character,
          type: 'missing_type',
          description: 'Function missing return type annotation',
          suggestion: this.suggestReturnType(node, sourceFile),
          severity: 'info',
          code: node.getText(),
        });
      }
    }

    // Check for unsafe type assertions
    if (node.kind === ts.SyntaxKind.AsExpression) {
      const asExpression = node as ts.AsExpression;
      if (asExpression.type.kind === ts.SyntaxKind.AnyKeyword) {
        this.addIssue({
          file: sourceFile.fileName,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          column: sourceFile.getLineAndCharacterOfPosition(node.getStart()).character,
          type: 'unsafe_assertion',
          description: 'Unsafe type assertion to "any"',
          suggestion: 'Replace with proper type or type guard',
          severity: 'error',
          code: node.getText(),
        });
      }
    }

    // Recursively analyze child nodes
    ts.forEachChild(node, (child) => this.analyzeNode(child, sourceFile));
  }

  /**
   * Suggest replacement for 'any' type usage
   */
  private suggestAnyReplacement(node: ts.Node, sourceFile: ts.SourceFile): string {
    const {parent} = node;

    if (!parent) {
      return 'Replace with specific type like string, number, or interface';
    }

    // Check if it's a function parameter
    if (ts.isParameter(parent) && parent.name.kind === ts.SyntaxKind.Identifier) {
      const paramName = parent.name.text;
      return `Replace 'any' with specific type for parameter '${paramName}'`;
    }

    // Check if it's a variable declaration
    if (ts.isVariableDeclaration(parent)) {
      const varName = parent.name.getText(sourceFile);
      return `Replace 'any' with specific type for variable '${varName}'`;
    }

    // Check if it's a function return type
    if (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isArrowFunction(parent)) {
      return 'Replace with specific return type like Promise<T> or specific interface';
    }

    // Check if it's in array/object context
    if (ts.isArrayTypeNode(parent?.parent) || ts.isTypeReferenceNode(parent?.parent)) {
      return 'Replace with specific type like Array<T> or interface';
    }

    return 'Replace with specific type based on usage context';
  }

  /**
   * Suggest return type for functions
   */
  private suggestReturnType(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
    // Try to infer the return type from the function body
    if (node.body) {
      // Simple heuristic: look for return statements
      const returnStatements = this.findReturnStatements(node.body);
      if (returnStatements.length > 0) {
        const returnTypes = returnStatements.map(stmt => {
          if (stmt.expression) {
            return this.inferExpressionType(stmt.expression);
          }
          return 'void';
        });

        const uniqueTypes = [...new Set(returnTypes)];
        if (uniqueTypes.length === 1) {
          return `Add explicit return type: ${uniqueTypes[0]}`;
        } else if (uniqueTypes.length > 1) {
          return `Add explicit return type (multiple possibilities detected): ${uniqueTypes.join(' | ')}`;
        }
      }
    }

    return 'Add explicit return type annotation (e.g., : void, : string, : Promise<T>)';
  }

  /**
   * Find all return statements in a function body
   */
  private findReturnStatements(node: ts.Node): ts.ReturnStatement[] {
    const returns: ts.ReturnStatement[] = [];

    function visit(n: ts.Node) {
      if (ts.isReturnStatement(n)) {
        returns.push(n);
      }
      ts.forEachChild(n, visit);
    }

    visit(node);
    return returns;
  }

  /**
   * Infer type of an expression
   */
  private inferExpressionType(expr: ts.Expression): string {
    const type = this.checker.getTypeAtLocation(expr);
    const typeString = this.checker.typeToString(type);

    if (typeString === 'any') {
      // Try to provide a better suggestion
      if (ts.isStringLiteral(expr)) {
        return 'string';
      } else if (ts.isNumericLiteral(expr)) {
        return 'number';
      } else if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) {
        return 'boolean';
      } else if (ts.isArrayLiteralExpression(expr)) {
        return `Array<${this.inferArrayType(expr)}>`;
      } else if (ts.isObjectLiteralExpression(expr)) {
        return '{ [key: string]: unknown }';
      }
    }

    return typeString;
  }

  /**
   * Infer array element type
   */
  private inferArrayType(arrayLiteral: ts.ArrayLiteralExpression): string {
    if (arrayLiteral.elements.length > 0) {
      const firstElement = arrayLiteral.elements[0];
      if (firstElement && ts.isExpression(firstElement)) {
        return this.inferExpressionType(firstElement);
      }
    }
    return 'unknown';
  }

  /**
   * Add an issue to the list
   */
  private addIssue(issue: TypeSafetyIssue): void {
    this.issues.push(issue);
  }

  /**
   * Generate a comprehensive report
   */
  public generateReport(): string {
    const report: string[] = [];

    report.push('# Type Safety Analysis Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Summary
    const summary = this.generateSummary();
    report.push('## Summary');
    report.push(`- Total Issues: ${summary.total}`);
    report.push(`- Errors: ${summary.errors}`);
    report.push(`- Warnings: ${summary.warnings}`);
    report.push(`- Info: ${summary.info}`);
    report.push('');

    // Issues by type
    const byType = this.groupIssuesByType();
    for (const [type, issues] of Object.entries(byType)) {
      if (issues.length > 0) {
        report.push(`## ${this.formatIssueType(type)} (${issues.length})`);

        for (const issue of issues) {
          report.push(`### ${issue.severity.toUpperCase()}: ${path.basename(issue.file)}:${issue.line}:${issue.column}`);
          report.push(`**Description:** ${issue.description}`);
          report.push(`**Suggestion:** ${issue.suggestion}`);
          report.push(`**Code:** \`${issue.code}\``);
          report.push('');
        }
      }
    }

    // Recommendations
    report.push('## Recommendations');
    report.push(this.generateRecommendations());
    report.push('');

    return report.join('\n');
  }

  /**
   * Generate summary statistics
   */
  public generateSummary() {
    return {
      total: this.issues.length,
      errors: this.issues.filter(i => i.severity === 'error').length,
      warnings: this.issues.filter(i => i.severity === 'warning').length,
      info: this.issues.filter(i => i.severity === 'info').length,
    };
  }

  /**
   * Group issues by type
   */
  private groupIssuesByType(): Record<string, TypeSafetyIssue[]> {
    const grouped: Record<string, TypeSafetyIssue[]> = {};

    for (const issue of this.issues) {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type]!.push(issue);
    }

    return grouped;
  }

  /**
   * Format issue type for display
   */
  private formatIssueType(type: string): string {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1),
    ).join(' ');
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(): string {
    const recommendations: string[] = [];

    const anyCount = this.issues.filter(i => i.type === 'any_usage').length;
    const missingTypeCount = this.issues.filter(i => i.type === 'missing_type').length;
    const unsafeAssertionCount = this.issues.filter(i => i.type === 'unsafe_assertion').length;

    if (anyCount > 0) {
      recommendations.push(`1. **Eliminate 'any' types** (${anyCount} issues found): Replace with specific types or use unknown with type guards`);
    }

    if (missingTypeCount > 0) {
      recommendations.push(`2. **Add explicit type annotations** (${missingTypeCount} issues found): Improve code documentation and catch type errors early`);
    }

    if (unsafeAssertionCount > 0) {
      recommendations.push(`3. **Fix unsafe type assertions** (${unsafeAssertionCount} issues found): Use type guards or proper type checking`);
    }

    recommendations.push('4. **Enable strict TypeScript mode**: Set strict: true in tsconfig.json');
    recommendations.push('5. **Use type guards**: Implement proper type checking for unknown data');
    recommendations.push('6. **Prefer interfaces over object literals**: Define clear contracts for data structures');

    return recommendations.join('\n');
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');

  console.log('🔍 Type Safety Enhancement Tool');
  console.log(`Mode: ${dryRun ? 'Dry Run' : 'Fix Mode'}`);
  console.log('');

  const configPath = path.join(process.cwd(), 'tsconfig.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ tsconfig.json not found');
    process.exit(1);
  }

  const enhancer = new TypeSafetyEnhancer(configPath);

  console.log('📊 Analyzing project...');
  const result = enhancer.analyze({ dryRun });

  console.log(`Found ${result.issues.length} type safety issues`);
  console.log('');

  // Display summary
  const summary = enhancer.generateSummary();
  console.log('📈 Summary:');
  console.log(`   Errors: ${summary.errors}`);
  console.log(`   Warnings: ${summary.warnings}`);
  console.log(`   Info: ${summary.info}`);
  console.log('');

  // Generate report
  const report = enhancer.generateReport();
  const reportPath = path.join(process.cwd(), 'type-safety-report.md');

  if (dryRun) {
    console.log('📝 Generating detailed report...');
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved to: ${reportPath}`);
  } else {
    console.log('🔧 Fix mode not implemented yet');
    console.log('📝 Generating detailed report instead...');
    fs.writeFileSync(reportPath, report);
    console.log(`✅ Report saved to: ${reportPath}`);
  }

  // Exit with error code if there are error-level issues
  if (summary.errors > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TypeSafetyEnhancer, TypeSafetyIssue, EnhancementResult };