/**
 * Enhanced Type Definitions for Type Safety Enhancement
 *
 * This file provides concrete types to replace 'any' usage throughout the project
 */

// 基础JSON类型定义 - 与主index.ts保持一致
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonPrimitive = string | number | boolean | null | undefined;
export type JsonArray = JsonPrimitive | JsonObject | JsonArray[];
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

// 简化的类型定义，避免复杂的嵌套对象和JsonValue约束问题
export type ErrorHandler = (error: EnhancedError) => void;
export type AsyncErrorHandler = (error: EnhancedError) => Promise<void>;

/**
 * Structured log metadata with concrete typing
 */
export interface LogMetadata {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ipAddress?: string;
  agentId?: string;
  chatId?: string;
  sessionId?: string;
  action?: string;
  suspicious?: boolean;
  threat?: string;
  event?: string;
  error?: EnhancedError;
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

/**
 * Enhanced Express Request with strong typing
 */
export interface EnhancedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  body: JsonValue;
  requestId?: string;
  user?: JsonObject;
  protectionContext?: JsonObject;
  timestamp: number;
  duration?: number;
}

/**
 * Enhanced Express Response with strong typing
 */
export interface EnhancedResponse {
  statusCode: number;
  headersSent: boolean;
  locals: Record<string, JsonValue>;
  data: JsonValue;
  requestId?: string;
  timestamp: number;
  duration?: number;
}

// 类型守卫函数
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' &&
         value !== null &&
         !Array.isArray(value) &&
         Object.entries(value).every(([_, v]) => isJsonValue(v));
}

export function isJsonArray(value: unknown): value is JsonArray {
  return Array.isArray(value) && value.every(isJsonValue);
}
