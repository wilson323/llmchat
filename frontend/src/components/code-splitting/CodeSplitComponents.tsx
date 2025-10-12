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

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense, ComponentType, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { usePerformanceMonitor } from '@/utils/performanceOptimizer';

// Error boundary for lazy loaded components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

class LazyLoadErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onRetry?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy load error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: undefined,
      retryCount: prev.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
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
          </CardContent>
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
  size = 'md'
}: LoadingComponentProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const containerSizeClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-8'
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
function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    prefetch?: boolean;
    timeout?: number;
    retryCount?: number;
    fallback?: ReactNode;
    loadingType?: LoadingComponentProps['type'];
  } = {}
) {
  const LazyComponent = lazy(() => {
    return Promise.race([
      importFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Component load timeout')), options.timeout || 10000)
      )
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

// Lazy loaded admin components
export const LazyAdminDashboard = createLazyComponent(
  () => import('@/components/admin/AdminDashboard'),
  {
    prefetch: false, // Don't prefetch admin dashboard
    timeout: 15000,
    loadingType: 'skeleton'
  }
);

export const LazyUserManagement = createLazyComponent(
  () => import('@/components/admin/UserManagement'),
  {
    prefetch: false,
    timeout: 10000,
    loadingType: 'spinner'
  }
);

export const LazyAgentConfig = createLazyComponent(
  () => import('@/components/admin/AgentConfig'),
  {
    prefetch: false,
    timeout: 10000,
    loadingType: 'spinner'
  }
);

export const LazyAnalytics = createLazyComponent(
  () => import('@/components/admin/Analytics'),
  {
    prefetch: false,
    timeout: 15000,
    loadingType: 'progress'
  }
);

// Lazy loaded 3D/CAD components
export const LazyThreeDViewer = createLazyComponent(
  () => import('@/components/cad/ThreeDViewer'),
  {
    prefetch: false,
    timeout: 20000, // 3D components may take longer
    loadingType: 'progress'
  }
);

export const LazyCADRenderer = createLazyComponent(
  () => import('@/components/cad/CADRenderer'),
  {
    prefetch: false,
    timeout: 25000,
    loadingType: 'progress'
  }
);

// Lazy loaded chart components
export const LazyChartComponent = createLazyComponent(
  () => import('@/components/charts/ChartComponent'),
  {
    prefetch: true, // Charts are commonly used
    timeout: 10000,
    loadingType: 'spinner'
  }
);

export const LazyEChartsComponent = createLazyComponent(
  () => import('@/components/charts/EChartsComponent'),
  {
    prefetch: true,
    timeout: 12000,
    loadingType: 'spinner'
  }
);

// Lazy loaded advanced chat components
export const LazyChatAttachments = createLazyComponent(
  () => import('@/components/chat/ChatAttachments'),
  {
    prefetch: false,
    timeout: 8000,
    loadingType: 'spinner'
  }
);

export const LazyVoiceChat = createLazyComponent(
  () => import('@/components/voice/VoiceChat'),
  {
    prefetch: false,
    timeout: 10000,
    loadingType: 'spinner'
  }
);

export const LazyInteractiveComponents = createLazyComponent(
  () => import('@/components/chat/InteractiveComponents'),
  {
    prefetch: false,
    timeout: 8000,
    loadingType: 'spinner'
  }
);

// Prefetching hook
export function usePrefetchComponents() {
  usePerformanceMonitor('usePrefetchComponents');

  const prefetchComponent = useCallback((componentName: string) => {
    const componentMap: Record<string, () => Promise<{ default: ComponentType<any> }>> = {
      'AdminDashboard': () => import('@/components/admin/AdminDashboard'),
      'UserManagement': () => import('@/components/admin/UserManagement'),
      'AgentConfig': () => import('@/components/admin/AgentConfig'),
      'Analytics': () => import('@/components/admin/Analytics'),
      'ThreeDViewer': () => import('@/components/cad/ThreeDViewer'),
      'CADRenderer': () => import('@/components/cad/CADRenderer'),
      'ChartComponent': () => import('@/components/charts/ChartComponent'),
      'EChartsComponent': () => import('@/components/charts/EChartsComponent'),
      'ChatAttachments': () => import('@/components/chat/ChatAttachments'),
      'VoiceChat': () => import('@/components/voice/VoiceChat'),
      'InteractiveComponents': () => import('@/components/chat/InteractiveComponents'),
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
    prefetch3DComponents
  };
}

// Network status hook for conditional loading
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');

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
    canLoadHeavyComponents: isOnline && ['4g', 'wifi'].includes(connectionType.toLowerCase())
  };
}

// Smart loading wrapper that considers network conditions
interface SmartLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireHighBandwidth?: boolean;
}

export function SmartLoader({
  children,
  fallback,
  requireHighBandwidth = false
}: SmartLoaderProps) {
  const { isOnline, canLoadHeavyComponents } = useNetworkStatus();

  if (!isOnline) {
    return (
      fallback || (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are offline. Some features may not be available.
          </AlertDescription>
        </Alert>
      )
    );
  }

  if (requireHighBandwidth && !canLoadHeavyComponents) {
    return (
      fallback || (
        <Alert>
          <Wifi className="h-4 w-4" />
          <AlertDescription>
            Slow connection detected. Using lighter version of this component.
          </AlertDescription>
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
  createLazyComponent
};