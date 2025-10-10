/**
 * Enhanced Type Definitions for Type Safety Enhancement
 *
 * This file provides concrete types to replace 'any' usage throughout the project
 */

// 基础JSON类型定义
export interface JsonObject {
  [key: string]: JsonPrimitive | JsonObject | JsonArray;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = (JsonPrimitive | JsonObject | JsonArray)[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// ============================================================================
// Enhanced Error Types
// ============================================================================

/**
 * Enhanced error type with structured information
 */
export interface EnhancedError {
  name: string;
  message: string;
  code?: string | number;
  stack?: string;
  details?: JsonValue;
  category?: 'validation' | 'authentication' | 'authorization' | 'network' | 'external' | 'internal';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: string;
  requestId?: string;
  userId?: string;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (error: EnhancedError) => void;

/**
 * Async error handler function type
 */
export type AsyncErrorHandler = (error: EnhancedError) => Promise<void>;

// ============================================================================
// Enhanced Logging Types
// ============================================================================

/**
 * Structured log metadata with concrete typing
 */
export interface LogMetadata {
  // Request context
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ipAddress?: string;

  // Performance context
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  operation?: string;

  // Business context
  agentId?: string;
  chatId?: string;
  sessionId?: string;
  action?: string;

  // Security context
  suspicious?: boolean;
  threat?: string;
  event?: string;

  // Error context
  error?: EnhancedError;

  // Custom context - strongly typed but extensible
  custom?: JsonObject;
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  metadata?: LogMetadata;
}

/**
 * Logger interface with strong typing
 */
export interface Logger {
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, error?: EnhancedError | LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
}

// ============================================================================
// Enhanced Request/Response Types
// ============================================================================

/**
 * Enhanced Express Request with strong typing
 */
export interface EnhancedRequest {
  // Standard Express Request properties
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body: JsonValue;

  // Enhanced properties
  requestId?: string;
  user?: {
    id: string;
    email: string;
    role?: string;
    [key: string]: JsonValue;
  };
  protectionContext?: {
    validated: boolean;
    riskScore: number;
    [key: string]: JsonValue;
  };

  // Metadata
  timestamp: number;
  duration?: number;
}

/**
 * Enhanced Express Response with strong typing
 */
export interface EnhancedResponse {
  // Standard Express Response properties
  statusCode: number;
  headersSent: boolean;
  locals: Record<string, JsonValue>;

  // Enhanced methods
  sendSSEEvent(event: string, data: JsonValue): void;
  endSSE(): void;

  // Metadata
  startTime: number;
  duration?: number;
}

/**
 * Request handler function type
 */
export type RequestHandler<T = JsonValue> = (
  req: EnhancedRequest,
  res: EnhancedResponse
) => Promise<T>;

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  req: EnhancedRequest,
  res: EnhancedResponse,
  next: (error?: EnhancedError) => void
) => void;

// ============================================================================
// Enhanced Service Types
// ============================================================================

/**
 * Service configuration with strong typing
 */
export interface ServiceConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  timeout: number;
  retries: number;
  apiKey?: string;
  endpoint?: string;
  options?: JsonObject;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  responseTime?: number;
  error?: EnhancedError;
  details?: JsonObject;
}

/**
 * Database configuration with enhanced typing
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: {
    enabled: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  pool?: {
    min: number;
    max: number;
    idleTimeoutMillis?: number;
  };
  encryption?: {
    enabled: boolean;
    key?: string;
    algorithm?: string;
  };
}

// ============================================================================
// Enhanced Provider Types
// ============================================================================

/**
 * Base provider interface
 */
export interface BaseProvider {
  name: string;
  version: string;
  capabilities: string[];
  config: JsonObject;
  healthCheck(): Promise<ServiceHealth>;
}

/**
 * AI Provider request data
 */
export interface AIProviderRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: JsonObject;
  }>;
  options: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
    model?: string;
    [key: string]: JsonValue;
  };
  metadata: {
    requestId: string;
    timestamp: number;
    agentId: string;
    userId?: string;
  };
}

/**
 * AI Provider response data
 */
export interface AIProviderResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: JsonObject;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata: JsonObject;
}

// ============================================================================
// Enhanced Cache Types
// ============================================================================

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = JsonValue> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  metadata?: {
    source: string;
    version: string;
    tags?: string[];
    [key: string]: JsonValue;
  };
}

/**
 * Cache provider interface
 */
export interface CacheProvider {
  get<T = JsonValue>(key: string): Promise<T | null>;
  set<T = JsonValue>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
}

// ============================================================================
// Enhanced Monitoring Types
// ============================================================================

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu?: {
    usage: number;
    loadAverage: number[];
  };
  metadata?: JsonObject;
}

/**
 * Monitoring event
 */
export interface MonitoringEvent {
  type: 'performance' | 'error' | 'security' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data: JsonValue;
  tags?: string[];
  context?: JsonObject;
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard for EnhancedError
 */
export function isEnhancedError(error: unknown): error is EnhancedError {
  return typeof error === 'object' &&
         error !== null &&
         'name' in error &&
         'message' in error &&
         typeof (error as any).name === 'string' &&
         typeof (error as any).message === 'string';
}

/**
 * Type guard for LogMetadata
 */
export function isLogMetadata(obj: unknown): obj is LogMetadata {
  return typeof obj === 'object' && obj !== null;
}

/**
 * Type guard for JsonObject
 */
export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' &&
         value !== null &&
         !Array.isArray(value) &&
         Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Safe type converter for unknown to JsonValue
 */
export function toJsonValue(value: unknown, defaultValue: JsonValue = null): JsonValue {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => toJsonValue(item));
  }

  if (typeof value === 'object') {
    const result: JsonObject = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toJsonValue(val);
    }
    return result;
  }

  // Handle symbols, functions, etc.
  return String(value);
}

/**
 * Enhanced error creator
 */
export function createEnhancedError(
  name: string,
  message: string,
  options: {
    code?: string | number;
    details?: JsonValue;
    category?: EnhancedError['category'];
    severity?: EnhancedError['severity'];
    cause?: Error;
    requestId?: string;
    userId?: string;
  } = {}
): EnhancedError {
  const error: EnhancedError = {
    name,
    message,
    timestamp: new Date().toISOString(),
    ...(options.code !== undefined && { code: options.code }),
    ...(options.details !== undefined && { details: options.details }),
    ...(options.category !== undefined && { category: options.category }),
    ...(options.severity !== undefined && { severity: options.severity }),
    ...(options.requestId !== undefined && { requestId: options.requestId }),
    ...(options.userId !== undefined && { userId: options.userId })
  };

  if (options.cause) {
    (error as any).stack = options.cause.stack;
  }

  return error;
}

/**
 * Safe unknown error converter
 */
export function toEnhancedError(error: unknown): EnhancedError {
  if (isEnhancedError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const errorCode = (error as { code?: string | number }).code;
    return createEnhancedError(error.name, error.message, {
      ...(errorCode !== undefined && { code: errorCode }),
      cause: error
    });
  }

  if (typeof error === 'string') {
    return createEnhancedError('UnknownError', error);
  }

  return createEnhancedError('UnknownError', 'An unknown error occurred', {
    details: toJsonValue(error)
  });
}