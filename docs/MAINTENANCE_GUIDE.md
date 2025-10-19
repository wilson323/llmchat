# LLMChat 维护指南

## 📋 目录
- [日常维护任务](#日常维护任务)
- [定期维护计划](#定期维护计划)
- [监控系统](#监控系统)
- [故障处理流程](#故障处理流程)
- [版本管理](#版本管理)
- [备份策略](#备份策略)
- [性能调优](#性能调优)

## 日常维护任务

### 每日检查清单

#### 系统健康检查
```bash
#!/bin/bash
# scripts/daily-health-check.sh

echo "🏥 LLMChat 每日健康检查 - $(date)"

# 1. 检查服务状态
echo "📊 检查服务状态..."
curl -f http://localhost:3001/health || {
  echo "❌ 主服务异常"
  exit 1
}

# 2. 检查数据库连接
echo "🗄️ 检查数据库连接..."
curl -f http://localhost:3001/health/db || {
  echo "❌ 数据库连接异常"
  exit 1
}

# 3. 检查Redis连接
echo "🔴 检查Redis连接..."
curl -f http://localhost:3001/health/redis || {
  echo "❌ Redis连接异常"
  exit 1
}

# 4. 检查磁盘空间
echo "💾 检查磁盘空间..."
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "⚠️ 磁盘使用率过高: ${DISK_USAGE}%"
fi

# 5. 检查内存使用
echo "🧠 检查内存使用..."
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
  echo "⚠️ 内存使用率过高: ${MEMORY_USAGE}%"
fi

# 6. 检查日志错误
echo "📋 检查错误日志..."
ERROR_COUNT=$(grep -c "ERROR" /var/log/llmchat/app.log 2>/dev/null || echo "0")
if [ $ERROR_COUNT -gt 0 ]; then
  echo "⚠️ 发现 $ERROR_COUNT 个错误"
fi

echo "✅ 每日健康检查完成"
```

#### 日志监控
```typescript
// scripts/log-monitor.js
const winston = require('winston');
const fs = require('fs');

class LogMonitor {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'log-monitor.log' })
      ]
    });
  }

  async monitorLogFile(logFile) {
    try {
      const stats = await fs.promises.stat(logFile);
      const lastModified = stats.mtime;
      const now = new Date();
      const diffHours = (now - lastModified) / (1000 * 60 * 60);

      if (diffHours > 1) {
        this.logger.warn('日志文件长时间未更新', {
          logFile,
          lastModified,
          diffHours
        });
      }

      // 检查错误日志
      const content = await fs.promises.readFile(logFile, 'utf8');
      const errorMatches = content.match(/ERROR/g);
      const errorCount = errorMatches ? errorMatches.length : 0;

      if (errorCount > 10) {
        this.logger.error('错误日志过多', {
          logFile,
          errorCount
        });
      }

    } catch (error) {
      this.logger.error('日志监控失败', { error: error.message });
    }
  }

  async startMonitoring() {
    const logFiles = [
      '/var/log/llmchat/app.log',
      '/var/log/llmchat/error.log',
      '/var/log/nginx/access.log'
    ];

    for (const logFile of logFiles) {
      await this.monitorLogFile(logFile);
    }

    this.logger.info('日志监控检查完成');
  }
}

// 启动监控
const monitor = new LogMonitor();
monitor.startMonitoring();
```

### 应用程序监控

#### 自定义健康检查端点
```typescript
// backend/src/health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService
  ) {}

  @Get()
  async getHealthStatus(): Promise<HealthResponse> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
      this.checkDiskSpace(),
      this.checkMemory()
    ]);

    const status = this.aggregateHealthStatus(checks);

    return {
      status,
      timestamp: new Date(),
      checks: this.formatChecks(checks),
      uptime: process.uptime(),
      version: process.env.npm_package_version
    };
  }

  @Get('detailed')
  @UseGuards(AdminGuard)
  async getDetailedHealthStatus(): Promise<DetailedHealthResponse> {
    const [
      databaseStatus,
      redisStatus,
      queueStatus,
      metrics
    ] = await Promise.all([
      this.getDetailedDatabaseStatus(),
      this.getDetailedRedisStatus(),
      this.getQueueStatus(),
      this.getSystemMetrics()
    ]);

    return {
      overall: 'healthy',
      timestamp: new Date(),
      services: {
        database: databaseStatus,
        redis: redisStatus,
        queue: queueStatus
      },
      metrics,
      uptime: process.uptime()
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    try {
      const result = await this.databaseService.query('SELECT 1');
      return {
        name: 'database',
        status: 'healthy',
        responseTime: result.responseTime,
        details: { connected: true }
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        error: error.message,
        details: { connected: false }
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    try {
      const start = Date.now();
      await this.redisService.ping();
      const responseTime = Date.now() - start;

      return {
        name: 'redis',
        status: 'healthy',
        responseTime,
        details: { connected: true }
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private aggregateHealthStatus(checks: PromiseSettledResult<HealthCheck>[]): string {
    const unhealthyCount = checks.filter(
      check => check.status === 'fulfilled' && check.value.status === 'unhealthy'
    ).length;

    if (unhealthyCount === 0) {
      return 'healthy';
    } else if (unhealthyCount < checks.length / 2) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }
}
```

## 定期维护计划

### 周维护任务

#### 数据库维护
```sql
-- scripts/weekly-maintenance.sql

-- 1. 更新统计信息
ANALYZE;

-- 2. 清理过期会话
DELETE FROM chat_sessions
WHERE updated_at < NOW() - INTERVAL '30 days';

-- 3. 清理过期消息
DELETE FROM messages
WHERE created_at < NOW() - INTERVAL '90 days'
AND session_id NOT IN (SELECT id FROM chat_sessions);

-- 4. 重建索引
REINDEX INDEX CONCURRENTLY idx_messages_created_at;
REINDEX INDEX CONCURRENTLY idx_sessions_user_id;

-- 5. 检查数据库大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 6. 检查表统计信息
SELECT
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables;
```

#### 应用程序清理
```bash
#!/bin/bash
# scripts/weekly-cleanup.sh

echo "🧹 LLMChat 周度清理 - $(date)"

# 1. 清理日志文件
echo "📝 清理日志文件..."
find /var/log/llmchat -name "*.log" -mtime +7 -delete
find /var/log/llmchat -name "*.log.*" -mtime +7 -delete

# 2. 清理临时文件
echo "🗂️ 清理临时文件..."
find /tmp -name "llmchat-*" -mtime +1 -delete

# 3. 清理上传文件
echo "📁 清理过期上传文件..."
find /var/uploads -name "*" -mtime +30 -delete

# 4. 数据库备份
echo "💾 执行数据库备份..."
pg_dump llmchat > /backups/llmchat-$(date +%Y%m%d).sql

# 5. 清理旧备份
echo "🗑️ 清理旧备份..."
find /backups -name "llmchat-*.sql" -mtime +30 -delete

# 6. 更新软件包
echo "📦 更新软件包..."
apt-get update && apt-get upgrade -y

echo "✅ 周度清理完成"
```

### 月维护任务

#### 性能分析
```typescript
// scripts/performance-analysis.js
const fs = require('fs');
const path = require('path');

class PerformanceAnalyzer {
  constructor() {
    this.metricsDir = '/var/metrics/llmchat';
  }

  async analyzePerformance() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const metricsFile = path.join(this.metricsDir, `metrics-${currentMonth}.json`);

    try {
      const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));

      const analysis = {
        averageResponseTime: this.calculateAverageResponseTime(metrics),
        errorRate: this.calculateErrorRate(metrics),
        throughput: this.calculateThroughput(metrics),
        memoryUsage: this.analyzeMemoryUsage(metrics),
        databasePerformance: this.analyzeDatabasePerformance(metrics)
      };

      this.generateReport(analysis);
      this.checkThresholds(analysis);

    } catch (error) {
      console.error('性能分析失败:', error.message);
    }
  }

  calculateAverageResponseTime(metrics) {
    const responseTimes = metrics.map(m => m.responseTime).filter(t => t > 0);
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  calculateErrorRate(metrics) {
    const totalRequests = metrics.length;
    const errorRequests = metrics.filter(m => m.status >= 400).length;
    return (errorRequests / totalRequests) * 100;
  }

  checkThresholds(analysis) {
    const alerts = [];

    if (analysis.averageResponseTime > 500) {
      alerts.push({
        type: 'performance',
        message: `平均响应时间过高: ${analysis.averageResponseTime}ms`,
        severity: 'warning'
      });
    }

    if (analysis.errorRate > 1) {
      alerts.push({
        type: 'error_rate',
        message: `错误率过高: ${analysis.errorRate}%`,
        severity: 'critical'
      });
    }

    if (analysis.memoryUsage.average > 80) {
      alerts.push({
        type: 'memory',
        message: `内存使用率过高: ${analysis.memoryUsage.average}%`,
        severity: 'warning'
      });
    }

    if (alerts.length > 0) {
      this.sendAlerts(alerts);
    }
  }

  generateReport(analysis) {
    const report = `
# LLMChat 性能分析报告 - ${new Date().toISOString()}

## 响应时间
- 平均响应时间: ${analysis.averageResponseTime.toFixed(2)}ms
- P95响应时间: ${analysis.responseTime.p95}ms
- P99响应时间: ${analysis.responseTime.p99}ms

## 错误率
- 总体错误率: ${analysis.errorRate.toFixed(2)}%
- 4xx错误: ${analysis.errors.clientError}次
- 5xx错误: ${analysis.errors.serverError}次

## 吞吐量
- 每秒请求数: ${analysis.throughput.rps}
- 每日请求数: ${analysis.throughput.dailyRequests}

## 资源使用
- CPU使用率: ${analysis.cpuUsage.average}%
- 内存使用率: ${analysis.memoryUsage.average}%
- 磁盘使用率: ${analysis.diskUsage.average}%

## 数据库性能
- 连接数: ${analysis.database.connections}
- 查询平均时间: ${analysis.database.averageQueryTime}ms
- 慢查询数量: ${analysis.database.slowQueries}

## 建议
${this.generateRecommendations(analysis)}
    `;

    fs.writeFileSync(
      path.join(this.metricsDir, `performance-report-${new Date().toISOString().slice(0, 10)}.md`),
      report
    );
  }
}

// 执行性能分析
const analyzer = new PerformanceAnalyzer();
analyzer.analyzePerformance();
```

## 监控系统

### 监控配置
```yaml
# monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: llmchat-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    container_name: llmchat-grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123

  alertmanager:
    image: prom/alertmanager:latest
    container_name: llmchat-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager-data:/alertmanager

  node-exporter:
    image: prom/node-exporter:latest
    container_name: llmchat-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'

volumes:
  prometheus-data:
  grafana-data:
  alertmanager-data:
```

### 应用指标收集
```typescript
// backend/src/metrics/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { createPrometheusMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly metrics: ReturnType<typeof createPrometheusMetrics>;

  constructor() {
    this.metrics = createPrometheusMetrics({
      prefix: 'llmchat_',
      labels: ['method', 'route', 'status'],
    });

    this.setupCustomMetrics();
  }

  private setupCustomMetrics() {
    // HTTP请求指标
    this.httpRequestsTotal = new this.metrics.Counter({
      name: 'http_requests_total',
      help: 'HTTP请求总数',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDuration = new this.metrics.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP请求持续时间',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // 业务指标
    this.chatMessagesTotal = new this.metrics.Counter({
      name: 'chat_messages_total',
      help: '聊天消息总数',
      labelNames: ['agent_id', 'status'],
    });

    this.activeSessions = new this.metrics.Gauge({
      name: 'active_sessions_total',
      help: '当前活跃会话数',
    });

    // 系统指标
    this.databaseConnections = new this.metrics.Gauge({
      name: 'database_connections_active',
      help: '活跃数据库连接数',
    });

    this.redisConnections = new this.metrics.Gauge({
      name: 'redis_connections_active',
      help: '活跃Redis连接数',
    });
  }

  // 记录HTTP请求
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe({ method, route }, duration / 1000);
  }

  // 记录聊天消息
  recordChatMessage(agentId: string, status: 'success' | 'error') {
    this.chatMessagesTotal.inc({ agent_id: agentId, status });
  }

  // 更新活跃会话数
  updateActiveSessions(count: number) {
    this.activeSessions.set(count);
  }

  // 更新数据库连接数
  updateDatabaseConnections(count: number) {
    this.databaseConnections.set(count);
  }

  // 获取指标数据
  async getMetrics() {
    return {
      httpRequestsTotal: await this.httpRequestsTotal.get(),
      httpRequestDuration: await this.httpRequestDuration.get(),
      chatMessagesTotal: await this.chatMessagesTotal.get(),
      activeSessions: await this.activeSessions.get(),
      databaseConnections: await this.databaseConnections.get(),
      redisConnections: await this.redisConnections.get(),
    };
  }
}
```

## 故障处理流程

### 故障检测
```typescript
// backend/src/monitoring/fault-detection.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class FaultDetectionService {
  private readonly faultThresholds = {
    errorRate: 0.05, // 5%
    responseTime: 2000, // 2秒
    memoryUsage: 0.9, // 90%
    diskUsage: 0.85, // 85%
  };

  constructor(
    private readonly metricsService: MetricsService,
    private readonly notificationService: NotificationService
  ) {}

  @Cron('*/5 * * * *') // 每5分钟检查一次
  async performHealthCheck() {
    const metrics = await this.metricsService.getMetrics();
    const faults = await this.detectFaults(metrics);

    if (faults.length > 0) {
      await this.handleFaults(faults);
    }
  }

  private async detectFaults(metrics: any): Promise<Fault[]> {
    const faults: Fault[] = [];

    // 检查错误率
    const errorRate = this.calculateErrorRate(metrics);
    if (errorRate > this.faultThresholds.errorRate) {
      faults.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `错误率过高: ${(errorRate * 100).toFixed(2)}%`,
        value: errorRate,
        threshold: this.faultThresholds.errorRate
      });
    }

    // 检查响应时间
    const avgResponseTime = this.calculateAverageResponseTime(metrics);
    if (avgResponseTime > this.faultThresholds.responseTime) {
      faults.push({
        type: 'slow_response',
        severity: 'warning',
        message: `响应时间过慢: ${avgResponseTime}ms`,
        value: avgResponseTime,
        threshold: this.faultThresholds.responseTime
      });
    }

    // 检查内存使用
    const memoryUsage = await this.getMemoryUsage();
    if (memoryUsage > this.faultThresholds.memoryUsage) {
      faults.push({
        type: 'high_memory_usage',
        severity: 'critical',
        message: `内存使用率过高: ${(memoryUsage * 100).toFixed(2)}%`,
        value: memoryUsage,
        threshold: this.faultThresholds.memoryUsage
      });
    }

    return faults;
  }

  private async handleFaults(faults: Fault[]) {
    for (const fault of faults) {
      // 记录故障日志
      console.error(`系统故障检测到: ${fault.message}`);

      // 发送告警通知
      await this.notificationService.sendAlert({
        title: `LLMChat 系统告警`,
        message: fault.message,
        severity: fault.severity,
        timestamp: new Date(),
        metadata: {
          type: fault.type,
          value: fault.value,
          threshold: fault.threshold
        }
      });

      // 自动恢复措施
      await this.attemptAutoRecovery(fault);
    }
  }

  private async attemptAutoRecovery(fault: Fault) {
    switch (fault.type) {
      case 'high_memory_usage':
        // 触发垃圾回收
        if (global.gc) {
          global.gc();
        }
        break;

      case 'high_error_rate':
        // 重启受影响的服务
        await this.restartAffectedServices();
        break;

      case 'slow_response':
        // 增加缓存清理频率
        await this.increaseCacheCleanup();
        break;
    }
  }
}
```

### 告警通知
```typescript
// backend/src/notification/notification.service.ts
@Injectable()
export class NotificationService {
  constructor(
    @Inject('EMAIL_SERVICE') private readonly emailService: EmailService,
    @Inject('SLACK_SERVICE') private readonly slackService: SlackService
  ) {}

  async sendAlert(alert: Alert) {
    const channels = this.getNotificationChannels(alert.severity);

    const notifications = channels.map(channel =>
      this.sendNotification(channel, alert)
    );

    await Promise.allSettled(notifications);
  }

  private async sendNotification(channel: string, alert: Alert) {
    switch (channel) {
      case 'email':
        await this.emailService.send({
          to: this.getAlertEmails(alert.severity),
          subject: `LLMChat 告警: ${alert.title}`,
          template: 'alert',
          data: alert
        });
        break;

      case 'slack':
        await this.slackService.sendMessage({
          channel: this.getSlackChannel(alert.severity),
          text: this.formatSlackMessage(alert)
        });
        break;

      case 'webhook':
        await this.sendWebhookAlert(alert);
        break;
    }
  }

  private getNotificationChannels(severity: string): string[] {
    switch (severity) {
      case 'critical':
        return ['email', 'slack', 'webhook'];
      case 'warning':
        return ['slack', 'webhook'];
      case 'info':
        return ['webhook'];
      default:
        return [];
    }
  }
}
```

## 版本管理

### 部署流程
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

VERSION=$1
ENVIRONMENT=${2:-production}

if [ -z "$VERSION" ]; then
    echo "错误: 请提供版本号"
    echo "用法: $0 <version> [environment]"
    exit 1
fi

echo "🚀 开始部署 LLMChat v$VERSION 到 $ENVIRONMENT 环境"

# 1. 备份当前版本
echo "💾 备份当前版本..."
./scripts/backup.sh

# 2. 运行测试
echo "🧪 运行测试套件..."
npm run test
npm run e2e:test

# 3. 构建新版本
echo "📦 构建新版本..."
npm run build

# 4. 数据库迁移
echo "🗄️ 执行数据库迁移..."
npm run migrate:up

# 5. 部署应用
echo "🚢 部署应用..."
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# 6. 健康检查
echo "🏥 执行健康检查..."
./scripts/health-check.sh

# 7. 验证部署
echo "✅ 验证部署..."
./scripts/verify-deployment.sh

echo "🎉 部署完成！"
```

### 版本回滚
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

PREVIOUS_VERSION=$1
ENVIRONMENT=${2:-production}

if [ -z "$PREVIOUS_VERSION" ]; then
    echo "错误: 请提供回滚版本"
    echo "用法: $0 <version> [environment]"
    exit 1
fi

echo "🔄 开始回滚到版本 $PREVIOUS_VERSION"

# 1. 停止当前服务
echo "⏹️ 停止当前服务..."
docker-compose -f docker-compose.$ENVIRONMENT.yml down

# 2. 切换到指定版本
echo "📦 切换到版本 $PREVIOUS_VERSION..."
git checkout $PREVIOUS_VERSION
npm run build

# 3. 启动服务
echo "🚢 启动服务..."
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# 4. 数据库回滚（如果需要）
read -p "是否需要回滚数据库？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️ 回滚数据库..."
    npm run migrate:down
fi

# 5. 验证回滚
echo "✅ 验证回滚..."
./scripts/health-check.sh

echo "🎉 回滚完成！"
```

## 备份策略

### 自动化备份
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/llmchat"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "📦 开始备份 - $(date)"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 1. 数据库备份
echo "🗄️ 备份数据库..."
pg_dump -h localhost -U postgres llmchat > $BACKUP_DIR/database_$DATE.sql

# 2. 应用文件备份
echo "📁 备份应用文件..."
tar -czf $BACKUP_DIR/application_$DATE.tar.gz \
    /opt/llmchat \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git

# 3. 配置文件备份
echo "⚙️ 备份配置文件..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /etc/llmchat \
    /opt/llmchat/.env

# 4. 上传文件备份
echo "📤 备份上传文件..."
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz \
    /var/uploads/llmchat

# 5. 清理旧备份
echo "🗑️ 清理旧备份..."
find $BACKUP_DIR -name "*.sql" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 6. 验证备份
echo "✅ 验证备份..."
for file in $BACKUP_DIR/*_$DATE.*; do
    if [ -s "$file" ]; then
        echo "✅ 备份文件有效: $file"
    else
        echo "❌ 备份文件无效: $file"
    fi
done

echo "✅ 备份完成 - $(date)"
```

### 恢复流程
```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1
RESTORE_TYPE=$2

if [ -z "$BACKUP_FILE" ] || [ -z "$RESTORE_TYPE" ]; then
    echo "错误: 请提供备份文件和恢复类型"
    echo "用法: $0 <backup_file> <type>"
    echo "类型: database | application | config | uploads"
    exit 1
fi

echo "🔄 开始恢复 - $(date)"

case $RESTORE_TYPE in
    "database")
        echo "🗄️ 恢复数据库..."
        psql -h localhost -U postgres -d llmchat < $BACKUP_FILE
        ;;

    "application")
        echo "📦 恢复应用文件..."
        tar -xzf $BACKUP_FILE -C /
        ;;

    "config")
        echo "⚙️ 恢复配置文件..."
        tar -xzf $BACKUP_FILE -C /
        ;;

    "uploads")
        echo "📤 恢复上传文件..."
        tar -xzf $BACKUP_FILE -C /
        ;;

    *)
        echo "错误: 不支持的恢复类型: $RESTORE_TYPE"
        exit 1
        ;;
esac

echo "✅ 恢复完成 - $(date)"
```

## 性能调优

### 数据库优化
```sql
-- scripts/database-optimization.sql

-- 1. 创建必要的索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_session_created
ON messages(session_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_updated
ON chat_sessions(user_id, updated_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_provider_active
ON agents(provider, is_active);

-- 2. 优化慢查询
EXPLAIN ANALYZE
SELECT m.*, s.user_id
FROM messages m
JOIN chat_sessions s ON m.session_id = s.id
WHERE s.user_id = 'user-id'
ORDER BY m.created_at DESC
LIMIT 50;

-- 3. 更新表统计信息
ANALYZE messages;
ANALYZE chat_sessions;
ANALYZE agents;

-- 4. 检查表碎片化
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_stat_get_dead_tuples(c.oid) AS dead_tuples
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY pg_stat_get_dead_tuples(c.oid) DESC;

-- 5. 清理死元组
VACUUM ANALYZE messages;
VACUUM ANALYZE chat_sessions;
VACUUM ANALYZE agents;
```

### 应用优化
```typescript
// scripts/performance-optimization.ts

class PerformanceOptimizer {
  async optimizeApplication() {
    // 1. 缓存优化
    await this.optimizeCache();

    // 2. 数据库连接池优化
    await this.optimizeDatabasePool();

    // 3. 内存使用优化
    await this.optimizeMemoryUsage();

    // 4. 并发处理优化
    await this.optimizeConcurrency();
  }

  private async optimizeCache() {
    // Redis缓存优化
    const redisConfig = {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      lazyConnect: true
    };

    // 缓存策略优化
    const cacheStrategies = {
      'agents': { ttl: 3600, maxSize: 1000 },
      'sessions': { ttl: 1800, maxSize: 5000 },
      'messages': { ttl: 300, maxSize: 10000 }
    };
  }

  private async optimizeDatabasePool() {
    const poolConfig = {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    };

    return poolConfig;
  }

  private async optimizeMemoryUsage() {
    // Node.js 内存优化
    if (global.gc) {
      // 手动触发垃圾回收
      global.gc();
    }

    // 内存监控
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / 1024 / 1024; // MB
    const heapTotal = memUsage.heapTotal / 1024 / 1024; // MB

    if (heapUsed / heapTotal > 0.9) {
      console.warn('内存使用率过高，建议增加内存或优化代码');
    }
  }

  private async optimizeConcurrency() {
    // 并发限制
    const concurrencyLimits = {
      'chat_requests': 100,
      'file_uploads': 10,
      'database_queries': 50
    };

    // 队列配置
    const queueConfig = {
      redis: {
        maxConcurrency: 10,
        attempts: 3,
        backoff: 'exponential'
      }
    };

    return { concurrencyLimits, queueConfig };
  }
}

// 执行性能优化
const optimizer = new PerformanceOptimizer();
optimizer.optimizeApplication();
```

---

*最后更新: 2025-10-18*
*文档版本: v1.0*
*维护者: 运维团队*