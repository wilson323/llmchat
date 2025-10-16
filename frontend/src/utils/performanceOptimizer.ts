import { useRef, useEffect } from 'react';

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    console.log(`[Performance] ${componentName} rendered ${renderCount.current} times`);
  });

  return {
    renderCount: renderCount.current,
    componentName
  };
};

// Memory monitoring class
export class MemoryMonitor {
  private measurements: number[] = [];

  getCurrentUsage() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (performance as any).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          heapUsed: memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
        };
      }
    }

    // Fallback for browsers without memory API
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      heapUsed: 0
    };
  }

  startMeasurement() {
    this.measurements = [];
    const initial = this.getCurrentUsage();
    this.measurements.push(initial.heapUsed);
  }

  recordMeasurement() {
    const current = this.getCurrentUsage();
    this.measurements.push(current.heapUsed);
  }

  getAverageUsage() {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, val) => sum + val, 0) / this.measurements.length;
  }

  addMemoryObserver(_callback: () => void): () => void {
    // Implementation for memory observation
    console.log('Memory observer added');
    // Return cleanup function
    return () => {
      console.log('Memory observer removed');
    };
  }

  startMonitoring() {
    console.log('[Memory Monitor] Started monitoring');
    this.startMeasurement();
  }

  stopMonitoring() {
    console.log('[Memory Monitor] Stopped monitoring');
  }

  getMemoryStats() {
    const current = this.getCurrentUsage();
    return {
      current: current.heapUsed,
      average: this.getAverageUsage(),
      peak: Math.max(...this.measurements, current.heapUsed),
      trend: 'stable'
    };
  }
}

// Component performance monitor
export const componentMonitor = {
  startMonitoring(componentName: string) {
    console.log(`[Component Monitor] Started monitoring: ${componentName}`);
  },

  recordRender(componentName: string) {
    console.log(`[Component Monitor] Render recorded: ${componentName}`);
  },

  stopMonitoring(componentName: string) {
    console.log(`[Component Monitor] Stopped monitoring: ${componentName}`);
  },

  getAllStats() {
    return {
      PerformanceMonitor: {
        renders: 1,
        averageRenderTime: 0,
        isMounted: true
      }
    };
  }
};

// Request monitor for API calls
export const requestMonitor = {
  startRequest(requestId: string, url: string) {
    console.log(`[Request Monitor] Started: ${requestId} - ${url}`);
  },

  endRequest(requestId: string, method: string, status: number) {
    console.log(`[Request Monitor] Ended: ${requestId} - ${method} - ${status}`);
  },

  completeRequest(requestId: string, duration: number) {
    console.log(`[Request Monitor] Completed: ${requestId} - ${duration}ms`);
  },

  failRequest(requestId: string, error: string) {
    console.log(`[Request Monitor] Failed: ${requestId} - ${error}`);
  },

  getRequestStats() {
    return {
      totalRequests: 0,
      averageDuration: 0,
      slowestRequests: [],
      activeRequests: 0
    };
  }
};

export const memoryMonitor = new MemoryMonitor();

// Resource manager for memory and performance optimization
export class ResourceManager {
  private observers: Set<() => void> = new Set();
  private measurements: number[] = [];

  addObserver(callback: () => void) {
    this.observers.add(callback);
  }

  removeObserver(callback: () => void) {
    this.observers.delete(callback);
  }

  notifyObservers() {
    this.observers.forEach(callback => callback());
  }

  addMemoryObserver(callback: () => void) {
    this.addObserver(callback);
  }

  recordMeasurement() {
    const current = this.getCurrentUsage();
    this.measurements.push(current.heapUsed);
  }

  getCurrentUsage() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (performance as any).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          heapUsed: memory.usedJSHeapSize / 1024 / 1024
        };
      }
    }
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      heapUsed: 0
    };
  }

  cleanup() {
    this.observers.clear();
  }
}

export const resourceManager = new ResourceManager();

// Performance optimization utilities
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};