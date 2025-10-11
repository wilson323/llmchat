/**
 * Express类型扩展
 */
import { ProtectedRequestContext } from '@/services/ProtectionService';
import { AuditAction, ResourceType } from './audit';

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
      protectionContext?: ProtectedRequestContext;
      protectionService?: any;
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