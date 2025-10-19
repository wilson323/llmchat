/**
 * 实时性能指标收集服务
 * 通过Server-Sent Events (SSE) 从后端接收实时性能数据
 */

export interface RealTimeMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  requests: {
    total: number;
    perSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    size: number;
    evictions: number;
  };
  database: {
    connections: number;
    queriesPerSecond: number;
    slowQueries: number;
    averageQueryTime: number;
  };
}

export interface PerformanceAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  type: 'cpu' | 'memory' | 'response_time' | 'error_rate' | 'cache' | 'database';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

export interface PerformanceSubscription {
  id: string;
  metrics: RealTimeMetrics[];
  alerts: PerformanceAlert[];
  isConnected: boolean;
  lastUpdate: number;
}

class RealTimePerformanceService {
  private static instance: RealTimePerformanceService;
  private eventSource: EventSource | null = null;
  private subscriptions: Map<string, PerformanceSubscription> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private pingInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): RealTimePerformanceService {
    if (!RealTimePerformanceService.instance) {
      RealTimePerformanceService.instance = new RealTimePerformanceService();
    }
    return RealTimePerformanceService.instance;
  }

  /**
   * 订阅实时性能数据
   */
  subscribe(
    subscriptionId: string,
    onMetrics: (metrics: RealTimeMetrics) => void,
    onAlert: (alert: PerformanceAlert) => void,
    onConnectionChange?: (isConnected: boolean) => void
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // 如果已经存在订阅，先清理
      if (this.subscriptions.has(subscriptionId)) {
        this.unsubscribe(subscriptionId);
      }

      // 创建新的订阅
      const subscription: PerformanceSubscription = {
        id: subscriptionId,
        metrics: [],
        alerts: [],
        isConnected: false,
        lastUpdate: Date.now()
      };

      this.subscriptions.set(subscriptionId, subscription);

      // 如果还没有连接，建立连接
      if (!this.eventSource) {
        this.connect(onMetrics, onAlert, onConnectionChange);
      }

      resolve(true);
    });
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);
    }

    // 如果没有活跃的订阅，关闭连接
    if (this.subscriptions.size === 0 && this.eventSource) {
      this.disconnect();
    }
  }

  /**
   * 获取订阅数据
   */
  getSubscription(subscriptionId: string): PerformanceSubscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * 获取所有活跃的订阅
   */
  getActiveSubscriptions(): PerformanceSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * 建立SSE连接
   */
  private connect(
    onMetrics: (metrics: RealTimeMetrics) => void,
    onAlert: (alert: PerformanceAlert) => void,
    onConnectionChange?: (isConnected: boolean) => void
  ): void {
    try {
      const token = localStorage.getItem('token');
      const url = `/api/performance/stream${token ? `?token=${token}` : ''}`;

      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        console.log('实时性能监控连接已建立');
        this.reconnectAttempts = 0;

        // 更新所有订阅的连接状态
        this.subscriptions.forEach(subscription => {
          subscription.isConnected = true;
          subscription.lastUpdate = Date.now();
        });

        // 启动心跳检测
        this.startPingInterval();

        // 通知连接状态变化
        if (onConnectionChange) {
          onConnectionChange(true);
        }
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'metrics') {
            const metrics: RealTimeMetrics = data.payload;

            // 更新所有订阅的指标数据
            this.subscriptions.forEach(subscription => {
              subscription.metrics.push(metrics);
              // 保持最近100个数据点
              if (subscription.metrics.length > 100) {
                subscription.metrics = subscription.metrics.slice(-100);
              }
              subscription.lastUpdate = Date.now();
            });

            // 调用回调函数
            onMetrics(metrics);
          } else if (data.type === 'alert') {
            const alert: PerformanceAlert = data.payload;

            // 更新所有订阅的告警数据
            this.subscriptions.forEach(subscription => {
              // 检查是否已存在相同ID的告警
              const existingIndex = subscription.alerts.findIndex(a => a.id === alert.id);
              if (existingIndex >= 0) {
                subscription.alerts[existingIndex] = alert;
              } else {
                subscription.alerts.push(alert);
              }

              // 保持最近50个告警
              if (subscription.alerts.length > 50) {
                subscription.alerts = subscription.alerts.slice(-50);
              }
              subscription.lastUpdate = Date.now();
            });

            // 调用回调函数
            onAlert(alert);
          }
        } catch (error) {
          console.error('解析实时数据失败:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('实时性能监控连接错误:', error);

        // 更新所有订阅的连接状态
        this.subscriptions.forEach(subscription => {
          subscription.isConnected = false;
        });

        // 清理心跳检测
        this.stopPingInterval();

        // 通知连接状态变化
        if (onConnectionChange) {
          onConnectionChange(false);
        }

        // 尝试重连
        this.attemptReconnect(onMetrics, onAlert, onConnectionChange);
      };

      this.eventSource.addEventListener('ping', () => {
        console.log('收到心跳信号');
      });

      this.eventSource.addEventListener('error', (event) => {
        console.error('SSE错误事件:', event);
      });

    } catch (error) {
      console.error('建立实时性能监控连接失败:', error);
      this.attemptReconnect(onMetrics, onAlert, onConnectionChange);
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

    this.stopPingInterval();

    // 更新所有订阅的连接状态
    this.subscriptions.forEach(subscription => {
      subscription.isConnected = false;
    });
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(
    onMetrics: (metrics: RealTimeMetrics) => void,
    onAlert: (alert: PerformanceAlert) => void,
    onConnectionChange?: (isConnected: boolean) => void
  ): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连`);

    setTimeout(() => {
      this.disconnect();
      this.connect(onMetrics, onAlert, onConnectionChange);
    }, delay);
  }

  /**
   * 启动心跳检测
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      // 检查连接是否活跃
      const now = Date.now();
      let hasActiveSubscription = false;

      this.subscriptions.forEach(subscription => {
        if (subscription.isConnected && (now - subscription.lastUpdate) < 30000) {
          hasActiveSubscription = true;
        }
      });

      // 如果没有活跃的订阅超过30秒，关闭连接
      if (!hasActiveSubscription) {
        console.log('没有活跃的订阅，关闭连接');
        this.disconnect();
      }
    }, 10000); // 每10秒检查一次
  }

  /**
   * 停止心跳检测
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * 手动触发性能指标收集
   */
  async triggerMetricsCollection(): Promise<RealTimeMetrics | null> {
    try {
      const response = await fetch('/api/performance/trigger-metrics', {
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
      console.error('触发性能指标收集失败:', error);
    }
    return null;
  }

  /**
   * 获取历史性能数据
   */
  async getHistoricalMetrics(
    startTime: number,
    endTime: number,
    interval: number = 60000 // 1分钟间隔
  ): Promise<RealTimeMetrics[]> {
    try {
      const response = await fetch('/api/performance/historical-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          startTime,
          endTime,
          interval
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.success ? data.data.metrics : [];
      }
    } catch (error) {
      console.error('获取历史性能数据失败:', error);
    }
    return [];
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.disconnect();
    this.subscriptions.clear();
  }
}

// 导出单例实例
export const realTimePerformanceService = RealTimePerformanceService.getInstance();

// 导出类型和服务类
export default RealTimePerformanceService;