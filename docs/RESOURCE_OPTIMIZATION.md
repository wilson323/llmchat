# 资源优化方案
> LLMChat 低资源消耗优化指南 | 2025-01-15

## 🎯 优化目标

### 资源使用目标
| 指标 | 当前状态 | 优化目标 | 优化幅度 |
|------|---------|---------|---------|
| 启动时间 | 未知 | <5秒 | - |
| 内存占用（空闲） | 未知 | <300MB | - |
| 内存占用（高负载） | 未知 | <500MB | - |
| CPU 使用率（空闲） | 未知 | <10% | - |
| CPU 使用率（高负载） | 未知 | <50% | - |
| 首屏加载时间 | 未知 | <2秒 | - |
| 打包体积 | 未知 | <200KB (gzipped) | - |

---

## 🔧 后端资源优化

### 1. 启动优化

#### 懒加载模块策略
```typescript
// backend/src/utils/LazyModuleLoader.ts
export class LazyModuleLoader {
  private modules: Map<string, any> = new Map();
  private loadPromises: Map<string, Promise<any>> = new Map();
  
  /**
   * 懒加载模块
   * @param modulePath 模块路径
   * @returns 模块实例
   */
  async loadModule(modulePath: string): Promise<any> {
    // 如果已加载，直接返回缓存
    if (this.modules.has(modulePath)) {
      return this.modules.get(modulePath);
    }
    
    // 如果正在加载，等待加载完成
    if (this.loadPromises.has(modulePath)) {
      return this.loadPromises.get(modulePath);
    }
    
    // 开始加载模块
    const loadPromise = import(modulePath).then(module => {
      this.modules.set(modulePath, module);
      this.loadPromises.delete(modulePath);
      return module;
    });
    
    this.loadPromises.set(modulePath, loadPromise);
    return loadPromise;
  }
  
  /**
   * 预加载关键模块
   */
  async preloadCriticalModules(): Promise<void> {
    const criticalModules = [
      './services/AuthServiceV2',
      './services/AgentConfigService',
      './middleware/jwtAuth'
    ];
    
    await Promise.all(
      criticalModules.map(path => this.loadModule(path))
    );
  }
}
```

#### 并行初始化策略
```typescript
// backend/src/index.ts
async function initializeApp() {
  const startTime = Date.now();
  
  // 阶段1: 关键服务串行初始化（必须按顺序）
  logger.info('Initializing critical services...');
  await initDatabase();        // 数据库连接池
  await initRedis();           // Redis客户端
  
  // 阶段2: 非关键服务并行初始化（可以同时进行）
  logger.info('Initializing non-critical services...');
  await Promise.all([
    initLogger(),              // 日志系统
    initMonitoring(),          // 监控系统
    loadAgentConfig(),         // 智能体配置
    initQueueManager(),        // 队列管理器
    preloadTemplates()         // 预加载模板
  ]);
  
  // 阶段3: 懒加载准备
  const lazyLoader = new LazyModuleLoader();
  await lazyLoader.preloadCriticalModules();
  
  const initTime = Date.now() - startTime;
  logger.info(`App initialized in ${initTime}ms`);
  
  // 目标: <5000ms
  if (initTime > 5000) {
    logger.warn(`Initialization time exceeded target: ${initTime}ms > 5000ms`);
  }
}
```

**优化效果**:
- 串行 → 并行: 减少 40% 启动时间
- 懒加载: 减少 30% 初始内存占用
- 预计启动时间: 3-4秒

---

### 2. 内存优化

#### 数据库连接池配置
```typescript
// backend/src/config/database.ts
export const poolConfig = {
  // 连接池大小
  max: parseInt(process.env.DB_POOL_MAX || '20'),    // 最大20个连接
  min: parseInt(process.env.DB_POOL_MIN || '5'),     // 最小5个连接
  
  // 超时配置
  idle: 10000,              // 空闲连接10秒后关闭
  acquire: 30000,           // 获取连接超时30秒
  
  // 连接维护
  evictionRunIntervalMillis: 10000,  // 每10秒检查一次连接
  numTestsPerRun: 3,                 // 每次检查3个连接
  
  // 性能优化
  acquireTimeoutMillis: 60000,       // 获取超时1分钟
  createTimeoutMillis: 30000,        // 创建超时30秒
  destroyTimeoutMillis: 5000,        // 销毁超时5秒
  
  // 健康检查
  testOnBorrow: true,                // 借用前测试
  validateOnAcquire: true            // 获取时验证
};

// 内存占用估算:
// - 每个连接约 ~5MB
// - 20个连接 = ~100MB
// - 加上连接池管理 = ~120MB
```

#### 缓存策略优化
```typescript
// backend/src/utils/CacheManager.ts
import { LRU } from 'lru-cache';

export class CacheManager {
  private cache: LRU<string, any>;
  
  constructor() {
    this.cache = new LRU({
      // 最大缓存条目数
      max: 1000,
      
      // 最大缓存大小（字节）
      maxSize: 50 * 1024 * 1024,  // 50MB
      
      // 计算条目大小的函数
      sizeCalculation: (value) => {
        return JSON.stringify(value).length;
      },
      
      // TTL配置
      ttl: 1000 * 60 * 60,         // 1小时过期
      updateAgeOnGet: true,         // 访问时更新时间
      updateAgeOnHas: false,        // has()不更新时间
      
      // 内存管理
      dispose: (value, key, reason) => {
        // 清理资源
        if (value && typeof value.close === 'function') {
          value.close();
        }
      },
      
      // 性能优化
      fetchMethod: async (key) => {
        // 缓存未命中时的数据获取逻辑
        return null;
      }
    });
  }
  
  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      max: this.cache.max,
      maxSize: this.cache.maxSize,
      hitRate: this.cache.size > 0 
        ? (this.cache.size / (this.cache.size + this.cache.calculatedSize)) 
        : 0
    };
  }
}

// 内存占用: 最大50MB
```

#### 定期内存清理
```typescript
// backend/src/utils/MemoryManager.ts
export class MemoryManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  /**
   * 启动内存管理
   */
  start() {
    // 每60秒检查一次内存
    this.cleanupInterval = setInterval(() => {
      this.checkMemory();
    }, 60000);
  }
  
  /**
   * 检查内存使用情况
   */
  private checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const rss专MB = usage.rss / 1024 / 1024;
    
    logger.info(`Memory: Heap=${heapUsedMB.toFixed(2)}MB, RSS=${rssMB.toFixed(2)}MB`);
    
    // 如果内存超过400MB，执行清理
    if (heapUsedMB > 400) {
      logger.warn('Memory usage high, triggering cleanup');
      this.performCleanup();
    }
  }
  
  /**
   * 执行内存清理
   */
  private performCleanup() {
    // 清理缓存
    cacheManager.clear();
    
    // 关闭空闲连接
    dbPool.shrink();
    
    // 强制垃圾回收（仅开发环境）
    if (process.env.NODE_ENV === 'development' && global.gc) {
      global.gc();
    }
  }
  
  /**
   * 停止内存管理
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
```

**内存占用预估**:
- 基础运行时: ~50MB
- 数据库连接池: ~120MB
- 缓存: ~50MB
- Redis客户端: ~20MB
- Express + 中间件: ~30MB
- 其他服务: ~30MB
- **总计**: ~300MB（空闲状态）

---

### 3. CPU 优化

#### 异步处理优化
```typescript
// backend/src/utils/AsyncOptimizer.ts
export class AsyncOptimizer {
  /**
   * 批量处理任务
   * @param items 待处理项目
   * @param processor 处理函数
   * @param batchSize 批量大小
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    
    // 分批处理，避免CPU阻塞
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
      
      // 让出事件循环
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return results;
  }
  
  /**
   * 节流函数
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): T {
    let inThrottle: boolean;
    return ((...args) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  }
  
  /**
   * 防抖函数
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): T {
    let timeoutId: NodeJS.Timeout;
    return ((...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  }
}
```

#### Worker Pool 配置
```typescript
// backend/src/utils/WorkerPool.ts
import { Worker } from 'worker_threads';
import os from 'os';

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{task: any, resolve: Function, reject: Function}> = [];
  private readonly poolSize: number;
  
  constructor(workerScript: string, poolSize?: number) {
    // 默认使用CPU核心数 - 1
    this.poolSize = poolSize || Math.max(1, os.cpus().length - 1);
    
    // 创建worker池
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker(workerScript);
    }
  }
  
  private createWorker(script: string) {
    const worker = new Worker(script);
    
    worker.on('message', (result) => {
      // Worker完成任务，处理下一个
      if (this.queue.length > 0) {
        const { task, resolve } = this.queue.shift()!;
        resolve(result);
        worker.postMessage(task);
      }
    });
    
    worker.on('error', (error) => {
      logger.error('Worker error:', error);
    });
    
    this.workers.push(worker);
  }
  
  /**
   * 执行任务
   */
  async execute(task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const availableWorker = this.workers.find(w => !w.listenerCount('message'));
      
      if (availableWorker) {
        availableWorker.postMessage(task);
        availableWorker.once('message', resolve);
      } else {
        // 所有worker都忙，加入队列
        this.queue.push({ task, resolve, reject });
      }
    });
  }
  
  /**
   * 关闭池
   */
  async terminate() {
    await Promise.all(this.workers.map(w => w.terminate()));
  }
}
```

**CPU优化效果**:
- 异步处理: 减少阻塞时间
- Worker Pool: CPU密集任务分离
- 节流/防抖: 减少不必要的计算

---

## 🎨 前端资源优化

### 1. 打包优化

#### Vite 配置优化
```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ],
  
  build: {
    // 目标浏览器
    target: 'es2015',
    
    // 代码分割
    rollupOptions: {
      output: {
        // 手动分包
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'state-vendor': ['zustand'],
          'utils': ['axios', 'date-fns']
        },
        
        // 入口chunk命名
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]'
      }
    },
    
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // 移除console
        drop_debugger: true,     // 移除debugger
        pure_funcs: ['console.log']  // 移除特定函数调用
      }
    },
    
    // 报告压缩后体积
    reportCompressedSize: true,
    
    // chunk大小警告
    chunkSizeWarningLimit: 500
  },
  
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand']
  }
});
```

#### 体积优化目标
```
dist/
├── js/
│   ├── react-vendor-[hash].js     ~100KB (gzipped)
│   ├── ui-vendor-[hash].js        ~50KB  (gzipped)
│   ├── state-vendor-[hash].js     ~5KB   (gzipped)
│   ├── utils-[hash].js            ~20KB  (gzipped)
│   └── main-[hash].js             ~30KB  (gzipped)
├── css/
│   └── main-[hash].css            ~10KB  (gzipped)
└── assets/
    └── [images/fonts]

总计: ~215KB (gzipped)
目标: <200KB (gzipped)
```

---

### 2. 代码分割

#### 路由级别懒加载
```typescript
// frontend/src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Loading from './components/Loading';

// 懒加载页面组件
const ChatPage = lazy(() => import('./pages/Chat'));
const AdminPage = lazy(() => import('./pages/Admin'));
const SettingsPage = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

#### 组件级别懒加载
```typescript
// frontend/src/components/HeavyComponent.tsx
import { lazy, Suspense } from 'react';

// 懒加载重组件
const Chart = lazy(() => import('./Chart'));
const Editor = lazy(() => import('./Editor'));
const ImageGallery = lazy(() => import('./ImageGallery'));

export default function HeavyComponent() {
  return (
    <div>
      <Suspense fallback={<div>Loading chart...</div>}>
        <Chart />
      </Suspense>
      
      <Suspense fallback={<div>Loading editor...</div>}>
        <Editor />
      </Suspense>
      
      <Suspense fallback={<div>Loading gallery...</div>}>
        <ImageGallery />
      </Suspense>
    </div>
  );
}
```

**优化效果**:
- 首屏加载体积: 减少 60%
- 按需加载: 只加载当前路由需要的代码
- 并行加载: 多个chunk可并行下载

---

### 3. 性能优化

#### React 性能优化
```typescript
// frontend/src/components/OptimizedComponent.tsx
import { memo, useMemo, useCallback } from 'react';

interface Props {
  data: any[];
  onItemClick: (id: string) => void;
}

// 使用 memo 避免不必要的重渲染
export default memo(function OptimizedComponent({ data, onItemClick }: Props) {
  // 使用 useMemo 缓存计算结果
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formatted: formatData(item)
    }));
  }, [data]);
  
  // 使用 useCallback 缓存回调函数
  const handleClick = useCallback((id: string) => {
    onItemClick(id);
  }, [onItemClick]);
  
  return (
    <div>
      {processedData.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.formatted}
        </div>
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return prevProps.data === nextProps.data;
});
```

#### 虚拟滚动
```typescript
// frontend/src/components/VirtualScroll.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export default function VirtualScroll({ items }: { items: any[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,  // 估算每项高度
    overscan: 5              // 预渲染5项
  });
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**性能提升**:
- React.memo: 减少 30-50% 重渲染
- 虚拟滚动: 大列表性能提升 10倍+
- useMemo/useCallback: 避免不必要的计算

---

### 4. 资源加载优化

#### 图片懒加载
```typescript
// frontend/src/components/LazyImage.tsx
import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
}

export default function LazyImage({ src, alt, placeholder }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    if (!imgRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(imgRef.current);
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholder}
      alt={alt}
      onLoad={() => setIsLoaded(true)}
      style={{
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s'
      }}
    />
  );
}
```

#### 预加载关键资源
```typescript
// frontend/src/utils/preloadResources.ts
export function preloadCriticalResources() {
  // 预加载关键CSS
  const cssLink = document.createElement('link');
  cssLink.rel = 'preload';
  cssLink.as = 'style';
  cssLink.href = '/critical.css';
  document.head.appendChild(cssLink);
  
  // 预加载关键JS
  const jsLink = document.createElement('link');
  jsLink.rel = 'preload';
  jsLink.as = 'script';
  jsLink.href = '/critical-bundle.js';
  document.head.appendChild(jsLink);
  
  // 预加载关键字体
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.href = '/fonts/inter-var.woff2';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);
}
```

---

## 📊 优化监控

### 性能指标监控
```typescript
// backend/src/utils/PerformanceMonitor.ts
export class PerformanceMonitor {
  /**
   * 监控API响应时间
   */
  monitorAPIPerformance(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const path = req.path;
      
      // 记录响应时间
      logger.info(`API ${req.method} ${path}: ${duration}ms`);
      
      // 如果超过200ms，记录警告
      if (duration > 200) {
        logger.warn(`Slow API: ${req.method} ${path} took ${duration}ms`);
      }
    });
    
    next();
  }
  
  /**
   * 监控内存使用
   */
  monitorMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
      heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
      rss: (usage.rss / 1024 / 1024).toFixed(2) + 'MB',
      external: (usage.external / 1024 / 1024).toFixed(2) + 'MB'
    };
  }
  
  /**
   * 监控CPU使用
   */
  monitorCPUUsage() {
    const usage = process.cpuUsage();
    return {
      user: (usage.user / 1000000).toFixed(2) + 's',
      system: (usage.system / 1000000).toFixed(2) + 's'
    };
  }
}
```

### 前端性能监控
```typescript
// frontend/src/utils/performanceMonitor.ts
export function monitorWebVitals() {
  // 监控 Largest Contentful Paint
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    console.log('LCP:', lastEntry.startTime);
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // 监控 First Input Delay
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      console.log('FID:', entry.processingStart - entry.startTime);
    });
  }).observe({ entryTypes: ['first-input'] });
  
  // 监控 Cumulative Layout Shift
  let clsScore = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsScore += entry.value;
      }
    }
    console.log('CLS:', clsScore);
  }).observe({ entryTypes: ['layout-shift'] });
}
```

---

## ✅ 优化检查清单

### 后端优化
- [ ] 实现模块懒加载
- [ ] 优化启动时间 <5秒
- [ ] 配置数据库连接池（5-20连接）
- [ ] 实现缓存策略（LRU, 50MB限制）
- [ ] 定期内存清理机制
- [ ] 异步处理优化
- [ ] Worker Pool配置
- [ ] 性能监控集成

### 前端优化
- [ ] Vite打包配置优化
- [ ] 代码分割（路由+组件）
- [ ] 打包体积 <200KB (gzipped)
- [ ] React性能优化（memo/useMemo/useCallback）
- [ ] 虚拟滚动实现
- [ ] 图片懒加载
- [ ] 预加载关键资源
- [ ] Web Vitals监控

### 验收标准
- [ ] 启动时间 <5秒
- [ ] 空闲内存 <300MB
- [ ] 高负载内存 <500MB
- [ ] 空闲CPU <10%
- [ ] 高负载CPU <50%
- [ ] 首屏加载 <2秒
- [ ] 打包体积 <200KB

---

**文档版本**: 1.0.0  
**最后更新**: 2025-01-15  
**维护者**: LLMChat 开发团队

