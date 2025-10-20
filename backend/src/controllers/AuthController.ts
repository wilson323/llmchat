import type { Request, Response } from 'express'; // [L1]
import logger from '@/utils/logger'; // [L2]
import { AuthServiceV2 } from '@/services/AuthServiceV2'; // [L3]
import { authService } from '@/services/authInstance'; // [L3.5] 🔧 修复：导入单例实例
import { toEnhancedError, ExpressErrorHandler } from '@/utils/errorHandler'; // [L4]
import type { AuthenticatedRequest } from '@/middleware/jwtAuth';

/**
 * 认证控制器
 * 职责：处理登录、登出、令牌验证与刷新等认证相关功能。
 * 依赖：AuthServiceV2 提供认证业务逻辑；logger 提供审计日志。
 */ // [L9]
export class AuthController { // [L10]
  private readonly authService: AuthServiceV2; // [L11]

  constructor() { // [L13]
    // 🔧 修复：使用单例authService，避免创建多个实例导致Redis连接冲突
    this.authService = authService as AuthServiceV2; // [L14]
  } // [L15]

  /**
   * 用户登录
   * 路由: POST /api/auth/login
   * 参数: req.body { username: string, password: string }
   * 返回: 200 { code, message, data: { token, refreshToken, user, expiresIn }, timestamp }
   * 异常: 400 INVALID_CREDENTIALS, 401 AUTH_FAILED, 500 LOGIN_ERROR
   * 使用示例:
   *  curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"123456"}'
   */ // [L24]
  async login(req: Request, res: Response): Promise<void> { // [L25]
    try { // [L26]
      const { username, password } = req.body as { username?: string; password?: string }; // [L27]

      if (!username || !password) { // [L29]
        res.status(400).json({ // [L30]
          code: 'INVALID_CREDENTIALS', // [L31]
          message: '用户名或密码不能为空', // [L32]
          data: null, // [L33]
          timestamp: new Date().toISOString(), // [L34]
        }); // [L35]
        return; // [L36]
      } // [L37]

      const result = await this.authService.login(username, password); // [L39]
      logger.info('用户登录成功', { user: result.user?.id, env: process.env.NODE_ENV ?? 'development' }); // [L40]

      res.status(200).json({ // [L42]
        code: 'SUCCESS', // [L43]
        message: '登录成功', // [L44]
        data: { // [L45]
          token: result.token, // [L46]
          refreshToken: result.refreshToken, // [L47]
          user: result.user, // [L48]
          expiresIn: result.expiresIn, // [L49]
        }, // [L50]
        timestamp: new Date().toISOString(), // [L51]
      }); // [L52]
    } catch (error: unknown) { // [L53]
      const enhancedError = toEnhancedError(error, {
        operation: 'user_login',
        requestId: req.headers['x-request-id'] as string
      }); // [L54]

      logger.error('用户登录失败', { error: enhancedError }); // [L55]
      const statusCode = ExpressErrorHandler.getStatusCode(enhancedError); // [L56]
      const errorResponse = ExpressErrorHandler.createErrorResponse(enhancedError, req.headers['x-request-id'] as string); // [L57]

      res.status(statusCode).json(errorResponse); // [L58]
    } // [L59]
  } // [L63]

  // TRACE-auth-20251005-认证路径统一JSON响应 // [L65]

  /**
   * 令牌验证
   * 路由: GET /api/auth/verify
   * 头部: Authorization: Bearer <token>
   * 返回: 200 { code:'SUCCESS', message:'Token有效', data:{ valid:true, user }, timestamp }
   * 异常: 401 AUTHENTICATION_REQUIRED / TOKEN_INVALID / TOKEN_EXPIRED, 500 VERIFY_ERROR
   * 使用示例:
   *  curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/verify
   */ // [L74]
  async verifyToken(req: Request, res: Response): Promise<void> { // [L75]
    try { // [L76]
      const authHeader = req.headers.authorization ?? ''; // [L77]
      if (!authHeader.startsWith('Bearer ')) { // [L78]
        res.status(401).json({ // [L79]
          code: 'AUTHENTICATION_REQUIRED', // [L80]
          message: '未提供认证信息', // [L81]
          data: null, // [L82]
          timestamp: new Date().toISOString(), // [L83]
        }); // [L84]
        return; // [L85]
      } // [L86]

      const token = authHeader.substring(7); // [L88]
      const result = await this.authService.validateToken(token); // [L89]

      if (!result.valid) { // [L91]
        const code = result.error ?? 'TOKEN_INVALID'; // [L92]
        const message = code === 'TOKEN_EXPIRED' ? 'Token已过期' : 'Token无效'; // [L93]
        res.status(401).json({ // [L94]
          code, // [L95]
          message, // [L96]
          data: null, // [L97]
          timestamp: new Date().toISOString(), // [L98]
        }); // [L99]
        return; // [L100]
      } // [L101]

      res.status(200).json({ // [L103]
        code: 'SUCCESS', // [L104]
        message: 'Token有效', // [L105]
        data: { valid: true, user: result.user }, // [L106]
        timestamp: new Date().toISOString(), // [L107]
      }); // [L108]
    } catch (error: unknown) { // [L109]
      logger.error('Token验证失败', { error }); // [L110]
      res.status(500).json({ // [L111]
        code: 'VERIFY_ERROR', // [L112]
        message: error instanceof Error ? error.message : 'Token验证失败', // [L113]
        data: null, // [L114]
        timestamp: new Date().toISOString(), // [L115]
      }); // [L116]
    } // [L117]
  } // [L118]

  /**
   * 刷新令牌
   * 路由: POST /api/auth/refresh
   * 参数: req.body.refreshToken 或 Authorization: Bearer <refreshToken>
   * 返回: 200 { code:'SUCCESS', message:'Token刷新成功', data:{ token, refreshToken, expiresIn }, timestamp }
   * 异常: 400 INVALID_TOKEN, 401 REFRESH_TOKEN_INVALID, 500 REFRESH_ERROR
   * 使用示例:
   *  curl -X POST http://localhost:3001/api/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"..."}'
   */ // [L127]
  async refreshToken(req: Request, res: Response): Promise<void> { // [L128]
    try { // [L129]
      const bodyToken = (req.body && (req.body.refreshToken || req.body.token)) as string | undefined; // [L130]
      const header = req.headers.authorization; // [L131]
      const bearerToken = header && header.startsWith('Bearer ') ? header.substring(7) : undefined; // [L132]
      const refreshToken = bodyToken ?? bearerToken; // [L133]

      if (!refreshToken) { // [L135]
        res.status(400).json({ // [L136]
          code: 'INVALID_TOKEN', // [L137]
          message: '未提供刷新令牌', // [L138]
          data: null, // [L139]
          timestamp: new Date().toISOString(), // [L140]
        }); // [L141]
        return; // [L142]
      } // [L143]

      const result = await this.authService.refreshToken(refreshToken); // [L145]
      logger.info('Token刷新成功'); // [L146]

      res.status(200).json({ // [L148]
        code: 'SUCCESS', // [L149]
        message: 'Token刷新成功', // [L150]
        data: { token: result.token, refreshToken: result.refreshToken, expiresIn: result.expiresIn }, // [L151]
        timestamp: new Date().toISOString(), // [L152]
      }); // [L153]
    } catch (error: unknown) { // [L154]
      logger.error('Token刷新失败', { error }); // [L155]
      const typedError = error as {code?: string; message?: string};
      const statusCode = typedError?.code === 'REFRESH_TOKEN_INVALID' ? 401 : 500; // [L156]
      res.status(statusCode).json({ // [L157]
        code: typedError?.code ?? 'REFRESH_ERROR', // [L158]
        message: typedError?.message ?? 'Token刷新失败', // [L159]
        data: null, // [L160]
        timestamp: new Date().toISOString(), // [L161]
      }); // [L162]
    } // [L163]
  } // [L164]

  // TRACE-auth-20251005-认证刷新路径一致性 // [L166]

  /**
   * 登出
   * 路由: POST /api/auth/logout
   * 参数: Authorization: Bearer <token>（可选）
   * 返回: 200 { code:'SUCCESS', message:'登出成功', data:null, timestamp }
   * 异常: 401 AUTHENTICATION_REQUIRED, 500 LOGOUT_ERROR
   * 使用示例:
   *  curl -X POST http://localhost:3001/api/auth/logout -H "Authorization: Bearer <token>"
   */ // [L175]
  async logout(req: Request, res: Response): Promise<void> { // [L176]
    try { // [L177]
      const authHeader = req.headers.authorization ?? ''; // [L178]
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined; // [L179]

      if (!token) {
        res.status(401).json({
          code: 'AUTHENTICATION_REQUIRED',
          message: '未提供认证信息',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.authService.logout(token); // [L181]
      logger.info('用户登出成功'); // [L182]

      res.status(200).json({ // [L184]
        code: 'SUCCESS', // [L185]
        message: '登出成功', // [L186]
        data: null, // [L187]
        timestamp: new Date().toISOString(), // [L188]
      }); // [L189]
    } catch (error: unknown) { // [L190]
      logger.error('用户登出失败', { error }); // [L191]
      const typedError = error as {code?: string; message?: string};
      const statusCode = typedError?.code === 'AUTHENTICATION_REQUIRED' ? 401 : 500; // [L192]
      res.status(statusCode).json({ // [L193]
        code: typedError?.code ?? 'LOGOUT_ERROR', // [L194]
        message: typedError?.message ?? '登出失败', // [L195]
        data: null, // [L196]
        timestamp: new Date().toISOString(), // [L197]
      }); // [L198]
    } // [L199]
  } // [L200]

  /**
   * 修改密码
   * 路由: POST /api/auth/change-password
   * 参数: req.body.currentPassword, req.body.newPassword
   * 返回: 200 { code:'SUCCESS', message:'密码修改成功', data:null, timestamp }
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: '当前密码和新密码不能为空',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          code: 'WEAK_PASSWORD',
          message: '新密码长度至少为6个字符',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({
          code: 'AUTHENTICATION_REQUIRED',
          message: '未认证',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // ✅ 调用AuthServiceV2修改密码（需要实现该方法）
      await this.authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        code: 'SUCCESS',
        message: '密码修改成功',
        data: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('修改密码失败', { error });
      const typedError = error as {code?: string; message?: string};
      const statusCode = typedError?.code === 'INVALID_CREDENTIALS' ? 400 : 500;
      res.status(statusCode).json({
        code: typedError?.code ?? 'CHANGE_PASSWORD_ERROR',
        message: typedError?.message ?? '密码修改失败',
        data: null,
        timestamp: new Date().toISOString(),
      });
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
      const { username, email, password } = req.body as {
        username?: string;
        email?: string;
        password?: string;
      };

      if (!username || !email || !password) {
        res.status(400).json({
          code: 'INVALID_INPUT',
          message: '用户名、邮箱和密码不能为空',
          data: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 调用register方法（需要在AuthServiceV2中实现）
      const user = await this.authService.register(username, email, password);

      res.status(201).json({
        code: 'SUCCESS',
        message: '注册成功',
        data: { user },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('用户注册失败', { error });
      const typedError = error as {code?: string; message?: string};
      const statusCode = typedError?.code === 'USER_ALREADY_EXISTS' ? 409 : 500;
      res.status(statusCode).json({
        code: typedError?.code ?? 'REGISTER_ERROR',
        message: typedError?.message ?? '注册失败',
        data: null,
        timestamp: new Date().toISOString(),
      });
    }
  }
} // [L201]