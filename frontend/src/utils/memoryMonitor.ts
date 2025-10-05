/**
 * 内存监控工具
 * 用于监控应用的内存使用情况
 */

export class MemoryMonitor {
  private baselineMemory: number | null = null;
  private measurements: Array<{ timestamp: number; memory: number }> = [];

  /**
   * 获取当前内存使用情况
   */
  getCurrentMemory(): number | null {
    if ("memory" in performance) {
      // @ts-ignore
      const memoryInfo = performance.memory;
      if (memoryInfo) {
        // 返回已使用的内存（MB）
        return Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
      }
    }
    return null;
  }

  /**
   * 设置基准内存使用量
   */
  setBaseline(): void {
    const currentMemory = this.getCurrentMemory();
    if (currentMemory !== null) {
      this.baselineMemory = currentMemory;
      this.measurements.push({
        timestamp: Date.now(),
        memory: currentMemory,
      });
    }
  }

  /**
   * 记录内存使用量
   */
  recordMeasurement(label: string): void {
    const currentMemory = this.getCurrentMemory();
    if (currentMemory !== null) {
      this.measurements.push({
        timestamp: Date.now(),
        memory: currentMemory,
      });

      console.log(`[MemoryMonitor] ${label}: ${currentMemory} MB`);

      if (this.baselineMemory !== null) {
        const diff = currentMemory - this.baselineMemory;
        console.log(
          `[MemoryMonitor] ${label} 相对于基准的差异: ${
            diff > 0 ? "+" : ""
          }${diff} MB`
        );
      }
    }
  }

  /**
   * 获取内存使用报告
   */
  getReport(): {
    baseline: number | null;
    current: number | null;
    peak: number | null;
    growth: number | null;
    measurements: Array<{ timestamp: number; memory: number }>;
  } {
    const currentMemory = this.getCurrentMemory();
    const peakMemory =
      this.measurements.length > 0
        ? Math.max(...this.measurements.map((m) => m.memory))
        : null;

    return {
      baseline: this.baselineMemory,
      current: currentMemory,
      peak: peakMemory,
      growth:
        this.baselineMemory !== null && currentMemory !== null
          ? currentMemory - this.baselineMemory
          : null,
      measurements: [...this.measurements],
    };
  }

  /**
   * 重置监控器
   */
  reset(): void {
    this.baselineMemory = null;
    this.measurements = [];
  }
}

// 创建全局实例
export const memoryMonitor = new MemoryMonitor();

// 如果在开发环境中，自动设置基准内存
if (import.meta.env?.DEV) {
  setTimeout(() => {
    memoryMonitor.setBaseline();
    console.log("[MemoryMonitor] 基准内存已设置");
  }, 1000);
}
