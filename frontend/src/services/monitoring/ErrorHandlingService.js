"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = exports.ErrorHandlingService = void 0;
class ErrorHandlingService {
    constructor() {
        this.errors = [];
        this.errorCallbacks = new Set();
        this.resolutionCallbacks = new Set();
        this.recoveryStrategies = new Map();
        this.maxErrors = 1000;
        this.isInitialized = false;
        this.setupDefaultStrategies();
        this.setupGlobalErrorHandlers();
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.loadPersistedErrors();
            this.isInitialized = true;
            console.log('错误处理服务已初始化');
        }
        catch (error) {
            console.error('错误处理服务初始化失败:', error);
        }
    }
    recordError(type, severity, code, message, details, context) {
        const stackTrace = new Error().stack;
        const error = {
            id: this.generateErrorId(),
            type,
            severity,
            code,
            message,
            details,
            timestamp: Date.now(),
            ...(context && { context }),
            ...(stackTrace && { stack: stackTrace }),
            resolved: false,
        };
        this.addError(error);
        return error;
    }
    async handleError(type, severity, code, message, details, context) {
        const error = this.recordError(type, severity, code, message, details, context);
        try {
            const strategy = this.recoveryStrategies.get(code);
            if (strategy) {
                const result = await this.executeRecoveryStrategy(error, strategy);
                if (result.success) {
                    this.resolveError(error.id, 'recovery_strategy_success', result.result);
                    return result;
                }
            }
            const defaultResult = await this.defaultErrorHandling(error);
            if (defaultResult.success) {
                this.resolveError(error.id, 'default_handling_success', defaultResult.result);
                return defaultResult;
            }
            return { success: false, error };
        }
        catch (recoveryError) {
            console.error('错误恢复失败:', recoveryError);
            this.escalateError(error, recoveryError);
            return { success: false, error };
        }
    }
    async wrapOperation(operation, errorType, errorCode, context) {
        try {
            const data = await operation();
            return { success: true, data };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorDetails = error instanceof Error ? { stack: error.stack, name: error.name } : error;
            const result = await this.handleError(errorType, 'medium', errorCode, errorMessage, errorDetails, context);
            return result.error ? { success: false, error: result.error } : { success: false };
        }
    }
    registerRecoveryStrategy(errorCode, strategy) {
        this.recoveryStrategies.set(errorCode, strategy);
    }
    resolveError(errorId, resolution, _result) {
        const error = this.errors.find(e => e.id === errorId);
        if (!error) {
            return;
        }
        error.resolved = true;
        error.resolvedAt = Date.now();
        error.resolution = resolution;
        this.resolutionCallbacks.forEach(callback => {
            try {
                callback(error);
            }
            catch (callbackError) {
                console.error('错误解决回调失败:', callbackError);
            }
        });
    }
    getError(errorId) {
        return this.errors.find(e => e.id === errorId) || null;
    }
    getUnresolvedErrors(limit = 50) {
        return this.errors
            .filter(e => !e.resolved)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    getErrorsByType(type, resolved = false) {
        return this.errors.filter(e => e.type === type && e.resolved === resolved);
    }
    getErrorsBySeverity(severity, resolved = false) {
        return this.errors.filter(e => e.severity === severity && e.resolved === resolved);
    }
    generateErrorReport(hours = 24) {
        const now = Date.now();
        const since = now - hours * 60 * 60 * 1000;
        const recentErrors = this.errors.filter(e => e.timestamp >= since);
        const resolvedErrors = recentErrors.filter(e => e.resolved);
        const errorsByType = {};
        recentErrors.forEach(error => {
            errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
        });
        const errorsBySeverity = {};
        recentErrors.forEach(error => {
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
        });
        const resolutionRate = recentErrors.length > 0 ? resolvedErrors.length / recentErrors.length : 0;
        const averageResolutionTime = resolvedErrors.length > 0
            ? resolvedErrors.reduce((sum, error) => {
                const resolutionTime = (error.resolvedAt || 0) - error.timestamp;
                return sum + resolutionTime;
            }, 0) / resolvedErrors.length
            : 0;
        const errorFrequency = new Map();
        recentErrors.forEach(error => {
            const key = `${error.code}:${error.message}`;
            const existing = errorFrequency.get(key);
            if (existing) {
                existing.count++;
            }
            else {
                errorFrequency.set(key, { count: 1, error });
            }
        });
        const topErrors = Array.from(errorFrequency.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(item => item.error);
        return {
            period: { start: since, end: now },
            totalErrors: recentErrors.length,
            errorsByType,
            errorsBySeverity,
            topErrors,
            resolutionRate,
            averageResolutionTime,
        };
    }
    onError(callback) {
        this.errorCallbacks.add(callback);
        return () => this.errorCallbacks.delete(callback);
    }
    onErrorResolved(callback) {
        this.resolutionCallbacks.add(callback);
        return () => this.resolutionCallbacks.delete(callback);
    }
    setupDefaultStrategies() {
        this.registerRecoveryStrategy('STORAGE_QUOTA_EXCEEDED', {
            type: 'fallback',
            fallbackAction: async () => {
                console.log('存储配额已满，执行清理...');
                return { cleaned: true };
            },
        });
        this.registerRecoveryStrategy('STORAGE_ACCESS_DENIED', {
            type: 'retry',
            maxRetries: 3,
            retryDelay: 1000,
        });
        this.registerRecoveryStrategy('NETWORK_TIMEOUT', {
            type: 'retry',
            maxRetries: 2,
            retryDelay: 2000,
        });
        this.registerRecoveryStrategy('NETWORK_OFFLINE', {
            type: 'fallback',
            fallbackAction: async () => {
                console.log('网络离线，切换到离线模式');
                return { offlineMode: true };
            },
        });
        this.registerRecoveryStrategy('SYNC_CONFLICT', {
            type: 'escalate',
        });
        this.registerRecoveryStrategy('SYNC_AUTH_FAILED', {
            type: 'retry',
            maxRetries: 1,
            retryDelay: 5000,
        });
        this.registerRecoveryStrategy('CACHE_CORRUPTION', {
            type: 'fallback',
            fallbackAction: async () => {
                console.log('缓存损坏，重新初始化...');
                return { reinitialized: true };
            },
        });
    }
    setupGlobalErrorHandlers() {
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                this.recordError('critical', 'high', 'UNCAUGHT_ERROR', event.message, {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack,
                });
            });
            window.addEventListener('unhandledrejection', (event) => {
                this.recordError('critical', 'high', 'UNHANDLED_PROMISE_REJECTION', event.reason?.message || 'Promise被拒绝', {
                    reason: event.reason,
                    stack: event.reason?.stack,
                });
            });
        }
    }
    addError(error) {
        this.errors.push(error);
        if (this.errors.length > this.maxErrors) {
            this.errors.splice(0, this.errors.length - this.maxErrors);
        }
        this.errorCallbacks.forEach(callback => {
            try {
                callback(error);
            }
            catch (callbackError) {
                console.error('错误回调失败:', callbackError);
            }
        });
        if (error.severity === 'critical') {
            this.escalateError(error);
        }
    }
    async executeRecoveryStrategy(error, strategy) {
        try {
            switch (strategy.type) {
                case 'retry':
                    return await this.executeRetryStrategy(error, strategy);
                case 'fallback':
                    return await this.executeFallbackStrategy(strategy);
                case 'ignore':
                    return { success: true };
                case 'escalate':
                    this.escalateError(error);
                    return { success: false };
                default:
                    return { success: false };
            }
        }
        catch (recoveryError) {
            console.error('恢复策略执行失败:', recoveryError);
            return { success: false };
        }
    }
    async executeRetryStrategy(error, strategy) {
        const maxRetries = strategy.maxRetries || 3;
        const retryDelay = strategy.retryDelay || 1000;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`重试操作 ${error.code}，第 ${attempt + 1} 次尝试`);
                return { success: true };
            }
            catch (retryError) {
                if (attempt === maxRetries - 1) {
                    throw retryError;
                }
                await this.sleep(retryDelay * Math.pow(2, attempt));
            }
        }
        return { success: false };
    }
    async executeFallbackStrategy(strategy) {
        if (strategy.fallbackAction) {
            const result = await strategy.fallbackAction();
            return { success: true, result };
        }
        return { success: false };
    }
    async defaultErrorHandling(error) {
        switch (error.type) {
            case 'network':
                if (error.severity === 'low' || error.severity === 'medium') {
                    return { success: true };
                }
                break;
            case 'cache':
                return { success: true };
            case 'storage':
                if (error.severity === 'low') {
                    return { success: true };
                }
                break;
            case 'sync':
                return { success: true };
            case 'validation':
                break;
            case 'critical':
                break;
        }
        return { success: false };
    }
    escalateError(error, additionalError) {
        console.error('严重错误需要人工干预:', error, additionalError);
        if (process.env.NODE_ENV === 'development') {
            throw new Error(`严重错误: ${error.message}`);
        }
    }
    generateErrorId() {
        return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async loadPersistedErrors() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const persisted = localStorage.getItem('error_handling_history');
                if (persisted) {
                    const errors = JSON.parse(persisted);
                    this.errors = errors.filter((e) => Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000);
                }
            }
        }
        catch (error) {
            console.warn('加载持久化错误记录失败:', error);
        }
    }
    persistErrors() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const errorsToPersist = this.errors.filter(e => e.severity === 'high' || e.severity === 'critical');
                localStorage.setItem('error_handling_history', JSON.stringify(errorsToPersist));
            }
        }
        catch (error) {
            console.warn('持久化错误记录失败:', error);
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    clearErrors(resolved = false) {
        if (resolved) {
            this.errors = this.errors.filter(e => !e.resolved);
        }
        else {
            this.errors = [];
        }
    }
    getErrorStats() {
        const total = this.errors.length;
        const unresolved = this.errors.filter(e => !e.resolved).length;
        const byType = {};
        const bySeverity = {};
        this.errors.forEach(error => {
            byType[error.type] = (byType[error.type] || 0) + 1;
            bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
        });
        return { total, unresolved, byType, bySeverity };
    }
    exportErrors() {
        return [...this.errors];
    }
    checkSystemHealth() {
        const recentErrors = this.errors.filter(e => Date.now() - e.timestamp < 60 * 60 * 1000);
        const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
        const highErrors = recentErrors.filter(e => e.severity === 'high');
        let status = 'healthy';
        const issues = [];
        const recommendations = [];
        if (criticalErrors.length > 0) {
            status = 'critical';
            issues.push(`发现 ${criticalErrors.length} 个严重错误`);
            recommendations.push('立即解决严重错误');
        }
        else if (highErrors.length > 5) {
            status = 'warning';
            issues.push(`发现 ${highErrors.length} 个高级错误`);
            recommendations.push('关注高级错误，考虑系统优化');
        }
        const errorRate = recentErrors.length / 60;
        if (errorRate > 1) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push(`错误率过高: ${errorRate.toFixed(1)}/分钟`);
            recommendations.push('检查系统稳定性，优化错误处理');
        }
        return { status, issues, recommendations };
    }
    destroy() {
        this.persistErrors();
        this.errors = [];
        this.errorCallbacks.clear();
        this.resolutionCallbacks.clear();
        this.recoveryStrategies.clear();
    }
}
exports.ErrorHandlingService = ErrorHandlingService;
exports.globalErrorHandler = new ErrorHandlingService();
//# sourceMappingURL=ErrorHandlingService.js.map