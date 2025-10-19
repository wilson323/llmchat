# TypeScript 性能优化快速开始指南

## 🚀 快速开始

### 1. 验证配置
```bash
# 验证所有性能配置是否正确设置
npm run perf:validate

# 自动修复常见配置问题
npm run perf:validate:fix
```

### 2. 选择合适的配置

#### 快速开发（推荐日常使用）
```bash
# 最快的类型检查
npm run type-check:fast

# 内存优化的开发服务器
npm run dev:memory
```

#### 平衡性能和类型安全
```bash
# 开发环境类型检查
npm run type-check:dev

# 性能监控
npm run perf:monitor:dev
```

#### 严格质量检查（提交前）
```bash
# 完整类型检查
npm run type-check

# 性能配置检查
npm run type-check:perf
```

### 3. 性能监控
```bash
# 监控编译性能
npm run perf:monitor

# 监控并保存性能报告
npm run perf:monitor:perf
```

## 📊 配置对比

| 配置 | 编译速度 | 内存使用 | 类型安全 | 适用场景 |
|------|----------|----------|----------|----------|
| `fast` | ⚡ 最快 | 💾 最少 | ⚠️ 基础 | 快速原型开发 |
| `dev` | 🚀 快速 | 💾 较少 | ✅ 平衡 | 日常开发 |
| `perf` | ⚡ 快速 | 💾 优化 | ✅ 平衡 | 性能优化测试 |
| `default` | 🐌 完整 | 💾 较多 | 🔒 严格 | 生产构建 |

## 🔧 内存优化

### 增加Node.js内存限制
```bash
# 临时设置
export NODE_OPTIONS="--max-old-space-size=4096"

# 永久设置（添加到 .bashrc 或 .zshrc）
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc
```

### 清理缓存
```bash
# 手动清理
rm -rf .tsbuildinfo*
rm -rf node_modules/.cache

# 使用清理脚本
./scripts/cleanup-memory.sh
```

## 💡 最佳实践

### 日常开发工作流
1. **启动开发**: `npm run dev:memory`
2. **类型检查**: `npm run type-check:fast`
3. **定期检查**: `npm run type-check:dev`
4. **提交前**: `npm run type-check`

### 性能问题排查
1. **监控性能**: `npm run perf:monitor`
2. **验证配置**: `npm run perf:validate`
3. **清理缓存**: `rm -rf .tsbuildinfo*`
4. **重启服务**: 重启开发服务器

### 内存问题解决
1. **增加内存**: `export NODE_OPTIONS="--max-old-space-size=4096"`
2. **使用优化配置**: `npm run type-check:perf`
3. **清理内存**: `./scripts/cleanup-memory.sh`
4. **监控使用**: `npm run perf:monitor`

## 📈 性能指标

### 预期性能
- **快速配置**: < 2秒编译时间
- **开发配置**: < 4秒编译时间
- **内存使用**: < 1GB峰值
- **增量编译**: < 1秒

### 监控指标
- 编译时间
- 内存使用量
- 文件处理速度
- 缓存命中率

## 🆘 故障排除

### 编译失败
```bash
# 检查配置语法
npm run perf:validate:fix

# 使用基础配置
npm run type-check:fast

# 清理并重试
rm -rf .tsbuildinfo* && npm run type-check:dev
```

### 内存不足
```bash
# 增加内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 使用内存优化配置
npm run type-check:perf

# 清理缓存
./scripts/cleanup-memory.sh
```

### 性能下降
```bash
# 监控性能
npm run perf:monitor --save

# 验证配置
npm run perf:validate

# 重新生成缓存
rm -rf .tsbuildinfo* && npm run type-check:perf
```

## 📚 详细文档

- [完整性能优化指南](./docs/TYPESCRIPT_PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [TypeScript开发标准](./TYPESCRIPT_DEVELOPMENT_STANDARDS.md)
- [Vite配置文档](./vite.performance.config.ts)

---

**快速开始**: 3分钟内完成配置验证和优化
**预期效果**: 编译速度提升60-80%，内存使用减少50-75%