interface ErrorInfo {
    id: string;
    type: 'storage' | 'sync' | 'cache' | 'network' | 'validation' | 'critical';
    severity: 'low' | 'medium' | 'high' | 'critical';
    code: string;
    message: string;
    details?: any;
    timestamp: number;
    context?: {
        operation?: string;
        sessionId?: string;
        agentId?: string;
        tier?: string;
        retryCount?: number;
    };
    stack?: string;
    resolved: boolean;
    resolvedAt?: number;
    resolution?: string;
}
interface ErrorRecoveryStrategy {
    type: 'retry' | 'fallback' | 'ignore' | 'escalate';
    maxRetries?: number;
    retryDelay?: number;
    fallbackAction?: () => Promise<any>;
}
interface ErrorReport {
    period: {
        start: number;
        end: number;
    };
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    topErrors: ErrorInfo[];
    resolutionRate: number;
    averageResolutionTime: number;
}
export declare class ErrorHandlingService {
    private errors;
    private errorCallbacks;
    private resolutionCallbacks;
    private recoveryStrategies;
    private maxErrors;
    private isInitialized;
    constructor();
    initialize(): Promise<void>;
    recordError(type: ErrorInfo['type'], severity: ErrorInfo['severity'], code: string, message: string, details?: any, context?: ErrorInfo['context']): ErrorInfo;
    handleError(type: ErrorInfo['type'], severity: ErrorInfo['severity'], code: string, message: string, details?: any, context?: ErrorInfo['context']): Promise<{
        success: boolean;
        result?: any;
        error?: ErrorInfo;
    }>;
    wrapOperation<T>(operation: () => Promise<T>, errorType: ErrorInfo['type'], errorCode: string, context?: ErrorInfo['context']): Promise<{
        success: boolean;
        data?: T;
        error?: ErrorInfo;
    }>;
    registerRecoveryStrategy(errorCode: string, strategy: ErrorRecoveryStrategy): void;
    resolveError(errorId: string, resolution: string, _result?: any): void;
    getError(errorId: string): ErrorInfo | null;
    getUnresolvedErrors(limit?: number): ErrorInfo[];
    getErrorsByType(type: ErrorInfo['type'], resolved?: boolean): ErrorInfo[];
    getErrorsBySeverity(severity: ErrorInfo['severity'], resolved?: boolean): ErrorInfo[];
    generateErrorReport(hours?: number): ErrorReport;
    onError(callback: (error: ErrorInfo) => void): () => void;
    onErrorResolved(callback: (error: ErrorInfo) => void): () => void;
    private setupDefaultStrategies;
    private setupGlobalErrorHandlers;
    private addError;
    private executeRecoveryStrategy;
    private executeRetryStrategy;
    private executeFallbackStrategy;
    private defaultErrorHandling;
    private escalateError;
    private generateErrorId;
    private loadPersistedErrors;
    private persistErrors;
    private sleep;
    clearErrors(resolved?: boolean): void;
    getErrorStats(): {
        total: number;
        unresolved: number;
        byType: Record<string, number>;
        bySeverity: Record<string, number>;
    };
    exportErrors(): ErrorInfo[];
    checkSystemHealth(): {
        status: 'healthy' | 'warning' | 'critical';
        issues: string[];
        recommendations: string[];
    };
    destroy(): void;
}
export declare const globalErrorHandler: ErrorHandlingService;
export {};
//# sourceMappingURL=ErrorHandlingService.d.ts.map