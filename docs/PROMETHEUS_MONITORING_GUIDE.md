# Prometheus监控系统使用指南

**版本**: 1.0.0  
**日期**: 2025-10-20  
**状态**: 已实施

---

## 📊 监控概述

LLMChat后端已集成完整的Prometheus监控系统，提供实时的性能指标和系统健康状态监控。

### 核心指标

#### 1. HTTP请求指标

**响应时间直方图**：
- 指标名称: `llmchat_http_request_duration_seconds`
- 类型: Histogram
- 标签:
  - `method`: HTTP方法（GET, POST等）
  - `route`: API路由路径
  - `status_code`: HTTP状态码
- 分桶: 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s

**请求总数**：
- 指标名称: `llmchat_http_requests_total`
- 类型: Counter
- 标签: 同上

**错误请求数**：
- 指标名称: `llmchat_http_request_errors_total`
- 类型: Counter
- 标签:
  - `method`: HTTP方法
  - `route`: API路由
  - `error_type`: 错误类型（client_error/server_error）

**活动连接数**：
- 指标名称: `llmchat_active_connections`
- 类型: Gauge
- 描述: 当前活动的HTTP连接数

#### 2. 系统资源指标

所有指标带 `llmchat_` 前缀：

- `process_cpu_user_seconds_total`: 用户CPU时间
- `process_cpu_system_seconds_total`: 系统CPU时间
- `process_resident_memory_bytes`: 常驻内存
- `process_heap_bytes`: 堆内存使用
- `nodejs_eventloop_lag_seconds`: 事件循环延迟
- `nodejs_gc_duration_seconds`: GC持续时间

---

## 🚀 快速开始

### 1. 访问Metrics端点

```bash
# 获取所有监控指标
curl http://localhost:3005/metrics

# 使用jq美化JSON输出（如果有JSON格式）
curl http://localhost:3005/metrics | grep "llmchat"
```

### 2. 配置Prometheus抓取

创建 `prometheus.yml` 配置文件：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'llmchat-backend'
    static_configs:
      - targets: ['localhost:3005']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### 3. 启动Prometheus

```bash
# Docker方式
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# 访问Prometheus UI
# http://localhost:9090
```

### 4. 配置Grafana可视化

**添加数据源**：
1. 访问 Grafana: http://localhost:3000
2. Configuration > Data Sources > Add data source
3. 选择 Prometheus
4. URL: `http://prometheus:9090` (Docker) 或 `http://localhost:9090`
5. 点击 Save & Test

**导入Dashboard**：
1. Create > Import
2. 使用以下查询创建面板

---

## 📈 常用查询示例

### HTTP请求性能

#### 平均响应时间（最近5分钟）
```promql
rate(llmchat_http_request_duration_seconds_sum[5m]) 
/ 
rate(llmchat_http_request_duration_seconds_count[5m])
```

#### 95th百分位响应时间
```promql
histogram_quantile(0.95, 
  rate(llmchat_http_request_duration_seconds_bucket[5m])
)
```

#### 请求速率（QPS）
```promql
rate(llmchat_http_requests_total[1m])
```

#### 按路由分组的QPS
```promql
sum(rate(llmchat_http_requests_total[1m])) by (route)
```

#### 错误率
```promql
sum(rate(llmchat_http_request_errors_total[5m])) 
/ 
sum(rate(llmchat_http_requests_total[5m])) * 100
```

#### 按状态码分组的请求数
```promql
sum(rate(llmchat_http_requests_total[5m])) by (status_code)
```

### 系统资源监控

#### CPU使用率
```promql
rate(process_cpu_user_seconds_total{job="llmchat-backend"}[5m]) * 100
```

#### 内存使用（MB）
```promql
process_resident_memory_bytes{job="llmchat-backend"} / 1024 / 1024
```

#### 事件循环延迟（毫秒）
```promql
nodejs_eventloop_lag_seconds{job="llmchat-backend"} * 1000
```

#### GC暂停时间
```promql
rate(nodejs_gc_duration_seconds_sum[5m])
```

### 活动连接监控

#### 当前活动连接数
```promql
llmchat_active_connections
```

#### 最大活动连接数（最近1小时）
```promql
max_over_time(llmchat_active_connections[1h])
```

---

## 🎯 告警规则示例

创建 `alert_rules.yml`：

```yaml
groups:
  - name: llmchat_alerts
    interval: 30s
    rules:
      # 高响应时间告警
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(llmchat_http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高响应时间检测"
          description: "95th百分位响应时间超过2秒"

      # 高错误率告警
      - alert: HighErrorRate
        expr: |
          sum(rate(llmchat_http_request_errors_total[5m])) 
          / 
          sum(rate(llmchat_http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "高错误率检测"
          description: "错误率超过5%"

      # 内存使用告警
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes{job="llmchat-backend"} > 1073741824
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "高内存使用"
          description: "内存使用超过1GB"

      # 事件循环延迟告警
      - alert: HighEventLoopLag
        expr: nodejs_eventloop_lag_seconds{job="llmchat-backend"} > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "事件循环延迟过高"
          description: "事件循环延迟超过100ms"
```

---

## 🔧 高级配置

### 自定义指标标签

在代码中记录自定义标签：

```typescript
import { prometheusService } from '@/services/PrometheusService';

// 记录请求
prometheusService.recordHttpRequest(
  'POST',
  '/api/chat/completions',
  200,
  0.123 // 123ms
);
```

### 路由标准化

系统自动标准化路由，移除动态参数：

- `/api/agents/uuid-123` → `/api/agents/:id`
- `/api/sessions/456` → `/api/sessions/:id`
- `/api/tokens/long-token-string` → `/api/tokens/:token`

### 性能优化

监控中间件设计为低开销：
- 使用 `process.hrtime()` 高精度计时
- 异步指标记录
- 最小内存占用

---

## 📊 Grafana Dashboard配置

### 推荐面板

**1. 概览面板**
- 当前QPS
- 平均响应时间
- 错误率
- 活动连接数

**2. 响应时间面板**
- 95th、99th百分位趋势图
- 按路由分组的响应时间
- 响应时间分布直方图

**3. 错误监控面板**
- 错误率趋势
- 按状态码分组的错误数
- 按路由分组的错误率

**4. 系统资源面板**
- CPU使用率
- 内存使用
- 事件循环延迟
- GC暂停时间

### Dashboard JSON模板

```json
{
  "dashboard": {
    "title": "LLMChat Backend Monitoring",
    "panels": [
      {
        "title": "Request Rate (QPS)",
        "targets": [
          {
            "expr": "sum(rate(llmchat_http_requests_total[1m]))"
          }
        ]
      },
      {
        "title": "95th Percentile Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(llmchat_http_request_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

---

## 🐛 故障排查

### 问题: Metrics端点返回404

**检查**:
1. 确认后端服务运行中
2. 验证路由配置: `GET /metrics`
3. 检查日志: `grep "metrics" backend/log/app-*.log`

**解决**:
```bash
# 重启后端服务
cd backend
pnpm run dev
```

### 问题: Prometheus无法抓取指标

**检查**:
1. 确认 `prometheus.yml` 配置正确
2. 验证网络连接: `curl http://localhost:3005/metrics`
3. 检查Prometheus日志

**解决**:
```bash
# 检查Prometheus配置
docker logs prometheus

# 测试连通性
curl -v http://localhost:3005/metrics
```

### 问题: 指标数据不准确

**可能原因**:
1. 时间窗口设置过短
2. 路由标准化问题
3. 请求未经过监控中间件

**检查**:
```typescript
// 确认中间件注册顺序
app.use(prometheusMiddleware()); // 应在路由前
app.use('/api', routes);
```

---

## 📚 最佳实践

### 1. 监控指标选择

**关键指标**:
- 响应时间（95th/99th百分位）
- 错误率
- 吞吐量（QPS）
- 资源使用（CPU、内存）

**避免过度监控**:
- 不记录敏感信息（密码、token）
- 限制标签基数（避免高基数标签）
- 定期清理旧指标

### 2. 告警配置

**告警级别**:
- Critical: 影响用户服务
- Warning: 潜在问题
- Info: 通知性信息

**告警策略**:
- 设置合理的阈值
- 避免告警风暴
- 建立升级机制

### 3. 性能优化

**监控开销**:
- 监控中间件: < 1ms
- 指标收集: 异步处理
- 内存占用: < 10MB

**优化建议**:
- 调整抓取间隔（10-60秒）
- 限制指标保留时间
- 使用标签过滤减少查询量

---

## 🔗 相关资源

**官方文档**:
- [Prometheus官方文档](https://prometheus.io/docs/)
- [prom-client库文档](https://github.com/siimon/prom-client)
- [Grafana文档](https://grafana.com/docs/)

**LLMChat相关**:
- 健康检查: `GET /health/detailed`
- 代码实现: `backend/src/services/PrometheusService.ts`
- 中间件: `backend/src/middleware/prometheusMiddleware.ts`

---

**最后更新**: 2025-10-20  
**维护者**: LLMChat开发团队  
**版本**: 1.0.0

