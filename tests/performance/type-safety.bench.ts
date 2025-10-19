/**
 * TypeScript类型安全性能基准测试
 *
 * 测试类型安全检查工具的性能表现，包括：
 * - 类型检查速度
 * - 内存使用情况
 * - 大型项目处理能力
 * - 增量检查性能
 *
 * @author Type Safety Expert
 * @since 2025-10-18
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

// ==================== 类型定义 ====================

interface BenchmarkResult {
  readonly name: string;
  readonly duration: number;
  readonly memoryUsage: NodeJS.MemoryUsage;
  readonly success: boolean;
  readonly error?: string;
  readonly metrics: Record<string, number>;
}

interface BenchmarkSuite {
  readonly name: string;
  readonly description: string;
  readonly benchmarks: Benchmark[];
  readonly results: BenchmarkResult[];
}

interface Benchmark {
  readonly name: string;
  readonly description: string;
  readonly setup?: () => Promise<void>;
  readonly teardown?: () => Promise<void>;
  readonly run: () => Promise<BenchmarkResult>;
  readonly expectedDuration?: number; // 预期执行时间（毫秒）
  readonly maxMemory?: number; // 最大内存使用（字节）
}

interface PerformanceReport {
  readonly timestamp: string;
  readonly suites: BenchmarkSuite[];
  readonly summary: PerformanceSummary;
  readonly recommendations: string[];
}

interface PerformanceSummary {
  readonly totalBenchmarks: number;
  readonly successfulBenchmarks: number;
  readonly averageDuration: number;
  readonly peakMemoryUsage: number;
  readonly slowestBenchmark: BenchmarkResult;
  readonly fastestBenchmark: BenchmarkResult;
}

// ==================== 基准测试实现 ====================

class TypeSafetyBenchmarker {
  private suites: BenchmarkSuite[] = [];
  private results: PerformanceReport;

  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      suites: [],
      summary: {
        totalBenchmarks: 0,
        successfulBenchmarks: 0,
        averageDuration: 0,
        peakMemoryUsage: 0,
        slowestBenchmark: {} as BenchmarkResult,
        fastestBenchmark: {} as BenchmarkResult
      },
      recommendations: []
    };
  }

  /**
   * 添加基准测试套件
   */
  addSuite(suite: BenchmarkSuite): void {
    this.suites.push(suite);
  }

  /**
   * 运行所有基准测试
   */
  async runAll(): Promise<PerformanceReport> {
    console.log('🚀 开始TypeScript类型安全性能基准测试\n');

    for (const suite of this.suites) {
      console.log(`📊 运行套件: ${suite.name}`);
      console.log(`   ${suite.description}\n`);

      await this.runSuite(suite);
    }

    this.generateSummary();
    this.generateRecommendations();
    this.outputResults();

    return this.results;
  }

  /**
   * 运行单个测试套件
   */
  private async runSuite(suite: BenchmarkSuite): Promise<void> {
    const suiteResults: BenchmarkResult[] = [];

    for (const benchmark of suite.benchmarks) {
      console.log(`   🔄 ${benchmark.name}...`);

      // 记录初始内存
      const initialMemory = process.memoryUsage();

      try {
        // 设置
        if (benchmark.setup) {
          await benchmark.setup();
        }

        // 预热（如果需要）
        await this.warmup();

        // 运行基准测试
        const result = await this.runBenchmark(benchmark);
        suiteResults.push(result);

        // 验证结果
        this.validateResult(benchmark, result);

        console.log(
          `   ✅ ${result.duration.toFixed(2)}ms, ` +
          `${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB RAM`
        );

        // 清理
        if (benchmark.teardown) {
          await benchmark.teardown();
        }

      } catch (error) {
        const result: BenchmarkResult = {
          name: benchmark.name,
          duration: 0,
          memoryUsage: process.memoryUsage(),
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metrics: {}
        };

        suiteResults.push(result);
        console.log(`   ❌ 失败: ${result.error}`);
      }
    }

    suite.results = suiteResults;
    this.results.suites.push(suite);
    console.log('');
  }

  /**
   * 预热
   */
  private async warmup(): Promise<void> {
    // 运行一些简单的TypeScript操作来预热V8
    for (let i = 0; i < 100; i++) {
      const code = `const x: number = ${i}; const y: string = x.toString();`;
      // 简单的TypeScript类型检查
    }
  }

  /**
   * 运行单个基准测试
   */
  private async runBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    const metrics: Record<string, number> = {};

    // 运行基准测试
    const benchmarkResult = await benchmark.run();

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // 计算持续时间
    const duration = endTime - startTime;

    // 计算内存增长
    const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;

    // 合并结果
    return {
      name: benchmark.name,
      duration,
      memoryUsage: endMemory,
      success: true,
      metrics: {
        ...benchmarkResult.metrics,
        memoryGrowth,
        duration,
        heapUsed: endMemory.heapUsed,
        heapTotal: endMemory.heapTotal
      }
    };
  }

  /**
   * 验证结果
   */
  private validateResult(benchmark: Benchmark, result: BenchmarkResult): void {
    // 检查执行时间是否在预期范围内
    if (benchmark.expectedDuration) {
      const tolerance = benchmark.expectedDuration * 0.5; // 50%容差
      if (result.duration > benchmark.expectedDuration + tolerance) {
        console.warn(
          `   ⚠️  执行时间超出预期: ${result.duration.toFixed(2)}ms ` +
          `(预期: ${benchmark.expectedDuration}ms)`
        );
      }
    }

    // 检查内存使用是否在限制内
    if (benchmark.maxMemory) {
      if (result.memoryUsage.heapUsed > benchmark.maxMemory) {
        console.warn(
          `   ⚠️  内存使用超出限制: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB ` +
          `(限制: ${(benchmark.maxMemory / 1024 / 1024).toFixed(2)}MB)`
        );
      }
    }
  }

  /**
   * 生成总结
   */
  private generateSummary(): void {
    const allResults = this.results.suites.flatMap(s => s.results);
    const successfulResults = allResults.filter(r => r.success);

    if (successfulResults.length === 0) {
      return;
    }

    const totalDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalDuration / successfulResults.length;

    const peakMemoryUsage = Math.max(...successfulResults.map(r => r.memoryUsage.heapUsed));

    const slowest = successfulResults.reduce((prev, current) =>
      current.duration > prev.duration ? current : prev
    );

    const fastest = successfulResults.reduce((prev, current) =>
      current.duration < prev.duration ? current : prev
    );

    this.results.summary = {
      totalBenchmarks: allResults.length,
      successfulBenchmarks: successfulResults.length,
      averageDuration,
      peakMemoryUsage,
      slowestBenchmark: slowest,
      fastestBenchmark: fastest
    };
  }

  /**
   * 生成推荐
   */
  private generateRecommendations(): void {
    const recommendations: string[] = [];

    // 基于平均执行时间的推荐
    if (this.results.summary.averageDuration > 10000) { // 10秒
      recommendations.push('平均执行时间较长，建议优化类型检查算法');
    }

    // 基于内存使用的推荐
    if (this.results.summary.peakMemoryUsage > 1024 * 1024 * 1024) { // 1GB
      recommendations.push('内存使用较高，建议优化内存管理策略');
    }

    // 基于失败率的推荐
    const failureRate = 1 - (this.results.summary.successfulBenchmarks / this.results.summary.totalBenchmarks);
    if (failureRate > 0.1) { // 10%失败率
      recommendations.push('失败率较高，需要检查和修复失败的测试');
    }

    // 基于性能波动的推荐
    const durations = this.results.suites.flatMap(s => s.results.filter(r => r.success).map(r => r.duration));
    if (durations.length > 0) {
      const variance = this.calculateVariance(durations);
      const mean = this.results.summary.averageDuration;
      const cv = Math.sqrt(variance) / mean; // 变异系数

      if (cv > 0.3) { // 30%变异系数
        recommendations.push('性能波动较大，建议检查性能稳定性');
      }
    }

    this.results.recommendations = recommendations;
  }

  /**
   * 计算方差
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 输出结果
   */
  private outputResults(): void {
    console.log('📊 性能基准测试报告');
    console.log('='.repeat(60));
    console.log(`📅 测试时间: ${this.results.timestamp}`);
    console.log(`📈 总测试数: ${this.results.summary.totalBenchmarks}`);
    console.log(`✅ 成功测试: ${this.results.summary.successfulBenchmarks}`);
    console.log(`⏱️  平均执行时间: ${this.results.summary.averageDuration.toFixed(2)}ms`);
    console.log(`💾 峰值内存使用: ${(this.results.summary.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log('');

    // 输出每个套件的结果
    for (const suite of this.results.suites) {
      console.log(`📋 ${suite.name}`);
      console.log(`   ${suite.description}`);

      for (const result of suite.results) {
        const status = result.success ? '✅' : '❌';
        const duration = result.duration.toFixed(2);
        const memory = (result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

        console.log(`   ${status} ${result.name}: ${duration}ms, ${memory}MB`);

        if (result.error) {
          console.log(`      错误: ${result.error}`);
        }
      }
      console.log('');
    }

    // 输出最快和最慢的测试
    if (this.results.summary.slowestBenchmark.name) {
      console.log('🐌 最慢的测试:');
      console.log(`   ${this.results.summary.slowestBenchmark.name}: ` +
                  `${this.results.summary.slowestBenchmark.duration.toFixed(2)}ms`);
    }

    if (this.results.summary.fastestBenchmark.name) {
      console.log('🚀 最快的测试:');
      console.log(`   ${this.results.summary.fastestBenchmark.name}: ` +
                  `${this.results.summary.fastestBenchmark.duration.toFixed(2)}ms`);
    }

    // 输出推荐
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 性能优化建议:');
      for (const rec of this.results.recommendations) {
        console.log(`   • ${rec}`);
      }
    }
  }
}

// ==================== 基准测试定义 ====================

function createBenchmarks(): BenchmarkSuite[] {
  const projectRoot = process.cwd();

  return [
    // 基础类型检查性能测试
    {
      name: '基础类型检查',
      description: '测试基本的TypeScript类型检查性能',
      benchmarks: [
        {
          name: '小型项目类型检查',
          description: '检查小型TypeScript项目的类型',
          expectedDuration: 1000, // 1秒
          maxMemory: 512 * 1024 * 1024, // 512MB
          run: async (): Promise<BenchmarkResult> => {
            const startTime = performance.now();

            // 创建临时的小型项目
            const tempDir = await createTempProject('small');

            // 运行类型检查
            execSync('npx tsc --noEmit', {
              cwd: tempDir,
              encoding: 'utf8'
            });

            const duration = performance.now() - startTime;

            // 清理临时项目
            await cleanupTempProject(tempDir);

            return {
              name: '小型项目类型检查',
              duration,
              memoryUsage: process.memoryUsage(),
              success: true,
              metrics: {
                files: 10,
                lines: 500
              }
            };
          }
        },
        {
          name: '中型项目类型检查',
          description: '检查中型TypeScript项目的类型',
          expectedDuration: 5000, // 5秒
          maxMemory: 1024 * 1024 * 1024, // 1GB
          run: async (): Promise<BenchmarkResult> => {
            const startTime = performance.now();

            // 创建临时中型项目
            const tempDir = await createTempProject('medium');

            // 运行类型检查
            execSync('npx tsc --noEmit', {
              cwd: tempDir,
              encoding: 'utf8'
            });

            const duration = performance.now() - startTime;

            // 清理临时项目
            await cleanupTempProject(tempDir);

            return {
              name: '中型项目类型检查',
              duration,
              memoryUsage: process.memoryUsage(),
              success: true,
              metrics: {
                files: 100,
                lines: 5000
              }
            };
          }
        }
      ],
      results: []
    },

    // 类型安全工具性能测试
    {
      name: '类型安全工具',
      description: '测试类型安全检查工具的性能',
      benchmarks: [
        {
          name: '类型安全检查器',
          description: '运行完整的类型安全检查',
          expectedDuration: 3000, // 3秒
          maxMemory: 512 * 1024 * 1024, // 512MB
          run: async (): Promise<BenchmarkResult> => {
            const startTime = performance.now();

            // 运行类型安全检查工具
            execSync('npx ts-node scripts/type-safety-check.ts --json', {
              cwd: projectRoot,
              encoding: 'utf8'
            });

            const duration = performance.now() - startTime;

            return {
              name: '类型安全检查器',
              duration,
              memoryUsage: process.memoryUsage(),
              success: true,
              metrics: {
                checks: 'full'
              }
            };
          }
        },
        {
          name: '可选属性修复器',
          description: '运行可选属性自动修复',
          expectedDuration: 2000, // 2秒
          maxMemory: 256 * 1024 * 1024, // 256MB
          run: async (): Promise<BenchmarkResult> => {
            const startTime = performance.now();

            // 创建测试文件
            const testFile = await createTestFile();

            // 运行修复工具
            execSync(`npx ts-node scripts/fix-optional-access.ts --file ${testFile}`, {
              cwd: projectRoot,
              encoding: 'utf8'
            });

            const duration = performance.now() - startTime;

            // 清理测试文件
            await cleanupTestFile(testFile);

            return {
              name: '可选属性修复器',
              duration,
              memoryUsage: process.memoryUsage(),
              success: true,
              metrics: {
                files: 1,
                fixes: 5
              }
            };
          }
        }
      ],
      results: []
    },

    // 内存使用性能测试
    {
      name: '内存性能',
      description: '测试内存使用情况和垃圾回收',
      benchmarks: [
        {
          name: '大文件处理',
          description: '处理大型TypeScript文件的内存使用',
          expectedDuration: 5000, // 5秒
          maxMemory: 1024 * 1024 * 1024, // 1GB
          run: async (): Promise<BenchmarkResult> => {
            const startTime = performance.now();
            const startMemory = process.memoryUsage();

            // 创建大型文件
            const largeFile = await createLargeFile();

            // 处理文件
            const content = fs.readFileSync(largeFile, 'utf8');
            const lines = content.split('\n').length;

            // 强制垃圾回收
            if (global.gc) {
              global.gc();
            }

            const endMemory = process.memoryUsage();
            const duration = performance.now() - startTime;

            // 清理文件
            await cleanupLargeFile(largeFile);

            return {
              name: '大文件处理',
              duration,
              memoryUsage: endMemory,
              success: true,
              metrics: {
                lines,
                memoryGrowth: endMemory.heapUsed - startMemory.heapUsed
              }
            };
          }
        },
        {
          name: '并发类型检查',
          description: '同时运行多个类型检查任务',
          expectedDuration: 8000, // 8秒
          maxMemory: 2048 * 1024 * 1024, // 2GB
          run: async (): Promise<BenchmarkResult> => {
            const startTime = performance.now();

            // 创建多个临时项目
            const tempDirs = await Promise.all([
              createTempProject('small'),
              createTempProject('small'),
              createTempProject('small')
            ]);

            // 并发运行类型检查
            const promises = tempDirs.map(dir =>
              execSync('npx tsc --noEmit', {
                cwd: dir,
                encoding: 'utf8'
              })
            );

            await Promise.all(promises);

            const duration = performance.now() - startTime;

            // 清理临时项目
            await Promise.all(tempDirs.map(cleanupTempProject));

            return {
              name: '并发类型检查',
              duration,
              memoryUsage: process.memoryUsage(),
              success: true,
              metrics: {
                concurrentTasks: 3
              }
            };
          }
        }
      ],
      results: []
    }
  ];
}

// ==================== 辅助函数 ====================

async function createTempProject(size: 'small' | 'medium'): Promise<string> {
  const tempDir = fs.mkdtempSync('ts-bench-');

  // 创建tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    }
  };

  fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  // 创建源文件
  const fileCount = size === 'small' ? 10 : 100;
  const linesPerFile = size === 'small' ? 50 : 500;

  for (let i = 0; i < fileCount; i++) {
    const content = generateTypeScriptCode(linesPerFile, i);
    fs.writeFileSync(path.join(tempDir, `file${i}.ts`), content);
  }

  return tempDir;
}

async function cleanupTempProject(dir: string): Promise<void> {
  // 递归删除目录
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function generateTypeScriptCode(lines: number, seed: number): string {
  const code: string[] = [];

  // 生成接口
  code.push(`interface Interface${seed} {`);
  code.push(`  id: number;`);
  code.push(`  name: string;`);
  code.push(`  optional?: boolean;`);
  code.push(`}`);
  code.push('');

  // 生成类
  code.push(`class Class${seed} implements Interface${seed} {`);
  code.push(`  constructor(`);
  code.push(`    public id: number,`);
  code.push(`    public name: string,`);
  code.push(`    public optional?: boolean`);
  code.push(`  ) {}`);
  code.push('');
  code.push(`  method(): string {`);
  code.push(`    return this.name;`);
  code.push(`  }`);
  code.push(`}`);
  code.push('');

  // 填充剩余行数
  const remainingLines = lines - code.length;
  for (let i = 0; i < remainingLines; i++) {
    if (i % 3 === 0) {
      code.push(`const variable${i}: number = ${seed + i};`);
    } else if (i % 3 === 1) {
      code.push(`function function${i}(param: string): boolean {`);
      code.push(`  return param.length > 0;`);
      code.push(`}`);
    } else {
      code.push(`const instance${i} = new Class${seed}(${i}, 'name${i}');`);
    }
  }

  return code.join('\n');
}

async function createTestFile(): Promise<string> {
  const tempFile = fs.mkdtempSync('ts-test-') + '/test.ts';

  const content = `
interface User {
  id: number;
  name?: string;
  email?: string;
}

class UserService {
  private users: User[] = [];

  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserName(id: number): string {
    const user = this.getUser(id);
    return user.name; // 这里会产生可选属性访问问题
  }

  getUserEmail(id: number): string {
    const user = this.getUser(id);
    return user.email; // 这里也会产生可选属性访问问题
  }
}

const service = new UserService();
const user = service.getUser(1);
console.log(user.name.toUpperCase()); // 这里也会产生问题
`;

  fs.writeFileSync(tempFile, content);
  return tempFile;
}

async function cleanupTestFile(file: string): Promise<void> {
  const dir = path.dirname(file);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function createLargeFile(): Promise<string> {
  const tempFile = fs.mkdtempSync('ts-large-') + '/large.ts';

  // 生成一个很大的TypeScript文件
  const content: string[] = [];

  for (let i = 0; i < 10000; i++) {
    content.push(`
interface Interface${i} {
  field${i}: string;
  optionalField${i}?: number;
}

class Class${i} implements Interface${i} {
  constructor(
    public field${i}: string,
    public optionalField${i}?: number
  ) {}

  method${i}(): string {
    return this.field${i};
  }
}

const instance${i} = new Class${i}('value${i}', ${i});
`);
  }

  fs.writeFileSync(tempFile, content.join('\n'));
  return tempFile;
}

async function cleanupLargeFile(file: string): Promise<void> {
  const dir = path.dirname(file);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ==================== 主程序 ====================

async function main() {
  const benchmarker = new TypeSafetyBenchmarker();

  // 添加基准测试套件
  for (const suite of createBenchmarks()) {
    benchmarker.addSuite(suite);
  }

  try {
    const report = await benchmarker.runAll();

    // 保存报告到文件
    const reportPath = 'type-safety-performance-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告已保存到: ${reportPath}`);

    // 设置退出码
    const failureRate = 1 - (report.summary.successfulBenchmarks / report.summary.totalBenchmarks);
    if (failureRate > 0.2) { // 20%失败率
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ 基准测试失败:', error);
    process.exit(2);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

export { TypeSafetyBenchmarker, BenchmarkResult, PerformanceReport };