import type { Request, Response } from 'express';
import logger from '@/utils/logger';
import { AuthServiceV2 } from '@/services/AuthServiceV2';
import { authService } from '@/services/authInstance';
import { toEnhancedError, ExpressErrorHandler } from '@/utils/errorHandler';
import type { AuthenticatedRequest } from '@/middleware/jwtAuth';

// HTTP状态码常量
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// 其他常量
const PASSWORD_MIN_LENGTH = 6;
const BEARER_PREFIX_LENGTH = 7;

// 错误代码常量
const ERROR_CODES = {
  SUCCESS: 'SUCCESS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  AUTH_FAILED: 'AUTH_FAILED',
  LOGIN_ERROR: 'LOGIN_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  VERIFY_ERROR: 'VERIFY_ERROR',
  INVALID_TOKEN: 'INVALID_TOKEN',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_ERROR: 'REFRESH_ERROR',
  LOGOUT_ERROR: 'LOGOUT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  CHANGE_PASSWORD_ERROR: 'CHANGE_PASSWORD_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  REGISTER_ERROR: 'REGISTER_ERROR',
} as const;

// 响应消息常量
const MESSAGES = {
  LOGIN_SUCCESS: '登录成功',
  TOKEN_VALID: 'Token有效',
  TOKEN_REFRESH_SUCCESS: 'Token刷新成功',
  LOGOUT_SUCCESS: '登出成功',
  PASSWORD_CHANGED: '密码修改成功',
  REGISTRATION_SUCCESS: '注册成功',
  EMPTY_CREDENTIALS: '用户名或密码不能为空',
  NO_AUTH_INFO: '未提供认证信息',
  NO_REFRESH_TOKEN: '未提供刷新令牌',
  TOKEN_EXPIRED_MSG: 'Token已过期',
  TOKEN_INVALID_MSG: 'Token无效',
  EMPTY_PASSWORDS: '当前密码和新密码不能为空',
  WEAK_PASSWORD_MSG: '新密码长度至少为6个字符',
  NOT_AUTHENTICATED: '未认证',
  EMPTY_USER_FIELDS: '用户名、邮箱和密码不能为空',
} as const;

// 类型定义
interface LoginRequestBody {
  username?: string;
  password?: string;
}

interface RegisterRequestBody {
  username?: string;
  email?: string;
  password?: string;
}

interface ChangePasswordRequestBody {
  currentPassword?: string;
  newPassword?: string;
}

interface RefreshTokenRequestBody {
  refreshToken?: string;
  token?: string;
}

interface TypedError {
  code?: string;
  message?: string;
}

interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T | null;
  timestamp: string;
}

interface LoginResponseData {
  token: string;
  refreshToken: string;
  user: unknown;
  expiresIn: number;
}

interface TokenValidationData {
  valid: true;
  user: unknown;
}

interface RefreshTokenData {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 认证控制器
 * 职责：处理登录、登出、令牌验证与刷新等认证相关功能。
 * 依赖：AuthServiceV2 提供认证业务逻辑；logger 提供审计日志。
 */
export class AuthController {
  private readonly authService: AuthServiceV2;

  constructor() {
    // 使用单例authService，避免创建多个实例导致Redis连接冲突
    this.authService = authService as AuthServiceV2;
  }

  /**
   * 用户登录
   * 路由: POST /api/auth/login
   * 参数: req.body { username: string, password: string }
   * 返回: 200 { code, message, data: { token, refreshToken, user, expiresIn }, timestamp }
   * 异常: 400 INVALID_CREDENTIALS, 401 AUTH_FAILED, 500 LOGIN_ERROR
   * 使用示例:
   *  curl -X POST http://localhost:3001/api/auth/login \
   *    -H "Content-Type: application/json" \
   *    -d '{"username":"admin","password":"123456"}'
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body as LoginRequestBody;

      if (!username || !password) {
        const response: ApiResponse = {
          code: ERROR_CODES.INVALID_CREDENTIALS,
          message: MESSAGES.EMPTY_CREDENTIALS,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.BAD_REQUEST).json(response);
        return;
      }

      const result = await this.authService.login(username, password);
      logger.info('用户登录成功', {
        user: result.user?.id,
        env: process.env.NODE_ENV ?? 'development',
      });

      const responseData: LoginResponseData = {
        token: result.token,
        refreshToken: result.refreshToken ?? '',
        user: result.user,
        expiresIn: result.expiresIn,
      };

      const response: ApiResponse<LoginResponseData> = {
        code: ERROR_CODES.SUCCESS,
        message: MESSAGES.LOGIN_SUCCESS,
        data: responseData,
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error: unknown) {
      const enhancedError = toEnhancedError(error, {
        operation: 'user_login',
        requestId: req.headers['x-request-id'] as string,
      });

      logger.error('用户登录失败', { error: enhancedError });
      const statusCode = ExpressErrorHandler.getStatusCode(enhancedError);
      const errorResponse = ExpressErrorHandler.createErrorResponse(
        enhancedError,
        req.headers['x-request-id'] as string,
      );

      res.status(statusCode).json(errorResponse);
    }
  }

  /**
   * 令牌验证
   * 路由: GET /api/auth/verify
   * 头部: Authorization: Bearer <token>
   * 返回: 200 { code:'SUCCESS', message:'Token有效', data:{ valid:true, user }, timestamp }
   * 异常: 401 AUTHENTICATION_REQUIRED / TOKEN_INVALID / TOKEN_EXPIRED, 500 VERIFY_ERROR
   * 使用示例:
   *  curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/verify
   */
  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization ?? '';
      if (!authHeader.startsWith('Bearer ')) {
        const response: ApiResponse = {
          code: ERROR_CODES.AUTHENTICATION_REQUIRED,
          message: MESSAGES.NO_AUTH_INFO,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      const token = authHeader.substring(BEARER_PREFIX_LENGTH);
      const result = await this.authService.validateToken(token);

      if (!result.valid) {
        const code = result.error ?? ERROR_CODES.TOKEN_INVALID;
        const message =
          code === ERROR_CODES.TOKEN_EXPIRED
            ? MESSAGES.TOKEN_EXPIRED_MSG
            : MESSAGES.TOKEN_INVALID_MSG;

        const response: ApiResponse = {
          code,
          message,
          data: null,
          timestamp: new Date().toISOString(),
        };

        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      const responseData: TokenValidationData = {
        valid: true,
        user: result.user,
      };

      const response: ApiResponse<TokenValidationData> = {
        code: ERROR_CODES.SUCCESS,
        message: MESSAGES.TOKEN_VALID,
        data: responseData,
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error: unknown) {
      logger.error('Token验证失败', { error });
      const response: ApiResponse = {
        code: ERROR_CODES.VERIFY_ERROR,
        message: error instanceof Error ? error.message : 'Token验证失败',
        data: null,
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * 刷新令牌
   * 路由: POST /api/auth/refresh
   * 参数: req.body.refreshToken 或 Authorization: Bearer <refreshToken>
   * 返回: 200 { code:'SUCCESS', message:'Token刷新成功', data:{ token, refreshToken, expiresIn }, timestamp }
   * 异常: 400 INVALID_TOKEN, 401 REFRESH_TOKEN_INVALID, 500 REFRESH_ERROR
   * 使用示例:
   *  curl -X POST http://localhost:3001/api/auth/refresh \
   *    -H "Content-Type: application/json" \
   *    -d '{"refreshToken":"..."}'
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const requestBody = req.body as RefreshTokenRequestBody;
      const bodyToken = (req.body && (requestBody.refreshToken ?? requestBody.token)) as
        | string
        | undefined;
      const header = req.headers.authorization;
      const bearerToken =
        header && header.startsWith('Bearer ') ? header.substring(BEARER_PREFIX_LENGTH) : undefined;
      const refreshToken = bodyToken ?? bearerToken;

      if (!refreshToken) {
        const response: ApiResponse = {
          code: ERROR_CODES.INVALID_TOKEN,
          message: MESSAGES.NO_REFRESH_TOKEN,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.BAD_REQUEST).json(response);
        return;
      }

      const result = await this.authService.refreshToken(refreshToken);
      logger.info('Token刷新成功');

      const responseData: RefreshTokenData = {
        token: result.token,
        refreshToken: result.refreshToken ?? '',
        expiresIn: result.expiresIn,
      };

      const response: ApiResponse<RefreshTokenData> = {
        code: ERROR_CODES.SUCCESS,
        message: MESSAGES.TOKEN_REFRESH_SUCCESS,
        data: responseData,
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error: unknown) {
      logger.error('Token刷新失败', { error });
      const typedError = error as TypedError;
      const statusCode =
        typedError?.code === ERROR_CODES.REFRESH_TOKEN_INVALID
          ? HTTP_STATUS.UNAUTHORIZED
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      const response: ApiResponse = {
        code: typedError?.code ?? ERROR_CODES.REFRESH_ERROR,
        message: typedError?.message ?? 'Token刷新失败',
        data: null,
        timestamp: new Date().toISOString(),
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * 登出
   * 路由: POST /api/auth/logout
   * 参数: Authorization: Bearer <token>（可选）
   * 返回: 200 { code:'SUCCESS', message:'登出成功', data:null, timestamp }
   * 异常: 401 AUTHENTICATION_REQUIRED, 500 LOGOUT_ERROR
   * 使用示例:
   *  curl -X POST http://localhost:3001/api/auth/logout \
   *    -H "Authorization: Bearer <token>"
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(BEARER_PREFIX_LENGTH) : undefined;

      if (!token) {
        const response: ApiResponse = {
          code: ERROR_CODES.AUTHENTICATION_REQUIRED,
          message: MESSAGES.NO_AUTH_INFO,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      await this.authService.logout(token);
      logger.info('用户登出成功');

      const response: ApiResponse = {
        code: ERROR_CODES.SUCCESS,
        message: MESSAGES.LOGOUT_SUCCESS,
        data: null,
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error: unknown) {
      logger.error('用户登出失败', { error });
      const typedError = error as TypedError;
      const statusCode =
        typedError?.code === ERROR_CODES.AUTHENTICATION_REQUIRED
          ? HTTP_STATUS.UNAUTHORIZED
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      const response: ApiResponse = {
        code: typedError?.code ?? ERROR_CODES.LOGOUT_ERROR,
        message: typedError?.message ?? '登出失败',
        data: null,
        timestamp: new Date().toISOString(),
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * 修改密码
   * 路由: POST /api/auth/change-password
   * 参数: req.body.currentPassword, req.body.newPassword
   * 返回: 200 { code:'SUCCESS', message:'密码修改成功', data:null, timestamp }
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as ChangePasswordRequestBody;

      if (!currentPassword || !newPassword) {
        const response: ApiResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: MESSAGES.EMPTY_PASSWORDS,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.BAD_REQUEST).json(response);
        return;
      }

      if (newPassword.length < PASSWORD_MIN_LENGTH) {
        const response: ApiResponse = {
          code: ERROR_CODES.WEAK_PASSWORD,
          message: MESSAGES.WEAK_PASSWORD_MSG,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.BAD_REQUEST).json(response);
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        const response: ApiResponse = {
          code: ERROR_CODES.AUTHENTICATION_REQUIRED,
          message: MESSAGES.NOT_AUTHENTICATED,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.UNAUTHORIZED).json(response);
        return;
      }

      // 调用AuthServiceV2修改密码（需要实现该方法）
      await this.authService.changePassword(userId, currentPassword, newPassword);

      const response: ApiResponse = {
        code: ERROR_CODES.SUCCESS,
        message: MESSAGES.PASSWORD_CHANGED,
        data: null,
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.OK).json(response);
    } catch (error: unknown) {
      logger.error('修改密码失败', { error });
      const typedError = error as TypedError;
      const statusCode =
        typedError?.code === ERROR_CODES.INVALID_CREDENTIALS
          ? HTTP_STATUS.BAD_REQUEST
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      const response: ApiResponse = {
        code: typedError?.code ?? ERROR_CODES.CHANGE_PASSWORD_ERROR,
        message: typedError?.message ?? '密码修改失败',
        data: null,
        timestamp: new Date().toISOString(),
      };

      res.status(statusCode).json(response);
    }
  }

  /**
   * 用户注册
   * 路由: POST /api/auth/register
   * 参数: req.body { username: string, email: string, password: string }
   * 返回: 201 { code, message, data: { user }, timestamp }
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password } = req.body as RegisterRequestBody;

      if (!username || !email || !password) {
        const response: ApiResponse = {
          code: ERROR_CODES.INVALID_INPUT,
          message: MESSAGES.EMPTY_USER_FIELDS,
          data: null,
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS.BAD_REQUEST).json(response);
        return;
      }

      // 调用register方法（需要在AuthServiceV2中实现）
      const user = await this.authService.register(username, email, password);

      const response: ApiResponse<{ user: unknown }> = {
        code: ERROR_CODES.SUCCESS,
        message: MESSAGES.REGISTRATION_SUCCESS,
        data: { user },
        timestamp: new Date().toISOString(),
      };

      res.status(HTTP_STATUS.CREATED).json(response);
    } catch (error: unknown) {
      logger.error('用户注册失败', { error });
      const typedError = error as TypedError;
      const statusCode =
        typedError?.code === ERROR_CODES.USER_ALREADY_EXISTS
          ? HTTP_STATUS.CONFLICT
          : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      const response: ApiResponse = {
        code: typedError?.code ?? ERROR_CODES.REGISTER_ERROR,
        message: typedError?.message ?? '注册失败',
        data: null,
        timestamp: new Date().toISOString(),
      };

      res.status(statusCode).json(response);
    }
  }
}