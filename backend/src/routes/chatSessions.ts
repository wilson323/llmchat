import { Router } from 'express';
import { ChatSessionController } from '@/controllers/ChatSessionController';
import { authenticateJWT } from '@/middleware/jwtAuth';

const router: Router = Router();
const chatSessionController = new ChatSessionController();

// 应用认证中间件
router.use(authenticateJWT());

/**
 * @route GET /api/chat/histories
 * @desc 获取聊天历史列表
 * @access Private
 */
router.get('/histories', chatSessionController.listChatHistories);

/**
 * @route GET /api/chat/histories/:sessionId
 * @desc 获取特定会话的聊天历史
 * @access Private
 */
router.get('/histories/:sessionId', chatSessionController.getChatHistory);

/**
 * @route DELETE /api/chat/histories/:sessionId
 * @desc 删除特定会话的聊天历史
 * @access Private
 */
router.delete('/histories/:sessionId', chatSessionController.deleteChatHistory);

/**
 * @route DELETE /api/chat/histories
 * @desc 清空所有聊天历史
 * @access Private
 */
router.delete('/histories', chatSessionController.clearChatHistories);

/**
 * @route GET /api/chat/sessions/:sessionId/messages
 * @desc 获取会话消息
 * @access Private
 */
router.get('/sessions/:sessionId/messages', chatSessionController.getSessionMessages);

export default router;