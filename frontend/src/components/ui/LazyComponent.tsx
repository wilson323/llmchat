/**
 * 懒加载组件
 *
 * 提供统一的懒加载组件接口，支持加载状态、错误处理、重试等功能
 */


import { AlertCircle, RefreshCw } from 'lucide-react';
import React, { Suspense, ComponentType, ReactNode } from 'react';
import type { LazyComponentConfig } from '@/utils/enhancedCodeSplitting';

// LazyComponentProps 定义
export interface LazyComponentProps<P extends object = {}> {
  /** 组件加载函数 */
  component: ComponentType<P> | (() => Promise<{ default: ComponentType<P> }>);
  /** 组件属性 */
  props?: P;
  /** 加载配置 */
  config?: LazyComponentConfig;
  /** 自定义加载组件 */
  fallback?: ComponentType | ReactNode;
  /** 自定义错误组件 */
  errorFallback?: ComponentType<{ error?: Error; onRetry: () => void; retryCount?: number }>;
}

// 默认加载中组件
const DefaultLoadingFallback: ComponentType<{ delay?: number }> = ({ delay = 200 }) => {
  const [showLoading, setShowLoading] = React.useState(delay === 0);

  React.useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShowLoading(true), delay);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [delay]);

  if (!showLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
};

// 默认错误组件
const DefaultErrorFallback: ComponentType<{
  error?: Error;
  onRetry: () => void;
  retryCount?: number;
}> = ({ error, onRetry, retryCount = 0 }) => {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="font-medium text-destructive">加载失败</h3>
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
              <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
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
 * 懒加载组件包装器
 */
export function LazyComponent<P extends object = {}>({
  component,
  config = {},
  ...props
}: LazyComponentProps<P>) {
  const {
    fallback: Fallback = DefaultLoadingFallback,
    errorFallback: ErrorFallback = DefaultErrorFallback,
    timeout = 10000,
    delay = 200,
  } = config;

  // 创建错误边界组件
  const ErrorBoundary = class extends React.Component<
    { children: ReactNode; onRetry: () => void },
    { hasError: boolean; error?: Error; retryCount: number }
  > {
    constructor(props: { children: ReactNode; onRetry: () => void }) {
      super(props);
      this.state = { hasError: false, retryCount: 0 };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error, retryCount: 0 };
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error('LazyComponent错误边界捕获:', error, errorInfo);
    }

    override componentDidUpdate(prevProps: { children: ReactNode; onRetry: () => void }) {
      // 如果props改变，重置错误状态
      if (prevProps.children !== this.props.children) {
        this.setState({ hasError: false });
      }
    }

    handleRetry = () => {
      const { retryCount } = this.state;
      const maxRetries = 3; // 设置最大重试次数
      if (retryCount < maxRetries) {
        this.setState(prev => ({
          hasError: false,
          retryCount: prev.retryCount + 1,
        }));
        this.props.onRetry();
      }
    };

    override render() {
      if (this.state.hasError) {
        return (
          <ErrorFallback
            {...(this.state.error && { error: this.state.error })}
            onRetry={this.handleRetry}
            retryCount={this.state.retryCount}
          />
        );
      }

      return this.props.children;
    }
  };

  // 超时处理
  const TimeoutWrapper: ComponentType<{ children: ReactNode }> = ({ children }) => {
    const [timedOut, setTimedOut] = React.useState(false);

    React.useEffect(() => {
      const timer = setTimeout(() => {
        setTimedOut(true);
      }, timeout);

      return () => clearTimeout(timer);
    }, [timeout]);

    if (timedOut) {
      const error = new Error(`组件加载超时 (${timeout}ms)`);
      return (
        <ErrorFallback
          error={error}
          onRetry={() => setTimedOut(false)}
          retryCount={0}
        />
      );
    }

    return <>{children}</>;
  };

  const Component = component as ComponentType<P>;

  return (
    <ErrorBoundary onRetry={() => {}}>
      <TimeoutWrapper>
        <Suspense fallback={typeof Fallback === 'function' ? <Fallback delay={delay} /> : <DefaultLoadingFallback delay={delay} />}>
          <Component {...(props as P)} />
        </Suspense>
      </TimeoutWrapper>
    </ErrorBoundary>
  );
}

/**
 * 创建懒加载组件
 */
export function createLazyComponent<P extends object = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  config: LazyComponentConfig = {},
): ComponentType<P> {
  const LazyLoadedComponent = React.lazy(importFn);

  return React.memo((props: P) => (
    <LazyComponent component={LazyLoadedComponent} config={config} {...props} />
  )) as ComponentType<P>;
}

/**
 * 创建条件懒加载组件
 */
export function createConditionalLazyComponent<P extends object = {}>(
  condition: boolean,
  importFn: () => Promise<{ default: ComponentType<P> }>,
  config: LazyComponentConfig = {},
): ComponentType<P> | null {
  if (!condition) {
    return null;
  }

  return createLazyComponent(importFn, config);
}

/**
 * 预加载组件
 */
export async function preloadComponent<P extends object = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
): Promise<ComponentType<P>> {
  try {
    const module = await importFn();
    return module.default;
  } catch (error) {
    console.error('预加载组件失败:', error);
    throw error;
  }
}

/**
 * 批量预加载组件
 */
export async function preloadComponents(
  components: Array<{
    importFn: () => Promise<{ default: ComponentType<any> }>;
    name?: string;
  }>,
): Promise<void> {
  const results = await Promise.allSettled(
    components.map(async ({ importFn, name }) => {
      try {
        await preloadComponent(importFn);
        console.info(`✅ 预加载成功: ${name || '未知组件'}`);
      } catch (error) {
        console.warn(`❌ 预加载失败: ${name || '未知组件'}`, error);
      }
    }),
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount = results.filter(r => r.status === 'rejected').length;

  console.info(`📦 批量预加载完成: 成功 ${successCount}，失败 ${failCount}`);
}

// 导出便捷的创建函数
export const createLazyWorkspace = (workspaceType: string) => {
  const workspaceImports: Record<string, () => Promise<{ default: ComponentType<any> }>> = {
    // 'voice-call': () => import('@/components/voice/VoiceCallWorkspace'), // voice组件已删除
    'cad-viewer': () => import('@/components/cad/CadViewerEnhanced'),
    'cad-upload': () => import('@/components/cad/CadUploadEnhanced'),
    'admin-dashboard': () => import('@/components/admin/AdminHome'),
  };

  const importFn = workspaceImports[workspaceType];
  if (!importFn) {
    throw new Error(`未知的工作区类型: ${workspaceType}`);
  }

  return createLazyComponent(importFn, {
    fallback: () => <DefaultLoadingFallback delay={100} />,
    errorFallback: DefaultErrorFallback,
    timeout: 15000,
    retryCount: 2,
  });
};

export default LazyComponent;