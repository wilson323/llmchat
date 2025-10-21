import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';
// 简化模式：使用基础express-rate-limit替代复杂的rateLimiterV2
import rateLimit from 'express-rate-limit';

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 5次登录尝试
  message: '登录尝试过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
import { authenticateJWT } from '@/middleware/jwtAuth';

const router: Router = Router();
const authController = new AuthController();

/**
 * 认证路由
 *
 * 所有认证相关的端点
 */

// POST /api/auth/login - 用户登录
router.post('/login', loginRateLimiter, (req, res, next) => {
  authController.login(req, res, next).catch(next);
});

// POST /api/auth/logout - 用户登出
router.post('/logout', authenticateJWT(), (req, res, next) => {
  authController.logout(req, res, next).catch(next);
});

// POST /api/auth/refresh - 刷新Token
router.post('/refresh', authenticateJWT(), (req, res, next) => {
  authController.refreshToken(req, res, next).catch(next);
});

// GET /api/auth/verify - 验证Token
router.get('/verify', authenticateJWT(), (req, res, next) => {
  authController.verifyToken(req, res, next).catch(next);
});

// POST /api/auth/change-password - 修改密码
router.post('/change-password', authenticateJWT(), (req, res, next) => {
  authController.changePassword(req, res, next).catch(next);
});

export default router;
