/**
 * Performance Benchmark Utility
 *
 * Provides tools for measuring, tracking, and reporting API performance metrics.
 */

export interface BenchmarkMetric {
  name: string;
  responseTime: number;
  timestamp: number;
  statusCode: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface BenchmarkStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  successRate: number;
}

export interface BenchmarkReport {
  timestamp: string;
  summary: {
    totalRequests: number;
    overallSuccessRate: number;
    averageResponseTime: number;
    slowestEndpoint: string;
    fastestEndpoint: string;
  };
  endpoints: {
    [endpointName: string]: {
      stats: BenchmarkStats;
      metrics: BenchmarkMetric[];
    };
  };
  recommendations: string[];
}

export class PerformanceBenchmark {
  private readonly metrics: Map<string, BenchmarkMetric[]> = new Map();
  private startTime: number = Date.now();

  /**
   * Record a benchmark metric
   */
  record(name: string, responseTime: number, metadata: {
    statusCode: number;
    success: boolean;
    [key: string]: any;
  }): void {
    const metric: BenchmarkMetric = {
      name,
      responseTime,
      timestamp: Date.now(),
      statusCode: metadata.statusCode,
      success: metadata.success,
      metadata
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
  }

  /**
   * Get statistics for a specific endpoint
   */
  getStats(endpointName: string): BenchmarkStats | null {
    const endpointMetrics = this.metrics.get(endpointName);
    if (!endpointMetrics || endpointMetrics.length === 0) {
      return null;
    }

    const responseTimes = endpointMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const successCount = endpointMetrics.filter(m => m.success).length;

    return {
      count: endpointMetrics.length,
      min: responseTimes[0] || 0,
      max: responseTimes[responseTimes.length - 1] || 0,
      avg: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p95: this.getPercentile(responseTimes, 0.95),
      p99: this.getPercentile(responseTimes, 0.99),
      successRate: (successCount / endpointMetrics.length) * 100
    };
  }

  /**
   * Get all metrics
   */
  getResults(): Record<string, { stats: BenchmarkStats; metrics: BenchmarkMetric[] }> {
    const results: Record<string, { stats: BenchmarkStats; metrics: BenchmarkMetric[] }> = {};

    for (const [endpointName] of this.metrics.entries()) {
      const stats = this.getStats(endpointName);
      const metrics = this.metrics.get(endpointName) || [];

      if (stats) {
        results[endpointName] = { stats, metrics };
      }
    }

    return results;
  }

  /**
   * Generate a comprehensive benchmark report
   */
  generateReport(): string {
    const results = this.getResults();
    const endpointNames = Object.keys(results);

    if (endpointNames.length === 0) {
      return 'No benchmark data available';
    }

    // Calculate overall statistics
    const allMetrics = endpointNames.flatMap(name => results[name]?.metrics ?? []);
    const totalRequests = allMetrics.length;
    const successfulRequests = allMetrics.filter(m => m.success).length;
    const overallSuccessRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const averageResponseTime = totalRequests > 0 ? allMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests : 0;

    // Find slowest and fastest endpoints
    const endpointAverages = endpointNames.map(name => ({
      name,
      avg: results[name]?.stats?.avg ?? 0
    })).sort((a, b) => b.avg - a.avg);

    const slowestEndpoint = endpointAverages[0];
    const fastestEndpoint = endpointAverages[endpointAverages.length - 1];

    // Generate recommendations
    const recommendations = this.generateRecommendations(results);

    let report = '';

    // Summary section
    report += `📊 Performance Benchmark Summary\n`;
    report += `===============================\n`;
    report += `Test Duration: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s\n`;
    report += `Total Requests: ${totalRequests}\n`;
    report += `Overall Success Rate: ${overallSuccessRate.toFixed(1)}%\n`;
    report += `Average Response Time: ${averageResponseTime.toFixed(2)}ms\n`;
    report += `Slowest Endpoint: ${slowestEndpoint?.name ?? 'N/A'} (${slowestEndpoint?.avg.toFixed(2) ?? '0'}ms)\n`;
    report += `Fastest Endpoint: ${fastestEndpoint?.name ?? 'N/A'} (${fastestEndpoint?.avg.toFixed(2) ?? '0'}ms)\n\n`;

    // Individual endpoint details
    report += `🔍 Endpoint Performance Details\n`;
    report += `===============================\n`;

    for (const endpointName of endpointAverages.map(e => e.name)) {
      const stats = results[endpointName]?.stats;
      if (!stats) continue;

      report += `\n${endpointName}:\n`;
      report += `  Requests: ${stats.count}\n`;
      report += `  Success Rate: ${stats.successRate.toFixed(1)}%\n`;
      report += `  Response Times:\n`;
      report += `    Average: ${stats.avg.toFixed(2)}ms\n`;
      report += `    Min: ${stats.min.toFixed(2)}ms\n`;
      report += `    Max: ${stats.max.toFixed(2)}ms\n`;
      report += `    P95: ${stats.p95.toFixed(2)}ms\n`;
      report += `    P99: ${stats.p99.toFixed(2)}ms\n`;
    }

    // Recommendations section
    if (recommendations.length > 0) {
      report += `\n💡 Performance Recommendations\n`;
      report += `===============================\n`;
      recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }

    return report;
  }

  /**
   * Generate performance recommendations based on benchmark results
   */
  private generateRecommendations(results: Record<string, { stats: BenchmarkStats; metrics: BenchmarkMetric[] }>): string[] {
    const recommendations: string[] = [];

    for (const [endpointName, { stats }] of Object.entries(results)) {
      // Slow endpoints
      if (stats.avg > 1000) {
        recommendations.push(`${endpointName} has slow average response time (${stats.avg.toFixed(2)}ms). Consider optimization.`);
      }

      // High P99 latency
      if (stats.p99 > 2000) {
        recommendations.push(`${endpointName} shows high P99 latency (${stats.p99.toFixed(2)}ms). Check for performance bottlenecks.`);
      }

      // Low success rate
      if (stats.successRate < 95) {
        recommendations.push(`${endpointName} has low success rate (${stats.successRate.toFixed(1)}%). Check error handling and reliability.`);
      }

      // High variance
      const varianceCoefficient = (stats.max - stats.min) / stats.avg;
      if (varianceCoefficient > 2) {
        recommendations.push(`${endpointName} shows high response time variance. Consider performance consistency improvements.`);
      }
    }

    return recommendations;
  }

  /**
   * Calculate percentile value from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)] ?? 0;
  }

  /**
   * Clear all benchmark data
   */
  clear(): void {
    this.metrics.clear();
    this.startTime = Date.now();
  }

  /**
   * Get benchmark duration
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}