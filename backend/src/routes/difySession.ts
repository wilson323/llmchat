import { Router } from 'express';
import { DifySessionController } from '@/controllers/DifySessionController';

const router = Router();

/**
 * Dify 会话管理路由
 * 
 * 所有路由需要提供 agentId 查询参数
 */

// 获取会话列表
router.get('/conversations', DifySessionController.getConversations);

// 获取会话消息
router.get('/messages', DifySessionController.getMessages);

// 获取消息详情
router.get('/messages/:messageId', DifySessionController.getMessageDetail);

// 删除会话
router.delete('/conversations/:conversationId', DifySessionController.deleteConversation);

// 提交消息反馈
router.post('/messages/:messageId/feedback', DifySessionController.submitFeedback);

// 获取建议问题
router.get('/messages/:messageId/suggested', DifySessionController.getSuggestedQuestions);

export default router;

