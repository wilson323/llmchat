# 性能监控系统集成指南

本指南将帮助您在LLMChat前端项目中集成和使用性能监控功能。

## 🚀 快速开始

### 1. 基本集成

```typescript
// 在您的应用根组件中导入监控组件
import { TypeSafetyDashboard } from '@/components/monitoring/TypeSafetyDashboard';
import { ComprehensivePerformanceDashboard } from '@/components/monitoring/ComprehensivePerformanceDashboard';

// 在您的组件中使用
function App() {
  return (
    <div>
      {/* 其他应用内容 */}

      {/* 性能监控面板 */}
      <TypeSafetyDashboard
        autoRefresh={true}
        refreshInterval={30000}
      />

      {/* 或使用综合监控面板 */}
      <ComprehensivePerformanceDashboard
        autoRefresh={true}
        refreshInterval={10000}
        enableRealTime={true}
      />
    </div>
  );
}
```

### 2. 使用性能监控管理器

```typescript
import { performanceManager } from '@/components/monitoring/PerformanceMonitoringExample';

// 初始化性能监控
await performanceManager.initialize();

// 获取性能摘要
const summary = await performanceManager.getPerformanceSummary();

// 生成性能报告
const report = await performanceManager.generatePerformanceReport();

// 导出数据
const data = await performanceManager.exportData();
```

## 📊 监控组件说明

### TypeSafetyDashboard

专注于TypeScript类型安全的监控面板，提供以下功能：

- **TypeScript编译监控**：编译时间、错误数量、警告统计
- **ESLint检查**：代码质量检查结果和修复时间
- **类型覆盖率**：类型安全的覆盖程度统计
- **性能指标**：构建时间、包大小、IDE响应时间
- **趋势分析**：历史性能数据和趋势图表
- **违规项详情**：具体的类型安全违规信息

#### 配置选项

```typescript
interface TypeSafetyDashboardProps {
  className?: string;        // 自定义CSS类名
  autoRefresh?: boolean;     // 是否自动刷新（默认：true）
  refreshInterval?: number;  // 刷新间隔，毫秒（默认：30000）
}
```

#### 使用示例

```typescript
<TypeSafetyDashboard
  className="my-performance-dashboard"
  autoRefresh={true}
  refreshInterval={60000} // 1分钟刷新一次
/>
```

### ComprehensivePerformanceDashboard

全面的性能监控面板，集成多个维度的性能指标：

- **综合评分**：基于多个指标的综合性能评分
- **TypeScript性能**：编译和类型检查性能
- **IDE性能**：智能提示、代码补全等IDE功能性能
- **系统资源**：CPU、内存、磁盘、网络使用情况
- **实时监控**：支持实时数据更新
- **趋势预测**：性能趋势分析和预测
- **性能洞察**：智能生成的性能优化建议

#### 配置选项

```typescript
interface ComprehensivePerformanceDashboardProps {
  className?: string;        // 自定义CSS类名
  autoRefresh?: boolean;     // 是否自动刷新（默认：true）
  refreshInterval?: number;  // 刷新间隔，毫秒（默认：10000）
  enableRealTime?: boolean;  // 是否启用实时模式（默认：true）
}
```

#### 使用示例

```typescript
<ComprehensivePerformanceDashboard
  className="comprehensive-dashboard"
  autoRefresh={true}
  refreshInterval={5000}  // 5秒刷新一次
  enableRealTime={true}    // 启用实时模式
/>
```

## 🔧 服务集成

### TypeScriptPerformanceService

TypeScript编译性能监控服务：

```typescript
import { typeScriptPerformanceService } from '@/services/TypeScriptPerformanceService';

// 订阅性能更新
typeScriptPerformanceService.subscribe(
  'my-subscription-id',
  (metrics) => {
    console.log('性能指标:', metrics);
  },
  (alert) => {
    console.log('性能告警:', alert);
  },
  (trend) => {
    console.log('性能趋势:', trend);
  }
);

// 手动触发性能分析
const metrics = await typeScriptPerformanceService.triggerPerformanceAnalysis();

// 获取优化建议
const recommendations = await typeScriptPerformanceService.getOptimizationRecommendations();

// 获取当前指标
const currentMetrics = typeScriptPerformanceService.getCurrentMetrics();

// 获取历史数据
const history = typeScriptPerformanceService.getMetricsHistory(100);

// 获取活跃告警
const alerts = typeScriptPerformanceService.getActiveAlerts();
```

### IDEPerformanceTracker

IDE性能追踪服务：

```typescript
import { idePerformanceTracker } from '@/services/IDEPeforaceTracker';

// 开始追踪
idePerformanceTracker.startTracking(5000); // 每5秒收集一次数据

// 停止追踪
idePerformanceTracker.stopTracking();

// 手动收集指标
const metrics = await idePerformanceTracker.collectMetrics();

// 获取当前指标
const currentMetrics = idePerformanceTracker.getCurrentMetrics();

// 获取优化建议
const suggestions = idePerformanceTracker.getOptimizationSuggestions();
```

### PerformanceTrendAnalyzer

性能趋势分析服务：

```typescript
import { performanceTrendAnalyzer } from '@/services/PerformanceTrendAnalyzer';

// 添加数据点
performanceTrendAnalyzer.addDataPoint('metric-name', value, metadata);

// 分析趋势
const trend = performanceTrendAnalyzer.analyzeTrend('metric-name');

// 生成预测
const prediction = performanceTrendAnalyzer.generatePerformancePrediction('metric-name');

// 获取性能洞察
const insights = performanceTrendAnalyzer.getPerformanceInsights();
```

### PerformanceDataCache

性能数据缓存服务：

```typescript
import { performanceDataCache } from '@/services/PerformanceDataCache';

// 设置缓存数据
await performanceDataCache.set('key', data, 60000, ['tag1', 'tag2']);

// 获取缓存数据
const cachedData = await performanceDataCache.get('key');

// 删除缓存数据
performanceDataCache.delete('key');

// 清空缓存
performanceDataCache.clear();

// 获取缓存统计
const stats = performanceDataCache.getStats();

// 导出缓存数据
const exportData = performanceDataCache.exportData();

// 导入缓存数据
performanceDataCache.importData(jsonData);

// 同步到云端
const syncResult = await performanceDataCache.syncToCloud();
```

## 🎯 最佳实践

### 1. 初始化和清理

```typescript
// 在应用启动时初始化
React.useEffect(() => {
  const initPerformanceMonitoring = async () => {
    await performanceManager.initialize();
  };

  initPerformanceMonitoring();

  // 在组件卸载时清理
  return () => {
    performanceManager.cleanup();
  };
}, []);
```

### 2. 性能告警处理

```typescript
// 设置自定义告警处理
typeScriptPerformanceService.subscribe(
  'alerts',
  (metrics) => { /* 处理正常指标 */ },
  (alert) => {
    // 根据严重程度处理告警
    switch (alert.severity) {
      case 'critical':
        // 立即通知开发团队
        notifyCritical(alert);
        break;
      case 'high':
        // 记录到监控系统
        logHighSeverityAlert(alert);
        break;
      case 'medium':
        // 保存到日志
        console.warn('性能告警:', alert);
        break;
      case 'low':
        // 仅记录
        console.log('性能提示:', alert);
        break;
    }
  }
);
```

### 3. 缓存策略配置

```typescript
// 根据应用需求配置缓存策略
performanceDataCache.updateConfig({
  maxSize: 100,           // 100MB
  maxEntries: 10000,       // 最大条目数
  defaultTTL: 86400000,    // 24小时
  compressionEnabled: true, // 启用压缩
  encryptionEnabled: false, // 开发环境关闭加密
  syncEnabled: false       // 开发环境关闭云同步
});
```

### 4. 性能阈值配置

```typescript
// 设置适合您项目的性能阈值
const performanceThresholds = {
  compilation: {
    slowThreshold: 5000,    // 5秒
    criticalThreshold: 10000 // 10秒
  },
  memory: {
    warningThreshold: 512,  // 512MB
    criticalThreshold: 1024 // 1GB
  },
  responseTime: {
    goodThreshold: 100,      // 100ms
    acceptableThreshold: 200 // 200ms
  }
};
```

## 📈 性能优化建议

### 1. 组件优化

- 使用 `useCallback` 和 `useMemo` 优化重复计算
- 避免在渲染过程中创建新对象
- 合理使用 `React.memo` 防止不必要的重渲染

### 2. 数据收集优化

- 调整数据收集频率，避免过度频繁的数据获取
- 使用缓存减少重复计算和网络请求
- 在生产环境中禁用或减少详细日志

### 3. 图表渲染优化

- 限制显示的数据点数量
- 使用数据采样减少渲染负担
- 在大量数据时考虑使用虚拟化

### 4. 内存管理

- 定期清理过期缓存数据
- 避免内存泄漏
- 监控内存使用情况

## 🔍 故障排除

### 常见问题

1. **性能监控不显示数据**
   - 检查服务是否正确初始化
   - 确认是否有权限访问相关API
   - 查看控制台错误日志

2. **图表不更新**
   - 确认 `autoRefresh` 是否启用
   - 检查 `refreshInterval` 设置
   - 验证数据源是否正常

3. **性能数据不准确**
   - 检查数据收集逻辑
   - 确认时间戳是否正确
   - 验证数据处理流程

4. **内存使用过高**
   - 调整缓存大小限制
   - 减少历史数据保存数量
   - 优化数据处理逻辑

### 调试技巧

```typescript
// 启用详细日志
console.log('TypeScript性能指标:', typeScriptPerformanceService.getCurrentMetrics());
console.log('IDE性能指标:', idePerformanceTracker.getCurrentMetrics());
console.log('缓存统计:', performanceDataCache.getStats());
console.log('趋势分析:', performanceTrendAnalyzer.getPerformanceInsights());

// 监控内存使用
if ('memory' in performance) {
  const memory = (performance as any).memory;
  console.log('内存使用:', {
    used: memory.usedJSHeapSize / 1024 / 1024,
    total: memory.totalJSHeapSize / 1024 / 1024,
    limit: memory.jsHeapSizeLimit / 1024 / 1024
  });
}
```

## 🚀 生产环境部署

### 环境配置

```typescript
// 生产环境配置
const productionConfig = {
  autoRefresh: false,           // 禁用自动刷新
  refreshInterval: 60000,        // 1分钟刷新间隔
  enableRealTime: false,         // 禁用实时模式
  cacheConfig: {
    maxSize: 50,                 // 50MB缓存
    maxEntries: 5000,
    defaultTTL: 3600000,          // 1小时TTL
    compressionEnabled: true,
    encryptionEnabled: true,      // 启用加密
    syncEnabled: true            // 启用云同步
  }
};
```

### 性能监控

```typescript
// 生产环境性能监控
const monitorProductionPerformance = () => {
  // 监控关键指标
  const criticalMetrics = [
    'compilation_time',
    'memory_usage',
    'error_count',
    'response_time'
  ];

  criticalMetrics.forEach(metric => {
    performanceTrendAnalyzer.addDataPoint(metric, getValue(metric));
  });

  // 检查性能阈值
  const summary = await performanceManager.getPerformanceSummary();
  if (summary.typeScript?.status === 'error') {
    // 发送告警
    sendAlert('TypeScript编译错误', summary.typeScript);
  }
};
```

## 📚 更多资源

- [TypeScript性能优化指南](./TYPESCRIPT_PERFORMANCE.md)
- [React性能最佳实践](./REACT_PERFORMANCE.md)
- [监控系统架构](./MONITORING_ARCHITECTURE.md)
- [API文档](./API_DOCUMENTATION.md)

## 💡 贡献指南

如果您想为性能监控系统做出贡献：

1. Fork 项目
2. 创建功能分支
3. 编写测试用例
4. 提交 Pull Request
5. 等待代码审查

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 LICENSE 文件。