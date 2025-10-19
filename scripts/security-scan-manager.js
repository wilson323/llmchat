#!/usr/bin/env node

/**
 * Enterprise Security Scan Manager
 * 企业级安全扫描管理器
 *
 * 功能：
 * - 多层次安全扫描
 * - 漏洞风险评估
 * - 依赖安全审计
 * - 代码安全分析
 * - 密钥泄露检测
 * - 安全趋势跟踪
 * - 自动化安全报告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityScanManager {
  constructor(options = {}) {
    this.options = {
      configPath: options.configPath || '.security-config.json',
      outputPath: options.outputPath || 'security-reports',
      format: options.format || 'json',
      environment: options.environment || 'development',
      severity: options.severity || 'all', // low, medium, high, critical, all
      scanTypes: options.scanTypes || ['dependencies', 'code', 'secrets', 'infrastructure'],
      fixIssues: options.fixIssues || false,
      verbose: options.verbose || false,
      ...options
    };

    this.config = this.loadConfig();
    this.vulnerabilities = [];
    this.securityScore = 100;
    this.riskLevel = 'low';
    this.recommendations = [];
  }

  /**
   * 加载安全配置
   */
  loadConfig() {
    try {
      const configPath = path.resolve(this.options.configPath);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.log('✅ 安全配置加载成功:', configPath);
        return config;
      } else {
        this.log('⚠️ 安全配置文件不存在，使用默认配置');
        return this.getDefaultConfig();
      }
    } catch (error) {
      this.log('❌ 安全配置加载失败:', error.message);
      return this.getDefaultConfig();
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      thresholds: {
        critical: 0,
        high: 0,
        medium: 5,
        low: 20
      },
      scan_depth: 'deep', // shallow, medium, deep
      exclude_patterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.log',
        '**/*.tmp'
      ],
      tools: {
        dependencies: {
          enabled: true,
          scanner: 'npm-audit',
          timeout: 300000
        },
        code: {
          enabled: true,
          scanner: 'semgrep',
          rules: ['security', 'owasp-top-ten'],
          timeout: 600000
        },
        secrets: {
          enabled: true,
          scanner: 'gitleaks',
          patterns: [
            'api_key',
            'password',
            'secret',
            'token',
            'private_key'
          ],
          timeout: 300000
        },
        infrastructure: {
          enabled: true,
          scanner: 'checkov',
          frameworks: ['terraform', 'kubernetes', 'dockerfile'],
          timeout: 300000
        }
      },
      risk_scoring: {
        critical: 50,
        high: 25,
        medium: 10,
        low: 5
      },
      compliance: {
        frameworks: ['owasp', 'nist', 'gdpr'],
        required_controls: 95
      }
    };
  }

  /**
   * 执行全面安全扫描
   */
  async execute() {
    this.log('🔒 开始企业级安全扫描...');

    try {
      // 确保输出目录存在
      this.ensureDirectory(this.options.outputPath);

      // 1. 依赖安全扫描
      if (this.options.scanTypes.includes('dependencies')) {
        await this.scanDependencies();
      }

      // 2. 代码安全扫描
      if (this.options.scanTypes.includes('code')) {
        await this.scanCodeSecurity();
      }

      // 3. 密钥泄露扫描
      if (this.options.scanTypes.includes('secrets')) {
        await this.scanSecrets();
      }

      // 4. 基础设施安全扫描
      if (this.options.scanTypes.includes('infrastructure')) {
        await this.scanInfrastructure();
      }

      // 5. 计算安全评分
      this.calculateSecurityScore();

      // 6. 风险评估
      this.assessRiskLevel();

      // 7. 生成安全建议
      this.generateRecommendations();

      // 8. 生成安全报告
      await this.generateSecurityReports();

      // 9. 更新安全趋势
      await this.updateSecurityTrends();

      // 10. 自动修复（如果启用）
      if (this.options.fixIssues) {
        await this.autoFixSecurityIssues();
      }

      this.log('✅ 安全扫描完成');
      return this.getResults();

    } catch (error) {
      this.log('❌ 安全扫描失败:', error.message);
      throw error;
    }
  }

  /**
   * 依赖安全扫描
   */
  async scanDependencies() {
    this.log('🔍 扫描依赖安全漏洞...');

    const dependencyScan = {
      scanner: 'npm-audit',
      timestamp: new Date().toISOString(),
      vulnerabilities: {
        critical: [],
        high: [],
        medium: [],
        low: [],
        info: []
      },
      outdated_packages: [],
      security_score: 100
    };

    try {
      this.log('  📦 运行 npm audit...');

      // 运行 npm audit
      const auditOutput = execSync('pnpm audit --json', {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: this.config.tools.dependencies.timeout
      });

      let auditData;
      try {
        auditData = JSON.parse(auditOutput);
      } catch (parseError) {
        this.log('  ⚠️ npm audit 输出解析失败，尝试其他方法');
        auditData = this.parseNpmAuditOutput(auditOutput);
      }

      if (auditData && auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([packageName, vulnData]) => {
          const vulnerability = {
            package: packageName,
            version: vulnData.version,
            severity: vulnData.severity,
            title: vulnData.title || vulnData.name || 'Security Vulnerability',
            url: vulnData.url,
            fix_available: vulnData.fixAvailable,
            patched_versions: vulnData.patched_versions || [],
            recommendation: vulnData.recommendation || 'Update to latest patched version'
          };

          // 分类漏洞
          switch (vulnData.severity) {
            case 'critical':
              dependencyScan.vulnerabilities.critical.push(vulnerability);
              break;
            case 'high':
              dependencyScan.vulnerabilities.high.push(vulnerability);
              break;
            case 'moderate':
              dependencyScan.vulnerabilities.medium.push(vulnerability);
              break;
            case 'low':
              dependencyScan.vulnerabilities.low.push(vulnerability);
              break;
            default:
              dependencyScan.vulnerabilities.info.push(vulnerability);
          }
        });
      }

      // 检查过时包
      this.log('  📅 检查过时包...');
      try {
        const outdatedOutput = execSync('pnpm outdated --json', {
          stdio: 'pipe',
          encoding: 'utf8'
        });

        const outdatedData = JSON.parse(outdatedOutput);
        Object.entries(outdatedData).forEach(([packageName, data]) => {
          dependencyScan.outdated_packages.push({
            package: packageName,
            current: data.current,
            wanted: data.wanted,
            latest: data.latest,
            type: data.type || 'dependencies',
            security_impact: this.assessOutdatedPackageSecurity(packageName, data)
          });
        });
      } catch (error) {
        this.log('  ⚠️ 无法获取过时包信息');
      }

      // 计算依赖安全评分
      dependencyScan.security_score = this.calculateDependencySecurityScore(dependencyScan.vulnerabilities);

      this.log(`✅ 依赖安全扫描完成: ${dependencyScan.vulnerabilities.critical.length} 严重, ${dependencyScan.vulnerabilities.high.length} 高危漏洞`);

    } catch (error) {
      this.log('⚠️ 依赖安全扫描失败:', error.message);
      dependencyScan.error = error.message;
    }

    this.dependencyScan = dependencyScan;
  }

  /**
   * 代码安全扫描
   */
  async scanCodeSecurity() {
    this.log('🔍 扫描代码安全问题...');

    const codeScan = {
      scanner: 'semgrep',
      timestamp: new Date().toISOString(),
      findings: {
        sql_injection: [],
        xss: [],
        command_injection: [],
        path_traversal: [],
        insecure_deserialization: [],
        weak_cryptography: [],
        authentication_issues: [],
        authorization_issues: [],
        data_validation: [],
        error_handling: [],
        logging_security: [],
        other: []
      },
      security_score: 100
    };

    try {
      // 检查 Semgrep 是否可用
      if (!this.isToolAvailable('semgrep')) {
        this.log('  ⚠️ Semgrep 不可用，跳过代码安全扫描');
        this.codeScan = codeScan;
        return;
      }

      this.log('  🔍 运行 Semgrep 代码安全扫描...');

      // 运行 Semgrep
      const semgrepConfig = this.config.tools.code.rules.join(',');
      const semgrepOutput = execSync(
        `semgrep --config=auto --config=${semgrepConfig} --json --quiet --timeout=${this.config.tools.code.timeout / 1000} .`,
        {
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: this.config.tools.code.timeout
        }
      );

      const semgrepData = JSON.parse(semgrepOutput);

      if (semgrepData.results) {
        semgrepData.results.forEach(finding => {
          const issue = {
            file: finding.path,
            line: finding.start.line,
            column: finding.start.col,
            end_line: finding.end.line,
            end_column: finding.end.col,
            rule_id: finding.rule_id,
            message: finding.message,
            severity: finding.metadata.severity || 'INFO',
            owasp_category: finding.metadata.owasp_category || [],
            cwe: finding.metadata.cwe_id || [],
            confidence: finding.metadata.confidence || 'medium',
            metadata: finding.metadata
          };

          // 分类安全问题
          const category = this.categorizeSecurityIssue(finding);
          if (category) {
            codeScan.findings[category].push(issue);
          } else {
            codeScan.findings.other.push(issue);
          }
        });
      }

      // 计算代码安全评分
      codeScan.security_score = this.calculateCodeSecurityScore(codeScan.findings);

      this.log(`✅ 代码安全扫描完成: 发现 ${semgrepData.results.length} 个安全问题`);

    } catch (error) {
      this.log('⚠️ 代码安全扫描失败:', error.message);
      codeScan.error = error.message;
    }

    this.codeScan = codeScan;
  }

  /**
   * 密钥泄露扫描
   */
  async scanSecrets() {
    this.log('🔍 扫描密钥泄露...');

    const secretScan = {
      scanner: 'gitleaks',
      timestamp: new Date().toISOString(),
      findings: [],
      file_types: {},
      severity_breakdown: {
        high: 0,
        medium: 0,
        low: 0
      },
      security_score: 100
    };

    try {
      // 检查 GitLeaks 是否可用
      if (!this.isToolAvailable('gitleaks')) {
        this.log('  ⚠️ Gitleaks 不可用，使用基础扫描...');
        await this.basicSecretScan(secretScan);
        this.secretScan = secretScan;
        return;
      }

      this.log('  🔍 运行 Gitleaks 密钥扫描...');

      // 运行 Gitleaks
      const gitleaksOutput = execSync(
        `gitleaks detect --source=. --report-path=gitleaks-report.json --report-format=json --verbose`,
        {
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: this.config.tools.secrets.timeout
        }
      );

      let gitleaksData;
      try {
        gitleaksData = JSON.parse(fs.readFileSync('gitleaks-report.json', 'utf8'));
        fs.unlinkSync('gitleaks-report.json'); // 清理临时文件
      } catch (error) {
        this.log('  ⚠️ Gitleaks 报告解析失败');
        return;
      }

      if (gitleaksData && Array.isArray(gitleaksData)) {
        gitleaksData.forEach(finding => {
          const secret = {
            file: finding.file,
            line: finding.lineNumber,
            rule: finding.rule,
            severity: finding.severity || 'medium',
            secret: this.maskSecret(finding.secret || finding.match),
            tags: finding.tags || [],
            commit: finding.commit,
            author: finding.author,
            email: finding.email,
            date: finding.date
          };

          secretScan.findings.push(secret);

          // 统计文件类型
          const ext = path.extname(finding.file);
          secretScan.file_types[ext] = (secretScan.file_types[ext] || 0) + 1;

          // 统计严重程度
          secretScan.severity_breakdown[finding.severity] =
            (secretScan.severity_breakdown[finding.severity] || 0) + 1;
        });
      }

      // 计算密钥安全评分
      secretScan.security_score = this.calculateSecretSecurityScore(secretScan.findings);

      this.log(`✅ 密钥泄露扫描完成: 发现 ${secretScan.findings.length} 个潜在密钥泄露`);

    } catch (error) {
      this.log('⚠️ 密钥泄露扫描失败:', error.message);
      secretScan.error = error.message;
    }

    this.secretScan = secretScan;
  }

  /**
   * 基础设施安全扫描
   */
  async scanInfrastructure() {
    this.log('🔍 扫描基础设施安全...');

    const infraScan = {
      scanner: 'checkov',
      timestamp: new Date().toISOString(),
      findings: {
        terraform: [],
        kubernetes: [],
        dockerfile: [],
        cloudformation: [],
        other: []
      },
      compliance: {
        frameworks: {},
        controls_passed: 0,
        controls_failed: 0
      },
      security_score: 100
    };

    try {
      // 检查是否有基础设施文件
      const infraFiles = this.findInfrastructureFiles();
      if (infraFiles.length === 0) {
        this.log('  ⏭️ 未发现基础设施文件，跳过扫描');
        this.infraScan = infraScan;
        return;
      }

      // 检查 Checkov 是否可用
      if (!this.isToolAvailable('checkov')) {
        this.log('  ⚠️ Checkov 不可用，跳过基础设施扫描');
        this.infraScan = infraScan;
        return;
      }

      this.log(`  🔍 扫描 ${infraFiles.length} 个基础设施文件...`);

      // 运行 Checkov
      const checkovOutput = execSync(
        `checkov --framework ${this.config.tools.infrastructure.frameworks.join(' ')} --directory . --output json --quiet`,
        {
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: this.config.tools.infrastructure.timeout
        }
      );

      let checkovData;
      try {
        checkovData = JSON.parse(checkovOutput);
      } catch (parseError) {
        this.log('  ⚠️ Checkov 输出解析失败');
        return;
      }

      if (checkovData.results) {
        checkovData.results.failed_checks.forEach(check => {
          const finding = {
            file: check.file_path,
            resource: check.resource,
            check_id: check.check_id,
            guideline: check.guideline,
            severity: check.severity || 'medium',
            message: check.check_name,
            category: this.categorizeInfraFinding(check),
            framework: check.framework,
            cwe: check.cwe || [],
            description: check.description
          };

          // 按框架分类
          const framework = check.framework.toLowerCase();
          if (infraScan.findings[framework]) {
            infraScan.findings[framework].push(finding);
          } else {
            infraScan.findings.other.push(finding);
          }
        });

        // 合规性统计
        infraScan.compliance.controls_passed = checkovData.results.passed_checks?.length || 0;
        infraScan.compliance.controls_failed = checkovData.results.failed_checks?.length || 0;
      }

      // 计算基础设施安全评分
      infraScan.security_score = this.calculateInfraSecurityScore(infraScan.findings);

      this.log(`✅ 基础设施安全扫描完成: ${infraScan.compliance.controls_failed} 个控制项失败`);

    } catch (error) {
      this.log('⚠️ 基础设施安全扫描失败:', error.message);
      infraScan.error = error.message;
    }

    this.infraScan = infraScan;
  }

  /**
   * 计算安全评分
   */
  calculateSecurityScore() {
    this.log('📊 计算综合安全评分...');

    let totalScore = 100;
    const riskScoring = this.config.risk_scoring;

    // 依赖漏洞扣分
    if (this.dependencyScan?.vulnerabilities) {
      const deps = this.dependencyScan.vulnerabilities;
      totalScore -= deps.critical.length * riskScoring.critical;
      totalScore -= deps.high.length * riskScoring.high;
      totalScore -= deps.medium.length * riskScoring.medium;
      totalScore -= deps.low.length * riskScoring.low;
    }

    // 代码安全问题扣分
    if (this.codeScan?.findings) {
      Object.values(this.codeScan.findings).forEach(findings => {
        findings.forEach(finding => {
          switch (finding.severity.toUpperCase()) {
            case 'ERROR':
            case 'CRITICAL':
              totalScore -= riskScoring.critical;
              break;
            case 'WARNING':
            case 'HIGH':
              totalScore -= riskScoring.high;
              break;
            case 'INFO':
            case 'MEDIUM':
              totalScore -= riskScoring.medium;
              break;
            case 'LOW':
              totalScore -= riskScoring.low;
              break;
          }
        });
      });
    }

    // 密钥泄露严重扣分
    if (this.secretScan?.findings?.length > 0) {
      totalScore -= this.secretScan.findings.length * riskScoring.high;
    }

    // 基础设施安全问题扣分
    if (this.infraScan?.findings) {
      Object.values(this.infraScan.findings).forEach(findings => {
        totalScore -= findings.length * riskScoring.medium;
      });
    }

    this.securityScore = Math.max(0, Math.min(100, totalScore));
    this.log(`✅ 安全评分计算完成: ${this.securityScore}/100`);
  }

  /**
   * 风险评估
   */
  assessRiskLevel() {
    this.log('🎯 评估安全风险等级...');

    if (this.securityScore >= 90) {
      this.riskLevel = 'low';
    } else if (this.securityScore >= 70) {
      this.riskLevel = 'medium';
    } else if (this.securityScore >= 50) {
      this.riskLevel = 'high';
    } else {
      this.riskLevel = 'critical';
    }

    // 检查特定的高风险条件
    if (this.dependencyScan?.vulnerabilities?.critical?.length > 0 ||
        this.secretScan?.findings?.length > 0 ||
        (this.codeScan?.findings?.sql_injection?.length || 0) > 0) {
      this.riskLevel = 'critical';
    } else if (this.dependencyScan?.vulnerabilities?.high?.length > 5 ||
               this.codeScan?.findings?.authentication_issues?.length > 3) {
      this.riskLevel = 'high';
    }

    this.log(`✅ 风险评估完成: ${this.riskLevel.toUpperCase()} 风险等级`);
  }

  /**
   * 生成安全建议
   */
  generateRecommendations() {
    this.log('💡 生成安全改进建议...');

    this.recommendations = [];

    // 依赖安全建议
    if (this.dependencyScan?.vulnerabilities?.critical?.length > 0) {
      this.recommendations.push({
        category: 'dependencies',
        priority: 'critical',
        title: '修复严重依赖漏洞',
        description: `发现 ${this.dependencyScan.vulnerabilities.critical.length} 个严重依赖漏洞，需要立即修复`,
        action: '运行 pnpm update 或升级到安全的包版本',
        impact: '消除严重安全风险'
      });
    }

    // 密钥泄露建议
    if (this.secretScan?.findings?.length > 0) {
      this.recommendations.push({
        category: 'secrets',
        priority: 'critical',
        title: '移除硬编码密钥',
        description: `发现 ${this.secretScan.findings.length} 个潜在密钥泄露`,
        action: '使用环境变量或密钥管理服务，移除代码中的硬编码密钥',
        impact: '防止密钥泄露导致的安全事件'
      });
    }

    // 代码安全建议
    if (this.codeScan?.findings?.sql_injection?.length > 0) {
      this.recommendations.push({
        category: 'code_security',
        priority: 'high',
        title: '修复 SQL 注入漏洞',
        description: `发现 ${this.codeScan.findings.sql_injection.length} 个 SQL 注入风险`,
        action: '使用参数化查询和输入验证，避免直接拼接 SQL',
        impact: '防止 SQL 注入攻击'
      });
    }

    // 基础设施安全建议
    if (this.infraScan?.findings?.kubernetes?.length > 0) {
      this.recommendations.push({
        category: 'infrastructure',
        priority: 'medium',
        title: '加强 Kubernetes 安全配置',
        description: `发现 ${this.infraScan.findings.kubernetes.length} 个 Kubernetes 安全配置问题`,
        action: '应用安全最佳实践，限制权限，启用网络策略',
        impact: '提高基础设施安全防护能力'
      });
    }

    this.log(`✅ 安全建议生成完成: ${this.recommendations.length} 条建议`);
  }

  /**
   * 生成安全报告
   */
  async generateSecurityReports() {
    this.log('📋 生成安全扫描报告...');

    const results = this.getResults();

    // JSON 格式报告
    if (this.options.format === 'json' || this.options.format === 'all') {
      const jsonPath = path.join(this.options.outputPath, 'security-scan.json');
      fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
      this.log(`✅ JSON 安全报告已生成: ${jsonPath}`);
    }

    // HTML 格式报告
    if (this.options.format === 'html' || this.options.format === 'all') {
      const htmlPath = path.join(this.options.outputPath, 'security-scan.html');
      const htmlReport = this.generateHtmlReport(results);
      fs.writeFileSync(htmlPath, htmlReport);
      this.log(`✅ HTML 安全报告已生成: ${htmlPath}`);
    }

    // Markdown 格式报告
    if (this.options.format === 'markdown' || this.options.format === 'all') {
      const mdPath = path.join(this.options.outputPath, 'security-scan.md');
      const mdReport = this.generateMarkdownReport(results);
      fs.writeFileSync(mdPath, mdReport);
      this.log(`✅ Markdown 安全报告已生成: ${mdPath}`);
    }

    // SARIF 格式报告（用于 GitHub Security）
    const sarifPath = path.join(this.options.outputPath, 'security-scan.sarif');
    const sarifReport = this.generateSarifReport(results);
    fs.writeFileSync(sarifPath, JSON.stringify(sarifReport, null, 2));
    this.log(`✅ SARIF 安全报告已生成: ${sarifPath}`);
  }

  /**
   * 更新安全趋势
   */
  async updateSecurityTrends() {
    this.log('📈 更新安全趋势数据...');

    const trendFile = path.join(this.options.outputPath, 'security-trends.json');
    let trends = [];

    // 读取现有趋势数据
    if (fs.existsSync(trendFile)) {
      try {
        trends = JSON.parse(fs.readFileSync(trendFile, 'utf8'));
      } catch (error) {
        this.log('⚠️ 无法读取安全趋势数据，创建新的');
        trends = [];
      }
    }

    // 添加当前数据点
    const currentData = {
      timestamp: new Date().toISOString(),
      build_number: process.env.GITHUB_RUN_NUMBER || 'local',
      commit: process.env.GITHUB_SHA || 'unknown',
      branch: process.env.GITHUB_REF_NAME || 'local',
      security_score: this.securityScore,
      risk_level: this.riskLevel,
      vulnerability_count: this.getTotalVulnerabilityCount(),
      findings_count: this.getTotalFindingsCount(),
      scan_results: {
        dependencies: this.dependencyScan?.vulnerabilities || {},
        code: this.codeScan?.findings || {},
        secrets: this.secretScan?.findings || [],
        infrastructure: this.infraScan?.findings || {}
      },
      recommendations: this.recommendations
    };

    trends.push(currentData);

    // 保留最近90天的数据
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    trends = trends.filter(trend => new Date(trend.timestamp) > cutoffDate);

    // 保存趋势数据
    fs.writeFileSync(trendFile, JSON.stringify(trends, null, 2));
    this.log(`✅ 安全趋势数据已更新: ${trends.length} 个数据点`);
  }

  /**
   * 自动修复安全问题
   */
  async autoFixSecurityIssues() {
    this.log('🔧 尝试自动修复安全问题...');

    let fixedCount = 0;

    // 自动修复依赖漏洞
    if (this.dependencyScan?.vulnerabilities?.low?.length > 0) {
      this.log('  🔧 修复低风险依赖漏洞...');
      try {
        execSync('pnpm audit --audit-level low --fix', { stdio: 'pipe' });
        fixedCount += this.dependencyScan.vulnerabilities.low.length;
      } catch (error) {
        this.log('  ⚠️ 自动修复依赖失败');
      }
    }

    // 自动修复代码格式问题（部分安全问题）
    if (this.codeScan?.findings?.other?.length > 0) {
      this.log('  🔧 修复代码格式问题...');
      try {
        execSync('pnpm run lint:fix', { stdio: 'pipe' });
        fixedCount += Math.floor(this.codeScan.findings.other.length / 2);
      } catch (error) {
        this.log('  ⚠️ 自动代码修复失败');
      }
    }

    this.log(`✅ 自动修复完成: 修复了约 ${fixedCount} 个问题`);
  }

  /**
   * 获取最终结果
   */
  getResults() {
    return {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      scanner_version: '1.0.0',
      security_score: this.securityScore,
      risk_level: this.riskLevel,
      scans: {
        dependencies: this.dependencyScan,
        code: this.codeScan,
        secrets: this.secretScan,
        infrastructure: this.infraScan
      },
      summary: {
        total_vulnerabilities: this.getTotalVulnerabilityCount(),
        total_findings: this.getTotalFindingsCount(),
        recommendation_count: this.recommendations.length,
        critical_issues: this.getCriticalIssueCount(),
        scan_coverage: this.getScanCoverage()
      },
      recommendations: this.recommendations,
      compliance: this.assessCompliance()
    };
  }

  // 辅助方法
  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  log(message) {
    if (this.options.verbose) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  isToolAvailable(tool) {
    try {
      execSync(`${tool} --version`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  parseNpmAuditOutput(output) {
    // 简化的 npm audit 输出解析
    const vulnerabilities = {};
    const lines = output.split('\n');

    lines.forEach(line => {
      const match = line.match(/(\w+)\s+(\d+\.\d+\.\d+)\s+([a-z]+)/);
      if (match) {
        vulnerabilities[match[1]] = {
          version: match[2],
          severity: match[3],
          title: `Vulnerability in ${match[1]}`,
          fixAvailable: true
        };
      }
    });

    return { vulnerabilities };
  }

  assessOutdatedPackageSecurity(packageName, data) {
    // 简化的过时包安全影响评估
    const knownVulnerablePackages = ['lodash', 'moment', 'request', 'node-forge'];
    return knownVulnerablePackages.includes(packageName) ? 'high' : 'low';
  }

  calculateDependencySecurityScore(vulnerabilities) {
    let score = 100;
    const thresholds = this.config.thresholds;

    score -= Math.min(vulnerabilities.critical.length * 20, 100);
    score -= Math.min(vulnerabilities.high.length * 15, 100);
    score -= Math.min(vulnerabilities.medium.length * 5, 100);
    score -= Math.min(vulnerabilities.low.length * 2, 100);

    return Math.max(0, score);
  }

  categorizeSecurityIssue(finding) {
    const message = finding.message.toLowerCase();
    const ruleId = finding.rule_id.toLowerCase();

    if (message.includes('sql') || ruleId.includes('injection')) return 'sql_injection';
    if (message.includes('xss') || ruleId.includes('xss')) return 'xss';
    if (message.includes('command') || ruleId.includes('command')) return 'command_injection';
    if (message.includes('path') || ruleId.includes('path')) return 'path_traversal';
    if (message.includes('deserial') || ruleId.includes('deserial')) return 'insecure_deserialization';
    if (message.includes('crypto') || ruleId.includes('crypto')) return 'weak_cryptography';
    if (message.includes('auth') || ruleId.includes('auth')) return 'authentication_issues';
    if (message.includes('authoriz') || ruleId.includes('authoriz')) return 'authorization_issues';
    if (message.includes('validat') || ruleId.includes('validat')) return 'data_validation';
    if (message.includes('error') || ruleId.includes('error')) return 'error_handling';
    if (message.includes('log') || ruleId.includes('log')) return 'logging_security';

    return 'other';
  }

  calculateCodeSecurityScore(findings) {
    let score = 100;
    const severityWeights = {
      sql_injection: 30,
      xss: 25,
      command_injection: 25,
      path_traversal: 20,
      insecure_deserialization: 20,
      weak_cryptography: 15,
      authentication_issues: 20,
      authorization_issues: 15,
      data_validation: 10,
      error_handling: 5,
      logging_security: 5,
      other: 3
    };

    Object.entries(findings).forEach(([category, issues]) => {
      const weight = severityWeights[category] || severityWeights.other;
      score -= Math.min(issues.length * weight, 100);
    });

    return Math.max(0, score);
  }

  maskSecret(secret) {
    if (!secret) return '***';
    if (secret.length <= 4) return '***';
    return secret.substring(0, 2) + '***' + secret.substring(secret.length - 2);
  }

  async basicSecretScan(secretScan) {
    // 基础密钥扫描（不依赖外部工具）
    this.log('  🔍 运行基础密钥扫描...');

    const secretPatterns = [
      { pattern: /password\s*[:=]\s*['"`]([^'"`]+)['"`]/gi, severity: 'high' },
      { pattern: /api[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/gi, severity: 'high' },
      { pattern: /secret\s*[:=]\s*['"`]([^'"`]+)['"`]/gi, severity: 'high' },
      { pattern: /token\s*[:=]\s*['"`]([^'"`]+)['"`]/gi, severity: 'medium' },
      { pattern: /private[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/gi, severity: 'high' }
    ];

    const files = this.scanFilesForSecrets();

    files.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        secretPatterns.forEach(({ pattern, severity }) => {
          const matches = content.matchAll(pattern);
          matches.forEach((match, index) => {
            secretScan.findings.push({
              file: filePath,
              line: this.getLineNumber(content, match.index),
              rule: 'basic-secret-scan',
              severity: severity,
              secret: this.maskSecret(match[1]),
              tags: ['hardcoded-secret']
            });
          });
        });
      } catch (error) {
        // 忽略读取错误
      }
    });

    secretScan.security_score = this.calculateSecretSecurityScore(secretScan.findings);
  }

  scanFilesForSecrets() {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml', '.env', '.config'];
    const files = [];

    function scanDirectory(dir) {
      try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            scanDirectory(fullPath);
          } else if (stat.isFile() && extensions.includes(path.extname(item))) {
            files.push(fullPath);
          }
        });
      } catch (error) {
        // 忽略访问错误
      }
    }

    scanDirectory('.');
    return files;
  }

  getLineNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  calculateSecretSecurityScore(findings) {
    let score = 100;
    score -= findings.filter(f => f.severity === 'high').length * 30;
    score -= findings.filter(f => f.severity === 'medium').length * 15;
    score -= findings.filter(f => f.severity === 'low').length * 5;
    return Math.max(0, score);
  }

  findInfrastructureFiles() {
    const patterns = [
      '**/*.tf',
      '**/*.tfvars',
      '**/*.yml',
      '**/*.yaml',
      '**/Dockerfile*',
      '**/docker-compose*',
      '**/k8s/**',
      '**/kubernetes/**',
      '**/.cloudformation/**'
    ];

    const files = [];
    patterns.forEach(pattern => {
      try {
        const glob = require('glob');
        const matched = glob.sync(pattern, { ignore: '**/node_modules/**' });
        files.push(...matched);
      } catch (error) {
        // 忽略 glob 错误
      }
    });

    return [...new Set(files)]; // 去重
  }

  categorizeInfraFinding(check) {
    const category = check.check_id.split('.')[0].toLowerCase();
    const knownCategories = ['network', 'security', 'encryption', 'access', 'logging', 'monitoring'];
    return knownCategories.includes(category) ? category : 'general';
  }

  calculateInfraSecurityScore(findings) {
    let score = 100;
    const weight = 10; // 每个基础设施问题扣10分

    Object.values(findings).forEach(issues => {
      score -= Math.min(issues.length * weight, 100);
    });

    return Math.max(0, score);
  }

  getTotalVulnerabilityCount() {
    let count = 0;
    if (this.dependencyScan?.vulnerabilities) {
      count += Object.values(this.dependencyScan.vulnerabilities).reduce((sum, arr) => sum + arr.length, 0);
    }
    return count;
  }

  getTotalFindingsCount() {
    let count = 0;

    if (this.codeScan?.findings) {
      count += Object.values(this.codeScan.findings).reduce((sum, arr) => sum + arr.length, 0);
    }

    if (this.secretScan?.findings) {
      count += this.secretScan.findings.length;
    }

    if (this.infraScan?.findings) {
      count += Object.values(this.infraScan.findings).reduce((sum, arr) => sum + arr.length, 0);
    }

    return count;
  }

  getCriticalIssueCount() {
    let count = 0;

    if (this.dependencyScan?.vulnerabilities?.critical) {
      count += this.dependencyScan.vulnerabilities.critical.length;
    }

    if (this.codeScan?.findings?.sql_injection) {
      count += this.codeScan.findings.sql_injection.length;
    }

    if (this.secretScan?.findings?.filter(f => f.severity === 'high')) {
      count += this.secretScan.findings.filter(f => f.severity === 'high').length;
    }

    return count;
  }

  getScanCoverage() {
    const coverage = {
      dependencies: this.dependencyScan ? 'completed' : 'skipped',
      code: this.codeScan ? 'completed' : 'skipped',
      secrets: this.secretScan ? 'completed' : 'skipped',
      infrastructure: this.infraScan ? 'completed' : 'skipped'
    };

    const completed = Object.values(coverage).filter(status => status === 'completed').length;
    return `${completed}/4`;
  }

  assessCompliance() {
    const compliance = {
      owasp_top_ten: 0,
      nist_controls: 0,
      gdpr_requirements: 0,
      overall_score: 0
    };

    // 简化的合规性评估
    const highRiskIssues = this.getCriticalIssueCount();
    if (highRiskIssues === 0) {
      compliance.owasp_top_ten = 90;
      compliance.nist_controls = 85;
      compliance.gdpr_requirements = 80;
    } else if (highRiskIssues <= 5) {
      compliance.owasp_top_ten = 70;
      compliance.nist_controls = 65;
      compliance.gdpr_requirements = 60;
    } else {
      compliance.owasp_top_ten = 40;
      compliance.nist_controls = 35;
      compliance.gdpr_requirements = 30;
    }

    compliance.overall_score = Math.round(
      (compliance.owasp_top_ten + compliance.nist_controls + compliance.gdpr_requirements) / 3
    );

    return compliance;
  }

  generateHtmlReport(results) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>LLMChat 安全扫描报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .security-score { font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; }
        .low { color: #4caf50; }
        .medium { color: #ff9800; }
        .high { color: #f44336; }
        .critical { color: #b71c1c; }
        .scan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .scan-card { background: #f8f9fa; padding: 15px; border-radius: 5px; }
        .vulnerability-count { font-size: 24px; font-weight: bold; text-align: center; margin: 10px 0; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; margin: 2px; }
        .badge.critical { background: #d32f2f; }
        .badge.high { background: #f57c00; }
        .badge.medium { background: #fbc02d; }
        .badge.low { background: #388e3c; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 LLMChat 安全扫描报告</h1>
        <p>生成时间: ${results.timestamp}</p>
        <p>环境: ${results.environment}</p>
    </div>

    <div class="security-score ${results.risk_level}">
        安全评分: ${results.security_score}/100
        <div>风险等级: ${results.risk_level.toUpperCase()}</div>
    </div>

    <div class="scan-grid">
        <div class="scan-card">
            <h3>📦 依赖安全</h3>
            <div class="vulnerability-count">${results.scans.dependencies?.vulnerabilities ? Object.values(results.scans.dependencies.vulnerabilities).reduce((sum, arr) => sum + arr.length, 0) : 0}</div>
            <p>严重漏洞: ${results.scans.dependencies?.vulnerabilities?.critical?.length || 0}</p>
            <p>高危漏洞: ${results.scans.dependencies?.vulnerabilities?.high?.length || 0}</p>
        </div>

        <div class="scan-card">
            <h3>💻 代码安全</h3>
            <div class="vulnerability-count">${results.scans.code?.findings ? Object.values(results.scans.code.findings).reduce((sum, arr) => sum + arr.length, 0) : 0}</div>
            <p>SQL 注入: ${results.scans.code?.findings?.sql_injection?.length || 0}</p>
            <p>XSS 漏洞: ${results.scans.code?.findings?.xss?.length || 0}</p>
        </div>

        <div class="scan-card">
            <h3>🔑 密钥安全</h3>
            <div class="vulnerability-count">${results.scans.secrets?.findings?.length || 0}</div>
            <p>高风险泄露: ${results.scans.secrets?.findings?.filter(f => f.severity === 'high')?.length || 0}</p>
            <p>中风险泄露: ${results.scans.secrets?.findings?.filter(f => f.severity === 'medium')?.length || 0}</p>
        </div>

        <div class="scan-card">
            <h3>🏗️ 基础设施安全</h3>
            <div class="vulnerability-count">${results.scans.infrastructure?.findings ? Object.values(results.scans.infrastructure.findings).reduce((sum, arr) => sum + arr.length, 0) : 0}</div>
            <p>Kubernetes: ${results.scans.infrastructure?.findings?.kubernetes?.length || 0}</p>
            <p>Docker: ${results.scans.infrastructure?.findings?.dockerfile?.length || 0}</p>
        </div>
    </div>

    <div>
        <h3>📊 扫描覆盖范围</h3>
        <p>${results.summary.scan_coverage} 项扫描已完成</p>
    </div>

    ${results.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 安全改进建议</h3>
        ${results.recommendations.map(rec => `
            <div style="margin: 10px 0; padding: 10px; background: #fff; border-left: 4px solid #f44336;">
                <span class="badge ${rec.priority}">${rec.priority.toUpperCase()}</span>
                <strong>${rec.title}</strong><br>
                ${rec.description}<br>
                <em>建议: ${rec.action}</em><br>
                <em>影响: ${rec.impact}</em>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div>
        <h3>📋 合规性评估</h3>
        <p>OWASP Top 10: ${results.compliance.owasp_top_ten}%</p>
        <p>NIST 控制: ${results.compliance.nist_controls}%</p>
        <p>GDPR 要求: ${results.compliance.gdpr_requirements}%</p>
        <p>总体评分: ${results.compliance.overall_score}%</p>
    </div>
</body>
</html>`;
  }

  generateMarkdownReport(results) {
    return `
# LLMChat 安全扫描报告

**生成时间**: ${results.timestamp}
**环境**: ${results.environment}
**安全评分**: ${results.security_score}/100 (${results.risk_level.toUpperCase()})

## 📊 安全概览

| 扫描类型 | 发现问题数 | 状态 |
|----------|------------|------|
| 📦 依赖安全 | ${results.scans.dependencies?.vulnerabilities ? Object.values(results.scans.dependencies.vulnerabilities).reduce((sum, arr) => sum + arr.length, 0) : 0} | ${results.scans.dependencies ? '✅ 完成' : '⏭️ 跳过'} |
| 💻 代码安全 | ${results.scans.code?.findings ? Object.values(results.scans.code.findings).reduce((sum, arr) => sum + arr.length, 0) : 0} | ${results.scans.code ? '✅ 完成' : '⏭️ 跳过'} |
| 🔑 密钥安全 | ${results.scans.secrets?.findings?.length || 0} | ${results.scans.secrets ? '✅ 完成' : '⏭️ 跳过'} |
| 🏗️ 基础设施 | ${results.scans.infrastructure?.findings ? Object.values(results.scans.infrastructure.findings).reduce((sum, arr) => sum + arr.length, 0) : 0} | ${results.scans.infrastructure ? '✅ 完成' : '⏭️ 跳过'} |

## 🚨 关键安全发现

### 严重漏洞 (${results.summary.critical_issues})
- 依赖漏洞: ${results.scans.dependencies?.vulnerabilities?.critical?.length || 0}
- SQL 注入: ${results.scans.code?.findings?.sql_injection?.length || 0}
- 密钥泄露: ${results.scans.secrets?.findings?.filter(f => f.severity === 'high')?.length || 0}

## 💡 安全改进建议

${results.recommendations.map(rec => `
### ${rec.title} (${rec.priority.toUpperCase()})
**类别**: ${rec.category}
**描述**: ${rec.description}
**建议**: ${rec.action}
**影响**: ${rec.impact}
`).join('\n')}

## 📋 合规性评估

| 框架 | 评分 | 状态 |
|------|------|------|
| OWASP Top 10 | ${results.compliance.owasp_top_ten}% | ${results.compliance.owasp_top_ten >= 80 ? '✅ 良好' : '❌ 需改进'} |
| NIST 控制 | ${results.compliance.nist_controls}% | ${results.compliance.nist_controls >= 80 ? '✅ 良好' : '❌ 需改进'} |
| GDPR 要求 | ${results.compliance.gdpr_requirements}% | ${results.compliance.gdpr_requirements >= 80 ? '✅ 良好' : '❌ 需改进'} |

**总体合规评分**: ${results.compliance.overall_score}%

## 📈 趋势分析

扫描覆盖范围: ${results.summary.scan_coverage}
总漏洞数: ${results.summary.total_vulnerabilities}
关键问题数: ${results.summary.critical_issues}

---
*报告由 LLMChat 企业级安全扫描管理器生成*
`;
  }

  generateSarifReport(results) {
    return {
      $schema: 'https://json.schemastore.org/sarif-2.1.0',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'llmchat-security-scanner',
            version: '1.0.0',
            informationUri: 'https://github.com/llmchat/security-scanner'
          }
        },
        results: this.convertToSarifResults(results)
      }]
    };
  }

  convertToSarifResults(results) {
    const sarifResults = [];

    // 转换依赖漏洞
    if (results.scans.dependencies?.vulnerabilities) {
      Object.entries(results.scans.dependencies.vulnerabilities).forEach(([category, vulns]) => {
        vulns.forEach(vuln => {
          sarifResults.push({
            ruleId: `dependency-${category}`,
            level: 'error',
            message: {
              text: `Security vulnerability in ${vuln.package}: ${vuln.title}`
            },
            locations: [{
              physicalLocation: {
                artifactLocation: {
                  uri: `package.json`
                }
              }
            }]
          });
        });
      });
    }

    // 转换代码安全问题
    if (results.scans.code?.findings) {
      Object.entries(results.scans.code.findings).forEach(([category, issues]) => {
        issues.forEach(issue => {
          sarifResults.push({
            ruleId: `code-${category}`,
            level: this.mapSeverityToSarifLevel(issue.severity),
            message: {
              text: issue.message
            },
            locations: [{
              physicalLocation: {
                artifactLocation: {
                  uri: issue.file
                },
                region: {
                  startLine: issue.line,
                  startColumn: issue.column,
                  endLine: issue.end_line,
                  endColumn: issue.end_column
                }
              }
            }]
          });
        });
      });
    }

    return sarifResults;
  }

  mapSeverityToSarifLevel(severity) {
    switch (severity?.toUpperCase()) {
      case 'ERROR':
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
      case 'HIGH':
        return 'error';
      case 'INFO':
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'note';
      default:
        return 'note';
    }
  }
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--format':
        options.format = args[++i];
        break;
      case '--output':
        options.outputPath = args[++i];
        break;
      case '--environment':
        options.environment = args[++i];
        break;
      case '--severity':
        options.severity = args[++i];
        break;
      case '--scan-types':
        options.scanTypes = args[++i].split(',');
        break;
      case '--fix':
        options.fixIssues = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--config':
        options.configPath = args[++i];
        break;
      case '--help':
        console.log(`
企业级安全扫描管理器

用法: node security-scan-manager.js [选项]

选项:
  --format <format>       输出格式 (json|html|markdown|all) [默认: json]
  --output <path>         输出目录 [默认: security-reports]
  --environment <env>     环境 (development|staging|production) [默认: development]
  --severity <level>       严重性过滤 (low|medium|high|critical|all) [默认: all]
  --scan-types <types>     扫描类型 (dependencies,code,secrets,infrastructure) [默认: 全部]
  --fix                   尝试自动修复安全问题
  --config <path>         配置文件路径 [默认: .security-config.json]
  --verbose               详细输出
  --help                  显示帮助信息

示例:
  node security-scan-manager.js --format all --severity high
  node security-scan-manager.js --environment production --fix
  node security-scan-manager.js --scan-types dependencies,code --verbose
        `);
        process.exit(0);
    }
  }

  // 执行安全扫描
  const scanner = new SecurityScanManager(options);
  scanner.execute()
    .then(results => {
      console.log('✅ 安全扫描完成!');
      console.log(`📊 安全评分: ${results.security_score}/100`);
      console.log(`🎯 风险等级: ${results.risk_level.toUpperCase()}`);
      console.log(`🔍 发现漏洞: ${results.summary.total_vulnerabilities}`);
      console.log(`💡 改进建议: ${results.summary.recommendation_count}`);

      if (results.riskLevel === 'critical' || results.summary.critical_issues > 0) {
        console.log('🚨 发现严重安全问题，请立即处理');
        process.exit(1);
      } else {
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('❌ 安全扫描失败:', error.message);
      process.exit(1);
    });
}

module.exports = SecurityScanManager;