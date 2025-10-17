"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridStorageManager = void 0;
const hybrid_storage_1 = require("@/types/hybrid-storage");
;
;
;
;
const MemoryStorageProvider_1 = require("./MemoryStorageProvider");
const IndexedDBStorageProvider_1 = require("./IndexedDBStorageProvider");
const FastGPTStorageProvider_1 = require("./FastGPTStorageProvider");
const CacheManager_1 = require("../cache/CacheManager");
const SyncManager_1 = require("../sync/SyncManager");
class HybridStorageManager {
    constructor(config = {}) {
        this.isInitialized = false;
        this.config = {
            cache: {
                memory: {
                    maxSize: 50 * 1024 * 1024,
                    maxEntries: 1000,
                    strategy: hybrid_storage_1.CacheStrategy.LRU,
                    ttl: 30 * 60 * 1000,
                },
                indexedDB: {
                    maxSize: 100 * 1024 * 1024,
                    maxEntries: 10000,
                    strategy: hybrid_storage_1.CacheStrategy.LFU,
                    ttl: 7 * 24 * 60 * 60 * 1000,
                },
            },
            sync: {
                autoSync: true,
                syncInterval: 5 * 60 * 1000,
                batchSize: 10,
                maxRetries: 3,
                conflictResolution: 'prompt',
                compressData: true,
                deltaSync: true,
            },
            performance: {
                enableMonitoring: true,
                monitoringInterval: 30 * 1000,
                enableOptimizations: true,
                compressionThreshold: 10 * 1024,
            },
            storage: {
                enableEncryption: false,
                enableCompression: true,
                backupEnabled: false,
                cleanupInterval: 60 * 60 * 1000,
            },
            ...config,
        };
        this.memoryProvider = new MemoryStorageProvider_1.MemoryStorageProvider(this.config.cache.memory.maxSize, this.config.cache.memory.maxEntries);
        this.indexedDBProvider = new IndexedDBStorageProvider_1.IndexedDBStorageProvider(this.config.cache.indexedDB.maxSize, this.config.cache.indexedDB.maxEntries);
        this.fastgptProvider = new FastGPTStorageProvider_1.FastGPTStorageProvider({
            baseUrl: process.env.REACT_APP_FASTGPT_BASE_URL || '',
            apiKey: process.env.REACT_APP_FASTGPT_API_KEY || '',
            timeout: 30000,
        });
        this.cacheManager = new CacheManager_1.CacheManager(this.memoryProvider, this.indexedDBProvider);
        this.syncManager = new SyncManager_1.SyncManager(this.memoryProvider, this.indexedDBProvider, this.fastgptProvider, this.config.sync);
        this.setupEventListeners();
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            console.log('初始化混合存储管理器...');
            await Promise.all([
                this.memoryProvider.init(),
                this.indexedDBProvider.init(),
                this.fastgptProvider.init(),
            ]);
            this.cacheManager.setStrategy(this.config.cache.memory.strategy);
            this.syncManager.setSyncPolicy(this.config.sync);
            this.isInitialized = true;
            console.log('混合存储管理器初始化完成');
            if (this.config.performance.enableOptimizations) {
                this.startBackgroundTasks();
            }
        }
        catch (error) {
            console.error('混合存储管理器初始化失败:', error);
            throw error;
        }
    }
    async getSession(sessionId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            let session = await this.cacheManager.get(`session:${sessionId}`);
            if (session) {
                session.lastAccessedAt = Date.now();
                await this.cacheManager.set(`session:${sessionId}`, session, {
                    temperature: hybrid_storage_1.DataTemperature.HOT,
                });
                return session;
            }
            session = await this.indexedDBProvider.get(`session:${sessionId}`);
            if (session) {
                await this.cacheManager.set(`session:${sessionId}`, session, {
                    temperature: hybrid_storage_1.DataTemperature.WARM,
                });
                return session;
            }
            if (this.fastgptProvider.isAvailable) {
                const remoteSession = await this.fastgptProvider.get(sessionId);
                if (remoteSession) {
                    const localSession = this.convertRemoteSessionToLocal(remoteSession);
                    await this.saveSession(localSession);
                    return localSession;
                }
            }
            return null;
        }
        catch (error) {
            console.error(`获取会话失败 ${sessionId}:`, error);
            return null;
        }
    }
    async saveSession(session) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const key = `session:${session.id}`;
            const now = Date.now();
            session.updatedAt = now;
            session.lastAccessedAt = now;
            const temperature = this.determineSessionTemperature(session);
            await this.cacheManager.set(key, session, {
                temperature,
                compress: session.messages.length > 50,
            });
            if (temperature === hybrid_storage_1.DataTemperature.HOT) {
                await this.memoryProvider.set(key, session);
            }
            await this.syncManager.setSyncStatus(session.id, hybrid_storage_1.SyncStatus.PENDING);
        }
        catch (error) {
            console.error(`保存会话失败 ${session.id}:`, error);
            throw error;
        }
    }
    async deleteSession(sessionId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const key = `session:${sessionId}`;
            await Promise.all([
                this.cacheManager.delete(key),
                this.memoryProvider.delete(key),
                this.indexedDBProvider.delete(key),
            ]);
        }
        catch (error) {
            console.error(`删除会话失败 ${sessionId}:`, error);
            throw error;
        }
    }
    async getAgentSessions(agentId, limit = 50) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const sessions = [];
            const localSessions = await this.indexedDBProvider.list(`session:${agentId}:`, limit);
            sessions.push(...localSessions.map(s => s.value));
            if (sessions.length < limit && this.fastgptProvider.isAvailable) {
                try {
                    const remoteSessions = await this.fastgptProvider.getChatSummariesByAgent(agentId);
                    for (const remoteSummary of remoteSessions.slice(0, limit - sessions.length)) {
                        if (!sessions.find(s => s.metadata?.fastgptChatId === remoteSummary.chatId)) {
                            const remoteSession = await this.fastgptProvider.get(remoteSummary.chatId);
                            if (remoteSession) {
                                const localSession = this.convertRemoteSessionToLocal(remoteSession);
                                sessions.push(localSession);
                                await this.cacheManager.set(`session:${localSession.id}`, localSession, {
                                    temperature: hybrid_storage_1.DataTemperature.WARM,
                                });
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn('从FastGPT获取会话失败:', error);
                }
            }
            sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            return sessions.slice(0, limit);
        }
        catch (error) {
            console.error(`获取智能体会话失败 ${agentId}:`, error);
            return [];
        }
    }
    async searchSessions(query) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const results = [];
            const localResults = await this.indexedDBProvider.search(query);
            for (const { value: session, score } of localResults) {
                results.push({ session, score });
            }
            if (results.length < (query.limit || 20) && this.fastgptProvider.isAvailable) {
                try {
                    const remoteResults = await this.fastgptProvider.search(query);
                    for (const { value: remoteSession, score: remoteScore } of remoteResults) {
                        const localSession = this.convertRemoteSessionToLocal(remoteSession);
                        const existingIndex = results.findIndex(r => r.session.id === localSession.id);
                        if (existingIndex === -1) {
                            results.push({ session: localSession, score: remoteScore });
                        }
                        else {
                            const existingResult = results[existingIndex];
                            if (existingResult) {
                                existingResult.score = Math.max(existingResult.score, remoteScore);
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn('搜索FastGPT失败:', error);
                }
            }
            results.sort((a, b) => b.score - a.score);
            if (query.limit) {
                results.splice(query.limit);
            }
            return results;
        }
        catch (error) {
            console.error('搜索会话失败:', error);
            return [];
        }
    }
    async addMessageToSession(sessionId, message) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`会话不存在: ${sessionId}`);
            }
            session.messages.push(message);
            session.messageCount = session.messages.length;
            session.updatedAt = Date.now();
            await this.saveSession(session);
            this.cacheManager.preload([`session:${sessionId}`]);
        }
        catch (error) {
            console.error(`添加消息失败 ${sessionId}:`, error);
            throw error;
        }
    }
    async updateMessageInSession(sessionId, messageId, updater) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`会话不存在: ${sessionId}`);
            }
            const messageIndex = session.messages.findIndex(msg => msg.id === messageId);
            if (messageIndex === -1) {
                throw new Error(`消息不存在: ${messageId}`);
            }
            const message = session.messages[messageIndex];
            if (!message) {
                throw new Error(`消息不存在: ${messageId}`);
            }
            const updatedMessage = updater(message);
            if (!updatedMessage) {
                throw new Error(`消息更新失败: ${messageId} - updater返回了无效的消息`);
            }
            session.messages[messageIndex] = updatedMessage;
            session.updatedAt = Date.now();
            await this.saveSession(session);
        }
        catch (error) {
            console.error(`更新消息失败 ${sessionId}:`, error);
            throw error;
        }
    }
    async syncSession(sessionId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const result = await this.syncManager.syncSession(sessionId);
            return result.success;
        }
        catch (error) {
            console.error(`同步会话失败 ${sessionId}:`, error);
            return false;
        }
    }
    async syncAgentSessions(agentId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const result = await this.syncManager.syncAgentSessions(agentId);
            return result.failureCount === 0;
        }
        catch (error) {
            console.error(`同步智能体会话失败 ${agentId}:`, error);
            return false;
        }
    }
    async forceSyncAll() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const result = await this.syncManager.syncAllSessions();
            return result.failureCount === 0;
        }
        catch (error) {
            console.error('强制同步失败:', error);
            return false;
        }
    }
    async preloadAgentSessions(agentId, limit = 10) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.cacheManager.preloadAgentSessions(agentId, limit);
    }
    async cleanupCache() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.cacheManager.cleanup();
    }
    async optimizeCache() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.cacheManager.optimize();
    }
    async getCacheStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.cacheManager.getUsageStats();
    }
    async enableOfflineMode() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.syncManager.enableOfflineMode();
    }
    async disableOfflineMode() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        await this.syncManager.disableOfflineMode();
    }
    async isOfflineMode() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.syncManager.isOfflineMode();
    }
    async getStorageStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const [memoryStats, indexedDBStats, fastgptStats] = await Promise.all([
            this.memoryProvider.getStats(),
            this.indexedDBProvider.getStats(),
            this.fastgptProvider.getStats(),
        ]);
        return {
            memory: memoryStats,
            indexedDB: indexedDBStats,
            fastgpt: fastgptStats,
            cache: await this.cacheManager.getUsageStats(),
        };
    }
    async getSyncStats() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.syncManager.getSyncStats();
    }
    onSyncProgress(callback) {
        return this.syncManager.onSyncProgress(callback);
    }
    onSyncConflict(callback) {
        return this.syncManager.onSyncConflict(callback);
    }
    onSyncError(callback) {
        return this.syncManager.onSyncError(callback);
    }
    setupEventListeners() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('网络已连接，尝试同步数据...');
                this.syncManager.disableOfflineMode();
            });
            window.addEventListener('offline', () => {
                console.log('网络已断开，启用离线模式...');
                this.syncManager.enableOfflineMode();
            });
        }
    }
    startBackgroundTasks() {
        setInterval(async () => {
            await this.cleanupCache();
        }, this.config.storage.cleanupInterval);
        setInterval(async () => {
            await this.optimizeCache();
        }, 2 * this.config.storage.cleanupInterval);
    }
    determineSessionTemperature(session) {
        const now = Date.now();
        const timeSinceLastAccess = now - (session.lastAccessedAt ?? now);
        const timeSinceUpdate = now - new Date(session.updatedAt).getTime();
        if (timeSinceLastAccess < 60 * 60 * 1000) {
            return hybrid_storage_1.DataTemperature.HOT;
        }
        if (timeSinceUpdate < 24 * 60 * 60 * 1000) {
            return hybrid_storage_1.DataTemperature.WARM;
        }
        return hybrid_storage_1.DataTemperature.COLD;
    }
    convertRemoteSessionToLocal(remoteSession) {
        return {
            id: remoteSession.chatId,
            title: remoteSession.title || '未命名会话',
            agentId: remoteSession.appId || 'default',
            messages: this.convertRemoteMessages(remoteSession.messages || []),
            createdAt: new Date(remoteSession.createdAt || Date.now()).getTime(),
            updatedAt: new Date(remoteSession.updatedAt || Date.now()).getTime(),
            lastAccessedAt: Date.now(),
            messageCount: remoteSession.messages?.length || 0,
            isPinned: false,
            tags: remoteSession.tags || [],
            isArchived: false,
            metadata: {
                fastgptChatId: remoteSession.chatId,
                remoteMetadata: remoteSession.metadata,
                syncedAt: Date.now(),
            },
        };
    }
    convertRemoteMessages(remoteMessages) {
        return remoteMessages.map(msg => ({
            [msg.role === 'user' ? 'HUMAN' : 'AI']: msg.content,
            id: msg.id || msg.dataId,
            feedback: msg.feedback,
            timestamp: msg.timestamp || Date.now(),
            raw: msg.raw,
        }));
    }
    async healthCheck() {
        try {
            const [memoryOk, indexedDBOk, fastgptOk] = await Promise.all([
                this.checkProviderHealth(this.memoryProvider),
                this.checkProviderHealth(this.indexedDBProvider),
                this.checkProviderHealth(this.fastgptProvider),
            ]);
            return {
                memory: memoryOk,
                indexedDB: indexedDBOk,
                fastgpt: fastgptOk,
                overall: memoryOk && indexedDBOk && fastgptOk,
            };
        }
        catch (error) {
            console.error('健康检查失败:', error);
            return {
                memory: false,
                indexedDB: false,
                fastgpt: false,
                overall: false,
            };
        }
    }
    async checkProviderHealth(provider) {
        try {
            const testKey = `health_test_${Date.now()}`;
            const testValue = { test: true, timestamp: Date.now() };
            await provider.set(testKey, testValue);
            const retrieved = await provider.get(testKey);
            await provider.delete(testKey);
            return retrieved !== null && retrieved.test === true;
        }
        catch (error) {
            return false;
        }
    }
    async destroy() {
        try {
            await Promise.all([
                this.memoryProvider.destroy(),
                this.indexedDBProvider.destroy(),
                this.fastgptProvider.destroy(),
            ]);
            this.cacheManager.destroy();
            this.isInitialized = false;
        }
        catch (error) {
            console.error('销毁存储管理器失败:', error);
        }
    }
    updateConfig(newConfig) {
        this.config = this.mergeConfig(this.config, newConfig);
        if (newConfig.sync) {
            this.syncManager.setSyncPolicy({
                ...this.config.sync,
                ...newConfig.sync,
            });
        }
        if (newConfig.cache?.memory?.strategy) {
            this.cacheManager.setStrategy(newConfig.cache.memory.strategy);
        }
    }
    mergeConfig(base, update) {
        return {
            cache: { ...base.cache, ...update.cache },
            sync: { ...base.sync, ...update.sync },
            performance: { ...base.performance, ...update.performance },
            storage: { ...base.storage, ...update.storage },
        };
    }
}
exports.HybridStorageManager = HybridStorageManager;
//# sourceMappingURL=HybridStorageManager.js.map