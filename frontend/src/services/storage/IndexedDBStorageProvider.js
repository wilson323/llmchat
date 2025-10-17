"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexedDBStorageProvider = void 0;
;
;
;
const hybrid_storage_1 = require("@/types/hybrid-storage");
class IndexedDBStorageProvider {
    constructor(maxStorage = 100 * 1024 * 1024, maxEntries = 10000) {
        this.name = 'IndexedDBStorage';
        this.tier = hybrid_storage_1.StorageTier.INDEXED_DB;
        this.db = null;
        this.dbName = 'HybridStorageDB';
        this.dbVersion = 1;
        this.storeName = 'cache';
        this.isInitialized = false;
        this.initPromise = null;
        this.schema = {
            name: this.dbName,
            version: this.dbVersion,
            stores: {
                [this.storeName]: {
                    keyPath: 'key',
                    indexes: [
                        { name: 'timestamp', keyPath: 'timestamp' },
                        { name: 'lastAccessed', keyPath: 'lastAccessed' },
                        { name: 'expiresAt', keyPath: 'expiresAt' },
                        { name: 'storageTier', keyPath: 'storageTier' },
                        { name: 'agentId', keyPath: 'data.agentId' },
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'temperature', keyPath: 'temperature' },
                    ],
                },
            },
        };
        this.maxStorage = maxStorage;
        this.maxEntries = maxEntries;
    }
    get isAvailable() {
        return typeof window !== 'undefined' &&
            'indexedDB' in window &&
            this.isInitialized;
    }
    async init() {
        if (this.isInitialized) {
            return;
        }
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = this._init();
        return this.initPromise;
    }
    async _init() {
        try {
            this.db = await this.openDatabase();
            this.isInitialized = true;
            console.log('IndexedDBStorage initialized successfully');
            const estimate = await this.getStorageEstimate();
            if (estimate.quota && estimate.quota < this.maxStorage) {
                console.warn(`IndexedDB配额不足，调整最大存储从 ${this.maxStorage} 到 ${estimate.quota}`);
                this.maxStorage = estimate.quota;
            }
        }
        catch (error) {
            console.error('Failed to initialize IndexedDBStorage:', error);
            throw error;
        }
    }
    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => {
                reject(new Error(`Failed to open database: ${request.error}`));
            };
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createObjectStores(db);
            };
        });
    }
    createObjectStores(db) {
        if (db.objectStoreNames.contains(this.storeName)) {
            db.deleteObjectStore(this.storeName);
        }
        const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
        const storeConfig = this.schema.stores[this.storeName];
        const indexes = storeConfig?.indexes || [];
        indexes.forEach(index => {
            if (index.unique !== undefined) {
                store.createIndex(index.name, index.keyPath, { unique: index.unique });
            }
            else {
                store.createIndex(index.name, index.keyPath);
            }
        });
    }
    async destroy() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    async getTransaction(mode = 'readonly') {
        if (!this.db) {
            await this.init();
        }
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db.transaction([this.storeName], mode);
    }
    async get(key) {
        try {
            const tx = await this.getTransaction();
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => {
                    const entry = request.result;
                    if (!entry) {
                        resolve(null);
                        return;
                    }
                    if (entry.expiresAt && Date.now() > entry.expiresAt) {
                        this.delete(key);
                        resolve(null);
                        return;
                    }
                    this.updateAccessStats(key);
                    resolve(entry.data);
                };
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to get from IndexedDB:', error);
            return null;
        }
    }
    async set(key, value, options = {}) {
        try {
            const serializedSize = this.calculateSize(value);
            if (serializedSize > this.maxStorage) {
                console.warn(`数据大小 ${serializedSize} 超过最大存储限制 ${this.maxStorage}`);
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
            const tx = await this.getTransaction('readwrite');
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.put(entry);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to set to IndexedDB:', error);
            throw error;
        }
    }
    async delete(key) {
        try {
            const tx = await this.getTransaction('readwrite');
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.delete(key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    if (request.error?.name === 'NotFoundError') {
                        resolve(false);
                    }
                    else {
                        reject(request.error);
                    }
                };
            });
        }
        catch (error) {
            console.error('Failed to delete from IndexedDB:', error);
            return false;
        }
    }
    async exists(key) {
        try {
            const tx = await this.getTransaction();
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.count(key);
                request.onsuccess = () => resolve(request.result > 0);
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to check existence in IndexedDB:', error);
            return false;
        }
    }
    async clear() {
        try {
            const tx = await this.getTransaction('readwrite');
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to clear IndexedDB:', error);
            throw error;
        }
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
        const tx = await this.getTransaction('readwrite');
        const store = tx.objectStore(this.storeName);
        for (const entry of entries) {
            const serializedSize = this.calculateSize(entry.value);
            const now = Date.now();
            const cacheEntry = {
                key: entry.key,
                data: entry.value,
                timestamp: now,
                lastAccessed: now,
                accessCount: 1,
                temperature: hybrid_storage_1.DataTemperature.WARM,
                ...(entry.options?.expiresAt && { expiresAt: entry.options.expiresAt }),
                size: serializedSize,
                storageTier: this.tier,
                syncStatus: hybrid_storage_1.SyncStatus.SYNCED,
            };
            store.put(cacheEntry);
        }
    }
    async mdelete(keys) {
        const tx = await this.getTransaction('readwrite');
        const store = tx.objectStore(this.storeName);
        for (const key of keys) {
            store.delete(key);
        }
        return true;
    }
    async list(prefix = '', limit) {
        try {
            const tx = await this.getTransaction();
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.openCursor();
                const results = [];
                let count = 0;
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const entry = cursor.value;
                        if (!prefix || entry.key.startsWith(prefix)) {
                            results.push({ key: entry.key, value: entry.data });
                            count++;
                        }
                        if (limit && count >= limit) {
                            resolve(results);
                            return;
                        }
                        cursor.continue();
                    }
                    else {
                        resolve(results);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to list from IndexedDB:', error);
            return [];
        }
    }
    async search(query) {
        try {
            const tx = await this.getTransaction();
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.openCursor();
                const matches = [];
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const entry = cursor.value;
                        let score = 0;
                        const value = entry.data;
                        score = this.calculateSearchScore(entry, value, query);
                        if (score > 0) {
                            matches.push({ key: entry.key, value: entry.data, score });
                        }
                        cursor.continue();
                    }
                    else {
                        matches.sort((a, b) => b.score - a.score);
                        if (query.limit) {
                            matches.splice(query.limit);
                        }
                        resolve(matches);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to search IndexedDB:', error);
            return [];
        }
    }
    async getStats() {
        try {
            const tx = await this.getTransaction();
            const store = tx.objectStore(this.storeName);
            return await new Promise((resolve, reject) => {
                const request = store.openCursor();
                let totalSize = 0;
                let totalEntries = 0;
                let oldestEntry = Date.now();
                let newestEntry = 0;
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const entry = cursor.value;
                        totalSize += entry.size;
                        totalEntries++;
                        oldestEntry = Math.min(oldestEntry, entry.timestamp);
                        newestEntry = Math.max(newestEntry, entry.timestamp);
                        cursor.continue();
                    }
                    else {
                        resolve({
                            totalEntries,
                            totalSize,
                            hitCount: 0,
                            missCount: 0,
                            hitRate: 0,
                            averageAccessTime: 0,
                            oldestEntry,
                            newestEntry,
                        });
                    }
                };
                request.onerror = () => reject(request.error);
            });
        }
        catch (error) {
            console.error('Failed to get IndexedDB stats:', error);
            return {
                totalEntries: 0,
                totalSize: 0,
                hitCount: 0,
                missCount: 0,
                hitRate: 0,
                averageAccessTime: 0,
                oldestEntry: 0,
                newestEntry: 0,
            };
        }
    }
    calculateSize(value) {
        try {
            return JSON.stringify(value).length * 2;
        }
        catch {
            return 1024;
        }
    }
    async updateAccessStats(key) {
        try {
            const tx = await this.getTransaction('readwrite');
            const store = tx.objectStore(this.storeName);
            const getRequest = store.get(key);
            getRequest.onsuccess = () => {
                const entry = getRequest.result;
                if (entry) {
                    entry.lastAccessed = Date.now();
                    entry.accessCount++;
                    store.put(entry);
                }
            };
        }
        catch (error) {
            console.warn('Failed to update access stats:', error);
        }
    }
    async ensureCapacity(requiredSize) {
        const stats = await this.getStats();
        const availableSpace = this.maxStorage - stats.totalSize;
        if (availableSpace < requiredSize || stats.totalEntries >= this.maxEntries) {
            await this.evictEntries(requiredSize);
        }
    }
    async evictEntries(_requiredSize) {
        const tx = await this.getTransaction('readwrite');
        const store = tx.objectStore(this.storeName);
        const index = store.index('lastAccessed');
        const request = index.openCursor();
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    }
    calculateSearchScore(entry, value, query) {
        let score = 0;
        if (query.text) {
            if (entry.key.includes(query.text) ||
                (value.title?.includes(query.text))) {
                score += 10;
            }
        }
        if (query.agentId && value.agentId === query.agentId) {
            score += 20;
        }
        if (query.dateRange) {
            const timestamp = entry.timestamp;
            if (timestamp >= query.dateRange.start && timestamp <= query.dateRange.end) {
                score += 15;
            }
        }
        if (query.tags && query.tags.length > 0 && value.tags) {
            const matchingTags = query.tags.filter(tag => value.tags.includes(tag));
            score += matchingTags.length * 5;
        }
        return score;
    }
    async getStorageEstimate() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                quota: estimate.quota || this.maxStorage,
                usage: estimate.usage || 0,
            };
        }
        return { quota: this.maxStorage, usage: 0 };
    }
    async cleanup() {
        try {
            const tx = await this.getTransaction('readwrite');
            const store = tx.objectStore(this.storeName);
            const index = store.index('expiresAt');
            const now = Date.now();
            const range = IDBKeyRange.upperBound(now);
            const request = index.openCursor(range);
            let deletedCount = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                }
                else {
                    console.log(`IndexedDB cleanup: deleted ${deletedCount} expired entries`);
                }
            };
        }
        catch (error) {
            console.error('Failed to cleanup IndexedDB:', error);
        }
    }
}
exports.IndexedDBStorageProvider = IndexedDBStorageProvider;
//# sourceMappingURL=IndexedDBStorageProvider.js.map