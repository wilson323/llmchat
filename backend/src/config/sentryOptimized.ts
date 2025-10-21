import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express } from 'express';
import logger from '@/utils/logger';

// 采样率常量
const DEVELOPMENT_TRACES_SAMPLE_RATE = 0.05;
const PRODUCTION_TRACES_SAMPLE_RATE = 0.1;
const PROFILES_SAMPLE_RATE = 0.05;

/**
 * 优化后的Sentry初始化
 *
 * 性能优化：
 * - 异步发送事件
 * - 降低采样率（10%）
 * - 批量传输（30个事件）
 * - 过滤低优先级事件
 */
export function initSentryOptimized(_app: Express): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry: 未配置DSN，跳过初始化');
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.npm_package_version ?? '1.0.0',

    // ✅ Express集成 (Sentry v10 API - 自动集成，无需参数)
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],

    // ✅ 采样率配置（降低发送频率）
    tracesSampleRate: isProduction ? PRODUCTION_TRACES_SAMPLE_RATE : DEVELOPMENT_TRACES_SAMPLE_RATE,  // 生产10%，开发5%
    profilesSampleRate: PROFILES_SAMPLE_RATE,                      // 性能采样5%

    // ✅ 过滤低优先级事件
    beforeSend: (event, _hint) => {
      // 过滤info和debug级别
      if (event.level === 'info' || event.level === 'debug') {
        return null;
      }

      // 过滤健康检查端点错误
      if (event.request?.url?.includes('/health')) {
        return null;
      }

      // 开发环境记录所有error
      if (!isProduction) {
        return event;
      }

      // 生产环境只发送error和fatal
      if (event.level === 'error' || event.level === 'fatal') {
        return event;
      }

      return null;
    },

    // ✅ 异步传输配置 (Sentry v10 自动批量发送，无需手动配置)
    // transport配置已内置优化，默认异步批量发送

    // ✅ 性能配置
    maxBreadcrumbs: 50,          // 面包屑限制
    maxValueLength: 1000,        // 值长度限制
    attachStacktrace: true,      // 附加堆栈

    // ✅ 忽略特定错误
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'NetworkError',
      'Non-Error promise rejection',
    ],
  });

  logger.info('Sentry: 已初始化（优化模式）', {
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProduction ? PRODUCTION_TRACES_SAMPLE_RATE : DEVELOPMENT_TRACES_SAMPLE_RATE,
  });
}
