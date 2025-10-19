-- 性能优化索引
-- 创建日期: 2025-10-18
-- 目的: 优化数据库查询性能

-- ============================================
-- 用户表索引优化
-- ============================================

-- 用户登录优化索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_status
ON users(username, status)
WHERE status = 'active';

-- 邮箱查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified
ON users(email)
WHERE email IS NOT NULL AND email_verified = true;

-- 角色查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status
ON users(role, status)
WHERE status = 'active';

-- 登录时间分析索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login
ON users(last_login_at DESC NULLS LAST)
WHERE last_login_at IS NOT NULL;

-- 失败登录尝试索引（用于安全监控）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_locked_until
ON users(locked_until)
WHERE locked_until IS NOT NULL;

-- ============================================
-- 聊天会话表索引优化
-- ============================================

-- 用户会话列表查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_updated
ON chat_sessions(user_id, updated_at DESC)
WHERE user_id IS NOT NULL;

-- 智能体会话查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_agent_updated
ON chat_sessions(agent_id, updated_at DESC);

-- 复合索引：用户+智能体+时间
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_agent_time
ON chat_sessions(user_id, agent_id, updated_at DESC)
WHERE user_id IS NOT NULL;

-- 会话创建时间索引（用于清理旧会话）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_created_at
ON chat_sessions(created_at DESC);

-- ============================================
-- 聊天消息表索引优化
-- ============================================

-- 消息历史查询优化（最重要的索引）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_time
ON chat_messages(session_id, created_at DESC);

-- 消息角色过滤索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_role
ON chat_messages(session_id, role, created_at DESC);

-- 时间范围查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_created_at
ON chat_messages(created_at DESC);

-- 消息内容搜索索引（如果需要文本搜索）
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_content_gin
-- ON chat_messages USING gin(to_tsvector('english', content));

-- ============================================
-- 审计日志表索引优化
-- ============================================

-- 用户审计日志查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_time
ON audit_logs(user_id, timestamp DESC)
WHERE user_id IS NOT NULL;

-- 操作类型查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_time
ON audit_logs(action, timestamp DESC);

-- 资源审计查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_time
ON audit_logs(resource_type, resource_id, timestamp DESC)
WHERE resource_type IS NOT NULL;

-- 状态过滤索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_status_time
ON audit_logs(status, timestamp DESC);

-- IP地址查询索引（安全分析）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_ip_time
ON audit_logs(ip_address, timestamp DESC)
WHERE ip_address IS NOT NULL;

-- ============================================
-- 智能体配置表索引优化
-- ============================================

-- 提供商查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_configs_provider_active
ON agent_configs(provider, is_active)
WHERE is_active = true;

-- 应用ID查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_configs_app_active
ON agent_configs(app_id, is_active)
WHERE app_id IS NOT NULL AND is_active = true;

-- 更新时间索引（用于缓存失效）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_configs_updated
ON agent_configs(updated_at DESC)
WHERE is_active = true;

-- 功能标签JSON索引（PostgreSQL 12+）
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_configs_capabilities_gin
-- ON agent_configs USING gin(capabilities);

-- ============================================
-- 地理事件表索引优化
-- ============================================

-- 地理位置分析索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_geo_events_agent_time
ON chat_geo_events(agent_id, created_at DESC);

-- 地理位置统计索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_geo_events_location
ON chat_geo_events(country, province, city)
WHERE country IS NOT NULL;

-- IP地址查询索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_geo_events_ip
ON chat_geo_events(ip)
WHERE ip IS NOT NULL;

-- ============================================
-- 分区表建议（大数据量时）
-- ============================================

/*
-- 对于大数据量表，考虑使用分区表

-- 1. 按月分区聊天消息表
CREATE TABLE chat_messages_partitioned (
    LIKE chat_messages INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE chat_messages_2025_01 PARTITION OF chat_messages_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE chat_messages_2025_02 PARTITION OF chat_messages_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- 2. 按月分区审计日志表
CREATE TABLE audit_logs_partitioned (
    LIKE audit_logs INCLUDING ALL
) PARTITION BY RANGE (timestamp);

-- 创建分区
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
*/

-- ============================================
-- 统计信息更新
-- ============================================

-- 更新表统计信息以优化查询计划
ANALYZE users;
ANALYZE chat_sessions;
ANALYZE chat_messages;
ANALYZE audit_logs;
ANALYZE agent_configs;
ANALYZE chat_geo_events;

-- ============================================
-- 性能监控视图
-- ============================================

-- 创建慢查询监控视图
CREATE OR REPLACE VIEW v_slow_queries AS
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
WHERE mean_exec_time > 1000  -- 超过1秒的查询
ORDER BY mean_exec_time DESC;

-- 创建表大小监控视图
CREATE OR REPLACE VIEW v_table_sizes AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 创建索引使用情况视图
CREATE OR REPLACE VIEW v_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 创建未使用的索引视图
CREATE OR REPLACE VIEW v_unused_indexes AS
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC;

-- ============================================
-- 性能优化函数
-- ============================================

-- 自动清理函数
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
    -- 清理30天前的审计日志
    audit_count INTEGER;
    -- 清理90天前的聊天消息
    message_count INTEGER;
    -- 清理未使用的会话
    session_count INTEGER;
BEGIN
    -- 清理旧的审计日志
    DELETE FROM audit_logs
    WHERE timestamp < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS audit_count = ROW_COUNT;

    -- 清理旧的聊天消息（保留最近90天）
    DELETE FROM chat_messages
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS message_count = ROW_COUNT;

    -- 清理30天无活动的会话
    DELETE FROM chat_sessions
    WHERE updated_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (
        SELECT DISTINCT session_id FROM chat_messages
        WHERE created_at >= NOW() - INTERVAL '30 days'
    );
    GET DIAGNOSTICS session_count = ROW_COUNT;

    -- 更新统计信息
    ANALYZE audit_logs;
    ANALYZE chat_messages;
    ANALYZE chat_sessions;

    -- 记录清理日志
    RAISE NOTICE '数据清理完成: 审计日志 % 条, 聊天消息 % 条, 会话 % 条',
        audit_count, message_count, session_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 定时任务设置（需要pg_cron扩展）
-- ============================================

/*
-- 启用pg_cron扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 每天凌晨2点执行数据清理
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- 每小时更新统计信息
SELECT cron.schedule('update-statistics', '0 * * * *', $$
    ANALYZE users;
    ANALYZE chat_sessions;
    ANALYZE chat_messages;
    ANALYZE audit_logs;
    ANALYZE agent_configs;
    ANALYZE chat_geo_events;
$$);

-- 每15分钟重建未使用的索引视图
SELECT cron.schedule('refresh-index-views', '*/15 * * * *', $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY v_unused_indexes;
$$);
*/

-- ============================================
-- 性能提示和说明
-- ============================================

/*
性能优化建议：

1. 定期执行VACUUM和ANALYZE
   - 对于频繁更新的表，设置autovacuum参数
   - 定期手动执行VACUUM ANALYZE

2. 监控慢查询
   - 使用pg_stat_statements扩展
   - 设置log_min_duration_statement参数记录慢查询

3. 连接池优化
   - 设置合适的连接池大小
   - 使用连接池中间件（如PgBouncer）

4. 缓存策略
   - 使用Redis缓存热点数据
   - 实现查询结果缓存

5. 分区表
   - 对于大数据量表（>1000万行），考虑使用分区表
   - 按时间或业务维度分区

6. 读写分离
   - 考虑使用主从复制
   - 读操作使用从库

7. 硬件优化
   - SSD存储提升I/O性能
   - 增加内存减少磁盘I/O
   - 优化网络延迟

索引使用原则：
1. 为WHERE、JOIN、ORDER BY子句的列创建索引
2. 避免过多索引影响写性能
3. 使用复合索引优化多列查询
4. 定期删除未使用的索引
5. 使用部分索引减少索引大小
*/