/**
 * 性能基准测试
 * 
 * 测试主要API端点的性能指标：
 * - 平均响应时间
 * - P95响应时间
 * - P99响应时间
 * - 成功率
 * - 吞吐量（req/s）
 */

import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// 基准测试结果接口
interface BenchmarkResult {
  test: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  throughput: number;
  totalTime: number;
}

// 配置
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const OUTPUT_DIR = path.join(__dirname, '../..', 'docs/performance-reports');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 对单个端点进行基准测试
 */
async function benchmarkEndpoint(
  method: 'GET' | 'POST',
  path: string,
  requests: number,
  data?: any,
  headers?: Record<string, string>
): Promise<BenchmarkResult> {
  console.log(`\n🔄 测试: ${method} ${path} (${requests}次请求)`);
  
  const startTime = Date.now();
  const durations: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < requests; i++) {
    const reqStart = Date.now();
    try {
      const config: AxiosRequestConfig = {
        method,
        url: `${BASE_URL}${path}`,
        timeout: 30000, // 30秒超时
        validateStatus: () => true, // 接受所有状态码
        ...(headers && { headers }),
        ...(data && { data }),
      };

      const response = await axios(config);
      const duration = Date.now() - reqStart;
      durations.push(duration);

      if (response.status >= 200 && response.status < 400) {
        successCount++;
      } else {
        failureCount++;
      }

      // 显示进度
      if ((i + 1) % Math.max(1, Math.floor(requests / 10)) === 0) {
        process.stdout.write(`\r  进度: ${i + 1}/${requests} (${Math.round(((i + 1) / requests) * 100)}%)`);
      }
    } catch (err) {
      const duration = Date.now() - reqStart;
      durations.push(duration);
      failureCount++;
    }
  }

  console.log(); // 换行

  const totalTime = Date.now() - startTime;
  durations.sort((a, b) => a - b);

  const p50Index = Math.floor(durations.length * 0.50);
  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  return {
    test: `${method} ${path}`,
    totalRequests: requests,
    successCount,
    failureCount,
    avgResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    p50ResponseTime: durations[p50Index] || 0,
    p95ResponseTime: durations[p95Index] || 0,
    p99ResponseTime: durations[p99Index] || 0,
    successRate: successCount / requests,
    throughput: requests / (totalTime / 1000),
    totalTime,
  };
}

/**
 * 生成性能报告
 */
function generateReport(results: BenchmarkResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 性能基准测试报告');
  console.log('='.repeat(80));

  console.log('\n测试环境:');
  console.log(`  • 基础URL: ${BASE_URL}`);
  console.log(`  • 测试时间: ${new Date().toISOString()}`);

  console.log('\n\n性能指标:');
  console.log('─'.repeat(80));
  console.log('%-40s %8s %8s %8s %8s %10s', '测试', 'Avg(ms)', 'P95(ms)', 'P99(ms)', '成功率', '吞吐量');
  console.log('─'.repeat(80));

  results.forEach(result => {
    console.log(
      '%-40s %8.2f %8.2f %8.2f %7.1f%% %8.2f/s',
      result.test.substring(0, 40),
      result.avgResponseTime,
      result.p95ResponseTime,
      result.p99ResponseTime,
      result.successRate * 100,
      result.throughput
    );
  });

  console.log('─'.repeat(80));

  // 计算总体统计
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalSuccesses = results.reduce((sum, r) => sum + r.successCount, 0);
  const avgResponseTime = results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length;
  const overallSuccessRate = totalSuccesses / totalRequests;

  console.log('\n总体统计:');
  console.log(`  • 总请求数: ${totalRequests}`);
  console.log(`  • 成功率: ${(overallSuccessRate * 100).toFixed(2)}%`);
  console.log(`  • 平均响应时间: ${avgResponseTime.toFixed(2)}ms`);

  // 保存JSON格式报告
  const reportData = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    results,
    summary: {
      totalRequests,
      totalSuccesses,
      avgResponseTime,
      overallSuccessRate,
    },
  };

  const outputPath = path.join(OUTPUT_DIR, `benchmark-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
  console.log(`\n✅ 报告已保存: ${outputPath}`);
}

/**
 * 主测试函数
 */
async function runBenchmark() {
  console.log('🚀 LLMChat 性能基准测试');
  console.log('━'.repeat(80));

  const results: BenchmarkResult[] = [];

  try {
    // 测试1: 健康检查（轻量级端点）
    results.push(await benchmarkEndpoint('GET', '/health', 1000));

    // 测试2: Agents列表（中等复杂度）
    results.push(await benchmarkEndpoint('GET', '/api/agents', 500));

    // 测试3: 认证登录（数据库操作）
    results.push(await benchmarkEndpoint('POST', '/api/auth/login', 100, {
      username: 'admin',
      password: 'admin123',
    }));

    // 测试4: CSRF Token获取
    results.push(await benchmarkEndpoint('GET', '/api/csrf-token', 500));

    // 生成报告
    generateReport(results);

    // 性能验收标准检查
    console.log('\n' + '='.repeat(80));
    console.log('✅ 验收标准检查');
    console.log('='.repeat(80));

    const healthResult = results.find(r => r.test.includes('/health'));
    const agentsResult = results.find(r => r.test.includes('/api/agents'));

    let passed = 0;
    let failed = 0;

    // 标准1: P95响应时间 < 50ms
    if (healthResult && healthResult.p95ResponseTime < 50) {
      console.log('✅ P95响应时间 < 50ms:', healthResult.p95ResponseTime.toFixed(2), 'ms');
      passed++;
    } else {
      console.log('❌ P95响应时间 >= 50ms:', healthResult?.p95ResponseTime.toFixed(2), 'ms');
      failed++;
    }

    // 标准2: P99响应时间 < 100ms
    if (healthResult && healthResult.p99ResponseTime < 100) {
      console.log('✅ P99响应时间 < 100ms:', healthResult.p99ResponseTime.toFixed(2), 'ms');
      passed++;
    } else {
      console.log('❌ P99响应时间 >= 100ms:', healthResult?.p99ResponseTime.toFixed(2), 'ms');
      failed++;
    }

    // 标准3: 成功率 > 99%
    const overallSuccessRate = results.reduce((sum, r) => sum + r.successCount, 0) / results.reduce((sum, r) => sum + r.totalRequests, 0);
    if (overallSuccessRate > 0.99) {
      console.log('✅ 成功率 > 99%:', (overallSuccessRate * 100).toFixed(2), '%');
      passed++;
    } else {
      console.log('❌ 成功率 <= 99%:', (overallSuccessRate * 100).toFixed(2), '%');
      failed++;
    }

    // 标准4: 吞吐量 > 100 req/s
    if (agentsResult && agentsResult.throughput > 100) {
      console.log('✅ 吞吐量 > 100 req/s:', agentsResult.throughput.toFixed(2), 'req/s');
      passed++;
    } else {
      console.log('❌ 吞吐量 <= 100 req/s:', agentsResult?.throughput.toFixed(2), 'req/s');
      failed++;
    }

    console.log('─'.repeat(80));
    console.log(`总计: ${passed}/${passed + failed} 通过`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ 基准测试失败:', error);
    process.exit(1);
  }
}

// 运行基准测试
if (require.main === module) {
  runBenchmark().then(() => {
    console.log('\n✅ 基准测试完成');
    process.exit(0);
  }).catch(err => {
    console.error('\n❌ 基准测试失败:', err);
    process.exit(1);
  });
}

export { runBenchmark, benchmarkEndpoint };
