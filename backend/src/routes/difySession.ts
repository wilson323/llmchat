import { Router, type Router as RouterType } from 'express';
import { DifySessionController } from '@/controllers/DifySessionController';

const router: RouterType = Router();

/**
 * Dify 会话管理路由
 *
 * 所有路由需要提供 agentId 查询参数
 */

// 获取会话列表
router.get('/conversations', (req, res, next) => {
  DifySessionController.getConversations(req, res, next).catch(next);
});

// 获取会话消息
router.get('/messages', (req, res, next) => {
  DifySessionController.getMessages(req, res, next).catch(next);
});

// 获取消息详情
router.get('/messages/:messageId', (req, res, next) => {
  DifySessionController.getMessageDetail(req, res, next).catch(next);
});

// 删除会话
router.delete('/conversations/:conversationId', (req, res, next) => {
  DifySessionController.deleteConversation(req, res, next).catch(next);
});

// 提交消息反馈
router.post('/messages/:messageId/feedback', (req, res, next) => {
  DifySessionController.submitFeedback(req, res, next).catch(next);
});

// 获取建议问题
router.get('/messages/:messageId/suggested', (req, res, next) => {
  DifySessionController.getSuggestedQuestions(req, res, next).catch(next);
});

export default router;
