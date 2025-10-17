import { SearchQuery, HybridStorageConfig } from '@/types/hybrid-storage';
import { ChatSession, ChatMessage } from '@/types';
export declare class HybridStorageManager {
    private memoryProvider;
    private indexedDBProvider;
    private fastgptProvider;
    private cacheManager;
    private syncManager;
    private config;
    private isInitialized;
    constructor(config?: Partial<HybridStorageConfig>);
    initialize(): Promise<void>;
    getSession(sessionId: string): Promise<ChatSession | null>;
    saveSession(session: ChatSession): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;
    getAgentSessions(agentId: string, limit?: number): Promise<ChatSession[]>;
    searchSessions(query: SearchQuery): Promise<Array<{
        session: ChatSession;
        score: number;
    }>>;
    addMessageToSession(sessionId: string, message: ChatMessage): Promise<void>;
    updateMessageInSession(sessionId: string, messageId: string, updater: (message: ChatMessage) => ChatMessage | undefined): Promise<void>;
    syncSession(sessionId: string): Promise<boolean>;
    syncAgentSessions(agentId: string): Promise<boolean>;
    forceSyncAll(): Promise<boolean>;
    preloadAgentSessions(agentId: string, limit?: number): Promise<void>;
    cleanupCache(): Promise<void>;
    optimizeCache(): Promise<void>;
    getCacheStats(): Promise<any>;
    enableOfflineMode(): Promise<void>;
    disableOfflineMode(): Promise<void>;
    isOfflineMode(): Promise<boolean>;
    getStorageStats(): Promise<{
        memory: any;
        indexedDB: any;
        fastgpt: any;
        cache: any;
    }>;
    getSyncStats(): Promise<any>;
    onSyncProgress(callback: (progress: any) => void): () => void;
    onSyncConflict(callback: (conflict: any) => void): () => void;
    onSyncError(callback: (error: any) => void): () => void;
    private setupEventListeners;
    private startBackgroundTasks;
    private determineSessionTemperature;
    private convertRemoteSessionToLocal;
    private convertRemoteMessages;
    healthCheck(): Promise<{
        memory: boolean;
        indexedDB: boolean;
        fastgpt: boolean;
        overall: boolean;
    }>;
    private checkProviderHealth;
    destroy(): Promise<void>;
    updateConfig(newConfig: Partial<HybridStorageConfig>): void;
    private mergeConfig;
}
//# sourceMappingURL=HybridStorageManager.d.ts.map