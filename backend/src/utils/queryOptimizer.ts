/**
 * 数据库查询优化器
 *
 * 提供查询优化建议、慢查询检测、索引推荐等功能
 */

import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

// 查询性能指标
export interface QueryMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  rowCount: number;
  planningTime?: number;
  bufferHits?: number;
  cacheHitRatio?: number;
  timestamp: Date;
}

// 查询优化建议
export interface OptimizationSuggestion {
  type: 'index' | 'query_rewrite' | 'partition' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  sql: string;
  expectedImprovement: string;
  currentMetrics?: QueryMetrics;
}

// 索引推荐
export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  estimatedImpact: string;
  createSql: string;
}

/**
 * 数据库查询优化器类
 */
export class DatabaseQueryOptimizer {
  private pool: Pool;
  private slowQueryThreshold: number = 1000; // 1秒
  private slowQueries: Map<string, QueryMetrics[]> = new Map();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * 分析查询执行计划
   */
  async analyzeQuery(query: string, params: any[] = []): Promise<{
    plan: any;
    suggestions: OptimizationSuggestion[];
    metrics: Partial<QueryMetrics>;
  }> {
    const client = await this.pool.connect();
    try {
      // 获取查询执行计划
      const planResult = await client.query(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + query,
        params
      );

      const plan = planResult.rows[0];
      const suggestions = this.generateSuggestionsFromPlan(plan);
      const metrics = this.extractMetricsFromPlan(plan);

      return {
        plan,
        suggestions,
        metrics
      };
    } finally {
      client.release();
    }
  }

  /**
   * 从执行计划中提取指标
   */
  private extractMetricsFromPlan(plan: any): Partial<QueryMetrics> {
    return {
      planningTime: plan['Planning Time'],
      executionTime: plan['Execution Time'],
      bufferHits: plan['Shared Hit Blocks'],
      rowCount: plan['Actual Rows']
    };
  }

  /**
   * 基于执行计划生成优化建议
   */
  private generateSuggestionsFromPlan(plan: any): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 检查是否进行了全表扫描
    if (plan.Plan?.Nodes?.some((node: any) => node['Node Type'] === 'Seq Scan')) {
      suggestions.push({
        type: 'index',
        severity: 'high',
        description: '检测到全表扫描，建议添加索引',
        sql: '-- 建议的索引创建语句',
        expectedImprovement: '查询性能提升60-90%'
      });
    }

    // 检查是否有排序操作
    if (plan.Plan?.Nodes?.some((node: any) => node['Node Type'] === 'Sort')) {
      suggestions.push({
        type: 'index',
        severity: 'medium',
        description: '检测到排序操作，建议添加排序索引',
        sql: '-- 建议：CREATE INDEX ON table_name (sort_column)',
        expectedImprovement: '排序性能提升40-70%'
      });
    }

    // 检查是否有哈希连接
    if (plan.Plan?.Nodes?.some((node: any) => node['Node Type'] === 'Hash')) {
      suggestions.push({
        type: 'query_rewrite',
        severity: 'low',
        description: '检测到哈希连接，考虑使用嵌套循环连接',
        sql: '-- 建议：重写查询使用JOIN语法',
        expectedImprovement: '连接性能提升10-30%'
      });
    }

    return suggestions;
  }

  /**
   * 生成索引推荐
   */
  async generateIndexRecommendations(): Promise<IndexRecommendation[]> {
    const client = await this.pool.connect();
    try {
      const recommendations: IndexRecommendation[] = [];

      // 查询最常见的查询模式
      const queryPatterns = await this.getCommonQueryPatterns(client);

      for (const pattern of queryPatterns) {
        const existingIndexes = await this.getExistingIndexes(client, pattern.tableName);
        const recommendedIndexes = this.recommendIndexes(pattern, existingIndexes);

        recommendations.push(...recommendedIndexes);
      }

      return recommendations;
    } finally {
      client.release();
    }
  }

  /**
   * 获取常见查询模式
   */
  private async getCommonQueryPatterns(client: PoolClient): Promise<any[]> {
    const queries = [
      {
        tableName: 'chat_sessions',
        pattern: 'user_id, agent_id',
        reason: '用户会话列表查询'
      },
      {
        tableName: 'chat_messages',
        pattern: 'session_id, created_at',
        reason: '消息历史查询'
      },
      {
        tableName: 'audit_logs',
        pattern: 'user_id, created_at',
        reason: '审计日志查询'
      },
      {
        tableName: 'users',
        pattern: 'username, role',
        reason: '用户认证查询'
      }
    ];

    return queries;
  }

  /**
   * 获取已存在的索引
   */
  private async getExistingIndexes(client: PoolClient, tableName: string): Promise<string[]> {
    try {
      const result = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = $1 AND schemaname = 'public'
      `, [tableName]);

      return result.rows.map(row => row.indexname);
    } catch (error) {
      logger.warn(`获取表 ${tableName} 索引失败`, { error });
      return [];
    }
  }

  /**
   * 推荐索引
   */
  private recommendIndexes(pattern: any, existingIndexes: string[]): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    const columns = pattern.pattern.split(',').map((col: string) => col.trim());
    const indexName = `idx_${pattern.tableName}_${columns.join('_')}`;

    if (!existingIndexes.includes(indexName)) {
      recommendations.push({
        tableName: pattern.tableName,
        columns,
        indexType: 'btree',
        reason: pattern.reason,
        estimatedImpact: '查询性能提升50-80%',
        createSql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${pattern.tableName} (${columns.join(', ')});`
      });
    }

    return recommendations;
  }

  /**
   * 检测慢查询
   */
  async detectSlowQueries(): Promise<QueryMetrics[]> {
    const client = await this.pool.connect();
    try {
      // 查询pg_stat_statements获取慢查询统计
      const result = await client.query(`
        SELECT
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time,
          stddev_exec_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `, [this.slowQueryThreshold]);

      return result.rows.map(row => ({
        queryId: this.generateQueryId(row.query),
        query: row.query,
        executionTime: row.mean_exec_time,
        rowCount: row.rows,
        cacheHitRatio: row.hit_percent,
        timestamp: new Date()
      }));
    } finally {
      client.release();
    }
  }

  /**
   * 生成查询ID
   */
  private generateQueryId(query: string): string {
    // 使用查询的哈希值作为ID
    return require('crypto')
      .createHash('md5')
      .update(query)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * 优化查询语句
   */
  optimizeQuery(sql: string): {
    optimized: string;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    const optimized = sql;

    // 优化1: 添加LIMIT子句
    if (!sql.match(/LIMIT\s+\d+/i)) {
      // 对于没有LIMIT的SELECT查询，建议添加
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        suggestions.push('建议添加LIMIT子句限制返回行数');
        // 注意：这里只是建议，不自动添加，避免破坏业务逻辑
      }
    }

    // 优化2: 使用EXISTS替代IN子查询
    if (sql.includes(' WHERE ') && sql.includes(' IN (SELECT')) {
      suggestions.push('考虑使用EXISTS替代IN子查询以提高性能');
    }

    // 优化3: 建议使用批量操作
    if (sql.includes('INSERT INTO') && !sql.includes('INSERT ALL')) {
      suggestions.push('对于大量插入，考虑使用批量插入或COPY命令');
    }

    // 优化4: 检查是否可以使用UNION ALL替代UNION
    if (sql.includes('UNION ') && !sql.includes('UNION ALL ')) {
      suggestions.push('如果不需要去重，使用UNION ALL替代UNION以提升性能');
    }

    return {
      optimized,
      suggestions
    };
  }

  /**
   * 生成数据库性能报告
   */
  async generatePerformanceReport(): Promise<{
    slowQueries: QueryMetrics[];
    indexRecommendations: IndexRecommendation[];
    databaseStats: any;
    suggestions: string[];
  }> {
    const slowQueries = await this.detectSlowQueries();
    const indexRecommendations = await this.generateIndexRecommendations();

    // 获取数据库统计信息
    const client = await this.pool.connect();
    try {
      const statsResult = await client.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows,
          last_vacuum,
          last_autovacuum
        FROM pg_stat_user_tables
        ORDER BY schemaname, tablename
      `);

      return {
        slowQueries,
        indexRecommendations,
        databaseStats: statsResult.rows,
        suggestions: this.generateOverallSuggestions(slowQueries, indexRecommendations)
      };
    } finally {
      client.release();
    }
  }

  /**
   * 生成整体优化建议
   */
  private generateOverallSuggestions(
    slowQueries: QueryMetrics[],
    indexRecommendations: IndexRecommendation[]
  ): string[] {
    const suggestions: string[] = [];

    if (slowQueries.length > 0) {
      suggestions.push(`发现 ${slowQueries.length} 个慢查询，建议优先优化`);
    }

    if (indexRecommendations.length > 0) {
      suggestions.push(`推荐创建 ${indexRecommendations.length} 个索引以提升查询性能`);
    }

    if (slowQueries.some(q => q.executionTime > 5000)) {
      suggestions.push('存在严重慢查询（>5秒），需要立即处理');
    }

    return suggestions;
  }

  /**
   * 执行推荐的索引创建
   */
  async executeIndexCreation(indexSql: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(indexSql);
      logger.info('索引创建成功', { sql: indexSql });
    } catch (error) {
      logger.error('索引创建失败', { sql: indexSql, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 清理统计信息
   */
  async resetStatistics(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_stat_reset()');
      logger.info('数据库统计信息已重置');
    } finally {
      client.release();
    }
  }
}

/**
 * 查询优化器实例（单例）
 */
let queryOptimizerInstance: DatabaseQueryOptimizer | null = null;

export function getQueryOptimizer(pool: Pool): DatabaseQueryOptimizer {
  if (!queryOptimizerInstance) {
    queryOptimizerInstance = new DatabaseQueryOptimizer(pool);
  }
  return queryOptimizerInstance;
}