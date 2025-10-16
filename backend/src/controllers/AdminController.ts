import type { Request, Response } from 'express';
import { AgentConfigService } from '@/services/AgentConfigService';
import type { ApiResponse } from '@/types';
import { safeLogger as logger } from '@/utils/logSanitizer';
import { HTTP_STATUS } from '@/constants/httpStatus';
import { TIME_CONSTANTS, TIME_UNITS } from '@/constants/intervals';

// 创建服务实例
const configService = new AgentConfigService();

/**
 * 管理员控制器
 * 提供管理接口和监控接口
 *
 * @swagger
 * tags:
 *   name: Admin
 *   description: 管理后台接口（需要管理员权限）
 */

/**
 * 获取配置健康状态
 * GET /api/admin/config/health
 *
 * @swagger
 * /api/admin/config/health:
 *   get:
 *     summary: 获取配置健康状态
 *     tags: [Admin]
 *     description: 获取智能体配置的健康状态，包括总数、激活状态、无效配置等统计信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回配置健康状态
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalConfigs:
 *                       type: number
 *                       description: 总配置数
 *                     activeConfigs:
 *                       type: number
 *                       description: 激活配置数
 *                     inactiveConfigs:
 *                       type: number
 *                       description: 未激活配置数
 *                     invalidConfigs:
 *                       type: number
 *                       description: 无效配置数
 *                     hasUnresolvedPlaceholders:
 *                       type: number
 *                       description: 包含未解析占位符的配置数
 *                     snapshotComparison:
 *                       type: object
 *                       properties:
 *                         isEqual:
 *                           type: boolean
 *                           description: 数据库与文件配置是否一致
 *                         dbOnlyCount:
 *                           type: number
 *                           description: 仅存在于数据库的配置数
 *                         fileOnlyCount:
 *                           type: number
 *                           description: 仅存在于文件的配置数
 *                         differenceCount:
 *                           type: number
 *                           description: 存在差异的配置数
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 获取配置健康状态失败
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 */
export async function getConfigHealth(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const healthStatus = await configService.getConfigHealthStatus();

    const response: ApiResponse<typeof healthStatus> = {
      code: 200,
      message: 'success',
      data: healthStatus,
    };

    return res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AdminController] 获取配置健康状态失败', {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    const response: ApiResponse<null> = {
      code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: '获取配置健康状态失败',
      data: null,
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
}

/**
 * 执行配置快照对比
 * GET /api/admin/config/compare
 *
 * @swagger
 * /api/admin/config/compare:
 *   get:
 *     summary: 执行配置快照对比
 *     tags: [Admin]
 *     description: 对比数据库和配置文件中的智能体配置
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回配置对比结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     isEqual:
 *                       type: boolean
 *                       description: 数据库与文件配置是否一致
 *                     dbOnly:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Agent'
 *                       description: 仅存在于数据库的配置
 *                     fileOnly:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Agent'
 *                       description: 仅存在于文件的配置
 *                     differences:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           field:
 *                             type: string
 *                           dbValue:
 *                             type: object
 *                           fileValue:
 *                             type: object
 *                       description: 存在差异的配置项
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 配置快照对比失败
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 */
export async function compareConfigSnapshot(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const comparisonResult = await configService.compareConfigSnapshot();

    const response: ApiResponse<typeof comparisonResult> = {
      code: 200,
      message: 'success',
      data: comparisonResult,
    };

    return res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AdminController] 配置快照对比失败', {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    const response: ApiResponse<null> = {
      code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: '配置快照对比失败',
      data: null,
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
}

/**
 * 清理废弃配置
 * POST /api/admin/config/cleanup
 *
 * @swagger
 * /api/admin/config/cleanup:
 *   post:
 *     summary: 清理废弃配置
 *     tags: [Admin]
 *     description: 删除不再使用的配置项（非激活状态且长时间未更新的配置）
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功清理废弃配置
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 成功清理 2 个废弃配置
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: number
 *                       description: 已删除的配置数量
 *                     deletedIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 已删除的配置ID列表
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 清理废弃配置失败
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 */
export async function cleanupObsoleteConfigs(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const cleanupResult = await configService.cleanupObsoleteConfigs();

    const response: ApiResponse<typeof cleanupResult> = {
      code: 200,
      message: `成功清理 ${cleanupResult.deletedCount} 个废弃配置`,
      data: cleanupResult,
    };

    return res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AdminController] 清理废弃配置失败', {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    const response: ApiResponse<null> = {
      code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: '清理废弃配置失败',
      data: null,
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
}

/**
 * 获取所有配置详情
 * GET /api/admin/config/details
 *
 * @swagger
 * /api/admin/config/details:
 *   get:
 *     summary: 获取所有配置详情
 *     tags: [Admin]
 *     description: 获取所有智能体配置的详细信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回所有配置详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Agent'
 *       500:
 *         description: 服务器内部错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: number
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 获取配置详情失败
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
 */
export async function getConfigDetails(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const configs = await configService.getAllAgents();

    // 获取详细的配置信息
    const detailedConfigs = [];
    for (const config of configs) {
      const fullConfig = await configService.getAgent(config.id);
      if (fullConfig) {
        detailedConfigs.push(fullConfig);
      }
    }

    const response: ApiResponse<typeof detailedConfigs> = {
      code: 200,
      message: 'success',
      data: detailedConfigs,
    };

    return res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AdminController] 获取配置详情失败', {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    const response: ApiResponse<null> = {
      code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: '获取配置详情失败',
      data: null,
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
}

import os from 'os';
import { authService } from '@/services/authInstance';
import { withClient, hashPassword } from '@/utils/db';
import { analyticsService } from '@/services/analyticsInstance';
import {
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
} from '@/types/errors';

// 使用全局单例的 authService（见 services/authInstance.ts）

async function ensureAuth(req: Request): Promise<{ id: string; username: string; role?: string }> {
  const auth = req.headers['authorization'];
  const token = (auth ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new AuthenticationError({
      message: '未提供认证令牌',
      code: 'UNAUTHORIZED',
    });
  }
  return authService.profile(token);
}

async function ensureAdminAuth(req: Request): Promise<{ id: string; username: string; role?: string }> {
  const user = await ensureAuth(req);
  if (!user || user.role !== 'admin') {
    throw new AuthorizationError({
      message: '需要管理员权限',
      code: 'FORBIDDEN',
      resource: 'admin',
      action: 'access',
    });
  }
  return user;
}

function parseDateInput(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(
    TIME_CONSTANTS.END_OF_DAY_HOUR,
    TIME_CONSTANTS.END_OF_DAY_MINUTE,
    TIME_CONSTANTS.END_OF_DAY_SECOND,
    TIME_CONSTANTS.MILLISECOND_OF_DAY,
  );
  return d;
}

export class AdminController {
  static async systemInfo(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const memTotal = os.totalmem();
      const memFree = os.freemem();
      const memUsed = memTotal - memFree;
      const load = os.loadavg ? os.loadavg() : [0, 0, 0];
      const cpuCount = os.cpus()?.length ?? 0;
      const info = {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptimeSec: Math.floor(process.uptime()),
        memory: {
          total: memTotal,
          free: memFree,
          used: memUsed,
          rss: process.memoryUsage().rss,
        },
        cpu: {
          count: cpuCount,
          load1: load[0] ?? 0,
          load5: load[1] ?? 0,
          load15: load[2] ?? 0,
        },
      };
      return res.json({ data: info });
    } catch (e: unknown) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: '未授权',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async users(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const data = await withClient(async (client) => {
        const { rows } = await client.query(
          'SELECT id, username, role, status, created_at, updated_at FROM users ORDER BY id DESC',
        );
        return rows as Array<{
          id: string;
          username: string;
          role: string;
          status: string;
          created_at: Date;
          updated_at: Date;
        }>;
      });
      return res.json({ data });
    } catch (e: unknown) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: '未授权',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async logs(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const {
        level,
        start,
        end,
        page = '1',
        pageSize = '20',
      } = req.query as {
        level?: string;
        start?: string;
        end?: string;
        page?: string;
        pageSize?: string;
      };
      const conditions: string[] = [];
      const params: (string | number | Date)[] = [];
      let idx = 1;
      if (level) {
        conditions.push(`level = $${idx++}`);
        params.push(level);
      }
      if (start) {
        conditions.push(`timestamp >= $${idx++}`);
        params.push(new Date(start));
      }
      if (end) {
        conditions.push(`timestamp <= $${idx++}`);
        params.push(new Date(end));
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const pg = await withClient(async (client) => {
        const { rows: totalRows } = await client.query(
          `SELECT COUNT(*)::int AS count FROM logs ${where}`,
          params,
        );
        const total = (totalRows[0] as { count: number })?.count ?? 0;
        const p = Math.max(1, parseInt(String(page), 10) ?? 1);
        const ps = Math.min(
          TIME_CONSTANTS.MAX_PAGE_SIZE,
          Math.max(1, parseInt(String(pageSize), 10) ?? TIME_CONSTANTS.DEFAULT_PAGE_SIZE),
        );
        const offset = (p - 1) * ps;
        const { rows } = await client.query(
          `SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${
            idx + 1
          }`,
          [...params, ps, offset],
        );
        return { rows, total, page: p, pageSize: ps };
      });
      return res.json({
        data: pg.rows,
        total: pg.total,
        page: pg.page,
        pageSize: pg.pageSize,
      });
    } catch (e: unknown) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: '未授权',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async logsExport(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const { level, start, end } = req.query as {
        level?: string;
        start?: string;
        end?: string;
      };
      const conditions: string[] = [];
      const params: (string | number | Date)[] = [];
      let idx = 1;
      if (level) {
        conditions.push(`level = $${idx++}`);
        params.push(level);
      }
      if (start) {
        conditions.push(`timestamp >= $${idx++}`);
        params.push(new Date(start));
      }
      if (end) {
        conditions.push(`timestamp <= $${idx++}`);
        params.push(new Date(end));
      }
      const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const rows = await withClient(async (client) => {
        const { rows } = await client.query(
          `SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT 50000`,
          params,
        );
        return rows as Array<{
          id: number;
          timestamp: string;
          level: string;
          message: string;
        }>;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
      const header = 'id,timestamp,level,message\n';
      const body = rows
        .map(
          (r) =>
            `${r.id},${new Date(r.timestamp).toISOString()},${r.level},"${(
              r.message || ''
            ).replace(/"/g, '""')}"`,
        )
        .join('\n');
      return res.status(HTTP_STATUS.OK).send(header + body);
    } catch (e: unknown) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: 'UNAUTHORIZED',
        message: '未授权',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async provinceHeatmap(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);

      const {
        start: startRaw,
        end: endRaw,
        agentId,
      } = req.query as {
        start?: string;
        end?: string;
        agentId?: string;
      };

      const parsedStart = startRaw ? parseDateInput(startRaw) : null;
      if (startRaw && !parsedStart) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'start 参数格式不合法',
          timestamp: new Date().toISOString(),
        });
      }

      const parsedEnd = endRaw ? parseDateInput(endRaw) : null;
      if (endRaw && !parsedEnd) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'end 参数格式不合法',
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();
      let startDate = parsedStart ? new Date(parsedStart) : startOfDay(now);
      let endDate = parsedEnd ? new Date(parsedEnd) : endOfDay(now);

      if (!parsedStart) {
        startDate = startOfDay(startDate);
      }
      if (!parsedEnd) {
        endDate = endOfDay(endDate);
      }

      if (startDate.getTime() > endDate.getTime()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: '开始时间必须早于结束时间',
          timestamp: new Date().toISOString(),
        });
      }

      const maxRangeMs = 60 * TIME_UNITS.DAY; // 60 天
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: '时间范围不能超过60天',
          timestamp: new Date().toISOString(),
        });
      }

      const filterAgentId = agentId && agentId !== 'all' ? agentId : null;

      const data = await analyticsService.getProvinceHeatmap({
        start: startDate,
        end: endDate,
        agentId: filterAgentId,
      });

      return res.json({ data });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: 'UNAUTHORIZED',
          message: '未授权',
          timestamp: new Date().toISOString(),
        });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AdminController] provinceHeatmap failed', {
        error: errorMessage,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: '获取地域热点数据失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async conversationSeries(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);

      const {
        start: startRaw,
        end: endRaw,
        agentId,
      } = req.query as {
        start?: string;
        end?: string;
        agentId?: string;
      };

      const parsedStart = startRaw ? parseDateInput(startRaw) : null;
      if (startRaw && !parsedStart) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'start 参数格式不合法',
          timestamp: new Date().toISOString(),
        });
      }

      const parsedEnd = endRaw ? parseDateInput(endRaw) : null;
      if (endRaw && !parsedEnd) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'end 参数格式不合法',
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();
      let startDate = parsedStart
        ? new Date(parsedStart)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      let endDate = parsedEnd ? new Date(parsedEnd) : endOfDay(now);

      startDate = startOfDay(startDate);
      endDate = endOfDay(endDate);

      if (startDate.getTime() > endDate.getTime()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: '开始时间必须早于结束时间',
          timestamp: new Date().toISOString(),
        });
      }

      const maxRangeMs = 90 * TIME_UNITS.DAY; // 最长 90 天
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: '时间范围不能超过90天',
          timestamp: new Date().toISOString(),
        });
      }

      const filterAgentId = agentId && agentId !== 'all' ? agentId : null;

      const data = await analyticsService.getConversationSeries({
        start: startDate,
        end: endDate,
        agentId: filterAgentId,
      });

      return res.json({ data });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: 'UNAUTHORIZED',
          message: '未授权',
          timestamp: new Date().toISOString(),
        });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AdminController] conversationSeries failed', {
        error: errorMessage,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: '获取智能体对话趋势失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async conversationAgents(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);

      const { start: startRaw, end: endRaw } = req.query as {
        start?: string;
        end?: string;
      };

      const parsedStart = startRaw ? parseDateInput(startRaw) : null;
      if (startRaw && !parsedStart) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'start 参数格式不合法',
          timestamp: new Date().toISOString(),
        });
      }

      const parsedEnd = endRaw ? parseDateInput(endRaw) : null;
      if (endRaw && !parsedEnd) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'end 参数格式不合法',
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();
      let startDate = parsedStart
        ? new Date(parsedStart)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      let endDate = parsedEnd ? new Date(parsedEnd) : endOfDay(now);

      startDate = startOfDay(startDate);
      endDate = endOfDay(endDate);

      if (startDate.getTime() > endDate.getTime()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: '开始时间必须早于结束时间',
          timestamp: new Date().toISOString(),
        });
      }

      const maxRangeMs = 180 * TIME_UNITS.DAY;
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: '时间范围不能超过180天',
          timestamp: new Date().toISOString(),
        });
      }

      const data = await analyticsService.getAgentTotals({
        start: startDate,
        end: endDate,
      });

      return res.json({ data });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          code: 'UNAUTHORIZED',
          message: '未授权',
          timestamp: new Date().toISOString(),
        });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AdminController] conversationAgents failed', {
        error: errorMessage,
        type: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: '获取智能体会话对比失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ========== 用户管理：新增 / 更新 / 重置密码 ==========
  static async createUser(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const {
        username,
        password,
        role = 'user',
        status = 'active',
      }: {
        username?: string;
        password?: string;
        role?: string;
        status?: string;
      } = req.body || {};
      if (!username || !password) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'username/password 必填',
          timestamp: new Date().toISOString(),
        });
      }
      const data = await withClient(async (client) => {
        const exists = await client.query(
          'SELECT 1 FROM users WHERE username=$1 LIMIT 1',
          [username],
        );
        if (exists.rowCount && exists.rowCount > 0) {
          throw new BusinessLogicError({
            message: '用户名已存在',
            code: 'USER_EXISTS',
            rule: 'unique_username',
          });
        }
        // 使用安全哈希存储密码
        const { salt, hash } = hashPassword(password);

        const { rows } = await client.query(
          'INSERT INTO users(username, password_salt, password_hash, role, status) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, role, status, created_at, updated_at',
          [username, salt, hash, role, status],
        );
        return rows[0];
      });
      return res.json({ data });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'USER_EXISTS') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'USER_EXISTS',
          message: '用户名已存在',
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: '创建用户失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async updateUser(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const { id, role, status }: {
        id?: string;
        role?: string;
        status?: string;
      } = req.body || {};
      if (!id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'id 必填',
          timestamp: new Date().toISOString(),
        });
      }
      const fields: string[] = [];
      const params: (string | number | Date)[] = [];
      let idx = 1;
      if (typeof role === 'string') {
        fields.push(`role=$${idx++}`);
        params.push(role);
      }
      if (typeof status === 'string') {
        fields.push(`status=$${idx++}`);
        params.push(status);
      }
      fields.push('updated_at=NOW()');
      const sql = `UPDATE users SET ${fields.join(
        ', ',
      )} WHERE id=$${idx} RETURNING id, username, role, status, created_at, updated_at`;
      params.push(id);
      const data = await withClient(async (client) => {
        const { rows } = await client.query(sql, params);
        return rows[0];
      });
      return res.json({ data });
    } catch (e: unknown) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: '更新用户失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async resetUserPassword(req: Request, res: Response): Promise<Response> {
    try {
      await ensureAdminAuth(req);
      const { id, newPassword }: {
        id?: string;
        newPassword?: string;
      } = req.body || {};
      if (!id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          code: 'BAD_REQUEST',
          message: 'id 必填',
          timestamp: new Date().toISOString(),
        });
      }
      const pwd =
        typeof newPassword === 'string' && newPassword.length >= TIME_CONSTANTS.MIN_PASSWORD_LENGTH
          ? newPassword
          : Math.random().toString(36).slice(-TIME_CONSTANTS.RANDOM_RANGE);

      // 使用安全哈希存储密码
      const { salt, hash } = hashPassword(pwd);

      await withClient(async (client) => {
        await client.query(
          'UPDATE users SET password_salt=$1, password_hash=$2, updated_at=NOW() WHERE id=$3',
          [salt, hash, id],
        );
      });

      logger.warn('[AdminController] 管理员重置用户密码', {
        userId: id,
        newPasswordLength: pwd.length,
        timestamp: new Date().toISOString(),
      });

      return res.json({ ok: true, newPassword: pwd });
    } catch (e: unknown) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        code: 'INTERNAL_ERROR',
        message: '重置密码失败',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * 获取管理员统计数据
 * GET /api/admin/stats
 *
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: 获取管理员统计数据
 *     tags: [Admin]
 *     description: 获取系统统计信息，包括用户数、会话数、智能体使用情况等
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回统计数据
 */
export async function getAdminStats(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    // 确保管理员权限
    const adminCheck = req.headers['x-admin-verified'];
    if (adminCheck !== 'true') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: HTTP_STATUS.UNAUTHORIZED,
        message: '需要管理员权限',
        data: null,
      });
    }

    const now = new Date();
    const todayStart = startOfDay(now);

    // 定义统计结果接口
    interface UserStatsResult {
      total: number;
      active: number;
      admins: number;
    }

    interface SessionStatsResult {
      total: number;
      today: number;
    }

    interface AgentStatsResult {
      total: number;
      active: number;
    }

    interface MessageStatsResult {
      total: number;
      today: number;
    }

    // 获取统计数据
    const stats = await withClient(async (client) => {
      // 用户统计
      const usersResult = await client.query<UserStatsResult>(`
        SELECT 
          COUNT(*)::int AS total,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int AS active,
          COUNT(CASE WHEN role = 'admin' THEN 1 END)::int AS admins
        FROM users
      `);

      // 会话统计
      const sessionsResult = await client.query<SessionStatsResult>(`
        SELECT 
          COUNT(*)::int AS total,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END)::int AS today
        FROM conversations
      `, [todayStart]);

      // 智能体统计
      const agentsResult = await client.query<AgentStatsResult>(`
        SELECT 
          COUNT(*)::int AS total,
          COUNT(CASE WHEN is_active = true THEN 1 END)::int AS active
        FROM agent_configs
      `);

      // 消息统计
      const messagesResult = await client.query<MessageStatsResult>(`
        SELECT 
          COUNT(*)::int AS total,
          COUNT(CASE WHEN created_at >= $1 THEN 1 END)::int AS today
        FROM messages
      `, [todayStart]);

      return {
        users: usersResult.rows[0] ?? { total: 0, active: 0, admins: 0 },
        sessions: sessionsResult.rows[0] ?? { total: 0, today: 0 },
        agents: agentsResult.rows[0] ?? { total: 0, active: 0 },
        messages: messagesResult.rows[0] ?? { total: 0, today: 0 },
      };
    });

    const response: ApiResponse<typeof stats> = {
      code: 200,
      message: 'success',
      data: stats,
    };

    return res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AdminController] 获取统计数据失败', {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    const response: ApiResponse<null> = {
      code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: '获取统计数据失败',
      data: null,
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
}

/**
 * 获取管理员指标数据
 * GET /api/admin/metrics
 *
 * @swagger
 * /api/admin/metrics:
 *   get:
 *     summary: 获取管理员指标数据
 *     tags: [Admin]
 *     description: 获取系统性能指标，包括CPU、内存、响应时间等
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功返回指标数据
 */
export async function getAdminMetrics(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    // 确保管理员权限
    const adminCheck = req.headers['x-admin-verified'];
    if (adminCheck !== 'true') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: HTTP_STATUS.UNAUTHORIZED,
        message: '需要管理员权限',
        data: null,
      });
    }

    // 系统指标
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    const load = os.loadavg ? os.loadavg() : [0, 0, 0];
    
    // 获取数据库指标
    const dbMetrics = await withClient(async (client) => {
      const startTime = Date.now();
      await client.query('SELECT 1');
      const queryTime = Date.now() - startTime;

      // 获取活动连接数
      interface ConnectionCountResult {
        active_connections: number;
      }
      const connectionsResult = await client.query<ConnectionCountResult>(`
        SELECT COUNT(*)::int AS active_connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `);

      return {
        activeConnections: connectionsResult.rows[0]?.active_connections ?? 0,
        queryTime,
      };
    });

    const metrics = {
      system: {
        cpuUsage: load[0] ?? 0,
        memoryUsage: Math.round((memUsed / memTotal) * 100),
        uptime: Math.floor(process.uptime()),
      },
      performance: {
        avgResponseTime: 0, // 可以从MetricsService获取
        requestsPerMinute: 0, // 可以从MetricsService获取
      },
      database: {
        activeConnections: dbMetrics.activeConnections,
        queryTime: dbMetrics.queryTime,
      },
    };

    const response: ApiResponse<typeof metrics> = {
      code: 200,
      message: 'success',
      data: metrics,
    };

    return res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AdminController] 获取指标数据失败', {
      error: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown',
    });

    const response: ApiResponse<null> = {
      code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: '获取指标数据失败',
      data: null,
    };

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(response);
  }
}
