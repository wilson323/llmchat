
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component } from 'react';
import type React from 'react';


import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // 记录错误信息到状态
    this.setState({
      error,
      errorInfo,
    });

    // 在开发环境下显示详细错误信息
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Details');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  private handleReload = () => {
    // 清除可能损坏的状态
    localStorage.clear();
    sessionStorage.clear();

    // 重新加载页面
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false } as State);
  };

  public override render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <ErrorBoundaryUI
          error={this.state.error ?? undefined}
          onReload={this.handleReload}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// 错误UI组件
interface ErrorBoundaryUIProps {
  error: Error | undefined;
  onReload: () => void;
  onReset: () => void;
}

function ErrorBoundaryUI({
  error,
  onReload,
  onReset,
}: ErrorBoundaryUIProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">
          {t('应用遇到了错误')}
        </h1>

        <p className="text-muted-foreground mb-6">
          {error?.message ?? t('发生了未知错误')}
        </p>

        {/* 开发环境下显示错误详情 */}
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2">
              {t('查看错误详情')}
            </summary>
            <div className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto max-h-40">
              <div className="text-destructive mb-2">{error.name}: {error.message}</div>
              <div className="text-muted-foreground whitespace-pre-wrap">
                {error.stack}
              </div>
            </div>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onReset} variant="outline">
            {t('重试')}
          </Button>
          <Button onClick={onReload}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('重新加载应用')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          {t('如果问题持续存在，请联系技术支持')}
        </p>
      </div>
    </div>
  );
}

// Hook版本的错误边界（用于函数组件）
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    console.error('Hook Error Handler:', error, errorInfo);

    // 在开发环境下显示详细错误
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Hook Error Details');
      console.error('Error:', error);
      if (errorInfo) {
        console.error('Error Info:', errorInfo);
      }
      console.groupEnd();
    }

    // 可以在这里添加错误上报逻辑
    // reportError(error, errorInfo);
  };
}

export default ErrorBoundary;