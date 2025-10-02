import { Router } from 'express';
import { auditController } from '@/controllers/AuditController';
import { adminGuard } from '@/middleware/adminGuard';

const router = Router();

/**
 * 审计日志路由
 * 
 * 所有审计接口都需要管理员权限
 */

// 查询审计日志
router.get('/logs', adminGuard, auditController.query.bind(auditController));

// 获取用户审计日志
router.get('/users/:userId', adminGuard, auditController.getUserLogs.bind(auditController));

// 获取资源审计日志
router.get('/resources/:resourceType/:resourceId', adminGuard, auditController.getResourceLogs.bind(auditController));

// 获取最近的审计日志
router.get('/recent', adminGuard, auditController.getRecentLogs.bind(auditController));

// 获取失败的审计日志
router.get('/failures', adminGuard, auditController.getFailedLogs.bind(auditController));

// 导出审计日志
router.get('/export', adminGuard, auditController.exportLogs.bind(auditController));

// 获取审计统计信息
router.get('/statistics', adminGuard, auditController.getStatistics.bind(auditController));

export default router;

