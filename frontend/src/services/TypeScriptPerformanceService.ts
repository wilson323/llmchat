/**
 * TypeScript编译性能监控服务
 * 实时监控TypeScript编译性能、类型检查时间和IDE响应性
 */

export interface TypeScriptCompilationMetrics {
  timestamp: number;
  compilation: {
    duration: number; // 编译持续时间(ms)
    filesCount: number; // 编译文件数量
    linesOfCode: number; // 代码行数
    typesChecked: number; // 类型检查数量
    errorsCount: number; // 错误数量
    warningsCount: number; // 警告数量
  };
  performance: {
    typeCheckTime: number; // 类型检查时间(ms)
    emitTime: number; // 生成时间(ms)
    resolveTime: number; // 模块解析时间(ms)
    parseTime: number; // 解析时间(ms)
    memoryUsage: number; // 内存使用(MB)
  };
  ide: {
    responseTime: number; // IDE响应时间(ms)
    IntelliSenseLatency: number; // 智能提示延迟(ms)
    completionTime: number; // 代码补全时间(ms)
    navigationTime: number; // 跳转定义时间(ms)
    renameTime: number; // 重构时间(ms)
  };
  build: {
    totalTime: number; // 总构建时间(ms)
    bundleSize: number; // 包大小(KB)
    chunkCount: number; // 代码块数量
    treeShakingEfficiency: number; // Tree shaking效率(%)
  };
}

export interface TypeScriptPerformanceAlert {
  id: string;
  type: 'compilation_slow' | 'type_check_slow' | 'ide_lag' | 'memory_high' | 'bundle_large';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  recommendation: string;
  timestamp: number;
  resolved: boolean;
}

export interface TypeScriptPerformanceTrend {
  timestamp: number;
  compilationSpeed: number; // 编译速度(lines/sec)
  typeCheckSpeed: number; // 类型检查速度(types/sec)
  errorRate: number; // 错误率(errors/KLOC)
  buildEfficiency: number; // 构建效率(0-100)
  memoryTrend: number; // 内存趋势(MB)
  bundleGrowth: number; // 包增长趋势(%)
}

class TypeScriptPerformanceService {
  private static instance: TypeScriptPerformanceService;
  private eventSource: EventSource | null = null;
  private subscribers: Map<string, {
    onMetrics: (metrics: TypeScriptCompilationMetrics) => void;
    onAlert: (alert: TypeScriptPerformanceAlert) => void;
    onTrend: (trend: TypeScriptPerformanceTrend) => void;
  }> = new Map();

  private metricsHistory: TypeScriptCompilationMetrics[] = [];
  private alerts: TypeScriptPerformanceAlert[] = [];
  private trends: TypeScriptPerformanceTrend[] = [];
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  private constructor() {}

  static getInstance(): TypeScriptPerformanceService {
    if (!TypeScriptPerformanceService.instance) {
      TypeScriptPerformanceService.instance = new TypeScriptPerformanceService();
    }
    return TypeScriptPerformanceService.instance;
  }

  /**
   * 订阅TypeScript性能监控
   */
  subscribe(
    subscriptionId: string,
    onMetrics: (metrics: TypeScriptCompilationMetrics) => void,
    onAlert: (alert: TypeScriptPerformanceAlert) => void,
    onTrend: (trend: TypeScriptPerformanceTrend) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // 清理现有订阅
      if (this.subscribers.has(subscriptionId)) {
        this.subscribers.delete(subscriptionId);
      }

      this.subscribers.set(subscriptionId, {
        onMetrics,
        onAlert,
        onTrend
      });

      // 建立连接
      if (!this.eventSource) {
        this.connect();
      }

      resolve(true);
    });
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): void {
    this.subscribers.delete(subscriptionId);

    if (this.subscribers.size === 0 && this.eventSource) {
      this.disconnect();
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): TypeScriptCompilationMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  /**
   * 获取性能历史数据
   */
  getMetricsHistory(limit?: number): TypeScriptCompilationMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): TypeScriptPerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * 获取性能趋势
   */
  getPerformanceTrends(limit?: number): TypeScriptPerformanceTrend[] {
    if (limit) {
      return this.trends.slice(-limit);
    }
    return [...this.trends];
  }

  /**
   * 建立SSE连接
   */
  private connect(): void {
    try {
      const token = localStorage.getItem('token');
      const url = `/api/typescript/performance/stream${token ? `?token=${token}` : ''}`;

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('TypeScript性能监控连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'metrics') {
            const metrics: TypeScriptCompilationMetrics = data.payload;
            this.handleMetricsUpdate(metrics);
          } else if (data.type === 'alert') {
            const alert: TypeScriptPerformanceAlert = data.payload;
            this.handleAlert(alert);
          } else if (data.type === 'trend') {
            const trend: TypeScriptPerformanceTrend = data.payload;
            this.handleTrendUpdate(trend);
          }
        } catch (error) {
          console.error('解析TypeScript性能数据失败:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('TypeScript性能监控连接错误:', error);
        this.isConnected = false;
        this.attemptReconnect();
      };

    } catch (error) {
      console.error('建立TypeScript性能监控连接失败:', error);
      this.attemptReconnect();
    }
  }

  /**
   * 断开连接
   */
  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('TypeScript性能监控达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`${delay}ms后尝试TypeScript性能监控第${this.reconnectAttempts}次重连`);

    setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }

  /**
   * 处理性能指标更新
   */
  private handleMetricsUpdate(metrics: TypeScriptCompilationMetrics): void {
    this.metricsHistory.push(metrics);

    // 保持最近100个数据点
    if (this.metricsHistory.length > 100) {
      this.metricsHistory = this.metricsHistory.slice(-100);
    }

    // 通知所有订阅者
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.onMetrics(metrics);
      } catch (error) {
        console.error('通知订阅者失败:', error);
      }
    });

    // 分析性能趋势
    this.analyzePerformanceTrend(metrics);
  }

  /**
   * 处理告警
   */
  private handleAlert(alert: TypeScriptPerformanceAlert): void {
    // 检查是否已存在相同ID的告警
    const existingIndex = this.alerts.findIndex(a => a.id === alert.id);
    if (existingIndex >= 0) {
      this.alerts[existingIndex] = alert;
    } else {
      this.alerts.push(alert);
    }

    // 保持最近50个告警
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // 通知所有订阅者
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.onAlert(alert);
      } catch (error) {
        console.error('通知订阅者失败:', error);
      }
    });
  }

  /**
   * 处理趋势更新
   */
  private handleTrendUpdate(trend: TypeScriptPerformanceTrend): void {
    this.trends.push(trend);

    // 保持最近30个趋势数据点
    if (this.trends.length > 30) {
      this.trends = this.trends.slice(-30);
    }

    // 通知所有订阅者
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.onTrend(trend);
      } catch (error) {
        console.error('通知订阅者失败:', error);
      }
    });
  }

  /**
   * 分析性能趋势
   */
  private analyzePerformanceTrend(currentMetrics: TypeScriptCompilationMetrics): void {
    if (this.metricsHistory.length < 2) return;

    const previousMetrics = this.metricsHistory[this.metricsHistory.length - 2];

    const trend: TypeScriptPerformanceTrend = {
      timestamp: currentMetrics.timestamp,
      compilationSpeed: currentMetrics.compilation.linesOfCode / (currentMetrics.compilation.duration / 1000),
      typeCheckSpeed: currentMetrics.compilation.typesChecked / (currentMetrics.performance.typeCheckTime / 1000),
      errorRate: (currentMetrics.compilation.errorsCount / currentMetrics.compilation.linesOfCode) * 1000,
      buildEfficiency: this.calculateBuildEfficiency(currentMetrics),
      memoryTrend: currentMetrics.performance.memoryUsage,
      bundleGrowth: this.calculateBundleGrowth(currentMetrics)
    };

    this.handleTrendUpdate(trend);
  }

  /**
   * 计算构建效率
   */
  private calculateBuildEfficiency(metrics: TypeScriptCompilationMetrics): number {
    const baseScore = 100;

    // 编译时间评分
    const compilationScore = Math.max(0, baseScore - (metrics.compilation.duration / 100));

    // 错误率评分
    const errorScore = Math.max(0, baseScore - (metrics.compilation.errorsCount * 10));

    // 内存使用评分
    const memoryScore = Math.max(0, baseScore - (metrics.performance.memoryUsage / 10));

    return Math.round((compilationScore + errorScore + memoryScore) / 3);
  }

  /**
   * 计算包增长趋势
   */
  private calculateBundleGrowth(metrics: TypeScriptCompilationMetrics): number {
    if (this.metricsHistory.length < 2) return 0;

    const previousMetrics = this.metricsHistory[this.metricsHistory.length - 2];
    const growth = ((metrics.build.bundleSize - previousMetrics.build.bundleSize) / previousMetrics.build.bundleSize) * 100;

    return Math.round(growth * 100) / 100; // 保留两位小数
  }

  /**
   * 手动触发性能分析
   */
  async triggerPerformanceAnalysis(): Promise<TypeScriptCompilationMetrics | null> {
    try {
      const response = await fetch('/api/typescript/performance/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data.metrics : null;
      }
    } catch (error) {
      console.error('触发TypeScript性能分析失败:', error);
    }
    return null;
  }

  /**
   * 获取性能优化建议
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    try {
      const response = await fetch('/api/typescript/performance/recommendations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data.recommendations : [];
      }
    } catch (error) {
      console.error('获取性能优化建议失败:', error);
    }
    return [];
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.disconnect();
    this.subscribers.clear();
    this.metricsHistory = [];
    this.alerts = [];
    this.trends = [];
  }
}

// 导出单例实例
export const typeScriptPerformanceService = TypeScriptPerformanceService.getInstance();

// 导出类型和服务类
export default TypeScriptPerformanceService;