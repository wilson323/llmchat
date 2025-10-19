#!/usr/bin/env node

/**
 * TypeScript安全监控仪表板
 * 生成HTML仪表板，可视化TypeScript类型安全状态
 */

const fs = require('fs');
const path = require('path');

class TypeScriptDashboard {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = path.join(this.projectRoot, 'reports', 'typescript');
    this.outputDir = path.join(this.projectRoot, 'reports', 'dashboard');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  loadLatestReport() {
    try {
      const reportFiles = fs.readdirSync(this.reportsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      if (reportFiles.length > 0) {
        const latestReport = path.join(this.reportsDir, reportFiles[0]);
        return JSON.parse(fs.readFileSync(latestReport, 'utf8'));
      }
    } catch (error) {
      console.warn('⚠️ 无法加载最新报告:', error.message);
    }

    return null;
  }

  loadHistoricalData(days = 30) {
    const historicalData = [];
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const reportFile = path.join(this.reportsDir, `typescript-safety-${dateStr}.json`);

      if (fs.existsSync(reportFile)) {
        try {
          const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
          historicalData.push({
            date: dateStr,
            score: report.analysis?.weightedScore || 0,
            errors: report.analysis?.totalErrors || 0,
            warnings: report.analysis?.totalWarnings || 0,
            typeCoverage: report.analysis?.typeCoverage || 0
          });
        } catch (error) {
          // 忽略错误的报告文件
        }
      }
    }

    return historicalData;
  }

  generateDashboardHTML(data, historicalData) {
    const timestamp = new Date().toISOString();
    const currentDate = new Date().toLocaleDateString();

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript 安全监控仪表板</title>
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
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }

        .card h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }

        .metric-label {
            color: #666;
            font-weight: 500;
        }

        .metric-value {
            font-weight: bold;
            font-size: 1.1rem;
        }

        .status-excellent { color: #28a745; }
        .status-good { color: #17a2b8; }
        .status-fair { color: #ffc107; }
        .status-poor { color: #dc3545; }

        .chart-container {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .chart-container h3 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.3rem;
        }

        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .project-details {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .project-item {
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
            background: #f8f9fa;
        }

        .project-item.failed {
            border-left-color: #dc3545;
            background: #f8d7da;
        }

        .project-item.passed {
            border-left-color: #28a745;
            background: #d4edda;
        }

        .project-name {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 1.1rem;
        }

        .project-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }

        .project-metric {
            text-align: center;
            padding: 8px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .project-metric-value {
            font-weight: bold;
            font-size: 1.2rem;
        }

        .project-metric-label {
            font-size: 0.85rem;
            color: #666;
            margin-top: 4px;
        }

        .footer {
            text-align: center;
            color: white;
            margin-top: 30px;
            opacity: 0.8;
        }

        .refresh-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            margin-top: 15px;
            transition: background 0.3s ease;
        }

        .refresh-button:hover {
            background: #0056b3;
        }

        .icon {
            font-size: 1.2rem;
        }

        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }

            .chart-grid {
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
            <h1>🔒 TypeScript 安全监控仪表板</h1>
            <p>实时监控项目类型安全状态 • 更新时间: ${currentDate}</p>
        </div>

        <div class="dashboard">
            <div class="card">
                <h3><span class="icon">📊</span> 总体安全分数</h3>
                <div class="metric">
                    <span class="metric-label">当前分数</span>
                    <span class="metric-value status-${this.getStatusClass(data?.analysis?.weightedScore || 0)}">
                        ${data?.analysis?.weightedScore || 0}/100
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">状态</span>
                    <span class="metric-value status-${this.getStatusClass(data?.analysis?.weightedScore || 0)}">
                        ${data?.analysis?.status || 'UNKNOWN'}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">趋势</span>
                    <span class="metric-value">
                        ${this.getTrendIcon(historicalData)} ${this.getTrendText(historicalData)}
                    </span>
                </div>
            </div>

            <div class="card">
                <h3><span class="icon">📝</span> 编译状态</h3>
                <div class="metric">
                    <span class="metric-label">错误数量</span>
                    <span class="metric-value status-${data?.analysis?.totalErrors > 0 ? 'poor' : 'excellent'}">
                        ${data?.analysis?.totalErrors || 0}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">警告数量</span>
                    <span class="metric-value status-${data?.analysis?.totalWarnings > 10 ? 'fair' : 'good'}">
                        ${data?.analysis?.totalWarnings || 0}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">项目数</span>
                    <span class="metric-value">${data?.analysis?.projectsAnalyzed || 0}</span>
                </div>
            </div>

            <div class="card">
                <h3><span class="icon">🔤</span> 类型覆盖率</h3>
                <div class="metric">
                    <span class="metric-label">当前覆盖率</span>
                    <span class="metric-value status-${this.getTypeCoverageStatus(data?.analysis?.typeCoverage || 0)}">
                        ${data?.analysis?.typeCoverage || 0}%
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">目标覆盖率</span>
                    <span class="metric-value">95%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">差距</span>
                    <span class="metric-value">
                        ${Math.max(0, 95 - (data?.analysis?.typeCoverage || 0))}%
                    </span>
                </div>
            </div>

            <div class="card">
                <h3><span class="icon">🔧</span> 代码复杂度</h3>
                <div class="metric">
                    <span class="metric-label">平均复杂度</span>
                    <span class="metric-value status-${this.getComplexityStatus(data?.analysis?.complexity?.average || 0)}">
                        ${data?.analysis?.complexity?.average || 0}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">最大复杂度</span>
                    <span class="metric-value">${data?.analysis?.complexity?.max || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">建议阈值</span>
                    <span class="metric-value">10</span>
                </div>
            </div>
        </div>

        <div class="chart-grid">
            <div class="chart-container">
                <h3>📈 安全分数趋势 (最近30天)</h3>
                <canvas id="scoreChart" width="400" height="200"></canvas>
            </div>

            <div class="chart-container">
                <h3>📊 错误与警告趋势</h3>
                <canvas id="errorChart" width="400" height="200"></canvas>
            </div>
        </div>

        <div class="chart-container">
            <h3>🔤 类型覆盖率趋势</h3>
            <canvas id="coverageChart" width="800" height="300"></canvas>
        </div>

        ${data?.analysis?.details ? `
        <div class="project-details">
            <h3>📁 项目详细状态</h3>
            ${Object.entries(data.analysis.details).map(([projectName, projectData]) => `
                <div class="project-item ${projectData.errors > 0 ? 'failed' : 'passed'}">
                    <div class="project-name">${projectName}</div>
                    <div class="project-metrics">
                        <div class="project-metric">
                            <div class="project-metric-value">${projectData.errors || 0}</div>
                            <div class="project-metric-label">错误</div>
                        </div>
                        <div class="project-metric">
                            <div class="project-metric-value">${projectData.warnings || 0}</div>
                            <div class="project-metric-label">警告</div>
                        </div>
                        <div class="project-metric">
                            <div class="project-metric-value">${projectData.typeCoverage?.percentage || 0}%</div>
                            <div class="project-metric-label">类型覆盖率</div>
                        </div>
                        <div class="project-metric">
                            <div class="project-metric-value">${projectData.complexity?.average || 0}</div>
                            <div class="project-metric-label">复杂度</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="footer">
            <p>🤖 由 TypeScript 安全监控系统自动生成</p>
            <p>最后更新: ${timestamp}</p>
            <button class="refresh-button" onclick="window.location.reload()">🔄 刷新数据</button>
        </div>
    </div>

    <script>
        // 图表配置
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        };

        // 安全分数趋势图
        const scoreCtx = document.getElementById('scoreChart').getContext('2d');
        const scoreData = ${JSON.stringify(historicalData.map(d => ({
            x: d.date,
            y: d.score
        })))};

        new Chart(scoreCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '安全分数',
                    data: scoreData,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        max: 100,
                        title: {
                            display: true,
                            text: '分数'
                        }
                    }
                }
            }
        });

        // 错误与警告趋势图
        const errorCtx = document.getElementById('errorChart').getContext('2d');
        const errorData = ${JSON.stringify(historicalData.map(d => ({
            x: d.date,
            y: d.errors
        })))};
        const warningData = ${JSON.stringify(historicalData.map(d => ({
            x: d.date,
            y: d.warnings
        })))};

        new Chart(errorCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '错误',
                    data: errorData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4,
                    fill: false
                }, {
                    label: '警告',
                    data: warningData,
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: chartOptions
        });

        // 类型覆盖率趋势图
        const coverageCtx = document.getElementById('coverageChart').getContext('2d');
        const coverageData = ${JSON.stringify(historicalData.map(d => ({
            x: d.date,
            y: d.typeCoverage
        })))};

        new Chart(coverageCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '类型覆盖率',
                    data: coverageData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    ...chartOptions.scales,
                    y: {
                        ...chartOptions.scales.y,
                        max: 100,
                        title: {
                            display: true,
                            text: '覆盖率 (%)'
                        }
                    }
                }
            }
        });

        // 自动刷新
        setTimeout(() => {
            window.location.reload();
        }, 300000); // 5分钟刷新一次
    </script>
</body>
</html>`;
  }

  getStatusClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    return 'poor';
  }

  getTypeCoverageStatus(coverage) {
    if (coverage >= 95) return 'excellent';
    if (coverage >= 85) return 'good';
    if (coverage >= 75) return 'fair';
    return 'poor';
  }

  getComplexityStatus(complexity) {
    if (complexity <= 8) return 'excellent';
    if (complexity <= 12) return 'good';
    if (complexity <= 15) return 'fair';
    return 'poor';
  }

  getTrendIcon(historicalData) {
    if (historicalData.length < 2) return '➡️';

    const recent = historicalData.slice(-5);
    const trend = recent[recent.length - 1].score - recent[0].score;

    if (trend > 5) return '📈';
    if (trend < -5) return '📉';
    return '➡️';
  }

  getTrendText(historicalData) {
    if (historicalData.length < 2) return '数据不足';

    const recent = historicalData.slice(-5);
    const trend = recent[recent.length - 1].score - recent[0].score;

    if (trend > 5) return '改善中';
    if (trend < -5) return '恶化中';
    return '稳定';
  }

  generateDashboard() {
    console.log('🔍 正在生成 TypeScript 安全监控仪表板...');

    // 加载最新数据
    const latestReport = this.loadLatestReport();
    const historicalData = this.loadHistoricalData();

    if (!latestReport) {
      console.error('❌ 无法找到 TypeScript 安全报告');
      console.log('💡 请先运行: node scripts/typescript-safety-monitor.js');
      return false;
    }

    // 生成HTML
    const html = this.generateDashboardHTML(latestReport, historicalData);

    // 保存仪表板
    const dashboardPath = path.join(this.outputDir, 'typescript-safety-dashboard.html');
    fs.writeFileSync(dashboardPath, html);

    console.log(`✅ TypeScript 安全监控仪表板已生成`);
    console.log(`📄 仪表板路径: ${dashboardPath}`);
    console.log(`🌐 在浏览器中打开查看: file://${dashboardPath}`);

    return dashboardPath;
  }
}

// 命令行接口
async function main() {
  const dashboard = new TypeScriptDashboard();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TypeScript 安全监控仪表板生成器

Usage: node scripts/typescript-dashboard.js [options]

Options:
  --help, -h           显示帮助信息
  --output <path>      指定输出目录 (默认: reports/dashboard)
  --port <port>        启动本地服务器 (默认: 3001)
  --serve              生成后自动启动服务器

Examples:
  node scripts/typescript-dashboard.js                    # 生成仪表板
  node scripts/typescript-dashboard.js --serve          # 生成并启动服务器
  node scripts/typescript-dashboard.js --port 8080     # 指定端口启动服务器
`);
    process.exit(0);
  }

  try {
    const dashboardPath = dashboard.generateDashboard();

    if (args.includes('--serve')) {
      const port = args.includes('--port') ?
        parseInt(args[args.indexOf('--port') + 1]) : 3001;

      console.log(`🚀 启动本地服务器: http://localhost:${port}`);

      const express = require('express');
      const app = express();

      app.use(express.static(path.dirname(dashboardPath)));
      app.get('/', (req, res) => {
        res.sendFile(dashboardPath);
      });

      app.listen(port, () => {
        console.log(`🌐 服务器已启动: http://localhost:${port}`);
        console.log(`📊 TypeScript 安全监控仪表板正在运行`);
      });
    }
  } catch (error) {
    console.error('❌ 生成仪表板时发生错误:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TypeScriptDashboard;