import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

// ========================================
// 代码分割：懒加载组件
// ========================================

// 主要页面懒加载
const ChatApp = lazy(() => import('@/components/ChatApp'));
const AgentWorkspace = lazy(() => import('@/components/workspace/AgentWorkspace'));
const LoginPage = lazy(() => import('@/components/admin/LoginPage'));
const AdminHome = lazy(() => import('@/components/admin/AdminHome'));

// 加载占位组件
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-muted-foreground">加载中...</p>
    </div>
  </div>
);

// 错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('错误边界捕获:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold text-destructive">页面加载失败</h1>
            <p className="text-muted-foreground">
              {this.state.error?.message || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* 主聊天页面 */}
              <Route path="/" element={<ChatApp />} />
              
              {/* 智能体工作区路由 */}
              <Route path="/chat/:agentId" element={<AgentWorkspace />} />
              
              {/* 登录页面 */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* 管理后台（需要登录） */}
              <Route path="/home" element={<AdminHome />} />
              <Route path="/home/:tab" element={<AdminHome />} />
              
              {/* 404 重定向 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          
          {/* 全局通知 */}
          <Toaster />
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
