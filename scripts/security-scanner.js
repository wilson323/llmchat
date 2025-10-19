#!/usr/bin/env node

/**
 * 自动化安全扫描系统
 *
 * 功能：
 * - 依赖漏洞扫描
 * - 代码安全分析
 * - 敏感信息检测
 * - 容器安全扫描
 * - 安全报告生成
 *
 * 使用方法：
 * node scripts/security-scanner.js [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

class SecurityScanner {
  constructor(options = {}) {
    this.options = {
      scanType: options.scanType || 'all', // all, dependencies, code, secrets, container
      severity: options.severity || 'moderate', // low, moderate, high, critical
      outputFormat: options.outputFormat || 'json', // json, markdown, console
      reportPath: options.reportPath || './security-reports',
      failOnHigh: options.failOnHigh !== false,
      fixAuto: options.fixAuto || false,
      ...options
    };

    this.results = {
      dependencies: { status: 'pending', vulnerabilities: [], score: 0 },
      code: { status: 'pending', issues: [], score: 0 },
      secrets: { status: 'pending', findings: [], score: 0 },
      container: { status: 'pending', issues: [], score: 0 }
    };

    this.startTime = Date.now();
  }

  async runAll() {
    console.log(chalk.blue.bold('🔒 自动化安全扫描系统'));
    console.log(chalk.blue(`扫描类型: ${this.options.scanType} | 严重级别: ${this.options.severity} | 开始时间: ${new Date().toISOString()}`));
    console.log('');

    try {
      // 确保报告目录存在
      if (!fs.existsSync(this.options.reportPath)) {
        fs.mkdirSync(this.options.reportPath, { recursive: true });
      }

      // 执行扫描
      if (this.options.scanType === 'all' || this.options.scanType === 'dependencies') {
        await this.scanDependencies();
      }

      if (this.options.scanType === 'all' || this.options.scanType === 'code') {
        await this.scanCodeSecurity();
      }

      if (this.options.scanType === 'all' || this.options.scanType === 'secrets') {
        await this.scanSecrets();
      }

      if (this.options.scanType === 'all' || this.options.scanType === 'container') {
        await this.scanContainerSecurity();
      }

      // 计算总体安全分数
      const overallScore = this.calculateSecurityScore();
      const overallStatus = this.getOverallSecurityStatus(overallScore);

      // 生成报告
      const report = this.generateSecurityReport(overallScore, overallStatus);

      // 输出结果
      this.outputResults(report);

      // 自动修复（如果启用）
      if (this.options.fixAuto) {
        await this.autoFix();
      }

      return {
        success: overallStatus !== 'failed',
        score: overallScore,
        status: overallStatus,
        results: this.results,
        report
      };

    } catch (error) {
      console.error(chalk.red('❌ 安全扫描执行失败:'), error.message);
      return {
        success: false,
        error: error.message,
        results: this.results
      };
    }
  }

  async scanDependencies() {
    console.log(chalk.yellow('📦 扫描依赖安全漏洞...'));

    try {
      const startTime = Date.now();

      // 运行 npm audit
      let auditOutput = '';
      let auditJson = '';

      try {
        auditOutput = execSync('pnpm audit --audit-level moderate', {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        auditJson = execSync('pnpm audit --audit-level moderate --json', {
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        auditOutput = error.stdout || error.stderr || '';
        auditJson = error.stdout || error.stderr || '';
      }

      const duration = Date.now() - startTime;
      const vulnerabilities = this.parseAuditResults(auditJson);

      // 计算分数
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
      const highVulns = vulnerabilities.filter(v => v.severity === 'high').length;
      const moderateVulns = vulnerabilities.filter(v => v.severity === 'moderate').length;
      const lowVulns = vulnerabilities.filter(v => v.severity === 'low').length;

      let score = 100;
      score -= criticalVulns * 50;
      score -= highVulns * 25;
      score -= moderateVulns * 10;
      score -= lowVulns * 5;
      score = Math.max(0, score);

      const status = criticalVulns > 0 || highVulns > 0 ? 'failed' :
                    moderateVulns > 0 ? 'warning' : 'passed';

      this.results.dependencies = {
        status,
        vulnerabilities,
        score,
        duration,
        output: auditOutput
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 依赖安全检查通过') :
        chalk.yellow(`⚠️  发现 ${vulnerabilities.length} 个安全漏洞`));

      if (status === 'failed' && this.options.failOnHigh) {
        throw new Error(`发现高危漏洞: ${criticalVulns} 个严重, ${highVulns} 个高危`);
      }

    } catch (error) {
      if (error.message.includes('发现高危漏洞')) {
        throw error;
      }

      console.log(chalk.red('❌ 依赖扫描失败:'), error.message);
      this.results.dependencies = {
        status: 'failed',
        vulnerabilities: [],
        score: 0,
        output: error.message
      };
    }
  }

  parseAuditResults(auditJson) {
    try {
      const audit = JSON.parse(auditJson);
      const vulnerabilities = [];

      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([name, vuln]) => {
          vulnerabilities.push({
            name,
            severity: vuln.severity,
            title: vuln.title,
            url: vuln.url,
            fixAvailable: vuln.fixAvailable,
            patchedVersions: vuln.patchedVersions
          });
        });
      }

      return vulnerabilities;
    } catch (error) {
      // JSON解析失败，尝试从文本中提取
      const vulnerabilities = [];
      const lines = auditJson.split('\n');

      lines.forEach(line => {
        if (line.includes('vulnerabilities')) {
          const match = line.match(/(\d+)\s+vulnerabilities/);
          if (match) {
            for (let i = 0; i < parseInt(match[1]); i++) {
              vulnerabilities.push({
                name: `vulnerability-${i}`,
                severity: 'moderate',
                title: 'Unknown vulnerability',
                url: '',
                fixAvailable: false
              });
            }
          }
        }
      });

      return vulnerabilities;
    }
  }

  async scanCodeSecurity() {
    console.log(chalk.yellow('🔍 扫描代码安全问题...'));

    try {
      const startTime = Date.now();
      const issues = [];

      // 尝试使用 Semgrep
      if (this.isCommandAvailable('semgrep')) {
        try {
          const semgrepOutput = execSync('semgrep --config=auto --json --quiet .', {
            encoding: 'utf8',
            stdio: 'pipe'
          });

          const semgrepResults = JSON.parse(semgrepOutput);
          semgrepResults.results.forEach(result => {
            issues.push({
              tool: 'semgrep',
              ruleId: result.check_id,
              message: result.message,
              file: result.path,
              line: result.start.line,
              severity: this.mapSemgrepSeverity(result.metadata.severity),
              cwe: result.metadata.cwe || []
            });
          });
        } catch (error) {
          // Semgrep 失败，继续使用其他方法
          console.log(chalk.yellow('⚠️  Semgrep 扫描失败，使用备用方法'));
        }
      }

      // 尝试使用 ESLint 安全规则
      if (this.isCommandAvailable('eslint')) {
        try {
          const eslintOutput = execSync('pnpm run lint --format=json .', {
            encoding: 'utf8',
            stdio: 'pipe'
          });

          const eslintResults = JSON.parse(eslintOutput);
          eslintResults.forEach(result => {
            if (result.messages) {
              result.messages.forEach(msg => {
                if (msg.ruleId && (
                  msg.ruleId.includes('security') ||
                  msg.ruleId.includes('no-eval') ||
                  msg.ruleId.includes('no-implied-eval') ||
                  msg.ruleId.includes('no-new-func') ||
                  msg.ruleId.includes('no-script-url')
                )) {
                  issues.push({
                    tool: 'eslint',
                    ruleId: msg.ruleId,
                    message: msg.message,
                    file: result.filePath,
                    line: msg.line,
                    column: msg.column,
                    severity: msg.severity === 2 ? 'error' : 'warning'
                  });
                }
              });
            }
          });
        } catch (error) {
          // ESLint 失败，继续
        }
      }

      const duration = Date.now() - startTime;

      // 计算分数
      const highIssues = issues.filter(i => i.severity === 'error' || i.severity === 'high').length;
      const mediumIssues = issues.filter(i => i.severity === 'warning' || i.severity === 'medium').length;
      const lowIssues = issues.filter(i => i.severity === 'info' || i.severity === 'low').length;

      let score = 100;
      score -= highIssues * 20;
      score -= mediumIssues * 10;
      score -= lowIssues * 5;
      score = Math.max(0, score);

      const status = highIssues > 0 ? 'failed' :
                    mediumIssues > 0 ? 'warning' : 'passed';

      this.results.code = {
        status,
        issues,
        score,
        duration
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 代码安全检查通过') :
        chalk.yellow(`⚠️  发现 ${issues.length} 个代码安全问题`));

    } catch (error) {
      console.log(chalk.red('❌ 代码安全扫描失败:'), error.message);
      this.results.code = {
        status: 'failed',
        issues: [],
        score: 0,
        output: error.message
      };
    }
  }

  async scanSecrets() {
    console.log(chalk.yellow('🔑 扫描敏感信息...'));

    try {
      const startTime = Date.now();
      const findings = [];

      // 尝试使用 Gitleaks
      if (this.isCommandAvailable('gitleaks')) {
        try {
          const gitleaksOutput = execSync('gitleaks detect --source=. --report-path=gitleaks-report.json --report-format=json --no-banner', {
            encoding: 'utf8',
            stdio: 'pipe'
          });

          if (fs.existsSync('gitleaks-report.json')) {
            const gitleaksResults = JSON.parse(fs.readFileSync('gitleaks-report.json', 'utf8'));
            gitleaksResults.forEach(finding => {
              findings.push({
                tool: 'gitleaks',
                rule: finding.rule,
                file: finding.file,
                line: finding.startLine,
                commit: finding.commit,
                author: finding.author,
                email: finding.email,
                date: finding.date,
                message: finding.message
              });
            });

            // 清理临时文件
            fs.unlinkSync('gitleaks-report.json');
          }
        } catch (error) {
          // Gitleaks 失败，使用正则表达式扫描
          console.log(chalk.yellow('⚠️  Gitleaks 扫描失败，使用正则表达式扫描'));
          await this.scanSecretsWithRegex(findings);
        }
      } else {
        // 使用正则表达式扫描
        await this.scanSecretsWithRegex(findings);
      }

      const duration = Date.now() - startTime;

      // 计算分数
      const highRiskFindings = findings.filter(f =>
        f.rule && (f.rule.includes('password') || f.rule.includes('secret') || f.rule.includes('key'))
      ).length;

      let score = 100;
      score -= highRiskFindings * 50;
      score -= (findings.length - highRiskFindings) * 25;
      score = Math.max(0, score);

      const status = highRiskFindings > 0 ? 'failed' :
                    findings.length > 0 ? 'warning' : 'passed';

      this.results.secrets = {
        status,
        findings,
        score,
        duration
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 敏感信息检查通过') :
        chalk.yellow(`⚠️  发现 ${findings.length} 个潜在敏感信息`));

      if (status === 'failed' && this.options.failOnHigh) {
        throw new Error(`发现高风险敏感信息: ${highRiskFindings} 个`);
      }

    } catch (error) {
      if (error.message.includes('发现高风险敏感信息')) {
        throw error;
      }

      console.log(chalk.red('❌ 敏感信息扫描失败:'), error.message);
      this.results.secrets = {
        status: 'failed',
        findings: [],
        score: 0,
        output: error.message
      };
    }
  }

  async scanSecretsWithRegex(findings) {
    const secretPatterns = [
      {
        name: 'API Key',
        pattern: /['\"]?(AKIA|sk_|api[_-]?key|apikey)['\"]?\s*[:=]\s*['\"]?([A-Za-z0-9+\/]{20,})['\"]?/gi,
        severity: 'high'
      },
      {
        name: 'Password',
        pattern: /['\"]?(password|passwd|pwd)['\"]?\s*[:=]\s*['\"]?([^'\"]{6,})['\"]?/gi,
        severity: 'high'
      },
      {
        name: 'JWT Token',
        pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
        severity: 'medium'
      },
      {
        name: 'Private Key',
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
        severity: 'high'
      },
      {
        name: 'Database URL',
        pattern: /['\"]?(database[_-]?url|db[_-]?url)['\"]?\s*[:=]\s*['\"]?([^'\"]{10,})['\"]?/gi,
        severity: 'high'
      }
    ];

    // 扫描文件
    const filesToScan = this.getFilesToScan();

    filesToScan.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        secretPatterns.forEach(pattern => {
          const matches = content.matchAll(pattern.pattern);
          for (const match of matches) {
            findings.push({
              tool: 'regex',
              rule: pattern.name,
              file: filePath,
              line: this.getLineNumber(content, match.index),
              match: match[0],
              severity: pattern.severity
            });
          }
        });
      } catch (error) {
        // 忽略读取错误
      }
    });
  }

  getFilesToScan() {
    const filesToScan = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml', '.env', '.config'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    const scanDir = (dir) => {
      try {
        const items = fs.readdirSync(dir);

        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            scanDir(fullPath);
          } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
            filesToScan.push(fullPath);
          }
        });
      } catch (error) {
        // 忽略目录读取错误
      }
    };

    scanDir('.');
    return filesToScan;
  }

  getLineNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  async scanContainerSecurity() {
    console.log(chalk.yellow('🐳 扫描容器安全...'));

    try {
      const startTime = Date.now();
      const issues = [];

      // 检查 Dockerfile
      if (fs.existsSync('Dockerfile')) {
        const dockerfileContent = fs.readFileSync('Dockerfile', 'utf8');

        // 检查安全问题
        if (dockerfileContent.includes('FROM:latest')) {
          issues.push({
            type: 'dockerfile',
            severity: 'medium',
            message: '使用 latest 标签可能导致不可预测的更新',
            file: 'Dockerfile'
          });
        }

        if (dockerfileContent.includes('--privileged')) {
          issues.push({
            type: 'dockerfile',
            severity: 'high',
            message: '使用 --privileged 权限存在安全风险',
            file: 'Dockerfile'
          });
        }

        if (!dockerfileContent.includes('USER ') && !dockerfileContent.includes('USER')) {
          issues.push({
            type: 'dockerfile',
            severity: 'medium',
            message: 'Docker 容器以 root 用户运行',
            file: 'Dockerfile'
          });
        }
      }

      // 检查 docker-compose.yml
      if (fs.existsSync('docker-compose.yml')) {
        const composeContent = fs.readFileSync('docker-compose.yml', 'utf8');

        if (composeContent.includes('privileged: true')) {
          issues.push({
            type: 'docker-compose',
            severity: 'high',
            message: 'Docker Compose 使用特权模式',
            file: 'docker-compose.yml'
          });
        }
      }

      const duration = Date.now() - startTime;

      // 计算分数
      const highIssues = issues.filter(i => i.severity === 'high').length;
      const mediumIssues = issues.filter(i => i.severity === 'medium').length;

      let score = 100;
      score -= highIssues * 30;
      score -= mediumIssues * 15;
      score = Math.max(0, score);

      const status = highIssues > 0 ? 'failed' :
                    mediumIssues > 0 ? 'warning' : 'passed';

      this.results.container = {
        status,
        issues,
        score,
        duration
      };

      console.log(status === 'passed' ?
        chalk.green('✅ 容器安全检查通过') :
        chalk.yellow(`⚠️  发现 ${issues.length} 个容器安全问题`));

    } catch (error) {
      console.log(chalk.red('❌ 容器安全扫描失败:'), error.message);
      this.results.container = {
        status: 'failed',
        issues: [],
        score: 0,
        output: error.message
      };
    }
  }

  isCommandAvailable(command) {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  mapSemgrepSeverity(severity) {
    const mapping = {
      'ERROR': 'high',
      'WARNING': 'medium',
      'INFO': 'low'
    };
    return mapping[severity] || 'medium';
  }

  calculateSecurityScore() {
    const weights = {
      dependencies: 0.4,
      code: 0.3,
      secrets: 0.2,
      container: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      const result = this.results[key];
      if (result.status !== 'pending') {
        totalScore += result.score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight * 100) / 100 : 0;
  }

  getOverallSecurityStatus(score) {
    if (score >= 90) {
      return 'passed';
    } else if (score >= 70) {
      return 'warning';
    } else {
      return 'failed';
    }
  }

  generateSecurityReport(overallScore, overallStatus) {
    const duration = Date.now() - this.startTime;

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        duration,
        scanType: this.options.scanType,
        severity: this.options.severity,
        overallScore,
        overallStatus
      },
      results: this.results,
      summary: {
        totalVulnerabilities: this.results.dependencies.vulnerabilities.length +
                           this.results.code.issues.length +
                           this.results.secrets.findings.length +
                           this.results.container.issues.length,
        highRiskIssues: this.countHighRiskIssues(),
        recommendations: this.generateSecurityRecommendations()
      }
    };
  }

  countHighRiskIssues() {
    let count = 0;

    count += this.results.dependencies.vulnerabilities.filter(v =>
      v.severity === 'critical' || v.severity === 'high'
    ).length;

    count += this.results.code.issues.filter(i =>
      i.severity === 'error' || i.severity === 'high'
    ).length;

    count += this.results.secrets.findings.filter(f =>
      f.severity === 'high'
    ).length;

    count += this.results.container.issues.filter(i =>
      i.severity === 'high'
    ).length;

    return count;
  }

  generateSecurityRecommendations() {
    const recommendations = [];

    // 依赖安全建议
    if (this.results.dependencies.vulnerabilities.length > 0) {
      const fixable = this.results.dependencies.vulnerabilities.filter(v => v.fixAvailable);
      if (fixable.length > 0) {
        recommendations.push({
          category: '依赖安全',
          priority: 'high',
          message: `修复 ${fixable.length} 个可修复的依赖漏洞`,
          action: '运行 pnpm audit --fix 自动修复依赖漏洞'
        });
      }
    }

    // 代码安全建议
    if (this.results.code.issues.length > 0) {
      recommendations.push({
        category: '代码安全',
        priority: 'medium',
        message: `修复 ${this.results.code.issues.length} 个代码安全问题`,
        action: '使用 Semgrep 或 ESLint 安全规则修复代码安全问题'
      });
    }

    // 敏感信息建议
    if (this.results.secrets.findings.length > 0) {
      recommendations.push({
        category: '敏感信息',
        priority: 'high',
        message: `移除或保护 ${this.results.secrets.findings.length} 个敏感信息`,
        action: '使用环境变量或密钥管理服务替代硬编码敏感信息'
      });
    }

    // 容器安全建议
    if (this.results.container.issues.length > 0) {
      recommendations.push({
        category: '容器安全',
        priority: 'medium',
        message: `修复 ${this.results.container.issues.length} 个容器安全问题`,
        action: '遵循 Docker 安全最佳实践，使用非 root 用户运行容器'
      });
    }

    return recommendations;
  }

  outputResults(report) {
    // 保存报告文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.options.reportPath, `security-report-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // 创建最新报告链接
    const latestReportFile = path.join(this.options.reportPath, 'latest-security-report.json');
    if (fs.existsSync(latestReportFile)) {
      fs.unlinkSync(latestReportFile);
    }
    fs.symlinkSync(path.basename(reportFile), latestReportFile);

    console.log(chalk.blue(`🔒 安全报告已保存: ${reportFile}`));

    // 控制台输出
    if (this.options.outputFormat === 'console') {
      this.outputToConsole(report);
    } else if (this.options.outputFormat === 'markdown') {
      this.outputToMarkdown(report);
    } else {
      console.log(JSON.stringify(report, null, 2));
    }
  }

  outputToConsole(report) {
    console.log('');
    console.log(chalk.blue.bold('🔒 安全扫描报告'));
    console.log(chalk.blue('='.repeat(50)));

    // 总体状态
    const statusColor = report.overallStatus === 'passed' ? chalk.green :
                      report.overallStatus === 'warning' ? chalk.yellow : chalk.red;
    const statusIcon = report.overallStatus === 'passed' ? '✅' :
                     report.overallStatus === 'warning' ? '⚠️' : '❌';

    console.log(statusColor(`${statusIcon} 总体状态: ${report.overallStatus.toUpperCase()}`));
    console.log(chalk.blue(`🛡️  安全分数: ${report.overallScore}/100`));
    console.log(chalk.blue(`⏱️  扫描时间: ${report.metadata.duration}ms`));
    console.log('');

    // 详细结果
    console.log(chalk.yellow('📋 详细结果:'));
    Object.entries(report.results).forEach(([key, result]) => {
      if (result.status !== 'pending') {
        const statusIcon = result.status === 'passed' ? '✅' :
                          result.status === 'warning' ? '⚠️' :
                          result.status === 'skipped' ? '⏭️' : '❌';

        console.log(`  ${statusIcon} ${key.charAt(0).toUpperCase() + key.slice(1)}: ${result.status.toUpperCase()}`);
        console.log(`    分数: ${result.score}/100`);

        if (result.vulnerabilities && result.vulnerabilities.length > 0) {
          console.log(`    漏洞: ${result.vulnerabilities.length}`);
        }

        if (result.issues && result.issues.length > 0) {
          console.log(`    问题: ${result.issues.length}`);
        }

        if (result.findings && result.findings.length > 0) {
          console.log(`    发现: ${result.findings.length}`);
        }

        console.log('');
      }
    });

    // 总结
    console.log(chalk.yellow('📊 安全总结:'));
    console.log(`  总问题数: ${report.summary.totalVulnerabilities}`);
    console.log(`  高风险问题: ${report.summary.highRiskIssues}`);
    console.log('');

    // 建议
    if (report.summary.recommendations.length > 0) {
      console.log(chalk.yellow('💡 安全建议:'));
      report.summary.recommendations.forEach((rec, index) => {
        const priorityColor = rec.priority === 'high' ? chalk.red :
                            rec.priority === 'medium' ? chalk.yellow : chalk.blue;
        console.log(`  ${index + 1}. ${priorityColor(rec.category)}: ${rec.message}`);
        console.log(`     建议: ${rec.action}`);
      });
      console.log('');
    }
  }

  outputToMarkdown(report) {
    const markdown = `# 安全扫描报告

## 📊 总体状态
- **状态**: ${report.overallStatus.toUpperCase()}
- **安全分数**: ${report.overallScore}/100
- **扫描时间**: ${report.metadata.duration}ms
- **扫描时间**: ${report.metadata.timestamp}

## 📋 详细结果

${Object.entries(report.results).map(([key, result]) => {
  if (result.status === 'pending') return '';

  return `
### ${key.charAt(0).toUpperCase() + key.slice(1)}
- **状态**: ${result.status.toUpperCase()}
- **分数**: ${result.score}/100
${result.vulnerabilities ? `- **漏洞**: ${result.vulnerabilities.length}` : ''}
${result.issues ? `- **问题**: ${result.issues.length}` : ''}
${result.findings ? `- **发现**: ${result.findings.length}` : ''}
`;
}).join('')}

## 📊 安全总结
- **总问题数**: ${report.summary.totalVulnerabilities}
- **高风险问题**: ${report.summary.highRiskIssues}

## 💡 安全建议

${report.summary.recommendations.map((rec, index) => `
${index + 1}. **${rec.category}** (${rec.priority}): ${rec.message}
   - 建议: ${rec.action}
`).join('')}
`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(this.options.reportPath, `security-report-${timestamp}.md`);
    fs.writeFileSync(reportFile, markdown);

    console.log(chalk.blue(`📊 Markdown安全报告已保存: ${reportFile}`));
    console.log(markdown);
  }

  async autoFix() {
    console.log(chalk.yellow('🔧 尝试自动修复安全问题...'));

    try {
      // 自动修复依赖漏洞
      if (this.results.dependencies.vulnerabilities.length > 0) {
        console.log(chalk.blue('修复依赖漏洞...'));
        try {
          execSync('pnpm audit --fix', { stdio: 'inherit' });
          console.log(chalk.green('✅ 依赖漏洞修复完成'));
        } catch (error) {
          console.log(chalk.yellow('⚠️  自动修复依赖漏洞失败'));
        }
      }

      // 自动修复 ESLint 问题
      if (this.results.code.issues.length > 0) {
        console.log(chalk.blue('修复代码风格问题...'));
        try {
          execSync('pnpm run lint:fix', { stdio: 'inherit' });
          console.log(chalk.green('✅ 代码风格问题修复完成'));
        } catch (error) {
          console.log(chalk.yellow('⚠️  自动修复代码风格问题失败'));
        }
      }

      console.log(chalk.green('🔧 自动修复完成'));

    } catch (error) {
      console.log(chalk.red('❌ 自动修复失败:'), error.message);
    }
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--scan-type':
        options.scanType = args[++i];
        break;
      case '--severity':
        options.severity = args[++i];
        break;
      case '--output-format':
        options.outputFormat = args[++i];
        break;
      case '--report-path':
        options.reportPath = args[++i];
        break;
      case '--no-fail-on-high':
        options.failOnHigh = false;
        break;
      case '--fix':
        options.fixAuto = true;
        break;
      case '--help':
      case '-h':
        console.log(`
自动化安全扫描系统

用法: node security-scanner.js [选项]

选项:
  --scan-type <type>      扫描类型: all, dependencies, code, secrets, container (默认: all)
  --severity <level>      严重级别: low, moderate, high, critical (默认: moderate)
  --output-format <format> 输出格式: json, markdown, console (默认: console)
  --report-path <path>     报告输出路径
  --no-fail-on-high        高风险问题不阻止流水线
  --fix                   自动修复可修复的问题
  --help, -h             显示帮助信息

示例:
  node security-scanner.js --scan-type all
  node security-scanner.js --severity high --fix
  node security-scanner.js --output-format markdown
        `);
        process.exit(0);
    }
  }

  // 运行安全扫描
  const scanner = new SecurityScanner(options);

  scanner.runAll()
    .then(result => {
      if (!result.success && options.failOnHigh) {
        console.log(chalk.red('\n❌ 安全扫描未通过'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ 安全扫描完成'));
        process.exit(0);
      }
    })
    .catch(error => {
      console.error(chalk.red('\n💥 安全扫描执行失败:'), error.message);
      process.exit(1);
    });
}

module.exports = SecurityScanner;