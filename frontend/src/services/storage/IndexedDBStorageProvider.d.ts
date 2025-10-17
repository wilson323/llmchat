import { IStorageProvider, StorageOptions, StorageStats, SearchQuery } from '@/types/hybrid-storage';
export declare class IndexedDBStorageProvider implements IStorageProvider {
    readonly name = "IndexedDBStorage";
    readonly tier: any;
    private db;
    private dbName;
    private dbVersion;
    private storeName;
    private maxStorage;
    private maxEntries;
    private isInitialized;
    private initPromise;
    private readonly schema;
    constructor(maxStorage?: number, maxEntries?: number);
    get isAvailable(): boolean;
    init(): Promise<void>;
    private _init;
    private openDatabase;
    private createObjectStores;
    destroy(): Promise<void>;
    private getTransaction;
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
    private updateAccessStats;
    private ensureCapacity;
    private evictEntries;
    private calculateSearchScore;
    private getStorageEstimate;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=IndexedDBStorageProvider.d.ts.map