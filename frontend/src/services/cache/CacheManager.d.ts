import { ICacheManager, CacheStrategy, DataTemperature, CacheOptions, CacheUsageStats, IStorageProvider } from '@/types/hybrid-storage';
interface CacheMetrics {
    hits: number;
    misses: number;
    evictions: number;
    promotions: number;
    demotions: number;
    preloads: number;
    totalRequests: number;
    averageResponseTime: number;
}
export declare class CacheManager implements ICacheManager {
    private memoryProvider;
    private indexedDBProvider;
    private strategy;
    private metrics;
    private preloadQueue;
    private isPreloading;
    private cleanupInterval;
    private preloadHistory;
    constructor(memoryProvider: IStorageProvider, indexedDBProvider: IStorageProvider);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    mget<T>(keys: string[]): Promise<Map<string, T | null>>;
    mset<T>(entries: Array<{
        key: string;
        value: T;
        options?: CacheOptions;
    }>): Promise<void>;
    setStrategy(strategy: CacheStrategy): void;
    getStrategy(): CacheStrategy;
    promoteToHot(key: string): Promise<void>;
    demoteToCold(key: string): Promise<void>;
    getTemperature(key: string): Promise<DataTemperature>;
    preload(keys: string[]): Promise<void>;
    preloadAgentSessions(agentId: string, limit?: number): Promise<void>;
    cleanup(): Promise<void>;
    optimize(): Promise<void>;
    getUsageStats(): Promise<CacheUsageStats>;
    private initializeCleanup;
    private determineTemperature;
    private promoteToMemory;
    private hasMemorySpace;
    private evictColdMemoryData;
    private triggerRelatedPreload;
    private extractAgentIdFromKey;
    private getAgentSessionKeys;
    private addToPreloadQueue;
    private processPreloadQueue;
    private sortKeysByPriority;
    private extractTimestampFromKey;
    private executePreload;
    private setBatchInMemory;
    private setBatchInIndexedDB;
    private getIndexedDBUsage;
    private estimateCacheDistribution;
    private cleanupLowFrequencyData;
    private rebalanceStorage;
    private getHotDataFromMemory;
    private updateAverageResponseTime;
    private getDefaultUsageStats;
    getMetrics(): CacheMetrics;
    resetMetrics(): void;
    destroy(): void;
}
export {};
//# sourceMappingURL=CacheManager.d.ts.map