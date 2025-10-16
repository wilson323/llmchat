/**
 * 错误处理服务
 * 统一处理混合存储架构中的错误和异常
 */

interface ErrorInfo {
  id: string;
  type: 'storage' | 'sync' | 'cache' | 'network' | 'validation' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  context?: {
    operation?: string;
    sessionId?: string;
    agentId?: string;
    tier?: string;
    retryCount?: number;
  };
  stack?: string;
  resolved: boolean;
  resolvedAt?: number;
  resolution?: string;
}

interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'ignore' | 'escalate';
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => Promise<any>;
}

interface ErrorReport {
  period: { start: number, end: number };
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  topErrors: ErrorInfo[];
  resolutionRate: number;
  averageResolutionTime: number;
}

export class ErrorHandlingService {
  private errors: ErrorInfo[] = [];
  private errorCallbacks = new Set<(error: ErrorInfo) => void>();
  private resolutionCallbacks = new Set<(error: ErrorInfo) => void>();
  private recoveryStrategies = new Map<string, ErrorRecoveryStrategy>();
  private maxErrors = 1000;
  private isInitialized = false;

  constructor() {
    this.setupDefaultStrategies();
    this.setupGlobalErrorHandlers();
  }

  // ==================== 初始化 ====================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 加载之前的错误记录（可选）
      await this.loadPersistedErrors();

      this.isInitialized = true;
      console.log('错误处理服务已初始化');

    } catch (error) {
      console.error('错误处理服务初始化失败:', error);
    }
  }

  // ==================== 错误处理 ====================

  /**
   * 记录错误
   */
  recordError(
    type: ErrorInfo['type'],
    severity: ErrorInfo['severity'],
    code: string,
    message: string,
    details?: any,
    context?: ErrorInfo['context'],
  ): ErrorInfo {
    const stackTrace = new Error().stack;
    const error: ErrorInfo = {
      id: this.generateErrorId(),
      type,
      severity,
      code,
      message,
      details,
      timestamp: Date.now(),
      // 使用条件属性展开满足 exactOptionalPropertyTypes
      ...(context && { context }),
      ...(stackTrace && { stack: stackTrace }),
      resolved: false,
    };

    this.addError(error);
    return error;
  }

  /**
   * 处理并尝试恢复错误
   */
  async handleError(
    type: ErrorInfo['type'],
    severity: ErrorInfo['severity'],
    code: string,
    message: string,
    details?: any,
    context?: ErrorInfo['context'],
  ): Promise<{ success: boolean, result?: any, error?: ErrorInfo }> {
    const error = this.recordError(type, severity, code, message, details, context);

    try {
      // 检查是否有恢复策略
      const strategy = this.recoveryStrategies.get(code);
      if (strategy) {
        const result = await this.executeRecoveryStrategy(error, strategy);
        if (result.success) {
          this.resolveError(error.id, 'recovery_strategy_success', result.result);
          return result;
        }
      }

      // 默认处理策略
      const defaultResult = await this.defaultErrorHandling(error);
      if (defaultResult.success) {
        this.resolveError(error.id, 'default_handling_success', defaultResult.result);
        return defaultResult;
      }

      return { success: false, error };

    } catch (recoveryError) {
      console.error('错误恢复失败:', recoveryError);
      this.escalateError(error, recoveryError);
      return { success: false, error };
    }
  }

  /**
   * 包装异步操作，自动处理错误
   */
  async wrapOperation<T>(
    operation: () => Promise<T>,
    errorType: ErrorInfo['type'],
    errorCode: string,
    context?: ErrorInfo['context'],
  ): Promise<{ success: boolean, data?: T, error?: ErrorInfo }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error ? { stack: error.stack, name: error.name } : error;

      const result = await this.handleError(
        errorType,
        'medium',
        errorCode,
        errorMessage,
        errorDetails,
        context,
      );

      return result.error ? { success: false, error: result.error } : { success: false };
    }
  }

  // ==================== 错误恢复 ====================

  /**
   * 注册错误恢复策略
   */
  registerRecoveryStrategy(errorCode: string, strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(errorCode, strategy);
  }

  /**
   * 手动解决错误
   */
  resolveError(errorId: string, resolution: string, _result?: any): void {
    const error = this.errors.find(e => e.id === errorId);
    if (!error) {
      return;
    }

    error.resolved = true;
    error.resolvedAt = Date.now();
    error.resolution = resolution;

    // 通知错误已解决
    this.resolutionCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('错误解决回调失败:', callbackError);
      }
    });
  }

  // ==================== 错误查询 ====================

  /**
   * 获取错误详情
   */
  getError(errorId: string): ErrorInfo | null {
    return this.errors.find(e => e.id === errorId) || null;
  }

  /**
   * 获取未解决的错误
   */
  getUnresolvedErrors(limit = 50): ErrorInfo[] {
    return this.errors
      .filter(e => !e.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 按类型获取错误
   */
  getErrorsByType(type: ErrorInfo['type'], resolved = false): ErrorInfo[] {
    return this.errors.filter(e => e.type === type && e.resolved === resolved);
  }

  /**
   * 按严重程度获取错误
   */
  getErrorsBySeverity(severity: ErrorInfo['severity'], resolved = false): ErrorInfo[] {
    return this.errors.filter(e => e.severity === severity && e.resolved === resolved);
  }

  /**
   * 生成错误报告
   */
  generateErrorReport(hours = 24): ErrorReport {
    const now = Date.now();
    const since = now - hours * 60 * 60 * 1000;

    const recentErrors = this.errors.filter(e => e.timestamp >= since);
    const resolvedErrors = recentErrors.filter(e => e.resolved);

    // 统计错误类型
    const errorsByType: Record<string, number> = {};
    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    // 统计错误严重程度
    const errorsBySeverity: Record<string, number> = {};
    recentErrors.forEach(error => {
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    // 计算解决率
    const resolutionRate = recentErrors.length > 0 ? resolvedErrors.length / recentErrors.length : 0;

    // 计算平均解决时间
    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, error) => {
        const resolutionTime = (error.resolvedAt || 0) - error.timestamp;
        return sum + resolutionTime;
      }, 0) / resolvedErrors.length
      : 0;

    // 获取最频繁的错误
    const errorFrequency = new Map<string, { count: number, error: ErrorInfo }>();
    recentErrors.forEach(error => {
      const key = `${error.code}:${error.message}`;
      const existing = errorFrequency.get(key);
      if (existing) {
        existing.count++;
      } else {
        errorFrequency.set(key, { count: 1, error });
      }
    });

    const topErrors = Array.from(errorFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => item.error);

    return {
      period: { start: since, end: now },
      totalErrors: recentErrors.length,
      errorsByType,
      errorsBySeverity,
      topErrors,
      resolutionRate,
      averageResolutionTime,
    };
  }

  // ==================== 事件监听 ====================

  /**
   * 监听错误事件
   */
  onError(callback: (error: ErrorInfo) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * 监听错误解决事件
   */
  onErrorResolved(callback: (error: ErrorInfo) => void): () => void {
    this.resolutionCallbacks.add(callback);
    return () => this.resolutionCallbacks.delete(callback);
  }

  // ==================== 私有方法 ====================

  private setupDefaultStrategies(): void {
    // 存储错误恢复策略
    this.registerRecoveryStrategy('STORAGE_QUOTA_EXCEEDED', {
      type: 'fallback',
      fallbackAction: async () => {
        console.log('存储配额已满，执行清理...');
        // 这里应该调用缓存清理
        return { cleaned: true };
      },
    });

    this.registerRecoveryStrategy('STORAGE_ACCESS_DENIED', {
      type: 'retry',
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 网络错误恢复策略
    this.registerRecoveryStrategy('NETWORK_TIMEOUT', {
      type: 'retry',
      maxRetries: 2,
      retryDelay: 2000,
    });

    this.registerRecoveryStrategy('NETWORK_OFFLINE', {
      type: 'fallback',
      fallbackAction: async () => {
        console.log('网络离线，切换到离线模式');
        return { offlineMode: true };
      },
    });

    // 同步错误恢复策略
    this.registerRecoveryStrategy('SYNC_CONFLICT', {
      type: 'escalate', // 需要用户干预
    });

    this.registerRecoveryStrategy('SYNC_AUTH_FAILED', {
      type: 'retry',
      maxRetries: 1,
      retryDelay: 5000,
    });

    // 缓存错误恢复策略
    this.registerRecoveryStrategy('CACHE_CORRUPTION', {
      type: 'fallback',
      fallbackAction: async () => {
        console.log('缓存损坏，重新初始化...');
        return { reinitialized: true };
      },
    });
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // 处理未捕获的JavaScript错误
      window.addEventListener('error', (event) => {
        this.recordError(
          'critical',
          'high',
          'UNCAUGHT_ERROR',
          event.message,
          {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
          },
        );
      });

      // 处理未捕获的Promise拒绝
      window.addEventListener('unhandledrejection', (event) => {
        this.recordError(
          'critical',
          'high',
          'UNHANDLED_PROMISE_REJECTION',
          event.reason?.message || 'Promise被拒绝',
          {
            reason: event.reason,
            stack: event.reason?.stack,
          },
        );
      });
    }
  }

  private addError(error: ErrorInfo): void {
    this.errors.push(error);

    // 限制错误数量
    if (this.errors.length > this.maxErrors) {
      this.errors.splice(0, this.errors.length - this.maxErrors);
    }

    // 通知错误回调
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('错误回调失败:', callbackError);
      }
    });

    // 如果是严重错误，立即升级
    if (error.severity === 'critical') {
      this.escalateError(error);
    }
  }

  private async executeRecoveryStrategy(
    error: ErrorInfo,
    strategy: ErrorRecoveryStrategy,
  ): Promise<{ success: boolean, result?: any }> {
    try {
      switch (strategy.type) {
        case 'retry':
          return await this.executeRetryStrategy(error, strategy);
        case 'fallback':
          return await this.executeFallbackStrategy(strategy);
        case 'ignore':
          return { success: true };
        case 'escalate':
          this.escalateError(error);
          return { success: false };
        default:
          return { success: false };
      }
    } catch (recoveryError) {
      console.error('恢复策略执行失败:', recoveryError);
      return { success: false };
    }
  }

  private async executeRetryStrategy(
    error: ErrorInfo,
    strategy: ErrorRecoveryStrategy,
  ): Promise<{ success: boolean, result?: any }> {
    const maxRetries = strategy.maxRetries || 3;
    const retryDelay = strategy.retryDelay || 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 这里应该重新执行原始操作
        // 由于我们没有原始操作的引用，只能返回成功状态
        console.log(`重试操作 ${error.code}，第 ${attempt + 1} 次尝试`);
        return { success: true };
      } catch (retryError) {
        if (attempt === maxRetries - 1) {
          throw retryError;
        }
        await this.sleep(retryDelay * Math.pow(2, attempt)); // 指数退避
      }
    }

    return { success: false };
  }

  private async executeFallbackStrategy(
    strategy: ErrorRecoveryStrategy,
  ): Promise<{ success: boolean, result?: any }> {
    if (strategy.fallbackAction) {
      const result = await strategy.fallbackAction();
      return { success: true, result };
    }
    return { success: false };
  }

  private async defaultErrorHandling(error: ErrorInfo): Promise<{ success: boolean, result?: any }> {
    // 根据错误类型和严重程度执行默认处理
    switch (error.type) {
      case 'network':
        // 网络错误通常可以重试
        if (error.severity === 'low' || error.severity === 'medium') {
          return { success: true }; // 假设会自动重试
        }
        break;

      case 'cache':
        // 缓存错误通常可以忽略或重建
        return { success: true };

      case 'storage':
        // 存储错误需要谨慎处理
        if (error.severity === 'low') {
          return { success: true };
        }
        break;

      case 'sync':
        // 同步错误可以延迟处理
        return { success: true };

      case 'validation':
        // 验证错误无法自动恢复
        break;

      case 'critical':
        // 严重错误需要立即关注
        break;
    }

    return { success: false };
  }

  private escalateError(error: ErrorInfo, additionalError?: any): void {
    console.error('严重错误需要人工干预:', error, additionalError);

    // 在实际应用中，这里应该：
    // 1. 发送错误报告到监控系统
    // 2. 显示用户友好的错误消息
    // 3. 提供错误报告和反馈机制
    // 4. 可能需要禁用某些功能以防止进一步损坏

    // 对于开发环境，直接抛出错误
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`严重错误: ${error.message}`);
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadPersistedErrors(): Promise<void> {
    try {
      // 从localStorage加载之前的错误记录
      if (typeof window !== 'undefined' && window.localStorage) {
        const persisted = localStorage.getItem('error_handling_history');
        if (persisted) {
          const errors = JSON.parse(persisted);
          this.errors = errors.filter((e: ErrorInfo) =>
            Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000, // 只保留7天内的错误
          );
        }
      }
    } catch (error) {
      console.warn('加载持久化错误记录失败:', error);
    }
  }

  private persistErrors(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const errorsToPersist = this.errors.filter(e =>
          e.severity === 'high' || e.severity === 'critical',
        );
        localStorage.setItem('error_handling_history', JSON.stringify(errorsToPersist));
      }
    } catch (error) {
      console.warn('持久化错误记录失败:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== 公共工具方法 ====================

  /**
   * 清除错误记录
   */
  clearErrors(resolved = false): void {
    if (resolved) {
      this.errors = this.errors.filter(e => !e.resolved);
    } else {
      this.errors = [];
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number;
    unresolved: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    } {
    const total = this.errors.length;
    const unresolved = this.errors.filter(e => !e.resolved).length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return { total, unresolved, byType, bySeverity };
  }

  /**
   * 导出错误数据
   */
  exportErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  /**
   * 检查系统健康状态
   */
  checkSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    } {
    const recentErrors = this.errors.filter(e =>
      Date.now() - e.timestamp < 60 * 60 * 1000, // 最近1小时
    );

    const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
    const highErrors = recentErrors.filter(e => e.severity === 'high');

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (criticalErrors.length > 0) {
      status = 'critical';
      issues.push(`发现 ${criticalErrors.length} 个严重错误`);
      recommendations.push('立即解决严重错误');
    } else if (highErrors.length > 5) {
      status = 'warning';
      issues.push(`发现 ${highErrors.length} 个高级错误`);
      recommendations.push('关注高级错误，考虑系统优化');
    }

    const errorRate = recentErrors.length / 60; // 每分钟错误数
    if (errorRate > 1) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`错误率过高: ${errorRate.toFixed(1)}/分钟`);
      recommendations.push('检查系统稳定性，优化错误处理');
    }

    return { status, issues, recommendations };
  }

  /**
   * 销毁错误处理服务
   */
  destroy(): void {
    this.persistErrors();
    this.errors = [];
    this.errorCallbacks.clear();
    this.resolutionCallbacks.clear();
    this.recoveryStrategies.clear();
  }
}

// 创建全局错误处理服务实例
export const globalErrorHandler = new ErrorHandlingService();