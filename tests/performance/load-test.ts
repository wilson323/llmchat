/**
 * 性能基准测试和压力测试
 *
 * 提供全面的性能测试功能：
 * - API负载测试
 * - 数据库性能测试
 * - 缓存性能测试
 * - 并发压力测试
 * - 内存泄漏检测
 */

import { performance } from 'perf_hooks';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import logger from '@/utils/logger';
import { performanceConfig } from '@/config/PerformanceConfig';

// 测试配置接口
interface LoadTestConfig {
  // API测试配置
  api: {
    baseUrl: string;
    endpoints: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      path: string;
      data?: any;
      headers?: Record<string, string>;
      weight?: number; // 权重，用于随机选择
    }>;
    concurrency: number;
    duration: number; // 测试持续时间（秒）
    rampUp: number; // 逐步增加并发数的时间（秒）
  };

  // 数据库测试配置
  database: {
    connectionString: string;
    queries: Array<{
      name: string;
      sql: string;
      params?: any[];
      expectedTime?: number; // 期望执行时间（毫秒）
    }>;
    iterations: number;
    concurrency: number;
  };

  // Redis测试配置
  redis: {
    host: string;
    port: number;
    password?: string;
    operations: Array<{
      type: 'get' | 'set' | 'del' | 'hget' | 'hset' | 'lpush' | 'rpop';
      key: string;
      value?: any;
      field?: string;
      score?: number;
    }>;
    iterations: number;
    concurrency: number;
  };

  // 输出配置
  output: {
    format: 'json' | 'html' | 'csv';
    filePath: string;
    includeDetails: boolean;
    includeCharts: boolean;
  };
}

// 测试结果接口
interface TestResult {
  timestamp: Date;
  testType: 'api' | 'database' | 'redis' | 'memory';
  config: any;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    throughput: number; // 请求/秒
    errorRate: number;
    errors: Array<{
      error: string;
      count: number;
      samples: string[];
    }>;
  };
  systemMetrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    gcStats?: NodeJS.GCStats;
  };
  details?: any[];
}

/**
 * 性能测试套件
 */
export class PerformanceTestSuite {
  private config: LoadTestConfig;
  private results: TestResult[] = [];
  private httpClient: AxiosInstance;

  constructor(config: Partial<LoadTestConfig> = {}) {
    this.config = this.mergeWithDefaultConfig(config);
    this.httpClient = axios.create({
      baseURL: this.config.api.baseUrl,
      timeout: 30000,
      validateStatus: () => true, // 不抛出错误，手动处理状态码
    });
  }

  /**
   * 合并默认配置
   */
  private mergeWithDefaultConfig(config: Partial<LoadTestConfig>): LoadTestConfig {
    return {
      api: {
        baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3001',
        endpoints: [
          { method: 'GET', path: '/health', weight: 10 },
          { method: 'GET', path: '/api/agents', weight: 5 },
          { method: 'POST', path: '/api/auth/login', data: { username: 'test', password: 'test' }, weight: 3 },
          { method: 'GET', path: '/api/chat/history/test-session', weight: 2 },
        ],
        concurrency: parseInt(process.env.TEST_CONCURRENCY || '10'),
        duration: parseInt(process.env.TEST_DURATION || '60'),
        rampUp: parseInt(process.env.TEST_RAMP_UP || '10'),
        ...config.api,
      },
      database: {
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/llmchat',
        queries: [
          { name: 'select_users', sql: 'SELECT * FROM users LIMIT 10' },
          { name: 'select_sessions', sql: 'SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT 10' },
          { name: 'count_messages', sql: 'SELECT COUNT(*) FROM chat_messages' },
        ],
        iterations: 1000,
        concurrency: 10,
        ...config.database,
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        operations: [
          { type: 'set', key: 'test:key', value: 'test-value' },
          { type: 'get', key: 'test:key' },
          { type: 'hset', key: 'test:hash', field: 'field1', value: 'value1' },
          { type: 'hget', key: 'test:hash', field: 'field1' },
        ],
        iterations: 1000,
        concurrency: 10,
        ...config.redis,
      },
      output: {
        format: 'json',
        filePath: './test-results/performance-test-results.json',
        includeDetails: true,
        includeCharts: false,
        ...config.output,
      },
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    logger.info('开始运行性能测试套件');

    try {
      // API负载测试
      await this.runApiLoadTest();

      // 数据库性能测试
      await this.runDatabasePerformanceTest();

      // Redis缓存性能测试
      await this.runRedisPerformanceTest();

      // 内存泄漏测试
      await this.runMemoryLeakTest();

      // 生成报告
      await this.generateReport();

      logger.info('性能测试套件执行完成');
    } catch (unknownError: unknown) {
      const error = unknownError as any;
      logger.error('性能测试执行失败', { error });
      throw error;
    }
  }

  /**
   * API负载测试
   */
  private async runApiLoadTest(): Promise<void> {
    logger.info('开始API负载测试');

    const metrics = {
      responseTimes: [] as number[],
      errors: new Map<string, { count: number; samples: string[] }>(),
      successCount: 0,
      failCount: 0,
    };

    const startTime = performance.now();
    const endTime = startTime + this.config.api.duration * 1000;

    // 创建工作线程
    const workers: Promise<void>[] = [];
    const currentConcurrency = Math.floor(this.config.api.concurrency / this.config.api.rampUp * 10);

    for (let i = 0; i < currentConcurrency; i++) {
      workers.push(this.apiWorker(metrics, startTime, endTime));
    }

    // 逐步增加并发数
    const rampUpInterval = setInterval(() => {
      if (performance.now() >= startTime + this.config.api.rampUp * 1000) {
        clearInterval(rampUpInterval);
        return;
      }

      const targetConcurrency = Math.floor(
        (performance.now() - startTime) / (this.config.api.rampUp * 1000) * this.config.api.concurrency
      );

      while (workers.length < targetConcurrency && workers.length < this.config.api.concurrency) {
        workers.push(this.apiWorker(metrics, startTime, endTime));
      }
    }, 1000);

    // 等待所有工作线程完成
    await Promise.all(workers);

    // 计算结果
    const totalTime = (performance.now() - startTime) / 1000;
    const responseTimes = metrics.responseTimes.sort((a, b) => a - b);
    const errorMap = new Map(metrics.errors);

    const result: TestResult = {
      timestamp: new Date(),
      testType: 'api',
      config: this.config.api,
      metrics: {
        totalRequests: metrics.successCount + metrics.failCount,
        successfulRequests: metrics.successCount,
        failedRequests: metrics.failCount,
        averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: responseTimes[0] || 0,
        maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
        p50: this.percentile(responseTimes, 0.5),
        p90: this.percentile(responseTimes, 0.9),
        p95: this.percentile(responseTimes, 0.95),
        p99: this.percentile(responseTimes, 0.99),
        throughput: (metrics.successCount + metrics.failCount) / totalTime,
        errorRate: metrics.failCount / (metrics.successCount + metrics.failCount),
        errors: Array.from(errorMap.entries()).map(([error, data]) => ({
          error,
          count: data.count,
          samples: data.samples.slice(0, 5),
        })),
      },
      systemMetrics: this.getSystemMetrics(),
    };

    this.results.push(result);
    logger.info('API负载测试完成', {
      totalRequests: result.metrics.totalRequests,
      throughput: result.metrics.throughput.toFixed(2),
      averageResponseTime: result.metrics.averageResponseTime.toFixed(2),
      errorRate: (result.metrics.errorRate * 100).toFixed(2) + '%',
    });
  }

  /**
   * API工作线程
   */
  private async apiWorker(
    metrics: {
      responseTimes: number[];
      errors: Map<string, { count: number; samples: string[] }>;
      successCount: number;
      failCount: number;
    },
    startTime: number,
    endTime: number
  ): Promise<void> {
    while (performance.now() < endTime) {
      try {
        // 随机选择端点
        const endpoint = this.weightedRandom(this.config.api.endpoints);
        const requestStart = performance.now();

        let response: AxiosResponse;
        switch (endpoint.method) {
          case 'GET':
            response = await this.httpClient.get(endpoint.path, { headers: endpoint.headers });
            break;
          case 'POST':
            response = await this.httpClient.post(endpoint.path, endpoint.data, {
              headers: endpoint.headers,
            });
            break;
          case 'PUT':
            response = await this.httpClient.put(endpoint.path, endpoint.data, {
              headers: endpoint.headers,
            });
            break;
          case 'DELETE':
            response = await this.httpClient.delete(endpoint.path, { headers: endpoint.headers });
            break;
        }

        const requestTime = performance.now() - requestStart;
        metrics.responseTimes.push(requestTime);

        if (response.status >= 400) {
          metrics.failCount++;
          const errorKey = `${response.status} ${endpoint.method} ${endpoint.path}`;
          const existing = metrics.errors.get(errorKey);
          if (existing) {
            existing.count++;
            if (existing.samples.length < 5) {
              existing.samples.push(response.data as string);
            }
          } else {
            metrics.errors.set(errorKey, {
              count: 1,
              samples: [response.data as string],
            });
          }
        } else {
          metrics.successCount++;
        }

        // 添加延迟以控制速率
        await this.sleep(10);
      } catch (unknownError: unknown) {
        const error = unknownError as any;
        metrics.failCount++;
        const errorKey = `ERROR ${endpoint.method} ${endpoint.path}`;
        const existing = metrics.errors.get(errorKey);
        if (existing) {
          existing.count++;
        } else {
          metrics.errors.set(errorKey, {
            count: 1,
            samples: [error.message],
          });
        }
      }
    }
  }

  /**
   * 数据库性能测试
   */
  private async runDatabasePerformanceTest(): Promise<void> {
    logger.info('开始数据库性能测试');

    const pool = new Pool({
      connectionString: this.config.database.connectionString,
      max: this.config.database.concurrency,
    });

    const metrics = {
      responseTimes: [] as number[],
      errors: new Map<string, number>(),
      results: [] as any[],
    };

    const workers: Promise<void>[] = [];

    for (let i = 0; i < this.config.database.concurrency; i++) {
      workers.push(this.databaseWorker(pool, metrics));
    }

    await Promise.all(workers);
    await pool.end();

    // 计算结果
    const responseTimes = metrics.responseTimes.sort((a, b) => a - b);
    const errorMap = new Map(metrics.errors);

    const result: TestResult = {
      timestamp: new Date(),
      testType: 'database',
      config: this.config.database,
      metrics: {
        totalRequests: metrics.responseTimes.length,
        successfulRequests: metrics.responseTimes.length,
        failedRequests: Array.from(errorMap.values()).reduce((a, b) => a + b, 0),
        averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: responseTimes[0] || 0,
        maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
        p50: this.percentile(responseTimes, 0.5),
        p90: this.percentile(responseTimes, 0.9),
        p95: this.percentile(responseTimes, 0.95),
        p99: this.percentile(responseTimes, 0.99),
        throughput: metrics.responseTimes.length / (responseTimes.reduce((a, b) => a + b, 0) / 1000),
        errorRate: Array.from(errorMap.values()).reduce((a, b) => a + b, 0) / metrics.responseTimes.length,
        errors: Array.from(errorMap.entries()).map(([error, count]) => ({
          error,
          count,
          samples: [],
        })),
      },
      systemMetrics: this.getSystemMetrics(),
      details: metrics.results,
    };

    this.results.push(result);
    logger.info('数据库性能测试完成', {
      totalQueries: result.metrics.totalRequests,
      averageResponseTime: result.metrics.averageResponseTime.toFixed(2),
      errorRate: (result.metrics.errorRate * 100).toFixed(2) + '%',
    });
  }

  /**
   * 数据库工作线程
   */
  private async databaseWorker(
    pool: Pool,
    metrics: {
      responseTimes: number[];
      errors: Map<string, number>;
      results: any[];
    }
  ): Promise<void> {
    const client = await pool.connect();

    try {
      for (const query of this.config.database.queries) {
        for (let i = 0; i < this.config.database.iterations / this.config.database.concurrency; i++) {
          try {
            const start = performance.now();
            const result = await client.query(query.sql, query.params || []);
            const duration = performance.now() - start;

            metrics.responseTimes.push(duration);
            metrics.results.push({
              query: query.name,
              duration,
              rowCount: result.rowCount,
            });

            // 检查是否超过期望时间
            if (query.expectedTime && duration > query.expectedTime) {
              logger.warn('慢查询检测', {
                query: query.name,
                duration,
                expected: query.expectedTime,
              });
            }
          } catch (unknownError: unknown) {
            const error = unknownError as any;
            const errorKey = `${query.name}: ${error.message}`;
            metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
          }
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Redis性能测试
   */
  private async runRedisPerformanceTest(): Promise<void> {
    logger.info('开始Redis性能测试');

    const redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      maxRetriesPerRequest: 0,
    });

    const metrics = {
      responseTimes: [] as number[],
      operations: new Map<string, number>(),
      errors: new Map<string, number>(),
    };

    const workers: Promise<void>[] = [];

    for (let i = 0; i < this.config.redis.concurrency; i++) {
      workers.push(this.redisWorker(redis, metrics));
    }

    await Promise.all(workers);
    await redis.quit();

    // 计算结果
    const responseTimes = metrics.responseTimes.sort((a, b) => a - b);

    const result: TestResult = {
      timestamp: new Date(),
      testType: 'redis',
      config: this.config.redis,
      metrics: {
        totalRequests: metrics.responseTimes.length,
        successfulRequests: metrics.responseTimes.length,
        failedRequests: Array.from(metrics.errors.values()).reduce((a, b) => a + b, 0),
        averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        minResponseTime: responseTimes[0] || 0,
        maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
        p50: this.percentile(responseTimes, 0.5),
        p90: this.percentile(responseTimes, 0.9),
        p95: this.percentile(responseTimes, 0.95),
        p99: this.percentile(responseTimes, 0.99),
        throughput: metrics.responseTimes.length / (responseTimes.reduce((a, b) => a + b, 0) / 1000),
        errorRate: Array.from(metrics.errors.values()).reduce((a, b) => a + b, 0) / metrics.responseTimes.length,
        errors: Array.from(metrics.errors.entries()).map(([error, count]) => ({
          error,
          count,
          samples: [],
        })),
      },
      systemMetrics: this.getSystemMetrics(),
    };

    this.results.push(result);
    logger.info('Redis性能测试完成', {
      totalOperations: result.metrics.totalRequests,
      averageResponseTime: result.metrics.averageResponseTime.toFixed(2),
      throughput: result.metrics.throughput.toFixed(2),
      errorRate: (result.metrics.errorRate * 100).toFixed(2) + '%',
    });
  }

  /**
   * Redis工作线程
   */
  private async redisWorker(
    redis: Redis,
    metrics: {
      responseTimes: number[];
      operations: Map<string, number>;
      errors: Map<string, number>;
    }
  ): Promise<void> {
    for (const operation of this.config.redis.operations) {
      for (let i = 0; i < this.config.redis.iterations / this.config.redis.concurrency; i++) {
        try {
          const start = performance.now();
          let result: any;

          switch (operation.type) {
            case 'set':
              result = await redis.set(operation.key, operation.value);
              break;
            case 'get':
              result = await redis.get(operation.key);
              break;
            case 'del':
              result = await redis.del(operation.key);
              break;
            case 'hset':
              result = await redis.hset(operation.key, operation.field!, operation.value);
              break;
            case 'hget':
              result = await redis.hget(operation.key, operation.field);
              break;
            case 'lpush':
              result = await redis.lpush(operation.key, operation.value);
              break;
            case 'rpop':
              result = await redis.rpop(operation.key);
              break;
          }

          const duration = performance.now() - start;
          metrics.responseTimes.push(duration);
          metrics.operations.set(operation.type, (metrics.operations.get(operation.type) || 0) + 1);
        } catch (unknownError: unknown) {
          const error = unknownError as any;
          const errorKey = `${operation.type}: ${error.message}`;
          metrics.errors.set(errorKey, (metrics.errors.get(errorKey) || 0) + 1);
        }
      }
    }
  }

  /**
   * 内存泄漏测试
   */
  private async runMemoryLeakTest(): Promise<void> {
    logger.info('开始内存泄漏测试');

    const initialMemory = process.memoryUsage();
    const samples: NodeJS.MemoryUsage[] = [initialMemory];
    const iterations = 1000;
    const gc = global.gc as (() => void) | undefined;

    // 强制垃圾回收（如果可用）
    if (gc) gc();

    for (let i = 0; i < iterations; i++) {
      // 模拟内存操作
      const data = new Array(1000).fill(0).map(() => ({
        id: Math.random(),
        data: new Array(100).fill(Math.random().toString(36)),
        timestamp: Date.now(),
      }));

      // 模拟处理
      data.forEach(item => {
        JSON.stringify(item);
      });

      // 定期采样
      if (i % 100 === 0) {
        if (gc) gc();
        samples.push(process.memoryUsage());
      }

      // 清理
      data.length = 0;
    }

    // 最终采样
    if (gc) gc();
    samples.push(process.memoryUsage());

    // 分析内存使用趋势
    const heapUsedTrend = samples.map(s => s.heapUsed);
    const memoryGrowth = heapUsedTrend[heapUsedTrend.length - 1] - heapUsedTrend[0];
    const averageGrowth = memoryGrowth / heapUsedTrend.length;

    const result: TestResult = {
      timestamp: new Date(),
      testType: 'memory',
      config: { iterations },
      metrics: {
        totalRequests: iterations,
        successfulRequests: iterations,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        throughput: iterations / ((Date.now() - Date.now()) / 1000),
        errorRate: 0,
        errors: [],
      },
      systemMetrics: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: 0,
        gcStats: gc ? { gc: true } : undefined,
      },
      details: {
        initialMemory,
        finalMemory: process.memoryUsage(),
        memoryGrowth,
        averageGrowth,
        samples: samples.length,
      },
    };

    this.results.push(result);
    logger.info('内存泄漏测试完成', {
      memoryGrowth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
      averageGrowth: `${(averageGrowth / 1024).toFixed(2)}KB/iteration`,
    });
  }

  /**
   * 生成测试报告
   */
  private async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date(),
      summary: {
        totalTests: this.results.length,
        testTypes: this.results.map(r => r.testType),
        overallHealth: this.calculateOverallHealth(),
      },
      results: this.results,
      recommendations: this.generateRecommendations(),
    };

    // 根据格式输出报告
    switch (this.config.output.format) {
      case 'json':
        await this.writeJsonReport(report);
        break;
      case 'html':
        await this.writeHtmlReport(report);
        break;
      case 'csv':
        await this.writeCsvReport(report);
        break;
    }

    logger.info('测试报告已生成', { filePath: this.config.output.filePath });
  }

  /**
   * 写入JSON报告
   */
  private async writeJsonReport(report: any): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(this.config.output.filePath, JSON.stringify(report, null, 2));
  }

  /**
   * 写入HTML报告
   */
  private async writeHtmlReport(report: any): Promise<void> {
    const fs = require('fs').promises;
    const html = this.generateHtmlReport(report);
    await fs.writeFile(this.config.output.filePath, html);
  }

  /**
   * 写入CSV报告
   */
  private async writeCsvReport(report: any): Promise<void> {
    const fs = require('fs').promises;
    const csv = this.generateCsvReport(report);
    await fs.writeFile(this.config.output.filePath, csv);
  }

  /**
   * 生成HTML报告
   */
  private generateHtmlReport(report: any): string {
    // 简化的HTML报告生成
    return `
<!DOCTYPE html>
<html>
<head>
  <title>性能测试报告</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .metric { margin: 10px 0; }
    .error { color: red; }
    .success { color: green; }
  </style>
</head>
<body>
  <h1>性能测试报告</h1>
  <p>生成时间: ${report.timestamp}</p>

  <h2>测试摘要</h2>
  <div class="metric">
    <strong>总测试数:</strong> ${report.summary.totalTests}
  </div>
  <div class="metric">
    <strong>测试类型:</strong> ${report.summary.testTypes.join(', ')}
  </div>
  <div class="metric ${report.summary.overallHealth.healthy ? 'success' : 'error'}">
    <strong>整体健康状态:</strong> ${report.summary.overallHealth.status}
  </div>

  <h2>详细结果</h2>
  ${report.results.map((result: any) => `
    <h3>${result.testType.toUpperCase()} 测试</h3>
    <table>
      <tr>
        <th>指标</th>
        <th>值</th>
      </tr>
      <tr>
        <td>总请求数</td>
        <td>${result.metrics.totalRequests}</td>
      </tr>
      <tr>
        <td>成功率</td>
        <td>${((result.metrics.successfulRequests / result.metrics.totalRequests) * 100).toFixed(2)}%</td>
      </tr>
      <tr>
        <td>平均响应时间</td>
        <td>${result.metrics.averageResponseTime.toFixed(2)}ms</td>
      </tr>
      <tr>
        <td>P95响应时间</td>
        <td>${result.metrics.p95.toFixed(2)}ms</td>
      </tr>
      <tr>
        <td>吞吐量</td>
        <td>${result.metrics.throughput.toFixed(2)} req/s</td>
      </tr>
    </table>
  `).join('')}

  <h2>优化建议</h2>
  <ul>
    ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
  </ul>
</body>
</html>
    `;
  }

  /**
   * 生成CSV报告
   */
  private generateCsvReport(report: any): string {
    const headers = [
      'Test Type',
      'Total Requests',
      'Success Rate',
      'Avg Response Time',
      'P95 Response Time',
      'Throughput',
      'Error Rate',
    ];

    const rows = report.results.map((result: any) => [
      result.testType,
      result.metrics.totalRequests,
      ((result.metrics.successfulRequests / result.metrics.totalRequests) * 100).toFixed(2),
      result.metrics.averageResponseTime.toFixed(2),
      result.metrics.p95.toFixed(2),
      result.metrics.throughput.toFixed(2),
      (result.metrics.errorRate * 100).toFixed(2),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallHealth() {
    const healthyTests = this.results.filter(r => r.metrics.errorRate < 0.05).length;
    const healthScore = (healthyTests / this.results.length) * 100;

    return {
      score: healthScore,
      status: healthScore >= 90 ? '健康' : healthScore >= 70 ? '警告' : '不健康',
      healthy: healthScore >= 70,
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    for (const result of this.results) {
      if (result.metrics.errorRate > 0.05) {
        recommendations.push(`${result.testType}: 错误率过高(${(result.metrics.errorRate * 100).toFixed(2)}%)，需要检查错误日志`);
      }

      if (result.metrics.averageResponseTime > 1000) {
        recommendations.push(`${result.testType}: 平均响应时间过长(${result.metrics.averageResponseTime.toFixed(2)}ms)，建议优化`);
      }

      if (result.metrics.p95 > 5000) {
        recommendations.push(`${result.testType}: P95响应时间过长(${result.metrics.p95.toFixed(2)}ms)，存在性能瓶颈`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('所有测试指标正常，系统性能良好');
    }

    return recommendations;
  }

  /**
   * 工具函数：计算百分位数
   */
  private percentile(values: number[], p: number): number {
    const index = Math.ceil(values.length * p) - 1;
    return values[index] || 0;
  }

  /**
   * 工具函数：加权随机选择
   */
  private weightedRandom<T>(items: Array<{ weight?: number; value: T }>): T {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight || 1;
      if (random <= 0) {
        return item.value as T;
      }
    }

    return items[items.length - 1].value as T;
  }

  /**
   * 工具函数：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取系统指标
   */
  private getSystemMetrics() {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage().user / 1000000, // 转换为秒
    };
  }
}

// 导出测试套件
export const performanceTestSuite = new PerformanceTestSuite();