/**
 * 简化版懒加载组件
 *
 * 提供基础的懒加载功能，避免复杂的类型问题
 */

import React, { Suspense, ComponentType, ReactNode, PropsWithRef } from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

// 简化的懒加载配置
export interface SimpleLazyConfig {
  /** 自定义加载组件 */
  fallback?: ComponentType | ReactNode;
  /** 自定义错误组件 */
  errorFallback?: ComponentType<{ error?: Error; onRetry: () => void }>;
  /** 显示加载进度 */
  showProgress?: boolean;
  /** 延迟显示加载状态（毫秒） */
  delay?: number;
}

// 默认加载组件
const DefaultLoadingFallback: ComponentType<{ delay?: number; showProgress?: boolean }> = ({
  delay = 200,
  showProgress = false,
}) => {
  const [showLoading, setShowLoading] = React.useState(delay === 0);

  React.useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShowLoading(true), delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  if (!showLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-4 max-w-sm">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">加载中...</p>
          {showProgress && (
            <div className="w-32 bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
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
  retryCount?: number;
}> = ({ error, onRetry, retryCount = 0 }) => {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = React.useCallback(async () => {
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
 * 简化版懒加载组件包装器
 */
export function SimpleLazyComponent<P extends object = {}>({
  component,
  config = {},
  ...props
}: {
  component: ComponentType<P>;
  config?: SimpleLazyConfig;
} & PropsWithRef<P>) {
  const {
    fallback: Fallback = DefaultLoadingFallback,
    errorFallback: ErrorFallback = DefaultErrorFallback,
    showProgress = false,
    delay = 200,
  } = config;

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
      console.error('SimpleLazyComponent错误边界捕获:', error, errorInfo);
    }

    componentDidUpdate(prevProps: { children: ReactNode; onRetry: () => void }) {
      if (prevProps.children !== this.props.children) {
        this.setState({ hasError: false, error: undefined, retryCount: 0 });
      }
    }

    handleRetry = () => {
      const { retryCount } = this.state;
      if (retryCount < 3) {
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

  const Component = component as ComponentType<P>;

  return (
    <ErrorBoundary onRetry={() => {}}>
      <Suspense
        fallback={
          typeof Fallback === 'string' ?
            <div>{Fallback}</div> :
            React.isValidElement(Fallback) ?
              Fallback :
              React.createElement(Fallback as any, {
                delay,
                showProgress,
              })
        }
      >
        <Component {...(props as P)} />
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * 创建简化版懒加载组件
 */
export function createSimpleLazyComponent<P extends object = {}>(
  _componentName: string,
  importFn: () => Promise<{ default: ComponentType<P> }>,
  config: SimpleLazyConfig = {},
): ComponentType<P> {
  const LazyComponent = React.lazy(importFn);

  return React.memo((props) => (
    <SimpleLazyComponent
      component={LazyComponent}
      config={config}
      {...(props as any)}
    />
  )) as any as ComponentType<P>;
}

export default SimpleLazyComponent;