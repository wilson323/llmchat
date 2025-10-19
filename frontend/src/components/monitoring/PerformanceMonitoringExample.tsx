/**
 * 性能监控集成示例
 * 演示如何在LLMChat前端项目中集成和使用性能监控功能
 */

import React from 'react';
import { TypeSafetyDashboard } from '@/components/monitoring/TypeSafetyDashboard';
import { ComprehensivePerformanceDashboard } from '@/components/monitoring/ComprehensivePerformanceDashboard';
import { typeScriptPerformanceService } from '@/services/TypeScriptPerformanceService';
import { idePerformanceTracker } from '@/services/IDEPerformanceTracker';
import { performanceTrendAnalyzer } from '@/services/PerformanceTrendAnalyzer';
import { performanceDataCache } from '@/services/PerformanceDataCache';

/**
 * 性能监控管理器示例
 * 演示如何管理和控制多个监控服务
 */
export class PerformanceMonitoringManager {
  private isInitialized = false;
  private services: {
    typeScript: typeof typeScriptPerformanceService;
    ide: typeof idePerformanceTracker;
    trendAnalyzer: typeof performanceTrendAnalyzer;
    cache: typeof performanceDataCache;
  };

  constructor() {
    this.services = {
      typeScript: typeScriptPerformanceService,
      ide: idePerformanceTracker,
      trendAnalyzer: performanceTrendAnalyzer,
      cache: performanceDataCache
    };
  }

  /**
   * 初始化所有性能监控服务
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('性能监控服务已经初始化');
      return;
    }

    try {
      console.log('🚀 初始化性能监控服务...');

      // 1. 初始化TypeScript性能监控
      await this.services.typeScript.subscribe(
        'performance-manager',
        (metrics) => {
          console.log('📊 TypeScript性能更新:', metrics);
          // 可以在这里添加自定义处理逻辑
          this.handleTypeScriptMetrics(metrics);
        },
        (alert) => {
          console.warn('⚠️ TypeScript性能告警:', alert);
          // 可以在这里添加告警处理逻辑
          this.handlePerformanceAlert(alert, 'typescript');
        },
        (trend) => {
          console.log('📈 TypeScript性能趋势:', trend);
          // 可以在这里添加趋势处理逻辑
        }
      );

      // 2. 初始化IDE性能监控
      this.services.ide.startTracking(5000); // 每5秒收集一次数据
      await this.services.ide.collectMetrics();

      // 3. 配置缓存策略
      this.services.cache.updateConfig({
        maxSize: 50, // 50MB
        maxEntries: 5000,
        defaultTTL: 30 * 60 * 1000, // 30分钟
        compressionEnabled: true,
        encryptionEnabled: false,
        syncEnabled: false // 开发环境关闭云同步
      });

      // 4. 设置性能阈值
      this.configurePerformanceThresholds();

      this.isInitialized = true;
      console.log('✅ 性能监控服务初始化完成');

    } catch (error) {
      console.error('❌ 性能监控服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 配置性能阈值
   */
  private configurePerformanceThresholds() {
    // TypeScript性能阈值
    const tsConfig = {
      compilationSlowThreshold: 5000, // 5秒
      typeCheckSlowThreshold: 3000,   // 3秒
      ideLagThreshold: 200,           // 200ms
      memoryHighThreshold: 512,       // 512MB
      bundleLargeThreshold: 2048      // 2MB
    };

    // IDE性能阈值
    const ideConfig = {
      responseTimeThresholds: {
        IntelliSense: 200,
        codeCompletion: 150,
        gotoDefinition: 300,
        findReferences: 500,
        renameSymbol: 1000,
        formatDocument: 800
      }
    };

    // 应用配置（实际实现中这些配置应该传递给相应的服务）
    console.log('📋 性能阈值配置:', { tsConfig, ideConfig });
  }

  /**
   * 处理TypeScript性能指标
   */
  private handleTypeScriptMetrics(metrics: any) {
    // 示例：当编译时间过长时记录警告
    if (metrics.compilation.duration > 5000) {
      console.warn(`🐌 TypeScript编译时间过长: ${metrics.compilation.duration}ms`);
    }

    // 示例：当内存使用过高时记录警告
    if (metrics.performance.memoryUsage > 512) {
      console.warn(`🧠 内存使用过高: ${metrics.performance.memoryUsage}MB`);
    }

    // 将数据存储到缓存
    this.services.cache.set(
      `ts_metrics_${Date.now()}`,
      metrics,
      60000, // 1分钟TTL
      ['typescript', 'metrics'],
      { source: 'performance-manager' }
    );
  }

  /**
   * 处理性能告警
   */
  private handlePerformanceAlert(alert: any, source: string) {
    // 示例：将告警存储到缓存
    this.services.cache.set(
      `alert_${source}_${Date.now()}`,
      alert,
      300000, // 5分钟TTL
      ['alert', source],
      { severity: alert.severity, source }
    );

    // 示例：在开发环境中显示通知
    if (process.env.NODE_ENV === 'development') {
      // 这里可以集成通知系统
      console.log(`🔔 ${source}告警:`, alert.title);
    }
  }

  /**
   * 获取性能摘要
   */
  async getPerformanceSummary() {
    if (!this.isInitialized) {
      throw new Error('性能监控服务未初始化');
    }

    try {
      const tsMetrics = this.services.typeScript.getCurrentMetrics();
      const ideMetrics = this.services.ide.getCurrentMetrics();
      const cacheStats = this.services.cache.getStats();

      return {
        timestamp: Date.now(),
        typeScript: tsMetrics ? {
          status: tsMetrics.compilation.errorsCount === 0 ? 'healthy' : 'error',
          compileTime: tsMetrics.compilation.duration,
          memoryUsage: tsMetrics.performance.memoryUsage,
          errors: tsMetrics.compilation.errorsCount,
          warnings: tsMetrics.compilation.warningsCount
        } : null,
        ide: ideMetrics ? {
          status: ideMetrics.userExperience.inputLag < 50 ? 'healthy' : 'warning',
          avgResponseTime: Object.values(ideMetrics.responseTime).reduce((a, b) => a + b, 0) / 6,
          memoryUsage: ideMetrics.resources.memoryUsage,
          inputLag: ideMetrics.userExperience.inputLag
        } : null,
        cache: {
          hitRate: cacheStats.hitRate,
          totalEntries: cacheStats.totalEntries,
          totalSize: cacheStats.totalSize
        }
      };
    } catch (error) {
      console.error('获取性能摘要失败:', error);
      return null;
    }
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport() {
    if (!this.isInitialized) {
      throw new Error('性能监控服务未初始化');
    }

    try {
      const summary = await this.getPerformanceSummary();
      const insights = this.services.trendAnalyzer.getPerformanceInsights();
      const cacheStats = this.services.cache.getStats();

      const report = {
        generatedAt: new Date().toISOString(),
        summary,
        insights: insights.slice(0, 10), // 限制洞察数量
        recommendations: await this.generateRecommendations(),
        cache: {
          hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
          entries: cacheStats.totalEntries,
          size: `${(cacheStats.totalSize / 1024 / 1024).toFixed(2)}MB`,
          compressionRatio: cacheStats.compressionRatio
        }
      };

      // 将报告存储到缓存
      this.services.cache.set(
        `performance_report_${Date.now()}`,
        report,
        3600000, // 1小时TTL
        ['report', 'performance'],
        { type: 'performance-report' }
      );

      return report;
    } catch (error) {
      console.error('生成性能报告失败:', error);
      return null;
    }
  }

  /**
   * 生成优化建议
   */
  private async generateRecommendations() {
    const tsMetrics = this.services.typeScript.getCurrentMetrics();
    const ideMetrics = this.services.ide.getCurrentMetrics();
    const recommendations: string[] = [];

    if (tsMetrics) {
      if (tsMetrics.compilation.duration > 5000) {
        recommendations.push('考虑启用增量编译或优化项目结构以减少TypeScript编译时间');
      }
      if (tsMetrics.performance.memoryUsage > 512) {
        recommendations.push('TypeScript进程内存使用较高，建议检查内存泄漏或增加系统内存');
      }
      if (tsMetrics.compilation.errorsCount > 0) {
        recommendations.push(`修复${tsMetrics.compilation.errorsCount}个TypeScript错误以提高代码质量`);
      }
    }

    if (ideMetrics) {
      const avgResponseTime = Object.values(ideMetrics.responseTime).reduce((a, b) => a + b, 0) / 6;
      if (avgResponseTime > 200) {
        recommendations.push('IDE响应时间较慢，建议禁用不必要的插件或扩展系统资源');
      }
      if (ideMetrics.userExperience.inputLag > 50) {
        recommendations.push('IDE输入延迟较高，建议检查后台进程或重启IDE');
      }
    }

    return recommendations;
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (!this.isInitialized) return;

    try {
      console.log('🧹 清理性能监控服务...');

      // 停止IDE追踪
      this.services.ide.stopTracking();

      // 清理缓存
      this.services.cache.cleanup();

      this.isInitialized = false;
      console.log('✅ 性能监控服务清理完成');

    } catch (error) {
      console.error('❌ 清理性能监控服务失败:', error);
    }
  }

  /**
   * 导出性能数据
   */
  async exportData() {
    if (!this.isInitialized) {
      throw new Error('性能监控服务未初始化');
    }

    try {
      const data = {
        exportedAt: new Date().toISOString(),
        typeScriptMetrics: this.services.typeScript.getMetricsHistory(100),
        ideMetrics: this.services.ide.getCurrentMetrics(),
        cacheData: this.services.cache.exportData(),
        trends: Array.from(this.services.trendAnalyzer.getTrendData().entries())
      };

      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('导出性能数据失败:', error);
      return null;
    }
  }
}

// 创建全局实例
export const performanceManager = new PerformanceMonitoringManager();

/**
 * 性能监控集成组件示例
 * 演示如何在React应用中集成性能监控
 */
export const PerformanceMonitoringExample: React.FC = () => {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [performanceSummary, setPerformanceSummary] = React.useState<any>(null);
  const [selectedView, setSelectedView] = React.useState<'typesafety' | 'comprehensive'>('typesafety');

  // 初始化性能监控
  React.useEffect(() => {
    const initializeMonitoring = async () => {
      try {
        await performanceManager.initialize();
        setIsInitialized(true);

        // 定期更新性能摘要
        const updateSummary = async () => {
          const summary = await performanceManager.getPerformanceSummary();
          setPerformanceSummary(summary);
        };

        updateSummary();
        const interval = setInterval(updateSummary, 10000); // 每10秒更新

        return () => {
          clearInterval(interval);
          performanceManager.cleanup();
        };
      } catch (error) {
        console.error('初始化性能监控失败:', error);
        return undefined;
      }
    };

    const cleanup = initializeMonitoring();
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  // 生成性能报告
  const handleGenerateReport = async () => {
    try {
      const report = await performanceManager.generatePerformanceReport();
      if (report) {
        // 下载报告
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('生成性能报告失败:', error);
    }
  };

  // 导出数据
  const handleExportData = async () => {
    try {
      const data = await performanceManager.exportData();
      if (data) {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('导出数据失败:', error);
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在初始化性能监控...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 性能摘要卡片 */}
      {performanceSummary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">性能摘要</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {performanceSummary.typeScript?.compileTime || 'N/A'}ms
              </div>
              <div className="text-sm text-gray-600">TypeScript编译时间</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {performanceSummary.ide?.avgResponseTime?.toFixed(0) || 'N/A'}ms
              </div>
              <div className="text-sm text-gray-600">IDE平均响应时间</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {performanceSummary.cache?.hitRate ? `${(performanceSummary.cache.hitRate * 100).toFixed(1)}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">缓存命中率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {performanceSummary.typeScript?.errors || 0}
              </div>
              <div className="text-sm text-gray-600">TypeScript错误</div>
            </div>
          </div>
        </div>
      )}

      {/* 视图选择和控制 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedView('typesafety')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              selectedView === 'typesafety'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            类型安全监控
          </button>
          <button
            onClick={() => setSelectedView('comprehensive')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              selectedView === 'comprehensive'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            综合性能监控
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleGenerateReport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            生成报告
          </button>
          <button
            onClick={handleExportData}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            导出数据
          </button>
        </div>
      </div>

      {/* 监控面板 */}
      <div className="bg-white rounded-lg shadow-md">
        {selectedView === 'typesafety' ? (
          <TypeSafetyDashboard
            autoRefresh={true}
            refreshInterval={30000}
          />
        ) : (
          <ComprehensivePerformanceDashboard
            autoRefresh={true}
            refreshInterval={10000}
            enableRealTime={true}
          />
        )}
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">使用说明</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
          <li>类型安全监控：专注于TypeScript编译、类型检查和代码质量指标</li>
          <li>综合性能监控：提供全面的性能视图，包括IDE响应、系统资源和趋势分析</li>
          <li>实时模式：启用后会持续监控性能变化，适合开发时使用</li>
          <li>数据导出：支持导出性能数据用于进一步分析和报告</li>
          <li>缓存管理：自动缓存性能数据以提高响应速度</li>
        </ul>
      </div>
    </div>
  );
};

export default PerformanceMonitoringExample;