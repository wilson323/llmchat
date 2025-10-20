/**
 * 智能同步管理器
 * 负责FastGPT与本地存储之间的数据同步
 */

import {
  ISyncManager,
  SyncStatus,
  SyncResult,
  BatchSyncResult,
  SyncConflict,
  ConflictResolution,
  SessionUpdate,
  SyncPolicy,
  SyncProgress,
  SyncError,
  IStorageProvider,
} from '@/types/hybrid-storage';


import { FastGPTChatHistorySummary, FastGPTChatHistoryDetail, ChatSession, ChatMessage } from '@/types';

export class SyncManager implements ISyncManager {
  private memoryProvider: IStorageProvider;
  private indexedDBProvider: IStorageProvider;
  private fastgptProvider: IStorageProvider;
  private syncPolicy: SyncPolicy;
  private offlineMode = false;
  private pendingOperations = new Map<string, 'create' | 'update' | 'delete'>();
  private syncProgressCallbacks = new Set<(progress: SyncProgress) => void>();
  private syncConflictCallbacks = new Set<(conflict: SyncConflict) => void>();
  private syncErrorCallbacks = new Set<(error: SyncError) => void>();
  private syncInProgress = new Set<string>();

  constructor(
    memoryProvider: IStorageProvider,
    indexedDBProvider: IStorageProvider,
    fastgptProvider: IStorageProvider,
    syncPolicy?: Partial<SyncPolicy>,
  ) {
    this.memoryProvider = memoryProvider;
    this.indexedDBProvider = indexedDBProvider;
    this.fastgptProvider = fastgptProvider;

    this.syncPolicy = {
      autoSync: true,
      syncInterval: 5 * 60 * 1000, // 5分钟
      batchSize: 10,
      maxRetries: 3,
      conflictResolution: 'prompt',
      compressData: true,
      deltaSync: true,
      ...syncPolicy,
    };

    this.initializeAutoSync();
  }

  // ==================== 同步状态管理 ====================

  async getSyncStatus(sessionId: string): Promise<SyncStatus> {
    // 检查本地状态
    const localStatus = await this.getLocalSyncStatus(sessionId);
    if (localStatus) {
      return localStatus;
    }

    // 检查是否在待同步队列
    if (this.pendingOperations.has(sessionId)) {
      return SyncStatus.PENDING;
    }

    // 检查是否正在同步
    if (this.syncInProgress.has(sessionId)) {
      return SyncStatus.PENDING;
    }

    // 检查离线模式
    if (this.offlineMode) {
      return SyncStatus.OFFLINE;
    }

    return SyncStatus.SYNCED;
  }

  async setSyncStatus(sessionId: string, status: SyncStatus): Promise<void> {
    const key = `sync:${sessionId}`;
    await this.indexedDBProvider.set(key, {
      sessionId,
      status,
      timestamp: Date.now(),
    });
  }

  async getPendingSyncSessions(): Promise<string[]> {
    return Array.from(this.pendingOperations.keys());
  }

  // ==================== 同步操作 ====================

  async syncSession(sessionId: string): Promise<SyncResult> {
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

      // 获取本地数据
      const localData = await this.getLocalSession(sessionId);
      this.reportProgress({
        sessionId,
        stage: 'fetching',
        progress: 20,
        current: 1,
        total: 5,
        message: '获取本地数据...',
      });

      // 获取远程数据
      const remoteData = await this.getRemoteSession(sessionId);
      this.reportProgress({
        sessionId,
        stage: 'fetching',
        progress: 40,
        current: 2,
        total: 5,
        message: '获取远程数据...',
      });

      // 检测冲突
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
        // 处理冲突
        for (const conflict of conflicts) {
          await this.handleConflict(conflict);
        }
      }

      // 执行同步
      const changes = await this.performSync(sessionId, localData, remoteData);
      this.reportProgress({
        sessionId,
        stage: 'completing',
        progress: 90,
        current: 4,
        total: 5,
        message: '完成同步...',
      });

      // 清理待同步状态
      this.pendingOperations.delete(sessionId);
      await this.setSyncStatus(sessionId, SyncStatus.SYNCED);

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

    } catch (error) {
      const syncError: SyncError = {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        code: 'SYNC_FAILED',
        timestamp: Date.now(),
        retryable: true,
      };

      this.reportError(syncError);
      await this.setSyncStatus(sessionId, SyncStatus.ERROR);

      return {
        sessionId,
        success: false,
        error: syncError.error,
        changes: { created: 0, updated: 0, deleted: 0, conflicts: 0 },
        duration: Date.now() - startTime,
      };

    } finally {
      this.syncInProgress.delete(sessionId);
    }
  }

  async syncAgentSessions(agentId: string): Promise<BatchSyncResult> {
    const startTime = Date.now();
    const results: SyncResult[] = [];

    try {
      // 获取智能体的所有会话
      const localSessions = await this.getLocalAgentSessions(agentId);
      const remoteSummaries = await this.getRemoteAgentSessions(agentId);

      // 合并本地和远程会话ID
      const allSessionIds = new Set([
        ...localSessions.map(s => s.id),
        ...remoteSummaries.map(s => s.chatId),
      ]);

      // 批量同步
      const sessionIds = Array.from(allSessionIds);
      for (let i = 0; i < sessionIds.length; i += this.syncPolicy.batchSize) {
        const batch = sessionIds.slice(i, i + this.syncPolicy.batchSize);

        const batchPromises = batch.map(sessionId => this.syncSession(sessionId));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 报告批量同步进度
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

    } catch (error) {
      const syncError: SyncError = {
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

  async syncAllSessions(): Promise<BatchSyncResult> {
    // 获取所有智能体
    const agents = await this.getAllAgents();
    const allResults: BatchSyncResult[] = [];

    for (const agent of agents) {
      const result = await this.syncAgentSessions(agent.id);
      allResults.push(result);
    }

    // 合并结果
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

  // ==================== 冲突检测和处理 ====================

  async detectConflicts(sessionId: string): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    try {
      const localData = await this.getLocalSession(sessionId);
      const remoteData = await this.getRemoteSession(sessionId);

      if (!localData && !remoteData) {
        return conflicts;
      }

      if (!localData && remoteData) {
        // 远程存在，本地不存在 - 创建冲突
        conflicts.push({
          sessionId,
          localVersion: 0,
          remoteVersion: 1,
          localData: null,
          remoteData,
          conflictType: 'merge',
          resolved: false,
        });
      } else if (localData && !remoteData) {
        // 本地存在，远程不存在 - 删除冲突
        conflicts.push({
          sessionId,
          localVersion: (localData.metadata?.version as number) || 1,
          remoteVersion: 0,
          localData,
          remoteData: null,
          conflictType: 'delete',
          resolved: false,
        });
      } else if (localData && remoteData) {
        // 版本比较
        const localVersion = (localData.metadata?.version as number) || 1;
        const remoteVersion = this.extractVersionFromRemoteData(remoteData);

        if (localVersion !== remoteVersion) {
          // 更新冲突
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

    } catch (error) {
      console.error('冲突检测失败:', error);
    }

    return conflicts;
  }

  async resolveConflict(sessionId: string, resolution: ConflictResolution): Promise<boolean> {
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
          // 手动解决需要UI支持，这里只是标记为已解决
          break;
      }

      // 标记冲突已解决
      await this.markConflictResolved(sessionId);
      return true;

    } catch (error) {
      console.error('冲突解决失败:', error);
      return false;
    }
  }

  // ==================== 增量同步 ====================

  async getIncrementalUpdates(agentId: string, since?: number): Promise<SessionUpdate[]> {
    try {
      // 获取指定时间以来的远程更新
      const remoteUpdates = await this.getRemoteIncrementalUpdates(agentId, since);

      // 转换为标准格式
      const updates: SessionUpdate[] = remoteUpdates.map(update => ({
        sessionId: update.chatId,
        type: update.type,
        data: update.data,
        version: update.version,
        timestamp: update.timestamp,
        checksum: this.calculateChecksum(update.data),
      }));

      return updates;

    } catch (error) {
      console.error('获取增量更新失败:', error);
      return [];
    }
  }

  async applyIncrementalUpdates(updates: SessionUpdate[]): Promise<void> {
    for (const update of updates) {
      try {
        await this.applySingleUpdate(update);
      } catch (error) {
        console.error(`应用更新失败 ${update.sessionId}:`, error);
      }
    }
  }

  // ==================== 离线支持 ====================

  async enableOfflineMode(): Promise<void> {
    this.offlineMode = true;
    console.log('离线模式已启用');
  }

  async disableOfflineMode(): Promise<void> {
    this.offlineMode = false;
    console.log('离线模式已禁用');

    // 离线模式解除后，立即同步待处理的数据
    if (this.syncPolicy.autoSync) {
      await this.syncPendingSessions();
    }
  }

  async isOfflineMode(): Promise<boolean> {
    return this.offlineMode;
  }

  // ==================== 同步策略 ====================

  setSyncPolicy(policy: SyncPolicy): void {
    this.syncPolicy = { ...this.syncPolicy, ...policy };

    // 重新初始化自动同步
    if (policy.autoSync) {
      this.initializeAutoSync();
    }
  }

  getSyncPolicy(): SyncPolicy {
    return { ...this.syncPolicy };
  }

  // ==================== 监听器管理 ====================

  onSyncProgress(callback: (progress: SyncProgress) => void): () => void {
    this.syncProgressCallbacks.add(callback);
    return () => this.syncProgressCallbacks.delete(callback);
  }

  onSyncConflict(callback: (conflict: SyncConflict) => void): () => void {
    this.syncConflictCallbacks.add(callback);
    return () => this.syncConflictCallbacks.delete(callback);
  }

  onSyncError(callback: (error: SyncError) => void): () => void {
    this.syncErrorCallbacks.add(callback);
    return () => this.syncErrorCallbacks.delete(callback);
  }

  // ==================== 私有方法 ====================

  private initializeAutoSync(): void {
    if (!this.syncPolicy.autoSync) {
      return;
    }

    // 定时自动同步
    setInterval(async () => {
      if (!this.offlineMode && this.syncPolicy.autoSync) {
        await this.syncPendingSessions();
      }
    }, this.syncPolicy.syncInterval);
  }

  private async syncPendingSessions(): Promise<void> {
    const pendingSessions = await this.getPendingSyncSessions();
    for (const sessionId of pendingSessions) {
      await this.syncSession(sessionId);
    }
  }

  private async getLocalSession(sessionId: string): Promise<ChatSession | null> {
    // 首先从内存获取
    const memoryData = await this.memoryProvider.get<ChatSession>(sessionId);
    if (memoryData) {
      return memoryData;
    }

    // 然后从IndexedDB获取
    const indexedData = await this.indexedDBProvider.get<ChatSession>(sessionId);
    if (indexedData) {
      return indexedData;
    }

    return null;
  }

  private async getRemoteSession(sessionId: string): Promise<FastGPTChatHistoryDetail | null> {
    try {
      return await this.fastgptProvider.get<FastGPTChatHistoryDetail>(sessionId);
    } catch (error) {
      console.error('获取远程会话失败:', error);
      return null;
    }
  }

  private async getLocalAgentSessions(agentId: string): Promise<ChatSession[]> {
    // 从本地存储获取智能体的所有会话
    const sessions = await this.indexedDBProvider.list<ChatSession>(`session:${agentId}:`);
    return sessions.map(item => item.value);
  }

  private async getRemoteAgentSessions(agentId: string): Promise<FastGPTChatHistorySummary[]> {
    try {
      // 使用FastGPT提供者的特定方法
      if ('getChatSummariesByAgent' in this.fastgptProvider) {
        return await (this.fastgptProvider as any).getChatSummariesByAgent(agentId);
      }
      return [];
    } catch (error) {
      console.error('获取远程智能体会话失败:', error);
      return [];
    }
  }

  private async getAllAgents(): Promise<Array<{id: string, name: string}>> {
    // 从本地存储获取所有智能体信息
    const agents = await this.indexedDBProvider.list<any>('agent:');
    return agents.map(item => item.value);
  }

  private async performSync(
    sessionId: string,
    localData: ChatSession | null,
    remoteData: FastGPTChatHistoryDetail | null,
  ): Promise<{created: number, updated: number, deleted: number, conflicts: number}> {
    let created = 0, updated = 0, deleted = 0;
    const conflicts = 0;

    if (!localData && remoteData) {
      // 创建本地会话
      const localSession = this.convertRemoteToLocal(remoteData);
      await this.indexedDBProvider.set(sessionId, localSession);
      await this.memoryProvider.set(sessionId, localSession);
      created++;
    } else if (localData && !remoteData) {
      // 本地会话在远程被删除
      await this.indexedDBProvider.delete(sessionId);
      await this.memoryProvider.delete(sessionId);
      deleted++;
    } else if (localData && remoteData) {
      // 比较版本，更新本地
      const remoteVersion = this.extractVersionFromRemoteData(remoteData);
      const localVersion = (localData.metadata?.version as number) || 0;
      if (remoteVersion > localVersion) {
        const updatedSession = this.mergeSessionData(localData, remoteData);
        await this.indexedDBProvider.set(sessionId, updatedSession);
        await this.memoryProvider.set(sessionId, updatedSession);
        updated++;
      }
    }

    return { created, updated, deleted, conflicts };
  }

  private convertRemoteToLocal(remote: FastGPTChatHistoryDetail): ChatSession {
    return {
      id: remote.chatId,
      title: remote.title || '未命名会话',
      agentId: remote.appId || 'default',
      messages: this.convertRemoteMessages(remote.messages),
      createdAt: new Date().getTime(), // FastGPT可能没有提供创建时间
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

  private convertRemoteMessages(remoteMessages: any[]): ChatMessage[] {
    return remoteMessages.map(msg => ({
      [msg.role === 'user' ? 'HUMAN' : 'AI']: msg.content,
      id: msg.id || msg.dataId,
      feedback: msg.feedback,
      timestamp: Date.now(),
      raw: msg.raw,
    }));
  }

  private mergeSessionData(local: ChatSession, remote: FastGPTChatHistoryDetail): ChatSession {
    const currentVersion = (local.metadata?.version as number) || 0;
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

  private extractVersionFromRemoteData(remote: FastGPTChatHistoryDetail): number {
    // 从远程数据中提取版本信息
    return (remote.metadata?.version as number) || 1;  // 修复：明确类型转换
  }

  private calculateChecksum(data: any): string {
    // 简单的校验和计算
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  private async getLocalSyncStatus(sessionId: string): Promise<SyncStatus | null> {
    const key = `sync:${sessionId}`;
    const syncData = await this.indexedDBProvider.get<{status: SyncStatus}>(key);
    return syncData?.status || null;
  }

  private async handleConflict(conflict: SyncConflict): Promise<void> {
    // 根据策略自动处理冲突
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
        // 通知UI处理冲突
        this.syncConflictCallbacks.forEach(callback => callback(conflict));
        break;
    }
  }

  private async applyLocalResolution(sessionId: string, _resolution: ConflictResolution): Promise<void> {
    // 本地数据获胜，无需额外操作
    console.log(`应用本地解决方案: ${sessionId}`);
  }

  private async applyRemoteResolution(sessionId: string, _resolution: ConflictResolution): Promise<void> {
    // 远程数据获胜，更新本地
    const remoteData = await this.getRemoteSession(sessionId);
    if (remoteData) {
      const localSession = this.convertRemoteToLocal(remoteData);
      await this.indexedDBProvider.set(sessionId, localSession);
      await this.memoryProvider.set(sessionId, localSession);
    }
  }

  private async applyMergedResolution(sessionId: string, resolution: ConflictResolution): Promise<void> {
    // 合并数据
    if (resolution.mergedData) {
      await this.indexedDBProvider.set(sessionId, resolution.mergedData);
      await this.memoryProvider.set(sessionId, resolution.mergedData);
    }
  }

  private async markConflictResolved(sessionId: string): Promise<void> {
    const key = `conflict:${sessionId}`;
    await this.indexedDBProvider.set(key, {
      sessionId,
      resolved: true,
      resolvedAt: Date.now(),
    });
  }

  private async getRemoteIncrementalUpdates(agentId: string, since?: number): Promise<any[]> {
    try {
      // 使用FastGPT提供者的增量更新方法
      if ('getIncrementalUpdates' in this.fastgptProvider) {
        return await (this.fastgptProvider as any).getIncrementalUpdates(agentId, since);
      }
      return [];
    } catch (error) {
      console.error('获取远程增量更新失败:', error);
      return [];
    }
  }

  private async applySingleUpdate(update: SessionUpdate): Promise<void> {
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

  private reportProgress(progress: SyncProgress): void {
    this.syncProgressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('进度回调错误:', error);
      }
    });
  }

  private reportError(error: SyncError): void {
    this.syncErrorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('错误回调错误:', error);
      }
    });
  }

  // 公共方法：强制同步所有数据
  public async forceSyncAll(): Promise<BatchSyncResult> {
    // 临时禁用自动同步，避免冲突
    const originalAutoSync = this.syncPolicy.autoSync;
    this.syncPolicy.autoSync = false;

    try {
      return await this.syncAllSessions();
    } finally {
      // 恢复原始设置
      this.syncPolicy.autoSync = originalAutoSync;
    }
  }

  // 公共方法：获取同步统计信息
  public async getSyncStats(): Promise<{
    totalSessions: number;
    syncedSessions: number;
    pendingSessions: number;
    conflictedSessions: number;
    lastSyncTime: number;
  }> {
    // 获取所有会话的同步状态
    const localSessions = await this.indexedDBProvider.list<ChatSession>('session:');
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
      lastSyncTime: Date.now(), // 简化实现
    };
  }
}