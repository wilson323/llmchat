"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const hybrid_storage_1 = require("@/types/hybrid-storage");
class CacheManager {
    constructor(memoryProvider, indexedDBProvider) {
        this.strategy = hybrid_storage_1.CacheStrategy.LRU;
        this.preloadQueue = [];
        this.isPreloading = false;
        this.cleanupInterval = null;
        this.preloadHistory = new Set();
        this.memoryProvider = memoryProvider;
        this.indexedDBProvider = indexedDBProvider;
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            promotions: 0,
            demotions: 0,
            preloads: 0,
            totalRequests: 0,
            averageResponseTime: 0,
        };
        this.initializeCleanup();
    }
    async get(key) {
        const startTime = performance.now();
        this.metrics.totalRequests++;
        try {
            let result = await this.memoryProvider.get(key);
            if (result !== null) {
                this.metrics.hits++;
                this.updateAverageResponseTime(performance.now() - startTime);
                return result;
            }
            result = await this.indexedDBProvider.get(key);
            if (result !== null) {
                this.metrics.hits++;
                await this.promoteToMemory(key, result);
                this.updateAverageResponseTime(performance.now() - startTime);
                return result;
            }
            this.metrics.misses++;
            this.updateAverageResponseTime(performance.now() - startTime);
            this.triggerRelatedPreload(key);
            return null;
        }
        catch (error) {
            console.error('缓存获取失败:', error);
            this.metrics.misses++;
            return null;
        }
    }
    async set(key, value, options = {}) {
        try {
            const temperature = options.temperature || this.determineTemperature(key, value);
            if (temperature === hybrid_storage_1.DataTemperature.HOT) {
                await Promise.all([
                    this.memoryProvider.set(key, value, options),
                    this.indexedDBProvider.set(key, value, options),
                ]);
            }
            else if (temperature === hybrid_storage_1.DataTemperature.WARM) {
                await this.indexedDBProvider.set(key, value, options);
                if (await this.hasMemorySpace()) {
                    await this.memoryProvider.set(key, value, options);
                }
            }
            else {
                await this.indexedDBProvider.set(key, value, options);
            }
            if (options.preloadRelated) {
                this.triggerRelatedPreload(key);
            }
        }
        catch (error) {
            console.error('缓存设置失败:', error);
        }
    }
    async delete(key) {
        try {
            const [memoryDeleted, indexedDBDeleted] = await Promise.all([
                this.memoryProvider.delete(key),
                this.indexedDBProvider.delete(key),
            ]);
            return memoryDeleted || indexedDBDeleted;
        }
        catch (error) {
            console.error('缓存删除失败:', error);
            return false;
        }
    }
    async clear() {
        try {
            await Promise.all([
                this.memoryProvider.clear(),
                this.indexedDBProvider.clear(),
            ]);
        }
        catch (error) {
            console.error('缓存清空失败:', error);
        }
    }
    async mget(keys) {
        const result = new Map();
        const promises = keys.map(async (key) => {
            const value = await this.get(key);
            return { key, value };
        });
        const results = await Promise.all(promises);
        results.forEach(({ key, value }) => {
            result.set(key, value);
        });
        return result;
    }
    async mset(entries) {
        const hotEntries = [];
        const warmEntries = [];
        const coldEntries = [];
        entries.forEach(entry => {
            const temperature = entry.options?.temperature || this.determineTemperature(entry.key, entry.value);
            switch (temperature) {
                case hybrid_storage_1.DataTemperature.HOT:
                    hotEntries.push(entry);
                    break;
                case hybrid_storage_1.DataTemperature.WARM:
                    warmEntries.push(entry);
                    break;
                case hybrid_storage_1.DataTemperature.COLD:
                    coldEntries.push(entry);
                    break;
            }
        });
        await Promise.all([
            this.setBatchInMemory(hotEntries.concat(warmEntries)),
            this.setBatchInIndexedDB(hotEntries.concat(warmEntries).concat(coldEntries)),
        ]);
    }
    setStrategy(strategy) {
        this.strategy = strategy;
        console.log(`缓存策略已更改为: ${strategy}`);
    }
    getStrategy() {
        return this.strategy;
    }
    async promoteToHot(key) {
        try {
            const value = await this.indexedDBProvider.get(key);
            if (value !== null) {
                await this.promoteToMemory(key, value);
                this.metrics.promotions++;
            }
        }
        catch (error) {
            console.error('提升到热数据失败:', error);
        }
    }
    async demoteToCold(key) {
        try {
            await this.memoryProvider.delete(key);
            this.metrics.demotions++;
        }
        catch (error) {
            console.error('降级到冷数据失败:', error);
        }
    }
    async getTemperature(key) {
        try {
            if (await this.memoryProvider.exists(key)) {
                return hybrid_storage_1.DataTemperature.HOT;
            }
            if (await this.indexedDBProvider.exists(key)) {
                return hybrid_storage_1.DataTemperature.WARM;
            }
            return hybrid_storage_1.DataTemperature.COLD;
        }
        catch (error) {
            console.error('获取数据温度失败:', error);
            return hybrid_storage_1.DataTemperature.COLD;
        }
    }
    async preload(keys) {
        if (this.isPreloading) {
            keys.forEach(key => this.addToPreloadQueue(key, 1));
            return;
        }
        this.isPreloading = true;
        try {
            const sortedKeys = this.sortKeysByPriority(keys);
            for (const key of sortedKeys) {
                try {
                    if (await this.get(key) !== null) {
                        continue;
                    }
                    await this.executePreload(key);
                    this.metrics.preloads++;
                }
                catch (error) {
                    console.error(`预加载失败 ${key}:`, error);
                }
            }
        }
        finally {
            this.isPreloading = false;
            await this.processPreloadQueue();
        }
    }
    async preloadAgentSessions(agentId, limit = 10) {
        try {
            const sessionKeys = await this.getAgentSessionKeys(agentId, limit);
            await this.preload(sessionKeys);
        }
        catch (error) {
            console.error(`预加载智能体会话失败 ${agentId}:`, error);
        }
    }
    async cleanup() {
        try {
            if ('cleanup' in this.memoryProvider) {
                await this.memoryProvider.cleanup();
            }
            if ('cleanup' in this.indexedDBProvider) {
                await this.indexedDBProvider.cleanup();
            }
            if (this.preloadHistory.size > 1000) {
                this.preloadHistory.clear();
            }
        }
        catch (error) {
            console.error('缓存清理失败:', error);
        }
    }
    async optimize() {
        try {
            const usageStats = await this.getUsageStats();
            if (usageStats.performance.hitRate < 0.7) {
                console.log('命中率较低，调整缓存策略');
            }
            await this.cleanupLowFrequencyData();
            await this.rebalanceStorage();
        }
        catch (error) {
            console.error('缓存优化失败:', error);
        }
    }
    async getUsageStats() {
        try {
            const memoryStats = await this.memoryProvider.getStats();
            const memoryUsage = {
                total: 50 * 1024 * 1024,
                used: memoryStats.totalSize,
                free: 50 * 1024 * 1024 - memoryStats.totalSize,
                percentage: (memoryStats.totalSize / (50 * 1024 * 1024)) * 100,
            };
            const indexedDBUsage = await this.getIndexedDBUsage();
            const cacheEntries = await this.estimateCacheDistribution();
            const hitRate = this.metrics.totalRequests > 0
                ? this.metrics.hits / this.metrics.totalRequests
                : 0;
            const performance = {
                hitRate,
                averageResponseTime: this.metrics.averageResponseTime,
                evictionRate: this.metrics.totalRequests > 0
                    ? this.metrics.evictions / this.metrics.totalRequests
                    : 0,
            };
            return {
                memoryUsage,
                indexedDBUsage,
                cacheEntries,
                performance,
            };
        }
        catch (error) {
            console.error('获取缓存使用统计失败:', error);
            return this.getDefaultUsageStats();
        }
    }
    initializeCleanup() {
        this.cleanupInterval = setInterval(async () => {
            await this.cleanup();
        }, 5 * 60 * 1000);
    }
    determineTemperature(key, value) {
        if (key.includes('session:') && value && typeof value === 'object' && 'lastAccessedAt' in value) {
            const lastAccessed = value.lastAccessedAt;
            const now = Date.now();
            const timeDiff = now - lastAccessed;
            if (timeDiff < 24 * 60 * 60 * 1000) {
                return hybrid_storage_1.DataTemperature.HOT;
            }
            else if (timeDiff < 7 * 24 * 60 * 60 * 1000) {
                return hybrid_storage_1.DataTemperature.WARM;
            }
        }
        if (key.includes('current') || key.includes('active')) {
            return hybrid_storage_1.DataTemperature.HOT;
        }
        const dataSize = JSON.stringify(value).length;
        if (dataSize < 10 * 1024) {
            return hybrid_storage_1.DataTemperature.HOT;
        }
        else if (dataSize < 100 * 1024) {
            return hybrid_storage_1.DataTemperature.WARM;
        }
        return hybrid_storage_1.DataTemperature.COLD;
    }
    async promoteToMemory(key, value) {
        try {
            if (!(await this.hasMemorySpace())) {
                await this.evictColdMemoryData();
            }
            await this.memoryProvider.set(key, value);
        }
        catch (error) {
            console.error('提升到内存缓存失败:', error);
        }
    }
    async hasMemorySpace() {
        try {
            const stats = await this.memoryProvider.getStats();
            const maxSize = 50 * 1024 * 1024;
            return stats.totalSize < maxSize * 0.8;
        }
        catch (error) {
            return true;
        }
    }
    async evictColdMemoryData() {
        try {
            if ('cleanup' in this.memoryProvider) {
                await this.memoryProvider.cleanup();
            }
            else {
                const entries = await this.memoryProvider.list();
                const halfLength = Math.floor(entries.length / 2);
                const toDelete = entries.slice(halfLength).map(e => e.key);
                for (const key of toDelete) {
                    await this.memoryProvider.delete(key);
                }
            }
        }
        catch (error) {
            console.error('清理内存缓存失败:', error);
        }
    }
    triggerRelatedPreload(key) {
        if (key.includes('session:')) {
            const agentId = this.extractAgentIdFromKey(key);
            if (agentId) {
                this.preloadAgentSessions(agentId, 3);
            }
        }
    }
    extractAgentIdFromKey(key) {
        const match = key.match(/session:([^:]+)/);
        return match && match[1] ? match[1] : null;
    }
    async getAgentSessionKeys(agentId, limit) {
        try {
            const sessions = await this.indexedDBProvider.list(`session:${agentId}:`);
            return sessions.slice(0, limit).map(entry => entry.key);
        }
        catch (error) {
            console.error('获取智能体会话键失败:', error);
            return [];
        }
    }
    addToPreloadQueue(key, priority) {
        if (this.preloadQueue.some(task => task.key === key)) {
            return;
        }
        this.preloadQueue.push({
            key,
            priority,
            dependencies: [],
        });
        this.preloadQueue.sort((a, b) => b.priority - a.priority);
    }
    async processPreloadQueue() {
        if (this.preloadQueue.length === 0) {
            return;
        }
        const tasks = this.preloadQueue.splice(0, 5);
        const keys = tasks.map(task => task.key);
        await this.preload(keys);
    }
    sortKeysByPriority(keys) {
        return keys.sort((a, b) => {
            if (a.includes('current')) {
                return -1;
            }
            if (b.includes('current')) {
                return 1;
            }
            const aTime = this.extractTimestampFromKey(a);
            const bTime = this.extractTimestampFromKey(b);
            return bTime - aTime;
        });
    }
    extractTimestampFromKey(key) {
        const match = key.match(/(\d+)/);
        return match && match[1] ? parseInt(match[1], 10) : 0;
    }
    async executePreload(key) {
        if (this.preloadHistory.has(key)) {
            return;
        }
        this.preloadHistory.add(key);
        console.log(`预加载数据: ${key}`);
    }
    async setBatchInMemory(entries) {
        const promises = entries.map(entry => this.memoryProvider.set(entry.key, entry.value, entry.options));
        await Promise.all(promises);
    }
    async setBatchInIndexedDB(entries) {
        const promises = entries.map(entry => this.indexedDBProvider.set(entry.key, entry.value, entry.options));
        await Promise.all(promises);
    }
    async getIndexedDBUsage() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const total = estimate.quota || 100 * 1024 * 1024;
                const used = estimate.usage || 0;
                return {
                    total,
                    used,
                    free: total - used,
                    percentage: (used / total) * 100,
                };
            }
        }
        catch (error) {
            console.warn('无法获取IndexedDB使用情况:', error);
        }
        return {
            total: 100 * 1024 * 1024,
            used: 0,
            free: 100 * 1024 * 1024,
            percentage: 0,
        };
    }
    async estimateCacheDistribution() {
        try {
            const memoryEntries = await this.memoryProvider.getStats();
            const indexedDBEntries = await this.indexedDBProvider.getStats();
            return {
                hot: memoryEntries.totalEntries,
                warm: indexedDBEntries.totalEntries,
                cold: 0,
                total: memoryEntries.totalEntries + indexedDBEntries.totalEntries,
            };
        }
        catch (error) {
            return { hot: 0, warm: 0, cold: 0, total: 0 };
        }
    }
    async cleanupLowFrequencyData() {
        try {
            const indexedDBStats = await this.indexedDBProvider.getStats();
            if (indexedDBStats.totalEntries > 1000) {
                const entries = await this.indexedDBProvider.list();
                const oldEntries = entries.slice(-100);
                for (const entry of oldEntries) {
                    await this.indexedDBProvider.delete(entry.key);
                }
            }
        }
        catch (error) {
            console.error('清理低频数据失败:', error);
        }
    }
    async rebalanceStorage() {
        try {
            const memoryStats = await this.memoryProvider.getStats();
            if (memoryStats.totalSize > 40 * 1024 * 1024) {
                const hotData = await this.getHotDataFromMemory();
                const toDemote = hotData.slice(-20);
                for (const { key } of toDemote) {
                    await this.demoteToCold(key);
                }
            }
        }
        catch (error) {
            console.error('重新平衡存储失败:', error);
        }
    }
    async getHotDataFromMemory() {
        try {
            if ('getHotData' in this.memoryProvider) {
                return await this.memoryProvider.getHotData();
            }
            const entries = await this.memoryProvider.list();
            return entries.map(entry => ({ key: entry.key, entry: entry.value }));
        }
        catch (error) {
            console.error('获取内存热数据失败:', error);
            return [];
        }
    }
    updateAverageResponseTime(responseTime) {
        const alpha = 0.1;
        this.metrics.averageResponseTime =
            this.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha;
    }
    getDefaultUsageStats() {
        return {
            memoryUsage: {
                total: 50 * 1024 * 1024,
                used: 0,
                free: 50 * 1024 * 1024,
                percentage: 0,
            },
            indexedDBUsage: {
                total: 100 * 1024 * 1024,
                used: 0,
                free: 100 * 1024 * 1024,
                percentage: 0,
            },
            cacheEntries: {
                hot: 0,
                warm: 0,
                cold: 0,
                total: 0,
            },
            performance: {
                hitRate: 0,
                averageResponseTime: 0,
                evictionRate: 0,
            },
        };
    }
    getMetrics() {
        return { ...this.metrics };
    }
    resetMetrics() {
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            promotions: 0,
            demotions: 0,
            preloads: 0,
            totalRequests: 0,
            averageResponseTime: 0,
        };
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.preloadQueue.length = 0;
        this.preloadHistory.clear();
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=CacheManager.js.map