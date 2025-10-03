import { Router, type Router as RouterType } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { loginRateLimiter } from '@/middleware/rateLimiterV2';

export const authRoutes: RouterType = Router();

// 登录接口（应用速率限制防止暴力破解）
authRoutes.post('/login', loginRateLimiter, AuthController.login);

// Token刷新接口（V2功能）
authRoutes.post('/refresh-token', AuthController.refreshToken);

// 用户信息接口
authRoutes.get('/profile', AuthController.profile);

// 登出接口
authRoutes.post('/logout', AuthController.logout);

// 修改密码接口
authRoutes.post('/change-password', AuthController.changePassword);

