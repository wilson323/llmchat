/**
 * 类型守卫工具库
 * 
 * 提供前端特定的类型守卫函数，增强类型安全性
 * 配合 shared-types 中的基础类型守卫使用
 */

import type {
  Agent,
  AgentConfig,
  ChatMessage,
  OriginalChatMessage,
  ChatSession,
  AgentSessionsMap,
  InteractiveData,
  StreamStatus,
  ApiError,
  ThemeMode,
  WorkspaceType,
  AgentStatus,
  MessageStatus,
} from '@/types';

// ============================================================================
// 基础类型守卫
// ============================================================================

/**
 * 检查值是否已定义（非 null 和 undefined）
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * 检查值是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 检查值是否为数字
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * 检查值是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * 检查值是否为对象
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 检查值是否为数组
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// ============================================================================
// 实体类型守卫
// ============================================================================

/**
 * Agent 类型守卫
 */
export function isAgent(value: unknown): value is Agent {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.name) &&
    isString(obj.description) &&
    isString(obj.model) &&
    isString(obj.status) &&
    Array.isArray(obj.capabilities) &&
    isString(obj.provider)
  );
}

/**
 * AgentConfig 类型守卫
 */
export function isAgentConfig(value: unknown): value is AgentConfig {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.name) &&
    isString(obj.endpoint) &&
    isString(obj.apiKey) &&
    isString(obj.model) &&
    isString(obj.provider)
  );
}

/**
 * ChatMessage 类型守卫（huihua.md 格式）
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  // ChatMessage 至少需要有 AI 或 HUMAN 字段之一
  return (
    (obj.AI === undefined || isString(obj.AI)) &&
    (obj.HUMAN === undefined || isString(obj.HUMAN)) &&
    (obj.AI !== undefined || obj.HUMAN !== undefined)
  );
}

/**
 * OriginalChatMessage 类型守卫
 */
export function isOriginalChatMessage(value: unknown): value is OriginalChatMessage {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    (obj.role === 'user' || obj.role === 'assistant' || obj.role === 'system') &&
    isString(obj.content) &&
    isNumber(obj.timestamp)
  );
}

/**
 * ChatSession 类型守卫
 */
export function isChatSession(value: unknown): value is ChatSession {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.id) &&
    isString(obj.title) &&
    isString(obj.agentId) &&
    Array.isArray(obj.messages)
  );
}

/**
 * AgentSessionsMap 类型守卫
 */
export function isAgentSessionsMap(value: unknown): value is AgentSessionsMap {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  // 检查所有值都是会话数组
  return Object.values(obj).every(
    (sessions) => Array.isArray(sessions) && sessions.every(isChatSession)
  );
}

/**
 * StreamStatus 类型守卫
 */
export function isStreamStatus(value: unknown): value is StreamStatus {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  const validTypes = ['flowNodeStatus', 'progress', 'error', 'complete'];
  const validStatuses = ['running', 'completed', 'error'];
  
  return (
    validTypes.includes(obj.type as string) &&
    validStatuses.includes(obj.status as string)
  );
}

/**
 * ApiError 类型守卫
 */
export function isApiError(value: unknown): value is ApiError {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  return (
    isString(obj.code) &&
    isString(obj.message) &&
    isString(obj.timestamp)
  );
}

// ============================================================================
// 字面量类型守卫
// ============================================================================

/**
 * ThemeMode 类型守卫
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * WorkspaceType 类型守卫
 */
export function isWorkspaceType(value: unknown): value is WorkspaceType {
  return value === 'chat' || value === 'product-preview' || value === 'voice-call' || value === 'custom';
}

/**
 * AgentStatus 类型守卫
 */
export function isAgentStatus(value: unknown): value is AgentStatus {
  return value === 'active' || value === 'inactive' || value === 'error' || value === 'loading';
}

/**
 * MessageStatus 类型守卫
 */
export function isMessageStatus(value: unknown): value is MessageStatus {
  return value === 'sending' || value === 'sent' || value === 'delivered' || value === 'read' || value === 'failed';
}

// ============================================================================
// 数组类型守卫
// ============================================================================

/**
 * 检查数组中的所有元素是否符合特定类型
 */
export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/**
 * Agent 数组类型守卫
 */
export function isAgentArray(value: unknown): value is Agent[] {
  return isArrayOf(value, isAgent);
}

/**
 * ChatMessage 数组类型守卫
 */
export function isChatMessageArray(value: unknown): value is ChatMessage[] {
  return isArrayOf(value, isChatMessage);
}

/**
 * ChatSession 数组类型守卫
 */
export function isChatSessionArray(value: unknown): value is ChatSession[] {
  return isArrayOf(value, isChatSession);
}

// ============================================================================
// 过滤和转换工具
// ============================================================================

/**
 * 过滤数组中的 undefined 和 null
 */
export function filterDefined<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(isDefined);
}

/**
 * 根据类型守卫过滤数组
 */
export function filterByType<T>(
  array: unknown[],
  guard: (item: unknown) => item is T
): T[] {
  return array.filter(guard);
}

/**
 * 安全地从数组中获取第一个元素
 */
export function getFirst<T>(array: T[] | undefined | null): T | undefined {
  return array?.[0];
}

/**
 * 安全地从数组中获取最后一个元素
 */
export function getLast<T>(array: T[] | undefined | null): T | undefined {
  if (!array || array.length === 0) return undefined;
  return array[array.length - 1];
}

// ============================================================================
// 可选属性安全访问
// ============================================================================

/**
 * 安全访问可选属性，提供默认值
 */
export function getOrDefault<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: NonNullable<T[K]>
): NonNullable<T[K]> {
  if (!isDefined(obj)) return defaultValue;
  
  const value = obj[key];
  if (isDefined(value)) {
    return value as NonNullable<T[K]>;
  }
  return defaultValue;
}

/**
 * 安全访问嵌套属性
 */
export function getNestedProperty<T>(
  obj: unknown,
  path: string[],
  defaultValue: T
): T {
  let current: unknown = obj;
  
  for (const key of path) {
    if (!isObject(current)) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return (isDefined(current) ? current : defaultValue) as T;
}

/**
 * 安全访问字符串属性
 */
export function getStringProperty(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue: string = ''
): string {
  const value = obj?.[key];
  return isString(value) ? value : defaultValue;
}

/**
 * 安全访问数字属性
 */
export function getNumberProperty(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue: number = 0
): number {
  const value = obj?.[key];
  return isNumber(value) ? value : defaultValue;
}

/**
 * 安全访问布尔属性
 */
export function getBooleanProperty(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue: boolean = false
): boolean {
  const value = obj?.[key];
  return isBoolean(value) ? value : defaultValue;
}

// ============================================================================
// 类型断言工具
// ============================================================================

/**
 * 断言值已定义，否则抛出错误
 */
export function assertDefined<T>(
  value: T | null | undefined,
  errorMessage: string = 'Value is not defined'
): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(errorMessage);
  }
}

/**
 * 断言值符合特定类型，否则抛出错误
 */
export function assertType<T>(
  value: unknown,
  guard: (val: unknown) => val is T,
  errorMessage: string = 'Value does not match expected type'
): asserts value is T {
  if (!guard(value)) {
    throw new Error(errorMessage);
  }
}

/**
 * 断言为 Agent 类型
 */
export function assertAgent(value: unknown): asserts value is Agent {
  assertType(value, isAgent, 'Value is not a valid Agent');
}

/**
 * 断言为 ChatMessage 类型
 */
export function assertChatMessage(value: unknown): asserts value is ChatMessage {
  assertType(value, isChatMessage, 'Value is not a valid ChatMessage');
}

/**
 * 断言为 ChatSession 类型
 */
export function assertChatSession(value: unknown): asserts value is ChatSession {
  assertType(value, isChatSession, 'Value is not a valid ChatSession');
}

// ============================================================================
// 组合类型守卫
// ============================================================================

/**
 * 检查对象是否包含特定属性
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * 检查对象是否包含多个属性
 */
export function hasProperties<K extends string>(
  obj: unknown,
  keys: K[]
): obj is Record<K, unknown> {
  if (!isObject(obj)) return false;
  return keys.every(key => key in obj);
}

/**
 * 检查值是否为非空字符串
 */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

/**
 * 检查值是否为正数
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * 检查值是否为非负数
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

// ============================================================================
// 特殊类型守卫
// ============================================================================

/**
 * 检查 ChatMessage 是否包含用户消息
 */
export function hasHumanMessage(message: ChatMessage): message is ChatMessage & { HUMAN: string } {
  return isDefined(message.HUMAN) && isNonEmptyString(message.HUMAN);
}

/**
 * 检查 ChatMessage 是否包含AI消息
 */
export function hasAIMessage(message: ChatMessage): message is ChatMessage & { AI: string } {
  return isDefined(message.AI) && isNonEmptyString(message.AI);
}

/**
 * 检查 ChatMessage 是否包含交互数据
 */
export function hasInteractiveData(
  message: ChatMessage
): message is ChatMessage & { interactive: InteractiveData } {
  return isDefined(message.interactive) && isObject(message.interactive);
}

/**
 * 检查 ChatMessage 是否包含推理状态
 */
export function hasReasoningState(
  message: ChatMessage
): message is ChatMessage & { reasoning: NonNullable<ChatMessage['reasoning']> } {
  return isDefined(message.reasoning) && isObject(message.reasoning);
}

/**
 * 检查 Agent 是否激活
 */
export function isActiveAgent(agent: Agent): boolean {
  return agent.status === 'active' && agent.isActive !== false;
}

/**
 * 检查 ChatSession 是否为空
 */
export function isEmptySession(session: ChatSession): boolean {
  return !session.messages || session.messages.length === 0;
}

/**
 * 检查 ChatSession 是否已归档
 */
export function isArchivedSession(session: ChatSession): boolean {
  return session.isArchived === true;
}

/**
 * 检查 ChatSession 是否置顶
 */
export function isPinnedSession(session: ChatSession): boolean {
  return session.isPinned === true;
}

// ============================================================================
// 类型转换辅助
// ============================================================================

/**
 * 安全地将未知值转换为指定类型
 */
export function safeCast<T>(
  value: unknown,
  guard: (val: unknown) => val is T,
  defaultValue: T
): T {
  return guard(value) ? value : defaultValue;
}

/**
 * 安全地将值转换为 Agent
 */
export function toAgent(value: unknown, defaultAgent: Agent): Agent {
  return safeCast(value, isAgent, defaultAgent);
}

/**
 * 安全地将值转换为 ChatMessage
 */
export function toChatMessage(value: unknown, defaultMessage: ChatMessage): ChatMessage {
  return safeCast(value, isChatMessage, defaultMessage);
}

/**
 * 安全地将值转换为 ChatSession
 */
export function toChatSession(value: unknown, defaultSession: ChatSession): ChatSession {
  return safeCast(value, isChatSession, defaultSession);
}

// ============================================================================
// 数组操作增强
// ============================================================================

/**
 * 查找数组中第一个符合条件的元素
 */
export function findFirst<T>(
  array: T[] | undefined | null,
  predicate: (item: T) => boolean
): T | undefined {
  return array?.find(predicate);
}

/**
 * 查找数组中符合类型守卫的第一个元素
 */
export function findFirstOfType<T, U extends T>(
  array: T[] | undefined | null,
  guard: (item: T) => item is U
): U | undefined {
  if (!array) return undefined;
  return array.find(guard);
}

/**
 * 根据ID查找智能体
 */
export function findAgentById(
  agents: Agent[] | undefined | null,
  agentId: string | undefined | null
): Agent | undefined {
  if (!agents || !agentId) return undefined;
  return agents.find(agent => agent.id === agentId);
}

/**
 * 根据ID查找会话
 */
export function findSessionById(
  sessions: ChatSession[] | undefined | null,
  sessionId: string | undefined | null
): ChatSession | undefined {
  if (!sessions || !sessionId) return undefined;
  return sessions.find(session => session.id === sessionId);
}

// ============================================================================
// 对象合并和更新工具
// ============================================================================

/**
 * 安全合并对象（只合并已定义的属性）
 */
export function mergeDefinedProperties<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  
  for (const key in source) {
    if (key in source) {
      const value = source[key];
      if (isDefined(value)) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * 更新对象中的可选属性
 */
export function updateOptionalProperty<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K] | undefined
): T {
  if (isDefined(value)) {
    return { ...obj, [key]: value };
  }
  return obj;
}

// ============================================================================
// 验证工具
// ============================================================================

/**
 * 验证对象包含必需属性
 */
export function validateRequiredProperties<T extends Record<string, unknown>>(
  obj: unknown,
  requiredKeys: (keyof T)[]
): obj is T {
  if (!isObject(obj)) return false;
  
  return requiredKeys.every(key => {
    const k = key as string;
    return k in obj && isDefined(obj[k]);
  });
}

/**
 * 验证 Agent 对象的完整性
 */
export function validateAgent(value: unknown): value is Agent {
  if (!isAgent(value)) return false;
  
  // 额外验证
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.model) &&
    isAgentStatus(value.status) &&
    value.capabilities.length > 0
  );
}

/**
 * 验证 ChatSession 的完整性
 */
export function validateChatSession(value: unknown): value is ChatSession {
  if (!isChatSession(value)) return false;
  
  // 额外验证
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.agentId) &&
    isDefined(value.createdAt) &&
    isDefined(value.updatedAt)
  );
}

// ============================================================================
// 类型缩窄辅助
// ============================================================================

/**
 * 如果值符合类型守卫，执行回调
 */
export function ifType<T>(
  value: unknown,
  guard: (val: unknown) => val is T,
  callback: (val: T) => void
): void {
  if (guard(value)) {
    callback(value);
  }
}

/**
 * 根据类型守卫进行条件处理
 */
export function matchType<T, R>(
  value: unknown,
  guard: (val: unknown) => val is T,
  onMatch: (val: T) => R,
  onMismatch: () => R
): R {
  return guard(value) ? onMatch(value) : onMismatch();
}

// ============================================================================
// 导出便捷组合
// ============================================================================

/**
 * 类型守卫工具集合
 */
export const TypeGuards = {
  // 基础类型
  isDefined,
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  
  // 实体类型
  isAgent,
  isAgentConfig,
  isChatMessage,
  isOriginalChatMessage,
  isChatSession,
  isAgentSessionsMap,
  isStreamStatus,
  isApiError,
  
  // 字面量类型
  isThemeMode,
  isWorkspaceType,
  isAgentStatus,
  isMessageStatus,
  
  // 数组类型
  isArrayOf,
  isAgentArray,
  isChatMessageArray,
  isChatSessionArray,
  
  // 验证
  validateAgent,
  validateChatSession,
  validateRequiredProperties,
  
  // 特殊检查
  hasHumanMessage,
  hasAIMessage,
  hasInteractiveData,
  hasReasoningState,
  isActiveAgent,
  isEmptySession,
  isArchivedSession,
  isPinnedSession,
} as const;

/**
 * 类型工具集合
 */
export const TypeUtils = {
  // 过滤和转换
  filterDefined,
  filterByType,
  getFirst,
  getLast,
  
  // 安全访问
  getOrDefault,
  getNestedProperty,
  getStringProperty,
  getNumberProperty,
  getBooleanProperty,
  
  // 类型转换
  safeCast,
  toAgent,
  toChatMessage,
  toChatSession,
  
  // 对象操作
  mergeDefinedProperties,
  updateOptionalProperty,
  
  // 条件处理
  ifType,
  matchType,
  
  // 查找
  findFirst,
  findFirstOfType,
  findAgentById,
  findSessionById,
  
  // 对象检查
  hasProperty,
  hasProperties,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
} as const;

