/**
 * 认证服务实例配置
 *
 * 渐进式迁移策略:
 * - 通过环境变量USE_AUTH_V2控制使用新旧服务
 * - 默认使用V2（新服务）
 * - 可回退到V1（旧服务）
 */

import { AuthService } from '@/services/AuthService';
import { getAuthService as getAuthServiceV2 } from '@/services/AuthServiceV2';
import { EnvManager } from '@/config/EnvManager';
import logger from '@/utils/logger';

// 检查是否使用V2服务
const envManager = EnvManager.getInstance();
const useAuthV2 = envManager.getBoolean('USE_AUTH_V2', true); // 默认启用V2

if (useAuthV2) {
  logger.info('✅ 使用AuthServiceV2（增强版认证服务）');
} else {
  logger.warn('⚠️  使用AuthService（旧版认证服务），建议迁移到V2');
}

// 导出统一接口（兼容旧代码）
console.log('[AUTH_INSTANCE] 开始创建authService实例...');
export const authService = useAuthV2
  ? getAuthServiceV2()
  : new AuthService();
console.log('[AUTH_INSTANCE] ✓ authService实例创建成功');

// 导出类型（用于Controller）
export const isAuthV2 = useAuthV2;
