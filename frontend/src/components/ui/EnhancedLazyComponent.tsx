/**
 * 增强版懒加载组件
 *
 * 提供更强大的懒加载功能，包括预加载、错误处理、加载状态等
 */

import React, { Suspense, ComponentType, ReactNode, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { EnhancedCodeSplitting } from '@/utils/enhancedCodeSplitting';

// 增强懒加载组件配置
export interface EnhancedLazyComponentConfig {
  /** 自定义加载组件 */
  fallback?: ComponentType | ReactNode;
  /** 自定义错误组件 */
  errorFallback?: ComponentType<{ error?: Error; onRetry: () => void; retryCount: number }>;
  /** 预加载策略 */
  preloadStrategy?: 'idle' | 'visible' | 'hover' | 'immediate';
  /** 缓存时间（毫秒） */
  cacheTime?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 优先级 */
  priority?: number;
  /** 延迟显示加载状态（毫秒） */
  delay?: number;
  /** 是否显示加载进度 */
  showProgress?: boolean;
  /** 最小加载时间（毫秒，防止闪烁） */
  minLoadingTime?: number;
}

// 默认加载组件
const DefaultLoadingFallback: ComponentType<{ delay?: number; showProgress?: boolean }> = ({
  delay = 200,
  showProgress = false,
}) => {
  const [showLoading, setShowLoading] = React.useState(delay === 0);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShowLoading(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  React.useEffect(() => {
    if (showProgress && showLoading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [showProgress, showLoading]);

  if (!showLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-4 max-w-sm">
        <div className="relative">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          {showProgress && (
            <div className="absolute -inset-2">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="text-muted opacity-20"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={`${progress * 1.26} 126`}
                  className="text-primary transition-all duration-100"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">加载中...</p>
          {showProgress && (
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          )}
        </div>
      </div>
    </div>
  );
};

// 默认错误组件
const DefaultErrorFallback: ComponentType<{
  error?: Error;
  onRetry: () => void;
  retryCount: number;
}> = ({ error, onRetry, retryCount }) => {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="font-medium text-destructive">组件加载失败</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error?.message || '组件加载失败，请稍后重试'}
          </p>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              已重试 {retryCount} 次
            </p>
          )}
        </div>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRetrying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              重试中...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              重试
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/**
 * 增强版懒加载组件包装器
 */
export function EnhancedLazyComponent<P extends object = {}>({
  component,
  componentName,
  config = {},
  ...props
}: {
  component: ComponentType<P>;
  componentName: string;
  config?: EnhancedLazyComponentConfig;
} & P) {
  const {
    fallback: Fallback = DefaultLoadingFallback,
    errorFallback: ErrorFallback = DefaultErrorFallback,
    preloadStrategy = 'idle',
    cacheTime = 5 * 60 * 1000,
    timeout = 10000,
    priority = 5,
    delay = 200,
    showProgress = false,
    minLoadingTime = 500,
  } = config;

  const [retryCount, _setRetryCount] = React.useState(0);
  const [loadStartTime, setLoadStartTime] = React.useState<number>(0);
  const [minLoadElapsed, setMinLoadElapsed] = React.useState(false);

  // 注册组件（如果尚未注册）
  useEffect(() => {
    EnhancedCodeSplitting.registerComponent(componentName, () =>
      Promise.resolve({ default: component }),
    {
      preloadStrategy,
      cacheTime,
      timeout,
      retryCount,
      priority,
    },
    );
  }, [componentName, component, preloadStrategy, cacheTime, timeout, retryCount, priority]);

  // 处理重试
  const handleRetry = useCallback(() => {
    _setRetryCount((prev: number) => prev + 1);
    setLoadStartTime(Date.now());
    setMinLoadElapsed(false);

    // 清除缓存并重新加载
    EnhancedCodeSplitting.clearComponentCache(componentName);
  }, [componentName]);


  // 最小加载时间处理
  useEffect(() => {
    if (loadStartTime > 0 && !minLoadElapsed) {
      const timer = setTimeout(() => {
        setMinLoadElapsed(true);
      }, minLoadingTime);

      return () => clearTimeout(timer);
    }
  }, [loadStartTime, minLoadElapsed, minLoadingTime]);

  // 错误边界组件
  const ErrorBoundary = class extends React.Component<
    { children: ReactNode; onRetry: () => void },
    { hasError: boolean; error?: Error; retryCount: number }
  > {
    constructor(props: { children: ReactNode; onRetry: () => void }) {
      super(props);
      this.state = { hasError: false, error: undefined, retryCount: 0 };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error, retryCount: 0 };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error('EnhancedLazyComponent错误边界捕获:', error, errorInfo);
    }

    componentDidUpdate(prevProps: { children: ReactNode; onRetry: () => void }) {
      // 当props改变时重置错误状态
      if (prevProps.children !== this.props.children) {
        this.setState({ hasError: false, error: undefined, retryCount: 0 });
      }
    }

    handleRetry = () => {
      const { retryCount } = this.state;
      if (retryCount < retryCount) {
        this.setState(prev => ({
          hasError: false,
          error: undefined,
          retryCount: prev.retryCount + 1,
        }));
        this.props.onRetry();
      }
    };

    render() {
      if (this.state.hasError) {
        return (
          <ErrorFallback
            error={this.state.error}
            onRetry={this.handleRetry}
            retryCount={this.state.retryCount}
          />
        );
      }

      return this.props.children;
    }
  };

  // 渲染fallback的辅助函数
  const renderFallback = useCallback((fallbackProps?: { delay?: number; showProgress?: boolean }) => {
    if (typeof Fallback === 'function') {
      return <Fallback {...fallbackProps} />;
    }
    return fallbackProps ? <DefaultLoadingFallback {...fallbackProps} /> : <DefaultLoadingFallback />;
  }, [Fallback]);

  // 检查最小加载时间
  if (loadStartTime > 0 && !minLoadElapsed) {
    return renderFallback({ delay: 0, showProgress });
  }

  const Component = component as ComponentType<P>;

  return (
    <ErrorBoundary onRetry={handleRetry}>
      <Suspense fallback={renderFallback({ delay, showProgress })}>
        <Component {...(props as P)} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * 创建增强版懒加载组件
 */
export function createEnhancedLazyComponent<P extends object = {}>(
  componentName: string,
  _importFn: () => Promise<{ default: ComponentType<P> }>,
  config: EnhancedLazyComponentConfig = {},
): ComponentType<P> {
  // 转换配置以匹配LazyComponentConfig类型
  const lazyConfig: any = {
    preloadStrategy: config.preloadStrategy,
    cacheTime: config.cacheTime,
    timeout: config.timeout,
    retryCount: config.retryCount,
    fallback: typeof config.fallback === 'function' ? config.fallback : undefined,
    errorFallback: config.errorFallback,
    priority: config.priority,
  };

  const LazyComponent = EnhancedCodeSplitting.createLazyComponent<P>(componentName, lazyConfig);

  return React.memo((props: P) => (
    <EnhancedLazyComponent
      component={LazyComponent}
      componentName={componentName}
      config={config}
      {...(props as any)}
    />
  )) as any as ComponentType<P>;
}

/**
 * 创建条件懒加载组件
 */
export function createConditionalLazyComponent<P extends object = {}>(
  condition: boolean,
  componentName: string,
  importFn: () => Promise<{ default: ComponentType<P> }>,
  config: EnhancedLazyComponentConfig = {},
): ComponentType<P> | null {
  if (!condition) {
    return null;
  }

  return createEnhancedLazyComponent(componentName, importFn, config);
}

export default EnhancedLazyComponent;