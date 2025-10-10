/**
 * Express类型扩展
 */
import { ProtectedRequestContext } from '@/services/ProtectionService';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      protectionContext?: ProtectedRequestContext;
      protectionService?: any;
      audit?: any;
      user?: any;
    }
  }
}

export {};