/**
 * Web Vitals 性能监控
 * 
 * 监控核心Web性能指标：
 * - LCP (Largest Contentful Paint): 最大内容绘制
 * - FID (First Input Delay): 首次输入延迟
 * - CLS (Cumulative Layout Shift): 累积布局偏移
 * - FCP (First Contentful Paint): 首次内容绘制
 * - TTFB (Time to First Byte): 首字节时间
 */

import { onCLS, onFID, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { addBreadcrumb } from './sentry';

/**
 * 性能指标类型
 */
export type WebVitalMetric = Metric;

/**
 * 性能指标报告回调
 */
type ReportCallback = (metric: WebVitalMetric) => void;

/**
 * 性能阈值配置（基于Google推荐）
 */
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

/**
 * 获取性能评级
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * 默认报告处理器（发送到Sentry）
 */
function defaultReportHandler(metric: WebVitalMetric) {
  const rating = getRating(metric.name, metric.value);
  
  // 添加面包屑
  addBreadcrumb(
    `${metric.name}: ${Math.round(metric.value)}${metric.name === 'CLS' ? '' : 'ms'} (${rating})`,
    'performance',
    rating === 'poor' ? 'warning' : 'info'
  );

  // 发送到分析平台（示例：Google Analytics）
  if (window.gtag) {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      non_interaction: true,
      rating,
    });
  }

  // 控制台输出（开发环境）
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating,
      id: metric.id,
      navigationType: metric.navigationType,
    });
  }
}

/**
 * 初始化Web Vitals监控
 */
export function initWebVitals(onReport: ReportCallback = defaultReportHandler) {
  // 只在浏览器环境运行
  if (typeof window === 'undefined') return;

  try {
    onCLS(onReport);
    onFID(onReport);
    onFCP(onReport);
    onLCP(onReport);
    onTTFB(onReport);
    
    if (import.meta.env.DEV) {
      console.log('Web Vitals监控已启用');
    }
  } catch (error) {
    console.error('Web Vitals初始化失败:', error);
  }
}

/**
 * 获取性能摘要
 */
export function getPerformanceSummary() {
  if (typeof window === 'undefined' || !window.performance) return null;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  return {
    // 导航时间
    dns: navigation ? Math.round(navigation.domainLookupEnd - navigation.domainLookupStart) : 0,
    tcp: navigation ? Math.round(navigation.connectEnd - navigation.connectStart) : 0,
    request: navigation ? Math.round(navigation.responseStart - navigation.requestStart) : 0,
    response: navigation ? Math.round(navigation.responseEnd - navigation.responseStart) : 0,
    dom: navigation ? Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart) : 0,
    load: navigation ? Math.round(navigation.loadEventEnd - navigation.loadEventStart) : 0,
    
    // 绘制时间
    fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
    
    // 总时间
    total: navigation ? Math.round(navigation.loadEventEnd - navigation.fetchStart) : 0,
  };
}

/**
 * 监控资源加载性能
 */
export function monitorResourcePerformance() {
  if (typeof window === 'undefined' || !window.performance) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const resource = entry as PerformanceResourceTiming;
      
      // 报告慢速资源（>3秒）
      if (resource.duration > 3000) {
        addBreadcrumb(
          `慢速资源: ${resource.name} (${Math.round(resource.duration)}ms)`,
          'performance',
          'warning'
        );
      }

      // 报告大文件（>1MB）
      if (resource.transferSize > 1024 * 1024) {
        addBreadcrumb(
          `大文件: ${resource.name} (${(resource.transferSize / 1024 / 1024).toFixed(2)}MB)`,
          'performance',
          'info'
        );
      }
    }
  });

  observer.observe({ entryTypes: ['resource'] });
}

/**
 * 监控长任务（>50ms）
 */
export function monitorLongTasks() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        addBreadcrumb(
          `长任务: ${Math.round(entry.duration)}ms`,
          'performance',
          entry.duration > 100 ? 'warning' : 'info'
        );
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    // 浏览器不支持longtask API
    console.warn('Long Tasks API不支持');
  }
}

// 扩展Window类型以支持gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

