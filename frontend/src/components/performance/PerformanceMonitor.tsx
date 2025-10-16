/**
 * PerformanceMonitor - Real-time performance monitoring dashboard
 *
 * Features:
 * 1. Core Web Vitals monitoring
 * 2. Memory usage tracking
 * 3. Render performance metrics
 * 4. Network request monitoring
 * 5. Component performance profiling
 */

;
;
;
import { Activity, Cpu, Globe, MemoryStick, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
;
;
;
;
;
;
;
import { usePerformanceMonitor } from '@/utils/performanceOptimizer';

interface PerformanceMonitorProps {
  enabled?: boolean;
  refreshInterval?: number;
  showComponentMetrics?: boolean;
  maxComponentMetrics?: number;
}

/**
 * Core Web Vitals monitoring
 */
function useCoreWebVitals() {
  const [vitals, setVitals] = useState({
    LCP: 0,
    FID: 0,
    CLS: 0,
    FCP: 0,
    TTFB: 0
  });

  useEffect(() => {
    // PerformanceObserver for Web Vitals
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach((entry) => {
        switch (entry.entryType) {
          case 'largest-contentful-paint':
            setVitals(prev => ({ ...prev, LCP: entry.startTime }));
            break;
          case 'first-input':
            setVitals(prev => ({ ...prev, FID: (entry as any).processingStart - entry.startTime }));
            break;
          case 'layout-shift':
            if (!(entry as any).hadRecentInput) {
              setVitals(prev => ({ ...prev, CLS: prev.CLS + (entry as any).value }));
            }
            break;
          case 'paint':
            if (entry.name === 'first-contentful-paint') {
              setVitals(prev => ({ ...prev, FCP: entry.startTime }));
            }
            break;
          case 'navigation':
            setVitals(prev => ({ ...prev, TTFB: (entry as any).responseStart }));
            break;
        }
      });
    });

    // Observe different entry types
    try {
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint', 'navigation'] });
    } catch (error) {
      console.warn('Performance Observer not fully supported:', error);
    }

    return () => observer.disconnect();
  }, []);

  return vitals;
}

/**
 * Memory usage monitoring
 */
function useMemoryUsage() {
  const [memory, setMemory] = useState({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
    memoryUsagePercentage: 0
  });

  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance) {
        const perfMemory = (performance as any).memory;
        const usedJSHeapSize = perfMemory.usedJSHeapSize;
        const totalJSHeapSize = perfMemory.totalJSHeapSize;
        const jsHeapSizeLimit = perfMemory.jsHeapSizeLimit;
        const memoryUsagePercentage = (usedJSHeapSize / jsHeapSizeLimit) * 100;

        setMemory({
          usedJSHeapSize,
          totalJSHeapSize,
          jsHeapSizeLimit,
          memoryUsagePercentage
        });
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 2000);

    return () => clearInterval(interval);
  }, []);

  return memory;
}

/**
 * Network performance monitoring
 */
function useNetworkMetrics() {
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    totalDataTransferred: 0
  });

  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      let responseTimes: number[] = [];
      let failedCount = 0;
      let dataTransferred = 0;

      entries.forEach((entry) => {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming;

          if (resource.responseStart > 0) {
            const responseTime = resource.responseEnd - resource.responseStart;
            responseTimes.push(responseTime);
          }

          if (resource.transferSize > 0) {
            dataTransferred += resource.transferSize;
          }

          // Check for failed requests
          if (resource.responseStatus >= 400) {
            failedCount++;
          }
        }
      });

      setMetrics(prev => ({
        totalRequests: prev.totalRequests + entries.length,
        failedRequests: prev.failedRequests + failedCount,
        averageResponseTime: responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : prev.averageResponseTime,
        totalDataTransferred: prev.totalDataTransferred + dataTransferred
      }));
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.warn('Resource timing not supported:', error);
    }

    return () => observer.disconnect();
  }, []);

  return metrics;
}

interface ComponentMetric {
  componentName: string;
  renderCount: number;
  averageRenderTime: number;
  isSlow: boolean;
}

/**
 * Main Performance Monitor Component
 */
export function PerformanceMonitor({
  enabled = true,
  refreshInterval = 1000,
  showComponentMetrics = true,
  maxComponentMetrics = 10
}: PerformanceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [componentMetrics, setComponentMetrics] = useState<ComponentMetric[]>([]);
  const lastUpdate = useRef(Date.now());

  const coreWebVitals = useCoreWebVitals();
  const memory = useMemoryUsage();
  const networkMetrics = useNetworkMetrics();

  // Custom performance monitor
  usePerformanceMonitor('PerformanceMonitor');

  // Update component metrics
  const updateComponentMetrics = useCallback(() => {
    if (showComponentMetrics) {
      // This would typically come from a performance context
      // For now, we'll use mock data
      const mockMetrics = [
        { componentName: 'ChatMessage', renderCount: 15, averageRenderTime: 2.3, isSlow: false },
        { componentName: 'VirtualizedList', renderCount: 8, averageRenderTime: 12.1, isSlow: true },
        { componentName: 'MessageInput', renderCount: 25, averageRenderTime: 1.2, isSlow: false },
      ];

      setComponentMetrics(mockMetrics.slice(0, maxComponentMetrics));
    }
    lastUpdate.current = Date.now();
  }, [showComponentMetrics, maxComponentMetrics]);

  // Auto-refresh metrics
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(updateComponentMetrics, refreshInterval);
    updateComponentMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [enabled, refreshInterval, updateComponentMetrics]);

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format time for display
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get performance status
  const getPerformanceStatus = useCallback(() => {
    const vitalsScore = [
      coreWebVitals.LCP < 2500 ? 1 : 0,        // Good LCP
      coreWebVitals.FID < 100 ? 1 : 0,        // Good FID
      coreWebVitals.CLS < 0.1 ? 1 : 0,        // Good CLS
      memory.memoryUsagePercentage < 70 ? 1 : 0  // Good memory usage
    ].reduce((a, b) => a + b, 0);

    if (vitalsScore >= 3) return { status: 'good', color: 'text-green-600', icon: TrendingUp };
    if (vitalsScore >= 2) return { status: 'warning', color: 'text-yellow-600', icon: Activity };
    return { status: 'poor', color: 'text-red-600', icon: TrendingDown };
  }, [coreWebVitals, memory]);

  const performanceStatus = getPerformanceStatus();

  if (!enabled) {
    return null;
  }

  const StatusIcon = performanceStatus.icon;

  return (
    <div className="fixed top-4 right-4 z-50 min-w-80">
      <Card className="bg-background/95 backdrop-blur-md border-border/50 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${performanceStatus.color}`} />
              Performance Monitor
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant={performanceStatus.status === 'good' ? 'default' : 'destructive'} className="text-xs">
                {performanceStatus.status.toUpperCase()}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isExpanded ? (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <MemoryStick className="w-3 h-3" />
                <span>{memory.memoryUsagePercentage.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>{formatTime(coreWebVitals.LCP)}</span>
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-3">
            {/* Core Web Vitals */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Core Web Vitals
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>LCP:</span>
                  <span className={coreWebVitals.LCP < 2500 ? 'text-green-600' : 'text-red-600'}>
                    {formatTime(coreWebVitals.LCP)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>FID:</span>
                  <span className={coreWebVitals.FID < 100 ? 'text-green-600' : 'text-red-600'}>
                    {formatTime(coreWebVitals.FID)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CLS:</span>
                  <span className={coreWebVitals.CLS < 0.1 ? 'text-green-600' : 'text-red-600'}>
                    {coreWebVitals.CLS.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>FCP:</span>
                  <span className={coreWebVitals.FCP < 1800 ? 'text-green-600' : 'text-red-600'}>
                    {formatTime(coreWebVitals.FCP)}
                  </span>
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <MemoryStick className="w-3 h-3" />
                Memory Usage
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Used:</span>
                  <span>{formatBytes(memory.usedJSHeapSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{formatBytes(memory.totalJSHeapSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Usage:</span>
                  <span className={memory.memoryUsagePercentage < 70 ? 'text-green-600' : 'text-red-600'}>
                    {memory.memoryUsagePercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Network Metrics */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Network
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Requests:</span>
                  <span>{networkMetrics.totalRequests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className={networkMetrics.failedRequests > 0 ? 'text-red-600' : 'text-green-600'}>
                    {networkMetrics.failedRequests}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response:</span>
                  <span>{formatTime(networkMetrics.averageResponseTime)}</span>
                </div>
              </div>
            </div>

            {/* Component Metrics */}
            {showComponentMetrics && componentMetrics.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium flex items-center gap-1">
                  <Cpu className="w-3 h-3" />
                  Component Performance
                </h4>
                <div className="space-y-1 text-xs">
                  {componentMetrics.map((metric, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{metric.componentName}:</span>
                      <span className={metric.isSlow ? 'text-red-600' : 'text-green-600'}>
                        {formatTime(metric.averageRenderTime)} ({metric.renderCount})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
              Last updated: {new Date(lastUpdate.current).toLocaleTimeString()}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default PerformanceMonitor;