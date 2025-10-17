import { type HybridStorageConfig } from '@/types/hybrid-storage';
export { HybridStorageManager } from './storage/HybridStorageManager';
export { MemoryStorageProvider } from './storage/MemoryStorageProvider';
export { IndexedDBStorageProvider } from './storage/IndexedDBStorageProvider';
export { FastGPTStorageProvider } from './storage/FastGPTStorageProvider';
export { CacheManager } from './cache/CacheManager';
export { SyncManager } from './sync/SyncManager';
export { PerformanceMonitor, ErrorHandlingService, globalErrorHandler, globalPerformanceMonitor } from './monitoring';
export type { StorageTier, SyncStatus, DataTemperature, IStorageProvider, ICacheManager, ISyncManager, IPerformanceMonitor, StorageOptions, CacheOptions, SyncPolicy, HybridStorageConfig, CacheEntry, SessionMetadata, SyncConflict, SyncResult, BatchSyncResult, PerformanceReport, OptimizationSuggestion, CacheStrategy, SearchQuery, StorageStats, CacheUsageStats, SyncMetrics, PerformanceAlert, } from '@/types/hybrid-storage';
export { useHybridChatStore } from '@/store/HybridChatStore';
export declare const createHybridStorageService: (config?: Partial<HybridStorageConfig>) => Promise<import("./storage/HybridStorageManager").HybridStorageManager>;
export declare const defaultHybridStorageConfig: Partial<HybridStorageConfig>;
export declare const HYBRID_STORAGE_VERSION = "1.0.0";
//# sourceMappingURL=HybridStorageService.d.ts.map