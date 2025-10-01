import { Router } from 'express';
import { SessionController } from '@/controllers/SessionController';

const router = Router();
const sessionController = new SessionController();

/**
 * 会话管理路由
 * 基础路径: /api/sessions
 */

// 增强版会话列表 - 支持分页、过滤、排序
router.get('/:agentId/enhanced', sessionController.listSessionsEnhanced);

// 批量操作会话
router.post('/:agentId/batch', sessionController.batchOperation);

// 导出会话数据
router.post('/:agentId/export', sessionController.exportSessions);

// 获取会话统计信息
router.get('/:agentId/stats', sessionController.getSessionStats);

// 查询会话事件
router.get('/:agentId/events', sessionController.queryEvents);

// 获取会话详情（增强版）
router.get('/:agentId/:sessionId', sessionController.getSessionDetail);

// 删除单个会话
router.delete('/:agentId/:sessionId', sessionController.deleteSession);

export default router;