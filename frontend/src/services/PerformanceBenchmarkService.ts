/**
 * 性能基准测试服务
 * 提供性能基准测试、对比分析和报告生成功能
 */

export interface BenchmarkTest {
  id: string;
  name: string;
  description: string;
  type: 'api' | 'database' | 'memory' | 'frontend' | 'load';
  config: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    iterations: number;
    concurrency: number;
    duration?: number;
    rampUp?: number;
  };
  createdAt: number;
  lastRun?: number;
}

export interface BenchmarkResult {
  testId: string;
  testName: string;
  testType: string;
  timestamp: number;
  duration: number;
  iterations: number;
  concurrency: number;
  results: {
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
    throughput: number; // requests per second
    errorRate: number;
    errors: Array<{
      type: string;
      count: number;
      message: string;
    }>;
  };
  systemMetrics: {
    cpu: {
      average: number;
      max: number;
    };
    memory: {
      average: number;
      max: number;
      initial: number;
      final: number;
    };
  };
  comparison?: {
    previousResult?: BenchmarkResult;
    improvement: number;
    regression: number;
  };
}

export interface BenchmarkReport {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  tests: BenchmarkResult[];
  summary: {
    totalTests: number;
    averageThroughput: number;
    averageResponseTime: number;
    averageErrorRate: number;
    overallPerformance: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  };
  trends: Array<{
    testName: string;
    results: BenchmarkResult[];
    trend: 'improving' | 'stable' | 'degrading';
  }>;
}

class PerformanceBenchmarkService {
  private static instance: PerformanceBenchmarkService;
  private tests: Map<string, BenchmarkTest> = new Map();
  private results: Map<string, BenchmarkResult[]> = new Map();
  private reports: Map<string, BenchmarkReport> = new Map();

  private constructor() {
    this.initializeDefaultTests();
  }

  static getInstance(): PerformanceBenchmarkService {
    if (!PerformanceBenchmarkService.instance) {
      PerformanceBenchmarkService.instance = new PerformanceBenchmarkService();
    }
    return PerformanceBenchmarkService.instance;
  }

  /**
   * 初始化默认测试
   */
  private initializeDefaultTests(): void {
    const defaultTests: BenchmarkTest[] = [
      {
        id: 'api_health_check',
        name: '健康检查API性能测试',
        description: '测试健康检查端点的响应性能',
        type: 'api',
        config: {
          url: '/health',
          method: 'GET',
          iterations: 100,
          concurrency: 10,
          duration: 30000
        },
        createdAt: Date.now()
      },
      {
        id: 'api_chat_completion',
        name: '聊天完成API性能测试',
        description: '测试聊天完成端点的响应性能',
        type: 'api',
        config: {
          url: '/api/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            agentId: 'test-agent',
            message: 'Hello, this is a test message.',
            stream: false
          },
          iterations: 50,
          concurrency: 5,
          duration: 60000
        },
        createdAt: Date.now()
      },
      {
        id: 'api_agent_list',
        name: '智能体列表API性能测试',
        description: '测试获取智能体列表端点的响应性能',
        type: 'api',
        config: {
          url: '/api/agents',
          method: 'GET',
          iterations: 200,
          concurrency: 20,
          duration: 30000
        },
        createdAt: Date.now()
      },
      {
        id: 'frontend_component_render',
        name: '前端组件渲染性能测试',
        description: '测试复杂组件的渲染性能',
        type: 'frontend',
        config: {
          iterations: 100,
          concurrency: 1,
          duration: 30000
        },
        createdAt: Date.now()
      },
      {
        id: 'memory_allocation',
        name: '内存分配性能测试',
        description: '测试内存分配和垃圾回收性能',
        type: 'memory',
        config: {
          iterations: 1000,
          concurrency: 1,
          duration: 60000
        },
        createdAt: Date.now()
      },
      {
        id: 'load_test',
        name: '负载测试',
        description: '模拟高并发负载测试',
        type: 'load',
        config: {
          iterations: 500,
          concurrency: 50,
          duration: 120000,
          rampUp: 30000
        },
        createdAt: Date.now()
      }
    ];

    defaultTests.forEach(test => {
      this.tests.set(test.id, test);
    });
  }

  /**
   * 运行基准测试
   */
  async runBenchmark(testId: string): Promise<BenchmarkResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`测试不存在: ${testId}`);
    }

    console.log(`开始运行基准测试: ${test.name}`);

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    const systemMetrics = {
      cpu: [] as number[],
      memory: [] as number[]
    };

    try {
      let result: BenchmarkResult;

      switch (test.type) {
        case 'api':
          result = await this.runApiBenchmark(test, systemMetrics);
          break;
        case 'frontend':
          result = await this.runFrontendBenchmark(test, systemMetrics);
          break;
        case 'memory':
          result = await this.runMemoryBenchmark(test, systemMetrics);
          break;
        case 'load':
          result = await this.runLoadBenchmark(test, systemMetrics);
          break;
        default:
          throw new Error(`不支持的测试类型: ${test.type}`);
      }

      const endTime = performance.now();
      const endMemory = this.getMemoryUsage();

      // 更新系统指标
      result.systemMetrics = {
        cpu: {
          average: systemMetrics.cpu.reduce((a, b) => a + b, 0) / systemMetrics.cpu.length,
          max: Math.max(...systemMetrics.cpu)
        },
        memory: {
          average: systemMetrics.memory.reduce((a, b) => a + b, 0) / systemMetrics.memory.length,
          max: Math.max(...systemMetrics.memory),
          initial: startMemory.heapUsed,
          final: endMemory.heapUsed
        }
      };

      // 更新测试的最后运行时间
      test.lastRun = Date.now();

      // 保存结果
      if (!this.results.has(testId)) {
        this.results.set(testId, []);
      }
      this.results.get(testId)!.push(result);

      console.log(`基准测试完成: ${test.name}`);
      return result;

    } catch (error) {
      console.error(`基准测试失败: ${test.name}`, error);
      throw error;
    }
  }

  /**
   * 运行API基准测试
   */
  private async runApiBenchmark(test: BenchmarkTest, systemMetrics: { cpu: number[], memory: number[] }): Promise<BenchmarkResult> {
    const { url, method = 'GET', headers = {}, body, iterations, concurrency } = test.config;

    const startTime = performance.now();
    const requests: Array<{ startTime: number; endTime: number; success: boolean; error?: string }> = [];
    const errors: Array<{ type: string; count: number; message: string }> = [];

    // 监控系统指标
    const metricsInterval = setInterval(() => {
      systemMetrics.cpu.push(this.getCpuUsage());
      systemMetrics.memory.push(this.getMemoryUsage().heapUsed);
    }, 1000);

    try {
      // 并发执行请求
      const promises: Promise<void>[] = [];
      for (let i = 0; i < iterations; i++) {
        promises.push(this.executeRequest(url, method, headers, body, requests, errors));

        // 控制并发数
        if (promises.length >= concurrency) {
          await Promise.allSettled(promises.splice(0, concurrency));
        }
      }

      // 等待剩余请求完成
      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }

    } finally {
      clearInterval(metricsInterval);
    }

    const endTime = performance.now();

    // 计算统计指标
    const responseTimes = requests
      .filter(r => r.success)
      .map(r => r.endTime - r.startTime)
      .sort((a, b) => a - b);

    const successfulRequests = requests.filter(r => r.success).length;
    const failedRequests = requests.filter(r => !r.success).length;

    return {
      testId: test.id,
      testName: test.name,
      testType: test.type,
      timestamp: Date.now(),
      duration: endTime - startTime,
      iterations,
      concurrency,
      results: {
        totalRequests: requests.length,
        successfulRequests,
        failedRequests,
        averageResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
        minResponseTime: responseTimes.length > 0 ? responseTimes[0] : 0,
        maxResponseTime: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
        p50: this.calculatePercentile(responseTimes, 50),
        p90: this.calculatePercentile(responseTimes, 90),
        p95: this.calculatePercentile(responseTimes, 95),
        p99: this.calculatePercentile(responseTimes, 99),
        throughput: (successfulRequests / (endTime - startTime)) * 1000, // requests per second
        errorRate: (failedRequests / requests.length) * 100,
        errors
      },
      systemMetrics: {
        cpu: { average: 0, max: 0 },
        memory: { average: 0, max: 0, initial: 0, final: 0 }
      }
    };
  }

  /**
   * 执行单个请求
   */
  private async executeRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    requests: Array<{ startTime: number; endTime: number; success: boolean; error?: string }>,
    errors: Array<{ type: string; count: number; message: string }>
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const options: RequestInit = {
        method,
        headers: {
          ...headers,
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const endTime = performance.now();

      requests.push({
        startTime,
        endTime,
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`
      });

      if (!response.ok) {
        const errorType = response.status >= 500 ? 'server_error' : 'client_error';
        const existingError = errors.find(e => e.type === errorType);
        if (existingError) {
          existingError.count++;
        } else {
          errors.push({
            type: errorType,
            count: 1,
            message: `HTTP ${response.status} ${response.statusText}`
          });
        }
      }

    } catch (error) {
      const endTime = performance.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      requests.push({
        startTime,
        endTime,
        success: false,
        error: errorMessage
      });

      const existingError = errors.find(e => e.type === 'network_error');
      if (existingError) {
        existingError.count++;
      } else {
        errors.push({
          type: 'network_error',
          count: 1,
          message: errorMessage
        });
      }
    }
  }

  /**
   * 运行前端基准测试
   */
  private async runFrontendBenchmark(test: BenchmarkTest, systemMetrics: { cpu: number[], memory: number[] }): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const renderTimes: number[] = [];

    // 监控系统指标
    const metricsInterval = setInterval(() => {
      systemMetrics.cpu.push(this.getCpuUsage());
      systemMetrics.memory.push(this.getMemoryUsage().heapUsed);
    }, 1000);

    try {
      for (let i = 0; i < test.config.iterations; i++) {
        const renderStart = performance.now();

        // 模拟组件渲染 - 这里可以替换为实际的组件渲染测试
        await this.simulateComponentRender();

        const renderEnd = performance.now();
        renderTimes.push(renderEnd - renderStart);
      }

    } finally {
      clearInterval(metricsInterval);
    }

    const endTime = performance.now();
    renderTimes.sort((a, b) => a - b);

    return {
      testId: test.id,
      testName: test.name,
      testType: test.type,
      timestamp: Date.now(),
      duration: endTime - startTime,
      iterations: test.config.iterations,
      concurrency: test.config.concurrency,
      results: {
        totalRequests: test.config.iterations,
        successfulRequests: test.config.iterations,
        failedRequests: 0,
        averageResponseTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
        minResponseTime: renderTimes[0],
        maxResponseTime: renderTimes[renderTimes.length - 1],
        p50: this.calculatePercentile(renderTimes, 50),
        p90: this.calculatePercentile(renderTimes, 90),
        p95: this.calculatePercentile(renderTimes, 95),
        p99: this.calculatePercentile(renderTimes, 99),
        throughput: (test.config.iterations / (endTime - startTime)) * 1000,
        errorRate: 0,
        errors: []
      },
      systemMetrics: {
        cpu: { average: 0, max: 0 },
        memory: { average: 0, max: 0, initial: 0, final: 0 }
      }
    };
  }

  /**
   * 运行内存基准测试
   */
  private async runMemoryBenchmark(test: BenchmarkTest, systemMetrics: { cpu: number[], memory: number[] }): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const allocationTimes: number[] = [];
    const initialMemory = this.getMemoryUsage().heapUsed;

    // 监控系统指标
    const metricsInterval = setInterval(() => {
      systemMetrics.cpu.push(this.getCpuUsage());
      systemMetrics.memory.push(this.getMemoryUsage().heapUsed);
    }, 1000);

    try {
      for (let i = 0; i < test.config.iterations; i++) {
        const allocStart = performance.now();

        // 模拟内存分配
        const data = new Array(1000).fill(0).map(() => ({
          id: Math.random(),
          data: new Array(100).fill(Math.random())
        }));

        const allocEnd = performance.now();
        allocationTimes.push(allocEnd - allocStart);

        // 模拟数据处理
        await new Promise(resolve => setTimeout(resolve, 1));

        // 清理引用，让垃圾回收器可以回收内存
        data.length = 0;
      }

      // 强制垃圾回收（如果可用）
      if (window.gc) {
        window.gc();
      }

    } finally {
      clearInterval(metricsInterval);
    }

    const endTime = performance.now();
    allocationTimes.sort((a, b) => a - b);

    return {
      testId: test.id,
      testName: test.name,
      testType: test.type,
      timestamp: Date.now(),
      duration: endTime - startTime,
      iterations: test.config.iterations,
      concurrency: test.config.concurrency,
      results: {
        totalRequests: test.config.iterations,
        successfulRequests: test.config.iterations,
        failedRequests: 0,
        averageResponseTime: allocationTimes.reduce((a, b) => a + b, 0) / allocationTimes.length,
        minResponseTime: allocationTimes[0],
        maxResponseTime: allocationTimes[allocationTimes.length - 1],
        p50: this.calculatePercentile(allocationTimes, 50),
        p90: this.calculatePercentile(allocationTimes, 90),
        p95: this.calculatePercentile(allocationTimes, 95),
        p99: this.calculatePercentile(allocationTimes, 99),
        throughput: (test.config.iterations / (endTime - startTime)) * 1000,
        errorRate: 0,
        errors: []
      },
      systemMetrics: {
        cpu: { average: 0, max: 0 },
        memory: { average: 0, max: 0, initial, final: this.getMemoryUsage().heapUsed }
      }
    };
  }

  /**
   * 运行负载测试
   */
  private async runLoadBenchmark(test: BenchmarkTest, systemMetrics: { cpu: number[], memory: number[] }): Promise<BenchmarkResult> {
    // 负载测试是API测试的扩展版本
    return this.runApiBenchmark(test, systemMetrics);
  }

  /**
   * 模拟组件渲染
   */
  private async simulateComponentRender(): Promise<void> {
    // 模拟DOM操作和组件渲染
    const fragment = document.createDocumentFragment();
    const elements: HTMLElement[] = [];

    for (let i = 0; i < 100; i++) {
      const div = document.createElement('div');
      div.textContent = `Test element ${i}`;
      div.className = 'test-element';
      elements.push(div);
      fragment.appendChild(div);
    }

    // 模拟布局计算
    fragment.querySelectorAll('.test-element');

    // 清理
    elements.forEach(el => el.remove());
  }

  /**
   * 计算百分位数
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * 获取CPU使用率
   */
  private getCpuUsage(): number {
    // 简化的CPU使用率估算
    // 在实际应用中，可能需要使用Performance API或其他方法
    return Math.random() * 20 + 10; // 模拟10-30%的CPU使用率
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): NodeJS.MemoryUsage {
    if (performance.memory) {
      return {
        rss: performance.memory.usedJSHeapSize,
        heapTotal: performance.memory.totalJSHeapSize,
        heapUsed: performance.memory.usedJSHeapSize,
        external: 0,
        arrayBuffers: performance.memory.usedJSHeapSize
      };
    }

    // 默认值
    return {
      rss: 50 * 1024 * 1024,
      heapTotal: 50 * 1024 * 1024,
      heapUsed: 30 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0
    };
  }

  /**
   * 创建基准测试
   */
  createBenchmarkTest(test: Omit<BenchmarkTest, 'id' | 'createdAt'>): BenchmarkTest {
    const newTest: BenchmarkTest = {
      ...test,
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };

    this.tests.set(newTest.id, newTest);
    return newTest;
  }

  /**
   * 获取所有测试
   */
  getBenchmarkTests(): BenchmarkTest[] {
    return Array.from(this.tests.values());
  }

  /**
   * 获取测试结果
   */
  getBenchmarkResults(testId: string, limit: number = 10): BenchmarkResult[] {
    const results = this.results.get(testId) || [];
    return results.slice(-limit);
  }

  /**
   * 生成基准测试报告
   */
  async generateBenchmarkReport(testIds: string[], name: string, description: string): Promise<BenchmarkReport> {
    const allResults: BenchmarkResult[] = [];
    const trends: Array<{ testName: string; results: BenchmarkResult[]; trend: 'improving' | 'stable' | 'degrading' }> = [];

    for (const testId of testIds) {
      const test = this.tests.get(testId);
      const results = this.results.get(testId) || [];

      if (test && results.length > 0) {
        allResults.push(...results.slice(-5)); // 取最近5次结果

        // 分析趋势
        if (results.length >= 3) {
          const recentResults = results.slice(-3);
          const throughputs = recentResults.map(r => r.results?.throughput ?? 0);
          const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;

          let trend: 'improving' | 'stable' | 'degrading' = 'stable';
          if (throughputs[2]! > throughputs[0]! * 1.1) {
            trend = 'improving';
          } else if (throughputs[2]! < throughputs[0]! * 0.9) {
            trend = 'degrading';
          }

          trends.push({
            testName: test.name,
            results: recentResults,
            trend
          });
        }
      }
    }

    // 生成摘要
    const totalTests = allResults.length;
    const averageThroughput = allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.results.throughput, 0) / allResults.length
      : 0;
    const averageResponseTime = allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.results.averageResponseTime, 0) / allResults.length
      : 0;
    const averageErrorRate = allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.results.errorRate, 0) / allResults.length
      : 0;

    // 评估整体性能
    let overallPerformance: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (averageThroughput > 100 && averageResponseTime < 200 && averageErrorRate < 1) {
      overallPerformance = 'excellent';
    } else if (averageThroughput > 50 && averageResponseTime < 500 && averageErrorRate < 5) {
      overallPerformance = 'good';
    } else if (averageThroughput > 20 && averageResponseTime < 1000 && averageErrorRate < 10) {
      overallPerformance = 'fair';
    }

    // 生成建议
    const recommendations: string[] = [];
    if (averageResponseTime > 1000) {
      recommendations.push('响应时间较长，建议优化API性能或增加缓存');
    }
    if (averageErrorRate > 5) {
      recommendations.push('错误率较高，建议检查系统稳定性');
    }
    if (averageThroughput < 20) {
      recommendations.push('吞吐量较低，建议优化系统性能');
    }

    const report: BenchmarkReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      createdAt: Date.now(),
      tests: allResults,
      summary: {
        totalTests,
        averageThroughput,
        averageResponseTime,
        averageErrorRate,
        overallPerformance,
        recommendations
      },
      trends
    };

    this.reports.set(report.id, report);
    return report;
  }

  /**
   * 获取基准测试报告
   */
  getBenchmarkReport(reportId: string): BenchmarkReport | null {
    return this.reports.get(reportId) || null;
  }

  /**
   * 获取所有基准测试报告
   */
  getBenchmarkReports(): BenchmarkReport[] {
    return Array.from(this.reports.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 导出基准测试结果
   */
  exportBenchmarkResults(testId: string): string {
    const test = this.tests.get(testId);
    const results = this.results.get(testId) || [];

    return JSON.stringify({
      test,
      results,
      exportedAt: Date.now()
    }, null, 2);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.tests.clear();
    this.results.clear();
    this.reports.clear();
  }
}

// 导出单例实例
export const performanceBenchmarkService = PerformanceBenchmarkService.getInstance();

// 导出类型和服务类
export default PerformanceBenchmarkService;