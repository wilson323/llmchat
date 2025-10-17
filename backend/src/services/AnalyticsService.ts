import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';
import { geoService } from '@/services/GeoService';
import { withMongo, ObjectId } from '@/utils/mongo';
import logger from '@/utils/logger';

export interface ProvinceHeatmapPoint {
  province: string;
  count: number;
}

export interface ProvinceHeatmapSummary {
  overseas: number;
  local: number;
  unknown: number;
}

export interface ProvinceHeatmapResult {
  start: string;
  end: string;
  agentId: string | null;
  total: number;
  points: ProvinceHeatmapPoint[];
  summary: ProvinceHeatmapSummary;
  generatedAt: string;
}

const MAP_PROVINCES = new Set(geoService.getProvinceNames());

export interface ConversationSeriesBucket {
  date: string;
  total: number;
  byAgent: Array<{ agentId: string; count: number }>;
}

export interface ConversationSeriesAgentTotal {
  agentId: string;
  name: string;
  isActive: boolean;
  count: number;
}

export interface ConversationSeriesResult {
  start: string;
  end: string;
  agentId: string | null;
  granularity: 'day';
  buckets: ConversationSeriesBucket[];
  total: number;
  agentTotals: ConversationSeriesAgentTotal[];
  generatedAt: string;
}

export interface AgentComparisonResult {
  start: string;
  end: string;
  totals: ConversationSeriesAgentTotal[];
  total: number;
  generatedAt: string;
}

export class AnalyticsService {
  async recordAgentRequest(params: {
    agentId: string;
    sessionId?: string | null;
    ip?: string | null;
  }): Promise<void> {
    const normalizedIp = geoService.normalizeIp(params.ip ?? null);
    const lookup = geoService.lookup(normalizedIp ?? undefined);

    const province = lookup?.province ?? '未知';
    const country = lookup?.country ?? 'UNKNOWN';
    const city = lookup?.city ?? null;

    try {
      await withClient(async (client) => {
        await client.query(
          `INSERT INTO chat_geo_events (
            id,
            agent_id,
            session_id,
            ip,
            country,
            province,
            city
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            generateId(),
            params.agentId,
            params.sessionId || null,
            normalizedIp,
            country,
            province,
            city,
          ],
        );
      });
    } catch (error: any) {
      logger.warn('[AnalyticsService] recordAgentRequest failed', { error });
    }
  }

  async getProvinceHeatmap(params: {
    start: Date;
    end: Date;
    agentId?: string | null;
  }): Promise<ProvinceHeatmapResult> {
    const { start, end, agentId } = params;

    const rows = await withClient(async (client) => {
      const sql = `
        SELECT COALESCE(province, '未知') AS province, COUNT(*)::text AS count
        FROM chat_geo_events
        WHERE created_at >= $1 AND created_at <= $2
        ${agentId ? 'AND agent_id = $3' : ''}
        GROUP BY COALESCE(province, '未知')
      `;
      const queryParams: any[] = agentId ? [start, end, agentId] : [start, end];
      const { rows } = await client.query<{ province: string | null; count: string }>(sql, queryParams);
      return rows;
    });

    const points: ProvinceHeatmapPoint[] = [];
    let total = 0;
    let overseas = 0;
    let local = 0;
    let unknown = 0;

    rows.forEach((row) => {
      const province = row.province || '未知';
      const count = parseInt(row.count, 10) || 0;
      total += count;
      if (province === '海外') {
        overseas += count;
        return;
      }
      if (province === '本地') {
        local += count;
        return;
      }
      if (!MAP_PROVINCES.has(province)) {
        unknown += count;
        return;
      }
      points.push({ province, count });
    });

    points.sort((a, b) => b.count - a.count);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      agentId: agentId ?? null,
      total,
      points,
      summary: {
        overseas,
        local,
        unknown,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getConversationSeries(params: {
    start: Date;
    end: Date;
    agentId?: string | null;
  }): Promise<ConversationSeriesResult> {
    const { start, end, agentId } = params;

    const agentRows = await withClient(async (client) => {
      const { rows } = await client.query<{ id: string; name: string; is_active: boolean; app_id: string | null }>(
        'SELECT id, name, is_active, app_id FROM agent_configs ORDER BY name ASC',
      );
      return rows;
    });

    const agentById = new Map<string, { id: string; name: string; is_active: boolean; app_id: string | null }>();
    const appIdToAgent = new Map<string, { id: string; name: string; is_active: boolean }>();
    agentRows.forEach((row) => {
      agentById.set(row.id, row);
      if (row.app_id) {
        appIdToAgent.set(row.app_id, { id: row.id, name: row.name, is_active: row.is_active });
      }
    });

    const appIdsToQuery: string[] = (() => {
      if (agentId) {
        const agent = agentById.get(agentId);
        return agent?.app_id ? [agent.app_id] : [];
      }
      return Array.from(appIdToAgent.keys());
    })();

    const appIdObjectIds = appIdsToQuery
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const dayMap = new Map<string, Map<string, number>>();
    const agentTotalsMap = new Map<string, number>();
    const agentsWithActivity = new Set<string>();

    if (appIdObjectIds.length > 0) {
      try {
        const mongoRows = await withMongo(async (db) => {
          const pipeline: Record<string, any>[] = [
            {
              $match: {
                createTime: {
                  $gte: start,
                  $lte: end,
                },
                appId: appIdsToQuery.length === 1
                  ? appIdObjectIds[0]
                  : { $in: appIdObjectIds },
              },
            },
            {
              $group: {
                _id: {
                  day: {
                    $dateToString: { format: '%Y-%m-%d', date: '$createTime', timezone: 'UTC' },
                  },
                  appId: '$appId',
                },
                count: { $sum: 1 },
              },
            },
          ];

          interface MongoAggRow { _id: { day: string; appId: ObjectId }; count: number }
          const docs = await db.collection<MongoAggRow>('chats').aggregate(pipeline).toArray();
          return docs;
        });

        mongoRows.forEach((row) => {
          const dayKey = row._id.day;
          const appId = row._id.appId.toHexString();
          const agent = appIdToAgent.get(appId);
          if (!agent) {
            return;
          }
          const agentKey = agent.id;
          const perDay = dayMap.get(dayKey) ?? new Map<string, number>();
          const count = Number(row.count || 0);
          perDay.set(agentKey, (perDay.get(agentKey) ?? 0) + count);
          dayMap.set(dayKey, perDay);
          agentTotalsMap.set(agentKey, (agentTotalsMap.get(agentKey) ?? 0) + count);
          agentsWithActivity.add(agentKey);
        });
      } catch (error: any) {
        logger.warn('[AnalyticsService] Mongo 聚合失败，回退到 PostgreSQL 统计', { error });
      }
    }

    if (dayMap.size === 0 && agentTotalsMap.size === 0) {
      const pgRows = await withClient(async (client) => {
        const sql = `
          SELECT DATE_TRUNC('day', created_at) AS day, agent_id, COUNT(*)::int AS count
          FROM chat_geo_events
          WHERE created_at >= $1 AND created_at <= $2
          ${agentId ? 'AND agent_id = $3' : ''}
          GROUP BY day, agent_id
          ORDER BY day ASC
        `;
        const params: any[] = agentId ? [start, end, agentId] : [start, end];
        const { rows } = await client.query<{ day: Date; agent_id: string; count: number }>(sql, params);
        return rows;
      });

      pgRows.forEach((row) => {
        const dayKey = row.day.toISOString().slice(0, 10);
        const agentKey = row.agent_id;
        const perDay = dayMap.get(dayKey) ?? new Map<string, number>();
        const count = Number(row.count || 0);
        perDay.set(agentKey, (perDay.get(agentKey) ?? 0) + count);
        dayMap.set(dayKey, perDay);
        agentTotalsMap.set(agentKey, (agentTotalsMap.get(agentKey) ?? 0) + count);
        agentsWithActivity.add(agentKey);
      });
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const startDay = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    ));
    const endDay = new Date(Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
    ));
    const bucketCount = Math.max(0, Math.floor((endDay.getTime() - startDay.getTime()) / msPerDay)) + 1;

    const buckets: ConversationSeriesBucket[] = [];
    let total = 0;
    for (let i = 0; i < bucketCount; i += 1) {
      const current = new Date(startDay.getTime() + i * msPerDay);
      const key = current.toISOString().slice(0, 10);
      const perDay = dayMap.get(key) ?? new Map<string, number>();
      const byAgent = Array.from(perDay.entries()).map(([agent, count]) => ({ agentId: agent, count }));
      const dayTotal = byAgent.reduce((sum, item) => sum + item.count, 0);
      total += dayTotal;
      buckets.push({ date: key, total: dayTotal, byAgent });
    }

    const relevantAgents = agentId
      ? agentRows.filter((row) => row.id === agentId)
      : agentRows.filter((row) => agentsWithActivity.has(row.id) || agentTotalsMap.has(row.id));

    const agentTotals: ConversationSeriesAgentTotal[] = relevantAgents
      .map((row) => ({
        agentId: row.id,
        name: row.name,
        isActive: !!row.is_active,
        count: agentTotalsMap.get(row.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      agentId: agentId ?? null,
      granularity: 'day',
      buckets,
      total,
      agentTotals,
      generatedAt: new Date().toISOString(),
    };
  }

  async getAgentTotals(params: { start: Date; end: Date }): Promise<AgentComparisonResult> {
    const { start, end } = params;

    const agentRows = await withClient(async (client) => {
      const { rows } = await client.query<{ id: string; name: string; is_active: boolean; app_id: string | null }>(
        'SELECT id, name, is_active, app_id FROM agent_configs ORDER BY name ASC',
      );
      return rows;
    });

    const appIdToAgent = new Map<string, { id: string; name: string; is_active: boolean }>();
    agentRows.forEach((row) => {
      if (row.app_id) {
        appIdToAgent.set(row.app_id, { id: row.id, name: row.name, is_active: row.is_active });
      }
    });

    const appIdObjectIds = Array.from(appIdToAgent.keys())
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const countMap = new Map<string, number>();

    if (appIdObjectIds.length > 0) {
      try {
        const mongoRows = await withMongo(async (db) => {
          const pipeline = [
            {
              $match: {
                createTime: {
                  $gte: start,
                  $lte: end,
                },
                appId: { $in: appIdObjectIds },
              },
            },
            {
              $group: {
                _id: '$appId',
                count: { $sum: 1 },
              },
            },
          ];

          interface MongoAggRow { _id: ObjectId; count: number }
          return db.collection<MongoAggRow>('chats').aggregate(pipeline).toArray();
        });

        mongoRows.forEach((row) => {
          const appId = row._id.toHexString();
          const agent = appIdToAgent.get(appId);
          if (!agent) {
            return;
          }
          const count = Number(row.count || 0);
          countMap.set(agent.id, (countMap.get(agent.id) ?? 0) + count);
        });
      } catch (error: any) {
        logger.warn('[AnalyticsService] Mongo 聚合失败，使用 PostgreSQL 计数', { error });
      }
    }

    if (countMap.size === 0) {
      const pgRows = await withClient(async (client) => {
        const sql = `
          SELECT agent_id, COUNT(*)::int AS count
          FROM chat_geo_events
          WHERE created_at >= $1 AND created_at <= $2
          GROUP BY agent_id
        `;
        const { rows } = await client.query<{ agent_id: string; count: number }>(sql, [start, end]);
        return rows;
      });

      pgRows.forEach((row) => {
        countMap.set(row.agent_id, Number(row.count || 0));
      });
    }

    const totals: ConversationSeriesAgentTotal[] = agentRows
      .filter((row) => countMap.has(row.id))
      .map((row) => ({
        agentId: row.id,
        name: row.name,
        isActive: !!row.is_active,
        count: countMap.get(row.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const total = totals.reduce((sum, item) => sum + item.count, 0);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      totals,
      total,
      generatedAt: new Date().toISOString(),
    };
  }
}

