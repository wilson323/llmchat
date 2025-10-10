#!/usr/bin/env node

/**
 * 质量监控仪表板生成器
 * 创建HTML格式的质量报告仪表板
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class QualityDashboard {
  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports', 'quality-gates');
    this.dashboardDir = path.join(process.cwd(), 'reports', 'dashboard');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.reportsDir, this.dashboardDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadQualityReports() {
    const reports = [];

    if (!fs.existsSync(this.reportsDir)) {
      return reports;
    }

    const files = fs.readdirSync(this.reportsDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse(); // 最新的在前

    for (const file of files) {
      try {
        const filePath = path.join(this.reportsDir, file);
        const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        reports.push(report);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Could not read report: ${file}`));
      }
    }

    return reports;
  }

  generateTrendData(reports) {
    const trendData = {
      timestamps: [],
      overallScores: [],
      eslintScores: [],
      securityScores: [],
      testScores: [],
      buildScores: [],
      grades: []
    };

    reports.slice(0, 30).reverse().forEach(report => { // 最近30个报告
      const date = new Date(report.timestamp).toLocaleDateString();
      trendData.timestamps.push(date);
      trendData.overallScores.push(report.analysis?.overallScore || 0);
      trendData.eslintScores.push(report.results?.eslint?.score || 0);
      trendData.securityScores.push(report.results?.security?.score || 0);
      trendData.testScores.push(report.results?.testCoverage?.score || 0);
      trendData.buildScores.push(report.results?.build?.score || 0);
      trendData.grades.push(report.analysis?.grade || 'F');
    });

    return trendData;
  }

  generateSummaryStats(reports) {
    if (reports.length === 0) {
      return {
        totalReports: 0,
        averageScore: 0,
        gradeDistribution: {},
        lastUpdated: 'No data available'
      };
    }

    const latestReport = reports[0];
    const allScores = reports.map(r => r.analysis?.overallScore || 0);
    const averageScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

    const gradeDistribution = reports.reduce((acc, report) => {
      const grade = report.analysis?.grade || 'F';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});

    return {
      totalReports: reports.length,
      averageScore,
      gradeDistribution,
      lastUpdated: new Date(latestReport.timestamp).toLocaleString(),
      latestScore: latestReport.analysis?.overallScore || 0,
      latestGrade: latestReport.analysis?.grade || 'F'
    };
  }

  generateIssueAnalysis(reports) {
    if (reports.length === 0) {
      return {
        topIssues: [],
        issueTrends: {},
        criticalAreas: []
      };
    }

    const latestReport = reports[0];
    const allIssues = [];

    // 收集所有问题
    reports.forEach(report => {
      Object.entries(report.results || {}).forEach(([checkName, result]) => {
        if (result.issues && Array.isArray(result.issues)) {
          result.issues.forEach(issue => {
            allIssues.push({
              check: checkName,
              severity: issue.severity,
              message: issue.message,
              file: issue.filePath,
              line: issue.line,
              rule: issue.ruleId,
              timestamp: report.timestamp
            });
          });
        }
      });
    });

    // 分析最常见的问题
    const issueFrequency = {};
    allIssues.forEach(issue => {
      const key = `${issue.rule || issue.message.substring(0, 50)}`;
      issueFrequency[key] = (issueFrequency[key] || 0) + 1;
    });

    const topIssues = Object.entries(issueFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({
        issue,
        count,
        severity: this.getIssueSeverity(issue, allIssues)
      }));

    // 识别关键改进领域
    const criticalAreas = [];
    Object.entries(latestReport.results || {}).forEach(([checkName, result]) => {
      if (result.status === 'FAILED' || (result.score && result.score < 70)) {
        criticalAreas.push({
          name: checkName,
          status: result.status,
          score: result.score || 0,
          issues: result.errors || result.warnings || 0
        });
      }
    });

    return {
      topIssues,
      criticalAreas,
      totalIssues: allIssues.length
    };
  }

  getIssueSeverity(issueKey, allIssues) {
    const relatedIssue = allIssues.find(issue =>
      (issue.rule && issueKey.includes(issue.rule)) ||
      issueKey.includes(issue.message?.substring(0, 50))
    );
    return relatedIssue?.severity || 'unknown';
  }

  generateHTML(reports, stats, trendData, issueAnalysis) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>代码质量仪表板 - LLMChat项目</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }

        .card h3 {
            margin-bottom: 15px;
            color: #333;
            font-size: 1.2rem;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .metric-label {
            color: #666;
            font-size: 0.9rem;
        }

        .metric-value {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .score-excellent { color: #10b981; }
        .score-good { color: #3b82f6; }
        .score-fair { color: #f59e0b; }
        .score-poor { color: #ef4444; }

        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 20px;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        .issues-list {
            max-height: 400px;
            overflow-y: auto;
        }

        .issue-item {
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 6px;
            border-left: 4px solid #ddd;
            background: #f9f9f9;
        }

        .issue-item.error {
            border-left-color: #ef4444;
            background: #fef2f2;
        }

        .issue-item.warning {
            border-left-color: #f59e0b;
            background: #fffbeb;
        }

        .issue-message {
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.85rem;
            color: #333;
            margin-bottom: 5px;
        }

        .issue-meta {
            font-size: 0.75rem;
            color: #666;
        }

        .critical-area {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
        }

        .critical-area h4 {
            color: #dc2626;
            margin-bottom: 8px;
        }

        .grade-distribution {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
        }

        .grade-item {
            text-align: center;
        }

        .grade-value {
            font-size: 1.5rem;
            font-weight: bold;
        }

        .grade-label {
            font-size: 0.8rem;
            color: #666;
        }

        .last-updated {
            text-align: center;
            color: white;
            opacity: 0.8;
            margin-top: 20px;
            font-size: 0.9rem;
        }

        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 代码质量仪表板</h1>
            <p>LLMChat 项目质量监控与分析</p>
        </div>

        <div class="dashboard">
            <!-- 总体概览 -->
            <div class="card">
                <h3>📊 质量概览</h3>
                <div class="metric">
                    <span class="metric-label">最新评分</span>
                    <span class="metric-value ${this.getScoreClass(stats.latestScore)}">${stats.latestScore}/100</span>
                </div>
                <div class="metric">
                    <span class="metric-label">等级</span>
                    <span class="metric-value">${stats.latestGrade}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">平均评分</span>
                    <span class="metric-value">${stats.averageScore}/100</span>
                </div>
                <div class="metric">
                    <span class="metric-label">总报告数</span>
                    <span class="metric-value">${stats.totalReports}</span>
                </div>
                <div class="grade-distribution">
                    ${Object.entries(stats.gradeDistribution).map(([grade, count]) => `
                        <div class="grade-item">
                            <div class="grade-value ${this.getGradeClass(grade)}">${count}</div>
                            <div class="grade-label">${grade}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 关键问题区域 -->
            <div class="card">
                <h3>🚨 关键问题</h3>
                ${issueAnalysis.criticalAreas.length > 0 ?
                    issueAnalysis.criticalAreas.map(area => `
                        <div class="critical-area">
                            <h4>${this.formatCheckName(area.name)}</h4>
                            <div class="metric">
                                <span class="metric-label">状态</span>
                                <span class="metric-value score-poor">${area.status}</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">评分</span>
                                <span class="metric-value ${this.getScoreClass(area.score)}">${area.score}/100</span>
                            </div>
                            <div class="metric">
                                <span class="metric-label">问题数</span>
                                <span class="metric-value">${area.issues}</span>
                            </div>
                        </div>
                    `).join('') :
                    '<p style="color: #10b981; text-align: center;">✅ 没有关键问题</p>'
                }
            </div>

            <!-- 质量趋势图 -->
            <div class="card full-width">
                <h3>📈 质量趋势</h3>
                <div class="chart-container">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>

            <!-- 各项指标趋势 -->
            <div class="card full-width">
                <h3>📊 各项指标详情</h3>
                <div class="chart-container">
                    <canvas id="detailsChart"></canvas>
                </div>
            </div>

            <!-- 热门问题 -->
            <div class="card">
                <h3>🔥 热门问题</h3>
                <div class="issues-list">
                    ${issueAnalysis.topIssues.map((issue, index) => `
                        <div class="issue-item ${issue.severity}">
                            <div class="issue-message">${issue.issue}</div>
                            <div class="issue-meta">出现 ${issue.count} 次</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- 改进建议 -->
            <div class="card">
                <h3>💡 改进建议</h3>
                ${this.generateRecommendations(issueAnalysis, stats)}
            </div>
        </div>

        <div class="last-updated">
            最后更新: ${stats.lastUpdated}
        </div>
    </div>

    <script>
        // 质量趋势图
        const trendCtx = document.getElementById('trendChart').getContext('2d');
        new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(trendData.timestamps)},
                datasets: [{
                    label: '整体评分',
                    data: ${JSON.stringify(trendData.overallScores)},
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // 各项指标详情图
        const detailsCtx = document.getElementById('detailsChart').getContext('2d');
        new Chart(detailsCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(trendData.timestamps)},
                datasets: [
                    {
                        label: 'ESLint',
                        data: ${JSON.stringify(trendData.eslintScores)},
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: '安全检查',
                        data: ${JSON.stringify(trendData.securityScores)},
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: '测试覆盖率',
                        data: ${JSON.stringify(trendData.testScores)},
                        borderColor: 'rgb(255, 205, 86)',
                        backgroundColor: 'rgba(255, 205, 86, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: '构建检查',
                        data: ${JSON.stringify(trendData.buildScores)},
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // 自动刷新（每5分钟）
        setTimeout(() => {
            location.reload();
        }, 300000);
    </script>
</body>
</html>`;
  }

  getScoreClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 80) return 'score-good';
    if (score >= 70) return 'score-fair';
    return 'score-poor';
  }

  getGradeClass(grade) {
    if (grade.includes('A')) return 'score-excellent';
    if (grade.includes('B')) return 'score-good';
    if (grade.includes('C')) return 'score-fair';
    return 'score-poor';
  }

  formatCheckName(name) {
    const names = {
      eslint: 'ESLint检查',
      security: '安全审计',
      testCoverage: '测试覆盖率',
      build: '构建验证',
      dependencies: '依赖检查'
    };
    return names[name] || name;
  }

  generateRecommendations(issueAnalysis, stats) {
    const recommendations = [];

    if (stats.latestScore < 80) {
      recommendations.push('整体质量评分偏低，建议重点解决关键问题');
    }

    if (issueAnalysis.criticalAreas.some(area => area.name === 'eslint')) {
      recommendations.push('优化代码风格和规范，减少ESLint错误');
    }

    if (issueAnalysis.criticalAreas.some(area => area.name === 'security')) {
      recommendations.push('及时处理安全漏洞，特别是高危漏洞');
    }

    if (issueAnalysis.criticalAreas.some(area => area.name === 'testCoverage')) {
      recommendations.push('提高测试覆盖率，确保代码质量');
    }

    if (issueAnalysis.criticalAreas.some(area => area.name === 'build')) {
      recommendations.push('优化构建流程，减少构建时间和产物大小');
    }

    if (recommendations.length === 0) {
      recommendations.push('代码质量良好，继续保持当前标准');
    }

    return recommendations.map(rec => `<p style="margin-bottom: 8px;">• ${rec}</p>`).join('');
  }

  generateDashboard() {
    console.log(chalk.blue('📊 Generating quality dashboard...'));

    const reports = this.loadQualityReports();
    const stats = this.generateSummaryStats(reports);
    const trendData = this.generateTrendData(reports);
    const issueAnalysis = this.generateIssueAnalysis(reports);

    const html = this.generateHTML(reports, stats, trendData, issueAnalysis);
    const dashboardPath = path.join(this.dashboardDir, 'index.html');

    fs.writeFileSync(dashboardPath, html);

    console.log(chalk.green(`✅ Dashboard generated: ${dashboardPath}`));
    console.log(chalk.info('🌐 Open the dashboard in your browser to view quality metrics'));

    return dashboardPath;
  }
}

// 命令行接口
function main() {
  const dashboard = new QualityDashboard();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Quality Dashboard Generator

Usage: node scripts/quality-dashboard.js [options]

Options:
  --help, -h     Show this help message
  --watch        Watch for changes and auto-regenerate
  --serve        Start a local server to serve the dashboard

Examples:
  node scripts/quality-dashboard.js
  node scripts/quality-dashboard.js --serve
`);
    process.exit(0);
  }

  if (args.includes('--serve')) {
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    const dashboardDir = path.join(process.cwd(), 'reports', 'dashboard');
    const indexPath = path.join(dashboardDir, 'index.html');

    // 生成初始仪表板
    dashboard.generateDashboard();

    const server = http.createServer((req, res) => {
      if (req.url === '/') {
        fs.readFile(indexPath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Error loading dashboard');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    const port = 3002;
    server.listen(port, () => {
      console.log(chalk.green(`🌐 Dashboard server running at http://localhost:${port}`));
      console.log(chalk.info('Press Ctrl+C to stop the server'));
    });

    // 监听文件变化
    if (args.includes('--watch')) {
      const watchDir = path.join(process.cwd(), 'reports', 'quality-gates');
      fs.watch(watchDir, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          console.log(chalk.blue('📊 Detected new quality report, updating dashboard...'));
          dashboard.generateDashboard();
        }
      });
    }
  } else {
    dashboard.generateDashboard();
  }
}

if (require.main === module) {
  main();
}

module.exports = QualityDashboard;