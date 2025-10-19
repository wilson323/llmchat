/**
 * 性能监控系统入口文件
 *
 * 本文件提供了LLMChat前端性能监控系统的统一入口，
 * 包含所有监控组件和服务的导出。
 *
 * @author LLMChat Performance Team
 * @version 1.0.0
 * @since 2025-10-18
 */

// 核心监控组件
import { TypeSafetyDashboard } from './TypeSafetyDashboard';
import { ComprehensivePerformanceDashboard } from './ComprehensivePerformanceDashboard';
import { PerformanceMonitoringExample, performanceManager, PerformanceMonitoringManager } from './PerformanceMonitoringExample';

// 监控服务
import { typeScriptPerformanceService } from '../../services/TypeScriptPerformanceService';
import { idePerformanceTracker } from '../../services/IDEPerformanceTracker';
import { performanceTrendAnalyzer } from '../../services/PerformanceTrendAnalyzer';
import { performanceDataCache } from '../../services/PerformanceDataCache';

// 重新导出以供外部使用
export {
  TypeSafetyDashboard,
  ComprehensivePerformanceDashboard,
  PerformanceMonitoringExample,
  PerformanceMonitoringManager,
  performanceManager,
  typeScriptPerformanceService,
  idePerformanceTracker,
  performanceTrendAnalyzer,
  performanceDataCache
};

// 性能监控工具集
export const PerformanceTools = {
  /**
   * 初始化所有监控服务
   */
  async initialize() {
    console.log('🚀 初始化性能监控系统...');

    try {
      // 初始化TypeScript性能监控
      await typeScriptPerformanceService.subscribe(
        'quick-start',
        (metrics) => {
          console.log('📊 TypeScript性能指标:', metrics);
        }
      );

      // 初始化IDE性能跟踪
      idePerformanceTracker.startTracking(5000);

      // 初始化性能数据缓存（通过单例自动初始化）
      // 性能趋势分析器通过单例自动初始化

      console.log('✅ 性能监控系统初始化完成');
    } catch (error) {
      console.error('❌ 初始化性能监控系统失败:', error);
      throw error;
    }
  },

  /**
   * 获取当前性能状态
   */
  async getCurrentStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      typeScriptActive: typeScriptPerformanceService.getMetricsHistory().length > 0,
      ideTrackingActive: idePerformanceTracker.getCurrentMetrics() !== null,
      cacheInitialized: performanceDataCache.getCount() > 0,
      analyzerReady: performanceTrendAnalyzer.getAllAnalyses().size > 0
    };

    return status;
  },

  /**
   * 导出性能数据
   */
  async exportData() {
    const status = await this.getCurrentStatus();

    const tsHistory = typeScriptPerformanceService.getMetricsHistory(100);
    const cacheData = performanceDataCache.exportData();

    return {
      exportedAt: new Date().toISOString(),
      currentStatus: status,
      typeScriptHistory: tsHistory,
      cacheData: cacheData ? JSON.parse(cacheData) : {},
      insights: performanceTrendAnalyzer.getPerformanceInsights()
    };
  },

  /**
   * 清理资源
   */
  cleanup() {
    console.log('🧹 清理性能监控系统...');

    try {
      idePerformanceTracker.stopTracking();
      performanceDataCache.cleanup();
      performanceTrendAnalyzer.cleanup();
      console.log('✅ 性能监控系统清理完成');
    } catch (error) {
      console.error('❌ 清理性能监控系统失败:', error);
    }
  }
};

// 使用性能工具的示例代码
export const UsageExample = `
// 导入性能工具
import { PerformanceTools } from '@/components/monitoring/PerformanceMonitoringIndex';

// 初始化
await PerformanceTools.initialize();

// 获取当前状态
const status = await PerformanceTools.getCurrentStatus();

// 导出性能数据
const data = await PerformanceTools.exportData();

// 清理资源
PerformanceTools.cleanup();
`;

// 默认导出主要组件
export default TypeSafetyDashboard;