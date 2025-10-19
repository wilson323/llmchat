/**
 * 错误边界组件
 */


import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';


interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                出错了
              </h2>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                抱歉，应用程序遇到了一个错误。请尝试刷新页面。
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs">
                  <summary className="cursor-pointer font-semibold mb-2">
                    错误详情
                  </summary>
                  <pre className="whitespace-pre-wrap text-red-600 dark:text-red-400">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="whitespace-pre-wrap mt-2 text-gray-700 dark:text-gray-300">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
