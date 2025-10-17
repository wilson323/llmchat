import { IPerformanceMonitor, PerformanceReport, StorageMetrics, SyncMetrics, PerformanceAlert, OptimizationSuggestion, StorageTier } from '@/types/hybrid-storage';
interface PerformanceData {
    accessTime: number;
    operation: string;
    tier: StorageTier;
    success: boolean;
    dataSize?: number;
    timestamp: number;
}
interface SyncData {
    operation: string;
    duration: number;
    success: boolean;
    dataSize?: number;
    timestamp: number;
}
interface EvictionData {
    key: string;
    reason: string;
    tier: StorageTier;
    timestamp: number;
}
export declare class PerformanceMonitor implements IPerformanceMonitor {
    private accessHistory;
    private syncHistory;
    private evictionHistory;
    private alertCallbacks;
    private isMonitoring;
    private monitoringInterval;
    private maxHistorySize;
    private thresholds;
    constructor();
    recordAccess(_key: string, tier: StorageTier, duration: number, hit: boolean, dataSize?: number): void;
    recordSync(operation: string, duration: number, success: boolean, dataSize?: number): void;
    recordCacheEviction(key: string, reason: string, tier: StorageTier): void;
    getPerformanceReport(): Promise<PerformanceReport>;
    getStorageMetrics(): Promise<StorageMetrics>;
    getSyncMetrics(): Promise<SyncMetrics>;
    startRealTimeMonitoring(): void;
    stopRealTimeMonitoring(): void;
    onPerformanceAlert(callback: (alert: PerformanceAlert) => void): () => void;
    getOptimizationSuggestions(): Promise<OptimizationSuggestion[]>;
    private setupErrorHandling;
    private recordError;
    private addToHistory;
    private checkAccessThresholds;
    private checkSyncThresholds;
    private checkEvictionThresholds;
    private getThresholdsForTier;
    private createAlert;
    private calculateStorageMetrics;
    private calculateMemoryMetrics;
    private calculateIndexedDBMetrics;
    private calculateFastgptMetrics;
    private calculateSyncMetrics;
    private calculateCacheMetrics;
    private getActiveAlerts;
    private generateOptimizationSuggestions;
    private performHealthCheck;
    private getDefaultReport;
    updateThresholds(newThresholds: Partial<typeof this.thresholds>): void;
    clearHistory(): void;
    getThresholds(): {
        memoryAccessTime: number;
        indexedDBAccessTime: number;
        fastgptAccessTime: number;
        errorRate: number;
        cacheHitRate: number;
        syncDuration: number;
        storageUsage: number;
    };
    exportData(): {
        accessHistory: PerformanceData[];
        syncHistory: SyncData[];
        evictionHistory: EvictionData[];
        thresholds: {
            memoryAccessTime: number;
            indexedDBAccessTime: number;
            fastgptAccessTime: number;
            errorRate: number;
            cacheHitRate: number;
            syncDuration: number;
            storageUsage: number;
        };
    };
    destroy(): void;
}
export {};
//# sourceMappingURL=PerformanceMonitor.d.ts.map