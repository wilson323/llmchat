# 管理员数据分析功能

## 概述

管理员数据分析功能提供了全面的数据洞察，帮助管理员了解系统使用情况、智能体表现和用户行为。

**重要说明**: 由于采用**混合存储架构**，分析功能需要区分：
- **第三方智能体**（FastGPT、Dify）- 仅分析会话元数据，消息内容在其平台
- **自研智能体**（语音电话、产品预览）- 可分析完整的消息内容

## 数据分析维度

### 1. 智能体使用统计

**数据来源**: `v_agent_usage_stats` 视图

**指标**:
- 总会话数
- 今日/本周/本月会话数
- 独立用户数
- 最后使用时间
- 首次使用时间

**API 端点**:
```
GET /api/admin/analytics/agents
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "agent_id": "fastgpt-assistant",
      "agent_name": "FastGPT 助手",
      "provider": "fastgpt",
      "is_active": true,
      "total_sessions": 1523,
      "sessions_today": 45,
      "sessions_this_week": 312,
      "sessions_this_month": 1205,
      "unique_users": 89,
      "last_used_at": "2025-10-02T14:30:00Z",
      "first_used_at": "2025-08-01T08:00:00Z"
    },
    {
      "agent_id": "voice-conversation-assistant",
      "agent_name": "语音通话助手",
      "provider": "voice-call",
      "is_active": true,
      "total_sessions": 456,
      "sessions_today": 23,
      "sessions_this_week": 145,
      "sessions_this_month": 398,
      "unique_users": 34,
      "last_used_at": "2025-10-02T15:20:00Z",
      "first_used_at": "2025-08-15T10:00:00Z"
    }
  ]
}
```

### 2. 自研智能体消息统计

**数据来源**: `v_self_hosted_message_stats` 视图

**指标**:
- 总消息数
- 用户消息数
- 助手消息数
- 平均内容长度
- 有消息的会话数

**注意**: **仅适用于自研智能体**，第三方智能体的消息内容不在此统计。

**API 端点**:
```
GET /api/admin/analytics/messages
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "agent_id": "voice-conversation-assistant",
      "agent_name": "语音通话助手",
      "provider": "voice-call",
      "total_messages": 8942,
      "user_messages": 4523,
      "assistant_messages": 4419,
      "avg_content_length": 127.5,
      "sessions_with_messages": 456,
      "last_message_at": "2025-10-02T15:20:00Z",
      "first_message_at": "2025-08-15T10:15:00Z"
    },
    {
      "agent_id": "product-scene-preview",
      "agent_name": "产品现场预览",
      "provider": "product-preview",
      "total_messages": 2341,
      "user_messages": 1205,
      "assistant_messages": 1136,
      "avg_content_length": 89.2,
      "sessions_with_messages": 312,
      "last_message_at": "2025-10-02T14:45:00Z",
      "first_message_at": "2025-08-20T09:00:00Z"
    }
  ],
  "note": "此统计仅包含自研智能体的消息，第三方智能体(FastGPT/Dify)的消息内容由其平台管理"
}
```

### 3. 用户活跃度统计

**数据来源**: `v_user_activity_stats` 视图

**指标**:
- 总会话数
- 使用的智能体数量
- 活跃天数
- 最后活跃时间
- 首次使用时间
- 最常用的智能体

**API 端点**:
```
GET /api/admin/analytics/users
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "user_id": "user_001",
      "total_sessions": 234,
      "agents_used": 5,
      "active_days": 45,
      "last_active_at": "2025-10-02T15:30:00Z",
      "first_active_at": "2025-08-15T08:00:00Z",
      "most_used_agent": "FastGPT 助手"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 89
  }
}
```

### 4. 地理分布统计

**数据来源**: `v_geo_distribution_stats` 视图

**指标**:
- 按国家/省份/城市聚合的事件数
- 使用的智能体数
- 独立会话数
- 最后事件时间

**API 端点**:
```
GET /api/admin/analytics/geo
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "country": "中国",
      "province": "广东省",
      "city": "深圳市",
      "event_count": 3452,
      "agents_used": 6,
      "unique_sessions": 1823,
      "last_event_at": "2025-10-02T15:45:00Z"
    },
    {
      "country": "中国",
      "province": "北京市",
      "city": "北京市",
      "event_count": 2891,
      "agents_used": 5,
      "unique_sessions": 1456,
      "last_event_at": "2025-10-02T15:40:00Z"
    }
  ]
}
```

### 5. 系统概览

**数据来源**: `fn_get_system_overview()` 函数（实时计算）

**指标**:
- 总智能体数
- 总会话数
- 总用户数
- 今日会话数
- 1小时内活跃会话数
- 自研消息数
- Top 5 智能体
- 提供商分布

**API 端点**:
```
GET /api/admin/analytics/overview
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_agents": 8,
    "total_sessions": 2435,
    "total_users": 156,
    "sessions_today": 89,
    "active_sessions_1h": 12,
    "self_hosted_messages": 11283,
    "messages_today": 234,
    "top_agents": [
      {
        "agent_name": "FastGPT 助手",
        "provider": "fastgpt",
        "sessions": 1523
      },
      {
        "agent_name": "语音通话助手",
        "provider": "voice-call",
        "sessions": 456
      }
    ],
    "provider_distribution": {
      "fastgpt": 1523,
      "dify": 234,
      "voice-call": 456,
      "product-preview": 222
    },
    "updated_at": "2025-10-02T15:50:00Z"
  }
}
```

### 6. 每日趋势分析

**数据来源**: `analytics_daily_summary` 表

**指标**:
- 每日会话数
- 每日用户数
- 每日消息数（自研）
- 活跃智能体数
- 按提供商分类的会话数

**API 端点**:
```
GET /api/admin/analytics/trends?days=30
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "30 days",
    "start_date": "2025-09-02",
    "end_date": "2025-10-02",
    "daily_stats": [
      {
        "summary_date": "2025-10-02",
        "total_sessions": 89,
        "total_users": 45,
        "total_messages": 234,
        "active_agents": 7,
        "fastgpt_sessions": 45,
        "dify_sessions": 12,
        "self_hosted_sessions": 32
      },
      // ... more days
    ],
    "aggregates": {
      "total_sessions": 2678,
      "avg_sessions_per_day": 89.3,
      "peak_day": "2025-09-25",
      "peak_sessions": 145
    }
  }
}
```

### 7. 智能体性能指标

**数据来源**: `agent_performance_metrics` 表

**指标**:
- 平均响应时间
- P95/P99 响应时间
- 成功率
- 错误数
- 请求数

**API 端点**:
```
GET /api/admin/analytics/performance?agent_id=fastgpt-assistant&days=7
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "agent_id": "fastgpt-assistant",
    "agent_name": "FastGPT 助手",
    "period": "7 days",
    "metrics": [
      {
        "metric_date": "2025-10-02",
        "avg_response_time_ms": 1234,
        "p95_response_time_ms": 2345,
        "p99_response_time_ms": 3456,
        "success_rate": 98.5,
        "error_count": 3,
        "request_count": 198
      },
      // ... more days
    ],
    "aggregates": {
      "avg_response_time_ms": 1156,
      "overall_success_rate": 98.2,
      "total_requests": 1456
    }
  }
}
```

## 数据聚合任务

### 每日统计聚合

**任务**: 每天凌晨聚合前一天的统计数据

**实现方式**:

**选项1: Cron 任务** (推荐用于生产环境)

```bash
# crontab
0 1 * * * psql -d llmchat -c "SELECT fn_aggregate_daily_stats();"
```

**选项2: Node.js 定时任务**

```typescript
// backend/src/jobs/dailyAggregation.ts
import cron from 'node-cron';
import { getPool } from '@/utils/db';
import logger from '@/utils/logger';

export function startDailyAggregation() {
  // 每天凌晨1点执行
  cron.schedule('0 1 * * *', async () => {
    logger.info('开始每日统计聚合');
    
    try {
      const pool = getPool();
      await pool.query('SELECT fn_aggregate_daily_stats()');
      logger.info('每日统计聚合完成');
    } catch (error) {
      logger.error('每日统计聚合失败', { error });
    }
  });
}
```

**选项3: 手动执行**

```sql
-- 聚合昨天的数据
SELECT fn_aggregate_daily_stats();

-- 聚合指定日期的数据
SELECT fn_aggregate_daily_stats('2025-10-01'::DATE);
```

## 前端展示设计

### 1. 仪表板布局

```
┌─────────────────────────────────────────────────┐
│              系统概览卡片区                      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │会话 │ │用户 │ │消息 │ │智能体│ │活跃 │       │
│  │2435 │ │156  │ │11K  │ │8    │ │12   │       │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │
└─────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────┐
│  智能体使用排行           │  提供商分布饼图       │
│  1. FastGPT 助手 (1523)  │                      │
│  2. 语音通话助手 (456)    │   [Pie Chart]        │
│  3. Dify 助手 (234)      │                      │
│  4. 产品预览 (222)        │                      │
│  5. ...                  │                      │
└──────────────────────────┴──────────────────────┘
┌─────────────────────────────────────────────────┐
│              30天趋势折线图                      │
│   [Line Chart: 会话数/用户数/消息数]             │
└─────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────┐
│  地理分布地图             │  用户活跃度表格       │
│  [China Map with dots]   │  [User Table]        │
└──────────────────────────┴──────────────────────┘
```

### 2. 智能体详情页

```
┌─────────────────────────────────────────────────┐
│  智能体: FastGPT 助手                            │
│  提供商: fastgpt  状态: 活跃                     │
├─────────────────────────────────────────────────┤
│  基础指标                                        │
│  总会话: 1523  今日: 45  本周: 312  本月: 1205  │
│  独立用户: 89  首次使用: 2025-08-01             │
├─────────────────────────────────────────────────┤
│  性能指标 (7天)                                  │
│  平均响应时间: 1156ms  成功率: 98.2%            │
│  [Performance Chart]                            │
├─────────────────────────────────────────────────┤
│  消息统计 (仅自研智能体)                         │
│  不适用 - 第三方智能体的消息内容由其平台管理      │
└─────────────────────────────────────────────────┘
```

### 3. 用户分析页

```
┌─────────────────────────────────────────────────┐
│  用户分析                                        │
├─────────────────────────────────────────────────┤
│  [User Table with filters]                     │
│  用户ID | 总会话 | 智能体数 | 活跃天数 | 最后活跃 │
│  ------------------------------------------------│
│  user_1 |  234  |    5    |   45    | 今天     │
│  user_2 |  189  |    3    |   38    | 昨天     │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

## 实现清单

### 后端实现

- [x] 创建数据分析视图（008迁移脚本）
- [ ] 实现 `AnalyticsService`
- [ ] 实现 `AnalyticsController`
- [ ] 添加管理员鉴权中间件
- [ ] 实现API端点
- [ ] 添加单元测试
- [ ] 配置定时聚合任务

### 前端实现

- [ ] 创建 `AdminAnalytics` 页面
- [ ] 实现仪表板布局
- [ ] 集成图表库 (ECharts/Recharts)
- [ ] 实现数据刷新机制
- [ ] 添加导出功能
- [ ] 响应式设计

### 文档与部署

- [ ] API文档更新
- [ ] 用户使用手册
- [ ] 部署配置说明
- [ ] 性能测试

## 注意事项

### 1. 数据隐私

- 用户个人数据需要脱敏显示
- 遵守GDPR和本地隐私法规
- 管理员日志记录所有查询操作

### 2. 性能优化

- 使用物化视图缓存复杂查询
- 定期刷新物化视图
- 为大表添加分区
- 限制历史数据查询范围

### 3. 第三方数据

- 明确标识第三方智能体数据的局限性
- 考虑从第三方API获取补充数据（需要额外实现）
- 提供数据完整性说明

---

**文档版本**: 1.0  
**最后更新**: 2025-10-02  
**维护者**: LLMChat 开发团队

