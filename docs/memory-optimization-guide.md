# 队列系统内存优化使用指南

## 概述

内存优化服务是队列系统性能优化的关键组件，提供实时内存监控、自动优化和内存泄漏检测功能。本指南将详细介绍如何配置、使用和管理内存优化服务。

## 核心功能

### 1. 内存监控
- **实时监控**: 每30秒（可配置）收集一次内存使用情况
- **历史数据**: 保留最近的内存使用历史，用于趋势分析
- **阈值告警**: 支持自定义内存使用率告警阈值
- **趋势分析**: 检测内存增长趋势，识别潜在内存泄漏

### 2. 自动优化
- **垃圾回收**: 自动触发垃圾回收释放内存
- **数据清理**: 定期清理过期数据和缓存
- **连接池优化**: 优化Redis连接池的内存使用
- **激进优化**: 在内存紧张时采用激进策略释放内存

### 3. 告警系统
- **内存阈值告警**: 当内存使用率超过阈值时发出告警
- **快速增长告警**: 检测内存快速异常增长
- **内存泄漏检测**: 识别可能的内存泄漏问题

## 配置说明

### 基本配置

```typescript
interface QueueManagerConfig {
  // ... 其他配置
  memoryOptimization?: {
    enabled?: boolean;              // 是否启用内存优化（默认: true）
    autoOptimization?: boolean;     // 是否启用自动优化（默认: true）
    threshold?: number;             // 优化触发阈值，百分比（默认: 75）
    intervalMs?: number;            // 监控间隔，毫秒（默认: 30000）
    maxHeapSizeMB?: number;         // 最大堆内存限制，MB（默认: 1024）
    maxRSSSizeMB?: number;          // 最大RSS内存限制，MB（默认: 2048）
  };
}
```

### 高级配置示例

```typescript
const queueConfig: QueueManagerConfig = {
  redis: {
    host: 'localhost',
    port: 6379
  },
  memoryOptimization: {
    enabled: true,
    autoOptimization: true,
    threshold: 80,                    // 80%内存使用率触发优化
    intervalMs: 60000,                // 每分钟检查一次
    maxHeapSizeMB: 2048,              // 最大堆内存2GB
    maxRSSSizeMB: 4096                // 最大RSS内存4GB
  }
};
```

## 使用方法

### 1. 启用内存优化

```typescript
import { QueueManager } from '@/services/QueueManager';

// 创建队列管理器时启用内存优化
const queueManager = QueueManager.getInstance({
  redis: {
    host: 'localhost',
    port: 6379
  },
  memoryOptimization: {
    enabled: true,
    autoOptimization: true,
    threshold: 75
  }
});

// 内存优化服务将自动启动
```

### 2. 手动内存优化

```typescript
// 执行手动优化
const result = await queueManager.optimizeMemory({
  aggressive: false,
  reason: '手动优化'
});

console.log('优化结果:', result);
// 输出: {
//   success: true,
//   freedMemoryMB: 15.2,
//   durationMs: 1234,
//   details: {
//     method: 'gc',
//     optimizations: ['Garbage collection: freed 15.2MB in 1234ms'],
//     beforeMemory: '245.67MB',
//     afterMemory: '230.47MB'
//   }
// }
```

### 3. 激进内存优化

```typescript
// 执行激进优化（用于内存紧张情况）
const result = await queueManager.optimizeMemory({
  aggressive: true,
  reason: '内存紧张'
});
```

### 4. 获取内存状态

```typescript
// 获取当前内存状态
const memoryStatus = queueManager.getMemoryStatus();

console.log('内存状态:', memoryStatus);
// 输出: {
//   enabled: true,
//   current: {
//     heapUsed: 245670912,
//     heapTotal: 536870912,
//     heapUsedPercentage: 45.7,
//     rssMB: 298.5,
//     timestamp: 1694678400000
//   },
//   optimization: {
//     totalOptimizations: 15,
//     successfulOptimizations: 14,
//     totalMemoryFreed: 234.5,
//     lastOptimizationTime: 1694678300000,
//     averageOptimizationTime: 892
//   },
//   health: {
//     healthy: true,
//     issues: []
//   },
//   recommendations: ['内存使用状况良好']
// }
```

### 5. 获取优化历史

```typescript
// 获取最近10次优化历史
const history = queueManager.getMemoryOptimizationHistory(10);

history.forEach((record, index) => {
  console.log(`优化 ${index + 1}:`, {
    timestamp: new Date(record.timestamp),
    method: record.method,
    freedMemory: `${record.freedMemoryMB}MB`,
    duration: `${record.durationMs}ms`,
    success: record.success,
    optimizations: record.optimizations
  });
});
```

### 6. 创建内存快照

```typescript
// 创建内存使用快照
const snapshot = queueManager.createMemorySnapshot();

console.log('内存快照:', snapshot);
// 输出: {
//   timestamp: 1694678400000,
//   heapUsed: 245670912,
//   heapTotal: 536870912,
//   rss: 312778752,
//   queueStats: {
//     totalQueues: 5,
//     totalJobs: 1234,
//     activeJobs: 23
//   },
//   connectionPoolStats: {
//     active: 8,
//     idle: 4,
//     total: 12
//   }
// }
```

### 7. 动态配置更新

```typescript
// 更新内存优化配置
const success = queueManager.updateMemoryOptimizationConfig({
  autoOptimizationEnabled: true,
  optimizationThreshold: 85,
  monitoringIntervalMs: 45000,
  maxHeapSizeMB: 3072
});

if (success) {
  console.log('配置更新成功');
} else {
  console.log('配置更新失败');
}
```

## 事件监听

### 监听内存告警

```typescript
queueManager.on('memory:alert', (data) => {
  console.warn('内存告警:', data);
  // data 包含: level, alerts, stats
});

queueManager.on('memory:rapid-growth', (data) => {
  console.warn('内存快速增长:', data);
  // 处理内存快速增长情况
});

queueManager.on('memory:leak', (data) => {
  console.error('内存泄漏检测:', data);
  // 处理内存泄漏情况
});
```

### 监听优化事件

```typescript
queueManager.on('memory:optimization:completed', (data) => {
  console.info('内存优化完成:', data);
  // data 包含: reason, report
});

queueManager.on('memory:optimization:failed', (data) => {
  console.error('内存优化失败:', data);
  // 处理优化失败情况
});
```

## 性能调优建议

### 1. 监控间隔设置
- **生产环境**: 建议设置为30-60秒
- **开发环境**: 可以设置为10-30秒
- **高负载环境**: 适当延长间隔以减少性能影响

### 2. 优化阈值设置
- **保守策略**: 85%（推荐用于稳定生产环境）
- **标准策略**: 75%（默认设置，平衡性能和稳定性）
- **激进策略**: 65%（用于内存紧张环境）

### 3. 内存限制设置
```typescript
// 根据服务器配置调整内存限制
const serverMemoryGB = 16; // 服务器内存16GB
const maxHeapSizeMB = Math.floor(serverMemoryGB * 1024 * 0.6); // 60%用于堆内存
const maxRSSSizeMB = Math.floor(serverMemoryGB * 1024 * 0.8);   // 80%用于RSS
```

### 4. 自动优化配置
- **启用场景**: 生产环境、长时间运行的服务
- **禁用场景**: 开发调试、短期任务、内存敏感的应用

## 故障排除

### 常见问题

1. **内存优化服务无法启动**
   - 检查配置中的`enabled`字段是否为`true`
   - 确认Node.js版本支持相关API
   - 检查系统权限是否允许内存监控

2. **自动优化不生效**
   - 检查`autoOptimization`是否启用
   - 确认内存使用率是否达到优化阈值
   - 查看日志是否有相关错误信息

3. **内存告警过于频繁**
   - 适当提高告警阈值
   - 检查是否存在内存泄漏
   - 考虑增加服务器内存

4. **优化效果不明显**
   - 检查垃圾回收是否正常工作
   - 确认是否有大对象缓存
   - 考虑启用激进优化模式

### 调试方法

1. **启用详细日志**
```typescript
import logger from '@/utils/logger';
logger.level = 'debug';
```

2. **获取诊断信息**
```typescript
const memoryStatus = queueManager.getMemoryStatus();
const healthCheck = queueManager.getMemoryOptimizationService()?.healthCheck();

console.log('内存诊断:', {
  status: memoryStatus,
  health: healthCheck
});
```

3. **监控内存趋势**
```typescript
const memoryMonitor = queueManager.getMemoryOptimizationService()?.getMemoryMonitor();
const trends = memoryMonitor?.getMemoryTrends(10);

trends?.forEach(trend => {
  console.log('内存趋势:', {
    time: new Date(trend.timestamp),
    usage: `${(trend.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    trend: trend.trend,
    rate: `${trend.rate}MB/min`
  });
});
```

## 最佳实践

### 1. 生产环境配置
```typescript
const productionConfig: QueueManagerConfig = {
  memoryOptimization: {
    enabled: true,
    autoOptimization: true,
    threshold: 85,                    // 较高的阈值，避免频繁优化
    intervalMs: 60000,                // 1分钟间隔，减少性能影响
    maxHeapSizeMB: 4096,              // 根据实际情况调整
    maxRSSSizeMB: 8192
  }
};
```

### 2. 开发环境配置
```typescript
const developmentConfig: QueueManagerConfig = {
  memoryOptimization: {
    enabled: true,
    autoOptimization: false,           // 手动控制优化时机
    threshold: 75,
    intervalMs: 30000,                // 更短的监控间隔
    maxHeapSizeMB: 1024,
    maxRSSSizeMB: 2048
  }
};
```

### 3. 监控集成
```typescript
// 集成到监控系统
queueManager.on('memory:alert', (data) => {
  // 发送到监控系统
  monitoringService.sendAlert({
    type: 'memory',
    level: data.level,
    message: `Memory usage ${data.alerts.join(', ')}`,
    metadata: data.stats
  });
});

// 定期收集指标
setInterval(() => {
  const memoryStatus = queueManager.getMemoryStatus();
  metricsCollector.gauge('memory.heap_used', memoryStatus.current?.heapUsedPercentage || 0);
  metricsCollector.gauge('memory.rss_mb', memoryStatus.current?.rssMB || 0);
  metricsCollector.counter('memory.optimizations', memoryStatus.optimization?.totalOptimizations || 0);
}, 60000);
```

## 性能影响分析

### 1. CPU使用
- **监控开销**: 每次监控约消耗1-2ms CPU时间
- **优化开销**: 普通优化约100-500ms，激进优化约1-2s
- **总体影响**: 正常使用情况下CPU开销<1%

### 2. 内存使用
- **监控数据**: 约占用10-20MB内存用于历史数据存储
- **优化服务**: 基础服务约占用5-10MB内存
- **总体影响**: 相对于总内存使用量影响微乎其微

### 3. 网络I/O
- **监控**: 无网络I/O开销
- **优化**: 仅在清理连接池时可能有少量网络操作
- **总体影响**: 基本无网络I/O影响

## 总结

内存优化服务是队列系统的重要组成部分，通过合理的配置和使用，可以显著提高系统的稳定性和性能。关键要点：

1. **合理配置**: 根据环境特点设置合适的监控间隔和优化阈值
2. **主动监控**: 定期检查内存状态和优化历史
3. **及时响应**: 关注内存告警，及时处理潜在问题
4. **持续优化**: 根据实际运行情况调整配置参数

通过遵循本指南的建议，您可以充分发挥内存优化服务的效能，确保队列系统长期稳定运行。