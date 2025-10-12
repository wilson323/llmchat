import { Router } from 'express';
import { ChatMessageController } from '@/controllers/ChatMessageController';
import { authenticateJWT } from '@/middleware/jwtAuth';

const router: Router = Router();
const chatMessageController = new ChatMessageController();

// 应用认证中间件
router.use(authenticateJWT());

/**
 * @route POST /api/chat/completions
 * @desc 处理聊天完成请求
 * @access Private
 */
router.post('/completions', chatMessageController.chatCompletions);

/**
 * @route POST /api/chat/feedback
 * @desc 更新用户反馈
 * @access Private
 */
router.post('/feedback', chatMessageController.updateUserFeedback);

/**
 * @route POST /api/chat/retry
 * @desc 重试聊天消息
 * @access Private
 */
router.post('/retry', chatMessageController.retryChatMessage);

export default router;