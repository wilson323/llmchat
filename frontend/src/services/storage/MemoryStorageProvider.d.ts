import { IStorageProvider, StorageOptions, StorageStats, SearchQuery, CacheEntry } from '@/types/hybrid-storage';
export declare class MemoryStorageProvider implements IStorageProvider {
    readonly name = "MemoryStorage";
    readonly tier: any;
    private cache;
    private maxSize;
    private maxEntries;
    private accessOrder;
    private accessCounter;
    private hitCount;
    private missCount;
    private isInitialized;
    constructor(maxSize?: number, maxEntries?: number);
    get isAvailable(): boolean;
    init(): Promise<void>;
    destroy(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    clear(): Promise<void>;
    mget<T>(keys: string[]): Promise<Map<string, T | null>>;
    mset<T>(entries: Array<{
        key: string;
        value: T;
        options?: StorageOptions;
    }>): Promise<void>;
    mdelete(keys: string[]): Promise<boolean>;
    list<T>(prefix?: string, limit?: number): Promise<Array<{
        key: string;
        value: T;
    }>>;
    search<T>(query: SearchQuery): Promise<Array<{
        key: string;
        value: T;
        score: number;
    }>>;
    getStats(): Promise<StorageStats>;
    private calculateSize;
    private ensureCapacity;
    private evictEntries;
    cleanup(): Promise<void>;
    getHotData(limit?: number): Array<{
        key: string;
        entry: CacheEntry;
    }>;
}
//# sourceMappingURL=MemoryStorageProvider.d.ts.map