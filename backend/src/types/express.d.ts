/**
 * Express类型扩展
 */
import { ProtectedRequestContext } from '@/services/ProtectionService';

declare global {
  namespace Express {
    interface Request {
      protectionContext?: ProtectedRequestContext;
      protectionService?: any;
    }
  }
}

export {};