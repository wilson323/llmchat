import { Request, Response } from 'express';
import { getAuthServiceAdapter } from '@/services/AuthServiceAdapter';
import { logAudit } from '@/middleware/auditMiddleware';
import { AuditAction, AuditStatus, ResourceType } from '@/types/audit';

// 使用适配器，支持V1/V2服务切换
const authService = getAuthServiceAdapter();

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'username/password 必填',
          timestamp: new Date().toISOString(),
        });
      }
      
      // 获取客户端IP（支持代理）
      const ip = req.ip || 
                 (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                 req.socket.remoteAddress;
      
      const result = await authService.login(username, password, ip);
      
      // 记录审计日志 - 登录成功
      await logAudit({
        req,
        action: AuditAction.LOGIN,
        resourceType: ResourceType.USER,
        resourceId: result.user?.id || username,
        details: {
          username,
          role: result.user?.role,
        },
        status: AuditStatus.SUCCESS,
      });
      
      return res.json(result);
    } catch (e: unknown) {
      const error = e as { message?: string };
      
      // 记录审计日志 - 登录失败
      await logAudit({
        req,
        action: AuditAction.LOGIN_FAILED,
        resourceType: ResourceType.USER,
        details: {
          username: req.body?.username,
        },
        status: AuditStatus.FAILURE,
        errorMessage: error?.message || String(e),
      });
      
      // 处理各种认证错误
      if (error?.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: '用户名或密码错误',
          timestamp: new Date().toISOString(),
        });
      }
      if (error?.message === 'ACCOUNT_INACTIVE') {
        return res.status(403).json({
          code: 'ACCOUNT_INACTIVE',
          message: '账号未激活',
          timestamp: new Date().toISOString(),
        });
      }
      if (error?.message?.startsWith('ACCOUNT_LOCKED:')) {
        const minutes = error.message.split(':')[1];
        return res.status(403).json({
          code: 'ACCOUNT_LOCKED',
          message: `账号已锁定，请${minutes}分钟后重试`,
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: '登录失败',
        details: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async profile(req: Request, res: Response) {
    try {
      const auth = req.headers['authorization'];
      const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '缺少令牌', timestamp: new Date().toISOString() });
      }
      const user = await authService.profile(token);
      return res.json({ user });
    } catch (e: any) {
      const code = e?.message === 'TOKEN_EXPIRED' ? 401 : 401;
      return res.status(code).json({
        code: 'UNAUTHORIZED',
        message: e instanceof Error ? e.message : '未授权',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const auth = req.headers['authorization'];
      const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
      if (token) await authService.logout(token);
      
      // 记录审计日志 - 登出成功
      await logAudit({
        req,
        action: AuditAction.LOGOUT,
        resourceType: ResourceType.USER,
        status: AuditStatus.SUCCESS,
      });
      
      return res.json({ ok: true });
    } catch (e) {
      // 即使失败也返回成功（安全考虑）
      return res.json({ ok: true });
    }
  }

  static async changePassword(req: Request, res: Response) {
    try {
      const auth = req.headers['authorization'];
      const token = (auth || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return res.status(401).json({ code: 'UNAUTHORIZED', message: '缺少令牌', timestamp: new Date().toISOString() });
      const { oldPassword, newPassword } = req.body || {};
      if (!oldPassword || !newPassword) return res.status(400).json({ code: 'BAD_REQUEST', message: 'oldPassword/newPassword 必填', timestamp: new Date().toISOString() });
      await authService.changePassword(token, oldPassword, newPassword);
      
      // 记录审计日志
      await logAudit({
        req,
        action: AuditAction.UPDATE,
        resourceType: ResourceType.USER,
        details: { action: 'change_password' },
        status: AuditStatus.SUCCESS,
      });
      
      return res.json({ ok: true, message: '密码修改成功' });
    } catch (e: any) {
      const msg = e?.message;
      if (msg === 'UNAUTHORIZED' || msg === 'TOKEN_EXPIRED') {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
      }
      if (msg === 'INVALID_OLD_PASSWORD') {
        return res.status(400).json({ code: 'INVALID_OLD_PASSWORD', message: '原密码不正确', timestamp: new Date().toISOString() });
      }
      if (msg === 'PASSWORD_TOO_SHORT') {
        return res.status(400).json({ code: 'PASSWORD_TOO_SHORT', message: '密码至少8个字符', timestamp: new Date().toISOString() });
      }
      if (msg === 'PASSWORD_MISSING_UPPERCASE') {
        return res.status(400).json({ code: 'PASSWORD_TOO_WEAK', message: '密码必须包含大写字母', timestamp: new Date().toISOString() });
      }
      if (msg === 'PASSWORD_MISSING_LOWERCASE') {
        return res.status(400).json({ code: 'PASSWORD_TOO_WEAK', message: '密码必须包含小写字母', timestamp: new Date().toISOString() });
      }
      if (msg === 'PASSWORD_MISSING_NUMBER') {
        return res.status(400).json({ code: 'PASSWORD_TOO_WEAK', message: '密码必须包含数字', timestamp: new Date().toISOString() });
      }
      if (msg === 'PASSWORD_MISSING_SPECIAL_CHAR') {
        return res.status(400).json({ code: 'PASSWORD_TOO_WEAK', message: '密码必须包含特殊字符', timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ code: 'INTERNAL_ERROR', message: '修改密码失败', timestamp: new Date().toISOString() });
    }
  }

  /**
   * 刷新Token (仅V2支持)
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body || {};
      if (!refreshToken) {
        return res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'refreshToken 必填',
          timestamp: new Date().toISOString(),
        });
      }

      // 检查是否支持refreshToken
      if (typeof authService.refreshToken !== 'function') {
        return res.status(501).json({
          code: 'NOT_SUPPORTED',
          message: '当前认证服务不支持Token刷新功能，请升级到V2',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await authService.refreshToken(refreshToken);
      
      return res.json(result);
    } catch (e: any) {
      if (e?.message === 'REFRESH_TOKEN_INVALID' || e?.message === 'TokenExpiredError') {
        return res.status(401).json({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh Token无效或已过期',
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Token刷新失败',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

