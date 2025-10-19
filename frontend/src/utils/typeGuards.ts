/**
 * 类型守卫和运行时检查工具
 *
 * 提供安全的运行时类型检查机制，确保数据结构的有效性
 */

// ==================== 基础类型守卫 ====================

/**
 * 检查是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 检查是否为数字
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 检查是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 检查是否为函数
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * 检查是否为对象（非null）
 */
export function isObject(value: unknown): value is object {
  return value != null && typeof value === 'object';
}

/**
 * 检查是否为普通对象（非数组、非null）
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value) && value.constructor === Object;
}

/**
 * 检查是否为数组
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * 检查是否为指定类型的数组
 */
export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/**
 * 检查是否为null或undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value == null;
}

/**
 * 检查是否为有效的日期
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

// ==================== 字符串类型守卫 ====================

/**
 * 检查是否为有效的用户ID
 */
export function isValidUserId(value: unknown): value is string {
  return isString(value) && value.length > 0 && /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * 检查是否为有效的邮箱
 */
export function isValidEmail(value: unknown): value is string {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * 检查是否为有效的URL
 */
export function isValidUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否为有效的UUID
 */
export function isValidUUID(value: unknown): value is string {
  return isString(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ==================== 消息类型守卫 ====================

/**
 * 消息基础接口
 */
export interface BaseMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string | Date;
  userProfile?: unknown;
  metadata?: unknown;
}

/**
 * 检查是否为基础消息对象
 */
export function isBaseMessage(value: unknown): value is BaseMessage {
  if (!isPlainObject(value)) return false;

  const msg = value as Record<string, unknown>;
  return (
    isValidUUID(msg.id) &&
    isString(msg.content) &&
    ['user', 'assistant', 'system'].includes(msg.role as string) &&
    (isString(msg.timestamp) || isValidDate(msg.timestamp))
  );
}

/**
 * 用户配置文件接口
 */
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  preferences?: {
    theme?: string;
    language?: string;
    notifications?: boolean;
  };
}

/**
 * 检查是否为有效的用户配置文件
 */
export function isValidUserProfile(value: unknown): value is UserProfile {
  if (!isPlainObject(value)) return false;

  const profile = value as Record<string, unknown>;
  return (
    isValidUUID(profile.id) &&
    isString(profile.name) &&
    profile.name.length > 0 &&
    (profile.email === undefined || isValidEmail(profile.email)) &&
    (profile.avatar === undefined || isValidUrl(profile.avatar)) &&
    (profile.role === undefined || isString(profile.role))
  );
}

/**
 * 检查消息是否包含有效的用户配置文件
 */
export function hasValidUserProfile(message: unknown): message is BaseMessage & { userProfile: UserProfile } {
  return isBaseMessage(message) && isValidUserProfile(message.userProfile);
}

// ==================== 智能体类型守卫 ====================

/**
 * 智能体元数据接口
 */
export interface AgentMetadata {
  version?: string;
  description?: string;
  tags?: string[];
  capabilities?: string[];
  settings?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
    provider?: string;
  };
  ui?: {
    color?: string;
    icon?: string;
    order?: number;
    category?: string;
  };
  custom?: Record<string, unknown>;
}

/**
 * 检查是否为有效的智能体元数据
 */
export function isValidAgentMetadata(value: unknown): value is AgentMetadata {
  if (!isPlainObject(value)) return false;

  const metadata = value as Record<string, unknown>;

  // 检查可选字段
  if (metadata.version !== undefined && !isString(metadata.version)) return false;
  if (metadata.description !== undefined && !isString(metadata.description)) return false;
  if (metadata.tags !== undefined && !isArrayOf(metadata.tags, isString)) return false;
  if (metadata.capabilities !== undefined && !isArrayOf(metadata.capabilities, isString)) return false;

  // 检查settings
  if (metadata.settings !== undefined) {
    if (!isPlainObject(metadata.settings)) return false;
    const settings = metadata.settings as Record<string, unknown>;

    if (settings.temperature !== undefined && (!isNumber(settings.temperature) || settings.temperature < 0 || settings.temperature > 2)) {
      return false;
    }
    if (settings.maxTokens !== undefined && (!isNumber(settings.maxTokens) || settings.maxTokens <= 0)) {
      return false;
    }
    if (settings.model !== undefined && !isString(settings.model)) return false;
    if (settings.provider !== undefined && !isString(settings.provider)) return false;
  }

  // 检查UI配置
  if (metadata.ui !== undefined) {
    if (!isPlainObject(metadata.ui)) return false;
    const ui = metadata.ui as Record<string, unknown>;

    if (ui.color !== undefined && !isString(ui.color)) return false;
    if (ui.icon !== undefined && !isString(ui.icon)) return false;
    if (ui.order !== undefined && (!isNumber(ui.order) || ui.order < 0)) return false;
    if (ui.category !== undefined && !isString(ui.category)) return false;
  }

  return true;
}

/**
 * 智能体接口
 */
export interface Agent {
  id: string;
  name: string;
  provider: string;
  description?: string;
  metadata?: AgentMetadata;
}

/**
 * 检查是否为有效的智能体
 */
export function isValidAgent(value: unknown): value is Agent {
  if (!isPlainObject(value)) return false;

  const agent = value as Record<string, unknown>;
  return (
    isValidUUID(agent.id) &&
    isString(agent.name) &&
    agent.name.length > 0 &&
    isString(agent.provider) &&
    agent.provider.length > 0 &&
    (agent.description === undefined || isString(agent.description)) &&
    (agent.metadata === undefined || isValidAgentMetadata(agent.metadata))
  );
}

// ==================== UI状态类型守卫 ====================

/**
 * 分页信息接口
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * 检查是否为有效的分页信息
 */
export function isValidPaginationInfo(value: unknown): value is PaginationInfo {
  if (!isPlainObject(value)) return false;

  const pagination = value as Record<string, unknown>;
  return (
    isNumber(pagination.page) && pagination.page > 0 &&
    isNumber(pagination.pageSize) && pagination.pageSize > 0 &&
    isNumber(pagination.total) && pagination.total >= 0
  );
}

/**
 * 选择状态接口
 */
export interface SelectionState {
  selectedIds: string[];
  currentId?: string;
}

/**
 * 检查是否为有效的选择状态
 */
export function isValidSelectionState(value: unknown): value is SelectionState {
  if (!isPlainObject(value)) return false;

  const selection = value as Record<string, unknown>;
  if (!isArrayOf(selection.selectedIds, isValidUUID)) return false;
  if (selection.currentId !== undefined && !isValidUUID(selection.currentId)) return false;

  return true;
}

/**
 * UI状态接口
 */
export interface UIState {
  loading?: boolean;
  error?: string | null;
  data?: unknown;
  pagination?: PaginationInfo;
  filters?: Record<string, unknown>;
  selection?: SelectionState;
}

/**
 * 检查是否为有效的UI状态
 */
export function isValidUIState(value: unknown): value is UIState {
  if (!isPlainObject(value)) return false;

  const state = value as Record<string, unknown>;

  if (state.loading !== undefined && !isBoolean(state.loading)) return false;
  if (state.error !== undefined && (state.error !== null && !isString(state.error))) return false;
  if (state.pagination !== undefined && !isValidPaginationInfo(state.pagination)) return false;
  if (state.selection !== undefined && !isValidSelectionState(state.selection)) return false;

  return true;
}

// ==================== 会话类型守卫 ====================

/**
 * 会话接口
 */
export interface Session {
  id: string;
  title: string;
  agentId: string;
  userId?: string;
  messages: BaseMessage[];
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/**
 * 检查是否为有效的会话
 */
export function isValidSession(value: unknown): value is Session {
  if (!isPlainObject(value)) return false;

  const session = value as Record<string, unknown>;
  return (
    isValidUUID(session.id) &&
    isString(session.title) &&
    session.title.length > 0 &&
    isValidUUID(session.agentId) &&
    (session.userId === undefined || isValidUUID(session.userId)) &&
    isArrayOf(session.messages, isBaseMessage) &&
    (session.metadata === undefined || isPlainObject(session.metadata)) &&
    (isString(session.createdAt) || isValidDate(session.createdAt)) &&
    (isString(session.updatedAt) || isValidDate(session.updatedAt))
  );
}

// ==================== 高级类型守卫工具 ====================

/**
 * 创建类型谓词函数
 */
export function createTypeGuard<T>(predicate: (value: unknown) => value is T): (value: unknown) => value is T {
  return predicate;
}

/**
 * 联合类型守卫
 */
export function isOneOf<T>(guards: Array<(value: unknown) => value is T>): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return guards.some(guard => guard(value));
  };
}

/**
 * 可选属性类型守卫
 */
export function hasProperty<T extends object, K extends keyof T>(
  obj: T,
  key: K
): obj is T & Required<Pick<T, K>> {
  return key in obj && obj[key] !== undefined && obj[key] !== null;
}

/**
 * 部分对象类型守卫
 */
export function isPartialObject<T extends object>(
  value: unknown,
  requiredKeys: (keyof T)[],
  validators: Partial<Record<keyof T, (v: unknown) => boolean>> = {}
): value is Partial<T> {
  if (!isPlainObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // 检查必需的键
  for (const key of requiredKeys) {
    const keyStr = String(key);
    if (!(keyStr in obj)) return false;
    const validator = validators[key];
    if (validator && !validator(obj[keyStr])) return false;
  }

  return true;
}

// ==================== 运行时验证器 ====================

/**
 * 验证结果接口
 */
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value?: T;
  errors: string[];
}

/**
 * 创建验证器
 */
export function createValidator<T>(
  predicate: (value: unknown) => value is T,
  errorMessage?: string
): (value: unknown) => ValidationResult<T> {
  return (value: unknown): ValidationResult<T> => {
    if (predicate(value)) {
      return { isValid: true, value, errors: [] };
    }

    return {
      isValid: false,
      errors: [errorMessage || `Invalid value: ${typeof value}`]
    };
  };
}

/**
 * 组合验证器
 */
export function combineValidators<T>(
  validators: Array<(value: unknown) => ValidationResult<T>>
): (value: unknown) => ValidationResult<T> {
  return (value: unknown): ValidationResult<T> => {
    const errors: string[] = [];

    for (const validator of validators) {
      const result = validator(value);
      if (result.isValid) {
        return result;
      }
      errors.push(...result.errors);
    }

    return { isValid: false, errors };
  };
}

// ==================== 使用示例 ====================

/*
// 基础使用
if (isString(value)) {
  // value 在这里被推断为 string
  console.log(value.toUpperCase());
}

// 消息验证
if (isBaseMessage(data)) {
  console.log('Message ID:', data.id);

  if (hasValidUserProfile(data)) {
    console.log('User:', data.userProfile.name);
  }
}

// 智能体验证
if (isValidAgent(agentData)) {
  console.log('Agent:', agentData.name);

  if (agentData.metadata) {
    const temp = safeGetAgentSetting(agentData, 'temperature', 0.7);
    console.log('Temperature:', temp);
  }
}

// UI状态验证
if (isValidUIState(state)) {
  const pagination = safeGetPagination(state);
  console.log('Current page:', pagination.page);
}

// 自定义验证器
const userValidator = createValidator(
  (value): value is UserProfile => isValidUserProfile(value),
  'Invalid user profile'
);

const result = userValidator(inputData);
if (result.isValid) {
  console.log('Valid user:', result.value.name);
} else {
  console.error('Validation errors:', result.errors);
}
*/