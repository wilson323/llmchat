import { Router } from 'express';
import { ChatInitController } from '@/controllers/ChatInitController';
import { authenticateJWT } from '@/middleware/jwtAuth';

const router: Router = Router();
const chatInitController = new ChatInitController();

// 应用认证中间件
router.use(authenticateJWT());

/**
 * @route GET /api/chat/init
 * @desc 初始化聊天会话
 * @access Private
 */
router.get('/init', chatInitController.chatInit);

/**
 * @route GET /api/chat/sessions/:sessionId/status
 * @desc 获取聊天会话状态
 * @access Private
 */
router.get('/sessions/:sessionId/status', chatInitController.getChatSessionStatus);

/**
 * @route PUT /api/chat/sessions/:sessionId/config
 * @desc 更新聊天会话配置
 * @access Private
 */
router.put('/sessions/:sessionId/config', chatInitController.updateChatSessionConfig);

export default router;