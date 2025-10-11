/**
 * 代码分割监控组件
 *
 * 仅在开发环境中显示，用于监控代码分割的性能表现
 */

import React, { useState, useEffect } from 'react';
import { Activity, Package, Clock, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { EnhancedCodeSplitting } from '@/utils/enhancedCodeSplitting';
import { useCodeSplittingPerformanceMonitor } from '@/hooks/useEnhancedCodeSplitting';

interface CodeSplittingMonitorProps {
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否自动刷新 */
  autoRefresh?: boolean;
  /** 刷新间隔（毫秒） */
  refreshInterval?: number;
}

export default function CodeSplittingMonitor({
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 2000
}: CodeSplittingMonitorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { stats, history, updateStats, clearHistory, getPerformanceMetrics } = useCodeSplittingPerformanceMonitor();

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(updateStats, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, updateStats]);

  // 只在开发环境中显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const handleExpandSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const clearAllCache = () => {
    EnhancedCodeSplitting.clearComponentCache();
    updateStats();
  };

  const performanceMetrics = getPerformanceMetrics();

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        title="代码分割监控"
      >
        <Package className="w-5 h-5" />
        {stats.loadingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {stats.loadingCount}
          </span>
        )}
      </button>

      {/* 监控面板 */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 bg-background border border-border rounded-lg shadow-xl w-96 max-h-[80vh] overflow-hidden">
          {/* 头部 */}
          <div className="bg-muted/50 border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">代码分割监控</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={updateStats}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="刷新"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={clearAllCache}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="清除缓存"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="关闭"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* 统计概览 */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                <span className="text-muted-foreground">已注册:</span>
                <span className="font-mono font-semibold">{stats.totalRegistered}</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">已加载:</span>
                <span className="font-mono font-semibold text-green-600">{stats.loadedCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-muted-foreground">加载中:</span>
                <span className="font-mono font-semibold text-orange-600">{stats.loadingCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-muted-foreground">空闲:</span>
                <span className="font-mono font-semibold text-gray-600">{stats.idleCount}</span>
              </div>
            </div>

            {/* 性能指标 */}
            {performanceMetrics && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>加载变化: {performanceMetrics.loadingRateChange > 0 ? '+' : ''}{performanceMetrics.loadingRateChange}</div>
                  <div>已加载变化: {performanceMetrics.loadedRateChange > 0 ? '+' : ''}{performanceMetrics.loadedRateChange}</div>
                  <div>时间范围: {new Date(performanceMetrics.timeRange.split(' - ')[0]).toLocaleTimeString()} - {new Date(performanceMetrics.timeRange.split(' - ')[1]).toLocaleTimeString()}</div>
                </div>
              </div>
            )}
          </div>

          {/* 组件列表 */}
          <div className="overflow-y-auto max-h-64">
            {stats.components.map((component) => (
              <div
                key={component.name}
                className="p-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        component.state === 'loaded'
                          ? 'bg-green-500'
                          : component.state === 'loading'
                          ? 'bg-orange-500 animate-pulse'
                          : component.state === 'error'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                      }`}
                    />
                    <span className="text-sm font-medium">{component.name}</span>
                    <span className="text-xs text-muted-foreground">优先级: {component.priority}</span>
                  </div>
                  <button
                    onClick={() => handleExpandSection(component.name)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedSection === component.name ? '收起' : '详情'}
                  </button>
                </div>

                {/* 详细信息 */}
                {expandedSection === component.name && (
                  <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                    <div>状态: {component.state}</div>
                    <div>优先级: {component.priority}</div>
                    {showDetails && (
                      <>
                        <div>加载时间: 统计中...</div>
                        <div>缓存命中: 统计中...</div>
                        <div>重试次数: 统计中...</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="p-3 bg-muted/30 border-t border-border flex gap-2">
            <button
              onClick={clearHistory}
              className="flex-1 px-3 py-1 bg-background border border-border rounded text-xs hover:bg-muted transition-colors"
            >
              清除历史
            </button>
            <button
              onClick={() => setExpandedSection(expandedSection ? null : 'all')}
              className="flex-1 px-3 py-1 bg-background border border-border rounded text-xs hover:bg-muted transition-colors"
            >
              {expandedSection ? '收起全部' : '展开全部'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}