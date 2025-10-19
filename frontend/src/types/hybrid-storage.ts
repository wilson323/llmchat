/**
 * 混合存储架构类型定义
 * 为FastGPT聊天应用提供智能缓存和同步机制
 */

// ==================== 核心数据类型 ====================

/**
 * 存储层级枚举
 */
export enum StorageTier {
  MEMORY = 'memory',           // 内存缓存 - 热数据
  INDEXED_DB = 'indexed_db',    // IndexedDB - 温数据
  FASTGPT_REMOTE = 'fastgpt'    // FastGPT远程 - 冷数据/源数据
}

/**
 * 数据同步状态
 */
export enum SyncStatus {
  SYNCED = 'synced',           // 已同步
  PENDING = 'pending',         // 待同步
  CONFLICT = 'conflict',       // 冲突
  OFFLINE = 'offline',         // 离线模式
  ERROR = 'error'              // 同步错误
}

/**
 * 缓存策略
 */
export enum CacheStrategy {
  LRU = 'lru',                 // 最近最少使用
  LFU = 'lfu',                 // 最少使用频率
  TTL = 'ttl',                 // 时间到期
  ADAPTIVE = 'adaptive'        // 自适应策略
}

/**
 * 数据温度分级
 */
export enum DataTemperature {
  HOT = 'hot',                 // 热数据 - 频繁访问
  WARM = 'warm',               // 温数据 - 偶尔访问
  COLD = 'cold'                // 冷数据 - 很少访问
}

// ==================== 会话相关类型 ====================

/**
 * 增强的会话元数据
 */
export interface SessionMetadata {
  id: string;
  agentId: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  syncStatus: SyncStatus;
  dataTemperature: DataTemperature;
  storageTier: StorageTier;
  fastgptChatId?: string;      // FastGPT原始chatId
  version: number;             // 数据版本号（用于冲突检测）
  checksum?: string;           // 数据校验和
  size: number;                // 会话数据大小（字节）
  isPinned: boolean;
  tags: string[];
  isArchived: boolean;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  temperature: DataTemperature;
  expiresAt?: number;
  size: number;
  storageTier: StorageTier;
  syncStatus: SyncStatus;
}

/**
 * 同步冲突信息
 */
export interface SyncConflict {
  sessionId: string;
  localVersion: number;
  remoteVersion: number;
  localData: any;
  remoteData: any;
  conflictType: 'update' | 'delete' | 'merge';
  resolved: boolean;
}

// ==================== 存储操作接口 ====================

/**
 * 基础存储接口
 */
export interface IStorageProvider {
  readonly name: string;
  readonly tier: StorageTier;
  readonly isAvailable: boolean;

  // 基础CRUD操作
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: StorageOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // 批量操作
  mget<T>(keys: string[]): Promise<Map<string, T | null>>;
  mset<T>(entries: Array<{key: string, value: T, options?: StorageOptions}>): Promise<void>;
  mdelete(keys: string[]): Promise<boolean>;

  // 查询和索引
  list<T>(prefix?: string, limit?: number): Promise<Array<{key: string, value: T}>>;
  search<T>(query: SearchQuery): Promise<Array<{key: string, value: T, score: number}>>;

  // 生命周期
  init(): Promise<void>;
  destroy(): Promise<void>;
  getStats(): Promise<StorageStats>;
}

/**
 * 存储操作选项
 */
export interface StorageOptions {
  expiresAt?: number;
  priority?: number;
  metadata?: Record<string, unknown>;
  compress?: boolean;
  encrypt?: boolean;
}

/**
 * 搜索查询
 */
export interface SearchQuery {
  text?: string;
  agentId?: string;
  dateRange?: {start: number, end: number};
  tags?: string[];
  messageCount?: {min?: number, max?: number};
  limit?: number;
  offset?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'lastAccessedAt' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  averageAccessTime: number;
  oldestEntry: number;
  newestEntry: number;
}

// ==================== 缓存管理接口 ====================

/**
 * 缓存管理器接口
 */
export interface ICacheManager {
  // 缓存操作
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // 批量操作
  mget<T>(keys: string[]): Promise<Map<string, T | null>>;
  mset<T>(entries: Array<{key: string, value: T, options?: CacheOptions}>): Promise<void>;

  // 缓存策略
  setStrategy(strategy: CacheStrategy): void;
  getStrategy(): CacheStrategy;

  // 温度管理
  promoteToHot(key: string): Promise<void>;
  demoteToCold(key: string): Promise<void>;
  getTemperature(key: string): Promise<DataTemperature>;

  // 预加载
  preload(keys: string[]): Promise<void>;
  preloadAgentSessions(agentId: string, limit?: number): Promise<void>;

  // 清理和优化
  cleanup(): Promise<void>;
  optimize(): Promise<void>;
  getUsageStats(): Promise<CacheUsageStats>;
}

/**
 * 缓存选项
 */
export interface CacheOptions extends StorageOptions {
  strategy?: CacheStrategy;
  temperature?: DataTemperature;
  preloadRelated?: boolean;
  compressThreshold?: number;
}

/**
 * 缓存使用统计
 */
export interface CacheUsageStats {
  memoryUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  indexedDBUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  cacheEntries: {
    hot: number;
    warm: number;
    cold: number;
    total: number;
  };
  performance: {
    hitRate: number;
    averageResponseTime: number;
    evictionRate: number;
  };
}

// ==================== 同步管理接口 ====================

/**
 * 同步管理器接口
 */
export interface ISyncManager {
  // 同步状态
  getSyncStatus(sessionId: string): Promise<SyncStatus>;
  setSyncStatus(sessionId: string, status: SyncStatus): Promise<void>;
  getPendingSyncSessions(): Promise<string[]>;

  // 同步操作
  syncSession(sessionId: string): Promise<SyncResult>;
  syncAgentSessions(agentId: string): Promise<BatchSyncResult>;
  syncAllSessions(): Promise<BatchSyncResult>;

  // 冲突处理
  detectConflicts(sessionId: string): Promise<SyncConflict[]>;
  resolveConflict(sessionId: string, resolution: ConflictResolution): Promise<boolean>;

  // 增量同步
  getIncrementalUpdates(agentId: string, since?: number): Promise<SessionUpdate[]>;
  applyIncrementalUpdates(updates: SessionUpdate[]): Promise<void>;

  // 离线支持
  enableOfflineMode(): Promise<void>;
  disableOfflineMode(): Promise<void>;
  isOfflineMode(): Promise<boolean>;

  // 同步策略
  setSyncPolicy(policy: SyncPolicy): void;
  getSyncPolicy(): SyncPolicy;

  // 监听器
  onSyncProgress(callback: (progress: SyncProgress) => void): () => void;
  onSyncConflict(callback: (conflict: SyncConflict) => void): () => void;
  onSyncError(callback: (error: SyncError) => void): () => void;
  // 统计信息
  getSyncStats(): Promise<{
    totalSessions: number;
    syncedSessions: number;
    pendingSessions: number;
    conflictedSessions: number;
    lastSyncTime: number;
  }>;
}

/**
 * 同步结果
 */
export interface SyncResult {
  sessionId: string;
  success: boolean;
  error?: string;
  changes: {
    created: number;
    updated: number;
    deleted: number;
    conflicts: number;
  };
  duration: number;
}

/**
 * 批量同步结果
 */
export interface BatchSyncResult {
  totalSessions: number;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  results: SyncResult[];
  duration: number;
}

/**
 * 冲突解决方案
 */
export interface ConflictResolution {
  sessionId: string;
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  mergedData?: any;
  resolvedAt: number;
}

/**
 * 会话更新
 */
export interface SessionUpdate {
  sessionId: string;
  type: 'create' | 'update' | 'delete';
  data: any;
  version: number;
  timestamp: number;
  checksum: string;
}

/**
 * 同步策略
 */
export interface SyncPolicy {
  autoSync: boolean;
  syncInterval: number;        // 自动同步间隔（毫秒）
  batchSize: number;           // 批量同步大小
  maxRetries: number;          // 最大重试次数
  conflictResolution: 'local_wins' | 'remote_wins' | 'prompt';
  compressData: boolean;       // 是否压缩传输数据
  deltaSync: boolean;          // 是否启用增量同步
}

/**
 * 同步进度
 */
export interface SyncProgress {
  sessionId?: string;
  agentId?: string;
  stage: 'starting' | 'fetching' | 'processing' | 'uploading' | 'completing' | 'error';
  progress: number;            // 0-100
  current: number;
  total: number;
  message: string;
}

/**
 * 同步错误
 */
export interface SyncError {
  sessionId?: string;
  agentId?: string;
  error: string;
  code: string;
  timestamp: number;
  retryable: boolean;
}

// ==================== 性能监控接口 ====================

/**
 * 性能监控器接口
 */
export interface IPerformanceMonitor {
  // 指标收集
  recordAccess(key: string, tier: StorageTier, duration: number, hit: boolean): void;
  recordSync(operation: string, duration: number, success: boolean, size?: number): void;
  recordCacheEviction(key: string, reason: string, tier: StorageTier): void;

  // 统计报告
  getPerformanceReport(): Promise<PerformanceReport>;
  getStorageMetrics(): Promise<StorageMetrics>;
  getSyncMetrics(): Promise<SyncMetrics>;

  // 实时监控
  startRealTimeMonitoring(): void;
  stopRealTimeMonitoring(): void;
  onPerformanceAlert(callback: (alert: PerformanceAlert) => void): () => void;

  // 优化建议
  getOptimizationSuggestions(): Promise<OptimizationSuggestion[]>;
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  generatedAt: number;
  period: {start: number, end: number};
  storage: StorageMetrics;
  sync: SyncMetrics;
  cache: CacheUsageStats;
  alerts: PerformanceAlert[];
  suggestions: OptimizationSuggestion[];
}

/**
 * 存储指标
 */
export interface StorageMetrics {
  memory: {
    hitRate: number;
    averageResponseTime: number;
    totalOperations: number;
    errorRate: number;
  };
  indexedDB: {
    hitRate: number;
    averageResponseTime: number;
    totalOperations: number;
    errorRate: number;
    size: number;
    entryCount: number;
  };
  fastgpt: {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    bandwidthUsed: number;
    cacheHitRate: number;
  };
}

/**
 * 同步指标
 */
export interface SyncMetrics {
  totalSyncs: number;
  successRate: number;
  averageDuration: number;
  conflictRate: number;
  dataTransferred: number;
  lastSyncTime: number;
  pendingOperations: number;
}

/**
 * 性能告警
 */
export interface PerformanceAlert {
  type: 'warning' | 'error' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  suggestions: string[];
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  category: 'cache' | 'sync' | 'storage' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string;
}

// ==================== 配置接口 ====================

/**
 * 混合存储配置
 */
export interface HybridStorageConfig {
  // 缓存配置
  cache: {
    memory: {
      maxSize: number;         // 最大内存使用（字节）
      maxEntries: number;      // 最大条目数
      strategy: CacheStrategy;
      ttl: number;             // 默认TTL（毫秒）
    };
    indexedDB: {
      maxSize: number;         // 最大存储大小（字节）
      maxEntries: number;
      strategy: CacheStrategy;
      ttl: number;
    };
  };

  // 同步配置
  sync: SyncPolicy;

  // 性能配置
  performance: {
    enableMonitoring: boolean;
    monitoringInterval: number;  // 监控间隔（毫秒）
    enableOptimizations: boolean;
    compressionThreshold: number; // 压缩阈值（字节）
  };

  // 存储配置
  storage: {
    enableEncryption: boolean;
    enableCompression: boolean;
    backupEnabled: boolean;
    cleanupInterval: number;     // 清理间隔（毫秒）
  };
}