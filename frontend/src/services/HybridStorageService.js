"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HYBRID_STORAGE_VERSION = exports.defaultHybridStorageConfig = exports.createHybridStorageService = exports.useHybridChatStore = exports.globalPerformanceMonitor = exports.globalErrorHandler = exports.ErrorHandlingService = exports.PerformanceMonitor = exports.SyncManager = exports.CacheManager = exports.FastGPTStorageProvider = exports.IndexedDBStorageProvider = exports.MemoryStorageProvider = exports.HybridStorageManager = void 0;
const hybrid_storage_1 = require("@/types/hybrid-storage");
var HybridStorageManager_1 = require("./storage/HybridStorageManager");
Object.defineProperty(exports, "HybridStorageManager", { enumerable: true, get: function () { return HybridStorageManager_1.HybridStorageManager; } });
var MemoryStorageProvider_1 = require("./storage/MemoryStorageProvider");
Object.defineProperty(exports, "MemoryStorageProvider", { enumerable: true, get: function () { return MemoryStorageProvider_1.MemoryStorageProvider; } });
var IndexedDBStorageProvider_1 = require("./storage/IndexedDBStorageProvider");
Object.defineProperty(exports, "IndexedDBStorageProvider", { enumerable: true, get: function () { return IndexedDBStorageProvider_1.IndexedDBStorageProvider; } });
var FastGPTStorageProvider_1 = require("./storage/FastGPTStorageProvider");
Object.defineProperty(exports, "FastGPTStorageProvider", { enumerable: true, get: function () { return FastGPTStorageProvider_1.FastGPTStorageProvider; } });
var CacheManager_1 = require("./cache/CacheManager");
Object.defineProperty(exports, "CacheManager", { enumerable: true, get: function () { return CacheManager_1.CacheManager; } });
var SyncManager_1 = require("./sync/SyncManager");
Object.defineProperty(exports, "SyncManager", { enumerable: true, get: function () { return SyncManager_1.SyncManager; } });
var monitoring_1 = require("./monitoring");
Object.defineProperty(exports, "PerformanceMonitor", { enumerable: true, get: function () { return monitoring_1.PerformanceMonitor; } });
Object.defineProperty(exports, "ErrorHandlingService", { enumerable: true, get: function () { return monitoring_1.ErrorHandlingService; } });
Object.defineProperty(exports, "globalErrorHandler", { enumerable: true, get: function () { return monitoring_1.globalErrorHandler; } });
Object.defineProperty(exports, "globalPerformanceMonitor", { enumerable: true, get: function () { return monitoring_1.globalPerformanceMonitor; } });
var HybridChatStore_1 = require("@/store/HybridChatStore");
Object.defineProperty(exports, "useHybridChatStore", { enumerable: true, get: function () { return HybridChatStore_1.useHybridChatStore; } });
const createHybridStorageService = async (config) => {
    const { HybridStorageManager } = await Promise.resolve().then(() => __importStar(require('./storage/HybridStorageManager')));
    return new HybridStorageManager(config);
};
exports.createHybridStorageService = createHybridStorageService;
exports.defaultHybridStorageConfig = {
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
};
exports.HYBRID_STORAGE_VERSION = '1.0.0';
//# sourceMappingURL=HybridStorageService.js.map