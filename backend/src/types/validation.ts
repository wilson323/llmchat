/**
 * Joi验证结果类型定义
 * 解决重复的{ error?: any; value?: any }问题
 */

import type { ValidationError } from 'joi';

/**
 * Joi验证结果泛型接口
 */
export interface JoiValidationResult<T> {
  error?: ValidationError;
  value?: T;
}

/**
 * 智能体配置验证结果
 */
export interface AgentConfigValidation {
  id?: string;
  name?: string;
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * 审计日志查询参数验证结果
 */
export interface AuditLogQueryValidation {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * 用户注册验证结果
 */
export interface UserRegistrationValidation {
  username: string;
  password: string;
  email?: string;
  role?: 'user' | 'admin';
}

/**
 * 用户登录验证结果
 */
export interface UserLoginValidation {
  username: string;
  password: string;
}

/**
 * 会话创建验证结果
 */
export interface SessionCreationValidation {
  agentId: string;
  title?: string;
  userId?: string;
}

/**
 * 消息发送验证结果
 */
export interface MessageSendValidation {
  sessionId: string;
  content: string;
  role?: 'user' | 'assistant';
  metadata?: Record<string, unknown>;
}

/**
 * 智能体导入验证结果
 */
export interface AgentImportValidation {
  agents: AgentConfigValidation[];
}

/**
 * Dify连接验证结果
 */
export interface DifyConnectionValidation {
  provider: string;
  endpoint: string;
  apiKey: string;
  appId?: string;
}

/**
 * ==========================================
 * 数据库查询结果类型定义
 * ==========================================
 */

/**
 * 用户查询结果
 */
export interface UserQueryResult {
  id: string;
  username: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  created_at: Date;
  updated_at: Date;
}

/**
 * COUNT查询结果
 */
export interface CountResult {
  count: number;
}

/**
 * 日志查询结果
 */
export interface LogQueryResult {
  id: string;
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

/**
 * EXISTS查询结果
 */
export interface ExistsResult {
  exists: boolean;
}

/**
 * 用户登录失败尝试查询结果
 */
export interface FailedLoginAttemptsResult {
  failed_login_attempts: number;
}

/**
 * 数据库操作结果（UPDATE/INSERT/DELETE）
 */
export interface DbOperationResult {
  rowCount: number;
}

