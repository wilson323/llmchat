/**
 * 用户相关核心实体类型定义
 *
 * 提供统一的用户类型定义，支持认证、授权和用户管理
 */

import type { JsonValue } from '../index';
import type { SessionStatistics } from './session';

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 用户角色类型
 */
export type UserRole =
  | 'admin'       // 管理员
  | 'moderator'   // 版主
  | 'user'        // 普通用户
  | 'guest'       // 访客
  | 'developer';  // 开发者

/**
 * 用户状态类型
 */
export type UserStatus =
  | 'active'      // 活跃状态
  | 'inactive'    // 非活跃状态
  | 'suspended'   // 暂停状态
  | 'banned'      // 禁用状态
  | 'pending'     // 待验证
  | 'deleted';    // 已删除

/**
 * 认证提供商类型
 */
export type AuthProvider =
  | 'local'       // 本地认证
  | 'oauth'       // OAuth认证
  | 'ldap'        // LDAP认证
  | 'saml'        // SAML认证
  | 'jwt'         // JWT认证
  | 'apikey';     // API密钥认证

/**
 * 权限类型
 */
export type Permission =
  | 'read:agents'         // 读取智能体
  | 'write:agents'        // 写入智能体
  | 'delete:agents'       // 删除智能体
  | 'read:sessions'       // 读取会话
  | 'write:sessions'      // 写入会话
  | 'delete:sessions'     // 删除会话
  | 'read:users'          // 读取用户
  | 'write:users'         // 写入用户
  | 'delete:users'        // 删除用户
  | 'admin:system'        // 系统管理
  | 'read:analytics'      // 读取分析数据
  | 'export:data'         // 导出数据
  | 'import:data';        // 导入数据

// ============================================================================
// 核心实体接口
// ============================================================================

/**
 * 用户基础信息
 */
export interface User {
  /** 用户唯一标识 */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱地址 */
  email: string;
  /** 显示名称 */
  displayName?: string;
  /** 头像URL */
  avatar?: string;
  /** 用户角色 */
  role: UserRole;
  /** 用户状态 */
  status: UserStatus;
  /** 权限列表 */
  permissions?: Permission[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 最后登录时间 */
  lastLoginAt?: string;
  /** 最后登录IP */
  lastLoginIp?: string;
  /** 认证提供商 */
  authProvider: AuthProvider;
  /** 外部认证ID */
  externalId?: string;
  /** 是否邮箱已验证 */
  emailVerified: boolean;
  /** 是否手机已验证 */
  phoneVerified?: boolean;
  /** 手机号码 */
  phoneNumber?: string;
  /** 时区设置 */
  timezone?: string;
  /** 语言设置 */
  language?: string;
  /** 用户标签 */
  tags?: string[];
  /** 用户元数据 */
  metadata?: UserMetadata;
}

/**
 * 用户元数据
 */
export interface UserMetadata {
  /** 个人简介 */
  bio?: string;
  /** 公司/组织 */
  organization?: string;
  /** 职位 */
  position?: string;
  /** 个人网站 */
  website?: string;
  /** 社交媒体链接 */
  socialLinks?: Record<string, string>;
  /** 偏好设置 */
  preferences?: UserPreferences;
  /** 使用统计 */
  usageStats?: UserUsageStats;
  /** 安全设置 */
  securitySettings?: UserSecuritySettings;
  /** 通知设置 */
  notificationSettings?: UserNotificationSettings;
  /** 自定义属性 */
  custom?: Record<string, JsonValue>;
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  /** 主题设置 */
  theme: {
    mode: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    fontSize?: 'small' | 'medium' | 'large';
  };
  /** 聊天设置 */
  chat: {
    streamingEnabled: boolean;
    autoSaveEnabled: boolean;
    messageHistoryLimit: number;
    defaultAgent?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
  };
  /** 语言和地区 */
  locale: {
    language: string;
    region?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
  };
  /** 隐私设置 */
  privacy: {
    profileVisible: boolean;
    activityVisible: boolean;
    allowDirectMessages: boolean;
    allowAnalytics: boolean;
  };
  /** 通知设置 */
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
    types: {
      newMessages: boolean;
      agentUpdates: boolean;
      systemUpdates: boolean;
      securityAlerts: boolean;
    };
  };
  /** 界面设置 */
  interface: {
    sidebarCollapsed: boolean;
    showKeyboardShortcuts: boolean;
    enableAnimations: boolean;
    compactMode: boolean;
  };
}

/**
 * 用户使用统计
 */
export interface UserUsageStats {
  /** 总会话数 */
  totalSessions: number;
  /** 总消息数 */
  totalMessages: number;
  /** 总令牌消耗 */
  totalTokens: number;
  /** 最常用的智能体 */
  topAgents: Array<{
    agentId: string;
    usageCount: number;
    lastUsed: string;
  }>;
  /** 活跃天数 */
  activeDays: number;
  /** 平均每日会话数 */
  averageDailySessions: number;
  /** 平均每日消息数 */
  averageDailyMessages: number;
  /** 上次活动时间 */
  lastActivity: string;
  /** 注册时长（天） */
  registrationAge: number;
  /** 按月统计的使用情况 */
  monthlyStats?: Array<{
    month: string;
    sessions: number;
    messages: number;
    tokens: number;
  }>;
}

/**
 * 用户安全设置
 */
export interface UserSecuritySettings {
  /** 密码设置 */
  password: {
    lastChanged: string;
    expiresAt?: string;
    requiresChange: boolean;
    historyCount: number;
  };
  /** 双因素认证 */
  twoFactor: {
    enabled: boolean;
    method?: 'totp' | 'sms' | 'email';
    secret?: string;
    backupCodes?: string[];
    lastUsed?: string;
  };
  /** 登录限制 */
  loginRestrictions: {
    allowedIps?: string[];
    maxConcurrentSessions: number;
    sessionTimeout: number; // 分钟
    requireReauth: boolean;
  };
  /** API密钥 */
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    permissions: Permission[];
    createdAt: string;
    lastUsed?: string;
    expiresAt?: string;
    isActive: boolean;
  }>;
  /** 登录历史 */
  loginHistory: Array<{
    timestamp: string;
    ip: string;
    userAgent?: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
    success: boolean;
    failureReason?: string;
  }>;
}

/**
 * 用户通知设置
 */
export interface UserNotificationSettings {
  /** 邮件通知 */
  email: {
    enabled: boolean;
    address?: string;
    types: {
      security: boolean;
      system: boolean;
      marketing: boolean;
      updates: boolean;
    };
    frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  };
  /** 推送通知 */
  push: {
    enabled: boolean;
    endpoints?: Array<{
      id: string;
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
      createdAt: string;
    }>;
    types: {
      messages: boolean;
      agents: boolean;
      system: boolean;
    };
  };
  /** 应用内通知 */
  inApp: {
    enabled: boolean;
    types: {
      messages: boolean;
      agents: boolean;
      system: boolean;
      reminders: boolean;
    };
  };
  /** 通知规则 */
  rules: Array<{
    id: string;
    name: string;
    conditions: {
      eventType: string;
      filters?: Record<string, JsonValue>;
    };
    actions: {
      type: 'email' | 'push' | 'inApp';
      enabled: boolean;
    };
    isActive: boolean;
  }>;
}

/**
 * 用户创建请求
 */
export interface CreateUserRequest {
  /** 用户名 */
  username: string;
  /** 邮箱地址 */
  email: string;
  /** 密码 */
  password: string;
  /** 显示名称 */
  displayName?: string;
  /** 用户角色 */
  role?: UserRole;
  /** 用户状态 */
  status?: UserStatus;
  /** 权限列表 */
  permissions?: Permission[];
  /** 手机号码 */
  phoneNumber?: string;
  /** 时区设置 */
  timezone?: string;
  /** 语言设置 */
  language?: string;
  /** 用户标签 */
  tags?: string[];
  /** 用户元数据 */
  metadata?: Partial<UserMetadata>;
  /** 是否发送验证邮件 */
  sendVerificationEmail?: boolean;
  /** 认证提供商 */
  authProvider?: AuthProvider;
  /** 外部认证ID */
  externalId?: string;
}

/**
 * 用户更新请求
 */
export interface UpdateUserRequest {
  /** 用户名 */
  username?: string;
  /** 邮箱地址 */
  email?: string;
  /** 显示名称 */
  displayName?: string;
  /** 头像URL */
  avatar?: string;
  /** 用户角色 */
  role?: UserRole;
  /** 用户状态 */
  status?: UserStatus;
  /** 权限列表 */
  permissions?: Permission[];
  /** 手机号码 */
  phoneNumber?: string;
  /** 时区设置 */
  timezone?: string;
  /** 语言设置 */
  language?: string;
  /** 用户标签 */
  tags?: string[];
  /** 用户元数据 */
  metadata?: Partial<UserMetadata>;
  /** 需要验证当前密码 */
  currentPassword?: string;
  /** 新密码 */
  newPassword?: string;
}

/**
 * 用户查询参数
 */
export interface UserQueryParams {
  /** 分页参数 */
  page?: number;
  pageSize?: number;
  /** 用户角色过滤 */
  role?: UserRole[];
  /** 用户状态过滤 */
  status?: UserStatus[];
  /** 认证提供商过滤 */
  authProvider?: AuthProvider[];
  /** 注册时间范围 */
  registrationDateRange?: {
    start?: string;
    end?: string;
  };
  /** 最后登录时间范围 */
  lastLoginDateRange?: {
    start?: string;
    end?: string;
  };
  /** 搜索关键词 */
  search?: string;
  /** 搜索字段 */
  searchFields?: ('username' | 'email' | 'displayName')[];
  /** 用户标签过滤 */
  tags?: string[];
  /** 是否邮箱已验证 */
  emailVerified?: boolean;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'username' | 'email';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  /** 是否包含统计信息 */
  includeStats?: boolean;
}

/**
 * 用户认证信息
 */
export interface UserAuth {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 用户角色 */
  role: UserRole;
  /** 权限列表 */
  permissions: Permission[];
  /** 认证令牌 */
  token: string;
  /** 令牌类型 */
  tokenType: 'Bearer';
  /** 令牌过期时间 */
  expiresAt: string;
  /** 刷新令牌 */
  refreshToken?: string;
  /** 刷新令牌过期时间 */
  refreshTokenExpiresAt?: string;
  /** 认证提供商 */
  authProvider: AuthProvider;
}

/**
 * 用户登录请求
 */
export interface LoginRequest {
  /** 用户名或邮箱 */
  username: string;
  /** 密码 */
  password: string;
  /** 记住我 */
  rememberMe?: boolean;
  /** 认证码（双因素） */
  authCode?: string;
  /** 设备信息 */
  deviceInfo?: {
    userAgent?: string;
    deviceId?: string;
    deviceType?: 'web' | 'mobile' | 'desktop' | 'api';
  };
}

/**
 * 用户登录响应
 */
export interface LoginResponse {
  /** 认证信息 */
  auth: UserAuth;
  /** 用户信息 */
  user: User;
  /** 会话信息 */
  session?: {
    sessionId: string;
    expiresAt: string;
    maxAge: number;
  };
  /** 是否需要双因素认证 */
  requiresTwoFactor: boolean;
  /** 双因素认证方法 */
  twoFactorMethods?: ('totp' | 'sms' | 'email')[];
}

/**
 * 用户注册请求
 */
export interface RegisterRequest {
  /** 用户名 */
  username: string;
  /** 邮箱地址 */
  email: string;
  /** 密码 */
  password: string;
  /** 确认密码 */
  confirmPassword: string;
  /** 显示名称 */
  displayName?: string;
  /** 手机号码 */
  phoneNumber?: string;
  /** 邀请码 */
  inviteCode?: string;
  /** 服务条款同意 */
  acceptTerms: boolean;
  /** 隐私政策同意 */
  acceptPrivacy: boolean;
  /** 验证码 */
  verificationCode?: string;
}

/**
 * 用户注册响应
 */
export interface RegisterResponse {
  /** 是否成功 */
  success: boolean;
  /** 用户信息 */
  user?: User;
  /** 是否需要邮箱验证 */
  requiresEmailVerification: boolean;
  /** 是否需要管理员审核 */
  requiresAdminApproval: boolean;
  /** 消息 */
  message: string;
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  /** 邮箱地址 */
  email: string;
  /** 重置类型 */
  resetType: 'email' | 'sms';
  /** 验证码 */
  verificationCode?: string;
}

/**
 * 密码重置确认
 */
export interface PasswordResetConfirm {
  /** 重置令牌 */
  token: string;
  /** 新密码 */
  newPassword: string;
  /** 确认密码 */
  confirmPassword: string;
}

/**
 * 用户批量操作请求
 */
export interface BatchUserOperation {
  /** 操作类型 */
  operation: 'activate' | 'deactivate' | 'suspend' | 'delete' | 'update' | 'export';
  /** 用户ID列表 */
  userIds: string[];
  /** 更新数据（用于update操作） */
  updateData?: Partial<UpdateUserRequest>;
  /** 导出格式（用于export操作） */
  exportFormat?: 'json' | 'csv' | 'xlsx';
  /** 操作原因 */
  reason?: string;
  /** 是否通知用户 */
  notifyUsers?: boolean;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 用户验证结果
 */
export interface UserValidationResult {
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
 * 用户活动日志
 */
export interface UserActivityLog {
  /** 日志ID */
  id: string;
  /** 用户ID */
  userId: string;
  /** 活动类型 */
  activityType: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'share' | 'export';
  /** 活动描述 */
  description: string;
  /** 活动时间戳 */
  timestamp: string;
  /** IP地址 */
  ipAddress?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 活动详情 */
  details?: {
    resourceType?: string | undefined;
    resourceId?: string | undefined;
    oldValue?: JsonValue;
    newValue?: JsonValue;
    [key: string]: JsonValue | undefined;
  };
  /** 地理位置 */
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  failureReason?: string;
}

/**
 * 用户统计信息
 */
export interface UserStatistics {
  /** 总用户数 */
  totalUsers: number;
  /** 活跃用户数 */
  activeUsers: number;
  /** 新注册用户数 */
  newUsers: number;
  /** 按角色分组统计 */
  usersByRole: Array<{
    role: UserRole;
    count: number;
  }>;
  /** 按状态分组统计 */
  usersByStatus: Array<{
    status: UserStatus;
    count: number;
  }>;
  /** 按认证提供商分组统计 */
  usersByProvider: Array<{
    provider: AuthProvider;
    count: number;
  }>;
  /** 按注册时间分组统计 */
  registrationByDate: Array<{
    date: string;
    count: number;
  }>;
  /** 按最后登录时间分组统计 */
  lastLoginByDate: Array<{
    date: string;
    count: number;
  }>;
  /** 会话统计 */
  sessionStats?: SessionStatistics;
}