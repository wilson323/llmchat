/**
 * 审计日志类型定义
 */

/**
 * 审计操作类型
 */
export enum AuditAction {
  // 认证相关
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_REVOKE = 'TOKEN_REVOKE',

  // 用户管理
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  UPDATE = 'UPDATE', // 向后兼容别名
  USER_DELETE = 'USER_DELETE',
  USER_PASSWORD_CHANGE = 'USER_PASSWORD_CHANGE',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',

  // 智能体管理
  AGENT_CREATE = 'AGENT_CREATE',
  AGENT_UPDATE = 'AGENT_UPDATE',
  AGENT_DELETE = 'AGENT_DELETE',
  AGENT_ACTIVATE = 'AGENT_ACTIVATE',
  AGENT_DEACTIVATE = 'AGENT_DEACTIVATE',

  // 配置管理
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  CONFIG_RELOAD = 'CONFIG_RELOAD',

  // 会话管理
  SESSION_CREATE = 'SESSION_CREATE',
  SESSION_DELETE = 'SESSION_DELETE',
  SESSION_EXPORT = 'SESSION_EXPORT',

  // 系统操作
  SYSTEM_START = 'SYSTEM_START',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

/**
 * 资源类型
 */
export enum ResourceType {
  USER = 'USER',
  AGENT = 'AGENT',
  CONFIG = 'CONFIG',
  SESSION = 'SESSION',
  TOKEN = 'TOKEN',
  SYSTEM = 'SYSTEM',
}

/**
 * 审计状态
 */
export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL',
}

/**
 * 审计日志记录
 */
export interface AuditLog {
  id?: number;
  timestamp: Date;
  userId?: string;
  username?: string;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: AuditStatus;
  errorMessage?: string;
  createdAt?: Date;
}

/**
 * 审计日志创建参数
 */
export interface CreateAuditLogParams {
  userId?: string;
  username?: string;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status?: AuditStatus;
  errorMessage?: string;
}

/**
 * 审计日志查询参数
 */
export interface AuditLogQuery {
  userId?: string;
  action?: AuditAction | AuditAction[];
  resourceType?: ResourceType;
  resourceId?: string;
  status?: AuditStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'action' | 'status';
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * 审计日志查询结果
 */
export interface AuditLogQueryResult {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

