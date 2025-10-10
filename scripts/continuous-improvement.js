#!/usr/bin/env node

/**
 * 持续改进机制
 * 自动分析质量趋势，识别改进机会，生成改进计划
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ContinuousImprovement {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'quality-gates');
    this.improvementDir = path.join(process.cwd(), 'reports', 'improvement');
    this.planPath = path.join(this.improvementDir, 'improvement-plan.json');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.reportsDir, this.improvementDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadQualityReports(days = 30) {
    const reports = [];

    if (!fs.existsSync(this.reportsDir)) {
      return reports;
    }

    const files = fs.readdirSync(this.reportsDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    for (const file of files) {
      try {
        const filePath = path.join(this.reportsDir, file);
        const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const reportDate = new Date(report.timestamp);

        if (reportDate >= cutoffDate) {
          reports.push(report);
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Could not read report: ${file}`));
      }
    }

    return reports;
  }

  analyzeTrends(reports) {
    if (reports.length < 2) {
      return {
        trend: 'insufficient_data',
        analysis: '需要至少2个质量报告才能分析趋势',
        recommendations: []
      };
    }

    const latest = reports[0];
    const previous = reports[1];
    const oldest = reports[reports.length - 1];

    const trends = {
      overallScore: {
        current: latest.analysis?.overallScore || 0,
        previous: previous.analysis?.overallScore || 0,
        oldest: oldest.analysis?.overallScore || 0,
        trend: this.calculateTrend(
          latest.analysis?.overallScore || 0,
          previous.analysis?.overallScore || 0
        )
      },
      eslint: {
        current: latest.results?.eslint?.score || 0,
        previous: previous.results?.eslint?.score || 0,
        trend: this.calculateTrend(
          latest.results?.eslint?.score || 0,
          previous.results?.eslint?.score || 0
        )
      },
      security: {
        current: latest.results?.security?.score || 0,
        previous: previous.results?.security?.score || 0,
        trend: this.calculateTrend(
          latest.results?.security?.score || 0,
          previous.results?.security?.score || 0
        )
      },
      testCoverage: {
        current: latest.results?.testCoverage?.score || 0,
        previous: previous.results?.testCoverage?.score || 0,
        trend: this.calculateTrend(
          latest.results?.testCoverage?.score || 0,
          previous.results?.testCoverage?.score || 0
        )
      },
      build: {
        current: latest.results?.build?.score || 0,
        previous: previous.results?.build?.score || 0,
        trend: this.calculateTrend(
          latest.results?.build?.score || 0,
          previous.results?.build?.score || 0
        )
      }
    };

    return this.generateTrendAnalysis(trends);
  }

  calculateTrend(current, previous) {
    if (current > previous) return 'improving';
    if (current < previous) return 'declining';
    return 'stable';
  }

  generateTrendAnalysis(trends) {
    const analysis = {
      overall: {
        status: trends.overallScore.trend,
        message: this.getTrendMessage(trends.overallScore.trend, '整体质量评分'),
        score: trends.overallScore.current,
        change: trends.overallScore.current - trends.overallScore.previous
      }
    };

    const areas = ['eslint', 'security', 'testCoverage', 'build'];
    analysis.areas = areas.map(area => ({
      name: area,
      status: trends[area].trend,
      message: this.getTrendMessage(trends[area].trend, this.getAreaName(area)),
      score: trends[area].current,
      change: trends[area].current - trends[area].previous
    }));

    // 识别需要关注的领域
    analysis.concerns = analysis.areas.filter(area =>
      area.status === 'declining' || area.score < 70
    );

    // 识别表现良好的领域
    analysis.strengths = analysis.areas.filter(area =>
      area.status === 'improving' && area.score >= 80
    );

    return analysis;
  }

  getTrendMessage(trend, area) {
    const messages = {
      improving: `${area}正在改善`,
      declining: `${area}正在下降`,
      stable: `${area}保持稳定`
    };
    return messages[trend] || `${area}状态未知`;
  }

  getAreaName(area) {
    const names = {
      eslint: 'ESLint代码质量',
      security: '安全检查',
      testCoverage: '测试覆盖率',
      build: '构建质量'
    };
    return names[area] || area;
  }

  identifyImprovementOpportunities(trends, reports) {
    const opportunities = [];

    // 分析持续下降的领域
    trends.areas.forEach(area => {
      if (area.status === 'declining') {
        opportunities.push({
          type: 'declining_quality',
          area: area.name,
          priority: 'high',
          description: `${area.message}，当前评分${area.score}分，需要立即关注`,
          potentialImpact: 'high',
          effort: 'medium',
          actions: this.generateActionsForArea(area.name, area.score)
        });
      }
    });

    // 分析低分领域
    trends.areas.forEach(area => {
      if (area.score < 70) {
        opportunities.push({
          type: 'low_score',
          area: area.name,
          priority: area.score < 50 ? 'high' : 'medium',
          description: `${area.name}评分较低(${area.score}分)，需要重点改进`,
          potentialImpact: 'high',
          effort: 'high',
          actions: this.generateActionsForArea(area.name, area.score)
        });
      }
    });

    // 分析重复出现的问题
    const recurringIssues = this.analyzeRecurringIssues(reports);
    recurringIssues.forEach(issue => {
      opportunities.push({
        type: 'recurring_issue',
        area: issue.area,
        priority: issue.frequency > 5 ? 'high' : 'medium',
        description: `重复问题: ${issue.description}，在过去30天出现${issue.frequency}次`,
        potentialImpact: 'medium',
        effort: 'low',
        actions: [
          `分析${issue.description}的根本原因`,
          '制定预防措施',
          '更新代码规范或检查工具'
        ]
      });
    });

    // 分析改进机会
    if (trends.overallScore.score >= 80) {
      opportunities.push({
        type: 'optimization',
        area: 'overall',
        priority: 'low',
        description: '整体质量良好，可以进一步优化和提升',
        potentialImpact: 'medium',
        effort: 'medium',
        actions: [
          '探索新的质量改进技术',
          '优化CI/CD流程',
          '提升开发工具效率'
        ]
      });
    }

    return opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  generateActionsForArea(area, score) {
    const actionMap = {
      eslint: {
        low: [
          '加强ESLint规则培训',
          '更新ESLint配置文件',
          '增加代码审查重点',
          '设置更严格的pre-commit检查'
        ],
        medium: [
          '重构复杂的代码块',
          '优化代码结构',
          '提高函数可读性',
          '减少代码重复'
        ]
      },
      security: {
        low: [
          '定期进行安全培训',
          '更新安全扫描工具',
          '建立安全检查清单',
          '加强依赖安全管理'
        ],
        medium: [
          '修复已发现的安全漏洞',
          '加强输入验证',
          '改进权限控制',
          '优化敏感数据处理'
        ]
      },
      testCoverage: {
        low: [
          '提高测试覆盖率标准',
          '加强测试编写培训',
          '优化测试策略',
          '增加集成测试'
        ],
        medium: [
          '编写缺失的单元测试',
          '增加边界条件测试',
          '改进测试数据管理',
          '优化测试执行效率'
        ]
      },
      build: {
        low: [
          '优化构建配置',
          '减少构建产物大小',
          '改进构建缓存策略',
          '优化依赖管理'
        ],
        medium: [
          '修复构建失败问题',
          '优化构建时间',
          '改进部署流程',
          '加强构建监控'
        ]
      }
    };

    const level = score < 50 ? 'low' : 'medium';
    return actionMap[area]?.[level] || ['需要具体分析该领域的改进措施'];
  }

  analyzeRecurringIssues(reports) {
    const issueMap = new Map();

    reports.forEach(report => {
      Object.entries(report.results || {}).forEach(([checkName, result]) => {
        if (result.issues && Array.isArray(result.issues)) {
          result.issues.forEach(issue => {
            const key = `${checkName}:${issue.ruleId || issue.message.substring(0, 50)}`;

            if (!issueMap.has(key)) {
              issueMap.set(key, {
                area: checkName,
                description: issue.ruleId || issue.message.substring(0, 50),
                frequency: 0,
                firstSeen: report.timestamp,
                lastSeen: report.timestamp,
                examples: []
              });
            }

            const issueInfo = issueMap.get(key);
            issueInfo.frequency++;
            issueInfo.lastSeen = report.timestamp;

            if (issueInfo.examples.length < 3) {
              issueInfo.examples.push({
                file: issue.filePath,
                line: issue.line,
                message: issue.message
              });
            }
          });
        }
      });
    });

    return Array.from(issueMap.values())
      .filter(issue => issue.frequency > 1)
      .sort((a, b) => b.frequency - a.frequency);
  }

  generateImprovementPlan(opportunities, trends) {
    const plan = {
      generatedAt: new Date().toISOString(),
      overallStatus: trends.overall.status,
      currentScore: trends.overallScore.score,
      targetScore: Math.max(85, trends.overallScore.score + 10),
      timeHorizon: '30天',

      summary: {
        totalOpportunities: opportunities.length,
        highPriority: opportunities.filter(op => op.priority === 'high').length,
        mediumPriority: opportunities.filter(op => op.priority === 'medium').length,
        lowPriority: opportunities.filter(op => op.priority === 'low').length
      },

      opportunities: opportunities.map((opp, index) => ({
        id: index + 1,
        ...opp,
        status: 'pending',
        assignee: 'TBD',
        dueDate: this.calculateDueDate(opp.priority),
        estimatedHours: this.estimateHours(opp),
        dependencies: [],
        deliverables: this.generateDeliverables(opp)
      })),

      milestones: this.generateMilestones(opportunities),

      successCriteria: [
        `整体质量评分达到 ${this.getTargetScore(trends.overallScore.score)}分`,
        '所有高危问题得到解决',
        '重复问题数量减少50%',
        '团队质量意识提升'
      ],

      risks: this.identifyRisks(opportunities),

      resources: {
        teamMembers: ['开发团队', 'DevOps团队', 'QA团队'],
        tools: ['质量监控工具', '代码审查工具', '自动化测试工具'],
        budget: '内部资源',
        timeline: '30天'
      },

      monitoring: {
        kpis: [
          '整体质量评分',
          'ESLint错误数量',
          '安全漏洞数量',
          '测试覆盖率',
          '构建成功率'
        ],
        reportingFrequency: 'weekly',
        reviewMeetings: ['每周质量回顾', '月度改进评审']
      }
    };

    return plan;
  }

  calculateDueDate(priority) {
    const days = {
      high: 7,
      medium: 14,
      low: 30
    };

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days[priority]);
    return dueDate.toISOString().split('T')[0];
  }

  estimateHours(opportunity) {
    const baseHours = {
      high: 16,
      medium: 8,
      low: 4
    };

    const multiplier = {
      eslint: 1.0,
      security: 1.2,
      testCoverage: 1.5,
      build: 0.8,
      overall: 2.0
    };

    const areaKey = opportunity.area.toLowerCase();
    const areaMultiplier = multiplier[areaKey] || 1.0;

    return Math.round(baseHours[opportunity.priority] * areaMultiplier);
  }

  generateDeliverables(opportunity) {
    const deliverableMap = {
      eslint: [
        '更新的ESLint配置',
        '代码规范文档',
        '团队培训材料',
        '质量检查报告'
      ],
      security: [
        '安全漏洞修复报告',
        '安全检查清单',
        '安全编码指南',
        '安全审计报告'
      ],
      testCoverage: [
        '测试用例文档',
        '测试覆盖率报告',
        '测试策略文档',
        '自动化测试脚本'
      ],
      build: [
        '优化后的构建配置',
        '构建性能报告',
        '部署流程文档',
        'CI/CD配置更新'
      ],
      overall: [
        '质量改进报告',
        '流程优化文档',
        '团队培训计划',
        '质量监控仪表板'
      ]
    };

    return deliverableMap[opportunity.area.toLowerCase()] || [
      '改进实施报告',
      '结果验证文档',
      '经验总结',
      '后续改进建议'
    ];
  }

  generateMilestones(opportunities) {
    const milestones = [
      {
        name: '问题识别和规划',
        description: '完成质量问题分析和改进计划制定',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        deliverables: ['质量问题分析报告', '改进计划文档']
      },
      {
        name: '关键问题解决',
        description: '解决所有高优先级质量问题',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        deliverables: ['问题修复报告', '质量提升验证']
      },
      {
        name: '流程优化实施',
        description: '实施开发流程优化措施',
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        deliverables: ['流程文档更新', '工具配置优化']
      },
      {
        name: '质量巩固和评估',
        description: '巩固质量改进成果并评估效果',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        deliverables: ['质量评估报告', '持续改进计划']
      }
    ];

    return milestones;
  }

  identifyRisks(opportunities) {
    const risks = [];

    // 技术风险
    if (opportunities.some(opp => opp.area === 'build')) {
      risks.push({
        type: 'technical',
        description: '构建流程变更可能影响部署稳定性',
        probability: 'medium',
        impact: 'medium',
        mitigation: '分阶段实施，保持回滚能力'
      });
    }

    // 资源风险
    if (opportunities.filter(opp => opp.priority === 'high').length > 3) {
      risks.push({
        type: 'resource',
        description: '高优先级问题过多可能导致资源分散',
        probability: 'high',
        impact: 'high',
        mitigation: '优先处理最关键问题，合理分配资源'
      });
    }

    // 时间风险
    risks.push({
      type: 'timeline',
      description: '改进措施可能影响开发进度',
      probability: 'medium',
      impact: 'medium',
      mitigation: '合理安排改进时间，避免影响交付'
    });

    // 技能风险
    if (opportunities.some(opp => opp.area === 'security' || opp.area === 'testCoverage')) {
      risks.push({
        type: 'skill',
        description: '团队可能需要新技能培训',
        probability: 'medium',
        impact: 'low',
        mitigation: '提供相关培训和文档支持'
      });
    }

    return risks;
  }

  getTargetScore(currentScore) {
    if (currentScore >= 90) return 95;
    if (currentScore >= 80) return 90;
    if (currentScore >= 70) return 85;
    if (currentScore >= 60) return 80;
    return 75;
  }

  savePlan(plan) {
    fs.writeFileSync(this.planPath, JSON.stringify(plan, null, 2));

    // 保存计划历史
    const historyPath = path.join(this.improvementDir, 'plan-history.json');
    let history = [];

    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (error) {
        console.warn(chalk.yellow('⚠️  Could not read plan history'));
      }
    }

    history.push({
      timestamp: plan.generatedAt,
      planPath: this.planPath,
      summary: {
        overallScore: plan.currentScore,
        targetScore: plan.targetScore,
        totalOpportunities: plan.summary.totalOpportunities,
        highPriorityCount: plan.summary.highPriority
      }
    });

    // 只保留最近10个计划的历史
    history = history.slice(-10);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));

    console.log(chalk.green(`✅ Improvement plan saved to: ${this.planPath}`));
  }

  loadExistingPlan() {
    if (!fs.existsSync(this.planPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.planPath, 'utf8'));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not load existing plan'));
      return null;
    }
  }

  updatePlanProgress() {
    const plan = this.loadExistingPlan();
    if (!plan) {
      console.log(chalk.yellow('⚠️  No existing plan found'));
      return;
    }

    const reports = this.loadQualityReports();
    const latestReport = reports[0];

    if (!latestReport) {
      console.log(chalk.yellow('⚠️  No recent quality reports found'));
      return;
    }

    // 更新机会状态
    plan.opportunities.forEach(opportunity => {
      const areaResult = latestReport.results?.[opportunity.area];
      if (areaResult) {
        const currentScore = areaResult.score || 0;
        const targetScore = 85; // 目标分数

        if (currentScore >= targetScore) {
          opportunity.status = 'completed';
          opportunity.completedAt = new Date().toISOString();
        } else if (currentScore > (opportunity.currentScore || 0)) {
          opportunity.status = 'in_progress';
          opportunity.lastUpdated = new Date().toISOString();
        }
      }
    });

    // 更新里程碑状态
    plan.milestones.forEach(milestone => {
      const now = new Date();
      const dueDate = new Date(milestone.dueDate);

      if (now > dueDate && milestone.status === 'pending') {
        milestone.status = 'overdue';
      } else if (milestone.status === 'pending') {
        // 检查相关的机会是否完成
        const relatedOpportunities = plan.opportunities.filter(opp =>
          milestone.dueDate >= opp.dueDate
        );

        if (relatedOpportunities.every(opp => opp.status === 'completed')) {
          milestone.status = 'completed';
          milestone.completedAt = new Date().toISOString();
        }
      }
    });

    // 更新整体进度
    const completedOpportunities = plan.opportunities.filter(opp => opp.status === 'completed').length;
    const totalOpportunities = plan.opportunities.length;
    plan.progress = {
      completedOpportunities,
      totalOpportunities,
      completionRate: Math.round((completedOpportunities / totalOpportunities) * 100),
      currentScore: latestReport.analysis?.overallScore || 0,
      targetScore: plan.targetScore,
      scoreProgress: Math.round(((latestReport.analysis?.overallScore || 0) / plan.targetScore) * 100)
    };

    this.savePlan(plan);
    console.log(chalk.green('✅ Plan progress updated'));
  }

  generateReport() {
    const reports = this.loadQualityReports();
    const trends = this.analyzeTrends(reports);
    const opportunities = this.identifyImprovementOpportunities(trends, reports);
    const plan = this.generateImprovementPlan(opportunities, trends);

    console.log(chalk.blue.bold('📈 持续改进分析报告'));
    console.log('=' .repeat(50));

    // 整体状况
    console.log('\n🎯 整体质量状况:');
    console.log(`当前评分: ${trends.overallScore.score}/100`);
    console.log(`趋势: ${trends.overall.status}`);
    console.log(`变化: ${trends.overall.change > 0 ? '+' : ''}${trends.overall.change}`);

    // 改进机会
    console.log('\n🔍 改进机会:');
    console.log(`总计: ${opportunities.length} 个机会`);
    console.log(`高优先级: ${opportunities.filter(opp => opp.priority === 'high').length} 个`);
    console.log(`中优先级: ${opportunities.filter(opp => opp.priority === 'medium').length} 个`);
    console.log(`低优先级: ${opportunities.filter(opp => opp.priority === 'low').length} 个`);

    // 重点关注领域
    if (trends.concerns.length > 0) {
      console.log('\n⚠️  需要关注的领域:');
      trends.concerns.forEach(concern => {
        console.log(`- ${concern.name}: ${concern.message} (${concern.score}分)`);
      });
    }

    // 优势领域
    if (trends.strengths.length > 0) {
      console.log('\n✅ 表现良好的领域:');
      trends.strengths.forEach(strength => {
        console.log(`- ${strength.name}: ${strength.message} (${strength.score}分)`);
      });
    }

    // 改进计划摘要
    console.log('\n📋 改进计划摘要:');
    console.log(`目标评分: ${plan.targetScore}分`);
    console.log(`时间范围: ${plan.timeHorizon}`);
    console.log(`里程碑数量: ${plan.milestones.length} 个`);
    console.log(`预估工作量: ${plan.opportunities.reduce((total, opp) => total + (opp.estimatedHours || 0), 0)} 小时`);

    // 风险提示
    if (plan.risks.length > 0) {
      console.log('\n⚠️  潜在风险:');
      plan.risks.forEach(risk => {
        console.log(`- ${risk.description} (${risk.probability}概率, ${risk.impact}影响)`);
      });
    }

    this.savePlan(plan);
    console.log(chalk.green(`\n📄 详细改进计划已保存到: ${this.planPath}`));

    return plan;
  }
}

// 命令行接口
function main() {
  const improvement = new ContinuousImprovement();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Continuous Improvement System

Usage: node scripts/continuous-improvement.js [options]

Options:
  --help, -h        Show this help message
  --update         Update existing plan progress
  --report-only     Generate report without saving plan
  --analyze-days N  Number of days to analyze (default: 30)

Examples:
  node scripts/continuous-improvement.js              # Generate improvement plan
  node scripts/continuous-improvement.js --update     # Update plan progress
  node scripts/continuous-improvement.js --report-only # Generate report only
`);
    process.exit(0);
  }

  const updateProgress = args.includes('--update');
  const reportOnly = args.includes('--report-only');
  const analyzeDays = parseInt(args.find(arg => arg.startsWith('--analyze-days='))?.split('=')[1] || '30');

  if (updateProgress) {
    improvement.updatePlanProgress();
  } else {
    improvement.generateReport();
  }
}

if (require.main === module) {
  main();
}

module.exports = ContinuousImprovement;