import { Router, type Router as RouterType } from 'express';
import { ChatController } from '@/controllers/ChatController';

const router: RouterType = Router();
const chatController = new ChatController();

// 发送聊天请求（支持流式和非流式）
// POST /api/chat/completions
router.post('/completions', (req, res, next) => {
  chatController.chatCompletions(req, res, next).catch(next);
});

// 发送消息别名路由（向后兼容测试）
// POST /api/chat/messages
router.post('/messages', (req, res, next) => {
  chatController.chatCompletions(req, res, next).catch(next);
});

// 聊天初始化路由
router.get('/init', (req, res, next) => {
  chatController.chatInit(req, res, next).catch(next);
});

// 获取聊天历史列表 & 详情
router.get('/history', (req, res, next) => {
  chatController.listChatHistories(req, res, next).catch(next);
});
router.get('/history/:chatId', (req, res, next) => {
  chatController.getChatHistory(req, res, next).catch(next);
});
router.get('/sessions/:sessionId/messages', (req, res, next) => {
  chatController.getSessionMessages(req, res, next).catch(next);
});

// 删除/清空聊天历史
router.delete('/history/:chatId', (req, res, next) => {
  chatController.deleteChatHistory(req, res, next).catch(next);
});
router.delete('/history', (req, res, next) => {
  chatController.clearChatHistories(req, res, next).catch(next);
});

// 重新生成指定消息
router.post('/history/:chatId/retry', (req, res, next) => {
  chatController.retryChatMessage(req, res, next).catch(next);
});

// 点赞/点踩反馈
// POST /api/chat/feedback
router.post('/feedback', (req, res, next) => {
  chatController.updateUserFeedback(req, res, next).catch(next);
});

// 上传附件（文件/语音）
router.post('/attachments', (req, res, next) => {
  chatController.uploadAttachment(req, res, next).catch(next);
});

export default router;
export { router as chatRoutes };
