/**
 * 聊天会话管理路由
 * 提供会话CRUD、搜索等API
 */

import express, { Request, Response, NextFunction } from 'express';
import { chatSessionService, CreateSessionParams } from '@/services/ChatSessionService';
import { jwtAuth } from '@/middleware/jwtAuth';
import logger from '@/utils/logger';

const router = express.Router();

/**
 * 获取用户的所有会话
 * GET /api/chat-sessions?agentId=xxx
 */
router.get('/', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const agentId = req.query.agentId as string | undefined;
    const sessions = await chatSessionService.getUserSessions(userId, agentId);

    res.json({
      code: 'OK',
      data: sessions,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 创建新会话
 * POST /api/chat-sessions
 * Body: { agentId: string, title?: string, context?: object, settings?: object }
 */
router.post('/', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const { agentId, title, context, settings } = req.body;

    if (!agentId) {
      return res.status(400).json({
        code: 'MISSING_AGENT_ID',
        message: 'Agent ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const params: CreateSessionParams = {
      userId,
      agentId,
      title,
      context,
      settings,
    };

    const session = await chatSessionService.createSession(params);

    res.status(201).json({
      code: 'CREATED',
      data: session,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 获取单个会话详情
 * GET /api/chat-sessions/:id
 */
router.get('/:id', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    const session = await chatSessionService.getSession(sessionId, userId);

    if (!session) {
      return res.status(404).json({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      code: 'OK',
      data: session,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 更新会话标题
 * PATCH /api/chat-sessions/:id/title
 * Body: { title: string }
 */
router.patch('/:id/title', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        code: 'MISSING_TITLE',
        message: 'Title is required',
        timestamp: new Date().toISOString(),
      });
    }

    await chatSessionService.updateSessionTitle(sessionId, userId, title);

    res.json({
      code: 'OK',
      data: { sessionId, title, updated: true },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 删除会话（软删除）
 * DELETE /api/chat-sessions/:id
 */
router.delete('/:id', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    await chatSessionService.deleteSession(sessionId, userId);

    res.json({
      code: 'OK',
      data: { sessionId, deleted: true },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 归档会话
 * POST /api/chat-sessions/:id/archive
 */
router.post('/:id/archive', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    await chatSessionService.archiveSession(sessionId, userId);

    res.json({
      code: 'OK',
      data: { sessionId, archived: true },
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 搜索会话
 * GET /api/chat-sessions/search?q=keyword&limit=20
 */
router.get('/search', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      return res.status(400).json({
        code: 'MISSING_QUERY',
        message: 'Search query is required',
        timestamp: new Date().toISOString(),
      });
    }

    const sessions = await chatSessionService.searchSessions(userId, query, limit);

    res.json({
      code: 'OK',
      data: sessions,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 获取会话统计
 * GET /api/chat-sessions/stats
 */
router.get('/stats', jwtAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const stats = await chatSessionService.getSessionStats(userId);

    res.json({
      code: 'OK',
      data: stats,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

