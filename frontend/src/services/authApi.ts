import { api } from './api';
import type {
  AuthPayload,
  ChangePasswordPayload,
  UserRole
} from './types/api-common';
import type {
  ApiErrorType,
  AuthenticationError
} from './types/api-errors';
import {
  ApiErrorFactory,
  ApiErrorHandler
} from './types/api-errors';
import type {
  ApiResponse,
  ApiResult
} from './types/api-response';

// ============================================================================
// 认证相关类型定义
// ============================================================================

/**
 * 用户信息接口
 */
export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  avatar?: string;
  createdAt?: string;
  lastLoginAt?: string;
  isActive?: boolean;
  preferences?: {
    language?: string;
    theme?: string;
  };
}

/**
 * 登录响应接口
 */
export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: UserInfo;
  expiresIn: number;
  tokenType: 'Bearer';
  scope?: string;
}

/**
 * JWT令牌信息
 */
export interface TokenInfo {
  token: string;
  refreshToken?: string;
  expiresIn: number;
  issuedAt: number;
  notBefore: number;
  audience?: string;
  issuer?: string;
  subject?: string;
}

/**
 * 刷新令牌响应
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  email: string;
  callbackUrl?: string;
}

/**
 * 密码重置确认
 */
export interface PasswordResetConfirmation {
  token: string;
  newPassword: string;
}

/**
 * 注册用户载荷
 */
export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: UserRole;
  invitationCode?: string;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
}

// ============================================================================
// 认证API服务类
// ============================================================================

/**
 * 认证API服务 - 提供类型安全的用户认证功能
 */
export class AuthApiService {
  /**
   * 用户登录
   */
  static async login(credentials: AuthPayload): Promise<ApiResult<LoginResponse>> {
    try {
      const response = await api.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        credentials
      );

      // 验证响应数据完整性
      const loginData = response.data.data;
      if (!loginData.token || !loginData.user) {
        throw ApiErrorFactory.authenticationError('登录响应数据不完整', 'AUTH_ERROR');
      }

      return {
        success: true,
        data: loginData,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);

      // 特殊处理认证错误
      if (apiError.code === 'UNAUTHORIZED' || apiError.code === 'AUTH_ERROR') {
        const authError: AuthenticationError = {
          ...apiError,
          code: apiError.code === 'UNAUTHORIZED' ? 'INVALID_TOKEN' : 'AUTH_ERROR',
          requiresReauth: true
        };

        ApiErrorHandler.logError(authError, {
          url: '/auth/login',
          method: 'POST',
          additional: { username: credentials.username }
        });

        return {
          success: false,
          error: authError
        };
      }

      ApiErrorHandler.logError(apiError, {
        url: '/auth/login',
        method: 'POST',
        additional: { username: credentials.username }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 用户注册
   */
  static async register(payload: RegisterPayload): Promise<ApiResult<UserInfo>> {
    try {
      const response = await api.post<ApiResponse<UserInfo>>(
        '/auth/register',
        payload
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/register',
        method: 'POST',
        additional: { username: payload.username, email: payload.email }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 用户登出
   */
  static async logout(): Promise<ApiResult<void>> {
    try {
      await api.post('/auth/logout', {});

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);

      // 登出失败通常不阻塞用户操作，只记录日志
      ApiErrorHandler.logError(apiError, {
        url: '/auth/logout',
        method: 'POST'
      });

      // 即使登出失败也返回成功，因为前端可以清除本地状态
      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          warning: '服务器登出失败，但本地状态已清除'
        }
      };
    }
  }

  /**
   * 获取用户资料
   */
  static async getProfile(): Promise<ApiResult<UserInfo>> {
    try {
      const response = await api.get<ApiResponse<{ user: UserInfo }>>(
        '/auth/profile'
      );

      return {
        success: true,
        data: response.data.data.user,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/profile',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 更新用户资料
   */
  static async updateProfile(updates: Partial<UserInfo>): Promise<ApiResult<UserInfo>> {
    try {
      const response = await api.put<ApiResponse<UserInfo>>(
        '/auth/profile',
        updates
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/profile',
        method: 'PUT',
        additional: { updates }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 修改密码
   */
  static async changePassword(payload: ChangePasswordPayload): Promise<ApiResult<{ success: boolean }>> {
    try {
      // 验证密码复杂性
      if (payload.newPassword.length < 8) {
        throw ApiErrorFactory.validationError('新密码长度至少8位', {
          field: 'newPassword',
          value: payload.newPassword
        });
      }

      if (payload.newPassword !== payload.confirmPassword) {
        throw ApiErrorFactory.validationError('两次输入的密码不一致', {
          field: 'confirmPassword',
          value: payload.confirmPassword
        });
      }

      const response = await api.post<ApiResponse<{ success: boolean }>>(
        '/auth/change-password',
        {
          oldPassword: payload.oldPassword,
          newPassword: payload.newPassword
        }
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/change-password',
        method: 'POST'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 刷新访问令牌
   */
  static async refreshToken(refreshToken: string): Promise<ApiResult<RefreshTokenResponse>> {
    try {
      const response = await api.post<ApiResponse<RefreshTokenResponse>>(
        '/auth/refresh',
        { refreshToken }
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);

      // 刷新令牌失败通常需要重新登录
      if (ApiErrorHandler.requiresReauthentication(apiError)) {
        const authError: AuthenticationError = {
          ...apiError,
          requiresReauth: true
        };

        return {
          success: false,
          error: authError
        };
      }

      ApiErrorHandler.logError(apiError, {
        url: '/auth/refresh',
        method: 'POST'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 请求密码重置
   */
  static async requestPasswordReset(payload: PasswordResetRequest): Promise<ApiResult<{ message: string }>> {
    try {
      const response = await api.post<ApiResponse<{ message: string }>>(
        '/auth/password-reset-request',
        payload
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/password-reset-request',
        method: 'POST',
        additional: { email: payload.email }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 确认密码重置
   */
  static async confirmPasswordReset(payload: PasswordResetConfirmation): Promise<ApiResult<{ success: boolean }>> {
    try {
      const response = await api.post<ApiResponse<{ success: boolean }>>(
        '/auth/password-reset-confirm',
        payload
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/password-reset-confirm',
        method: 'POST'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 验证令牌有效性
   */
  static async verifyToken(token: string): Promise<ApiResult<{ valid: boolean; payload?: any }>> {
    try {
      const response = await api.post<ApiResponse<{ valid: boolean; payload?: any }>>(
        '/auth/verify',
        { token }
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/verify',
        method: 'POST'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 获取用户会话列表
   */
  static async getSessions(): Promise<ApiResult<SessionInfo[]>> {
    try {
      const response = await api.get<ApiResponse<SessionInfo[]>>(
        '/auth/sessions'
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/sessions',
        method: 'GET'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 撤销指定会话
   */
  static async revokeSession(sessionId: string): Promise<ApiResult<void>> {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);

      return {
        success: true,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: `/auth/sessions/${sessionId}`,
        method: 'DELETE',
        additional: { sessionId }
      });

      return {
        success: false,
        error: apiError
      };
    }
  }

  /**
   * 撤销所有会话（除了当前会话）
   */
  static async revokeAllSessions(): Promise<ApiResult<{ revokedCount: number }>> {
    try {
      const response = await api.post<ApiResponse<{ revokedCount: number }>>(
        '/auth/sessions/revoke-all',
        {}
      );

      return {
        success: true,
        data: response.data.data,
        metadata: {
          requestId: response.data.requestId,
          timestamp: response.data.timestamp,
          duration: response.data.metadata?.duration
        }
      };
    } catch (error) {
      const apiError = ApiErrorFactory.fromUnknownError(error);
      ApiErrorHandler.logError(apiError, {
        url: '/auth/sessions/revoke-all',
        method: 'POST'
      });

      return {
        success: false,
        error: apiError
      };
    }
  }
}

// ============================================================================
// 向后兼容的函数式API
// ============================================================================

/**
 * @deprecated 使用 AuthApiService.login 替代
 */
export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  const result = await AuthApiService.login({ username, password });

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AuthApiService.getProfile 替代
 */
export async function profileApi(): Promise<UserInfo> {
  const result = await AuthApiService.getProfile();

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

/**
 * @deprecated 使用 AuthApiService.logout 替代
 */
export async function logoutApi(): Promise<void> {
  const result = await AuthApiService.logout();

  if (!result.success) {
    // 登出失败也不抛出错误，保持向后兼容
    console.warn('Logout failed:', result.error?.message);
  }
}

/**
 * @deprecated 使用 AuthApiService.changePassword 替代
 */
export async function changePasswordApi(oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
  const result = await AuthApiService.changePassword({
    oldPassword,
    newPassword,
    confirmPassword: newPassword
  });

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
