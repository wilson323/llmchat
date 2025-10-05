import { Router, type Router as RouterType } from 'express';
import { AdminController } from '@/controllers/AdminController';
import { authenticateJWT } from '@/middleware/jwtAuth';
import { adminGuard } from '@/middleware/adminGuard';

export const adminRoutes: RouterType = Router();

// 所有 admin 路由都需要 JWT 认证 + 管理员权限
adminRoutes.use(authenticateJWT());
adminRoutes.use(adminGuard());

adminRoutes.get('/system-info', AdminController.systemInfo);
adminRoutes.get('/users', AdminController.users);
adminRoutes.post('/users/create', AdminController.createUser);
adminRoutes.post('/users/update', AdminController.updateUser);
adminRoutes.post('/users/reset-password', AdminController.resetUserPassword);
adminRoutes.get('/logs', AdminController.logs);
adminRoutes.get('/logs/export', AdminController.logsExport);
adminRoutes.get('/analytics/province-heatmap', AdminController.provinceHeatmap);
adminRoutes.get('/analytics/conversations/series', AdminController.conversationSeries);
adminRoutes.get('/analytics/conversations/agents', AdminController.conversationAgents);

