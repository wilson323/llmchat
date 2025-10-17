"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncManager = void 0;
const hybrid_storage_1 = require("@/types/hybrid-storage");
;
;
class SyncManager {
    constructor(memoryProvider, indexedDBProvider, fastgptProvider, syncPolicy) {
        this.offlineMode = false;
        this.pendingOperations = new Map();
        this.syncProgressCallbacks = new Set();
        this.syncConflictCallbacks = new Set();
        this.syncErrorCallbacks = new Set();
        this.syncInProgress = new Set();
        this.memoryProvider = memoryProvider;
        this.indexedDBProvider = indexedDBProvider;
        this.fastgptProvider = fastgptProvider;
        this.syncPolicy = {
            autoSync: true,
            syncInterval: 5 * 60 * 1000,
            batchSize: 10,
            maxRetries: 3,
            conflictResolution: 'prompt',
            compressData: true,
            deltaSync: true,
            ...syncPolicy,
        };
        this.initializeAutoSync();
    }
    async getSyncStatus(sessionId) {
        const localStatus = await this.getLocalSyncStatus(sessionId);
        if (localStatus) {
            return localStatus;
        }
        if (this.pendingOperations.has(sessionId)) {
            return hybrid_storage_1.SyncStatus.PENDING;
        }
        if (this.syncInProgress.has(sessionId)) {
            return hybrid_storage_1.SyncStatus.PENDING;
        }
        if (this.offlineMode) {
            return hybrid_storage_1.SyncStatus.OFFLINE;
        }
        return hybrid_storage_1.SyncStatus.SYNCED;
    }
    async setSyncStatus(sessionId, status) {
        const key = `sync:${sessionId}`;
        await this.indexedDBProvider.set(key, {
            sessionId,
            status,
            timestamp: Date.now(),
        });
    }
    async getPendingSyncSessions() {
        return Array.from(this.pendingOperations.keys());
    }
    async syncSession(sessionId) {
        if (this.syncInProgress.has(sessionId)) {
            return {
                sessionId,
                success: false,
                error: '同步已在进行中',
                changes: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
                duration: 0,
            };
        }
        this.syncInProgress.add(sessionId);
        const startTime = Date.now();
        try {
            this.reportProgress({
                sessionId,
                stage: 'starting',
                progress: 0,
                current: 0,
                total: 100,
                message: '开始同步会话...',
            });
            const localData = await this.getLocalSession(sessionId);
            this.reportProgress({
                sessionId,
                stage: 'fetching',
                progress: 20,
                current: 1,
                total: 5,
                message: '获取本地数据...',
            });
            const remoteData = await this.getRemoteSession(sessionId);
            this.reportProgress({
                sessionId,
                stage: 'fetching',
                progress: 40,
                current: 2,
                total: 5,
                message: '获取远程数据...',
            });
            const conflicts = await this.detectConflicts(sessionId);
            this.reportProgress({
                sessionId,
                stage: 'processing',
                progress: 60,
                current: 3,
                total: 5,
                message: '处理数据冲突...',
            });
            if (conflicts.length > 0) {
                for (const conflict of conflicts) {
                    await this.handleConflict(conflict);
                }
            }
            const changes = await this.performSync(sessionId, localData, remoteData);
            this.reportProgress({
                sessionId,
                stage: 'completing',
                progress: 90,
                current: 4,
                total: 5,
                message: '完成同步...',
            });
            this.pendingOperations.delete(sessionId);
            await this.setSyncStatus(sessionId, hybrid_storage_1.SyncStatus.SYNCED);
            this.reportProgress({
                sessionId,
                stage: 'completing',
                progress: 100,
                current: 5,
                total: 5,
                message: '同步完成',
            });
            return {
                sessionId,
                success: true,
                changes,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            const syncError = {
                sessionId,
                error: error instanceof Error ? error.message : String(error),
                code: 'SYNC_FAILED',
                timestamp: Date.now(),
                retryable: true,
            };
            this.reportError(syncError);
            await this.setSyncStatus(sessionId, hybrid_storage_1.SyncStatus.ERROR);
            return {
                sessionId,
                success: false,
                error: syncError.error,
                changes: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
                duration: Date.now() - startTime,
            };
        }
        finally {
            this.syncInProgress.delete(sessionId);
        }
    }
    async syncAgentSessions(agentId) {
        const startTime = Date.now();
        const results = [];
        try {
            const localSessions = await this.getLocalAgentSessions(agentId);
            const remoteSummaries = await this.getRemoteAgentSessions(agentId);
            const allSessionIds = new Set([
                ...localSessions.map(s => s.id),
                ...remoteSummaries.map(s => s.chatId),
            ]);
            const sessionIds = Array.from(allSessionIds);
            for (let i = 0; i < sessionIds.length; i += this.syncPolicy.batchSize) {
                const batch = sessionIds.slice(i, i + this.syncPolicy.batchSize);
                const batchPromises = batch.map(sessionId => this.syncSession(sessionId));
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                this.reportProgress({
                    agentId,
                    stage: 'processing',
                    progress: Math.floor((i + batch.length) / sessionIds.length * 100),
                    current: i + batch.length,
                    total: sessionIds.length,
                    message: `同步智能体 ${agentId} 的会话...`,
                });
            }
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;
            const conflictCount = results.reduce((sum, r) => sum + r.changes.conflicts, 0);
            return {
                totalSessions: sessionIds.length,
                successCount,
                failureCount,
                conflictCount,
                results,
                duration: Date.now() - startTime,
            };
        }
        catch (error) {
            const syncError = {
                agentId,
                error: error instanceof Error ? error.message : String(error),
                code: 'BATCH_SYNC_FAILED',
                timestamp: Date.now(),
                retryable: true,
            };
            this.reportError(syncError);
            return {
                totalSessions: 0,
                successCount: 0,
                failureCount: 1,
                conflictCount: 0,
                results: [{
                        sessionId: agentId,
                        success: false,
                        error: syncError.error,
                        changes: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
                        duration: Date.now() - startTime,
                    }],
                duration: Date.now() - startTime,
            };
        }
    }
    async syncAllSessions() {
        const agents = await this.getAllAgents();
        const allResults = [];
        for (const agent of agents) {
            const result = await this.syncAgentSessions(agent.id);
            allResults.push(result);
        }
        const totalSessions = allResults.reduce((sum, r) => sum + r.totalSessions, 0);
        const successCount = allResults.reduce((sum, r) => sum + r.successCount, 0);
        const failureCount = allResults.reduce((sum, r) => sum + r.failureCount, 0);
        const conflictCount = allResults.reduce((sum, r) => sum + r.conflictCount, 0);
        const allSyncResults = allResults.flatMap(r => r.results);
        const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);
        return {
            totalSessions,
            successCount,
            failureCount,
            conflictCount,
            results: allSyncResults,
            duration: totalDuration,
        };
    }
    async detectConflicts(sessionId) {
        const conflicts = [];
        try {
            const localData = await this.getLocalSession(sessionId);
            const remoteData = await this.getRemoteSession(sessionId);
            if (!localData && !remoteData) {
                return conflicts;
            }
            if (!localData && remoteData) {
                conflicts.push({
                    sessionId,
                    localVersion: 0,
                    remoteVersion: 1,
                    localData: null,
                    remoteData,
                    conflictType: 'merge',
                    resolved: false,
                });
            }
            else if (localData && !remoteData) {
                conflicts.push({
                    sessionId,
                    localVersion: localData.metadata?.version || 1,
                    remoteVersion: 0,
                    localData,
                    remoteData: null,
                    conflictType: 'delete',
                    resolved: false,
                });
            }
            else if (localData && remoteData) {
                const localVersion = localData.metadata?.version || 1;
                const remoteVersion = this.extractVersionFromRemoteData(remoteData);
                if (localVersion !== remoteVersion) {
                    conflicts.push({
                        sessionId,
                        localVersion,
                        remoteVersion,
                        localData,
                        remoteData,
                        conflictType: 'update',
                        resolved: false,
                    });
                }
            }
        }
        catch (error) {
            console.error('冲突检测失败:', error);
        }
        return conflicts;
    }
    async resolveConflict(sessionId, resolution) {
        try {
            switch (resolution.strategy) {
                case 'local_wins':
                    await this.applyLocalResolution(sessionId, resolution);
                    break;
                case 'remote_wins':
                    await this.applyRemoteResolution(sessionId, resolution);
                    break;
                case 'merge':
                    await this.applyMergedResolution(sessionId, resolution);
                    break;
                case 'manual':
                    break;
            }
            await this.markConflictResolved(sessionId);
            return true;
        }
        catch (error) {
            console.error('冲突解决失败:', error);
            return false;
        }
    }
    async getIncrementalUpdates(agentId, since) {
        try {
            const remoteUpdates = await this.getRemoteIncrementalUpdates(agentId, since);
            const updates = remoteUpdates.map(update => ({
                sessionId: update.chatId,
                type: update.type,
                data: update.data,
                version: update.version,
                timestamp: update.timestamp,
                checksum: this.calculateChecksum(update.data),
            }));
            return updates;
        }
        catch (error) {
            console.error('获取增量更新失败:', error);
            return [];
        }
    }
    async applyIncrementalUpdates(updates) {
        for (const update of updates) {
            try {
                await this.applySingleUpdate(update);
            }
            catch (error) {
                console.error(`应用更新失败 ${update.sessionId}:`, error);
            }
        }
    }
    async enableOfflineMode() {
        this.offlineMode = true;
        console.log('离线模式已启用');
    }
    async disableOfflineMode() {
        this.offlineMode = false;
        console.log('离线模式已禁用');
        if (this.syncPolicy.autoSync) {
            await this.syncPendingSessions();
        }
    }
    async isOfflineMode() {
        return this.offlineMode;
    }
    setSyncPolicy(policy) {
        this.syncPolicy = { ...this.syncPolicy, ...policy };
        if (policy.autoSync) {
            this.initializeAutoSync();
        }
    }
    getSyncPolicy() {
        return { ...this.syncPolicy };
    }
    onSyncProgress(callback) {
        this.syncProgressCallbacks.add(callback);
        return () => this.syncProgressCallbacks.delete(callback);
    }
    onSyncConflict(callback) {
        this.syncConflictCallbacks.add(callback);
        return () => this.syncConflictCallbacks.delete(callback);
    }
    onSyncError(callback) {
        this.syncErrorCallbacks.add(callback);
        return () => this.syncErrorCallbacks.delete(callback);
    }
    initializeAutoSync() {
        if (!this.syncPolicy.autoSync) {
            return;
        }
        setInterval(async () => {
            if (!this.offlineMode && this.syncPolicy.autoSync) {
                await this.syncPendingSessions();
            }
        }, this.syncPolicy.syncInterval);
    }
    async syncPendingSessions() {
        const pendingSessions = await this.getPendingSyncSessions();
        for (const sessionId of pendingSessions) {
            await this.syncSession(sessionId);
        }
    }
    async getLocalSession(sessionId) {
        const memoryData = await this.memoryProvider.get(sessionId);
        if (memoryData) {
            return memoryData;
        }
        const indexedData = await this.indexedDBProvider.get(sessionId);
        if (indexedData) {
            return indexedData;
        }
        return null;
    }
    async getRemoteSession(sessionId) {
        try {
            return await this.fastgptProvider.get(sessionId);
        }
        catch (error) {
            console.error('获取远程会话失败:', error);
            return null;
        }
    }
    async getLocalAgentSessions(agentId) {
        const sessions = await this.indexedDBProvider.list(`session:${agentId}:`);
        return sessions.map(item => item.value);
    }
    async getRemoteAgentSessions(agentId) {
        try {
            if ('getChatSummariesByAgent' in this.fastgptProvider) {
                return await this.fastgptProvider.getChatSummariesByAgent(agentId);
            }
            return [];
        }
        catch (error) {
            console.error('获取远程智能体会话失败:', error);
            return [];
        }
    }
    async getAllAgents() {
        const agents = await this.indexedDBProvider.list('agent:');
        return agents.map(item => item.value);
    }
    async performSync(sessionId, localData, remoteData) {
        let created = 0, updated = 0, deleted = 0;
        const conflicts = 0;
        if (!localData && remoteData) {
            const localSession = this.convertRemoteToLocal(remoteData);
            await this.indexedDBProvider.set(sessionId, localSession);
            await this.memoryProvider.set(sessionId, localSession);
            created++;
        }
        else if (localData && !remoteData) {
            await this.indexedDBProvider.delete(sessionId);
            await this.memoryProvider.delete(sessionId);
            deleted++;
        }
        else if (localData && remoteData) {
            const remoteVersion = this.extractVersionFromRemoteData(remoteData);
            const localVersion = localData.metadata?.version || 0;
            if (remoteVersion > localVersion) {
                const updatedSession = this.mergeSessionData(localData, remoteData);
                await this.indexedDBProvider.set(sessionId, updatedSession);
                await this.memoryProvider.set(sessionId, updatedSession);
                updated++;
            }
        }
        return { created, updated, deleted, conflicts };
    }
    convertRemoteToLocal(remote) {
        return {
            id: remote.chatId,
            title: remote.title || '未命名会话',
            agentId: remote.appId || 'default',
            messages: this.convertRemoteMessages(remote.messages),
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime(),
            lastAccessedAt: Date.now(),
            messageCount: remote.messages.length,
            isPinned: false,
            tags: [],
            isArchived: false,
            metadata: {
                version: 1,
                fastgptChatId: remote.chatId,
                remoteMetadata: remote.metadata,
            },
        };
    }
    convertRemoteMessages(remoteMessages) {
        return remoteMessages.map(msg => ({
            [msg.role === 'user' ? 'HUMAN' : 'AI']: msg.content,
            id: msg.id || msg.dataId,
            feedback: msg.feedback,
            timestamp: Date.now(),
            raw: msg.raw,
        }));
    }
    mergeSessionData(local, remote) {
        const currentVersion = local.metadata?.version || 0;
        return {
            ...local,
            messages: this.convertRemoteMessages(remote.messages),
            updatedAt: new Date().getTime(),
            messageCount: remote.messages.length,
            lastAccessedAt: Date.now(),
            metadata: {
                ...local.metadata,
                version: currentVersion + 1,
                fastgptChatId: remote.chatId,
                remoteMetadata: remote.metadata,
                lastSyncAt: Date.now(),
            },
        };
    }
    extractVersionFromRemoteData(remote) {
        return remote.metadata?.version || 1;
    }
    calculateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }
    async getLocalSyncStatus(sessionId) {
        const key = `sync:${sessionId}`;
        const syncData = await this.indexedDBProvider.get(key);
        return syncData?.status || null;
    }
    async handleConflict(conflict) {
        switch (this.syncPolicy.conflictResolution) {
            case 'local_wins':
                await this.resolveConflict(conflict.sessionId, {
                    sessionId: conflict.sessionId,
                    strategy: 'local_wins',
                    resolvedAt: Date.now(),
                });
                break;
            case 'remote_wins':
                await this.resolveConflict(conflict.sessionId, {
                    sessionId: conflict.sessionId,
                    strategy: 'remote_wins',
                    resolvedAt: Date.now(),
                });
                break;
            case 'prompt':
                this.syncConflictCallbacks.forEach(callback => callback(conflict));
                break;
        }
    }
    async applyLocalResolution(sessionId, _resolution) {
        console.log(`应用本地解决方案: ${sessionId}`);
    }
    async applyRemoteResolution(sessionId, _resolution) {
        const remoteData = await this.getRemoteSession(sessionId);
        if (remoteData) {
            const localSession = this.convertRemoteToLocal(remoteData);
            await this.indexedDBProvider.set(sessionId, localSession);
            await this.memoryProvider.set(sessionId, localSession);
        }
    }
    async applyMergedResolution(sessionId, resolution) {
        if (resolution.mergedData) {
            await this.indexedDBProvider.set(sessionId, resolution.mergedData);
            await this.memoryProvider.set(sessionId, resolution.mergedData);
        }
    }
    async markConflictResolved(sessionId) {
        const key = `conflict:${sessionId}`;
        await this.indexedDBProvider.set(key, {
            sessionId,
            resolved: true,
            resolvedAt: Date.now(),
        });
    }
    async getRemoteIncrementalUpdates(agentId, since) {
        try {
            if ('getIncrementalUpdates' in this.fastgptProvider) {
                return await this.fastgptProvider.getIncrementalUpdates(agentId, since);
            }
            return [];
        }
        catch (error) {
            console.error('获取远程增量更新失败:', error);
            return [];
        }
    }
    async applySingleUpdate(update) {
        switch (update.type) {
            case 'create':
            case 'update':
                await this.indexedDBProvider.set(update.sessionId, update.data);
                await this.memoryProvider.set(update.sessionId, update.data);
                break;
            case 'delete':
                await this.indexedDBProvider.delete(update.sessionId);
                await this.memoryProvider.delete(update.sessionId);
                break;
        }
    }
    reportProgress(progress) {
        this.syncProgressCallbacks.forEach(callback => {
            try {
                callback(progress);
            }
            catch (error) {
                console.error('进度回调错误:', error);
            }
        });
    }
    reportError(error) {
        this.syncErrorCallbacks.forEach(callback => {
            try {
                callback(error);
            }
            catch (error) {
                console.error('错误回调错误:', error);
            }
        });
    }
    async forceSyncAll() {
        const originalAutoSync = this.syncPolicy.autoSync;
        this.syncPolicy.autoSync = false;
        try {
            return await this.syncAllSessions();
        }
        finally {
            this.syncPolicy.autoSync = originalAutoSync;
        }
    }
    async getSyncStats() {
        const localSessions = await this.indexedDBProvider.list('session:');
        const totalSessions = localSessions.length;
        let syncedSessions = 0;
        let pendingSessions = 0;
        let conflictedSessions = 0;
        for (const { key: sessionId } of localSessions) {
            const status = await this.getSyncStatus(sessionId);
            switch (status) {
                case 'synced':
                    syncedSessions++;
                    break;
                case 'pending':
                    pendingSessions++;
                    break;
                case 'conflict':
                    conflictedSessions++;
                    break;
            }
        }
        return {
            totalSessions,
            syncedSessions,
            pendingSessions,
            conflictedSessions,
            lastSyncTime: Date.now(),
        };
    }
}
exports.SyncManager = SyncManager;
//# sourceMappingURL=SyncManager.js.map