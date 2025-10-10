/**
 * 认证服务适配器
 *
 * 目的:
 * - 统一新旧AuthService的接口
 * - 使AuthController无需感知底层服务版本
 * - 渐进式迁移，保持向后兼容
 */

import { AuthService, AuthUser, LoginResult } from '@/services/AuthService';
import { AuthServiceV2, getAuthService } from '@/services/AuthServiceV2';
import logger from '@/utils/logger';

// 统一的接口定义
export interface IAuthServiceAdapter {
  login(username: string, password: string, ip?: string): Promise<LoginResult>;
  profile(token: string): Promise<AuthUser>;
  logout(token: string): Promise<void>;
  changePassword(
    token: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void>;
  refreshToken?(refreshToken: string): Promise<LoginResult>;
}

/**
 * V1服务适配器
 */
export class AuthServiceV1Adapter implements IAuthServiceAdapter {
  constructor(private service: AuthService) {}

  async login(
    username: string,
    password: string,
    ip?: string,
  ): Promise<LoginResult> {
    // V1不支持IP参数，忽略
    return this.service.login(username, password);
  }

  async profile(token: string): Promise<AuthUser> {
    return this.service.profile(token);
  }

  async logout(token: string): Promise<void> {
    await this.service.logout(token);
  }

  async changePassword(
    token: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.service.changePassword(token, oldPassword, newPassword);
  }
}

/**
 * V2服务适配器
 */
export class AuthServiceV2Adapter implements IAuthServiceAdapter {
  constructor(private service: AuthServiceV2) {}

  async login(
    username: string,
    password: string,
    ip?: string,
  ): Promise<LoginResult> {
    return this.service.login(username, password, ip);
  }

  async profile(token: string): Promise<AuthUser> {
    const result = await this.service.validateToken(token);
    if (!result.valid || !result.user) {
      throw new Error(result.error || 'TOKEN_INVALID');
    }
    return result.user;
  }

  async logout(token: string): Promise<void> {
    await this.service.logout(token);
  }

  async changePassword(
    token: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    // V2需要userId，从token中提取
    const result = await this.service.validateToken(token);
    if (!result.valid || !result.user) {
      throw new Error('UNAUTHORIZED');
    }
    await this.service.changePassword(result.user.id, oldPassword, newPassword);
  }

  async refreshToken(refreshToken: string): Promise<LoginResult> {
    return this.service.refreshToken(refreshToken);
  }
}

/**
 * 创建适配器工厂函数
 */
export function createAuthServiceAdapter(
  service: AuthService | AuthServiceV2,
  isV2: boolean,
): IAuthServiceAdapter {
  if (isV2) {
    logger.debug('创建AuthServiceV2Adapter');
    return new AuthServiceV2Adapter(service as AuthServiceV2);
  } else {
    logger.debug('创建AuthServiceV1Adapter');
    return new AuthServiceV1Adapter(service as AuthService);
  }
}

/**
 * 获取适配后的认证服务
 */
export function getAuthServiceAdapter(): IAuthServiceAdapter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // ^ 使用require()动态导入以避免模块循环依赖
  const { authService, isAuthV2 } = require('./authInstance');
  return createAuthServiceAdapter(authService, isAuthV2);
}
