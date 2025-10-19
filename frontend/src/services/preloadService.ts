/**
 * 智能预加载服务
 *
 * 根据用户行为、网络状况、设备性能等因素智能预加载组件和资源
 */


// 预加载策略
export enum PreloadStrategy {
  NONE = 'none',
  IDLE = 'idle',
  HOVER = 'hover',
  VISIBLE = 'visible',
  NETWORK_CHANGE = 'network-change',
  USER_BEHAVIOR = 'user-behavior',
}

// 预加载优先级
export enum PreloadPriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 8,
  CRITICAL = 10,
}

// 预加载项配置
interface PreloadItem {
  id: string;
  name: string;
  importFn: () => Promise<{ default: any }>;
  priority: PreloadPriority;
  strategy: PreloadStrategy;
  conditions?: () => boolean;
  dependencies?: string[];
  timeout?: number;
}

// 预加载统计
interface PreloadStats {
  totalRequested: number;
  totalLoaded: number;
  totalFailed: number;
  totalTime: number;
  averageLoadTime: number;
  cacheHitRate: number;
}

/**
 * 智能预加载服务
 */
class PreloadService {
  private preloadQueue: Map<string, PreloadItem> = new Map();
  private loadingItems: Set<string> = new Set();
  private loadedItems: Set<string> = new Set();
  private failedItems: Set<string> = new Set();
  private stats: PreloadStats = {
    totalRequested: 0,
    totalLoaded: 0,
    totalFailed: 0,
    totalTime: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
  };

  private isInitialized = false;
  private networkObserver: MutationObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private idleCallback: number | null = null;

  /**
   * 初始化预加载服务
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.info('🚀 初始化智能预加载服务');

    // 注册预加载项
    this.registerPreloadItems();

    // 设置监听器
    this.setupNetworkListener();
    this.setupVisibilityListener();
    this.setupIdleListener();
    this.setupBehaviorTracking();

    // 开始预加载
    this.startPreloading();

    this.isInitialized = true;
  }

  /**
   * 注册预加载项
   */
  private registerPreloadItems(): void {
    // 高优先级组件 - 用户可能立即需要的
    // ProductPreviewWorkspace已删除
    // this.registerItem({
    //   id: 'product-preview-workspace',
    //   name: 'ProductPreviewWorkspace',
    //   importFn: () => import('@/components/product/ProductPreviewWorkspace').then(m => ({ default: m.ProductPreviewWorkspace || m.default })),
    //   priority: PreloadPriority.HIGH,
    //   strategy: PreloadStrategy.IDLE,
    //   conditions: () => this.hasProductAgents(),
    // });

    // voice-call-workspace已删除（voice组件已清理）

    // 中等优先级组件 - 可能需要但非紧急
    this.registerItem({
      id: 'cad-viewer-enhanced',
      name: 'CadViewerEnhanced',
      importFn: () => import('@/components/cad/CadViewerEnhanced'),
      priority: PreloadPriority.MEDIUM,
      strategy: PreloadStrategy.USER_BEHAVIOR,
      conditions: () => this.hasCadFeatures(),
    });

    this.registerItem({
      id: 'cad-upload-enhanced',
      name: 'CadUploadEnhanced',
      importFn: () => import('@/components/cad/CadUploadEnhanced'),
      priority: PreloadPriority.MEDIUM,
      strategy: PreloadStrategy.USER_BEHAVIOR,
      conditions: () => this.hasCadFeatures(),
    });

    // 低优先级组件 - 管理功能
    this.registerItem({
      id: 'admin-dashboard',
      name: 'AdminHome',
      importFn: () => import('@/components/admin/AdminHome'),
      priority: PreloadPriority.LOW,
      strategy: PreloadStrategy.NETWORK_CHANGE,
      conditions: () => this.isAdminUser(),
    });
  }

  /**
   * 注册预加载项
   */
  registerItem(item: PreloadItem): void {
    this.preloadQueue.set(item.id, item);
    this.stats.totalRequested++;
  }

  /**
   * 开始预加载
   */
  private async startPreloading(): Promise<void> {
    // 立即预加载关键项
    await this.preloadCriticalItems();

    // 根据策略预加载其他项
    this.preloadByStrategy(PreloadStrategy.IDLE);
  }

  /**
   * 预加载关键项
   */
  private async preloadCriticalItems(): Promise<void> {
    const criticalItems = Array.from(this.preloadQueue.values())
      .filter(item => item.priority >= PreloadPriority.HIGH)
      .filter(item => !item.conditions || item.conditions());

    if (criticalItems.length === 0) {
      return;
    }

    console.info('🎯 预加载关键组件:', criticalItems.map(item => item.name).join(', '));

    await Promise.allSettled(
      criticalItems.map(item => this.preloadItem(item)),
    );
  }

  /**
   * 按策略预加载
   */
  private preloadByStrategy(strategy: PreloadStrategy): void {
    const items = Array.from(this.preloadQueue.values())
      .filter(item => item.strategy === strategy)
      .filter(item => !this.loadingItems.has(item.id))
      .filter(item => !this.loadedItems.has(item.id))
      .filter(item => !item.conditions || item.conditions())
      .sort((a, b) => b.priority - a.priority);

    if (items.length === 0) {
      return;
    }

    console.info(`📦 预加载策略 ${strategy}:`, items.map(item => item.name).join(', '));

    items.forEach(item => {
      this.preloadItem(item);
    });
  }

  /**
   * 预加载单个项
   */
  private async preloadItem(item: PreloadItem): Promise<void> {
    if (this.loadingItems.has(item.id) || this.loadedItems.has(item.id)) {
      return;
    }

    this.loadingItems.add(item.id);

    const startTime = performance.now();

    try {
      await item.importFn();
      // 组件已成功加载到缓存中

      // 缓存结果
      // SimpleCodeSplitting 内置了缓存机制，无需额外设置

      const loadTime = performance.now() - startTime;

      this.loadedItems.add(item.id);
      this.loadingItems.delete(item.id);

      // 更新统计
      this.stats.totalLoaded++;
      this.stats.totalTime += loadTime;
      this.stats.averageLoadTime = this.stats.totalTime / this.stats.totalLoaded;

      console.info(`✅ 预加载成功: ${item.name} (${loadTime.toFixed(2)}ms)`);

      // 预加载依赖项
      if (item.dependencies) {
        this.preloadDependencies(item.dependencies);
      }

    } catch (error) {
      this.loadingItems.delete(item.id);
      this.failedItems.add(item.id);
      this.stats.totalFailed++;

      console.warn(`❌ 预加载失败: ${item.name}`, error);
    }
  }

  /**
   * 预加载依赖项
   */
  private preloadDependencies(dependencies: string[]): void {
    dependencies.forEach(depId => {
      const depItem = this.preloadQueue.get(depId);
      if (depItem && !this.loadedItems.has(depId)) {
        this.preloadItem(depItem);
      }
    });
  }

  /**
   * 设置网络监听器
   */
  private setupNetworkListener(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      const handleNetworkChange = () => {
        if (connection.effectiveType === '4g' || connection.effectiveType === 'wifi') {
          // 高速网络时预加载更多组件
          this.preloadByStrategy(PreloadStrategy.NETWORK_CHANGE);
        }
      };

      connection.addEventListener('change', handleNetworkChange);
    }
  }

  /**
   * 设置可见性监听器
   */
  private setupVisibilityListener(): void {
    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const preloadTarget = entry.target.getAttribute('data-preload');
              if (preloadTarget) {
                const item = this.preloadQueue.get(preloadTarget);
                if (item) {
                  this.preloadItem(item);
                }
              }
            }
          });
        },
        { rootMargin: '50px' },
      );
    }
  }

  /**
   * 设置空闲监听器
   */
  private setupIdleListener(): void {
    if ('requestIdleCallback' in window) {
      this.idleCallback = requestIdleCallback(() => {
        this.preloadByStrategy(PreloadStrategy.IDLE);
      });
    } else {
      // 降级方案
      setTimeout(() => {
        this.preloadByStrategy(PreloadStrategy.IDLE);
      }, 2000);
    }
  }

  /**
   * 设置行为跟踪
   */
  private setupBehaviorTracking(): void {
    // 监听路由变化
    this.setupRouteTracking();

    // 监听用户交互
    this.setupInteractionTracking();

    // 监听滚动行为
    this.setupScrollTracking();
  }

  /**
   * 设置路由跟踪
   */
  private setupRouteTracking(): void {
    // 监听URL变化，预加载相关组件
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleRouteChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleRouteChange();
    };

    window.addEventListener('popstate', () => {
      this.handleRouteChange();
    });
  }

  /**
   * 处理路由变化
   */
  private handleRouteChange(): void {
    const path = window.location.pathname;

    // 根据路径预加载相关组件
    if (path.includes('/admin')) {
      this.preloadItem(this.preloadQueue.get('admin-dashboard')!);
    }

    if (path.includes('/product')) {
      this.preloadItem(this.preloadQueue.get('product-preview-workspace')!);
    }

    if (path.includes('/voice')) {
      this.preloadItem(this.preloadQueue.get('voice-call-workspace')!);
    }
  }

  /**
   * 设置交互跟踪
   */
  private setupInteractionTracking(): void {
    // 监听鼠标悬停
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      const preloadTarget = target.closest('[data-preload-hover]');

      if (preloadTarget) {
        const preloadId = preloadTarget.getAttribute('data-preload-hover');
        if (preloadId) {
          const item = this.preloadQueue.get(preloadId);
          if (item && item.strategy === PreloadStrategy.HOVER) {
            this.preloadItem(item);
          }
        }
      }
    });

    // 监听点击
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const preloadTarget = target.closest('[data-preload-click]');

      if (preloadTarget) {
        const preloadId = preloadTarget.getAttribute('data-preload-click');
        if (preloadId) {
          const item = this.preloadQueue.get(preloadId);
          if (item) {
            this.preloadItem(item);
          }
        }
      }
    });
  }

  /**
   * 设置滚动跟踪
   */
  private setupScrollTracking(): void {
    let scrollTimeout: number;

    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);

      scrollTimeout = window.setTimeout(() => {
        // 滚动停止时预加载可见区域组件
        this.preloadVisibleItems();
      }, 100);
    });
  }

  /**
   * 预加载可见项
   */
  private preloadVisibleItems(): void {
    if (!this.visibilityObserver) {
      return;
    }

    // 查找所有带有预加载标记的元素
    const preloadElements = document.querySelectorAll('[data-preload-visible]');

    preloadElements.forEach(element => {
      if (this.visibilityObserver) {
        this.visibilityObserver.observe(element);
      }
    });
  }

  /**
   * 检查是否有产品类智能体
   */
  private hasProductAgents(): boolean {
    try {
      const agents = JSON.parse(localStorage.getItem('llmchat-agents') || '[]');
      return agents.some((agent: any) => agent.workspaceType === 'product-preview');
    } catch {
      return false;
    }
  }

  /**
   * 检查是否有语音类智能体
   */
  private hasVoiceAgents(): boolean {
    try {
      const agents = JSON.parse(localStorage.getItem('llmchat-agents') || '[]');
      return agents.some((agent: any) => agent.workspaceType === 'voice-call');
    } catch {
      return false;
    }
  }

  /**
   * 检查是否有CAD功能
   */
  private hasCadFeatures(): boolean {
    try {
      const agents = JSON.parse(localStorage.getItem('llmchat-agents') || '[]');
      return agents.some((agent: any) => agent.features?.includes('cad'));
    } catch {
      return false;
    }
  }

  /**
   * 检查是否为管理员用户
   */
  private isAdminUser(): boolean {
    try {
      const user = JSON.parse(localStorage.getItem('llmchat-user') || '{}');
      return user.role === 'admin' || user.isAdmin;
    } catch {
      return false;
    }
  }


  /**
   * 获取预加载统计
   */
  getStats(): PreloadStats & {
    queueSize: number;
    loadingItems: number;
    loadedItems: number;
    failedItems: number;
  } {
    return {
      ...this.stats,
      queueSize: this.preloadQueue.size,
      loadingItems: this.loadingItems.size,
      loadedItems: this.loadedItems.size,
      failedItems: this.failedItems.size,
    };
  }

  /**
   * 手动预加载组件
   */
  async preloadComponent(id: string): Promise<void> {
    const item = this.preloadQueue.get(id);
    if (item) {
      await this.preloadItem(item);
    }
  }

  /**
   * 添加预加载标记到元素
   */
  static addPreloadAttributes(
    element: HTMLElement,
    config: {
      hover?: string;
      click?: string;
      visible?: string;
    },
  ): void {
    if (config.hover) {
      element.setAttribute('data-preload-hover', config.hover);
    }
    if (config.click) {
      element.setAttribute('data-preload-click', config.click);
    }
    if (config.visible) {
      element.setAttribute('data-preload-visible', config.visible);
    }
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.networkObserver) {
      this.networkObserver.disconnect();
    }
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
    }
    if (this.idleCallback !== null) {
      cancelIdleCallback(this.idleCallback);
    }

    this.preloadQueue.clear();
    this.loadingItems.clear();
    this.loadedItems.clear();
    this.failedItems.clear();

    this.isInitialized = false;
  }
}

// 创建单例实例
export const preloadService = new PreloadService();

export default preloadService;