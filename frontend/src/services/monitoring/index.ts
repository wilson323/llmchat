/**
 * 监控服务导出
 * 统一导出性能监控和错误处理服务
 */

import { PerformanceMonitor } from './PerformanceMonitor';

export { PerformanceMonitor } from './PerformanceMonitor';
export { ErrorHandlingService, globalErrorHandler } from './ErrorHandlingService';

// 创建全局监控实例
export const globalPerformanceMonitor = new PerformanceMonitor();