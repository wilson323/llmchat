/**
 * 消息队列相关类型定义
 */

export interface QueueMessage {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: MessagePriority;
  attempts: number;
  maxAttempts: number;
  delay: number;
  createdAt: Date;
  scheduledAt?: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20
}

export enum QueueStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DRAINING = 'draining',
  STOPPED = 'stopped'
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed'
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  removeOnComplete: number;
  removeOnFail: number;
  defaultPriority: MessagePriority;
  stalledInterval: number;
  maxStalledCount: number;
  delayOnFail: boolean;
  deadLetterQueue?: string;
}

export interface QueueStats {
  name: string;
  status: QueueStatus;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processing: number;
  concurrency: number;
  maxConcurrency: number;
  throughput: number;
  avgProcessingTime: number;
  errorRate: number;
  lastProcessedAt?: Date;
  createdAt: Date;
}

export interface QueueOptions {
  priority?: MessagePriority;
  delay?: number;
  attempts?: number;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  backoff?: BackoffStrategy;
  metadata?: Record<string, unknown>;
  deadLetterQueue?: string;
}

export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  CUSTOM = 'custom'
}

export interface BackoffOptions {
  strategy: BackoffStrategy;
  delay: number;
  maxDelay?: number;
  multiplier?: number;
  jitter?: boolean;
  customFn?: (attempt: number, error: Error) => number;
}

export interface QueueJob<T = Record<string, unknown>> {
  id: string;
  name: string;
  data: T;
  opts: QueueOptions;
  createdAt: Date;
  processedOn?: Date;
  finishedOn?: Date;
  failedAt?: Date;
  attemptsMade: number;
  progress?: number;
  returnvalue?: unknown;
  failedReason?: string;
}

export interface QueueProcessor<T = Record<string, unknown>> {
  (job: QueueJob<T>): Promise<unknown>;
}

export interface QueueMiddleware {
  name: string;
  beforeProcess?: (job: QueueJob) => Promise<void> | void;
  afterProcess?: (job: QueueJob, result: unknown) => Promise<void> | void;
  onError?: (job: QueueJob, error: Error) => Promise<void> | void;
  onFailed?: (job: QueueJob, error: Error) => Promise<void> | void;
  onCompleted?: (job: QueueJob, result: unknown) => Promise<void> | void;
}

export interface QueueEvent {
  type: 'job:active' | 'job:stalled' | 'job:progress' | 'job:completed' | 'job:failed' | 'queue:paused' | 'queue:resumed';
  jobId: string;
  queueName: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface QueueManagerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  defaultConcurrency?: number;
  stalledInterval?: number;
  maxStalledCount?: number;
  settings?: Record<string, QueueConfig>;
  enableMetrics?: boolean;
  enableEvents?: boolean;
  metricsInterval?: number;
  batchSize?: number;
  enablePipelining?: boolean;
  enableTransactions?: boolean;
  memoryOptimization?: {
    enabled?: boolean;
    autoOptimization?: boolean;
    threshold?: number;
    intervalMs?: number;
    maxHeapSizeMB?: number;
    maxRSSSizeMB?: number;
  };
}

// 预定义的队列类型
export const QUEUE_TYPES = {
  CHAT_PROCESSING: 'chat-processing',
  EMAIL_NOTIFICATION: 'email-notification',
  WEBHOOK_PROCESSING: 'webhook-processing',
  DATA_SYNC: 'data-sync',
  LOG_PROCESSING: 'log-processing',
  REPORT_GENERATION: 'report-generation',
  CLEANUP_TASKS: 'cleanup-tasks',
  AUDIT_LOGS: 'audit-logs',
  PERFORMANCE_METRICS: 'performance-metrics',
  HEALTH_CHECKS: 'health-checks'
} as const;

export type QueueType = typeof QUEUE_TYPES[keyof typeof QUEUE_TYPES];

// 预定义的任务类型
export const JOB_TYPES = {
  CHAT_MESSAGE: 'chat-message',
  CHAT_STREAM: 'chat-stream',
  CHAT_SUMMARY: 'chat-summary',
  EMAIL_SEND: 'email-send',
  WEBHOOK_CALL: 'webhook-call',
  DATA_EXPORT: 'data-export',
  DATA_IMPORT: 'data-import',
  REPORT_GENERATE: 'report-generate',
  CACHE_WARMUP: 'cache-warmup',
  CACHE_CLEANUP: 'cache-cleanup',
  LOG_ROTATE: 'log-rotate',
  AUDIT_CREATE: 'audit-create',
  METRICS_COLLECT: 'metrics-collect',
  HEALTH_CHECK: 'health-check',
  SESSION_CLEANUP: 'session-cleanup',
  TOKEN_REFRESH: 'token-refresh',
  PASSWORD_RESET: 'password-reset'
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];