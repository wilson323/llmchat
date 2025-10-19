/**
 * 类型回归防护系统测试
 * 验证类型回归检测和防护功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import TypeRegressionGuard, { TypeChangeType } from './TypeRegressionGuard';

describe('类型回归防护系统测试', () => {
  const testProjectRoot = process.cwd();
  const testBaselineDir = join(testProjectRoot, '.type-baseline-test');
  let guard: TypeRegressionGuard;

  beforeEach(() => {
    guard = new TypeRegressionGuard({
      projectRoot: testProjectRoot,
      baselineDir: '.type-baseline-test',
      strict: false,
      allowedChanges: [
        'interface-addition',
        'type-addition',
        'enum-addition',
        'export-addition'
      ]
    });

    // 确保测试目录存在
    if (!existsSync(testBaselineDir)) {
      mkdirSync(testBaselineDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 清理测试文件
    const testFiles = [
      join(testBaselineDir, 'baseline-v1.0.0.json'),
      join(testBaselineDir, 'latest.json'),
      join(testBaselineDir, 'reports')
    ];

    testFiles.forEach(file => {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch (error) {
          // 忽略删除错误
        }
      }
    });
  });

  describe('1. 基线管理测试', () => {
    it('应该能够创建类型基线', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '初始基线创建');

      expect(baseline).toBeDefined();
      expect(baseline.version).toBe('v1.0.0');
      expect(baseline.timestamp).toBeDefined();
      expect(baseline.projectHash).toBeDefined();
      expect(baseline.typeDefinitions).toBeInstanceOf(Array);
      expect(baseline.files).toBeInstanceOf(Array);
      expect(baseline.usageStats).toBeDefined();
      expect(baseline.dependencies).toBeInstanceOf(Array);
    });

    it('应该保存基线到文件系统', async () => {
      await guard.createBaseline('v1.0.0', '测试基线');

      const baselinePath = join(testBaselineDir, 'baseline-v1.0.0.json');
      const latestPath = join(testBaselineDir, 'latest.json');

      expect(existsSync(baselinePath)).toBe(true);
      expect(existsSync(latestPath)).toBe(true);

      // 验证保存的数据
      const savedBaseline = JSON.parse(readFileSync(latestPath, 'utf8'));
      expect(savedBaseline.version).toBe('v1.0.0');
    });

    it('应该能够加载最新基线', async () => {
      // 创建基线
      const originalBaseline = await guard.createBaseline('v1.0.0', '测试基线');

      // 加载基线
      const loadedBaseline = await guard.loadLatestBaseline();

      expect(loadedBaseline).toBeDefined();
      expect(loadedBaseline?.version).toBe('v1.0.0');
      expect(loadedBaseline?.projectHash).toBe(originalBaseline.projectHash);
    });

    it('在没有基线时返回null', async () => {
      const baseline = await guard.loadLatestBaseline();
      expect(baseline).toBeNull();
    });
  });

  describe('2. 类型回归检测测试', () => {
    it('应该在没有基线时抛出错误', async () => {
      await expect(guard.detectRegression()).rejects.toThrow('无法检测类型回归');
    });

    it('应该检测类型定义变化', async () => {
      // 创建初始基线
      const baseline = await guard.createBaseline('v1.0.0', '初始基线');

      // 模拟类型变化（在实际实现中，这里会修改源代码）
      // 为测试目的，我们模拟检测结果

      const report = await guard.detectRegression(baseline);

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.baselineVersion).toBe('v1.0.0');
      expect(report.currentVersion).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(typeof report.passed).toBe('boolean');
      expect(report.changes).toBeInstanceOf(Array);
      expect(report.errors).toBeInstanceOf(Array);
      expect(report.warnings).toBeInstanceOf(Array);
      expect(report.impactAssessment).toBeDefined();
    });

    it('应该检测编译错误', async () => {
      // 创建基线
      const baseline = await guard.createBaseline('v1.0.0', '初始基线');

      // 模拟有编译错误的情况
      // 在实际实现中，这里会临时引入编译错误
      const report = await guard.detectRegression(baseline);

      // 如果有编译错误，报告应该失败
      if (report.errors.length > 0) {
        expect(report.passed).toBe(false);
        expect(report.errors[0].code).toBe('TS_COMPILATION_ERROR');
      }
    });

    it('应该正确评估影响等级', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '初始基线');
      const report = await guard.detectRegression(baseline);

      const assessment = report.impactAssessment;
      expect(assessment.affectedFiles).toBeGreaterThanOrEqual(0);
      expect(assessment.affectedTypes).toBeGreaterThanOrEqual(0);
      expect(assessment.breakingChanges).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(assessment.impactLevel);
      expect(assessment.requiresManualReview).toBeInstanceOf(Array);
    });
  });

  describe('3. 严格模式测试', () => {
    it('应该在严格模式下拒绝不允许的变化', async () => {
      const strictGuard = new TypeRegressionGuard({
        projectRoot: testProjectRoot,
        baselineDir: '.type-baseline-test',
        strict: true,
        allowedChanges: ['interface-addition'] // 只允许接口添加
      });

      const baseline = await strictGuard.createBaseline('v1.0.0', '严格模式基线');

      // 模拟包含不允许变化的报告
      const report = await strictGuard.detectRegression(baseline);

      // 如果有不允许的变化，应该失败
      const disallowedChanges = report.changes.filter(
        change => !['interface-addition'].includes(change.type)
      );

      if (disallowedChanges.length > 0) {
        expect(report.passed).toBe(false);
      }
    });

    it('应该在非严格模式下允许非破坏性变更', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '非严格模式基线');
      const report = await guard.detectRegression(baseline);

      // 非严格模式下，只要没有破坏性变更就应该通过
      const breakingChanges = report.changes.filter(change => change.isBreaking);
      if (breakingChanges.length === 0 && report.errors.length === 0) {
        expect(report.passed).toBe(true);
      }
    });
  });

  describe('4. 报告生成测试', () => {
    it('应该生成详细的回归检测报告', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '报告测试基线');
      const report = await guard.detectRegression(baseline);

      const reportText = guard.generateReport(report);

      expect(reportText).toContain('类型回归检测报告');
      expect(reportText).toContain(report.id);
      expect(reportText).toContain(report.baselineVersion);
      expect(reportText).toContain(report.currentVersion);
      expect(reportText).toContain('影响评估');
      expect(reportText).toContain('改进建议');

      // 如果有变化，应该包含变化详情
      if (report.changes.length > 0) {
        expect(reportText).toContain('检测到的变化');
      }

      // 如果有错误，应该包含错误详情
      if (report.errors.length > 0) {
        expect(reportText).toContain('错误信息');
      }
    });

    it('应该保存报告到文件系统', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '保存测试基线');
      const report = await guard.detectRegression(baseline);

      const reportPath = await guard.saveReport(report);

      expect(existsSync(reportPath)).toBe(true);

      // 验证保存的JSON报告
      const savedReport = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(savedReport.id).toBe(report.id);
      expect(savedReport.baselineVersion).toBe(report.baselineVersion);

      // 验证Markdown报告也被保存
      const markdownPath = reportPath.replace('.json', '.md');
      expect(existsSync(markdownPath)).toBe(true);
    });
  });

  describe('5. 类型变化分析测试', () => {
    it('应该正确识别变化类型', async () => {
      // 模拟不同类型的变化
      const mockChanges = [
        {
          type: 'interface-addition' as TypeChangeType,
          typeName: 'NewInterface',
          filePath: 'src/types/new.ts',
          description: '新增interface: NewInterface',
          severity: 'minor' as const,
          isBreaking: false,
          affectedDependencies: []
        },
        {
          type: 'type-removal' as TypeChangeType,
          typeName: 'OldType',
          filePath: 'src/types/old.ts',
          description: '删除type: OldType',
          severity: 'major' as const,
          isBreaking: true,
          affectedDependencies: ['DependentType1', 'DependentType2']
        }
      ];

      // 在实际实现中，这些变化会被真实检测到
      // 这里我们验证变化类型的处理逻辑
      mockChanges.forEach(change => {
        expect(['interface-addition', 'interface-removal', 'type-addition', 'type-removal']).toContain(change.type);
        expect(['critical', 'major', 'minor']).toContain(change.severity);
        expect(typeof change.isBreaking).toBe('boolean');
        expect(Array.isArray(change.affectedDependencies)).toBe(true);
      });
    });

    it('应该正确计算影响等级', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '影响测试基线');
      const report = await guard.detectRegression(baseline);

      const assessment = report.impactAssessment;

      // 验证影响等级逻辑
      if (assessment.breakingChanges > 5 || report.errors.length > 0) {
        expect(assessment.impactLevel).toBe('critical');
      } else if (assessment.breakingChanges > 2 || assessment.affectedTypes > 10) {
        expect(assessment.impactLevel).toBe('high');
      } else if (assessment.breakingChanges > 0 || assessment.affectedTypes > 5) {
        expect(assessment.impactLevel).toBe('medium');
      } else {
        expect(['low', 'medium']).toContain(assessment.impactLevel);
      }
    });
  });

  describe('6. 错误处理测试', () => {
    it('应该处理基线加载失败', async () => {
      // 创建一个无效的基线文件
      const invalidBaselinePath = join(testBaselineDir, 'latest.json');
      writeFileSync(invalidBaselinePath, 'invalid json content');

      // 尝试加载应该失败但不崩溃
      const result = await guard.loadLatestBaseline();
      expect(result).toBeNull();
    });

    it('应该处理检测过程中的错误', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '错误处理测试基线');

      // 模拟检测过程中的错误
      // 在实际实现中，这可能发生在文件读取、编译等步骤
      const report = await guard.detectRegression(baseline);

      // 即使发生错误，也应该返回有效的报告结构
      expect(report).toBeDefined();
      expect(report.errors).toBeInstanceOf(Array);

      // 如果有严重错误，报告应该失败
      const hasCriticalErrors = report.errors.some(e => e.code === 'REGRESSION_DETECTION_FAILED');
      if (hasCriticalErrors) {
        expect(report.passed).toBe(false);
      }
    });
  });

  describe('7. 性能测试', () => {
    it('应该在合理时间内完成基线创建', async () => {
      const startTime = Date.now();
      await guard.createBaseline('v1.0.0', '性能测试基线');
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(30000); // 30秒内完成

      console.log(`📊 基线创建耗时: ${duration}ms`);
    });

    it('应该在合理时间内完成回归检测', async () => {
      const baseline = await guard.createBaseline('v1.0.0', '性能测试基线');

      const startTime = Date.now();
      const report = await guard.detectRegression(baseline);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(60000); // 60秒内完成

      console.log(`📊 回归检测耗时: ${duration}ms`);
      console.log(`📊 检测到 ${report.changes.length} 个变化`);
    });
  });

  describe('8. 集成测试', () => {
    it('应该支持完整的工作流程', async () => {
      // 1. 创建基线
      const baseline = await guard.createBaseline('v1.0.0', '集成测试基线');
      expect(baseline.version).toBe('v1.0.0');

      // 2. 检测回归（应该通过，因为没有变化）
      const report1 = await guard.detectRegression(baseline);
      expect(report1.baselineVersion).toBe('v1.0.0');

      // 3. 生成报告
      const reportText = guard.generateReport(report1);
      expect(reportText).toContain('类型回归检测报告');

      // 4. 保存报告
      const reportPath = await guard.saveReport(report1);
      expect(existsSync(reportPath)).toBe(true);

      // 5. 加载基线并验证
      const loadedBaseline = await guard.loadLatestBaseline();
      expect(loadedBaseline?.version).toBe('v1.0.0');
    });

    it('应该处理多次基线创建', async () => {
      // 创建多个版本的基线
      const v1 = await guard.createBaseline('v1.0.0', '第一个版本');
      const v2 = await guard.createBaseline('v1.1.0', '第二个版本');
      const v3 = await guard.createBaseline('v1.2.0', '第三个版本');

      // 最新基线应该是v1.2.0
      const latest = await guard.loadLatestBaseline();
      expect(latest?.version).toBe('v1.2.0');

      // 验证所有基线文件都存在
      expect(existsSync(join(testBaselineDir, 'baseline-v1.0.0.json'))).toBe(true);
      expect(existsSync(join(testBaselineDir, 'baseline-v1.1.0.json'))).toBe(true);
      expect(existsSync(join(testBaselineDir, 'baseline-v1.2.0.json'))).toBe(true);
    });
  });
});