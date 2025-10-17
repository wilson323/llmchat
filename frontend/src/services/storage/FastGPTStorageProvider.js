"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FastGPTStorageProvider = void 0;
;
const hybrid_storage_1 = require("@/types/hybrid-storage");
class FastGPTStorageProvider {
    constructor(config) {
        this.name = 'FastGPTStorage';
        this.tier = hybrid_storage_1.StorageTier.FASTGPT_REMOTE;
        this.isInitialized = false;
        this.requestCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000;
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config,
        };
    }
    get isAvailable() {
        return typeof window !== 'undefined' &&
            !!this.config.apiKey &&
            !!this.config.baseUrl &&
            this.isInitialized;
    }
    async init() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.validateConnection();
            this.isInitialized = true;
            console.log('FastGPTStorage initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize FastGPTStorage:', error);
            throw error;
        }
    }
    async validateConnection() {
        try {
            const response = await this.makeRequest('/api/health', 'GET');
            if (response.code !== 200) {
                throw new Error(`FastGPT API validation failed: ${response.message}`);
            }
        }
        catch (error) {
            throw new Error(`FastGPT API connection failed: ${error}`);
        }
    }
    async destroy() {
        this.requestCache.clear();
        this.isInitialized = false;
    }
    async get(key) {
        if (!this.isAvailable) {
            return null;
        }
        try {
            const chatId = this.extractChatIdFromKey(key);
            if (!chatId) {
                return null;
            }
            const cached = this.getCachedData(`chat:${chatId}`);
            if (cached) {
                return cached;
            }
            const detail = await this.getChatHistory(chatId);
            if (!detail) {
                return null;
            }
            this.setCachedData(`chat:${chatId}`, detail);
            return detail;
        }
        catch (error) {
            console.error('Failed to get from FastGPT:', error);
            return null;
        }
    }
    async set(_key, _value, _options = {}) {
        console.warn('FastGPTStorage is read-only, set operation ignored');
    }
    async delete(_key) {
        console.warn('FastGPTStorage is read-only, delete operation ignored');
        return false;
    }
    async exists(key) {
        if (!this.isAvailable) {
            return false;
        }
        try {
            const chatId = this.extractChatIdFromKey(key);
            if (!chatId) {
                return false;
            }
            const summary = await this.getChatSummary(chatId);
            return !!summary;
        }
        catch (error) {
            console.error('Failed to check existence in FastGPT:', error);
            return false;
        }
    }
    async clear() {
        console.warn('FastGPTStorage is read-only, clear operation ignored');
    }
    async mget(keys) {
        const result = new Map();
        const chatIds = keys.map(key => this.extractChatIdFromKey(key)).filter(Boolean);
        const summaries = await this.getChatSummaries(chatIds);
        for (const key of keys) {
            const chatId = this.extractChatIdFromKey(key);
            if (!chatId) {
                result.set(key, null);
                continue;
            }
            const summary = summaries.find(s => s.chatId === chatId);
            if (summary) {
                const detail = await this.get(key);
                result.set(key, detail);
            }
            else {
                result.set(key, null);
            }
        }
        return result;
    }
    async mset(_entries) {
        console.warn('FastGPTStorage is read-only, mset operation ignored');
    }
    async mdelete(_keys) {
        console.warn('FastGPTStorage is read-only, mdelete operation ignored');
        return false;
    }
    async list(prefix = '', limit) {
        if (!this.isAvailable) {
            return [];
        }
        try {
            const summaries = await this.getAllChatSummaries();
            const filtered = prefix
                ? summaries.filter(s => s.chatId.startsWith(prefix))
                : summaries;
            const limited = limit ? filtered.slice(0, limit) : filtered;
            const results = [];
            for (const summary of limited) {
                const key = this.generateKeyFromChatId(summary.chatId);
                const value = await this.get(key);
                if (value) {
                    results.push({ key, value });
                }
            }
            return results;
        }
        catch (error) {
            console.error('Failed to list from FastGPT:', error);
            return [];
        }
    }
    async search(query) {
        if (!this.isAvailable) {
            return [];
        }
        try {
            const summaries = await this.getAllChatSummaries();
            const results = [];
            for (const summary of summaries) {
                let score = 0;
                if (query.text) {
                    if (summary.title.includes(query.text) ||
                        summary.chatId.includes(query.text)) {
                        score += 10;
                    }
                }
                if (query.dateRange) {
                    const createdAt = new Date(summary.createdAt).getTime();
                    if (createdAt >= query.dateRange.start && createdAt <= query.dateRange.end) {
                        score += 15;
                    }
                }
                if (query.messageCount) {
                    const msgCount = summary.messageCount || 0;
                    if ((!query.messageCount.min || msgCount >= query.messageCount.min) &&
                        (!query.messageCount.max || msgCount <= query.messageCount.max)) {
                        score += 5;
                    }
                }
                if (score > 0) {
                    const key = this.generateKeyFromChatId(summary.chatId);
                    const value = await this.get(key);
                    if (value) {
                        results.push({ key, value, score });
                    }
                }
            }
            results.sort((a, b) => b.score - a.score);
            if (query.limit) {
                results.splice(query.limit);
            }
            return results;
        }
        catch (error) {
            console.error('Failed to search FastGPT:', error);
            return [];
        }
    }
    async getStats() {
        if (!this.isAvailable) {
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
        try {
            const summaries = await this.getAllChatSummaries();
            const totalEntries = summaries.length;
            const totalSize = JSON.stringify(summaries).length * 2;
            const timestamps = summaries.map(s => new Date(s.createdAt).getTime());
            const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
            const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;
            return {
                totalEntries,
                totalSize,
                hitCount: 0,
                missCount: 0,
                hitRate: 0,
                averageAccessTime: this.config.timeout || 30000,
                oldestEntry,
                newestEntry,
            };
        }
        catch (error) {
            console.error('Failed to get FastGPT stats:', error);
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
    async getChatSummaries(chatIds) {
        if (!this.isAvailable) {
            return [];
        }
        try {
            const cacheKey = `summaries:${chatIds?.join(',') || 'all'}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            let url = '/api/chat/list';
            if (chatIds && chatIds.length > 0) {
                url += `?chatIds=${chatIds.join(',')}`;
            }
            const response = await this.makeRequest(url);
            this.setCachedData(cacheKey, response.data, 2 * 60 * 1000);
            return response.data;
        }
        catch (error) {
            console.error('Failed to get chat summaries:', error);
            return [];
        }
    }
    async getAllChatSummaries() {
        return this.getChatSummaries();
    }
    async getChatHistory(chatId) {
        if (!this.isAvailable) {
            return null;
        }
        try {
            const cacheKey = `chat:${chatId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await this.makeRequest(`/api/chat/detail?chatId=${chatId}`);
            this.setCachedData(cacheKey, response.data);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to get chat history for ${chatId}:`, error);
            return null;
        }
    }
    async getChatSummary(chatId) {
        const summaries = await this.getChatSummaries([chatId]);
        return summaries.find(s => s.chatId === chatId) || null;
    }
    async getChatSummariesByAgent(agentId) {
        if (!this.isAvailable) {
            return [];
        }
        try {
            const cacheKey = `summaries:agent:${agentId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }
            const response = await this.makeRequest(`/api/chat/list?appId=${agentId}`);
            this.setCachedData(cacheKey, response.data, 2 * 60 * 1000);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to get chat summaries for agent ${agentId}:`, error);
            return [];
        }
    }
    async getIncrementalUpdates(agentId, since) {
        if (!this.isAvailable) {
            return [];
        }
        try {
            let url = `/api/chat/updates?appId=${agentId}`;
            if (since) {
                url += `&since=${since}`;
            }
            const response = await this.makeRequest(url);
            return response.data;
        }
        catch (error) {
            console.error('Failed to get incremental updates:', error);
            return [];
        }
    }
    async makeRequest(endpoint, method = 'GET', data) {
        const url = `${this.config.baseUrl}${endpoint}`;
        const maxRetries = this.config.retryAttempts || 3;
        const retryDelay = this.config.retryDelay || 1000;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`,
                    },
                    body: data ? JSON.stringify(data) : null,
                    signal: AbortSignal.timeout(this.config.timeout || 30000),
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const result = await response.json();
                if (result.code !== 200) {
                    throw new Error(`FastGPT API error: ${result.message}`);
                }
                return result;
            }
            catch (error) {
                if (attempt === maxRetries - 1) {
                    throw error;
                }
                const delay = retryDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error('Max retry attempts exceeded');
    }
    extractChatIdFromKey(key) {
        const parts = key.split(':');
        return parts.length > 1 ? (parts[parts.length - 1] || null) : key;
    }
    generateKeyFromChatId(chatId) {
        return `fastgpt:${chatId}`;
    }
    getCachedData(key) {
        const cached = this.requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }
        if (cached) {
            this.requestCache.delete(key);
        }
        return null;
    }
    setCachedData(key, data, expiry) {
        this.requestCache.set(key, {
            data,
            timestamp: Date.now(),
        });
        if (expiry && expiry !== this.cacheExpiry) {
            setTimeout(() => {
                this.requestCache.delete(key);
            }, expiry);
        }
    }
    clearCache() {
        this.requestCache.clear();
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}
exports.FastGPTStorageProvider = FastGPTStorageProvider;
//# sourceMappingURL=FastGPTStorageProvider.js.map