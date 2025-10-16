/**
 * 性能基准测试
 * 
 * 用于测试系统在优化后的性能表现
 * 记录关键指标：响应时间、吞吐量、成功率
 */

import axios, { AxiosRequestConfig } from 'axios';

interface BenchmarkResult {
  test: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  throughput: number;
  totalRequests: number;
  failedRequests: number;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/**
 * 运行单个端点的基准测试
 */
async function benchmarkEndpoint(
  method: string,
  path: string,
  requests: number,
  data?: any,
  headers?: Record<string, string>
): Promise<BenchmarkResult> {
  console.log(`\n📊 测试 ${method} ${path} (${requests}个请求)...`);
  
  const startTime = Date.now();
  const durations: number[] = [];
  let successCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < requests; i++) {
    const reqStart = Date.now();
    try {
      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: `${BASE_URL}${path}`,
        data,
        headers,
        timeout: 30000, // 30秒超时
      };
      
      await axios(config);
      successCount++;
      durations.push(Date.now() - reqStart);
    } catch (err: any) {
      failedCount++;
      durations.push(Date.now() - reqStart);
      
      // 只显示第一个错误，避免刷屏
      if (failedCount === 1) {
        console.error(`❌ 请求失败: ${err.message}`);
      }
    }
    
    // 每100个请求显示进度
    if ((i + 1) % 100 === 0) {
      console.log(`   进度: ${i + 1}/${requests} (${Math.round((i + 1) / requests * 100)}%)`);
    }
  }
  
  const totalTime = Date.now() - startTime;
  durations.sort((a, b) => a - b);
  
  const result: BenchmarkResult = {
    test: `${method} ${path}`,
    avgResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
    p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0,
    successRate: Math.round((successCount / requests) * 100) / 100,
    throughput: Math.round((requests / (totalTime / 1000)) * 100) / 100,
    totalRequests: requests,
    failedRequests: failedCount,
  };
  
  console.log(`✅ 完成: 平均 ${result.avgResponseTime}ms, P95 ${result.p95ResponseTime}ms, 成功率 ${(result.successRate * 100).toFixed(1)}%`);
  
  return result;
}

/**
 * 生成性能报告
 */
function generateReport(results: BenchmarkResult[]): void {
  console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           性能基准测试报告 - 日志优化后                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('测试时间:', new Date().toISOString());
  console.log('目标服务:', BASE_URL);
  console.log('\n');
  
  // 表格头部
  console.log('┌─────────────────────────────┬──────┬──────┬──────┬─────────┬──────────┐');
  console.log('│ 端点                        │ 平均 │  P95 │  P99 │ 成功率  │ 吞吐量   │');
  console.log('├─────────────────────────────┼──────┼──────┼──────┼─────────┼──────────┤');
  
  // 数据行
  results.forEach(result => {
    const endpoint = result.test.padEnd(27);
    const avg = `${result.avgResponseTime}ms`.padStart(6);
    const p95 = `${result.p95ResponseTime}ms`.padStart(6);
    const p99 = `${result.p99ResponseTime}ms`.padStart(6);
    const success = `${(result.successRate * 100).toFixed(1)}%`.padStart(7);
    const throughput = `${result.throughput}/s`.padStart(8);
    
    console.log(`│ ${endpoint} │ ${avg} │ ${p95} │ ${p99} │ ${success} │ ${throughput} │`);
  });
  
  console.log('└─────────────────────────────┴──────┴──────┴──────┴─────────┴──────────┘');
  
  // 统计摘要
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failedRequests, 0);
  const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
  
  console.log('\n📊 测试摘要:');
  console.log(`   总请求数: ${totalRequests}`);
  console.log(`   失败请求: ${totalFailed} (${(totalFailed / totalRequests * 100).toFixed(2)}%)`);
  console.log(`   平均吞吐量: ${avgThroughput.toFixed(2)} req/s`);
  
  // 性能验收标准检查
  console.log('\n✅ 性能验收标准检查:');
  
  const p95Target = 50; // 目标P95 < 50ms
  const p99Target = 100; // 目标P99 < 100ms
  const successTarget = 0.95; // 目标成功率 > 95%
  
  results.forEach(result => {
    const p95Pass = result.p95ResponseTime < p95Target ? '✅' : '❌';
    const p99Pass = result.p99ResponseTime < p99Target ? '✅' : '❌';
    const successPass = result.successRate >= successTarget ? '✅' : '❌';
    
    console.log(`\n   ${result.test}:`);
    console.log(`   ${p95Pass} P95 < 50ms: ${result.p95ResponseTime}ms`);
    console.log(`   ${p99Pass} P99 < 100ms: ${result.p99ResponseTime}ms`);
    console.log(`   ${successPass} 成功率 > 95%: ${(result.successRate * 100).toFixed(1)}%`);
  });
  
  console.log('\n');
}

/**
 * 主测试函数
 */
async function runBenchmark() {
  console.log('🚀 启动性能基准测试...\n');
  console.log('目标: 验证日志优化后的性能提升');
  console.log('预期: HTTP响应时间P95 < 50ms, P99 < 100ms\n');
  
  const results: BenchmarkResult[] = [];
  
  try {
    // 测试1: 健康检查（轻量级）
    results.push(await benchmarkEndpoint('GET', '/health', 1000));
    
    // 等待1秒，避免过载
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试2: Agents列表（中等负载）
    results.push(await benchmarkEndpoint('GET', '/api/agents', 500));
    
    // 等待1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试3: 登录（带数据POST）
    results.push(await benchmarkEndpoint('POST', '/api/auth/login', 100, {
      username: 'admin',
      password: 'admin123'
    }));
    
    // 生成报告
    generateReport(results);
    
    // 保存到文件
    const reportPath = 'reports/performance-benchmark-' + Date.now() + '.json';
    const fs = require('fs');
    const path = require('path');
    
    // 确保目录存在
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      reportPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        results,
        summary: {
          totalRequests: results.reduce((sum, r) => sum + r.totalRequests, 0),
          totalFailed: results.reduce((sum, r) => sum + r.failedRequests, 0),
          avgThroughput: results.reduce((sum, r) => sum + r.throughput, 0) / results.length,
        }
      }, null, 2)
    );
    
    console.log(`\n📁 报告已保存: ${reportPath}\n`);
    
  } catch (error: any) {
    console.error('\n❌ 基准测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runBenchmark().catch(console.error);

