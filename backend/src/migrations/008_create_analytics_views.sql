-- UP
-- 数据分析视图和聚合表
-- 用于管理员侧的数据统计和分析

-- 1. 智能体使用统计视图
CREATE OR REPLACE VIEW v_agent_usage_stats AS
SELECT 
  ac.id as agent_id,
  ac.name as agent_name,
  ac.provider,
  ac.is_active,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.created_at > NOW() - INTERVAL '24 hours') as sessions_today,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.created_at > NOW() - INTERVAL '7 days') as sessions_this_week,
  COUNT(DISTINCT cs.id) FILTER (WHERE cs.created_at > NOW() - INTERVAL '30 days') as sessions_this_month,
  COUNT(DISTINCT cs.user_id) as unique_users,
  MAX(cs.updated_at) as last_used_at,
  MIN(cs.created_at) as first_used_at
FROM agent_configs ac
LEFT JOIN chat_sessions cs ON ac.id = cs.agent_id
GROUP BY ac.id, ac.name, ac.provider, ac.is_active;

COMMENT ON VIEW v_agent_usage_stats IS '智能体使用统计 - 会话数、用户数、时间维度';

-- 2. 自研智能体消息统计视图 (仅统计本地存储的消息)
CREATE OR REPLACE VIEW v_self_hosted_message_stats AS
SELECT 
  cs.agent_id,
  ac.name as agent_name,
  cs.provider,
  COUNT(cm.id) as total_messages,
  COUNT(cm.id) FILTER (WHERE cm.role = 'user') as user_messages,
  COUNT(cm.id) FILTER (WHERE cm.role = 'assistant') as assistant_messages,
  AVG(LENGTH(cm.content)) as avg_content_length,
  COUNT(DISTINCT cs.id) as sessions_with_messages,
  MAX(cm.created_at) as last_message_at,
  MIN(cm.created_at) as first_message_at
FROM chat_messages cm
JOIN chat_sessions cs ON cm.session_id = cs.id
JOIN agent_configs ac ON cs.agent_id = ac.id
GROUP BY cs.agent_id, ac.name, cs.provider;

COMMENT ON VIEW v_self_hosted_message_stats IS '自研智能体消息统计 - 仅统计本地存储的消息内容';

-- 3. 用户活跃度统计视图
CREATE OR REPLACE VIEW v_user_activity_stats AS
SELECT 
  cs.user_id,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(DISTINCT cs.agent_id) as agents_used,
  COUNT(DISTINCT DATE(cs.created_at)) as active_days,
  MAX(cs.updated_at) as last_active_at,
  MIN(cs.created_at) as first_active_at,
  -- 最常用的智能体
  (
    SELECT ac.name
    FROM chat_sessions cs2
    JOIN agent_configs ac ON cs2.agent_id = ac.id
    WHERE cs2.user_id = cs.user_id
    GROUP BY ac.name
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) as most_used_agent
FROM chat_sessions cs
WHERE cs.user_id IS NOT NULL
GROUP BY cs.user_id;

COMMENT ON VIEW v_user_activity_stats IS '用户活跃度统计 - 会话数、使用的智能体数、活跃天数';

-- 4. 地理分布统计视图
CREATE OR REPLACE VIEW v_geo_distribution_stats AS
SELECT 
  country,
  province,
  city,
  COUNT(*) as event_count,
  COUNT(DISTINCT agent_id) as agents_used,
  COUNT(DISTINCT session_id) as unique_sessions,
  MAX(created_at) as last_event_at
FROM chat_geo_events
WHERE country IS NOT NULL
GROUP BY country, province, city
ORDER BY event_count DESC;

COMMENT ON VIEW v_geo_distribution_stats IS '地理分布统计 - 按国家/省份/城市聚合';

-- 5. 每日统计聚合表 (用于快速查询历史趋势)
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  summary_date DATE PRIMARY KEY,
  total_sessions INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,  -- 仅自研智能体
  active_agents INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  -- 按提供商分类的会话数
  fastgpt_sessions INTEGER DEFAULT 0,
  dify_sessions INTEGER DEFAULT 0,
  openai_sessions INTEGER DEFAULT 0,
  self_hosted_sessions INTEGER DEFAULT 0,  -- 自研智能体（语音电话、产品预览）
  -- 元数据
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_summary_date ON analytics_daily_summary(summary_date DESC);

COMMENT ON TABLE analytics_daily_summary IS '每日统计汇总表 - 用于历史趋势分析和快速查询';

-- 6. 智能体性能指标表
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  -- 性能指标
  avg_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  p99_response_time_ms INTEGER,
  success_rate DECIMAL(5,2),  -- 0-100
  error_count INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  -- 元数据
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_date ON agent_performance_metrics(agent_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_performance_date ON agent_performance_metrics(metric_date DESC);

COMMENT ON TABLE agent_performance_metrics IS '智能体性能指标 - 响应时间、成功率、错误率等';

-- 7. 实时统计函数 - 获取当前系统概览
CREATE OR REPLACE FUNCTION fn_get_system_overview()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_agents', (SELECT COUNT(*) FROM agent_configs WHERE is_active = true),
    'total_sessions', (SELECT COUNT(*) FROM chat_sessions),
    'total_users', (SELECT COUNT(DISTINCT user_id) FROM chat_sessions WHERE user_id IS NOT NULL),
    'sessions_today', (SELECT COUNT(*) FROM chat_sessions WHERE created_at > CURRENT_DATE),
    'active_sessions_1h', (SELECT COUNT(*) FROM chat_sessions WHERE updated_at > NOW() - INTERVAL '1 hour'),
    'self_hosted_messages', (SELECT COUNT(*) FROM chat_messages),
    'messages_today', (SELECT COUNT(*) FROM chat_messages WHERE created_at > CURRENT_DATE),
    'top_agents', (
      SELECT json_agg(
        json_build_object(
          'agent_name', agent_name,
          'provider', provider,
          'sessions', total_sessions
        )
      )
      FROM (
        SELECT agent_name, provider, total_sessions
        FROM v_agent_usage_stats
        ORDER BY total_sessions DESC
        LIMIT 5
      ) top_5
    ),
    'provider_distribution', (
      SELECT json_object_agg(provider, session_count)
      FROM (
        SELECT provider, COUNT(*) as session_count
        FROM chat_sessions
        GROUP BY provider
      ) dist
    ),
    'updated_at', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_get_system_overview() IS '获取系统概览 - 实时统计关键指标';

-- 8. 每日统计聚合函数 (用于定时任务)
CREATE OR REPLACE FUNCTION fn_aggregate_daily_stats(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS VOID AS $$
BEGIN
  INSERT INTO analytics_daily_summary (
    summary_date,
    total_sessions,
    total_users,
    total_messages,
    active_agents,
    fastgpt_sessions,
    dify_sessions,
    openai_sessions,
    self_hosted_sessions,
    metadata
  )
  SELECT
    target_date,
    COUNT(DISTINCT cs.id),
    COUNT(DISTINCT cs.user_id) FILTER (WHERE cs.user_id IS NOT NULL),
    (SELECT COUNT(*) FROM chat_messages WHERE DATE(created_at) = target_date),
    COUNT(DISTINCT cs.agent_id),
    COUNT(*) FILTER (WHERE cs.provider = 'fastgpt'),
    COUNT(*) FILTER (WHERE cs.provider = 'dify'),
    COUNT(*) FILTER (WHERE cs.provider = 'openai'),
    COUNT(*) FILTER (WHERE cs.provider IN ('voice-call', 'product-preview')),
    json_build_object(
      'aggregated_at', NOW(),
      'data_sources', json_build_object(
        'chat_sessions', true,
        'chat_messages', true,
        'agent_configs', true
      )
    )
  FROM chat_sessions cs
  WHERE DATE(cs.created_at) = target_date
  ON CONFLICT (summary_date) 
  DO UPDATE SET
    total_sessions = EXCLUDED.total_sessions,
    total_users = EXCLUDED.total_users,
    total_messages = EXCLUDED.total_messages,
    active_agents = EXCLUDED.active_agents,
    fastgpt_sessions = EXCLUDED.fastgpt_sessions,
    dify_sessions = EXCLUDED.dify_sessions,
    openai_sessions = EXCLUDED.openai_sessions,
    self_hosted_sessions = EXCLUDED.self_hosted_sessions,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_aggregate_daily_stats(DATE) IS '聚合指定日期的每日统计数据';

-- DOWN
DROP FUNCTION IF EXISTS fn_aggregate_daily_stats(DATE);
DROP FUNCTION IF EXISTS fn_get_system_overview();
DROP TABLE IF EXISTS agent_performance_metrics;
DROP TABLE IF EXISTS analytics_daily_summary;
DROP VIEW IF EXISTS v_geo_distribution_stats;
DROP VIEW IF EXISTS v_user_activity_stats;
DROP VIEW IF EXISTS v_self_hosted_message_stats;
DROP VIEW IF EXISTS v_agent_usage_stats;

