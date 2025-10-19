/**
 * 类型覆盖率监控测试
 * 定期检查和分析类型覆盖率指标
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import TypeCoverageAnalyzer, { type TypeCoverageMetrics } from './TypeCoverageAnalyzer';

describe('类型覆盖率监控测试', () => {
  const testProjectRoot = process.cwd();
  const coverageDataPath = join(testProjectRoot, 'type-coverage-data.json');
  let analyzer: TypeCoverageAnalyzer;

  beforeEach(() => {
    analyzer = new TypeCoverageAnalyzer({
      projectRoot: testProjectRoot,
      srcDir: 'src',
      excludePatterns: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        '**/dist/**'
      ]
    });
  });

  afterEach(() => {
    // 清理测试文件
    if (existsSync(coverageDataPath)) {
      unlinkSync(coverageDataPath);
    }
  });

  describe('1. 类型覆盖率分析测试', () => {
    it('应该能够分析项目类型覆盖率', async () => {
      const metrics = await analyzer.analyzeCoverage();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalFiles).toBe('number');
      expect(typeof metrics.overallCoverage).toBe('number');
      expect(typeof metrics.typeUsageStats.interfaces).toBe('number');
      expect(typeof metrics.coverageByFileType).toBe('object');

      // 基本验证
      expect(metrics.totalFiles).toBeGreaterThan(0);
      expect(metrics.overallCoverage).toBeGreaterThanOrEqual(0);
      expect(metrics.overallCoverage).toBeLessThanOrEqual(100);
    });

    it('应该识别不同类型的文件', async () => {
      const metrics = await analyzer.analyzeCoverage();

      // 应该有不同类型的文件
      const fileTypes = Object.keys(metrics.coverageByFileType);
      expect(fileTypes.length).toBeGreaterThan(0);

      // 常见的文件类型应该存在
      const expectedTypes = ['components', 'types', 'hooks', 'store', 'services'];
      const hasExpectedTypes = expectedTypes.some(type => fileTypes.includes(type));
      expect(hasExpectedTypes).toBe(true);
    });

    it('应该统计类型使用情况', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const stats = metrics.typeUsageStats;

      expect(stats.interfaces).toBeGreaterThanOrEqual(0);
      expect(stats.typeAliases).toBeGreaterThanOrEqual(0);
      expect(stats.enums).toBeGreaterThanOrEqual(0);
      expect(stats.generics).toBeGreaterThanOrEqual(0);
      expect(stats.anyTypes).toBeGreaterThanOrEqual(0);
      expect(stats.unknownTypes).toBeGreaterThanOrEqual(0);
      expect(stats.typeAssertions).toBeGreaterThanOrEqual(0);
      expect(stats.typeGuards).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. 类型覆盖率质量评估测试', () => {
    it('应该生成质量评分', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const report = analyzer.generateReport(metrics);

      expect(report).toContain('质量评分');
      expect(report).toContain('/100');
      expect(report).toContain('建议');
    });

    it('应该识别类型覆盖率问题', async () => {
      const metrics = await analyzer.analyzeCoverage();

      // 检查是否有低覆盖率的文件类型
      Object.entries(metrics.coverageByFileType).forEach(([type, coverage]) => {
        if (coverage < 40) {
          console.warn(`⚠️ ${type} 文件类型覆盖率较低: ${coverage.toFixed(2)}%`);
        }
      });

      // 检查any类型使用
      const anyRatio = metrics.typeUsageStats.anyTypes / metrics.totalLines;
      if (anyRatio > 0.02) {
        console.warn(`⚠️ any类型使用比例较高: ${(anyRatio * 100).toFixed(2)}%`);
      }
    });

    it('应该提供改进建议', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const report = analyzer.generateReport(metrics);

      expect(report).toContain('建议');

      // 如果覆盖率低，应该有改进建议
      if (metrics.overallCoverage < 80) {
        expect(report).toContain('提高');
      }

      // 如果any类型使用多，应该有相关建议
      const anyRatio = metrics.typeUsageStats.anyTypes / metrics.totalLines;
      if (anyRatio > 0.01) {
        expect(report).toContain('any');
      }
    });
  });

  describe('3. 类型覆盖率趋势分析测试', () => {
    it('应该保存和加载覆盖率数据', async () => {
      // 第一次分析
      const metrics1 = await analyzer.analyzeCoverage();
      await analyzer.saveCoverageData(coverageDataPath);

      expect(existsSync(coverageDataPath)).toBe(true);

      // 验证保存的数据
      const savedData = JSON.parse(readFileSync(coverageDataPath, 'utf8'));
      expect(savedData.timestamp).toBeDefined();
      expect(savedData.metrics).toBeDefined();
      expect(savedData.files).toBeDefined();
      expect(savedData.metrics.totalFiles).toBe(metrics1.totalFiles);
    });

    it('应该生成趋势报告', async () => {
      // 创建多个时间点的数据
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const mockData = [
        {
          timestamp: twoDaysAgo.toISOString(),
          metrics: {
            overallCoverage: 65.5,
            totalFiles: 100,
            typeUsageStats: { anyTypes: 50, interfaces: 20 }
          }
        },
        {
          timestamp: yesterday.toISOString(),
          metrics: {
            overallCoverage: 72.3,
            totalFiles: 105,
            typeUsageStats: { anyTypes: 45, interfaces: 25 }
          }
        },
        {
          timestamp: now.toISOString(),
          metrics: {
            overallCoverage: 78.9,
            totalFiles: 110,
            typeUsageStats: { anyTypes: 40, interfaces: 30 }
          }
        }
      ];

      writeFileSync(coverageDataPath, JSON.stringify(mockData, null, 2));

      // 生成趋势报告
      const trendReport = generateTrendReport(coverageDataPath);

      expect(trendReport).toContain('类型覆盖率趋势');
      expect(trendReport).toContain('📈');
      expect(trendReport).toContain('变化趋势');
    });
  });

  describe('4. 类型覆盖率阈值检查测试', () => {
    it('应该检查覆盖率是否达到最低要求', async () => {
      const metrics = await analyzer.analyzeCoverage();

      // 定义最低要求
      const thresholds = {
        overallCoverage: 70, // 总体覆盖率至少70%
        componentCoverage: 80, // 组件覆盖率至少80%
        typeFileCoverage: 90, // 类型文件覆盖率至少90%
        anyTypeRatio: 0.02 // any类型使用比例不超过2%
      };

      const violations: string[] = [];

      // 检查总体覆盖率
      if (metrics.overallCoverage < thresholds.overallCoverage) {
        violations.push(
          `总体覆盖率 ${metrics.overallCoverage.toFixed(2)}% 低于要求 ${thresholds.overallCoverage}%`
        );
      }

      // 检查组件覆盖率
      const componentCoverage = metrics.coverageByFileType['components'] || 0;
      if (componentCoverage < thresholds.componentCoverage) {
        violations.push(
          `组件覆盖率 ${componentCoverage.toFixed(2)}% 低于要求 ${thresholds.componentCoverage}%`
        );
      }

      // 检查类型文件覆盖率
      const typeCoverage = metrics.coverageByFileType['types'] || 0;
      if (typeCoverage < thresholds.typeFileCoverage) {
        violations.push(
          `类型文件覆盖率 ${typeCoverage.toFixed(2)}% 低于要求 ${thresholds.typeFileCoverage}%`
        );
      }

      // 检查any类型使用比例
      const anyRatio = metrics.typeUsageStats.anyTypes / metrics.totalLines;
      if (anyRatio > thresholds.anyTypeRatio) {
        violations.push(
          `any类型使用比例 ${(anyRatio * 100).toFixed(2)}% 超过要求 ${(thresholds.anyTypeRatio * 100).toFixed(2)}%`
        );
      }

      // 输出违规项
      if (violations.length > 0) {
        console.warn('⚠️ 类型覆盖率阈值检查失败:');
        violations.forEach(violation => console.warn(`  - ${violation}`));
      }

      // 如果有严重违规，测试应该失败
      const criticalViolations = violations.filter(v =>
        v.includes('总体覆盖率') || v.includes('组件覆盖率')
      );

      if (criticalViolations.length > 0) {
        expect.fail(`严重类型覆盖率问题: ${criticalViolations.join(', ')}`);
      }
    });

    it('应该提供覆盖率改进建议', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const suggestions = generateCoverageSuggestions(metrics);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      // 验证建议格式
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('category');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('effort');
      });
    });
  });

  describe('5. 类型覆盖率报告生成测试', () => {
    it('应该生成完整的HTML报告', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const htmlReport = generateHTMLReport(metrics);

      expect(htmlReport).toContain('<html>');
      expect(htmlReport).toContain('</html>');
      expect(htmlReport).toContain('TypeScript 类型覆盖率报告');
      expect(htmlReport).toContain('<canvas'); // 图表元素
    });

    it('应该生成JSON格式的报告数据', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const jsonReport = generateJSONReport(metrics);

      expect(() => JSON.parse(jsonReport)).not.toThrow();

      const parsed = JSON.parse(jsonReport);
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('details');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('应该生成适合CI/CD的输出格式', async () => {
      const metrics = await analyzer.analyzeCoverage();
      const ciOutput = generateCIOutput(metrics);

      // GitHub Actions格式
      expect(ciOutput).toContain('::set-output');
      expect(ciOutput).toContain('coverage=');
      expect(ciOutput).toContain('files_with_types=');

      // 或者简单格式
      expect(ciOutput).toContain('COVERAGE:');
      expect(ciOutput).toContain('STATUS:');
    });
  });

  describe('6. 类型覆盖率性能测试', () => {
    it('应该在合理时间内完成分析', async () => {
      const startTime = Date.now();
      const metrics = await analyzer.analyzeCoverage();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(30000); // 30秒内完成

      console.log(`📊 类型覆盖率分析耗时: ${duration}ms`);
      console.log(`📊 分析了 ${metrics.totalFiles} 个文件`);
      console.log(`📊 平均每个文件耗时: ${(duration / metrics.totalFiles).toFixed(2)}ms`);
    });

    it('应该处理大型项目', async () => {
      // 这个测试假设项目有一定规模
      const metrics = await analyzer.analyzeCoverage();

      expect(metrics.totalFiles).toBeGreaterThan(10); // 至少10个文件
      expect(metrics.totalLines).toBeGreaterThan(1000); // 至少1000行代码

      if (metrics.totalFiles > 100) {
        console.log(`📊 大型项目检测到: ${metrics.totalFiles} 个文件`);
        expect(metrics.overallCoverage).toBeGreaterThan(50); // 大型项目应该有基本类型覆盖
      }
    });
  });
});

/**
 * 生成趋势报告
 */
function generateTrendReport(dataPath: string): string {
  if (!existsSync(dataPath)) {
    return '❌ 没有历史数据，无法生成趋势报告';
  }

  const data = JSON.parse(readFileSync(dataPath, 'utf8'));

  let report = `# 📈 类型覆盖率趋势报告\n\n`;

  if (Array.isArray(data) && data.length > 1) {
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    const coverageChange = latest.metrics.overallCoverage - previous.metrics.overallCoverage;
    const filesChange = latest.metrics.totalFiles - previous.metrics.totalFiles;
    const anyChange = latest.metrics.typeUsageStats.anyTypes - previous.metrics.typeUsageStats.anyTypes;

    report += `## 📊 覆盖率变化\n\n`;
    report += `- **总体覆盖率**: ${previous.metrics.overallCoverage.toFixed(2)}% → ${latest.metrics.overallCoverage.toFixed(2)}% (${coverageChange >= 0 ? '+' : ''}${coverageChange.toFixed(2)}%)\n`;
    report += `- **文件数量**: ${previous.metrics.totalFiles} → ${latest.metrics.totalFiles} (${filesChange >= 0 ? '+' : ''}${filesChange})\n`;
    report += `- **any类型使用**: ${previous.metrics.typeUsageStats.anyTypes} → ${latest.metrics.typeUsageStats.anyTypes} (${anyChange >= 0 ? '+' : ''}${anyChange})\n\n`;

    // 趋势判断
    if (coverageChange > 5) {
      report += `🟢 **趋势**: 覆盖率显著提升！\n`;
    } else if (coverageChange > 0) {
      report += `🟡 **趋势**: 覆盖率轻微提升\n`;
    } else if (coverageChange < -5) {
      report += `🔴 **趋势**: 覆盖率显著下降，需要关注！\n`;
    } else {
      report += `🟡 **趋势**: 覆盖率保持稳定\n`;
    }
  }

  return report;
}

/**
 * 生成覆盖率改进建议
 */
interface CoverageSuggestion {
  category: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
}

function generateCoverageSuggestions(metrics: TypeCoverageMetrics): CoverageSuggestion[] {
  const suggestions: CoverageSuggestion[] = [];

  // 总体覆盖率建议
  if (metrics.overallCoverage < 70) {
    suggestions.push({
      category: '总体覆盖率',
      description: '项目的总体类型覆盖率过低，需要系统性地增加类型定义',
      priority: 'high',
      effort: 'high'
    });
  } else if (metrics.overallCoverage < 85) {
    suggestions.push({
      category: '总体覆盖率',
      description: '类型覆盖率还有提升空间，建议重点改善低覆盖率文件',
      priority: 'medium',
      effort: 'medium'
    });
  }

  // any类型使用建议
  const anyRatio = metrics.typeUsageStats.anyTypes / metrics.totalLines;
  if (anyRatio > 0.02) {
    suggestions.push({
      category: '类型安全',
      description: 'any类型使用过多，建议替换为具体类型或unknown类型',
      priority: 'high',
      effort: 'medium'
    });
  }

  // 组件类型建议
  const componentCoverage = metrics.coverageByFileType['components'] || 0;
  if (componentCoverage < 80) {
    suggestions.push({
      category: '组件类型',
      description: 'React组件缺少完整的Props类型定义',
      priority: 'high',
      effort: 'medium'
    });
  }

  // API类型建议
  const apiCoverage = metrics.coverageByFileType['services'] || 0;
  if (apiCoverage < 70) {
    suggestions.push({
      category: 'API类型',
      description: 'API服务缺少请求和响应类型定义',
      priority: 'medium',
      effort: 'medium'
    });
  }

  // 类型文件组织建议
  const typeFileRatio = metrics.typeFiles / metrics.totalFiles;
  if (typeFileRatio < 0.05) {
    suggestions.push({
      category: '代码组织',
      description: '建议创建专门的类型定义文件，提高代码组织性',
      priority: 'low',
      effort: 'low'
    });
  }

  return suggestions;
}

/**
 * 生成HTML报告
 */
function generateHTMLReport(metrics: TypeCoverageMetrics): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript 类型覆盖率报告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .high { background-color: #d4edda; }
        .medium { background-color: #fff3cd; }
        .low { background-color: #f8d7da; }
        canvas { max-width: 400px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>TypeScript 类型覆盖率报告</h1>

    <div class="metric ${getCoverageClass(metrics.overallCoverage)}">
        <h2>总体覆盖率: ${metrics.overallCoverage.toFixed(2)}%</h2>
    </div>

    <h3>按文件类型分布</h3>
    <canvas id="fileTypeChart"></canvas>

    <h3>类型使用统计</h3>
    <div class="metric">
        <p>接口: ${metrics.typeUsageStats.interfaces}</p>
        <p>类型别名: ${metrics.typeUsageStats.typeAliases}</p>
        <p>枚举: ${metrics.typeUsageStats.enums}</p>
        <p>泛型: ${metrics.typeUsageStats.generics}</p>
        <p>any类型: ${metrics.typeUsageStats.anyTypes} ⚠️</p>
    </div>

    <script>
        // 文件类型覆盖率图表
        const ctx = document.getElementById('fileTypeChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(Object.keys(metrics.coverageByFileType))},
                datasets: [{
                    label: '覆盖率 (%)',
                    data: ${JSON.stringify(Object.values(metrics.coverageByFileType))},
                    backgroundColor: ${JSON.stringify(Object.values(metrics.coverageByFileType).map(getCoverageColor))}
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    </script>
</body>
</html>`;
}

/**
 * 生成JSON报告
 */
function generateJSONReport(metrics: TypeCoverageMetrics): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      overallCoverage: metrics.overallCoverage,
      totalFiles: metrics.totalFiles,
      filesWithTypes: metrics.filesWithTypes,
      qualityScore: calculateQualityScore(metrics)
    },
    metrics,
    details: {
      coverageByFileType: metrics.coverageByFileType,
      typeUsageStats: metrics.typeUsageStats
    }
  }, null, 2);
}

/**
 * 生成CI/CD输出
 */
function generateCIOutput(metrics: TypeCoverageMetrics): string {
  const status = metrics.overallCoverage >= 70 ? 'PASS' : 'FAIL';

  return `::set-output name=coverage::${metrics.overallCoverage.toFixed(2)}
::set-output name=files_with_types::${metrics.filesWithTypes}
::set-output name=total_files::${metrics.totalFiles}
::set-output name=status::${status}

COVERAGE: ${metrics.overallCoverage.toFixed(2)}%
FILES WITH TYPES: ${metrics.filesWithTypes}/${metrics.totalFiles}
STATUS: ${status}`;

  // 或者简单格式
  // `COVERAGE: ${metrics.overallCoverage.toFixed(2)}% | STATUS: ${status}`;
}

/**
 * 获取覆盖率等级样式
 */
function getCoverageClass(coverage: number): string {
  if (coverage >= 80) return 'high';
  if (coverage >= 60) return 'medium';
  return 'low';
}

/**
 * 获取覆盖率颜色
 */
function getCoverageColor(coverage: number): string {
  if (coverage >= 80) return '#28a745';
  if (coverage >= 60) return '#ffc107';
  return '#dc3545';
}

/**
 * 计算质量评分
 */
function calculateQualityScore(metrics: TypeCoverageMetrics): number {
  let score = 0;

  // 覆盖率评分 (60%)
  score += (metrics.overallCoverage / 100) * 60;

  // any类型使用评分 (20%)
  const anyRatio = metrics.typeUsageStats.anyTypes / metrics.totalLines;
  score += Math.max(0, (1 - anyRatio * 10)) * 20;

  // 类型多样性评分 (20%)
  const diversity =
    (metrics.typeUsageStats.interfaces > 0 ? 5 : 0) +
    (metrics.typeUsageStats.typeAliases > 0 ? 5 : 0) +
    (metrics.typeUsageStats.enums > 0 ? 5 : 0) +
    (metrics.typeUsageStats.generics > 0 ? 5 : 0);
  score += (diversity / 20) * 20;

  return Math.round(score);
}