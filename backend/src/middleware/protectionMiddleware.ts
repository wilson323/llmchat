/**
 * 保护中间件
 * 集成熔断器、限流器、重试机制和监控
 */

import { Request, Response, NextFunction } from 'express';
import { getProtectionService, ProtectedRequestContext } from '@/services/ProtectionService';

/**
 * 保护中间件
 */
export function protectionMiddleware() {
  const protectionService = getProtectionService();

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // 添加保护服务到请求对象
      req.protectionService = protectionService;

      // 生成请求上下文
      const userAgent = req.get('User-Agent');
      const userId = (req as any).user?.id;
      const context: ProtectedRequestContext = {
        requestId: generateRequestId(),
        agentId: req.body?.agentId || req.params?.agentId || req.query?.agentId as string || 'unknown',
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        timestamp: new Date(),
        ...(userId && { userId }),
        ...(userAgent && { userAgent }),
      };

      // 添加上下文到请求对象
      req.protectionContext = context;

      // 添加请求ID到响应头
      res.setHeader('X-Request-ID', context.requestId);

      next();
    } catch (error) {
      console.error('保护中间件错误:', error);
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

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = req.protectionContext;

    if (!context) {
      res.status(500).json({
        code: 'PROTECTION_CONTEXT_MISSING',
        message: '保护上下文缺失',
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
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
    } catch (error) {
      console.error('受保护API中间件错误:', error);
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

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const context = req.protectionContext;

    if (!context) {
      res.status(500).json({
        code: 'PROTECTION_CONTEXT_MISSING',
        message: '保护上下文缺失',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 更新agentId从请求体
    if (req.body?.agentId) {
      context.agentId = req.body.agentId;
    }

    try {
      // 执行受保护的聊天请求
      await protectionService.executeProtectedRequest(context, async () => {
        // 这里不直接执行聊天逻辑，而是继续到下一个中间件
        // 实际的聊天逻辑将在聊天控制器中使用保护服务
        return new Promise<void>((resolve) => {
          // 标记请求为受保护
          (req as any).isProtected = true;
          next();
          resolve();
        });
      });
    } catch (error) {
      console.error('受保护聊天中间件错误:', {
        requestId: context.requestId,
        agentId: context.agentId,
        error: (error as Error).message
      });

      // 如果是降级响应，返回成功状态
      if ((error as any).fallbackUsed) {
        res.json((error as any).data);
        return;
      }

      // 返回错误响应
      const statusCode = getErrorStatusCode(error as Error);
      res.status(statusCode).json({
        code: getErrorCode(error as Error),
        message: (error as Error).message,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * 检查限流
 */
async function checkRateLimit(req: Request, protectionService: any): Promise<{
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
      user: (req as any).user,
      route: req.route,
      get: (header: string) => req.headers[header.toLowerCase()],
      header: (header: string) => req.headers[header.toLowerCase()],
      accepts: (types: string[]) => false, // 简化实现
      acceptsCharsets: (charsets: string[]) => false, // 简化实现
      acceptsEncodings: (encodings: string[]) => false, // 简化实现
      acceptsLanguages: (languages: string[]) => false, // 简化实现
      is: (type: string) => false, // 简化实现
      param: (name: string) => (req as any).params?.[name],
      query: (name: string) => (req as any).query?.[name],
      cookies: (req as any).cookies || {},
      signedCookies: (req as any).signedCookies || {},
      body: (req as any).body || {},
      files: (req as any).files || {},
      protocol: req.protocol || 'http',
      secure: req.secure || false,
      xhr: req.xhr || false,
      subdomains: [],
      originalUrl: req.originalUrl || req.url,
      baseUrl: req.baseUrl || '',
      url: req.url || '',
      app: (req as any).app,
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
      res: undefined as any,
      next: undefined as any
    } as unknown as Request;

    const checkResult = protectionService.multiDimensionRateLimiter.isAllowed(mockReq);

    if (!checkResult.allowed) {
      const failedResult = checkResult.results.find((r: any) => !r.allowed);
      return {
        allowed: false,
        reason: `维度限制触发: ${failedResult?.remaining || 0}`,
        retryAfter: failedResult?.retryAfter,
        limit: failedResult?.remaining ? failedResult.remaining + (failedResult?.allowed ? 0 : 1) : undefined,
        remaining: failedResult?.remaining,
        resetTime: failedResult?.resetTime
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('限流检查失败:', error);
    // 出错时允许请求通过
    return { allowed: true };
  }
}

/**
 * 检查熔断器健康状态
 */
function checkCircuitBreakerHealth(agentId: string, protectionService: any): {
  healthy: boolean;
  message: string;
} {
  try {
    const circuitBreakerManager = protectionService.circuitBreakerManager;
    const healthStatus = circuitBreakerManager.getHealthStatus();

    const agentCircuitBreaker = healthStatus.find((cb: any) => cb.name === `agent_${agentId}`);

    if (agentCircuitBreaker && !agentCircuitBreaker.healthy) {
      return {
        healthy: false,
        message: agentCircuitBreaker.message
      };
    }

    return { healthy: true, message: '服务正常' };
  } catch (error) {
    console.error('熔断器健康检查失败:', error);
    // 出错时假设健康
    return { healthy: true, message: '健康检查异常' };
  }
}

/**
 * 获取错误状态码
 */
function getErrorStatusCode(error: Error): number {
  const message = error.message.toLowerCase();

  if (message.includes('熔断器')) return 503;
  if (message.includes('限流')) return 429;
  if (message.includes('超时')) return 408;
  if (message.includes('网络')) return 502;
  if (message.includes('不可用')) return 503;

  return 500;
}

/**
 * 获取错误代码
 */
function getErrorCode(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('熔断器')) return 'CIRCUIT_BREAKER_OPEN';
  if (message.includes('限流')) return 'RATE_LIMIT_EXCEEDED';
  if (message.includes('超时')) return 'REQUEST_TIMEOUT';
  if (message.includes('网络')) return 'NETWORK_ERROR';
  if (message.includes('不可用')) return 'SERVICE_UNAVAILABLE';

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

      // 记录监控指标
      protectionService.getMonitoringService().recordRequest(
        responseTime,
        success,
        success ? undefined : `HTTP_${res.statusCode}`
      );
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
          rateLimiters: protectionService.getAllRateLimitMetrics().length
        }
      };

      // 根据系统健康状态设置HTTP状态码
      const statusCode = systemHealth.status === 'healthy' ? 200 :
                        systemHealth.status === 'warning' ? 200 : 503;

      res.status(statusCode).json(healthData);
      return;
    }

    next();
  };
}

// 默认导出
export default protectionMiddleware;