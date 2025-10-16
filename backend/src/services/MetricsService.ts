/**
 * Prometheus Metrics服务
 * 
 * 提供系统和业务指标收集功能：
 * - HTTP请求duration直方图
 * - HTTP请求按状态码计数
 * - 活动连接数gauge
 * - 智能体使用metrics
 * - 消息发送统计
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '@/utils/logger';

export class MetricsService {
  private static instance: MetricsService | null = null;
  private readonly registry: Registry;

  // HTTP指标
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;
  private readonly activeConnections: Gauge<string>;

  // 业务指标
  private readonly agentRequestTotal: Counter<string>;
  private readonly messagesSentTotal: Counter<string>;
  private readonly messagesSentDuration: Histogram<string>;
  private readonly agentErrorsTotal: Counter<string>;

  // 系统指标
  private readonly systemMemoryUsage: Gauge<string>;
  private readonly systemCpuUsage: Gauge<string>;

  private constructor() {
    // 创建独立的Registry
    this.registry = new Registry();

    // 初始化HTTP指标
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      registers: [this.registry],
    });

    // 初始化业务指标
    this.agentRequestTotal = new Counter({
      name: 'agent_requests_total',
      help: 'Total number of agent requests',
      labelNames: ['agent_id', 'status'],
      registers: [this.registry],
    });

    this.messagesSentTotal = new Counter({
      name: 'messages_sent_total',
      help: 'Total number of messages sent',
      labelNames: ['agent_id', 'user_id'],
      registers: [this.registry],
    });

    this.messagesSentDuration = new Histogram({
      name: 'message_send_duration_seconds',
      help: 'Duration of message sending in seconds',
      labelNames: ['agent_id'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.agentErrorsTotal = new Counter({
      name: 'agent_errors_total',
      help: 'Total number of agent errors',
      labelNames: ['agent_id', 'error_type'],
      registers: [this.registry],
    });

    // 初始化系统指标
    this.systemMemoryUsage = new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.systemCpuUsage = new Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage',
      registers: [this.registry],
    });

    // 收集默认指标（Node.js进程指标）
    collectDefaultMetrics({ register: this.registry });

    // 启动系统指标收集
    this.startSystemMetricsCollection();

    logger.info('✅ MetricsService 初始化完成');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * 获取Registry
   */
  public getRegistry(): Registry {
    return this.registry;
  }

  /**
   * 记录HTTP请求
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestDuration.observe(labels, duration / 1000); // 转换为秒
    this.httpRequestTotal.inc(labels);
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
   * 记录智能体请求
   */
  public recordAgentRequest(agentId: string, status: 'success' | 'failure'): void {
    this.agentRequestTotal.inc({ agent_id: agentId, status });
  }

  /**
   * 记录消息发送
   */
  public recordMessageSent(agentId: string, userId: string, duration: number): void {
    this.messagesSentTotal.inc({ agent_id: agentId, user_id: userId });
    this.messagesSentDuration.observe({ agent_id: agentId }, duration / 1000);
  }

  /**
   * 记录智能体错误
   */
  public recordAgentError(agentId: string, errorType: string): void {
    this.agentErrorsTotal.inc({ agent_id: agentId, error_type: errorType });
  }

  /**
   * 启动系统指标收集
   */
  private startSystemMetricsCollection(): void {
    // 每30秒收集一次系统指标
    setInterval(() => {
      try {
        const memoryUsage = process.memoryUsage();
        
        this.systemMemoryUsage.set({ type: 'rss' }, memoryUsage.rss);
        this.systemMemoryUsage.set({ type: 'heap_total' }, memoryUsage.heapTotal);
        this.systemMemoryUsage.set({ type: 'heap_used' }, memoryUsage.heapUsed);
        this.systemMemoryUsage.set({ type: 'external' }, memoryUsage.external);

        // CPU使用率（简化版本）
        const cpuUsage = process.cpuUsage();
        const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // 转换为秒
        this.systemCpuUsage.set(totalUsage);
      } catch (error: any) {
        logger.error('系统指标收集失败', { error: error.message });
      }
    }, 30000);
  }

  /**
   * 获取所有指标（Prometheus格式）
   */
  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * 获取指标的Content-Type
   */
  public getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * 重置所有指标
   */
  public reset(): void {
    this.registry.resetMetrics();
    logger.info('所有Metrics已重置');
  }
}

// 导出单例实例
export default MetricsService.getInstance();

