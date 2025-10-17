import { IStorageProvider, StorageOptions, StorageStats, SearchQuery } from '@/types/hybrid-storage';
import { FastGPTChatHistorySummary, FastGPTChatHistoryDetail } from '@/types';
interface FastGPTConfig {
    baseUrl: string;
    apiKey: string;
    appId?: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}
export declare class FastGPTStorageProvider implements IStorageProvider {
    readonly name = "FastGPTStorage";
    readonly tier: any;
    private config;
    private isInitialized;
    private requestCache;
    private cacheExpiry;
    constructor(config: FastGPTConfig);
    get isAvailable(): boolean;
    init(): Promise<void>;
    private validateConnection;
    destroy(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set<T>(_key: string, _value: T, _options?: StorageOptions): Promise<void>;
    delete(_key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    clear(): Promise<void>;
    mget<T>(keys: string[]): Promise<Map<string, T | null>>;
    mset<T>(_entries: Array<{
        key: string;
        value: T;
        options?: StorageOptions;
    }>): Promise<void>;
    mdelete(_keys: string[]): Promise<boolean>;
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
    getChatSummaries(chatIds?: string[]): Promise<FastGPTChatHistorySummary[]>;
    getAllChatSummaries(): Promise<FastGPTChatHistorySummary[]>;
    getChatHistory(chatId: string): Promise<FastGPTChatHistoryDetail | null>;
    getChatSummary(chatId: string): Promise<FastGPTChatHistorySummary | null>;
    getChatSummariesByAgent(agentId: string): Promise<FastGPTChatHistorySummary[]>;
    getIncrementalUpdates(agentId: string, since?: number): Promise<any[]>;
    private makeRequest;
    private extractChatIdFromKey;
    private generateKeyFromChatId;
    private getCachedData;
    private setCachedData;
    clearCache(): void;
    updateConfig(newConfig: Partial<FastGPTConfig>): void;
}
export {};
//# sourceMappingURL=FastGPTStorageProvider.d.ts.map