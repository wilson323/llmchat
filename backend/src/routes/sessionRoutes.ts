import { Router, type Router as RouterType } from 'express';
import { SessionController } from '@/controllers/SessionController';

const router: RouterType = Router();
const sessionController = new SessionController();

/**
 * 会话管理路由
 * 基础路径: /api/sessions
 */

// 获取会话列表（基础版）
router.get('/', (req, res) => {
  res.json({
    code: 200,
    message: 'success',
    data: {
      sessions: [],
      total: 0,
      message: 'Please specify agentId to get sessions',
    },
  });
});

// 增强版会话列表 - 支持分页、过滤、排序
router.get('/:agentId/enhanced', (req, res, next) => {
  sessionController.listSessionsEnhanced(req, res, next).catch(next);
});

// 批量操作会话
router.post('/:agentId/batch', (req, res, next) => {
  sessionController.batchOperation(req, res, next).catch(next);
});

// 导出会话数据
router.post('/:agentId/export', (req, res, next) => {
  sessionController.exportSessions(req, res, next).catch(next);
});

// 获取会话统计信息
router.get('/:agentId/stats', (req, res, next) => {
  sessionController.getSessionStats(req, res, next).catch(next);
});

// 查询会话事件
router.get('/:agentId/events', (req, res, next) => {
  sessionController.queryEvents(req, res, next).catch(next);
});

// 获取会话详情（增强版）
router.get('/:agentId/:sessionId', (req, res, next) => {
  sessionController.getSessionDetail(req, res, next).catch(next);
});

// 删除单个会话
router.delete('/:agentId/:sessionId', (req, res, next) => {
  sessionController.deleteSession(req, res, next).catch(next);
});

export default router;