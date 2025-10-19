/**
 * 安全属性访问工具函数库
 *
 * 提供类型安全的可选属性访问模式，避免运行时错误
 * 适用于 TypeScript 严格模式和 exactOptionalPropertyTypes 配置
 */

// ==================== 基础工具类型 ====================

/**
 * 安全的类型提取，处理可能为 undefined 的属性
 */
export type SafeProperty<T, K extends keyof T> = T[K] extends undefined
  ? never
  : T[K] extends infer U
  ? U | undefined
  : never;

/**
 * 深度可选类型转换
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * 安全的路径类型
 */
export type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? undefined extends T[K]
          ? `${K}` | `${K}.${Path<Exclude<T[K], undefined>>}`
          : `${K}` | `${K}.${Path<T[K]>}`
        : never;
    }[keyof T]
  : never;

// ==================== 核心工具函数 ====================

/**
 * 安全属性访问器 - 基础版本
 * @param obj 目标对象
 * @param key 属性键
 * @param defaultValue 默认值
 * @returns 属性值或默认值
 */
export function safeGet<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  defaultValue: Required<T>[K]
): Required<T>[K];

export function safeGet<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined;

export function safeGet<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined {
  if (obj == null) {
    return defaultValue;
  }

  const value = obj[key];
  return value !== undefined ? value : defaultValue;
}

/**
 * 安全属性访问器 - 深度版本
 * @param obj 目标对象
 * @param path 属性路径，如 'user.profile.name'
 * @param defaultValue 默认值
 * @returns 属性值或默认值
 */
export function safeGetDeep<T, R = unknown>(
  obj: T | undefined | null,
  path: string,
  defaultValue?: R
): R | undefined {
  if (obj == null) {
    return defaultValue;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    if (!(key in current)) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return (current !== undefined ? current : defaultValue) as R | undefined;
}

/**
 * 批量安全属性访问
 * @param obj 目标对象
 * @param selectors 属性选择器数组
 * @returns 属性值对象
 */
export function safeGetMultiple<T, K extends keyof T>(
  obj: T | undefined | null,
  selectors: Array<{ key: K; defaultValue?: T[K] }>
): Partial<Pick<T, K>> {
  if (obj == null) {
    return {};
  }

  const result: Partial<Pick<T, K>> = {};
  for (const selector of selectors) {
    const { key, defaultValue } = selector;
    const value = safeGet(obj, key, defaultValue);
    if (value !== undefined) {
      result[key] = value as Pick<T, K>[K];
    }
  }

  return result;
}

// ==================== 消息数据专用工具 ====================

/**
 * 消息数据中的用户配置文件接口
 */
export interface MessageUserProfile {
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
 * 安全获取消息用户配置文件
 * @param message 消息对象
 * @returns 用户配置文件或 null
 */
export function safeGetMessageUserProfile(message: unknown): MessageUserProfile | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const messageObj = message as Record<string, unknown>;
  const userProfile = messageObj.userProfile;
  
  if (!userProfile || typeof userProfile !== 'object') {
    return null;
  }

  const profile = userProfile as Record<string, unknown>;
  
  // 验证必需字段
  if (typeof profile.id !== 'string' || typeof profile.name !== 'string') {
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: typeof profile.email === 'string' ? profile.email : undefined,
    avatar: typeof profile.avatar === 'string' ? profile.avatar : undefined,
    role: typeof profile.role === 'string' ? profile.role : undefined,
    preferences: (typeof profile.preferences === 'object' && profile.preferences !== null) 
      ? profile.preferences as MessageUserProfile['preferences'] 
      : undefined
  };
}

/**
 * 安全获取用户偏好设置
 * @param userProfile 用户配置文件
 * @param preferenceKey 偏好键
 * @param defaultValue 默认值
 * @returns 偏好值
 */
export function safeGetUserPreference<T>(
  userProfile: MessageUserProfile | null,
  preferenceKey: string,
  defaultValue: T
): T {
  if (!userProfile || !userProfile.preferences) {
    return defaultValue;
  }

  return safeGetDeep<MessageUserProfile['preferences'], T>(
    userProfile.preferences, 
    preferenceKey, 
    defaultValue
  ) ?? defaultValue;
}

// ==================== 智能体配置专用工具 ====================

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
 * 安全获取智能体元数据
 * @param agent 智能体对象
 * @returns 元数据对象
 */
export function safeGetAgentMetadata(agent: unknown): AgentMetadata {
  if (!agent || typeof agent !== 'object') {
    return {};
  }

  const agentObj = agent as Record<string, unknown>;
  const metadata = agentObj.metadata;
  
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const meta = metadata as Record<string, unknown>;

  return {
    version: typeof meta.version === 'string' ? meta.version : undefined,
    description: typeof meta.description === 'string' ? meta.description : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags as string[] : undefined,
    capabilities: Array.isArray(meta.capabilities) ? meta.capabilities as string[] : undefined,
    settings: (typeof meta.settings === 'object' && meta.settings !== null) 
      ? meta.settings as AgentMetadata['settings'] 
      : undefined,
    ui: (typeof meta.ui === 'object' && meta.ui !== null) 
      ? meta.ui as AgentMetadata['ui'] 
      : undefined,
    custom: (typeof meta.custom === 'object' && meta.custom !== null) 
      ? meta.custom as Record<string, unknown> 
      : undefined
  };
}

/**
 * 安全获取智能体设置
 * @param agent 智能体对象
 * @param settingKey 设置键
 * @param defaultValue 默认值
 * @returns 设置值
 */
export function safeGetAgentSetting<T>(
  agent: unknown,
  settingKey: string,
  defaultValue: T
): T {
  const metadata = safeGetAgentMetadata(agent);
  return safeGetDeep<AgentMetadata['settings'], T>(metadata.settings, settingKey, defaultValue) ?? defaultValue;
}

/**
 * 安全获取智能体UI配置
 * @param agent 智能体对象
 * @param uiKey UI键
 * @param defaultValue 默认值
 * @returns UI配置值
 */
export function safeGetAgentUI<T>(
  agent: unknown,
  uiKey: string,
  defaultValue: T
): T {
  const metadata = safeGetAgentMetadata(agent);
  return safeGetDeep<AgentMetadata['ui'], T>(metadata.ui, uiKey, defaultValue) ?? defaultValue;
}

// ==================== UI状态专用工具 ====================

/**
 * UI状态接口
 */
export interface UIState {
  loading?: boolean;
  error?: string | null;
  data?: unknown;
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
  filters?: Record<string, unknown>;
  selection?: {
    selectedIds?: string[];
    currentId?: string;
  };
}

/**
 * 安全获取UI状态
 * @param state 状态对象
 * @returns 安全的UI状态
 */
export function safeGetUIState(state: unknown): UIState {
  if (!state || typeof state !== 'object') {
    return {};
  }

  const stateObj = state as Record<string, unknown>;

  return {
    loading: typeof stateObj.loading === 'boolean' ? stateObj.loading : false,
    error: typeof stateObj.error === 'string' ? stateObj.error : null,
    data: stateObj.data,
    pagination: (typeof stateObj.pagination === 'object' && stateObj.pagination !== null) 
      ? stateObj.pagination as UIState['pagination'] 
      : undefined,
    filters: (typeof stateObj.filters === 'object' && stateObj.filters !== null) 
      ? stateObj.filters as Record<string, unknown> 
      : undefined,
    selection: (typeof stateObj.selection === 'object' && stateObj.selection !== null) 
      ? stateObj.selection as UIState['selection'] 
      : undefined
  };
}

/**
 * 安全获取分页信息
 * @param state 状态对象
 * @returns 分页信息
 */
export function safeGetPagination(state: unknown): {
  page: number;
  pageSize: number;
  total: number;
} {
  const uiState = safeGetUIState(state);
  return {
    page: safeGetDeep<UIState['pagination'], number>(uiState.pagination, 'page', 1) ?? 1,
    pageSize: safeGetDeep<UIState['pagination'], number>(uiState.pagination, 'pageSize', 10) ?? 10,
    total: safeGetDeep<UIState['pagination'], number>(uiState.pagination, 'total', 0) ?? 0
  };
}

/**
 * 安全获取选中的ID列表
 * @param state 状态对象
 * @returns 选中的ID列表
 */
export function safeGetSelectedIds(state: unknown): string[] {
  const uiState = safeGetUIState(state);
  return safeGetDeep<UIState['selection'], string[]>(uiState.selection, 'selectedIds', []) ?? [];
}

// ==================== 高级工具函数 ====================

/**
 * 条件属性访问
 * @param condition 条件
 * @param obj 对象
 * @param key 属性键
 * @param defaultValue 默认值
 * @returns 条件为真时的属性值，否则为默认值
 */
export function safeGetIf<T, K extends keyof T>(
  condition: boolean,
  obj: T | undefined | null,
  key: K,
  defaultValue: T[K]
): T[K] {
  return condition ? safeGet(obj, key, defaultValue) : defaultValue;
}

/**
 * 函数式属性访问
 * @param obj 对象
 * @param accessor 访问器函数
 * @param defaultValue 默认值
 * @returns 访问结果或默认值
 */
export function safeAccess<T, R>(
  obj: T | undefined | null,
  accessor: (obj: T) => R,
  defaultValue: R
): R {
  if (obj == null) {
    return defaultValue;
  }

  try {
    return accessor(obj);
  } catch {
    return defaultValue;
  }
}

/**
 * 类型守卫：检查是否为有效对象
 * @param value 待检查值
 * @returns 是否为有效对象
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 类型守卫：检查是否为有效消息对象
 * @param value 待检查值
 * @returns 是否为有效消息对象
 */
export function isValidMessage(value: unknown): value is { userProfile?: MessageUserProfile } {
  return isValidObject(value) && ('userProfile' in value);
}

/**
 * 类型守卫：检查是否为有效智能体对象
 * @param value 待检查值
 * @returns 是否为有效智能体对象
 */
export function isValidAgent(value: unknown): value is { metadata?: AgentMetadata } {
  return isValidObject(value) && ('metadata' in value);
}

// ==================== 使用示例 ====================

/*
// 基础使用
const userName = safeGet(user, 'name', 'Anonymous');
const userAge = safeGet(user, 'age', 0);

// 深度访问
const theme = safeGetDeep(user, 'preferences.theme', 'light');
const notificationEnabled = safeGetDeep(user, 'preferences.notifications', false);

// 消息数据
const userProfile = safeGetMessageUserProfile(message);
if (userProfile) {
  const userName = userProfile.name;
  const userTheme = safeGetUserPreference(userProfile, 'theme', 'light');
}

// 智能体配置
const agentMetadata = safeGetAgentMetadata(agent);
const agentTemperature = safeGetAgentSetting(agent, 'temperature', 0.7);
const agentColor = safeGetAgentUI(agent, 'color', '#007bff');

// UI状态
const uiState = safeGetUIState(componentState);
const pagination = safeGetPagination(componentState);
const selectedIds = safeGetSelectedIds(componentState);

// 条件访问
const adminName = safeGetIf(
  user.isAdmin,
  user,
  'adminName',
  'Administrator'
);

// 函数式访问
const fullName = safeAccess(
  user,
  u => `${u.firstName} ${u.lastName}`,
  'Unknown User'
);
*/