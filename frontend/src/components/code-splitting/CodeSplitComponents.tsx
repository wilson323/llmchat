/**
 * CodeSplitComponents - Lazy loading for heavy components
 *
 * Features:
 * 1. Dynamic imports with React.lazy
 * 2. Loading states and error boundaries
 * 3. Prefetching strategies
 * 4. Bundle size optimization
 * 5. Progressive loading
 */


import { AlertTriangle, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';


// performanceOptimizer已删除

// Error boundary for lazy loaded components
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; onRetry?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, retryCount: 0 };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState((prev: ErrorBoundaryState) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Card className="border-dashed">
          <Card.Content className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-medium mb-2">Component Load Failed</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'Failed to load component'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                disabled={this.state.retryCount >= 3}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry ({this.state.retryCount}/3)
              </Button>
              {this.state.retryCount >= 3 && (
                <Badge variant="destructive">Max retries reached</Badge>
              )}
            </div>
          </Card.Content>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Loading component with different states
interface LoadingComponentProps {
  type?: 'skeleton' | 'spinner' | 'progress';
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

function LoadingComponent({
  type = 'spinner',
  message = 'Loading...',
  size = 'md',
}: LoadingComponentProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const containerSizeClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-8',
  };

  switch (type) {
    case 'skeleton':
      return (
        <div className={`${containerSizeClasses[size]}`}>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
          </div>
        </div>
      );

    case 'progress':
      return (
        <div className={`${containerSizeClasses[size]}`}>
          <div className="space-y-2">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse w-1/3" />
            </div>
            <p className="text-sm text-muted-foreground text-center">{message}</p>
          </div>
        </div>
      );

    default: // spinner
      return (
        <div className={`${containerSizeClasses[size]} flex flex-col items-center justify-center`}>
          <Loader2 className={`${sizeClasses[size]} animate-spin text-primary mb-2`} />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      );
  }
}

// Enhanced lazy load wrapper with prefetching
function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    prefetch?: boolean;
    timeout?: number;
    retryCount?: number;
    fallback?: React.ReactNode;
    loadingType?: LoadingComponentProps['type'];
  } = {},
) {
  const LazyComponent = lazy(() => {
    return Promise.race([
      importFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Component load timeout')), options.timeout || 10000),
      ),
    ]);
  });

  // Prefetch component if enabled
  if (options.prefetch) {
    importFn();
  }

  return function LazyComponentWrapper(props: React.ComponentProps<T>) {
    return (
      <LazyLoadErrorBoundary fallback={options.fallback}>
        <Suspense
          fallback={
            options.fallback || (
              <LoadingComponent
                type={options.loadingType || 'spinner'}
                message="Loading component..."
                size="md"
              />
            )
          }
        >
          <LazyComponent {...props} />
        </Suspense>
      </LazyLoadErrorBoundary>
    );
  };
}

// Lazy loaded admin components - using existing components
export const LazyAdminDashboard = createLazyComponent(
  () => import('@/components/admin/AdminHome'),
  {
    prefetch: false, // Don't prefetch admin dashboard
    timeout: 15000,
    loadingType: 'skeleton',
  },
);

export const LazyUserManagement = createLazyComponent(
  () => import('@/components/admin/AgentsPanel'),
  {
    prefetch: false,
    timeout: 10000,
    loadingType: 'spinner',
  },
);

export const LazyAgentConfig = createLazyComponent(
  () => import('@/components/admin/AgentBatchImport').then(module => ({ default: module.AgentBatchImport })),
  {
    prefetch: false,
    timeout: 10000,
    loadingType: 'spinner',
  },
);

export const LazyAnalytics = createLazyComponent(
  () => import('@/components/admin/AnalyticsPanel'),
  {
    prefetch: false,
    timeout: 15000,
    loadingType: 'progress',
  },
);

// Lazy loaded 3D/CAD components - using placeholder for now
const ThreeDViewerPlaceholder = () => <div className="p-4 text-center">3D Viewer Placeholder</div>;
const CADRendererPlaceholder = () => <div className="p-4 text-center">CAD Renderer Placeholder</div>;

export const LazyThreeDViewer = createLazyComponent(
  () => Promise.resolve({ default: ThreeDViewerPlaceholder }),
  {
    prefetch: false,
    timeout: 20000, // 3D components may take longer
    loadingType: 'progress',
  },
);

export const LazyCADRenderer = createLazyComponent(
  () => Promise.resolve({ default: CADRendererPlaceholder }),
  {
    prefetch: false,
    timeout: 25000,
    loadingType: 'progress',
  },
);

// Lazy loaded chart components - using existing components
export const LazyChartComponent = createLazyComponent(
  () => import('@/components/admin/SessionStatsChart').then(module => ({ default: module.SessionStatsChart })),
  {
    prefetch: true, // Charts are commonly used
    timeout: 10000,
    loadingType: 'spinner',
  },
);

export const LazyEChartsComponent = createLazyComponent(
  () => import('@/components/charts/EChartsPlaceholder'),
  {
    prefetch: true,
    timeout: 12000,
    loadingType: 'spinner',
  },
);

// Lazy loaded advanced chat components - using placeholder
const ChatAttachmentsPlaceholder = () => <div className="p-4 text-center">Chat Attachments Placeholder</div>;

export const LazyChatAttachments = createLazyComponent(
  () => Promise.resolve({ default: ChatAttachmentsPlaceholder }),
  {
    prefetch: false,
    timeout: 8000,
    loadingType: 'spinner',
  },
);

// LazyVoiceChat已删除 - voice/VoiceCallWorkspace组件已清理

export const LazyInteractiveComponents = createLazyComponent(
  () => import('@/components/chat/InteractiveComponent'),
  {
    prefetch: false,
    timeout: 8000,
    loadingType: 'spinner',
  },
);

// Prefetching hook
export function usePrefetchComponents() {
  const prefetchComponent = useCallback((componentName: string) => {
    const componentMap: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
      'AdminDashboard': () => import('@/components/admin/AdminHome'),
      'UserManagement': () => import('@/components/admin/AgentsPanel'),
      'AgentConfig': () => import('@/components/admin/AgentBatchImport').then(module => ({ default: module.AgentBatchImport })),
      'Analytics': () => import('@/components/admin/AnalyticsPanel'),
      'ThreeDViewer': () => Promise.resolve({ default: ThreeDViewerPlaceholder }),
      'CADRenderer': () => Promise.resolve({ default: CADRendererPlaceholder }),
      'ChartComponent': () => import('@/components/admin/SessionStatsChart').then(module => ({ default: module.SessionStatsChart })),
      'EChartsComponent': () => import('@/components/charts/EChartsPlaceholder'),
      'ChatAttachments': () => Promise.resolve({ default: ChatAttachmentsPlaceholder }),
      'InteractiveComponents': () => import('@/components/chat/InteractiveComponent'),
    };

    const importFn = componentMap[componentName];
    if (importFn) {
      importFn().catch(error => {
        console.warn(`Failed to prefetch ${componentName}:`, error);
      });
    }
  }, []);

  const prefetchAdminComponents = useCallback(() => {
    prefetchComponent('AdminDashboard');
    prefetchComponent('UserManagement');
    prefetchComponent('AgentConfig');
  }, [prefetchComponent]);

  const prefetchChatComponents = useCallback(() => {
    prefetchComponent('ChartComponent');
    prefetchComponent('ChatAttachments');
    prefetchComponent('InteractiveComponents');
  }, [prefetchComponent]);

  const prefetch3DComponents = useCallback(() => {
    prefetchComponent('ThreeDViewer');
    prefetchComponent('CADRenderer');
  }, [prefetchComponent]);

  return {
    prefetchComponent,
    prefetchAdminComponents,
    prefetchChatComponents,
    prefetch3DComponents,
  };
}

// Network status hook for conditional loading
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleConnectionChange = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('connectionchange', handleConnectionChange);

    handleConnectionChange(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('connectionchange', handleConnectionChange);
    };
  }, []);

  return {
    isOnline,
    connectionType,
    canLoadHeavyComponents: isOnline && ['4g', 'wifi'].includes(connectionType.toLowerCase()),
  };
}

// Smart loading wrapper that considers network conditions
interface SmartLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireHighBandwidth?: boolean;
}

export function SmartLoader({
  children,
  fallback,
  requireHighBandwidth = false,
}: SmartLoaderProps) {
  const { isOnline, canLoadHeavyComponents } = useNetworkStatus();

  if (!isOnline) {
    return (
      fallback || (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <Alert.Description>
            You are offline. Some features may not be available.
          </Alert.Description>
        </Alert>
      )
    );
  }

  if (requireHighBandwidth && !canLoadHeavyComponents) {
    return (
      fallback || (
        <Alert>
          <Wifi className="h-4 w-4" />
          <Alert.Description>
            Slow connection detected. Using lighter version of this component.
          </Alert.Description>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}

export default {
  LazyAdminDashboard,
  LazyUserManagement,
  LazyAgentConfig,
  LazyAnalytics,
  LazyThreeDViewer,
  LazyCADRenderer,
  LazyChartComponent,
  LazyEChartsComponent,
  LazyChatAttachments,
  LazyVoiceChat,
  LazyInteractiveComponents,
  usePrefetchComponents,
  useNetworkStatus,
  SmartLoader,
  createLazyComponent,
};