/**
 * 性能监控仪表板
 * 实时显示前端性能指标
 */

;
;
;
;
;
;
;
;
import {Activity, AlertTriangle, Cpu, HardDrive, X, Zap} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import {
  memoryMonitor,
  componentMonitor,
  requestMonitor,
} from '@/utils/performanceOptimizer';

interface PerformanceStats {
  memory: {
    current: number;
    average: number;
    peak: number;
    trend: string;
  } | null;
  requests: {
    totalRequests: number;
    averageDuration: number;
    slowestRequests: Array<{
      url: string;
      duration: number;
      timestamp: number;
    }>;
    activeRequests: number;
  } | null;
  components: {
    [componentName: string]: {
      renders: number;
      averageRenderTime: number;
      isMounted: boolean;
    };
  } | null;
}

export const PerformanceDashboard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [stats, setStats] = useState<PerformanceStats>({
    memory: null,
    requests: null,
    components: null,
  });
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isVisible) {
      // 启动内存监控
      memoryMonitor.startMonitoring();

      // 定期更新统计信息
      intervalRef.current = setInterval(() => {
        const memoryStats = memoryMonitor.getMemoryStats();
        const requestStats = requestMonitor.getRequestStats();
        const componentStats = componentMonitor.getAllStats();

        setStats({
          memory: memoryStats,
          requests: requestStats,
          components: componentStats,
        });
      }, 1000);
    } else {
      // 停止监控
      memoryMonitor.stopMonitoring();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  const formatMemory = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatTime = (ms: number): string => {
    return ms.toFixed(2) + ' ms';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <Zap className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleGarbageCollection = () => {
    if (window.gc) {
      window.gc();
    } else {
      console.warn('手动垃圾回收不可用，请在开发者工具中启用');
    }
  };

  const handleClearData = () => {
    // 清理性能数据
    location.reload();
  };

  if (!isVisible) {
    // 浮动按钮
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <IconButton
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          title="打开性能监控"
        >
          <Activity className="w-5 h-5" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden border border-border">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            性能监控仪表板
          </h2>
          <div className="flex items-center gap-2">
            <IconButton
              onClick={handleGarbageCollection}
              variant="outline"
              title="手动垃圾回收"
            >
              <HardDrive className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={handleClearData}
              variant="outline"
              title="清理数据"
            >
              清理
            </IconButton>
            <IconButton
              onClick={() => setIsVisible(false)}
              variant="ghost"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 内存使用情况 */}
            {stats.memory && (
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <h3 className="font-medium">内存使用</h3>
                  <div className="ml-auto">
                    {getTrendIcon(stats.memory.trend)}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">当前:</span>
                    <span className="font-mono">{formatMemory(stats.memory.current)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均:</span>
                    <span className="font-mono">{formatMemory(stats.memory.average)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">峰值:</span>
                    <span className="font-mono">{formatMemory(stats.memory.peak)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">趋势:</span>
                    <span className="capitalize">{stats.memory.trend}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 请求性能 */}
            {stats.requests && (
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-green-600" />
                  <h3 className="font-medium">请求性能</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总请求数:</span>
                    <span className="font-mono">{stats.requests.totalRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均耗时:</span>
                    <span className="font-mono">{formatTime(stats.requests.averageDuration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">活跃请求:</span>
                    <span className="font-mono">{stats.requests.activeRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">最慢请求:</span>
                    <span className="font-mono text-red-600">
                      {stats.requests.slowestRequests.length > 0 && stats.requests.slowestRequests[0]
                        ? formatTime(stats.requests.slowestRequests[0].duration)
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 组件性能 */}
            {stats.components && (
              <div className="bg-card rounded-lg p-4 border border-border md:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <h3 className="font-medium">组件性能</h3>
                </div>
                <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                  {Object.entries(stats.components).slice(0, 5).map(([name, data]: [string, { renders: number; averageRenderTime: number; isMounted: boolean }]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="text-muted-foreground truncate flex-1 mr-2">
                        {name}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span>{data.renders}次</span>
                        <span>{formatTime(data.averageRenderTime)}</span>
                        {data.isMounted && (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  ))}
                  {Object.keys(stats.components).length === 0 && (
                    <div className="text-muted-foreground">暂无组件数据</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 性能建议 */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium mb-2 text-blue-800 dark:text-blue-200">性能建议</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              {stats.memory && stats.memory.current > 100 * 1024 * 1024 && (
                <li>• 内存使用较高，建议检查是否有内存泄漏</li>
              )}
              {stats.requests && stats.requests.averageDuration > 1000 && (
                <li>• API响应时间较慢，建议检查网络或服务器性能</li>
              )}
              <li>• 定期清理不必要的组件和事件监听器</li>
              <li>• 使用虚拟化处理大量数据列表</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;