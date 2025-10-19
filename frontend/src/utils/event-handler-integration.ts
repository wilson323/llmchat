/**
 * 事件处理器类型定义集成工具
 *
 * 安全地集成统一事件处理器类型定义，确保向后兼容性和平滑迁移
 *
 * @module event-handler-integration
 * @version 1.0.0
 * @since 2025-10-18
 */

import type {
  UnifiedEventHandler,
  SimplifiedEventHandler,
  LegacyEventHandler,
  FlexibleEventHandler,
  ChangeEventHandler,
  ClickEventHandler,
  KeyboardEventHandler,
  FocusEventHandler,
  FormSubmitHandler,
  CustomEventHandler,
  InputProps,
  SelectorProps,
  ButtonProps
} from '@/types/event-handlers';

import type {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  FormEvent,
  SyntheticEvent
} from 'react';

// ============================================================================
// 事件处理器集成配置
// =============================================================================

/**
 * 事件处理器集成配置
 */
export interface EventHandlerIntegrationConfig {
  /** 是否启用自动适配 */
  enableAutoAdaptation: boolean;
  /** 默认错误处理策略 */
  errorHandling: 'strict' | 'lenient' | 'ignore';
  /** 是否保留旧的事件处理器 */
  keepLegacyHandlers: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring: boolean;
  /** 调试模式 */
  debugMode: boolean;
}

/**
 * 事件处理器适配结果
 */
export interface EventHandlerAdaptationResult {
  /** 是否成功 */
  success: boolean;
  /** 原始处理器类型 */
  originalHandlerType: 'unified' | 'simplified' | 'legacy' | 'unknown';
  /** 适配后处理器类型 */
  adaptedHandlerType: 'unified' | 'simplified' | 'legacy';
  /** 适配时间 */
  adaptationTime: number;
  /** 错误信息 */
  errors: EventHandlerError[];
  /** 警告信息 */
  warnings: EventHandlerWarning[];
  /** 性能指标 */
  performance: {
    adaptationOverhead: number;
    executionTime: number;
  };
}

/**
 * 事件处理器错误
 */
export interface EventHandlerError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 事件类型 */
  eventType?: string;
  /** 组件名称 */
  componentName?: string;
  /** 严重程度 */
  severity: 'critical' | 'error' | 'warning';
}

/**
 * 事件处理器警告
 */
export interface EventHandlerWarning {
  /** 警告代码 */
  code: string;
  /** 警告消息 */
  message: string;
  /** 事件类型 */
  eventType?: string;
  /** 建议操作 */
  suggestion?: string;
}

// ============================================================================
// 事件处理器适配器
// =============================================================================

/**
 * 事件处理器适配器类
 */
export class EventHandlerAdapter {
  private config: EventHandlerIntegrationConfig;
  private adaptationHistory: Map<string, EventHandlerAdaptationResult[]> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(config: Partial<EventHandlerIntegrationConfig> = {}) {
    this.config = {
      enableAutoAdaptation: true,
      errorHandling: 'lenient',
      keepLegacyHandlers: true,
      enablePerformanceMonitoring: false,
      debugMode: false,
      ...config
    };
  }

  /**
   * 适配变更事件处理器
   */
  public adaptChangeHandler<T = string>(
    handler: FlexibleEventHandler<T>
  ): ChangeEventHandler<T> {
    const startTime = Date.now();
    const result: EventHandlerAdaptationResult = {
      success: false,
      originalHandlerType: this.detectHandlerType(handler),
      adaptedHandlerType: 'unified',
      adaptationTime: 0,
      errors: [],
      warnings: [],
      performance: {
        adaptationOverhead: 0,
        executionTime: 0
      }
    };

    try {
      if (this.config.debugMode) {
        console.log('适配变更事件处理器:', handler);
      }

      let adaptedHandler: ChangeEventHandler<T>;

      // 检测处理器类型并进行适配
      const handlerType = this.detectHandlerType(handler);
      result.originalHandlerType = handlerType;

      switch (handlerType) {
        case 'unified':
          adaptedHandler = handler as ChangeEventHandler<T>;
          break;

        case 'simplified':
          adaptedHandler = this.adaptSimplifiedToChangeHandler(handler as SimplifiedEventHandler<T>);
          break;

        case 'legacy':
          adaptedHandler = this.adaptLegacyToChangeHandler(handler as LegacyEventHandler<ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>);
          break;

        default:
          throw new Error(`未知的事件处理器类型: ${handlerType}`);
      }

      // 包装性能监控
      if (this.config.enablePerformanceMonitoring) {
        adaptedHandler = this.wrapWithPerformanceMonitoring(adaptedHandler, 'change');
      }

      // 包装错误处理
      adaptedHandler = this.wrapWithErrorHandling(adaptedHandler, 'change');

      result.success = true;
      result.adaptedHandlerType = 'unified';
      result.performance.adaptationOverhead = Date.now() - startTime;

      // 记录适配历史
      this.recordAdaptationHistory('change', result);

      return adaptedHandler;

    } catch (error) {
      result.errors.push({
        code: 'ADAPTATION_FAILED',
        message: `事件处理器适配失败: ${error instanceof Error ? error.message : String(error)}`,
        eventType: 'change',
        severity: 'error'
      });

      if (this.config.errorHandling === 'strict') {
        throw error;
      }

      // 返回原始处理器作为后备
      return handler as ChangeEventHandler<T>;
    }
  }

  /**
   * 适配点击事件处理器
   */
  public adaptClickHandler<T = void>(
    handler: FlexibleEventHandler<T>
  ): ClickEventHandler<T> {
    const startTime = Date.now();
    const result: EventHandlerAdaptationResult = {
      success: false,
      originalHandlerType: this.detectHandlerType(handler),
      adaptedHandlerType: 'unified',
      adaptationTime: 0,
      errors: [],
      warnings: [],
      performance: {
        adaptationOverhead: 0,
        executionTime: 0
      }
    };

    try {
      const handlerType = this.detectHandlerType(handler);
      result.originalHandlerType = handlerType;

      let adaptedHandler: ClickEventHandler<T>;

      switch (handlerType) {
        case 'unified':
          adaptedHandler = handler as ClickEventHandler<T>;
          break;

        case 'simplified':
          adaptedHandler = this.adaptSimplifiedToClickHandler(handler as SimplifiedEventHandler<T>);
          break;

        case 'legacy':
          adaptedHandler = this.adaptLegacyToClickHandler(handler as LegacyEventHandler<MouseEvent<HTMLButtonElement | HTMLDivElement>>);
          break;

        default:
          throw new Error(`未知的事件处理器类型: ${handlerType}`);
      }

      if (this.config.enablePerformanceMonitoring) {
        adaptedHandler = this.wrapWithPerformanceMonitoring(adaptedHandler, 'click');
      }

      adaptedHandler = this.wrapWithErrorHandling(adaptedHandler, 'click');

      result.success = true;
      result.adaptedHandlerType = 'unified';
      result.performance.adaptationOverhead = Date.now() - startTime;

      this.recordAdaptationHistory('click', result);

      return adaptedHandler;

    } catch (error) {
      result.errors.push({
        code: 'ADAPTATION_FAILED',
        message: `点击事件处理器适配失败: ${error instanceof Error ? error.message : String(error)}`,
        eventType: 'click',
        severity: 'error'
      });

      if (this.config.errorHandling === 'strict') {
        throw error;
      }

      return handler as ClickEventHandler<T>;
    }
  }

  /**
   * 适配键盘事件处理器
   */
  public adaptKeyboardHandler<T = void>(
    handler: FlexibleEventHandler<T>
  ): KeyboardEventHandler<T> {
    const startTime = Date.now();
    const result: EventHandlerAdaptationResult = {
      success: false,
      originalHandlerType: this.detectHandlerType(handler),
      adaptedHandlerType: 'unified',
      adaptationTime: 0,
      errors: [],
      warnings: [],
      performance: {
        adaptationOverhead: 0,
        executionTime: 0
      }
    };

    try {
      const handlerType = this.detectHandlerType(handler);
      result.originalHandlerType = handlerType;

      let adaptedHandler: KeyboardEventHandler<T>;

      switch (handlerType) {
        case 'unified':
          adaptedHandler = handler as KeyboardEventHandler<T>;
          break;

        case 'simplified':
          adaptedHandler = this.adaptSimplifiedToKeyboardHandler(handler as SimplifiedEventHandler<T>);
          break;

        case 'legacy':
          adaptedHandler = this.adaptLegacyToKeyboardHandler(handler as LegacyEventHandler<KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>>);
          break;

        default:
          throw new Error(`未知的事件处理器类型: ${handlerType}`);
      }

      if (this.config.enablePerformanceMonitoring) {
        adaptedHandler = this.wrapWithPerformanceMonitoring(adaptedHandler, 'keyboard');
      }

      adaptedHandler = this.wrapWithErrorHandling(adaptedHandler, 'keyboard');

      result.success = true;
      result.adaptedHandlerType = 'unified';
      result.performance.adaptationOverhead = Date.now() - startTime;

      this.recordAdaptationHistory('keyboard', result);

      return adaptedHandler;

    } catch (error) {
      result.errors.push({
        code: 'ADAPTATION_FAILED',
        message: `键盘事件处理器适配失败: ${error instanceof Error ? error.message : String(error)}`,
        eventType: 'keyboard',
        severity: 'error'
      });

      if (this.config.errorHandling === 'strict') {
        throw error;
      }

      return handler as KeyboardEventHandler<T>;
    }
  }

  /**
   * 检测事件处理器类型
   */
  private detectHandlerType(handler: any): 'unified' | 'simplified' | 'legacy' | 'unknown' {
    if (typeof handler !== 'function') {
      return 'unknown';
    }

    const length = handler.length;

    // 通过参数数量判断类型
    if (length === 2) {
      return 'unified';
    } else if (length === 1) {
      // 进一步检查参数类型
      try {
        // 尝试调用处理器来检测类型
        const mockEvent = { target: { value: 'test' } };
        handler('test', mockEvent);
        return 'unified';
      } catch {
        return 'legacy';
      }
    } else if (length === 0) {
      return 'simplified';
    }

    return 'unknown';
  }

  /**
   * 将简化处理器适配为变更处理器
   */
  private adaptSimplifiedToChangeHandler<T>(handler: SimplifiedEventHandler<T>): ChangeEventHandler<T> {
    return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      try {
        handler(value);
      } catch (error) {
        if (this.config.debugMode) {
          console.error('简化变更处理器执行错误:', error);
        }
        if (this.config.errorHandling === 'strict') {
          throw error;
        }
      }
    };
  }

  /**
   * 将传统处理器适配为变更处理器
   */
  private adaptLegacyToChangeHandler<T>(
    handler: LegacyEventHandler<ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>
  ): ChangeEventHandler<T> {
    return (value: T, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      try {
        handler(event);
      } catch (error) {
        if (this.config.debugMode) {
          console.error('传统变更处理器执行错误:', error);
        }
        if (this.config.errorHandling === 'strict') {
          throw error;
        }
      }
    };
  }

  /**
   * 将简化处理器适配为点击处理器
   */
  private adaptSimplifiedToClickHandler<T>(handler: SimplifiedEventHandler<T>): ClickEventHandler<T> {
    return (data: T, event: MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      try {
        handler(data);
      } catch (error) {
        if (this.config.debugMode) {
          console.error('简化点击处理器执行错误:', error);
        }
        if (this.config.errorHandling === 'strict') {
          throw error;
        }
      }
    };
  }

  /**
   * 将传统处理器适配为点击处理器
   */
  private adaptLegacyToClickHandler<T>(
    handler: LegacyEventHandler<MouseEvent<HTMLButtonElement | HTMLDivElement>>
  ): ClickEventHandler<T> {
    return (data: T, event: MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      try {
        handler(event);
      } catch (error) {
        if (this.config.debugMode) {
          console.error('传统点击处理器执行错误:', error);
        }
        if (this.config.errorHandling === 'strict') {
          throw error;
        }
      }
    };
  }

  /**
   * 将简化处理器适配为键盘处理器
   */
  private adaptSimplifiedToKeyboardHandler<T>(handler: SimplifiedEventHandler<T>): KeyboardEventHandler<T> {
    return (data: T, event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>) => {
      try {
        handler(data);
      } catch (error) {
        if (this.config.debugMode) {
          console.error('简化键盘处理器执行错误:', error);
        }
        if (this.config.errorHandling === 'strict') {
          throw error;
        }
      }
    };
  }

  /**
   * 将传统处理器适配为键盘处理器
   */
  private adaptLegacyToKeyboardHandler<T>(
    handler: LegacyEventHandler<KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>>
  ): KeyboardEventHandler<T> {
    return (data: T, event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>) => {
      try {
        handler(event);
      } catch (error) {
        if (this.config.debugMode) {
          console.error('传统键盘处理器执行错误:', error);
        }
        if (this.config.errorHandling === 'strict') {
          throw error;
        }
      }
    };
  }

  /**
   * 包装性能监控
   */
  private wrapWithPerformanceMonitoring<T extends Function>(
    handler: T,
    eventType: string
  ): T {
    return ((...args: any[]) => {
      const startTime = performance.now();

      try {
        const result = handler(...args);

        const executionTime = performance.now() - startTime;
        this.recordPerformanceMetric(eventType, executionTime);

        return result;
      } catch (error) {
        const executionTime = performance.now() - startTime;
        this.recordPerformanceMetric(eventType, executionTime);
        throw error;
      }
    }) as T;
  }

  /**
   * 包装错误处理
   */
  private wrapWithErrorHandling<T extends Function>(
    handler: T,
    eventType: string
  ): T {
    return ((...args: any[]) => {
      try {
        return handler(...args);
      } catch (error) {
        if (this.config.debugMode) {
          console.error(`事件处理器错误 [${eventType}]:`, error);
        }

        if (this.config.errorHandling === 'strict') {
          throw error;
        }

        // 在lenient模式下，记录错误但不中断执行
        console.warn(`事件处理器执行错误，已忽略: ${error instanceof Error ? error.message : String(error)}`);
      }
    }) as T;
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetric(eventType: string, executionTime: number): void {
    if (!this.performanceMetrics.has(eventType)) {
      this.performanceMetrics.set(eventType, []);
    }

    const metrics = this.performanceMetrics.get(eventType)!;
    metrics.push(executionTime);

    // 保留最近100次记录
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * 记录适配历史
   */
  private recordAdaptationHistory(eventType: string, result: EventHandlerAdaptationResult): void {
    if (!this.adaptationHistory.has(eventType)) {
      this.adaptationHistory.set(eventType, []);
    }

    const history = this.adaptationHistory.get(eventType)!;
    history.push(result);

    // 保留最近50次记录
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * 获取适配历史
   */
  public getAdaptationHistory(eventType?: string): Map<string, EventHandlerAdaptationResult[]> {
    if (eventType) {
      const history = this.adaptationHistory.get(eventType);
      return new Map([[eventType, history || []]]);
    }
    return new Map(this.adaptationHistory);
  }

  /**
   * 获取性能指标
   */
  public getPerformanceMetrics(eventType?: string): Map<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    recent: number[];
  }> {
    const result = new Map();

    const eventTypes = eventType ? [eventType] : Array.from(this.performanceMetrics.keys());

    eventTypes.forEach(type => {
      const metrics = this.performanceMetrics.get(type) || [];

      if (metrics.length > 0) {
        const sum = metrics.reduce((a, b) => a + b, 0);
        result.set(type, {
          count: metrics.length,
          average: sum / metrics.length,
          min: Math.min(...metrics),
          max: Math.max(...metrics),
          recent: metrics.slice(-10)
        });
      }
    });

    return result;
  }

  /**
   * 生成适配报告
   */
  public generateReport(): string {
    let report = '事件处理器适配报告\n';
    report += '==================\n\n';

    // 适配历史统计
    report += '适配历史统计:\n';
    this.adaptationHistory.forEach((history, eventType) => {
      const total = history.length;
      const successful = history.filter(h => h.success).length;
      const successRate = total > 0 ? ((successful / total) * 100).toFixed(2) : '0';

      report += `  ${eventType}: ${successful}/${total} (${successRate}%)\n`;
    });

    // 性能指标
    report += '\n性能指标:\n';
    const performanceMetrics = this.getPerformanceMetrics();
    performanceMetrics.forEach((metrics, eventType) => {
      report += `  ${eventType}:\n`;
      report += `    执行次数: ${metrics.count}\n`;
      report += `    平均时间: ${metrics.average.toFixed(2)}ms\n`;
      report += `    最小时间: ${metrics.min.toFixed(2)}ms\n`;
      report += `    最大时间: ${metrics.max.toFixed(2)}ms\n`;
    });

    return report;
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<EventHandlerIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): EventHandlerIntegrationConfig {
    return { ...this.config };
  }
}

// ============================================================================
// 工具函数
// =============================================================================

/**
 * 获取事件处理器适配器实例
 */
export const getEventHandlerAdapter = (config?: Partial<EventHandlerIntegrationConfig>): EventHandlerAdapter => {
  return new EventHandlerAdapter(config);
};

/**
 * 快速适配事件处理器
 */
export const quickAdaptEventHandler = <T>(
  handler: FlexibleEventHandler<T>,
  eventType: 'change' | 'click' | 'keyboard',
  config?: Partial<EventHandlerIntegrationConfig>
): any => {
  const adapter = getEventHandlerAdapter(config);

  switch (eventType) {
    case 'change':
      return adapter.adaptChangeHandler(handler);
    case 'click':
      return adapter.adaptClickHandler(handler);
    case 'keyboard':
      return adapter.adaptKeyboardHandler(handler);
    default:
      throw new Error(`不支持的事件类型: ${eventType}`);
  }
};

/**
 * 批量适配事件处理器
 */
export const batchAdaptEventHandlers = (
  handlers: Array<{
    handler: any;
    eventType: 'change' | 'click' | 'keyboard';
    name?: string;
  }>,
  config?: Partial<EventHandlerIntegrationConfig>
): Array<{
  name?: string;
  originalHandler: any;
  adaptedHandler: any;
  success: boolean;
}> => {
  const adapter = getEventHandlerAdapter(config);
  const results = [];

  for (const { handler, eventType, name } of handlers) {
    try {
      let adaptedHandler;

      switch (eventType) {
        case 'change':
          adaptedHandler = adapter.adaptChangeHandler(handler);
          break;
        case 'click':
          adaptedHandler = adapter.adaptClickHandler(handler);
          break;
        case 'keyboard':
          adaptedHandler = adapter.adaptKeyboardHandler(handler);
          break;
      }

      results.push({
        name,
        originalHandler: handler,
        adaptedHandler,
        success: true
      });
    } catch (error) {
      results.push({
        name,
        originalHandler: handler,
        adaptedHandler: handler,
        success: false
      });
    }
  }

  return results;
};

// ============================================================================
// 导出说明：所有导出已在定义处声明
// =============================================================================