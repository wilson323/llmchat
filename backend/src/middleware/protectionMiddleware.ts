/**
 * 保护中间件
 * 集成熔断器、限流器、重试机制和监控
 */

import type { Request, Response, NextFunction } from 'express';
import type { ProtectedRequestContext } from '@/services/ProtectionService';
import { getProtectionService } from '@/services/ProtectionService';
import { createErrorFromUnknown } from '@/types/errors';
import logger from '@/utils/logger';
import type { JsonValue } from '@/types/dynamic';
import { createDefaultFirewall } from '@/services/EthicsFirewallService';

/**
 * 保护中间件
 */
export function protectionMiddleware() {
  const protectionService = getProtectionService();

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // 添加保护服务到请求对象
      (req as Request & { protectionService?: typeof protectionService }).protectionService = protectionService;

      // 生成请求上下文
      const userAgent = req.get('User-Agent');
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      const context: ProtectedRequestContext = {
        requestId: generateRequestId(),
        agentId: req.body?.agentId || req.params?.agentId || req.query?.agentId as string || 'unknown',
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        timestamp: new Date(),
        ...(userId && { userId }),
        ...(userAgent && { userAgent }),
      };

      // 添加上下文到请求对象
      (req as Request & { protectionContext?: ProtectedRequestContext }).protectionContext = context;

      // 添加请求ID到响应头
      res.setHeader('X-Request-ID', context.requestId);

      next();
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ProtectionMiddleware',
        operation: 'protectionMiddleware',
        url: req.originalUrl,
        method: req.method,
      });
      logger.error('保护中间件错误', { error: typedError.message });
      // 出错时继续处理请求，避免影响正常服务
      next();
    }
  };
}

/**
 * 受保护的API中间件
 */
export function protectedApiMiddleware() {
  const protectionService = getProtectionService();

  const ethicsFirewall = createDefaultFirewall();
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = req.protectionContext;

    if (!context) {
      res.status(500).json({
        code: 'PROTECTION_CONTEXT_MISSING',
        message: '保护上下文缺失',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      // 伦理防火墙检查（API）
      try {
        const payload: { action: string; content: any; sensitive: boolean } & Partial<{ resourceId: string }> = {
          action: `${req.method} ${req.path}`,
          content: req.body,
          sensitive: req.path.includes('/admin') || req.path.includes('/export') || req.method === 'DELETE',
        };
        const paramId = (req as Request & { params?: Record<string, unknown> }).params?.['id'];
        if (typeof paramId === 'string' && paramId.length > 0) {
          (payload as { resourceId: string }).resourceId = paramId;
        }
        const verdict = ethicsFirewall.evaluateCommand(context, payload);
        ethicsFirewall.assertOrThrow(verdict);
      } catch (ethicsError) {
        const typedError = createErrorFromUnknown(ethicsError, {
          component: 'ProtectionMiddleware',
          operation: 'ethicsApiCheck',
          url: req.originalUrl,
          method: req.method,
        });
        logger.warn('伦理防火墙阻断(API)', { error: typedError.message });
        res.status(403).json({
          code: 'POLICY_VIOLATION',
          message: typedError.message,
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 检查限流
      const rateLimitResult = await checkRateLimit(req, protectionService);
      if (!rateLimitResult.allowed) {
        res.set({
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
          'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '100',
          'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime?.toISOString() || new Date().toISOString(),
        });

        res.status(429).json({
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
          retryAfter: rateLimitResult.retryAfter || 60,
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 检查熔断器状态（如果有agentId）
      if (context.agentId !== 'unknown') {
        const circuitBreakerHealth = checkCircuitBreakerHealth(context.agentId, protectionService);
        if (!circuitBreakerHealth.healthy) {
          res.status(503).json({
            code: 'CIRCUIT_BREAKER_OPEN',
            message: `服务暂时不可用: ${circuitBreakerHealth.message}`,
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      next();
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ProtectionMiddleware',
        operation: 'protectedApiMiddleware',
        url: req.originalUrl,
        method: req.method,
        context: { context: context?.requestId },
      });
      logger.error('受保护API中间件错误', { error: typedError.message });
      // 出错时继续处理请求
      next();
    }
  };
}

/**
 * 受保护的聊天中间件
 */
export function protectedChatMiddleware() {
  const protectionService = getProtectionService();

  const ethicsFirewall = createDefaultFirewall();
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = req.protectionContext;

    if (!context) {
      res.status(500).json({
        code: 'PROTECTION_CONTEXT_MISSING',
        message: '保护上下文缺失',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 更新agentId从请求体
    if (req.body?.agentId) {
      context.agentId = req.body.agentId;
    }

    try {
      // 伦理防火墙检查（Chat）
      try {
        const payload: { action: string; content: any; sensitive: boolean } & Partial<{ resourceId: string }> = {
          action: 'chat.handle',
          content: req.body,
          sensitive: false,
        };
        if (typeof context.agentId === 'string' && context.agentId !== 'unknown' && context.agentId.length > 0) {
          (payload as { resourceId: string }).resourceId = context.agentId;
        }
        const verdict = ethicsFirewall.evaluateCommand(context, payload);
        ethicsFirewall.assertOrThrow(verdict);
      } catch (ethicsError) {
        const typedError = createErrorFromUnknown(ethicsError, {
          component: 'ProtectionMiddleware',
          operation: 'ethicsChatCheck',
          url: req.originalUrl,
          method: req.method,
          context: { requestId: context.requestId, agentId: context.agentId },
        });
        logger.warn('伦理防火墙阻断(Chat)', {
          requestId: context.requestId,
          agentId: context.agentId,
          error: typedError.message,
        });
        res.status(403).json({
          code: 'POLICY_VIOLATION',
          message: typedError.message,
          requestId: context.requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 执行受保护的聊天请求
      await protectionService.executeProtectedRequest(context, async () => {
        // 这里不直接执行聊天逻辑，而是继续到下一个中间件
        // 实际的聊天逻辑将在聊天控制器中使用保护服务
        return new Promise<void>((resolve) => {
          // 标记请求为受保护
          (req as Request & { isProtected?: boolean }).isProtected = true;
          next();
          resolve();
        });
      });
    } catch (unknownError) {
      const typedError = createErrorFromUnknown(unknownError, {
        component: 'ProtectionMiddleware',
        operation: 'protectedChatMiddleware',
        url: req.originalUrl,
        method: req.method,
        context: { requestId: context.requestId, agentId: context.agentId },
      });
      logger.error('受保护聊天中间件错误', {
        requestId: context.requestId,
        agentId: context.agentId,
        error: typedError.message,
      });

      // 如果是降级响应，返回成功状态
      const fallbackError = typedError as { fallbackUsed?: boolean; data?: JsonValue };
      if (fallbackError.fallbackUsed) {
        res.json(fallbackError.data);
        return;
      }

      // 返回错误响应
      const statusCode = getErrorStatusCode(typedError);
      res.status(statusCode).json({
        code: getErrorCode(typedError),
        message: typedError.message,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * 检查限流
 */
async function checkRateLimit(req: Request, protectionService: { multiDimensionRateLimiter: { isAllowed: (req: Request) => { allowed: boolean; results?: Array<{ allowed?: boolean; remaining?: number; retryAfter?: number; resetTime?: Date }> } } }): Promise<{
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  resetTime?: Date;
}> {
  try {
    // 模拟请求对象用于限流检查
    const mockReq = {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      method: req.method,
      path: req.path,
      user: (req as Request & { user?: unknown }).user,
      route: req.route,
      get: (header: string) => req.headers[header.toLowerCase()],
      header: (header: string) => req.headers[header.toLowerCase()],
      accepts: (types: string[]) => false, // 简化实现
      acceptsCharsets: (charsets: string[]) => false, // 简化实现
      acceptsEncodings: (encodings: string[]) => false, // 简化实现
      acceptsLanguages: (languages: string[]) => false, // 简化实现
      is: (type: string) => false, // 简化实现
      param: (name: string) => (req as Request & { params?: Record<string, unknown> }).params?.[name],
      query: (name: string) => (req as Request & { query?: Record<string, unknown> }).query?.[name],
      cookies: (req as Request & { cookies?: Record<string, unknown> }).cookies || {},
      signedCookies: (req as Request & { signedCookies?: Record<string, unknown> }).signedCookies || {},
      body: (req as Request & { body?: unknown }).body || {},
      files: (req as Request & { files?: unknown }).files || {},
      protocol: req.protocol || 'http',
      secure: req.secure || false,
      xhr: req.xhr || false,
      subdomains: [],
      originalUrl: req.originalUrl || req.url,
      baseUrl: req.baseUrl || '',
      url: req.url || '',
      app: (req as Request & { app?: unknown }).app,
      // 添加必要的Express Request属性
      headers: req.headers,
      connection: req.connection,
      socket: req.socket,
      complete: true,
      httpVersion: '1.1',
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      trailers: {},
      rawTrailers: [],
      upgrade: false,
      // 方法
      res: undefined as unknown,
      next: undefined as unknown,
    } as unknown as Request;

    const checkResult = protectionService.multiDimensionRateLimiter.isAllowed(mockReq);

    if (!checkResult.allowed) {
      const failedResult = checkResult.results?.find((r: { allowed?: boolean; remaining?: number; retryAfter?: number; resetTime?: Date }) => !r.allowed);
      const result: {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
        limit?: number;
        remaining?: number;
        resetTime?: Date;
      } = {
        allowed: false,
        reason: `维度限制触发: ${failedResult?.remaining || 0}`,
        ...(failedResult?.retryAfter !== undefined && { retryAfter: failedResult.retryAfter }),
        ...(failedResult?.remaining !== undefined && { remaining: failedResult.remaining }),
        ...(failedResult?.resetTime !== undefined && { resetTime: failedResult.resetTime }),
      };

      if (failedResult?.remaining !== undefined) {
        result.limit = failedResult.remaining + (failedResult?.allowed ? 0 : 1);
      }

      return result;
    }

    return { allowed: true };
  } catch (unknownError) {
    const typedError = createErrorFromUnknown(unknownError, {
      component: 'ProtectionMiddleware',
      operation: 'checkRateLimit',
      context: { ip: req.ip, method: req.method, path: req.path },
    });
    logger.error('限流检查失败', { error: typedError.message });
    // 出错时允许请求通过
    return { allowed: true };
  }
}

/**
 * 检查熔断器健康状态
 */
function checkCircuitBreakerHealth(agentId: string, protectionService: { circuitBreakerManager: { getHealthStatus: () => Array<{ name: string; healthy: boolean; message?: string }> } }): {
  healthy: boolean;
  message: string;
} {
  try {
    const {circuitBreakerManager} = protectionService;
    const healthStatus = circuitBreakerManager.getHealthStatus();

    const agentCircuitBreaker = healthStatus.find((cb: { name: string; healthy: boolean; message?: string }) => cb.name === `agent_${agentId}`);

    if (agentCircuitBreaker && !agentCircuitBreaker.healthy) {
      return {
        healthy: false,
        message: agentCircuitBreaker.message || '熔断器状态未知',
      };
    }

    return { healthy: true, message: '服务正常' };
  } catch (unknownError) {
    const typedError = createErrorFromUnknown(unknownError, {
      component: 'ProtectionMiddleware',
      operation: 'checkCircuitBreakerHealth',
      context: { agentId },
    });
    logger.error('熔断器健康检查失败', { error: typedError.message });
    // 出错时假设健康
    return { healthy: true, message: '健康检查异常' };
  }
}

/**
 * 获取错误状态码
 */
function getErrorStatusCode(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes('熔断器')) {
    return 503;
  }
  if (message.includes('限流')) {
    return 429;
  }
  if (message.includes('超时')) {
    return 408;
  }
  if (message.includes('网络')) {
    return 502;
  }
  if (message.includes('不可用')) {
    return 503;
  }

  return 500;
}

/**
 * 获取错误代码
 */
function getErrorCode(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('熔断器')) {
    return 'CIRCUIT_BREAKER_OPEN';
  }
  if (message.includes('限流')) {
    return 'RATE_LIMIT_EXCEEDED';
  }
  if (message.includes('超时')) {
    return 'REQUEST_TIMEOUT';
  }
  if (message.includes('网络')) {
    return 'NETWORK_ERROR';
  }
  if (message.includes('不可用')) {
    return 'SERVICE_UNAVAILABLE';
  }

  return 'INTERNAL_ERROR';
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 监控指标中间件
 */
export function monitoringMetricsMiddleware() {
  const protectionService = getProtectionService();

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // 监听响应完成事件
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode < 400;

      // 记录监控指标到日志
      logger.info('Request completed', {
        responseTime,
        success,
        statusCode: res.statusCode,
        method: req.method,
        url: req.url,
        ip: req.ip
      });
    });

    next();
  };
}

/**
 * 健康检查增强中间件
 */
export function enhancedHealthCheckMiddleware() {
  const protectionService = getProtectionService();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/health') {
      const systemHealth = protectionService.getSystemHealth();
      const performanceMetrics = protectionService.getPerformanceMetrics();
      const activeAlerts = protectionService.getActiveAlerts();

      const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        protection: {
          systemHealth,
          performanceMetrics,
          activeAlerts: activeAlerts.length,
          circuitBreakers: protectionService.getAllCircuitBreakers().length,
          rateLimiters: protectionService.getAllRateLimitMetrics().length,
        },
      };

      // 根据系统健康状态设置HTTP状态码
      const statusCode = systemHealth?.status === 'healthy' ? 200 :
        systemHealth?.status === 'warning' ? 200 : 503;

      res.status(statusCode).json(healthData);
      return;
    }

    next();
  };
}

// 默认导出
export default protectionMiddleware;