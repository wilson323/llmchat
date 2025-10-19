import { Router, type Request, type Response } from 'express';
import {
  getConfigHealth,
  compareConfigSnapshot,
  cleanupObsoleteConfigs,
  getConfigDetails,
  getAdminStats,
  getAdminMetrics,
} from '@/controllers/AdminController';
import { adminGuard } from '@/middleware/adminGuard';
import { safeLogger as logger } from '@/utils/logSanitizer';

const router: Router = Router();

/**
 * 管理接口路由
 * 所有接口都需要管理员权限
 */

// 配置健康状态监控
router.get('/config/health', adminGuard, getConfigHealth);

// 配置快照对比
router.get('/config/compare', adminGuard, compareConfigSnapshot);

// 清理废弃配置
router.post('/config/cleanup', adminGuard, cleanupObsoleteConfigs);

// 获取配置详情
router.get('/config/details', adminGuard, getConfigDetails);

// 统计数据和指标
router.get('/stats', adminGuard, getAdminStats);
router.get('/metrics', adminGuard, getAdminMetrics);

// ✨ 新增：系统信息端点
router.get('/system-info', adminGuard, async (req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const { getPool } = await import('@/utils/db');
    const pool = getPool();

    // 检查数据库健康
    const dbResult = await pool.query('SELECT 1 as health').catch(() => null);

    res.json({
      code: 'OK',
      message: 'success',
      data: {
        system: {
          memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapUsedPercent: `${((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)}%`,
          },
          uptime: process.uptime(),
          nodeVersion: process.version,
          env: process.env.NODE_ENV ?? 'development',
        },
        database: {
          healthy: dbResult !== null,
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingRequests: pool.waitingCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'adminRoutes',
      operation: 'getSystemInfo',
    });
    logger.error('Failed to get system info', error.toLogObject());
    
    const apiError = error.toApiError();
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: '获取系统信息失败',
      data: null,
      ...apiError,
    });
  }
});

// ✨ 新增：用户列表端点
router.get('/users', adminGuard, async (req: Request, res: Response) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const { getPool } = await import('@/utils/db');
    const pool = getPool();

    let query = `
      SELECT id, username, role, status, created_at, last_login_at, last_login_ip
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];

    // 搜索功能
    if (search && typeof search === 'string') {
      query += ` AND username ILIKE $${params.length + 1}`;
      params.push(`%${search}%`);
    }

    // 分页
    const offset = (Number(page) - 1) * Number(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // 获取总数
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    res.json({
      code: 'OK',
      message: 'success',
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'adminRoutes',
      operation: 'getUsers',
    });
    logger.error('Failed to get users', error.toLogObject());
    
    const apiError = error.toApiError();
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: '获取用户列表失败',
      data: null,
      ...apiError,
    });
  }
});

// ✨ 新增：审计日志端点（代理到audit路由）
router.get('/audit', adminGuard, async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const { getPool } = await import('@/utils/db');
    const pool = getPool();

    let query = `
      SELECT *
      FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    // 类型筛选
    if (type && typeof type === 'string') {
      query += ` AND action ILIKE $${params.length + 1}`;
      params.push(`%${type}%`);
    }

    // 时间范围
    if (startDate && typeof startDate === 'string') {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    // 分页
    const offset = (Number(page) - 1) * Number(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      code: 'OK',
      message: 'success',
      data: result.rows,
    });
  } catch (unknownError: unknown) {
    const error = createErrorFromUnknown(unknownError, {
      component: 'adminRoutes',
      operation: 'getAuditLogs',
    });
    logger.error('Failed to get audit logs', error.toLogObject());
    
    const apiError = error.toApiError();
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: '获取审计日志失败',
      data: null,
      ...apiError,
    });
  }
});

export default router;

