/**
 * API服务统一入口
 *
 * 导出所有API服务、类型定义和工具函数
 */

// ============================================================================
// API服务导出
// ============================================================================

// 智能体API服务
export { AgentsApiService } from './agentsApi';
export type {
  AgentItem,
  AgentPayload,
  AgentValidationResult,
  AgentInfo,
  AgentImportResult,
  AgentReloadResult
} from './agentsApi';

// 认证API服务
export { AuthApiService } from './authApi';
export type {
  UserInfo,
  LoginResponse,
  TokenInfo,
  RefreshTokenResponse,
  PasswordResetRequest,
  PasswordResetConfirmation,
  RegisterPayload,
  SessionInfo
} from './authApi';

// 管理后台API服务
export { AdminApiService } from './adminApi';
export type {
  SystemInfo,
  LogItem,
  GetLogsParams,
  LogsPage,
  AdminUser,
  UserStats,
  SystemStats,
  AuditLogItem,
  AuditLogParams,
  SystemConfig,
  BackupInfo,
  MaintenanceTask
} from './adminApi';

// 核心API服务
export { agentService, chatService, productPreviewService, uploadAttachment } from './api';
export type {
  OriginalChatMessage,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ChatAttachmentMetadata,
  VoiceNoteMetadata,
  ProductPreviewRequest,
  ProductPreviewResponse
} from './api';

// ============================================================================
// 类型定义导出
// ============================================================================

// 通用API类型
export type {
  ApiResult,
  ApiClient,
  ApiRequestConfig,
  ApiRequestOptions,
  ApiResponse,
  PaginatedResponse,
  UploadResponse,
  HttpMethod,
  ChatMessagePayload,
  UserManagementParams,
  LogQueryParams,
  SSECallbacks,
  SSEParsedEvent,
  RequestIdGenerator,
  RequestInterceptor,
  ResponseInterceptor,
  RetryConfig,
  CacheConfig
} from './types/api-common';

// 错误处理类型
export type {
  ApiErrorType,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ServerError,
  RateLimitError,
  BusinessError,
  TimeoutError,
  UploadError
} from './types/api-errors';

// 错误处理工具
export {
  ApiErrorFactory,
  ApiErrorHandler,
  ApiErrorGuards
} from './types/api-errors';

// 类型验证工具
export {
  TypeValidator,
  ValidationResult,
  StringValidator,
  NumberValidator,
  BooleanValidator,
  ArrayValidator,
  ObjectValidator,
  EnumValidator,
  UnionValidator,
  ApiResponseValidator,
  RuntimeTypeChecker,
  CommonValidators
} from './utils/type-validator';

export type {
  ValidatorFactory
} from './utils/type-validator';

// 便捷验证器函数
export {
  string,
  number,
  boolean,
  array,
  object,
  enumValue,
  union,
  optional
} from './utils/type-validator';

// ============================================================================
// 向后兼容的函数式API
// ============================================================================

// 智能体API（已弃用）
export {
  listAgents,
  reloadAgents,
  updateAgent,
  createAgent,
  deleteAgent,
  importAgents,
  validateAgent,
  fetchAgentInfo
} from './agentsApi';

// 认证API（已弃用）
export {
  loginApi,
  profileApi,
  logoutApi,
  changePasswordApi
} from './authApi';

// 管理API（已弃用）
export {
  getSystemInfo,
  getLogsPage,
  getLogs,
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  exportLogsCsv
} from './adminApi';

// ============================================================================
// API服务工具类
// ============================================================================

/**
 * API服务管理器 - 提供统一的API服务访问接口
 */
export class ApiServices {
  /**
   * 智能体服务
   */
  static readonly agents = AgentsApiService;

  /**
   * 认证服务
   */
  static readonly auth = AuthApiService;

  /**
   * 管理后台服务
   */
  static readonly admin = AdminApiService;

  /**
   * 错误处理工厂
   */
  static readonly errors = ApiErrorFactory;

  /**
   * 错误处理器
   */
  static readonly errorHandler = ApiErrorHandler;

  /**
   * 类型检查器
   */
  static readonly typeChecker = RuntimeTypeChecker;

  /**
   * 通用验证器
   */
  static readonly validators = CommonValidators;
}

/**
 * 创建API服务实例
 */
export function createApiServices() {
  return {
    agents: AgentsApiService,
    auth: AuthApiService,
    admin: AdminApiService,
    errors: ApiErrorFactory,
    errorHandler: ApiErrorHandler,
    typeChecker: RuntimeTypeChecker,
    validators: CommonValidators
  };
}

// ============================================================================
// 默认导出
// ============================================================================

export default ApiServices;