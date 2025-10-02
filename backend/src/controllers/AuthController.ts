import { Request, Response } from 'express';
import { authService } from '@/services/authInstance';
import { logAudit } from '@/middleware/auditMiddleware';
import { AuditAction, AuditStatus, ResourceType } from '@/types/audit';

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
      const result = await authService.login(username, password);
      
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
      
      if (error?.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: '用户名或密码错误',
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
      return res.json({ ok: true });
    } catch (e: any) {
      const msg = e?.message;
      if (msg === 'UNAUTHORIZED' || msg === 'TOKEN_EXPIRED') {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '未授权', timestamp: new Date().toISOString() });
      }
      if (msg === 'INVALID_OLD_PASSWORD') {
        return res.status(400).json({ code: 'INVALID_OLD_PASSWORD', message: '原密码不正确', timestamp: new Date().toISOString() });
      }
      return res.status(500).json({ code: 'INTERNAL_ERROR', message: '修改密码失败', timestamp: new Date().toISOString() });
    }
  }
}

