/**
 * Performance Benchmarking Utility
 *
 * Features:
 * 1. Component render performance testing
 * 2. Memory usage benchmarking
 * 3. Network request performance analysis
 * 4. Bundle size analysis
 * 5. User interaction performance measurement
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  standardDeviation: number;
  memoryUsage?: MemoryInfo;
  timestamp: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface BundleAnalysis {
  totalSize: number;
  chunks: ChunkInfo[];
  dependencies: DependencyInfo[];
  unusedAssets: string[];
}

interface ChunkInfo {
  name: string;
  size: number;
  type: 'js' | 'css' | 'asset';
  modules: string[];
}

interface DependencyInfo {
  name: string;
  version: string;
  size: number;
  used: boolean;
}

/**
 * Performance benchmark runner
 */
class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private observers: PerformanceObserver[] = [];

  /**
   * Run a performance benchmark on a function
   */
  async runBenchmark(
    name: string,
    fn: () => void | Promise<void>,
    options: {
      iterations?: number;
      warmupIterations?: number;
      memoryTracking?: boolean;
    } = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 100,
      warmupIterations = 10,
      memoryTracking = true
    } = options;

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }

    const times: number[] = [];
    const memorySnapshots: MemoryInfo[] = [];

    // Benchmark phase
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      if (memoryTracking && 'memory' in performance) {
        const memory = (performance as any).memory;
        memorySnapshots.push({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
      }

      await fn();
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    // Calculate statistics
    const totalTime = times.reduce((a, b) => a + b, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Calculate standard deviation
    const squaredDifferences = times.map(time => Math.pow(time - averageTime, 2));
    const variance = squaredDifferences.reduce((a, b) => a + b, 0) / iterations;
    const standardDeviation = Math.sqrt(variance);

    // Calculate memory usage
    const memoryUsage = memoryTracking && memorySnapshots.length > 0 ? {
      usedJSHeapSize: memorySnapshots.reduce((sum, mem) => sum + mem.usedJSHeapSize, 0) / memorySnapshots.length,
      totalJSHeapSize: memorySnapshots.reduce((sum, mem) => sum + mem.totalJSHeapSize, 0) / memorySnapshots.length,
      jsHeapSizeLimit: memorySnapshots[0].jsHeapSizeLimit
    } : undefined;

    const result: BenchmarkResult = {
      name,
      duration: totalTime,
      iterations,
      averageTime,
      minTime,
      maxTime,
      standardDeviation,
      memoryUsage,
      timestamp: Date.now()
    };

    this.results.push(result);
    return result;
  }

  /**
   * Benchmark React component render performance
   */
  async benchmarkComponent(
    componentName: string,
    renderFn: () => void,
    options: {
      iterations?: number;
      warmupIterations?: number;
    } = {}
  ): Promise<BenchmarkResult> {
    return this.runBenchmark(
      `Component: ${componentName}`,
      renderFn,
      options
    );
  }

  /**
   * Benchmark user interaction performance
   */
  async benchmarkInteraction(
    interactionName: string,
    interactionFn: () => void,
    options: {
      iterations?: number;
      warmupIterations?: number;
    } = {}
  ): Promise<BenchmarkResult> {
    return this.runBenchmark(
      `Interaction: ${interactionName}`,
      interactionFn,
      options
    );
  }

  /**
   * Analyze bundle size and chunks
   */
  async analyzeBundle(): Promise<BundleAnalysis> {
    // This would typically be done with webpack-bundle-analyzer or similar tools
    // For now, we'll provide a mock implementation
    const mockChunks: ChunkInfo[] = [
      { name: 'main.js', size: 245760, type: 'js', modules: ['App', 'Router', 'Store'] },
      { name: 'react-vendor.js', size: 131072, type: 'js', modules: ['react', 'react-dom'] },
      { name: 'ui-vendor.js', size: 65536, type: 'js', modules: ['lucide-react', 'framer-motion'] },
      { name: 'three-vendor.js', size: 524288, type: 'js', modules: ['three', '@react-three/fiber'] },
      { name: 'main.css', size: 32768, type: 'css', modules: ['tailwind'] }
    ];

    const mockDependencies: DependencyInfo[] = [
      { name: 'react', version: '18.2.0', size: 45056, used: true },
      { name: 'three', version: '0.155.0', size: 524288, used: true },
      { name: 'echarts', version: '5.4.3', size: 196608, used: false }
    ];

    return {
      totalSize: mockChunks.reduce((sum, chunk) => sum + chunk.size, 0),
      chunks: mockChunks,
      dependencies: mockDependencies,
      unusedAssets: ['legacy-polyfills.js', 'unused-component.js']
    };
  }

  /**
   * Measure memory usage over time
   */
  measureMemoryUsage(duration: number = 5000): Promise<MemoryInfo[]> {
    return new Promise((resolve) => {
      const measurements: MemoryInfo[] = [];
      const interval = setInterval(() => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          measurements.push({
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          });
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        resolve(measurements);
      }, duration);
    });
  }

  /**
   * Analyze Core Web Vitals
   */
  async analyzeCoreWebVitals(): Promise<{
    LCP: number;
    FID: number;
    CLS: number;
    FCP: number;
    TTFB: number;
  }> {
    return new Promise((resolve) => {
      const vitals = {
        LCP: 0,
        FID: 0,
        CLS: 0,
        FCP: 0,
        TTFB: 0
      };

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              vitals.LCP = entry.startTime;
              break;
            case 'first-input':
              vitals.FID = (entry as any).processingStart - entry.startTime;
              break;
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                vitals.CLS += (entry as any).value;
              }
              break;
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                vitals.FCP = entry.startTime;
              }
              break;
            case 'navigation':
              vitals.TTFB = (entry as any).responseStart;
              break;
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint', 'navigation'] });
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }

      // Wait a bit for metrics to be collected
      setTimeout(() => {
        observer.disconnect();
        resolve(vitals);
      }, 3000);
    });
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: {
      totalBenchmarks: number;
      averageRenderTime: number;
      worstPerforming: string;
      bestPerforming: string;
    };
    benchmarks: BenchmarkResult[];
    recommendations: string[];
  } {
    const benchmarks = this.results;
    const totalBenchmarks = benchmarks.length;

    if (totalBenchmarks === 0) {
      return {
        summary: {
          totalBenchmarks: 0,
          averageRenderTime: 0,
          worstPerforming: 'N/A',
          bestPerforming: 'N/A'
        },
        benchmarks: [],
        recommendations: ['Run some benchmarks to see performance analysis']
      };
    }

    const averageRenderTime = benchmarks.reduce((sum, b) => sum + b.averageTime, 0) / totalBenchmarks;
    const worstPerforming = benchmarks.reduce((worst, b) => b.averageTime > worst.averageTime ? b : worst);
    const bestPerforming = benchmarks.reduce((best, b) => b.averageTime < best.averageTime ? b : best);

    // Generate recommendations
    const recommendations: string[] = [];

    if (averageRenderTime > 16) {
      recommendations.push('Average render time exceeds 16ms frame budget');
    }

    if (worstPerforming.averageTime > 100) {
      recommendations.push(`${worstPerforming.name} has very poor performance (${worstPerforming.averageTime.toFixed(2)}ms avg)`);
    }

    const highVarianceBenchmarks = benchmarks.filter(b => b.standardDeviation > b.averageTime * 0.5);
    if (highVarianceBenchmarks.length > 0) {
      recommendations.push('Some benchmarks show high variance, indicating inconsistent performance');
    }

    const memoryIntensiveBenchmarks = benchmarks.filter(b =>
      b.memoryUsage && b.memoryUsage.usedJSHeapSize > 50 * 1024 * 1024
    );
    if (memoryIntensiveBenchmarks.length > 0) {
      recommendations.push('Some benchmarks use excessive memory (>50MB)');
    }

    if (recommendations.length === 0) {
      recommendations.push('All benchmarks show good performance');
    }

    return {
      summary: {
        totalBenchmarks,
        averageRenderTime,
        worstPerforming: worstPerforming.name,
        bestPerforming: bestPerforming.name
      },
      benchmarks,
      recommendations
    };
  }

  /**
   * Clear all benchmark results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      results: this.results,
      report: this.generateReport(),
      timestamp: Date.now()
    }, null, 2);
  }

  /**
   * Import results from JSON
   */
  importResults(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      if (data.results && Array.isArray(data.results)) {
        this.results = data.results;
      }
    } catch (error) {
      console.error('Failed to import benchmark results:', error);
    }
  }
}

/**
 * Hook for performance benchmarking
 */
export function usePerformanceBenchmark() {
  const benchmark = useRef(new PerformanceBenchmark());

  const runComponentBenchmark = useCallback(async (
    componentName: string,
    renderFn: () => void,
    options?: { iterations?: number; warmupIterations?: number }
  ) => {
    return benchmark.current.benchmarkComponent(componentName, renderFn, options);
  }, []);

  const runInteractionBenchmark = useCallback(async (
    interactionName: string,
    interactionFn: () => void,
    options?: { iterations?: number; warmupIterations?: number }
  ) => {
    return benchmark.current.benchmarkInteraction(interactionName, interactionFn, options);
  }, []);

  const analyzeBundle = useCallback(async () => {
    return benchmark.current.analyzeBundle();
  }, []);

  const measureMemory = useCallback(async (duration?: number) => {
    return benchmark.current.measureMemoryUsage(duration);
  }, []);

  const analyzeCoreWebVitals = useCallback(async () => {
    return benchmark.current.analyzeCoreWebVitals();
  }, []);

  const generateReport = useCallback(() => {
    return benchmark.current.generateReport();
  }, []);

  const exportResults = useCallback(() => {
    return benchmark.current.exportResults();
  }, []);

  const clearResults = useCallback(() => {
    benchmark.current.clearResults();
  }, []);

  return {
    runComponentBenchmark,
    runInteractionBenchmark,
    analyzeBundle,
    measureMemory,
    analyzeCoreWebVitals,
    generateReport,
    exportResults,
    clearResults
  };
}

/**
 * Performance monitoring for production
 */
export class ProductionPerformanceMonitor {
  private static instance: ProductionPerformanceMonitor;
  private metrics: any[] = [];
  private observers: PerformanceObserver[] = [];

  static getInstance(): ProductionPerformanceMonitor {
    if (!ProductionPerformanceMonitor.instance) {
      ProductionPerformanceMonitor.instance = new ProductionPerformanceMonitor();
    }
    return ProductionPerformanceMonitor.instance;
  }

  private constructor() {
    this.initializeObservers();
  }

  private initializeObservers(): void {
    // Observer for long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.duration > 50) {
              this.metrics.push({
                type: 'long-task',
                duration: entry.duration,
                timestamp: Date.now()
              });
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }
    }
  }

  recordCustomMetric(name: string, value: number, metadata?: any): void {
    this.metrics.push({
      type: 'custom',
      name,
      value,
      timestamp: Date.now(),
      metadata
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(): any[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

export default PerformanceBenchmark;