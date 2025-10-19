/**
 * Express类型扩展 - 简化版本
 */
// import type { ProtectedRequestContext } from '@/services/ProtectionService'; // 已移除保护服务
import type { AuditAction, ResourceType } from './audit';

/**
 * 审计上下文
 */
export interface AuditContext {
  action?: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  skipAudit?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      // protectionContext?: ProtectedRequestContext; // 已移除保护服务
      // protectionService?: any; // 已移除保护服务
      audit?: AuditContext;
      user?: {
        id: string;
        username?: string;
        email?: string;
        role?: string;
      };
    }
  }
}

export {};