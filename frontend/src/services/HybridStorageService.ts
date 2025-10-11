/**
 * 混合存储服务入口
 * 统一导出所有混合存储相关的服务和工具
 */

import {
  type HybridStorageConfig,
  CacheStrategy,
} from '@/types/hybrid-storage';

// 核心管理器
export { HybridStorageManager } from './storage/HybridStorageManager';

// 存储提供者
export { MemoryStorageProvider } from './storage/MemoryStorageProvider';
export { IndexedDBStorageProvider } from './storage/IndexedDBStorageProvider';
export { FastGPTStorageProvider } from './storage/FastGPTStorageProvider';

// 缓存管理
export { CacheManager } from './cache/CacheManager';

// 同步管理
export { SyncManager } from './sync/SyncManager';

// 监控服务
export { PerformanceMonitor, ErrorHandlingService, globalErrorHandler, globalPerformanceMonitor } from './monitoring';

// 类型定义
export type {
  // 核心类型
  StorageTier,
  SyncStatus,
  DataTemperature,

  // 存储接口
  IStorageProvider,
  ICacheManager,
  ISyncManager,
  IPerformanceMonitor,

  // 配置和选项
  StorageOptions,
  CacheOptions,
  SyncPolicy,
  HybridStorageConfig,

  // 数据结构
  CacheEntry,
  SessionMetadata,
  SyncConflict,
  SyncResult,
  BatchSyncResult,
  PerformanceReport,
  OptimizationSuggestion,

  // 缓存策略
  CacheStrategy,

  // 搜索和查询
  SearchQuery,

  // 统计信息
  StorageStats,
  CacheUsageStats,
  SyncMetrics,
  PerformanceAlert,
} from '@/types/hybrid-storage';

// React Hook导出
export { useHybridChatStore } from '@/store/HybridChatStore';

// 工具函数
export const createHybridStorageService = async (config?: Partial<HybridStorageConfig>) => {
  const { HybridStorageManager } = await import('./storage/HybridStorageManager');
  return new HybridStorageManager(config);
};

// 默认配置导出
export const defaultHybridStorageConfig: Partial<HybridStorageConfig> = {
  cache: {
    memory: {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      strategy: CacheStrategy.LRU,
      ttl: 30 * 60 * 1000, // 30分钟
    },
    indexedDB: {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      strategy: CacheStrategy.LFU,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7天
    },
  },
  sync: {
    autoSync: true,
    syncInterval: 5 * 60 * 1000, // 5分钟
    batchSize: 10,
    maxRetries: 3,
    conflictResolution: 'prompt' as const,
    compressData: true,
    deltaSync: true,
  },
  performance: {
    enableMonitoring: true,
    monitoringInterval: 30 * 1000, // 30秒
    enableOptimizations: true,
    compressionThreshold: 10 * 1024, // 10KB
  },
  storage: {
    enableEncryption: false,
    enableCompression: true,
    backupEnabled: false,
    cleanupInterval: 60 * 60 * 1000, // 1小时
  },
};

// 版本信息
export const HYBRID_STORAGE_VERSION = '1.0.0';