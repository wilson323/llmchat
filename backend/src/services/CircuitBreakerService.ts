/**
 * 熔断器服务 - 保护外部API调用
 * 实现三种状态：CLOSED、OPEN、HALF_OPEN
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // 正常状态，允许请求通过
  OPEN = 'OPEN',         // 熔断状态，拒绝所有请求
  HALF_OPEN = 'HALF_OPEN' // 半开状态，允许少量请求测试
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // 失败阈值
  successThreshold: number;     // 成功阈值（半开状态）
  timeout: number;             // 超时时间（毫秒）
  resetTimeout: number;        // 重置时间（毫秒）
  monitoringEnabled?: boolean; // 是否启用监控
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  averageResponseTime: number;
  circuitOpenCount: number;
  lastStateChange: Date;
}

export interface CircuitBreakerEvents {
  onStateChange?: (oldState: CircuitState, newState: CircuitState, metrics: CircuitBreakerMetrics) => void;
  onFailure?: (error: Error, metrics: CircuitBreakerMetrics) => void;
  onSuccess?: (responseTime: number, metrics: CircuitBreakerMetrics) => void;
  onTimeout?: (metrics: CircuitBreakerMetrics) => void;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt = Date.now();
  private metrics: CircuitBreakerMetrics;
  private responseTimes: number[] = [];
  private circuitOpenCount = 0;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig,
    private readonly events?: CircuitBreakerEvents
  ) {
    this.metrics = {
      state: this.state,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      circuitOpenCount: 0,
      lastStateChange: new Date(),
    };
  }

  /**
   * 执行受保护的操作
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // 检查是否允许请求通过
    if (!this.allowRequest()) {
      const error = new Error(`熔断器 ${this.name} 处于 ${this.state} 状态，拒绝请求`);
      this.events?.onFailure?.(error, this.getMetrics());
      throw error;
    }

    try {
      // 设置超时
      const result = await this.withTimeout(operation(), this.config.timeout);
      const responseTime = Date.now() - startTime;

      this.onSuccess(responseTime);
      this.events?.onSuccess?.(responseTime, this.getMetrics());

      return result;
    } catch (error) {
      this.onFailure(error as Error);
      this.events?.onFailure?.(error as Error, this.getMetrics());
      throw error;
    }
  }

  /**
   * 检查是否允许请求通过
   */
  private allowRequest(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (now < this.nextAttempt) {
          return false;
        }
        // 尝试进入半开状态
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * 处理成功情况
   */
  private onSuccess(responseTime: number): void {
    this.metrics.totalSuccesses++;
    this.lastSuccessTime = new Date();
    this.updateResponseTime(responseTime);

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount = 0;
        break;

      case CircuitState.HALF_OPEN:
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo(CircuitState.CLOSED);
        }
        break;

      default:
        break;
    }
  }

  /**
   * 处理失败情况
   */
  private onFailure(error: Error): void {
    this.metrics.totalFailures++;
    this.lastFailureTime = new Date();
    this.failureCount++;

    switch (this.state) {
      case CircuitState.CLOSED:
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;

      case CircuitState.HALF_OPEN:
        this.transitionTo(CircuitState.OPEN);
        break;

      default:
        break;
    }
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.metrics.lastStateChange = new Date();

    switch (newState) {
      case CircuitState.OPEN:
        this.nextAttempt = Date.now() + this.config.resetTimeout;
        this.circuitOpenCount++;
        this.metrics.circuitOpenCount = this.circuitOpenCount;
        console.warn(`熔断器 ${this.name} 打开，下次尝试时间: ${new Date(this.nextAttempt).toISOString()}`);
        break;

      case CircuitState.CLOSED:
        this.failureCount = 0;
        this.successCount = 0;
        console.info(`熔断器 ${this.name} 关闭，恢复正常服务`);
        break;

      case CircuitState.HALF_OPEN:
        this.successCount = 0;
        console.info(`熔断器 ${this.name} 进入半开状态，开始测试服务`);
        break;
    }

    this.metrics.state = newState;
    this.events?.onStateChange?.(oldState, newState, this.getMetrics());
  }

  /**
   * 带超时的操作执行
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('操作超时')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 更新响应时间统计
   */
  private updateResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    this.metrics.averageResponseTime = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * 获取熔断器指标
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      ...this.metrics,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      ...(this.lastFailureTime && { lastFailureTime: this.lastFailureTime }),
      ...(this.lastSuccessTime && { lastSuccessTime: this.lastSuccessTime }),
    };
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 手动重置熔断器
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * 强制打开熔断器
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): { healthy: boolean; state: CircuitState; message: string } {
    const metrics = this.getMetrics();

    switch (this.state) {
      case CircuitState.CLOSED:
        return {
          healthy: true,
          state: this.state,
          message: '服务正常'
        };

      case CircuitState.HALF_OPEN:
        return {
          healthy: false,
          state: this.state,
          message: '服务恢复中，正在测试'
        };

      case CircuitState.OPEN: {
        const timeUntilReset = Math.max(0, this.nextAttempt - Date.now());
        return {
          healthy: false,
          state: this.state,
          message: `服务熔断，${Math.ceil(timeUntilReset / 1000)}秒后重试`
        };
      }

      default:
        return {
          healthy: false,
          state: this.state,
          message: '未知状态'
        };
    }
  }
}

/**
 * 熔断器管理器 - 管理多个熔断器实例
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * 创建或获取熔断器
   */
  getCircuitBreaker(
    name: string,
    config?: CircuitBreakerConfig,
    events?: CircuitBreakerEvents
  ): CircuitBreaker {
    let circuitBreaker = this.circuitBreakers.get(name);

    if (!circuitBreaker && config) {
      circuitBreaker = new CircuitBreaker(name, config, events);
      this.circuitBreakers.set(name, circuitBreaker);
    }

    if (!circuitBreaker) {
      throw new Error(`熔断器 ${name} 不存在且未提供配置`);
    }

    return circuitBreaker;
  }

  /**
   * 获取所有熔断器状态
   */
  getAllCircuitBreakers(): { name: string; metrics: CircuitBreakerMetrics }[] {
    return Array.from(this.circuitBreakers.entries()).map(([name, circuitBreaker]) => ({
      name,
      metrics: circuitBreaker.getMetrics()
    }));
  }

  /**
   * 获取所有熔断器健康状态
   */
  getHealthStatus(): { name: string; healthy: boolean; state: CircuitState; message: string }[] {
    return Array.from(this.circuitBreakers.entries()).map(([name, circuitBreaker]) => ({
      name,
      ...circuitBreaker.getHealthStatus()
    }));
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    this.circuitBreakers.forEach(circuitBreaker => circuitBreaker.reset());
  }

  /**
   * 删除熔断器
   */
  removeCircuitBreaker(name: string): boolean {
    return this.circuitBreakers.delete(name);
  }
}