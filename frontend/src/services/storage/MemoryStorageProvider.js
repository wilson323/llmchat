"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageProvider = void 0;
;
;
const hybrid_storage_1 = require("@/types/hybrid-storage");
class MemoryStorageProvider {
    constructor(maxSize = 50 * 1024 * 1024, maxEntries = 1000) {
        this.name = 'MemoryStorage';
        this.tier = hybrid_storage_1.StorageTier.MEMORY;
        this.cache = new Map();
        this.accessOrder = new Map();
        this.accessCounter = 0;
        this.hitCount = 0;
        this.missCount = 0;
        this.isInitialized = false;
        this.maxSize = maxSize;
        this.maxEntries = maxEntries;
    }
    get isAvailable() {
        return typeof window !== 'undefined' && this.isInitialized;
    }
    async init() {
        if (this.isInitialized) {
            return;
        }
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            const perfMemory = performance.memory;
            if (perfMemory && perfMemory.jsHeapSizeLimit && perfMemory.usedJSHeapSize) {
                const availableMemory = perfMemory.jsHeapSizeLimit - perfMemory.usedJSHeapSize;
                if (availableMemory > 0 && availableMemory < this.maxSize) {
                    console.warn(`内存可用空间不足，调整缓存大小从 ${this.maxSize} 到 ${availableMemory}`);
                    this.maxSize = Math.floor(availableMemory * 0.8);
                }
            }
        }
        this.isInitialized = true;
        console.log(`MemoryStorage initialized: maxSize=${this.maxSize}, maxEntries=${this.maxEntries}`);
    }
    async destroy() {
        this.cache.clear();
        this.accessOrder.clear();
        this.accessCounter = 0;
        this.hitCount = 0;
        this.missCount = 0;
        this.isInitialized = false;
    }
    async get(key) {
        if (!this.isInitialized) {
            return null;
        }
        const entry = this.cache.get(key);
        if (!entry) {
            this.missCount++;
            return null;
        }
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
            this.missCount++;
            return null;
        }
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        this.accessOrder.set(key, ++this.accessCounter);
        this.hitCount++;
        return entry.data;
    }
    async set(key, value, options = {}) {
        if (!this.isInitialized) {
            return;
        }
        const serializedSize = this.calculateSize(value);
        if (serializedSize > this.maxSize) {
            console.warn(`数据大小 ${serializedSize} 超过最大缓存限制 ${this.maxSize}`);
            return;
        }
        await this.ensureCapacity(serializedSize);
        const now = Date.now();
        const entry = {
            key,
            data: value,
            timestamp: now,
            lastAccessed: now,
            accessCount: 1,
            temperature: hybrid_storage_1.DataTemperature.WARM,
            ...(options.expiresAt && { expiresAt: options.expiresAt }),
            size: serializedSize,
            storageTier: this.tier,
            syncStatus: hybrid_storage_1.SyncStatus.SYNCED,
        };
        this.cache.set(key, entry);
        this.accessOrder.set(key, ++this.accessCounter);
    }
    async delete(key) {
        if (!this.isInitialized) {
            return false;
        }
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.accessOrder.delete(key);
        }
        return deleted;
    }
    async exists(key) {
        if (!this.isInitialized) {
            return false;
        }
        return this.cache.has(key);
    }
    async clear() {
        this.cache.clear();
        this.accessOrder.clear();
        this.accessCounter = 0;
    }
    async mget(keys) {
        const result = new Map();
        for (const key of keys) {
            const value = await this.get(key);
            result.set(key, value);
        }
        return result;
    }
    async mset(entries) {
        for (const entry of entries) {
            await this.set(entry.key, entry.value, entry.options);
        }
    }
    async mdelete(keys) {
        let allDeleted = true;
        for (const key of keys) {
            const deleted = await this.delete(key);
            if (!deleted) {
                allDeleted = false;
            }
        }
        return allDeleted;
    }
    async list(prefix = '', limit) {
        const result = [];
        for (const [key, entry] of this.cache.entries()) {
            if (prefix && !key.startsWith(prefix)) {
                continue;
            }
            result.push({ key, value: entry.data });
            if (limit && result.length >= limit) {
                break;
            }
        }
        return result;
    }
    async search(query) {
        const results = [];
        for (const [key, entry] of this.cache.entries()) {
            let score = 0;
            const value = entry.data;
            if (query.text) {
                const keyMatches = key.includes(query.text);
                const titleMatches = value && typeof value === 'object' && 'title' in value &&
                    typeof value.title === 'string' && value.title.includes(query.text);
                if (keyMatches || titleMatches) {
                    score += 10;
                }
            }
            if (query.agentId && value && typeof value === 'object' && 'agentId' in value &&
                value.agentId === query.agentId) {
                score += 20;
            }
            if (query.dateRange) {
                const timestamp = entry.timestamp;
                if (timestamp >= query.dateRange.start && timestamp <= query.dateRange.end) {
                    score += 15;
                }
            }
            if (query.tags && query.tags.length > 0 && value && typeof value === 'object' && 'tags' in value &&
                Array.isArray(value.tags)) {
                const matchingTags = query.tags.filter(tag => Array.isArray(value.tags) && value.tags.includes(tag));
                score += matchingTags.length * 5;
            }
            if (score > 0) {
                results.push({ key, value: entry.data, score });
            }
        }
        results.sort((a, b) => b.score - a.score);
        if (query.limit) {
            results.splice(query.limit);
        }
        return results;
    }
    async getStats() {
        const totalSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
        const timestamps = Array.from(this.cache.values()).map(entry => entry.timestamp);
        return {
            totalEntries: this.cache.size,
            totalSize,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: this.hitCount + this.missCount > 0 ? this.hitCount / (this.hitCount + this.missCount) : 0,
            averageAccessTime: 0,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
        };
    }
    calculateSize(value) {
        try {
            return JSON.stringify(value).length * 2;
        }
        catch {
            return 1024;
        }
    }
    async ensureCapacity(requiredSize) {
        const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
        const availableSize = this.maxSize - currentSize;
        if (availableSize < requiredSize || this.cache.size >= this.maxEntries) {
            await this.evictEntries(requiredSize);
        }
    }
    async evictEntries(_requiredSize) {
        const entries = Array.from(this.cache.entries());
        entries.sort(([, a], [, b]) => {
            const scoreA = a.lastAccessed * a.accessCount;
            const scoreB = b.lastAccessed * b.accessCount;
            return scoreA - scoreB;
        });
        let freedSize = 0;
        const targetSize = this.maxSize * 0.8;
        const currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
        for (const [key, entry] of entries) {
            if (currentSize - freedSize <= targetSize && this.cache.size <= this.maxEntries * 0.8) {
                break;
            }
            this.cache.delete(key);
            this.accessOrder.delete(key);
            freedSize += entry.size;
        }
        console.log(`MemoryStorage evicted ${entries.length} entries, freed ${freedSize} bytes`);
    }
    async cleanup() {
        const now = Date.now();
        const expiredEntries = [];
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                expiredEntries.push(key);
            }
        }
        for (const key of expiredEntries) {
            this.cache.delete(key);
            this.accessOrder.delete(key);
        }
        if (expiredEntries.length > 0) {
            console.log(`MemoryStorage cleaned up ${expiredEntries.length} expired entries`);
        }
    }
    getHotData(limit = 10) {
        const entries = Array.from(this.cache.entries());
        entries.sort(([, a], [, b]) => {
            const scoreA = a.accessCount * (a.lastAccessed / Date.now());
            const scoreB = b.accessCount * (b.lastAccessed / Date.now());
            return scoreB - scoreA;
        });
        return entries.slice(0, limit).map(([key, entry]) => ({ key, entry }));
    }
}
exports.MemoryStorageProvider = MemoryStorageProvider;
//# sourceMappingURL=MemoryStorageProvider.js.map