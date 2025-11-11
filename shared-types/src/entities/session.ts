/**
 * 会话相关核心实体类型定义
 *
 * 提供统一的会话类型定义，支持多种会话管理和查询
 */

import type { JsonValue, JsonObject } from '../index';
import type { StandardMessage, SimpleMessage } from './message';

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 会话状态类型
 */
export type SessionStatus =
  | 'active'      // 活跃状态
  | 'inactive'    // 非活跃状态
  | 'archived'    // 已归档
  | 'deleted'     // 已删除
  | 'locked';     // 锁定状态

/**
 * 会话类型
 */
export type SessionType =
  | 'chat'        // 普通聊天
  | 'voice'       // 语音对话
  | 'file_analysis' // 文件分析
  | 'cad_analysis' // CAD分析
  | 'product_preview' // 产品预览
  | 'custom';     // 自定义类型

/**
 * 会话事件类型
 */
export type SessionEventType =
  | 'created'         // 创建会话
  | 'updated'         // 更新会话
  | 'deleted'         // 删除会话
  | 'archived'        // 归档会话
  | 'restored'        // 恢复会话
  | 'message_added'   // 添加消息
  | 'message_updated' // 更新消息
  | 'message_deleted' // 删除消息
  | 'feedback_added'  // 添加反馈
  | 'feedback_updated'// 更新反馈
  | 'tags_updated'    // 更新标签
  | 'title_changed'   // 修改标题
  | 'agent_changed'   // 切换智能体
  | 'exported'        // 导出会话
  | 'shared';         // 分享会话

// ============================================================================
// 核心实体接口
// ============================================================================

/**
 * 聊天会话基础信息
 */
export interface ChatSession {
  /** 会话唯一标识 */
  id: string;
  /** 会话标题 */
  title: string;
  /** 关联的智能体ID */
  agentId: string;
  /** 关联的用户ID */
  userId?: string;
  /** 标准格式消息列表 */
  messages?: StandardMessage[];
  /** 简化格式消息列表 */
  simpleMessages?: SimpleMessage[];
  /** 创建时间 */
  createdAt: Date | number | string;
  /** 更新时间 */
  updatedAt: Date | number | string;
  /** 会话状态 */
  status?: SessionStatus;
  /** 会话类型 */
  type?: SessionType;
  /** 最后访问时间 */
  lastAccessedAt?: number;
  /** 消息数量缓存 */
  messageCount?: number;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 会话标签 */
  tags?: string[];
  /** 是否已归档 */
  isArchived?: boolean;
  /** 会话元数据 */
  metadata?: SessionMetadata;
  /** 会话设置 */
  settings?: SessionSettings;
  /** 分享信息 */
  sharing?: SessionSharing;
}

/**
 * 会话元数据
 */
export interface SessionMetadata {
  /** 总令牌消耗 */
  totalTokens?: number;
  /** 平均响应时间 */
  averageResponseTime?: number;
  /** 会话持续时间（秒） */
  duration?: number;
  /** 消息统计 */
  messageStats?: {
    userMessages: number;
    aiMessages: number;
    systemMessages: number;
    totalMessages: number;
  };
  /** 附件统计 */
  attachmentStats?: {
    totalFiles: number;
    totalSize: number;
    fileTypes: string[];
  };
  /** 语音统计 */
  voiceStats?: {
    totalVoiceNotes: number;
    totalDuration: number;
    averageDuration: number;
  };
  /** 交互统计 */
  interactionStats?: {
    totalInteractions: number;
    completedInteractions: number;
    averageCompletionTime: number;
  };
  /** 自定义元数据 */
  custom?: Record<string, JsonValue>;
}

/**
 * 会话设置
 */
export interface SessionSettings {
  /** 是否启用流式响应 */
  streamingEnabled?: boolean;
  /** 温度参数 */
  temperature?: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 系统提示词覆盖 */
  systemPromptOverride?: string;
  /** 是否保存历史记录 */
  saveHistory?: boolean;
  /** 是否自动归档 */
  autoArchive?: boolean;
  /** 归档时间（天） */
  archiveAfterDays?: number;
  /** 是否启用通知 */
  notificationsEnabled?: boolean;
  /** 主题设置 */
  theme?: string;
  /** 语言设置 */
  language?: string;
  /** 隐私设置 */
  privacy?: {
    isPrivate: boolean;
    allowedUsers?: string[];
    shareWithPublic?: boolean;
  };
}

/**
 * 会话分享信息
 */
export interface SessionSharing {
  /** 是否已分享 */
  isShared: boolean;
  /** 分享链接 */
  shareUrl?: string;
  /** 分享代码 */
  shareCode?: string;
  /** 分享权限 */
  permissions: {
    canView: boolean;
    canComment: boolean;
    canEdit: boolean;
    canShare: boolean;
  };
  /** 分享过期时间 */
  expiresAt?: string;
  /** 访问次数限制 */
  maxAccess?: number;
  /** 当前访问次数 */
  currentAccess?: number;
  /** 分享创建时间 */
  sharedAt?: string;
  /** 最后访问时间 */
  lastAccessedAt?: string;
  /** 访问者列表 */
  visitors?: Array<{
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    accessedAt: string;
  }>;
}

/**
 * 按智能体分组的会话字典
 */
export interface AgentSessionsMap {
  /** 智能体ID -> 会话列表映射 */
  [agentId: string]: ChatSession[];
}

/**
 * 会话事件记录
 */
export interface SessionEvent {
  /** 事件唯一标识 */
  id: string;
  /** 关联的会话ID */
  sessionId: string;
  /** 关联的智能体ID */
  agentId: string;
  /** 关联的用户ID */
  userId?: string;
  /** 事件类型 */
  eventType: SessionEventType;
  /** 事件时间戳 */
  timestamp: string;
  /** 事件描述 */
  description?: string;
  /** 事件元数据 */
  metadata?: JsonObject;
  /** 用户代理 */
  userAgent?: string;
  /** IP地址 */
  ipAddress?: string;
  /** 地理位置 */
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
}

/**
 * 会话创建请求
 */
export interface CreateSessionRequest {
  /** 会话标题 */
  title?: string;
  /** 智能体ID */
  agentId: string;
  /** 用户ID */
  userId?: string;
  /** 初始消息 */
  initialMessage?: string;
  /** 会话类型 */
  type?: SessionType;
  /** 会话设置 */
  settings?: Partial<SessionSettings>;
  /** 会话标签 */
  tags?: string[];
  /** 会话元数据 */
  metadata?: Partial<SessionMetadata>;
  /** 是否为临时会话 */
  isTemporary?: boolean;
}

/**
 * 会话更新请求
 */
export interface UpdateSessionRequest {
  /** 会话标题 */
  title?: string;
  /** 会话状态 */
  status?: SessionStatus;
  /** 会话类型 */
  type?: SessionType;
  /** 是否置顶 */
  isPinned?: boolean;
  /** 会话标签 */
  tags?: string[];
  /** 会话元数据 */
  metadata?: Partial<SessionMetadata>;
  /** 会话设置 */
  settings?: Partial<SessionSettings>;
  /** 分享设置 */
  sharing?: Partial<SessionSharing>;
  /** 是否标记为已编辑 */
  markAsEdited?: boolean;
}

/**
 * 会话查询参数
 */
export interface SessionQueryParams {
  /** 分页参数 */
  page?: number;
  pageSize?: number;
  /** 智能体ID过滤 */
  agentId?: string | string[];
  /** 用户ID过滤 */
  userId?: string;
  /** 会话状态过滤 */
  status?: SessionStatus[];
  /** 会话类型过滤 */
  type?: SessionType[];
  /** 标签过滤 */
  tags?: string[];
  /** 开始日期 */
  startDate?: string; // ISO 8601格式
  /** 结束日期 */
  endDate?: string;   // ISO 8601格式
  /** 最小消息数 */
  minMessageCount?: number;
  /** 最大消息数 */
  maxMessageCount?: number;
  /** 是否置顶过滤 */
  isPinned?: boolean;
  /** 是否归档过滤 */
  isArchived?: boolean;
  /** 搜索关键词 */
  searchKeyword?: string;
  /** 搜索字段 */
  searchFields?: ('title' | 'content' | 'tags')[];
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'messageCount' | 'title' | 'totalTokens';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 包含消息内容 */
  includeMessages?: boolean;
  /** 消息数量限制 */
  messageLimit?: number;
  /** 是否包含元数据 */
  includeMetadata?: boolean;
}

/**
 * 会话分页响应
 */
export interface SessionPaginatedResponse {
  /** 会话列表 */
  sessions: ChatSession[];
  /** 总数量 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
  /** 查询耗时 */
  queryTime: number;
  /** 聚合统计 */
  aggregations?: {
    /** 按智能体分组统计 */
    byAgent: Array<{
      agentId: string;
      agentName?: string;
      count: number;
    }>;
    /** 按状态分组统计 */
    byStatus: Array<{
      status: SessionStatus;
      count: number;
    }>;
    /** 按类型分组统计 */
    byType: Array<{
      type: SessionType;
      count: number;
    }>;
    /** 按日期分组统计 */
    byDate: Array<{
      date: string;
      count: number;
    }>;
  };
}

/**
 * 会话批量操作请求
 */
export interface BatchSessionOperation {
  /** 操作类型 */
  operation: 'delete' | 'archive' | 'restore' | 'update' | 'export' | 'move' | 'merge';
  /** 会话ID列表 */
  sessionIds: string[];
  /** 目标智能体ID（用于move操作） */
  targetAgentId?: string;
  /** 更新数据（用于update操作） */
  updateData?: Partial<UpdateSessionRequest>;
  /** 导出格式（用于export操作） */
  exportFormat?: 'json' | 'csv' | 'xlsx' | 'txt';
  /** 导出选项 */
  exportOptions?: {
    includeMessages?: boolean;
    includeMetadata?: boolean;
    messageLimit?: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  /** 合并选项（用于merge操作） */
  mergeOptions?: {
    targetSessionId: string;
    preserveOriginal?: boolean;
    mergeStrategy?: 'append' | 'merge_by_timestamp';
  };
  /** 操作原因 */
  reason?: string;
  /** 是否强制执行 */
  force?: boolean;
}

/**
 * 会话导出格式
 */
export interface SessionExportFormat {
  /** 导出版本 */
  version: string;
  /** 导出时间 */
  exportedAt: string;
  /** 导出者信息 */
  exportedBy?: {
    userId?: string;
    username?: string;
  };
  /** 会话列表 */
  sessions: ChatSession[];
  /** 导出格式 */
  format: 'json' | 'csv' | 'xlsx' | 'txt';
  /** 导出选项 */
  exportOptions: {
    includeMessages: boolean;
    includeMetadata: boolean;
    messageLimit?: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  /** 导出统计 */
  statistics: {
    totalSessions: number;
    totalMessages: number;
    totalTokens?: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
    agents: string[];
    users: string[];
  };
  /** 压缩信息 */
  compression?: {
    algorithm: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  };
}

/**
 * 会话统计信息
 */
export interface SessionStatistics {
  /** 统计时间段 */
  period: {
    start: string;
    end: string;
  };
  /** 总会话数 */
  totalSessions: number;
  /** 活跃会话数 */
  activeSessions: number;
  /** 归档会话数 */
  archivedSessions: number;
  /** 总消息数 */
  totalMessages: number;
  /** 总令牌数 */
  totalTokens: number;
  /** 平均会话长度 */
  averageSessionLength: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 最活跃的智能体 */
  topAgents: Array<{
    agentId: string;
    agentName?: string;
    sessionCount: number;
    messageCount: number;
  }>;
  /** 最活跃的用户 */
  topUsers: Array<{
    userId?: string;
    sessionCount: number;
    messageCount: number;
  }>;
  /** 按日期分组的统计 */
  dailyStats: Array<{
    date: string;
    newSessions: number;
    activeSessions: number;
    totalMessages: number;
    totalTokens: number;
  }>;
  /** 按智能体分组的统计 */
  agentStats: Array<{
    agentId: string;
    agentName?: string;
    sessionCount: number;
    messageCount: number;
    totalTokens: number;
    averageResponseTime: number;
  }>;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 会话验证结果
 */
export interface SessionValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误列表 */
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 警告列表 */
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  /** 验证时间戳 */
  timestamp: string;
}

/**
 * 会话搜索建议
 */
export interface SessionSearchSuggestion {
  /** 建议文本 */
  text: string;
  /** 建议类型 */
  type: 'title' | 'content' | 'tag' | 'agent' | 'date';
  /** 建议权重 */
  score: number;
  /** 高亮显示 */
  highlight?: string;
  /** 建议元数据 */
  metadata?: JsonObject;
  /** 用户代理 */
  userAgent?: string;
  /** IP地址 */
  ipAddress?: string;
}