/**
 * Prometheus监控服务
 * 提供API响应时间、请求计数、系统指标监控
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '@/utils/logger';

export class PrometheusService {
  private static instance: PrometheusService;
  private registry: Registry;
  private httpRequestDuration: Histogram<string>;
  private httpRequestTotal: Counter<string>;
  private httpRequestErrors: Counter<string>;
  private activeConnections: Gauge<string>;

  private constructor() {
    // 创建独立的registry
    this.registry = new Registry();

    // 收集默认系统指标（CPU、内存、事件循环延迟等）
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'llmchat_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    // HTTP请求响应时间（直方图）
    this.httpRequestDuration = new Histogram({
      name: 'llmchat_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // HTTP请求总数（计数器）
    this.httpRequestTotal = new Counter({
      name: 'llmchat_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP错误请求数（计数器）
    this.httpRequestErrors = new Counter({
      name: 'llmchat_http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type'],
      registers: [this.registry],
    });

    // 活动连接数（仪表）
    this.activeConnections = new Gauge({
      name: 'llmchat_active_connections',
      help: 'Number of active connections',
      registers: [this.registry],
    });

    logger.info('PrometheusService initialized');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PrometheusService {
    if (!PrometheusService.instance) {
      PrometheusService.instance = new PrometheusService();
    }
    return PrometheusService.instance;
  }

  /**
   * 记录HTTP请求
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route: this.normalizeRoute(route),
      status_code: statusCode.toString(),
    };

    // 记录响应时间
    this.httpRequestDuration.observe(labels, durationSeconds);

    // 增加请求计数
    this.httpRequestTotal.inc(labels);

    // 如果是错误状态码，记录错误
    if (statusCode >= 400) {
      this.httpRequestErrors.inc({
        method: labels.method,
        route: labels.route,
        error_type: statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  }

  /**
   * 增加活动连接数
   */
  public incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  /**
   * 减少活动连接数
   */
  public decrementActiveConnections(): void {
    this.activeConnections.dec();
  }

  /**
   * 获取指标数据（Prometheus格式）
   */
  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * 获取指标内容类型
   */
  public getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * 标准化路由路径（移除动态参数）
   */
  private normalizeRoute(route: string): string {
    // 移除查询参数
    const pathOnly = route.split('?')[0] ?? route;

    // 替换常见的动态参数模式
    return pathOnly
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUID
      .replace(/\/\d+/g, '/:id') // 数字ID
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:token'); // 长token
  }
}

// 导出单例实例
export const prometheusService = PrometheusService.getInstance();
export default prometheusService;
