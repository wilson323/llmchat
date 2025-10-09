import { Request, Response, NextFunction } from "express";
import { auditService } from "@/services/AuditService";
import { AuditAction, AuditStatus, ResourceType } from "@/types/audit";
import logger from "@/utils/logger";

/**
 * 审计中间件
 *
 * 自动记录关键HTTP请求的审计日志
 */

/**
 * 扩展 Request 以支持审计上下文
 */
export interface AuditContext {
  action?: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  skipAudit?: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  // ^ 忽略namespace警告，因为这是扩展Express命名空间的标准方法
  namespace Express {
    interface Request {
      audit?: AuditContext;
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

/**
 * 审计日志中间件
 *
 * 用法：
 * ```ts
 * router.post('/login', auditMiddleware(AuditAction.LOGIN), authController.login);
 * ```
 */
export function auditMiddleware(
  action?: AuditAction,
  resourceType?: ResourceType
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 初始化审计上下文
    const auditContext: AuditContext = {
      skipAudit: false,
    };

    // 只添加非 undefined 的属性
    if (action) auditContext.action = action;
    if (resourceType) auditContext.resourceType = resourceType;

    req.audit = auditContext;

    // 保存原始的 res.json 方法
    const originalJson = res.json.bind(res);

    // 覆盖 res.json 方法以在响应后记录审计日志
    res.json = function (body?: unknown) {
      // 记录审计日志
      setImmediate(() => {
        recordAudit(req, res, body);
      });

      // 调用原始的 json 方法
      return originalJson(body);
    } as Response["json"];

    next();
  };
}

/**
 * 记录审计日志
 */
async function recordAudit(req: Request, res: Response, responseBody: unknown) {
  try {
    // 跳过审计
    if (req.audit?.skipAudit) {
      return;
    }

    // 确定操作类型
    const action = req.audit?.action || inferActionFromRequest(req);
    if (!action) {
      return; // 不是需要审计的操作
    }

    // 确定状态
    const status =
      res.statusCode >= 200 && res.statusCode < 300
        ? AuditStatus.SUCCESS
        : AuditStatus.FAILURE;

    // 提取错误信息
    let errorMessage: string | undefined;
    if (
      status === AuditStatus.FAILURE &&
      responseBody &&
      typeof responseBody === "object"
    ) {
      const body = responseBody as Record<string, unknown>;
      errorMessage =
        (body.message as string | undefined) ||
        (body.error as string | undefined);
    }

    // 提取用户信息
    const userId = req.user?.id;
    const username = req.user?.username;

    // 提取IP和User-Agent
    const ipAddress = extractIPAddress(req);
    const userAgent = req.get("user-agent");

    // 构建详细信息
    const details: Record<string, unknown> = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      ...req.audit?.details,
    };

    // 记录审计日志
    const logParams: any = {
      action,
      details,
      status,
    };

    // 只添加非 undefined 的属性
    if (userId) logParams.userId = userId;
    if (username) logParams.username = username;
    if (req.audit?.resourceType)
      logParams.resourceType = req.audit.resourceType;
    if (req.audit?.resourceId) logParams.resourceId = req.audit.resourceId;
    if (ipAddress) logParams.ipAddress = ipAddress;
    if (userAgent) logParams.userAgent = userAgent;
    if (errorMessage) logParams.errorMessage = errorMessage;

    await auditService.log(logParams);
  } catch (error) {
    // 审计失败不应该影响正常请求
    logger.error("Failed to record audit log", {
      component: "auditMiddleware",
      error,
      path: req.path,
    });
  }
}

/**
 * 从请求推断操作类型
 */
function inferActionFromRequest(req: Request): AuditAction | null {
  const { method, path } = req;

  // 登录/登出
  if (path.includes("/auth/login")) {
    return AuditAction.LOGIN;
  }
  if (path.includes("/auth/logout")) {
    return AuditAction.LOGOUT;
  }

  // 用户管理
  if (path.includes("/users")) {
    if (method === "POST") {
      return AuditAction.USER_CREATE;
    }
    if (method === "PUT" || method === "PATCH") {
      return AuditAction.USER_UPDATE;
    }
    if (method === "DELETE") {
      return AuditAction.USER_DELETE;
    }
  }

  // 智能体管理
  if (path.includes("/agents")) {
    if (method === "POST") {
      return AuditAction.AGENT_CREATE;
    }
    if (method === "PUT" || method === "PATCH") {
      return AuditAction.AGENT_UPDATE;
    }
    if (method === "DELETE") {
      return AuditAction.AGENT_DELETE;
    }
  }

  // 配置管理
  if (path.includes("/config") && (method === "PUT" || method === "PATCH")) {
    return AuditAction.CONFIG_UPDATE;
  }

  return null;
}

/**
 * 提取客户端IP地址
 */
function extractIPAddress(req: Request): string | undefined {
  // 尝试从 X-Forwarded-For 头获取（代理环境）
  const forwardedFor = req.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }

  // 尝试从 X-Real-IP 头获取
  const realIp = req.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // 使用 socket 地址
  return req.socket.remoteAddress;
}

/**
 * 手动记录审计日志的辅助函数
 */
export async function logAudit(params: {
  req: Request;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  status?: AuditStatus;
  errorMessage?: string;
}) {
  const {
    req,
    action,
    resourceType,
    resourceId,
    details,
    status,
    errorMessage,
  } = params;

  const logParams: any = {
    action,
    status: status || AuditStatus.SUCCESS,
  };

  // 只添加非 undefined 的属性
  if (req.user?.id) logParams.userId = req.user.id;
  if (req.user?.username) logParams.username = req.user.username;
  if (resourceType) logParams.resourceType = resourceType;
  if (resourceId) logParams.resourceId = resourceId;
  if (details) logParams.details = details;

  const ipAddress = extractIPAddress(req);
  if (ipAddress) logParams.ipAddress = ipAddress;

  const userAgent = req.get("user-agent");
  if (userAgent) logParams.userAgent = userAgent;

  if (errorMessage) logParams.errorMessage = errorMessage;

  await auditService.log(logParams);
}
