/**
 * AnalyticsController - 数据分析控制器
 *
 * 提供管理后台的数据分析API端点
 * 包括：系统概览、智能体统计、趋势分析、地理分布等
 */

import { Request, Response } from 'express';
import { getPool } from '@/utils/db';
import logger from '@/utils/logger';
import type { ApiError } from '@/types/errors';

// ===== HTTP状态码常量 =====
/** HTTP 错误请求状态码 */
const HTTP_STATUS_BAD_REQUEST = 400;
/** HTTP 未找到状态码 */
const HTTP_STATUS_NOT_FOUND = 404;
/** HTTP 内部服务器错误状态码 */
const HTTP_STATUS_INTERNAL_ERROR = 500;

/**
 * 系统概览数据接口
 */
interface SystemOverviewData {
  total_agents: number;
  total_sessions: number;
  total_users: number;
  sessions_today: number;
  active_sessions_1h: number;
  self_hosted_messages: number;
  messages_today: number;
  top_agents: Array<{
    agent_name: string;
    provider: string;
    sessions: number;
  }>;
  provider_distribution: Record<string, number>;
  updated_at: string;
}

/**
 * AnalyticsController类
 */
export class AnalyticsController {
  /**
   * 获取系统概览数据
   * GET /api/admin/analytics/overview
   */
  static async getSystemOverview(req: Request, res: Response): Promise<void> {
    try {
      logger.info('获取系统概览数据');

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
          code: 'DB_ERROR',
          message: '数据库连接池未初始化',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
        return;
      }

      // 调用数据库函数获取系统概览
      const result = await pool.query<SystemOverviewData>(
        'SELECT * FROM fn_get_system_overview()',
      );

      if (!result.rows || result.rows.length === 0) {
        const apiError: ApiError = {
          code: 'NO_DATA',
          message: '未能获取系统概览数据',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_NOT_FOUND).json(apiError);
        return;
      }

      const data = result.rows[0];

      logger.info('系统概览数据获取成功', {
        total_sessions: data?.total_sessions,
        total_users: data?.total_users,
      });

      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取系统概览失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取系统概览失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 获取智能体使用统计
   * GET /api/admin/analytics/agents
   */
  static async getAgentStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('获取智能体使用统计');

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
          code: 'DB_ERROR',
          message: '数据库连接池未初始化',
          timestamp: new Date().toISOString(),
        };
        res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
        return;
      }

      // 从视图获取智能体统计数据
      const result = await pool.query(
        `SELECT 
          agent_id,
          agent_name,
          provider,
          is_active,
          total_sessions,
          sessions_today,
          sessions_this_week,
          sessions_this_month,
          unique_users,
          last_used_at,
          first_used_at
        FROM v_agent_usage_stats
        ORDER BY total_sessions DESC`,
      );

      logger.info('智能体统计数据获取成功', { count: result.rows.length });

      res.json({
        success: true,
        data: result.rows,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取智能体统计失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取智能体统计失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 获取每日趋势数据
   * GET /api/admin/analytics/trends?days=30
   */
  static async getDailyTrends(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;

      if (days < 1 || days > 365) {
        const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '天数范围必须在1-365之间',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
      }

      logger.info('获取每日趋势数据', { days });

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '数据库连接池未初始化',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
      }

      // 从汇总表获取趋势数据
      const result = await pool.query(
        `SELECT 
          summary_date,
          total_sessions,
          total_users,
          total_messages,
          active_agents,
          fastgpt_sessions,
          dify_sessions,
          self_hosted_sessions
        FROM analytics_daily_summary
        WHERE summary_date >= CURRENT_DATE - INTERVAL '1 day' * $1
        ORDER BY summary_date ASC`,
        [days],
      );

      // 计算汇总数据
      const dailyStats = result.rows;
      const totalSessions = dailyStats.reduce((sum, row) => sum + (row.total_sessions || 0), 0);
      const avgSessionsPerDay = dailyStats.length > 0 ? totalSessions / dailyStats.length : 0;

      let peakDay = null;
      let peakSessions = 0;
      for (const row of dailyStats) {
        if (row.total_sessions > peakSessions) {
          peakSessions = row.total_sessions;
          peakDay = row.summary_date;
        }
      }

      const responseData = {
        period: `${days} days`,
        start_date: dailyStats[0]?.summary_date || null,
        end_date: dailyStats[dailyStats.length - 1]?.summary_date || null,
        daily_stats: dailyStats,
        aggregates: {
          total_sessions: totalSessions,
          avg_sessions_per_day: Math.round(avgSessionsPerDay * 10) / 10,
          peak_day: peakDay,
          peak_sessions: peakSessions,
        },
      };

      logger.info('每日趋势数据获取成功', {
        days,
        records: dailyStats.length,
      });

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取每日趋势失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取每日趋势失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 获取地理分布数据
   * GET /api/admin/analytics/geo
   */
  static async getGeoDistribution(req: Request, res: Response): Promise<void> {
    try {
      logger.info('获取地理分布数据');

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '数据库连接池未初始化',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
      }

      // 从视图获取地理分布数据
      const result = await pool.query(
        `SELECT 
          country,
          province,
          city,
          event_count,
          agents_used,
          unique_sessions,
          last_event_at
        FROM v_geo_distribution_stats
        ORDER BY event_count DESC
        LIMIT 100`,
      );

      logger.info('地理分布数据获取成功', { count: result.rows.length });

      res.json({
        success: true,
        data: result.rows,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取地理分布失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取地理分布失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 获取省份热力图数据
   * GET /api/admin/analytics/province-heatmap?start=2025-01-01&end=2025-12-31&agentId=xxx
   */
  static async getProvinceHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const { start, end, agentId } = req.query;

      logger.info('获取省份热力图数据', { start, end, agentId });

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '数据库连接池未初始化',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
      }

      // 构建查询条件
      let query = `
        SELECT 
          province,
          COUNT(*) as count
        FROM v_geo_distribution_stats
        WHERE 1=1
      `;
      const params: Array<string | number> = [];

      if (start && typeof start === 'string') {
        params.push(start);
        query += ` AND last_event_at >= $${params.length}::timestamp`;
      }

      if (end && typeof end === 'string') {
        params.push(end);
        query += ` AND last_event_at <= $${params.length}::timestamp`;
      }

      query += ' GROUP BY province ORDER BY count DESC';

      const result = await pool.query(query, params);

      // 构建响应数据
      const points = result.rows.map(row => ({
        province: row.province,
        count: parseInt(row.count, 10),
      }));

      const total = points.reduce((sum, p) => sum + p.count, 0);

      const responseData = {
        start: start ?? null,
        end: end ?? null,
        agentId: agentId ?? null,
        total,
        points,
        summary: {
          local: total,
          overseas: 0,
          unknown: 0,
        },
        generatedAt: new Date().toISOString(),
      };

      logger.info('省份热力图数据获取成功', { provinces: points.length });

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取省份热力图失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取省份热力图失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 获取对话系列数据
   * GET /api/admin/analytics/conversations/series?start=2025-01-01&end=2025-12-31&agentId=xxx
   */
  static async getConversationSeries(req: Request, res: Response): Promise<void> {
    try {
      const { start, end, agentId } = req.query;

      logger.info('获取对话系列数据', { start, end, agentId });

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '数据库连接池未初始化',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
      }

      // 构建查询 - 按日期汇总会话数
      let query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          agent_id
        FROM chat_sessions
        WHERE 1=1
      `;
      const params: Array<string | number> = [];

      if (start && typeof start === 'string') {
        params.push(start);
        query += ` AND created_at >= $${params.length}::timestamp`;
      }

      if (end && typeof end === 'string') {
        params.push(end);
        query += ` AND created_at <= $${params.length}::timestamp`;
      }

      if (agentId && typeof agentId === 'string' && agentId !== 'all') {
        params.push(agentId);
        query += ` AND agent_id = $${params.length}`;
      }

      query += ' GROUP BY DATE(created_at), agent_id ORDER BY date ASC';

      const result = await pool.query(query, params);

      // 按日期分组数据
      interface DateBucket {
        date: string;
        total: number;
        byAgent: Array<{ agentId: string; count: number }>;
      }
      const bucketMap = new Map<string, DateBucket>();

      for (const row of result.rows) {
        const dateKey = row.date.toISOString().split('T')[0];
        if (!bucketMap.has(dateKey)) {
          bucketMap.set(dateKey, {
            date: dateKey,
            total: 0,
            byAgent: [],
          });
        }

        const bucket = bucketMap.get(dateKey)!;
        bucket.total += parseInt(row.total, 10);
        bucket.byAgent.push({
          agentId: row.agent_id,
          count: parseInt(row.total, 10),
        });
      }

      const buckets = Array.from(bucketMap.values());
      const total = buckets.reduce((sum, b) => sum + b.total, 0);

      const responseData = {
        start: start ?? null,
        end: end ?? null,
        agentId: agentId ?? null,
        granularity: 'day',
        buckets,
        total,
        agentTotals: [],
        generatedAt: new Date().toISOString(),
      };

      logger.info('对话系列数据获取成功', { buckets: buckets.length });

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取对话系列失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取对话系列失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }

  /**
   * 获取智能体对比数据
   * GET /api/admin/analytics/conversations/agents?start=2025-01-01&end=2025-12-31
   */
  static async getAgentComparison(req: Request, res: Response): Promise<void> {
    try {
      const { start, end } = req.query;

      logger.info('获取智能体对比数据', { start, end });

      const pool = getPool();
      if (!pool) {
        const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: '数据库连接池未初始化',
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_BAD_REQUEST).json(apiError);
      return;
      }

      // 构建查询
      let query = `
        SELECT 
          c.agent_id,
          a.name as agent_name,
          a.provider,
          a.is_active,
          COUNT(*) as sessions
        FROM chat_sessions c
        LEFT JOIN agent_configs a ON c.agent_id = a.id
        WHERE 1=1
      `;
      const params: Array<string | number> = [];

      if (start && typeof start === 'string') {
        params.push(start);
        query += ` AND c.created_at >= $${params.length}::timestamp`;
      }

      if (end && typeof end === 'string') {
        params.push(end);
        query += ` AND c.created_at <= $${params.length}::timestamp`;
      }

      query += ' GROUP BY c.agent_id, a.name, a.provider, a.is_active ORDER BY sessions DESC';

      const result = await pool.query(query, params);

      const totals = result.rows.map(row => ({
        agentId: row.agent_id,
        name: row.agent_name || row.agent_id,
        isActive: row.is_active || false,
        count: parseInt(row.sessions, 10),
      }));

      const total = totals.reduce((sum, t) => sum + t.count, 0);

      const responseData = {
        start: start || null,
        end: end || null,
        totals,
        total,
        generatedAt: new Date().toISOString(),
      };

      logger.info('智能体对比数据获取成功', { agents: totals.length });

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('获取智能体对比失败', { error });
      const apiError: ApiError = {
        code: 'ANALYTICS_ERROR',
        message: '获取智能体对比失败',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
      res.status(HTTP_STATUS_INTERNAL_ERROR).json(apiError);
    }
  }
}

export default AnalyticsController;
