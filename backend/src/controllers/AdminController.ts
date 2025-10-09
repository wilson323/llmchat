import { Request, Response } from "express";
import { AgentConfigService } from "@/services/AgentConfigService";
import { ApiResponse } from "@/types";
import logger from "@/utils/logger";

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
  res: Response
): Promise<void> {
  try {
    const healthStatus = await configService.getConfigHealthStatus();

    const response: ApiResponse<typeof healthStatus> = {
      code: 200,
      message: "success",
      data: healthStatus,
    };

    res.json(response);
  } catch (error) {
    logger.error("[AdminController] 获取配置健康状态失败", { error });

    const response: ApiResponse<null> = {
      code: 500,
      message: "获取配置健康状态失败",
      data: null,
    };

    res.status(500).json(response);
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
  res: Response
): Promise<void> {
  try {
    const comparisonResult = await configService.compareConfigSnapshot();

    const response: ApiResponse<typeof comparisonResult> = {
      code: 200,
      message: "success",
      data: comparisonResult,
    };

    res.json(response);
  } catch (error) {
    logger.error("[AdminController] 配置快照对比失败", { error });

    const response: ApiResponse<null> = {
      code: 500,
      message: "配置快照对比失败",
      data: null,
    };

    res.status(500).json(response);
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
  res: Response
): Promise<void> {
  try {
    const cleanupResult = await configService.cleanupObsoleteConfigs();

    const response: ApiResponse<typeof cleanupResult> = {
      code: 200,
      message: `成功清理 ${cleanupResult.deletedCount} 个废弃配置`,
      data: cleanupResult,
    };

    res.json(response);
  } catch (error) {
    logger.error("[AdminController] 清理废弃配置失败", { error });

    const response: ApiResponse<null> = {
      code: 500,
      message: "清理废弃配置失败",
      data: null,
    };

    res.status(500).json(response);
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
  res: Response
): Promise<void> {
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
      message: "success",
      data: detailedConfigs,
    };

    res.json(response);
  } catch (error) {
    logger.error("[AdminController] 获取配置详情失败", { error });

    const response: ApiResponse<null> = {
      code: 500,
      message: "获取配置详情失败",
      data: null,
    };

    res.status(500).json(response);
  }
}

import os from "os";
import { authService } from "@/services/authInstance";
import { withClient, hashPassword } from "@/utils/db";
import { analyticsService } from "@/services/analyticsInstance";
import { logAudit } from "@/middleware/auditMiddleware";
import { AuditAction, AuditStatus, ResourceType } from "@/types/audit";
import {
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
} from "@/types/errors";

// 使用全局单例的 authService（见 services/authInstance.ts）

async function ensureAuth(req: Request) {
  const auth = req.headers["authorization"];
  const token = (auth || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new AuthenticationError({
      message: "未提供认证令牌",
      code: "UNAUTHORIZED",
    });
  }
  return await authService.profile(token);
}

async function ensureAdminAuth(req: Request) {
  const user = await ensureAuth(req);
  if (!user || user.role !== "admin") {
    throw new AuthorizationError({
      message: "需要管理员权限",
      code: "FORBIDDEN",
      resource: "admin",
      action: "access",
    });
  }
  return user;
}

function parseDateInput(value?: string): Date | null {
  if (!value) return null;
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
  d.setHours(23, 59, 59, 999);
  return d;
}

export class AdminController {
  static async systemInfo(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const memTotal = os.totalmem();
      const memFree = os.freemem();
      const memUsed = memTotal - memFree;
      const load = os.loadavg ? os.loadavg() : [0, 0, 0];
      const cpuCount = os.cpus()?.length || 0;
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
          load1: load[0] || 0,
          load5: load[1] || 0,
          load15: load[2] || 0,
        },
      };
      return res.json({ data: info });
    } catch (e: any) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "未授权",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async users(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const data = await withClient(async (client) => {
        const { rows } = await client.query(
          "SELECT id, username, role, status, created_at, updated_at FROM users ORDER BY id DESC"
        );
        return rows;
      });
      return res.json({ data });
    } catch (e: any) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "未授权",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async logs(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const {
        level,
        start,
        end,
        page = "1",
        pageSize = "20",
      } = req.query as {
        level?: string;
        start?: string;
        end?: string;
        page?: string;
        pageSize?: string;
      };
      const conditions: string[] = [];
      const params: any[] = [];
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
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const pg = await withClient(async (client) => {
        const { rows: totalRows } = await client.query(
          `SELECT COUNT(*)::int AS count FROM logs ${where}`,
          params
        );
        const total = totalRows[0]?.count || 0;
        const p = Math.max(1, parseInt(String(page), 10) || 1);
        const ps = Math.min(
          200,
          Math.max(1, parseInt(String(pageSize), 10) || 20)
        );
        const offset = (p - 1) * ps;
        const { rows } = await client.query(
          `SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${
            idx + 1
          }`,
          [...params, ps, offset]
        );
        return { rows, total, page: p, pageSize: ps };
      });
      return res.json({
        data: pg.rows,
        total: pg.total,
        page: pg.page,
        pageSize: pg.pageSize,
      });
    } catch (e: any) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "未授权",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async logsExport(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const { level, start, end } = req.query as {
        level?: string;
        start?: string;
        end?: string;
      };
      const conditions: string[] = [];
      const params: any[] = [];
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
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const rows = await withClient(async (client) => {
        const { rows } = await client.query(
          `SELECT id, timestamp, level, message FROM logs ${where} ORDER BY timestamp DESC LIMIT 50000`,
          params
        );
        return rows as Array<{
          id: number;
          timestamp: string;
          level: string;
          message: string;
        }>;
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="logs.csv"');
      const header = "id,timestamp,level,message\n";
      const body = rows
        .map(
          (r) =>
            `${r.id},${new Date(r.timestamp).toISOString()},${r.level},"${(
              r.message || ""
            ).replace(/"/g, '""')}"`
        )
        .join("\n");
      return res.status(200).send(header + body);
    } catch (e: any) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "未授权",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async provinceHeatmap(req: Request, res: Response) {
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
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "start 参数格式不合法",
          timestamp: new Date().toISOString(),
        });
      }

      const parsedEnd = endRaw ? parseDateInput(endRaw) : null;
      if (endRaw && !parsedEnd) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "end 参数格式不合法",
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
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "开始时间必须早于结束时间",
          timestamp: new Date().toISOString(),
        });
      }

      const maxRangeMs = 60 * 24 * 60 * 60 * 1000; // 60 天
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "时间范围不能超过60天",
          timestamp: new Date().toISOString(),
        });
      }

      const filterAgentId = agentId && agentId !== "all" ? agentId : null;

      const data = await analyticsService.getProvinceHeatmap({
        start: startDate,
        end: endDate,
        agentId: filterAgentId,
      });

      return res.json({ data });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({
          code: "UNAUTHORIZED",
          message: "未授权",
          timestamp: new Date().toISOString(),
        });
      }
      logger.error("[AdminController] provinceHeatmap failed", { error });
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "获取地域热点数据失败",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async conversationSeries(req: Request, res: Response) {
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
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "start 参数格式不合法",
          timestamp: new Date().toISOString(),
        });
      }

      const parsedEnd = endRaw ? parseDateInput(endRaw) : null;
      if (endRaw && !parsedEnd) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "end 参数格式不合法",
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
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "开始时间必须早于结束时间",
          timestamp: new Date().toISOString(),
        });
      }

      const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 最长 90 天
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "时间范围不能超过90天",
          timestamp: new Date().toISOString(),
        });
      }

      const filterAgentId = agentId && agentId !== "all" ? agentId : null;

      const data = await analyticsService.getConversationSeries({
        start: startDate,
        end: endDate,
        agentId: filterAgentId,
      });

      return res.json({ data });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({
          code: "UNAUTHORIZED",
          message: "未授权",
          timestamp: new Date().toISOString(),
        });
      }
      logger.error("[AdminController] conversationSeries failed", { error });
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "获取智能体对话趋势失败",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async conversationAgents(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);

      const { start: startRaw, end: endRaw } = req.query as {
        start?: string;
        end?: string;
      };

      const parsedStart = startRaw ? parseDateInput(startRaw) : null;
      if (startRaw && !parsedStart) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "start 参数格式不合法",
          timestamp: new Date().toISOString(),
        });
      }

      const parsedEnd = endRaw ? parseDateInput(endRaw) : null;
      if (endRaw && !parsedEnd) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "end 参数格式不合法",
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
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "开始时间必须早于结束时间",
          timestamp: new Date().toISOString(),
        });
      }

      const maxRangeMs = 180 * 24 * 60 * 60 * 1000;
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "时间范围不能超过180天",
          timestamp: new Date().toISOString(),
        });
      }

      const data = await analyticsService.getAgentTotals({
        start: startDate,
        end: endDate,
      });

      return res.json({ data });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({
          code: "UNAUTHORIZED",
          message: "未授权",
          timestamp: new Date().toISOString(),
        });
      }
      logger.error("[AdminController] conversationAgents failed", { error });
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "获取智能体会话对比失败",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ========== 用户管理：新增 / 更新 / 重置密码 ==========
  static async createUser(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const {
        username,
        password,
        role = "user",
        status = "active",
      } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "username/password 必填",
          timestamp: new Date().toISOString(),
        });
      }
      const data = await withClient(async (client) => {
        const exists = await client.query(
          "SELECT 1 FROM users WHERE username=$1 LIMIT 1",
          [username]
        );
        if (exists.rowCount && exists.rowCount > 0) {
          throw new BusinessLogicError({
            message: "用户名已存在",
            code: "USER_EXISTS",
            rule: "unique_username",
          });
        }
        const salt = "";
        const hash = "";
        try {
          const { rows } = await client.query(
            "INSERT INTO users(username, password_salt, password_hash, password_plain, role, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, role, status, created_at, updated_at",
            [username, salt, hash, password, role, status]
          );
          return rows[0];
        } catch (e: any) {
          // 兼容未添加 password_plain 列的库（仅写入空 salt/hash 以满足 NOT NULL）
          const { rows } = await client.query(
            "INSERT INTO users(username, password_salt, password_hash, role, status) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, role, status, created_at, updated_at",
            [username, salt, hash, role, status]
          );
          return rows[0];
        }
      });
      return res.json({ data });
    } catch (e: any) {
      if (e?.message === "USER_EXISTS") {
        return res.status(400).json({
          code: "USER_EXISTS",
          message: "用户名已存在",
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "创建用户失败",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const { id, role, status } = req.body || {};
      if (!id)
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "id 必填",
          timestamp: new Date().toISOString(),
        });
      const fields: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (typeof role === "string") {
        fields.push(`role=$${idx++}`);
        params.push(role);
      }
      if (typeof status === "string") {
        fields.push(`status=$${idx++}`);
        params.push(status);
      }
      fields.push(`updated_at=NOW()`);
      const sql = `UPDATE users SET ${fields.join(
        ", "
      )} WHERE id=$${idx} RETURNING id, username, role, status, created_at, updated_at`;
      params.push(id);
      const data = await withClient(async (client) => {
        const { rows } = await client.query(sql, params);
        return rows[0];
      });
      return res.json({ data });
    } catch (e: any) {
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "更新用户失败",
        timestamp: new Date().toISOString(),
      });
    }
  }

  static async resetUserPassword(req: Request, res: Response) {
    try {
      await ensureAdminAuth(req);
      const { id, newPassword } = req.body || {};
      if (!id)
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "id 必填",
          timestamp: new Date().toISOString(),
        });
      const pwd =
        typeof newPassword === "string" && newPassword.length >= 6
          ? newPassword
          : Math.random().toString(36).slice(-10);
      await withClient(async (client) => {
        try {
          await client.query(
            "UPDATE users SET password_plain=$1, updated_at=NOW() WHERE id=$2",
            [pwd, id]
          );
        } catch (e: any) {
          // 兼容老库：若无 password_plain 列，则仅更新时间（此分支一般不出现）
          await client.query("UPDATE users SET updated_at=NOW() WHERE id=$1", [
            id,
          ]);
        }
      });
      return res.json({ ok: true, newPassword: pwd });
    } catch (e: any) {
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "重置密码失败",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
