# 性能测试指南

## 📋 测试概述

本目录包含LLMChat系统的性能基准测试和压力测试工具，用于验证日志优化后的系能表现。

## 🚀 快速开始

### 前置条件

1. 确保后端服务已启动：
```bash
pnpm run backend:dev
```

2. 服务运行在 `http://localhost:3001`

### 快速性能测试（推荐）

最快速的性能验证方式：

```bash
pnpm run test:perf:quick
```

**测试内容**:
- 健康检查端点 (1次)
- 智能体列表 (1次)
- 10个并发请求

**预期结果**: 所有响应 < 50ms

### 完整基准测试

运行完整的性能基准测试：

```bash
pnpm run test:perf
```

**测试内容**:
- 健康检查: 1000个请求
- 智能体列表: 500个请求
- 登录接口: 100个请求

**输出**: 
- 控制台显示详细测试报告
- 报告保存到 `reports/performance-benchmark-[timestamp].json`

**性能目标**:
- P95响应时间 < 50ms
- P99响应时间 < 100ms
- 成功率 > 95%
- 吞吐量 > 1000 req/s

### 压力测试（Artillery）

运行持续负载压力测试：

```bash
pnpm run test:perf:stress
```

**测试阶段**:
1. 预热: 60秒, 10 req/s
2. 持续负载: 120秒, 50 req/s
3. 峰值负载: 60秒, 100 req/s

**性能目标**:
- 最大错误率 < 1%
- P95响应时间 < 100ms
- P99响应时间 < 200ms

**输出**: 
- 控制台实时显示测试进度
- 报告保存到 `reports/artillery-report.json`

### 一键运行（PowerShell脚本）

```powershell
.\tests\performance\run-benchmark.ps1
```

这个脚本会：
1. 检查后端服务状态
2. 运行基准测试
3. 询问是否运行压力测试
4. 生成完整报告

## 📊 性能指标说明

### 响应时间指标

- **平均响应时间**: 所有请求的平均耗时
- **P95响应时间**: 95%的请求在此时间内完成
- **P99响应时间**: 99%的请求在此时间内完成

### 质量指标

- **成功率**: 成功请求数 / 总请求数
- **吞吐量**: 每秒处理的请求数 (req/s)
- **错误率**: 失败请求数 / 总请求数

## 🎯 性能验收标准

基于工作计划A的目标：

| 指标 | 目标值 | 验收标准 |
|------|--------|----------|
| HTTP响应时间（P95） | < 50ms | 95%请求<50ms |
| HTTP响应时间（P99） | < 100ms | 99%请求<100ms |
| CPU使用率（空闲） | < 5% | 无请求时<5% |
| CPU使用率（负载） | < 30% | 100并发<30% |
| 内存使用（空闲） | < 100MB | 稳定无泄漏 |
| 内存使用（负载） | < 200MB | 持续负载<200MB |
| 日志量 | < 100条/分钟 | 正常运行时 |
| 吞吐量 | > 1000 req/s | 压力测试 |

## 📁 文件说明

- `benchmark.ts`: 完整性能基准测试
- `quick-test.ts`: 快速性能验证（3个测试）
- `artillery.yml`: Artillery压力测试配置
- `run-benchmark.ps1`: Windows一键测试脚本
- `README.md`: 本文档

## 🔧 自定义测试

### 修改基准测试

编辑 `benchmark.ts`，添加新的测试端点：

```typescript
// 添加新测试
results.push(await benchmarkEndpoint('GET', '/api/your-endpoint', 500));
```

### 修改压力测试

编辑 `artillery.yml`，调整负载参数：

```yaml
phases:
  - duration: 120
    arrivalRate: 200  # 提高到200 req/s
    name: "高负载测试"
```

## 📈 性能优化效果对比

### 优化前（存在问题）
- 日志洪水: 1000+ debug日志/秒
- CPU使用: 40-50%（空闲）
- 请求延迟: +10-20ms（日志I/O阻塞）

### 优化后（当前版本）
- 日志量: < 10条/分钟
- CPU使用: < 10%（空闲）
- 请求延迟: 原生响应速度
- 批量化: 99% I/O减少

## 🐛 故障排除

### 测试失败

如果测试失败，检查：

1. 后端服务是否正常运行
2. 端口3001是否被占用
3. 数据库连接是否正常
4. 环境变量是否正确配置

### 性能未达标

如果性能未达标，检查：

1. 是否有其他程序占用系统资源
2. 日志级别是否设置为 `info` 或更高
3. `MEMORY_OPTIMIZATION_ENABLED` 是否设置为 `false`
4. Redis连接是否正常

### Artillery安装失败

手动安装Artillery：

```bash
pnpm add -D artillery
```

## 📝 报告解读

### 基准测试报告

JSON报告包含：
- `timestamp`: 测试时间
- `baseUrl`: 测试目标URL
- `results`: 每个端点的详细结果
- `summary`: 整体统计摘要

### Artillery报告

Artillery报告包含：
- 请求统计（总数、成功、失败）
- 响应时间分布（min, median, p95, p99, max）
- 吞吐量统计
- 错误统计

## 🔄 定期性能测试

建议：

- **每次重大优化后**: 运行完整基准测试对比
- **每周**: 运行压力测试验证稳定性
- **发布前**: 运行所有性能测试

## 📞 支持

如有问题，请查看：
- [工作计划A](../../docs/WORK_PLAN_A_LOGGING_PERFORMANCE.md)
- [性能优化文档](../../FRONTEND_PERFORMANCE_OPTIMIZATION.md)

