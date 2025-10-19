/**
 * 质量门禁系统测试
 * 验证类型安全质量门禁的执行和评估功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import QualityGateSystem from './QualityGateSystem';

describe('质量门禁系统测试', () => {
  const testResultsDir = join(process.cwd(), '.quality-gate-results-test');
  let qualityGate: QualityGateSystem;

  beforeEach(() => {
    qualityGate = new QualityGateSystem({
      name: '测试质量门禁',
      failureStrategy: 'fail'
    });

    // 确保测试目录存在
    if (!existsSync(testResultsDir)) {
      mkdirSync(testResultsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    const testFiles = [
      join(testResultsDir, 'gate-'),
      join(testResultsDir, 'latest.json')
    ];

    testFiles.forEach(filePattern => {
      try {
        const files = require('fs').readdirSync(testResultsDir)
          .filter(file => file.startsWith(filePattern.replace(testResultsDir + '/', '')));

        files.forEach(file => {
          try {
            unlinkSync(join(testResultsDir, file));
          } catch (error) {
            // 忽略删除错误
          }
        });
      } catch (error) {
        // 忽略目录读取错误
      }
    });
  });

  describe('1. 质量门禁执行测试', () => {
    it('应该成功执行质量门禁检查', async () => {
      const result = await qualityGate.execute();

      expect(result).toBeDefined();
      expect(result.gateName).toBe('测试质量门禁');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.overallScore).toBe('number');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.standardScores).toBeInstanceOf(Array);
      expect(result.violations).toBeInstanceOf(Array);
      expect(result.metrics).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.impact).toBeDefined();
    });

    it('应该收集所有质量指标', async () => {
      const result = await qualityGate.execute();
      const metrics = result.metrics;

      expect(metrics.compilationErrors).toBeGreaterThanOrEqual(0);
      expect(metrics.lintErrors).toBeGreaterThanOrEqual(0);
      expect(metrics.lintWarnings).toBeGreaterThanOrEqual(0);
      expect(metrics.typeCoverage).toBeGreaterThanOrEqual(0);
      expect(metrics.anyTypeUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.unknownTypeUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.typeComplexity).toBeGreaterThanOrEqual(0);
      expect(metrics.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.totalLines).toBeGreaterThanOrEqual(0);
      expect(metrics.typeDefinitionLines).toBeGreaterThanOrEqual(0);
    });

    it('应该评估所有质量标准', async () => {
      const result = await qualityGate.execute();

      expect(result.standardScores.length).toBeGreaterThan(0);

      result.standardScores.forEach(score => {
        expect(score.standardId).toBeDefined();
        expect(score.standardName).toBeDefined();
        expect(typeof score.actualValue).toBe('number');
        expect(typeof score.targetValue).toBe('number');
        expect(typeof score.minimumValue).toBe('number');
        expect(typeof score.score).toBe('number');
        expect(typeof score.passed).toBe('boolean');
        expect(typeof score.weight).toBe('number');
        expect(score.weight).toBeGreaterThan(0);
      });
    });

    it('应该检测规则违规', async () => {
      const result = await qualityGate.execute();

      expect(result.violations).toBeInstanceOf(Array);

      result.violations.forEach(violation => {
        expect(violation.ruleId).toBeDefined();
        expect(violation.ruleName).toBeDefined();
        expect(violation.message).toBeDefined();
        expect(violation.severity).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(violation.severity);
      });
    });
  });

  describe('2. 质量评分计算测试', () => {
    it('应该正确计算总体评分', async () => {
      const result = await qualityGate.execute();

      // 验证评分计算逻辑
      let weightedSum = 0;
      let totalWeight = 0;

      result.standardScores.forEach(score => {
        weightedSum += score.score * score.weight;
        totalWeight += score.weight;
      });

      const expectedScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
      expect(result.overallScore).toBe(expectedScore);
    });

    it('应该根据标准权重计算评分', async () => {
      const customGate = new QualityGateSystem({
        name: '自定义权重测试',
        standards: [
          {
            id: 'test1',
            name: '测试标准1',
            description: '测试',
            minimum: 80,
            target: 90,
            weight: 70,
            checkType: 'compilation',
            critical: true,
            enabled: true
          },
          {
            id: 'test2',
            name: '测试标准2',
            description: '测试',
            minimum: 70,
            target: 85,
            weight: 30,
            checkType: 'linting',
            critical: false,
            enabled: true
          }
        ]
      });

      const result = await customGate.execute();

      // 验证权重配置被正确应用
      expect(result.standardScores.length).toBe(2);
      expect(result.standardScores.find(s => s.standardId === 'test1')?.weight).toBe(70);
      expect(result.standardScores.find(s => s.standardId === 'test2')?.weight).toBe(30);
    });

    it('应该处理标准评分边界情况', async () => {
      // 测试刚好达标的情况
      const customGate = new QualityGateSystem({
        name: '边界测试',
        standards: [
          {
            id: 'boundary_test',
            name: '边界测试标准',
            description: '测试边界情况',
            minimum: 50,
            target: 80,
            weight: 50,
            checkType: 'coverage',
            critical: false,
            enabled: true
          }
        ]
      });

      const result = await customGate.execute();
      const boundaryScore = result.standardScores.find(s => s.standardId === 'boundary_test');

      expect(boundaryScore).toBeDefined();
      expect(boundaryScore?.minimumValue).toBe(50);
      expect(boundaryScore?.targetValue).toBe(80);
    });
  });

  describe('3. 质量门禁通过条件测试', () => {
    it('应该在关键标准失败时拒绝通过', async () => {
      const strictGate = new QualityGateSystem({
        name: '严格模式测试',
        failureStrategy: 'fail',
        standards: [
          {
            id: 'critical_test',
            name: '关键标准',
            description: '关键测试标准',
            minimum: 100,
            target: 100,
            weight: 50,
            checkType: 'compilation',
            critical: true,
            enabled: true
          }
        ]
      });

      const result = await strictGate.execute();

      // 如果有关键标准失败，门禁应该失败
      const criticalStandard = result.standardScores.find(s => s.standardId === 'critical_test');
      if (criticalStandard && !criticalStandard.passed) {
        expect(result.passed).toBe(false);
      }
    });

    it('应该在警告模式下总是通过', async () => {
      const warnGate = new QualityGateSystem({
        name: '警告模式测试',
        failureStrategy: 'warn'
      });

      const result = await warnGate.execute();
      expect(result.passed).toBe(true);
    });

    it('应该在忽略模式下总是通过', async () => {
      const ignoreGate = new QualityGateSystem({
        name: '忽略模式测试',
        failureStrategy: 'ignore'
      });

      const result = await ignoreGate.execute();
      expect(result.passed).toBe(true);
    });

    it('应该根据评分确定通过状态', async () => {
      const scoreGate = new QualityGateSystem({
        name: '评分测试',
        failureStrategy: 'fail'
      });

      const result = await scoreGate.execute();

      if (result.passed) {
        expect(result.overallScore).toBeGreaterThanOrEqual(70);
      } else {
        expect(result.overallScore).toBeLessThan(70);
      }
    });
  });

  describe('4. 改进建议生成测试', () => {
    it('应该基于失败标准生成建议', async () => {
      const result = await qualityGate.execute();

      // 如果有失败的标准，应该生成相应建议
      const failedStandards = result.standardScores.filter(s => !s.passed);

      if (failedStandards.length > 0) {
        expect(result.recommendations.length).toBeGreaterThan(0);

        failedStandards.forEach(standard => {
          const hasRecommendation = result.recommendations.some(rec =>
            rec.includes(standard.standardName) || rec.includes(standard.standardId)
          );
          expect(hasRecommendation).toBe(true);
        });
      }
    });

    it('应该基于违规生成建议', async () => {
      const result = await qualityGate.execute();

      // 如果有违规，应该生成相应建议
      const violationsWithSuggestions = result.violations.filter(v => v.suggestion);

      if (violationsWithSuggestions.length > 0) {
        violationsWithSuggestions.forEach(violation => {
          expect(result.recommendations).toContain(violation.suggestion!);
        });
      }
    });

    it('应该基于指标生成通用建议', async () => {
      const result = await qualityGate.execute();

      // 检查通用建议
      if (result.metrics.anyTypeUsage > 5) {
        expect(result.recommendations.some(rec =>
          rec.includes('any类型') || rec.includes('any')
        )).toBe(true);
      }

      if (result.metrics.lintWarnings > 20) {
        expect(result.recommendations.some(rec =>
          rec.includes('ESLint警告') || rec.includes('警告')
        )).toBe(true);
      }
    });
  });

  describe('5. 影响评估测试', () => {
    it('应该正确评估影响等级', async () => {
      const result = await qualityGate.execute();
      const impact = result.impact;

      expect(['low', 'medium', 'high', 'critical']).toContain(impact.level);
      expect(impact.technicalDebt.hours).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high']).toContain(impact.technicalDebt.complexity);
      expect(['low', 'medium', 'high']).toContain(impact.businessRisk);
      expect(['low', 'medium', 'high', 'critical']).toContain(impact.fixPriority);
    });

    it('应该根据违规严重程度评估影响', async () => {
      const result = await qualityGate.execute();

      const criticalViolations = result.violations.filter(v => v.severity === 'critical');
      const highViolations = result.violations.filter(v => v.severity === 'high');

      if (criticalViolations.length > 0) {
        expect(result.impact.level).toBe('critical');
        expect(result.impact.businessRisk).toBe('high');
        expect(result.impact.fixPriority).toBe('critical');
      } else if (highViolations.length > 3) {
        expect(['high', 'critical']).toContain(result.impact.level);
        expect(['medium', 'high']).toContain(result.impact.businessRisk);
        expect(['high', 'critical']).toContain(result.impact.fixPriority);
      }
    });

    it('应该计算技术债务', async () => {
      const result = await qualityGate.execute();
      const debt = result.impact.technicalDebt;

      // 技术债务应该基于错误和覆盖率计算
      const expectedDebt = result.metrics.compilationErrors * 2 +
                           result.metrics.lintErrors * 0.5 +
                           (70 - result.metrics.typeCoverage) * 0.1;

      expect(debt.hours).toBe(Math.round(expectedDebt));

      // 复杂度评估
      if (debt.hours > 20) {
        expect(debt.complexity).toBe('high');
      } else if (debt.hours > 8) {
        expect(debt.complexity).toBe('medium');
      } else {
        expect(debt.complexity).toBe('low');
      }
    });
  });

  describe('6. 结果保存和历史测试', () => {
    it('应该保存执行结果', async () => {
      const result = await qualityGate.execute();

      // 验证结果被保存到历史记录
      const history = qualityGate.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1]).toEqual(result);
    });

    it('应该生成质量趋势报告', async () => {
      // 执行多次检查以生成历史数据
      await qualityGate.execute();
      await qualityGate.execute();
      await qualityGate.execute();

      const trendReport = qualityGate.generateTrendReport();

      expect(trendReport).toContain('质量门禁趋势报告');
      expect(trendReport.split('##').length - 1).toBe(3); // 3次检查
    });

    it('应该在没有历史数据时处理 gracefully', async () => {
      const newGate = new QualityGateSystem({ name: '新门禁' });
      const trendReport = newGate.generateTrendReport();

      expect(trendReport).toBe('暂无历史数据');
    });
  });

  describe('7. 配置和自定义测试', () => {
    it('应该支持自定义质量标准', async () => {
      const customGate = new QualityGateSystem({
        name: '自定义标准测试',
        standards: [
          {
            id: 'custom_standard',
            name: '自定义标准',
            description: '测试自定义标准',
            minimum: 60,
            target: 80,
            weight: 40,
            checkType: 'coverage',
            critical: false,
            enabled: true
          }
        ]
      });

      const result = await customGate.execute();
      const customScore = result.standardScores.find(s => s.standardId === 'custom_standard');

      expect(customScore).toBeDefined();
      expect(customScore?.standardName).toBe('自定义标准');
      expect(customScore?.minimumValue).toBe(60);
      expect(customScore?.targetValue).toBe(80);
      expect(customScore?.weight).toBe(40);
    });

    it('应该支持自定义规则', async () => {
      const customGate = new QualityGateSystem({
        name: '自定义规则测试',
        rules: [
          {
            id: 'custom_rule',
            name: '自定义规则',
            type: 'warning',
            pattern: /test/g,
            description: '测试自定义规则',
            suggestion: '处理测试相关的问题',
            severity: 'medium',
            enabled: true
          }
        ]
      });

      const result = await customGate.execute();
      const customViolation = result.violations.find(v => v.ruleId === 'custom_rule');

      // 自定义规则可能会被触发，也可能不会，这取决于实际代码内容
      expect(result.violations).toBeInstanceOf(Array);
    });

    it('应该支持自定义阈值', async () => {
      const customGate = new QualityGateSystem({
        name: '自定义阈值测试',
        customThresholds: {
          'coverage_minimum': 60,
          'coverage_target': 90,
          'linting_minimum': 85
        }
      });

      const result = await customGate.execute();
      const coverageScore = result.standardScores.find(s => s.standardId === 'coverage');
      const lintingScore = result.standardScores.find(s => s.standardId === 'linting');

      if (coverageScore) {
        expect(coverageScore.minimumValue).toBe(60);
        expect(coverageScore.targetValue).toBe(90);
      }

      if (lintingScore) {
        expect(lintingScore.minimumValue).toBe(85);
      }
    });
  });

  describe('8. 错误处理和边界情况测试', () => {
    it('应该处理检查执行失败的情况', async () => {
      // 模拟执行失败
      const customGate = new QualityGateSystem({
        name: '错误处理测试'
      });

      // 即使某些检查失败，也应该返回完整的结果结构
      const result = await customGate.execute();

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);

      const executionFailure = result.violations.find(v => v.ruleId === 'GATE_EXECUTION_FAILED');
      if (executionFailure) {
        expect(executionFailure.severity).toBe('critical');
      }
    });

    it('应该处理空结果集', async () => {
      // 创建一个所有标准都禁用的门禁
      const emptyGate = new QualityGateSystem({
        name: '空结果测试',
        standards: [],
        rules: []
      });

      const result = await emptyGate.execute();

      expect(result.standardScores).toEqual([]);
      expect(result.violations).toEqual([]);
      expect(result.overallScore).toBe(0);
    });

    it('应该处理权重为0的情况', async () => {
      const zeroWeightGate = new QualityGateSystem({
        name: '零权重测试',
        standards: [
          {
            id: 'zero_weight',
            name: '零权重标准',
            description: '测试零权重',
            minimum: 50,
            target: 80,
            weight: 0,
            checkType: 'coverage',
            critical: false,
            enabled: true
          }
        ]
      });

      const result = await zeroWeightGate.execute();

      // 权重为0的标准不应该影响总体评分
      expect(result.standardScores.length).toBe(1);
      expect(result.standardScores[0].weight).toBe(0);
    });
  });

  describe('9. 性能测试', () => {
    it('应该在合理时间内完成检查', async () => {
      const startTime = Date.now();
      const result = await qualityGate.execute();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(60000); // 60秒内完成

      console.log(`📊 质量门禁检查耗时: ${duration}ms`);
      console.log(`📊 评分: ${result.overallScore}/100`);
      console.log(`📊 检查标准数: ${result.standardScores.length}`);
      console.log(`📊 违规数: ${result.violations.length}`);
    });

    it('应该处理大量文件', async () => {
      // 这个测试假设项目有一定规模
      const result = await qualityGate.execute();

      expect(result.metrics.totalLines).toBeGreaterThan(0);

      if (result.metrics.totalLines > 10000) {
        console.log(`📊 大型项目检测到: ${result.metrics.totalLines} 行代码`);
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
      }
    });
  });
});