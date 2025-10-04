import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';

const router: Router = Router();
const authController = new AuthController();

/**
 * 认证路由
 * 
 * 所有认证相关的端点
 */

// POST /api/auth/login - 用户登录
router.post('/login', (req, res) => authController.login(req, res));

// POST /api/auth/logout - 用户登出
router.post('/logout', (req, res) => authController.logout(req, res));

// POST /api/auth/refresh - 刷新Token
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

// GET /api/auth/verify - 验证Token
router.get('/verify', (req, res) => authController.verifyToken(req, res));

export default router;
