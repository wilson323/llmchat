#!/usr/bin/env node

/**
 * 质量趋势跟踪器
 * 用于跟踪和分析代码质量趋势，提供持续改进建议
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  dim: chalk.dim
};

class QualityTrendTracker {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'quality');
    this.trendPath = path.join(this.reportsDir, 'quality-trend.json');
    this.improvementPath = path.join(this.reportsDir, 'improvement-plan.json');
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  loadTrendData() {
    if (!fs.existsSync(this.trendPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(this.trendPath, 'utf8'));
    } catch (error) {
      console.log(colors.warning('⚠️  Could not load trend data'));
      return [];
    }
  }

  saveTrendData(trendData) {
    this.ensureReportsDir();
    fs.writeFileSync(this.trendPath, JSON.stringify(trendData, null, 2));
  }

  analyzeTrends(trendData) {
    if (trendData.length < 2) {
      return {
        trend: 'insufficient_data',
        analysis: '需要更多的质量数据点来进行趋势分析',
        recommendations: ['继续收集质量数据']
      };
    }

    const recent = trendData.slice(-7); // 最近7天
    const previous = trendData.slice(-14, -7); // 之前7天

    if (previous.length === 0) {
      return {
        trend: 'establishing_baseline',
        analysis: '正在建立质量基线',
        recommendations: ['继续收集数据以建立基线']
      };
    }

    // 计算平均值
    const recentAvg = recent.reduce((sum, item) => sum + item.score, 0) / recent.length;
    const previousAvg = previous.reduce((sum, item) => sum + item.score, 0) / previous.length;

    // 计算趋势
    const scoreChange = recentAvg - previousAvg;
    const recentErrors = recent.reduce((sum, item) => sum + item.lintErrors, 0);
    const previousErrors = previous.reduce((sum, item) => sum + item.lintErrors, 0);
    const errorChange = recentErrors - previousErrors;

    let trend, analysis, recommendations;

    if (scoreChange > 5) {
      trend = 'improving';
      analysis = `质量评分上升了 ${scoreChange.toFixed(1)} 分`;
      recommendations = [
        '继续保持当前的代码质量标准',
        '考虑设置更高的质量目标',
        '分享最佳实践给团队成员'
      ];
    } else if (scoreChange < -5) {
      trend = 'declining';
      analysis = `质量评分下降了 ${Math.abs(scoreChange).toFixed(1)} 分`;
      recommendations = [
        '立即调查质量下降原因',
        '加强代码审查流程',
        '考虑暂停新功能开发，专注质量改进'
      ];
    } else {
      trend = 'stable';
      analysis = `质量评分相对稳定（变化: ${scoreChange.toFixed(1)} 分）`;
      recommendations = [
        '继续维持当前质量标准',
        '寻找渐进式改进机会',
        '定期回顾和优化开发流程'
      ];
    }

    // 特定问题分析
    if (errorChange > 10) {
      recommendations.push('ESLint错误显著增加，需要重点关注');
    }

    if (recent.some(item => item.securityHigh > 0 || item.securityCritical > 0)) {
      recommendations.push('发现安全漏洞，需要立即处理');
    }

    if (recent.some(item => !item.buildSuccess)) {
      recommendations.push('构建失败问题需要优先解决');
    }

    return {
      trend,
      analysis,
      recommendations,
      metrics: {
        recentAvg: recentAvg.toFixed(1),
        previousAvg: previousAvg.toFixed(1),
        scoreChange: scoreChange.toFixed(1),
        errorChange
      }
    };
  }

  generateImprovementPlan(trendData, trendAnalysis) {
    const latestData = trendData[trendData.length - 1];
    if (!latestData) {
      return {
        priority: 'establish_baseline',
        actions: [
          {
            action: '建立质量基线',
            description: '收集至少14天的质量数据',
            owner: 'DevOps团队',
            dueDate: this.addDays(new Date(), 14),
            status: 'in_progress'
          }
        ]
      };
    }

    const plan = {
      priority: this.calculatePriority(latestData, trendAnalysis),
      actions: []
    };

    // 基于当前质量问题生成改进行动
    if (latestData.lintErrors > 0) {
      plan.actions.push({
        action: '修复ESLint错误',
        description: `解决 ${latestData.lintErrors} 个ESLint错误`,
        owner: '开发团队',
        dueDate: this.addDays(new Date(), 3),
        status: 'pending',
        impact: 'high'
      });
    }

    if (latestData.lintWarnings > 5) {
      plan.actions.push({
        action: '处理ESLint警告',
        description: `处理 ${latestData.lintWarnings} 个ESLint警告`,
        owner: '开发团队',
        dueDate: this.addDays(new Date(), 7),
        status: 'pending',
        impact: 'medium'
      });
    }

    if (latestData.securityHigh > 0 || latestData.securityCritical > 0) {
      plan.actions.push({
        action: '修复安全漏洞',
        description: `修复 ${latestData.securityHigh + latestData.securityCritical} 个高危安全漏洞`,
        owner: '安全团队',
        dueDate: this.addDays(new Date(), 1),
        status: 'pending',
        impact: 'critical'
      });
    }

    if (!latestData.buildSuccess) {
      plan.actions.push({
        action: '修复构建问题',
        description: '解决构建失败问题',
        owner: 'DevOps团队',
        dueDate: this.addDays(new Date(), 1),
        status: 'pending',
        impact: 'high'
      });
    }

    if (!latestData.testsPassed) {
      plan.actions.push({
        action: '修复测试失败',
        description: '解决测试失败问题',
        owner: '开发团队',
        dueDate: this.addDays(new Date(), 2),
        status: 'pending',
        impact: 'high'
      });
    }

    // 基于趋势分析添加预防性措施
    if (trendAnalysis.trend === 'declining') {
      plan.actions.push({
        action: '质量改进会议',
        description: '召开团队会议讨论质量下降原因和改进措施',
        owner: '技术负责人',
        dueDate: this.addDays(new Date(), 2),
        status: 'pending',
        impact: 'high'
      });
    }

    if (trendAnalysis.trend === 'stable' && latestData.score < 80) {
      plan.actions.push({
        action: '质量目标设定',
        description: '设定更高的质量目标并制定实现计划',
        owner: '技术负责人',
        dueDate: this.addDays(new Date(), 7),
        status: 'pending',
        impact: 'medium'
      });
    }

    return plan;
  }

  calculatePriority(latestData, trendAnalysis) {
    if (latestData.securityCritical > 0 || latestData.securityHigh > 0) {
      return 'critical';
    }

    if (!latestData.buildSuccess || !latestData.testsPassed) {
      return 'high';
    }

    if (trendAnalysis.trend === 'declining') {
      return 'high';
    }

    if (latestData.score < 60) {
      return 'high';
    }

    if (latestData.score < 80) {
      return 'medium';
    }

    return 'low';
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  }

  saveImprovementPlan(plan) {
    this.ensureReportsDir();
    fs.writeFileSync(this.improvementPath, JSON.stringify(plan, null, 2));
  }

  loadImprovementPlan() {
    if (!fs.existsSync(this.improvementPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.improvementPath, 'utf8'));
    } catch (error) {
      console.log(colors.warning('⚠️  Could not load improvement plan'));
      return null;
    }
  }

  updateActionStatus(actionId, newStatus) {
    const plan = this.loadImprovementPlan();
    if (!plan) {
      return false;
    }

    const action = plan.actions.find(a => a.action === actionId);
    if (action) {
      action.status = newStatus;
      if (newStatus === 'completed') {
        action.completedDate = new Date().toISOString().split('T')[0];
      }
      this.saveImprovementPlan(plan);
      return true;
    }

    return false;
  }

  generateWeeklyReport() {
    const trendData = this.loadTrendData();
    const trendAnalysis = this.analyzeTrends(trendData);
    const improvementPlan = this.generateImprovementPlan(trendData, trendAnalysis);

    const report = {
      weekOf: new Date().toISOString().split('T')[0],
      trendAnalysis,
      improvementPlan,
      dataPoints: trendData.length,
      latestScore: trendData.length > 0 ? trendData[trendData.length - 1].score : 0
    };

    return report;
  }

  displayReport(report) {
    console.log('\n' + colors.info('📈 质量趋势分析报告'));
    console.log('=' .repeat(60));

    console.log(`\n📅 报告周期: ${report.weekOf}`);
    console.log(`📊 数据点数量: ${report.dataPoints}`);
    console.log(`🎯 最新评分: ${report.latestScore}/100`);

    console.log('\n📈 趋势分析:');
    console.log(`  状态: ${report.trendAnalysis.trend.toUpperCase()}`);
    console.log(`  分析: ${report.trendAnalysis.analysis}`);

    if (report.trendAnalysis.metrics) {
      console.log('\n📊 关键指标:');
      console.log(`  最近平均分: ${report.trendAnalysis.metrics.recentAvg}`);
      console.log(`  之前平均分: ${report.trendAnalysis.metrics.previousAvg}`);
      console.log(`  评分变化: ${report.trendAnalysis.metrics.scoreChange}`);
      console.log(`  错误变化: ${report.trendAnalysis.metrics.errorChange}`);
    }

    console.log('\n💡 改进建议:');
    report.trendAnalysis.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log('\n🎯 改进计划:');
    console.log(`  优先级: ${report.improvementPlan.priority.toUpperCase()}`);
    console.log(`  行动数量: ${report.improvementPlan.actions.length}`);

    if (report.improvementPlan.actions.length > 0) {
      console.log('\n📋 具体行动:');
      report.improvementPlan.actions.forEach((action, index) => {
        const statusIcon = action.status === 'completed' ? '✅' :
                          action.status === 'in_progress' ? '🔄' : '⏳';
        const impactIcon = action.impact === 'critical' ? '🚨' :
                          action.impact === 'high' ? '⚠️' :
                          action.impact === 'medium' ? '📌' : '📝';

        console.log(`  ${index + 1}. ${statusIcon} ${impactIcon} ${action.action}`);
        console.log(`     描述: ${action.description}`);
        console.log(`     负责人: ${action.owner}`);
        console.log(`     截止日期: ${action.dueDate}`);
        console.log(`     状态: ${action.status}`);
        console.log('');
      });
    }

    console.log('=' .repeat(60));
  }

  sendNotification(report) {
    // 这里可以实现通知逻辑
    // 例如：发送邮件、Slack通知、Teams消息等
    console.log(colors.info('📢 通知: 质量报告已生成'));

    if (report.trendAnalysis.trend === 'declining') {
      console.log(colors.warning('⚠️  警告: 质量呈下降趋势，需要立即关注！'));
    }

    if (report.improvementPlan.priority === 'critical') {
      console.log(colors.error('🚨 紧急: 发现严重质量问题，需要立即处理！'));
    }
  }
}

function main() {
  const tracker = new QualityTrendTracker();

  try {
    console.log(colors.info('🚀 开始质量趋势分析...\n'));

    const report = tracker.generateWeeklyReport();
    tracker.saveImprovementPlan(report.improvementPlan);
    tracker.displayReport(report);
    tracker.sendNotification(report);

    console.log(colors.success('\n✅ 质量趋势分析完成！'));
    console.log(colors.info(`📁 报告已保存到: ${tracker.improvementPath}`));
  } catch (error) {
    console.log(colors.error(`❌ 质量趋势分析失败: ${error.message}`));
    process.exit(1);
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
质量趋势跟踪器

用法: node scripts/quality-trend-tracker.js [选项]

选项:
  --help, -h     显示帮助信息
  --update-action <action> <status>  更新行动状态
  --show-plan    显示当前改进计划
  --show-trend   显示趋势数据

示例:
  node scripts/quality-trend-tracker.js
  node scripts/quality-trend-tracker.js --update-action "修复ESLint错误" completed
  node scripts/quality-trend-tracker.js --show-plan
`);
  process.exit(0);
}

if (args.includes('--show-plan')) {
  const tracker = new QualityTrendTracker();
  const plan = tracker.loadImprovementPlan();
  if (plan) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log('没有找到改进计划');
  }
  process.exit(0);
}

if (args.includes('--show-trend')) {
  const tracker = new QualityTrendTracker();
  const trend = tracker.loadTrendData();
  console.log(JSON.stringify(trend, null, 2));
  process.exit(0);
}

if (args.includes('--update-action')) {
  const actionIndex = args.indexOf('--update-action');
  if (actionIndex + 2 < args.length) {
    const actionName = args[actionIndex + 1];
    const newStatus = args[actionIndex + 2];

    const tracker = new QualityTrendTracker();
    const success = tracker.updateActionStatus(actionName, newStatus);

    if (success) {
      console.log(colors.success(`✅ 行动状态已更新: ${actionName} -> ${newStatus}`));
    } else {
      console.log(colors.error(`❌ 未找到行动: ${actionName}`));
    }
    process.exit(0);
  } else {
    console.log(colors.error('❌ 请提供行动名称和新状态'));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = QualityTrendTracker;