/**
 * IDE性能追踪服务
 * 监控前端开发环境的响应时间、资源使用和用户体验指标
 */

export interface IDEPerformanceMetrics {
  timestamp: number;
  responseTime: {
    IntelliSense: number; // 智能提示响应时间
    codeCompletion: number; // 代码补全时间
    gotoDefinition: number; // 跳转定义时间
    findReferences: number; // 查找引用时间
    renameSymbol: number; // 重构时间
    formatDocument: number; // 格式化时间
  };
  resources: {
    cpuUsage: number; // CPU使用率(%)
    memoryUsage: number; // 内存使用(MB)
    diskIO: {
      readSpeed: number; // 读取速度(MB/s)
      writeSpeed: number; // 写入速度(MB/s)
    };
    networkIO: {
      downloadSpeed: number; // 下载速度(MB/s)
      uploadSpeed: number; // 上传速度(MB/s)
      latency: number; // 延迟(ms)
    };
  };
  userExperience: {
    inputLag: number; // 输入延迟(ms)
    scrollPerformance: number; // 滚动性能评分(0-100)
    animationSmoothness: number; // 动画流畅度(0-100)
    pageLoadTime: number; // 页面加载时间(ms)
    timeToInteractive: number; // 可交互时间(ms)
  };
  editor: {
    fileSize: number; // 当前文件大小(KB)
    linesCount: number; // 行数
    syntaxHighlightingTime: number; // 语法高亮时间(ms)
    errorCheckingTime: number; // 错误检查时间(ms)
    codeNavigationTime: number; // 代码导航时间(ms)
  };
}

export interface IDEPerformanceAlert {
  id: string;
  type: 'response_slow' | 'resource_high' | 'ux_poor' | 'editor_lag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  impact: string;
  suggestion: string;
  timestamp: number;
  resolved: boolean;
}

export interface IDEPerformanceTrend {
  timestamp: number;
  overallScore: number; // 综合性能评分(0-100)
  responseTimeTrend: number; // 响应时间趋势(ms)
  resourceUsageTrend: number; // 资源使用趋势(%)
  userExperienceScore: number; // 用户体验评分(0-100)
  editorPerformance: number; // 编辑器性能评分(0-100)
  productivityIndex: number; // 生产力指数(0-100)
}

class IDEPerformanceTracker {
  private static instance: IDEPerformanceTracker;
  private metrics: IDEPerformanceMetrics[] = [];
  private alerts: IDEPerformanceAlert[] = [];
  private trends: IDEPerformanceTrend[] = [];
  private isTracking: boolean = false;
  private trackingInterval: NodeJS.Timeout | null = null;
  private lastMetrics: IDEPerformanceMetrics | null = null;

  // 性能阈值配置
  private thresholds = {
    responseTime: {
      IntelliSense: 200,
      codeCompletion: 150,
      gotoDefinition: 300,
      findReferences: 500,
      renameSymbol: 1000,
      formatDocument: 800
    },
    resources: {
      cpuUsage: 80,
      memoryUsage: 1024,
      diskIO: { readSpeed: 50, writeSpeed: 30 },
      networkIO: { latency: 100 }
    },
    userExperience: {
      inputLag: 50,
      scrollPerformance: 70,
      animationSmoothness: 70,
      pageLoadTime: 3000,
      timeToInteractive: 2000
    }
  };

  private constructor() {}

  static getInstance(): IDEPerformanceTracker {
    if (!IDEPerformanceTracker.instance) {
      IDEPerformanceTracker.instance = new IDEPerformanceTracker();
    }
    return IDEPerformanceTracker.instance;
  }

  /**
   * 开始性能追踪
   */
  startTracking(intervalMs: number = 5000): void {
    if (this.isTracking) return;

    this.isTracking = true;
    this.collectMetrics();

    this.trackingInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log('IDE性能追踪已启动');
  }

  /**
   * 停止性能追踪
   */
  stopTracking(): void {
    if (!this.isTracking) return;

    this.isTracking = false;

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    console.log('IDE性能追踪已停止');
  }

  /**
   * 手动收集性能指标
   */
  async collectMetrics(): Promise<IDEPerformanceMetrics | null> {
    try {
      const metrics: IDEPerformanceMetrics = {
        timestamp: Date.now(),
        responseTime: await this.measureResponseTimes(),
        resources: await this.measureResourceUsage(),
        userExperience: await this.measureUserExperience(),
        editor: await this.measureEditorPerformance()
      };

      this.metrics.push(metrics);

      // 保持最近100个数据点
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }

      // 分析性能并生成告警
      this.analyzePerformance(metrics);

      // 更新趋势
      this.updateTrends(metrics);

      this.lastMetrics = metrics;
      return metrics;

    } catch (error) {
      console.error('收集IDE性能指标失败:', error);
      return null;
    }
  }

  /**
   * 测量响应时间
   */
  private async measureResponseTimes(): Promise<IDEPerformanceMetrics['responseTime']> {
    const startTime = performance.now();

    // 模拟智能提示响应时间测量
    const IntelliSenseTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    });

    // 模拟代码补全时间测量
    const codeCompletionTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 80 + 30));
    });

    // 模拟跳转定义时间测量
    const gotoDefinitionTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 100));
    });

    // 模拟查找引用时间测量
    const findReferencesTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
    });

    // 模拟重构时间测量
    const renameSymbolTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));
    });

    // 模拟格式化时间测量
    const formatDocumentTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200));
    });

    return {
      IntelliSense: IntelliSenseTime,
      codeCompletion: codeCompletionTime,
      gotoDefinition: gotoDefinitionTime,
      findReferences: findReferencesTime,
      renameSymbol: renameSymbolTime,
      formatDocument: formatDocumentTime
    };
  }

  /**
   * 测量资源使用情况
   */
  private async measureResourceUsage(): Promise<IDEPerformanceMetrics['resources']> {
    // 获取内存使用情况（如果浏览器支持）
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // 转换为MB
    }

    // 模拟CPU使用率
    const cpuUsage = Math.random() * 30 + 20; // 20-50%

    // 模拟磁盘IO
    const diskIO = {
      readSpeed: Math.random() * 100 + 50,
      writeSpeed: Math.random() * 80 + 20
    };

    // 模拟网络IO
    const networkIO = {
      downloadSpeed: Math.random() * 10 + 5,
      uploadSpeed: Math.random() * 5 + 2,
      latency: Math.random() * 50 + 20
    };

    return {
      cpuUsage,
      memoryUsage,
      diskIO,
      networkIO
    };
  }

  /**
   * 测量用户体验指标
   */
  private async measureUserExperience(): Promise<IDEPerformanceMetrics['userExperience']> {
    // 测量输入延迟
    const inputLag = await this.measureInputLag();

    // 测量滚动性能
    const scrollPerformance = await this.measureScrollPerformance();

    // 测量动画流畅度
    const animationSmoothness = await this.measureAnimationSmoothness();

    // 获取页面加载时间
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const pageLoadTime = navigationEntry ? navigationEntry.loadEventEnd - navigationEntry.fetchStart : 0;

    // 计算可交互时间
    const timeToInteractive = navigationEntry ? navigationEntry.domInteractive - navigationEntry.fetchStart : 0;

    return {
      inputLag,
      scrollPerformance,
      animationSmoothness,
      pageLoadTime,
      timeToInteractive
    };
  }

  /**
   * 测量编辑器性能
   */
  private async measureEditorPerformance(): Promise<IDEPerformanceMetrics['editor']> {
    // 获取当前文件信息（模拟）
    const fileSize = Math.random() * 500 + 50; // 50-550KB
    const linesCount = Math.floor(fileSize * 2); // 估算行数

    // 测量语法高亮时间
    const syntaxHighlightingTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 20));
    });

    // 测量错误检查时间
    const errorCheckingTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    });

    // 测量代码导航时间
    const codeNavigationTime = await this.measureAsyncOperation(() => {
      return new Promise(resolve => setTimeout(resolve, Math.random() * 30 + 10));
    });

    return {
      fileSize,
      linesCount,
      syntaxHighlightingTime,
      errorCheckingTime,
      codeNavigationTime
    };
  }

  /**
   * 测量异步操作时间
   */
  private async measureAsyncOperation(operation: () => Promise<void>): Promise<number> {
    const startTime = performance.now();
    await operation();
    return performance.now() - startTime;
  }

  /**
   * 测量输入延迟
   */
  private async measureInputLag(): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const handleInput = () => {
        const endTime = performance.now();
        const lag = endTime - startTime;
        document.removeEventListener('keydown', handleInput);
        resolve(lag);
      };

      document.addEventListener('keydown', handleInput, { once: true });

      // 超时处理
      setTimeout(() => {
        document.removeEventListener('keydown', handleInput);
        resolve(0);
      }, 1000);
    });
  }

  /**
   * 测量滚动性能
   */
  private async measureScrollPerformance(): Promise<number> {
    return new Promise((resolve) => {
      let scrollEvents = 0;
      let totalScrollTime = 0;

      const handleScroll = () => {
        scrollEvents++;
        const startTime = performance.now();

        requestAnimationFrame(() => {
          const endTime = performance.now();
          totalScrollTime += endTime - startTime;

          if (scrollEvents >= 10) {
            window.removeEventListener('scroll', handleScroll);
            const avgScrollTime = totalScrollTime / scrollEvents;
            const performanceScore = Math.max(0, Math.min(100, 100 - (avgScrollTime - 16) * 2));
            resolve(performanceScore);
          }
        });
      };

      window.addEventListener('scroll', handleScroll, { passive: true });

      // 超时处理
      setTimeout(() => {
        window.removeEventListener('scroll', handleScroll);
        resolve(70); // 默认评分
      }, 5000);
    });
  }

  /**
   * 测量动画流畅度
   */
  private async measureAnimationSmoothness(): Promise<number> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let lastTime = performance.now();

      const countFrames = (currentTime: number) => {
        frameCount++;

        if (currentTime - lastTime >= 1000) {
          const fps = frameCount;
          const smoothness = Math.min(100, (fps / 60) * 100);
          resolve(smoothness);
        } else {
          requestAnimationFrame(countFrames);
        }
      };

      requestAnimationFrame(countFrames);

      // 超时处理
      setTimeout(() => {
        resolve(60); // 默认评分
      }, 2000);
    });
  }

  /**
   * 分析性能并生成告警
   */
  private analyzePerformance(metrics: IDEPerformanceMetrics): void {
    const alerts: IDEPerformanceAlert[] = [];

    // 检查响应时间
    Object.entries(metrics.responseTime).forEach(([metric, value]) => {
      const threshold = this.thresholds.responseTime[metric as keyof typeof this.thresholds.responseTime];
      if (value > threshold) {
        alerts.push({
          id: `response_${metric}_${Date.now()}`,
          type: 'response_slow',
          severity: value > threshold * 2 ? 'critical' : value > threshold * 1.5 ? 'high' : 'medium',
          title: `${metric}响应时间过长`,
          message: `${metric}响应时间为${value.toFixed(2)}ms，超过阈值${threshold}ms`,
          metric,
          value,
          threshold,
          impact: '影响开发效率，增加等待时间',
          suggestion: '考虑优化相关功能或检查系统资源',
          timestamp: Date.now(),
          resolved: false
        });
      }
    });

    // 检查资源使用
    if (metrics.resources.memoryUsage > this.thresholds.resources.memoryUsage) {
      alerts.push({
        id: `memory_${Date.now()}`,
        type: 'resource_high',
        severity: 'high',
        title: '内存使用过高',
        message: `内存使用为${metrics.resources.memoryUsage.toFixed(2)}MB，超过阈值${this.thresholds.resources.memoryUsage}MB`,
        metric: 'memoryUsage',
        value: metrics.resources.memoryUsage,
        threshold: this.thresholds.resources.memoryUsage,
        impact: '可能导致系统变慢或崩溃',
        suggestion: '关闭不必要的标签页或扩展程序',
        timestamp: Date.now(),
        resolved: false
      });
    }

    // 检查用户体验
    if (metrics.userExperience.inputLag > this.thresholds.userExperience.inputLag) {
      alerts.push({
        id: `input_lag_${Date.now()}`,
        type: 'ux_poor',
        severity: 'medium',
        title: '输入延迟过高',
        message: `输入延迟为${metrics.userExperience.inputLag.toFixed(2)}ms，影响输入体验`,
        metric: 'inputLag',
        value: metrics.userExperience.inputLag,
        threshold: this.thresholds.userExperience.inputLag,
        impact: '影响打字体验和编码效率',
        suggestion: '检查系统负载或关闭不必要的后台程序',
        timestamp: Date.now(),
        resolved: false
      });
    }

    // 添加新告警
    alerts.forEach(alert => {
      const existingIndex = this.alerts.findIndex(a => a.metric === alert.metric && !a.resolved);
      if (existingIndex >= 0) {
        this.alerts[existingIndex] = alert;
      } else {
        this.alerts.push(alert);
      }
    });

    // 保持最近50个告警
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  /**
   * 更新性能趋势
   */
  private updateTrends(metrics: IDEPerformanceMetrics): void {
    const trend: IDEPerformanceTrend = {
      timestamp: Date.now(),
      overallScore: this.calculateOverallScore(metrics),
      responseTimeTrend: this.calculateResponseTimeTrend(metrics),
      resourceUsageTrend: this.calculateResourceUsageTrend(metrics),
      userExperienceScore: this.calculateUserExperienceScore(metrics),
      editorPerformance: this.calculateEditorPerformance(metrics),
      productivityIndex: this.calculateProductivityIndex(metrics)
    };

    this.trends.push(trend);

    // 保持最近30个趋势数据点
    if (this.trends.length > 30) {
      this.trends = this.trends.slice(-30);
    }
  }

  /**
   * 计算综合性能评分
   */
  private calculateOverallScore(metrics: IDEPerformanceMetrics): number {
    const responseScore = this.calculateResponseTimeScore(metrics);
    const resourceScore = this.calculateResourceScore(metrics);
    const uxScore = this.calculateUserExperienceScore(metrics);
    const editorScore = this.calculateEditorPerformance(metrics);

    return Math.round((responseScore + resourceScore + uxScore + editorScore) / 4);
  }

  /**
   * 计算响应时间评分
   */
  private calculateResponseTimeScore(metrics: IDEPerformanceMetrics): number {
    const responseTimes = Object.values(metrics.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    return Math.max(0, Math.min(100, 100 - (avgResponseTime - 100) * 0.5));
  }

  /**
   * 计算资源使用评分
   */
  private calculateResourceScore(metrics: IDEPerformanceMetrics): number {
    const memoryScore = Math.max(0, Math.min(100, 100 - (metrics.resources.memoryUsage / 10)));
    const cpuScore = Math.max(0, Math.min(100, 100 - metrics.resources.cpuUsage));

    return Math.round((memoryScore + cpuScore) / 2);
  }

  /**
   * 计算用户体验评分
   */
  private calculateUserExperienceScore(metrics: IDEPerformanceMetrics): number {
    const inputScore = Math.max(0, Math.min(100, 100 - metrics.userExperience.inputLag * 0.5));
    const scrollScore = metrics.userExperience.scrollPerformance;
    const animationScore = metrics.userExperience.animationSmoothness;

    return Math.round((inputScore + scrollScore + animationScore) / 3);
  }

  /**
   * 计算编辑器性能评分
   */
  private calculateEditorPerformance(metrics: IDEPerformanceMetrics): number {
    const syntaxScore = Math.max(0, Math.min(100, 100 - metrics.editor.syntaxHighlightingTime));
    const errorScore = Math.max(0, Math.min(100, 100 - metrics.editor.errorCheckingTime * 0.5));
    const navigationScore = Math.max(0, Math.min(100, 100 - metrics.editor.codeNavigationTime * 0.3));

    return Math.round((syntaxScore + errorScore + navigationScore) / 3);
  }

  /**
   * 计算响应时间趋势
   */
  private calculateResponseTimeTrend(metrics: IDEPerformanceMetrics): number {
    const responseTimes = Object.values(metrics.responseTime);
    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  /**
   * 计算资源使用趋势
   */
  private calculateResourceUsageTrend(metrics: IDEPerformanceMetrics): number {
    return (metrics.resources.cpuUsage + (metrics.resources.memoryUsage / 10)) / 2;
  }

  /**
   * 计算生产力指数
   */
  private calculateProductivityIndex(metrics: IDEPerformanceMetrics): number {
    const responseFactor = this.calculateResponseTimeScore(metrics) / 100;
    const uxFactor = this.calculateUserExperienceScore(metrics) / 100;
    const resourceFactor = this.calculateResourceScore(metrics) / 100;

    return Math.round((responseFactor * 0.4 + uxFactor * 0.4 + resourceFactor * 0.2) * 100);
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): IDEPerformanceMetrics | null {
    return this.lastMetrics;
  }

  /**
   * 获取性能历史
   */
  getMetricsHistory(limit?: number): IDEPerformanceMetrics[] {
    if (limit) {
      return this.metrics.slice(-limit);
    }
    return [...this.metrics];
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): IDEPerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * 获取性能趋势
   */
  getTrends(limit?: number): IDEPerformanceTrend[] {
    if (limit) {
      return this.trends.slice(-limit);
    }
    return [...this.trends];
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * 获取性能优化建议
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const currentMetrics = this.lastMetrics;

    if (!currentMetrics) return suggestions;

    // 响应时间优化建议
    Object.entries(currentMetrics.responseTime).forEach(([metric, value]) => {
      const threshold = this.thresholds.responseTime[metric as keyof typeof this.thresholds.responseTime];
      if (value > threshold) {
        switch (metric) {
          case 'IntelliSense':
            suggestions.push('禁用不必要的IntelliSense功能或减少项目依赖');
            break;
          case 'codeCompletion':
            suggestions.push('调整代码补全设置，减少建议数量');
            break;
          case 'gotoDefinition':
            suggestions.push('检查项目配置，优化模块解析');
            break;
          default:
            suggestions.push(`优化${metric}相关设置`);
        }
      }
    });

    // 资源使用优化建议
    if (currentMetrics.resources.memoryUsage > this.thresholds.resources.memoryUsage) {
      suggestions.push('关闭不必要的标签页和扩展程序');
      suggestions.push('考虑增加系统内存或使用更轻量的编辑器');
    }

    if (currentMetrics.resources.cpuUsage > this.thresholds.resources.cpuUsage) {
      suggestions.push('检查后台运行的程序，关闭不必要的进程');
      suggestions.push('考虑升级CPU或优化代码分析设置');
    }

    // 用户体验优化建议
    if (currentMetrics.userExperience.inputLag > this.thresholds.userExperience.inputLag) {
      suggestions.push('检查键盘和输入设备设置');
      suggestions.push('优化系统输入法设置');
    }

    return suggestions;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopTracking();
    this.metrics = [];
    this.alerts = [];
    this.trends = [];
    this.lastMetrics = null;
  }
}

// 导出单例实例
export const idePerformanceTracker = IDEPerformanceTracker.getInstance();

// 导出类型和服务类
export default IDEPerformanceTracker;