/**
 * 聊天会话管理路由
 * 提供会话CRUD、搜索等API
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { chatSessionService, type CreateSessionParams } from '@/services/ChatSessionService';
import { authenticateJWT } from '@/middleware/jwtAuth';

// 常量定义，避免魔法数字
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
} as const;

const DEFAULT_LIMIT = 20;

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username?: string;
    role?: string;
  };
  requestId?: string;
}

const router: express.Router = express.Router();

/**
 * 获取用户的所有会话
 * GET /api/chat-sessions?agentId=xxx
 */
router.get('/', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const agentId = req.query.agentId as string | undefined;
    const sessions = await chatSessionService.getUserSessions(userId, agentId);

    return res.json({
      code: 'OK',
      data: sessions,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 创建新会话
 * POST /api/chat-sessions
 * Body: { agentId: string, title?: string, context?: object, settings?: object }
 */
router.post('/', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const { agentId, title, context, settings } = req.body;

    if (!agentId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: 'MISSING_AGENT_ID',
        message: 'Agent ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    const params: CreateSessionParams = {
      userId,
      agentId,
      title: title as string | undefined,
      context: context as Record<string, unknown> | undefined,
      settings: settings as Record<string, unknown> | undefined,
    };

    const session = await chatSessionService.createSession(params);

    return res.status(HTTP_STATUS.CREATED).json({
      code: 'CREATED',
      data: session,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 获取单个会话详情
 * GET /api/chat-sessions/:id
 */
router.get('/:id', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 'BAD_REQUEST', message: 'Session ID required' });
    }
    const session = await chatSessionService.getSession(sessionId, userId);

    if (!session) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      code: 'OK',
      data: session,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 更新会话标题
 * PATCH /api/chat-sessions/:id/title
 * Body: { title: string }
 */
router.patch('/:id/title', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 'BAD_REQUEST', message: 'Session ID required' });
    }
    const { title } = req.body;

    if (!title) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: 'MISSING_TITLE',
        message: 'Title is required',
        timestamp: new Date().toISOString(),
      });
    }

    await chatSessionService.updateSessionTitle(sessionId, userId, title);

    return res.json({
      code: 'OK',
      data: { sessionId, title, updated: true },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 删除会话（软删除）
 * DELETE /api/chat-sessions/:id
 */
router.delete('/:id', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 'BAD_REQUEST', message: 'Session ID required' });
    }
    await chatSessionService.deleteSession(sessionId, userId);

    return res.json({
      code: 'OK',
      data: { sessionId, deleted: true },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 归档会话
 * POST /api/chat-sessions/:id/archive
 */
router.post('/:id/archive', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const sessionId = req.params.id;
    if (!sessionId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 'BAD_REQUEST', message: 'Session ID required' });
    }
    await chatSessionService.archiveSession(sessionId, userId);

    return res.json({
      code: 'OK',
      data: { sessionId, archived: true },
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 搜索会话
 * GET /api/chat-sessions/search?q=keyword&limit=20
 */
router.get('/search', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

    if (!query) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: 'MISSING_QUERY',
        message: 'Search query is required',
        timestamp: new Date().toISOString(),
      });
    }

    const sessions = await chatSessionService.searchSessions(userId, query, limit);

    return res.json({
      code: 'OK',
      data: sessions,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * 获取会话统计
 * GET /api/chat-sessions/stats
 */
router.get('/stats', authenticateJWT(), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
        timestamp: new Date().toISOString(),
      });
    }

    const stats = await chatSessionService.getSessionStats(userId);

    return res.json({
      code: 'OK',
      data: stats,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
