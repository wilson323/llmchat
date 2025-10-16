import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { createEnhancedLazyComponent } from '@/components/ui/EnhancedLazyComponent';
import { initializeComponentRegistry, preloadCriticalComponents } from '@/utils/componentRegistry';
import { EnhancedCodeSplitting } from '@/utils/enhancedCodeSplitting';
import { preloadService } from '@/services/preloadService';
// import CodeSplittingMonitor from '@/components/dev/CodeSplittingMonitor'; // 已禁用

// ========================================
// 增强版代码分割：懒加载组件
// ========================================

// 确保组件注册表已初始化
initializeComponentRegistry();

// 主要页面懒加载 - 使用增强版懒加载
const ChatApp = createEnhancedLazyComponent(
  'ChatApp',
  () => import('@/components/ChatApp'),
  {
    priority: 10,
    preloadStrategy: 'immediate',
    showProgress: true,
    delay: 0,
    minLoadingTime: 300,
  },
);

const AgentWorkspace = createEnhancedLazyComponent(
  'AgentWorkspace',
  () => import('@/components/workspace/AgentWorkspace'),
  {
    priority: 9,
    preloadStrategy: 'idle',
    showProgress: true,
    delay: 100,
  },
);

const LoginPage = createEnhancedLazyComponent(
  'LoginPage',
  () => import('@/components/admin/LoginPage'),
  {
    priority: 8,
    preloadStrategy: 'hover',
    showProgress: false,
    delay: 200,
  },
);

const AdminHome = createEnhancedLazyComponent(
  'AdminHome',
  () => import('@/components/admin/AdminHome'),
  {
    priority: 7,
    preloadStrategy: 'idle',
    showProgress: true,
    delay: 150,
    minLoadingTime: 500,
  },
);

// 按需加载的功能组件 - 性能监控已禁用（减少资源占用）
// const PerformanceDashboard = createEnhancedLazyComponent(
//   'PerformanceDashboard',
//   () => import('@/components/monitoring/PerformanceDashboard'),
//   {
//     priority: 3,
//     preloadStrategy: 'idle',
//     showProgress: false,
//     delay: 500,
//   },
// );

// 加载占位组件
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('错误边界捕获:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-4 p-8">
            <h1 className="text-2xl font-bold text-destructive">页面加载失败</h1>
            <p className="text-muted-foreground">
              {this.state.error?.message ?? '未知错误'}
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

// 登录页面包装组件，处理登录成功后的跳转
function LoginPageWrapper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleLoginSuccess = () => {
    // 获取重定向目标（如果有）
    const redirect = searchParams.get('redirect');

    // 跳转到重定向目标或默认管理后台
    if (redirect && redirect !== '/login') {
      void navigate(redirect, { replace: true });
    } else {
      void navigate('/admin', { replace: true }); // 修复：管理员登录后跳转到管理后台
    }
  };

  return <LoginPage onSuccess={handleLoginSuccess} />;
}

function App() {
  // 初始化增强版代码分割系统
  useEffect(() => {
    // 1. 设置智能预加载（组件注册表已在模块加载时初始化）
    EnhancedCodeSplitting.setupSmartPreloading();
    EnhancedCodeSplitting.setupBehavioralPreloading();

    // 2. 预加载关键组件
    preloadCriticalComponents().catch(error => {
      console.warn('关键组件预加载失败:', error);
    });

    // 3. 初始化原有预加载服务
    preloadService.init().catch(error => {
      console.warn('预加载服务初始化失败:', error);
    });

    // 清理函数
    return () => {
      preloadService.destroy();
      EnhancedCodeSplitting.clearComponentCache();
    };
  }, []);

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

              {/* 登录页面（带跳转逻辑） */}
              <Route path="/login" element={<LoginPageWrapper />} />
              {/* TRACE-routing-20251005-别名路由：兼容测试访问 /admin/login */}
              <Route path="/admin/login" element={<LoginPageWrapper />} />

              {/* 管理后台（需要登录） */}
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/:tab" element={<AdminHome />} />
              <Route path="/home" element={<AdminHome />} />
              <Route path="/home/:tab" element={<AdminHome />} />

              {/* 404 重定向 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          {/* 全局通知 */}
          <Toaster />

          {/* 性能监控仪表板 - 已禁用（生产环境减少资源占用） */}
          {/* <PerformanceDashboard /> */}

          {/* 代码分割监控（仅开发环境） - 已禁用 */}
          {/* <CodeSplittingMonitor /> */}
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
