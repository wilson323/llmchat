/**
 * 实体类型守卫工具函数
 * 
 * 提供业务实体的运行时类型验证
 * 确保从API或localStorage获取的数据符合预期类型
 * 
 * @module typeGuards/entities
 */

import type { Agent, ChatMessage, ChatSession, AgentStatus } from '@/types';
import { hasProperty, hasProperties, isObject } from './objects';
import { isString, isDefined, isNumber } from './primitives';
import { isArrayOf } from './arrays';

/**
 * 检查值是否为有效的AgentStatus
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为AgentStatus
 */
export function isValidAgentStatus(value: unknown): value is AgentStatus {
  return (
    isString(value) &&
    (['active', 'inactive', 'error', 'loading'] as const).includes(value as AgentStatus)
  );
}

/**
 * 检查值是否为有效的Agent对象
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为Agent类型
 * @example
 * ```typescript
 * const data: unknown = await fetchAgent();
 * if (isValidAgent(data)) {
 *   console.log(data.name); // TypeScript知道data是Agent
 * }
 * ```
 */
export function isValidAgent(value: unknown): value is Agent {
  if (!isObject(value)) return false;
  
  // 检查必需字段
  if (!hasProperties(value, ['id', 'name', 'description', 'model', 'status', 'provider'])) {
    return false;
  }
  
  const obj = value as Record<string, unknown>;
  
  // 验证字段类型
  return (
    isString(obj.id) &&
    isString(obj.name) &&
    isString(obj.description) &&
    isString(obj.model) &&
    isString(obj.provider) &&
    isValidAgentStatus(obj.status) &&
    // capabilities 可选，但如果存在必须是字符串数组
    (obj.capabilities === undefined || isArrayOf(obj.capabilities, isString)) &&
    // avatar 可选，但如果存在必须是字符串
    (obj.avatar === undefined || isString(obj.avatar)) &&
    // isActive 可选，但如果存在必须是布尔值
    (obj.isActive === undefined || typeof obj.isActive === 'boolean')
  );
}

/**
 * 检查值是否为有效的ChatMessage对象
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为ChatMessage类型
 * @example
 * ```typescript
 * const msg: unknown = { AI: "Hello", HUMAN: "Hi" };
 * if (isValidChatMessage(msg)) {
 *   console.log(msg.AI); // TypeScript知道msg是ChatMessage
 * }
 * ```
 */
export function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  
  // ChatMessage必须至少有AI或HUMAN其中之一
  const hasAI = hasProperty(obj, 'AI') && (obj.AI === undefined || isString(obj.AI));
  const hasHUMAN = hasProperty(obj, 'HUMAN') && (obj.HUMAN === undefined || isString(obj.HUMAN));
  
  if (!hasAI && !hasHUMAN) {
    return false;
  }
  
  // 验证可选字段
  return (
    (obj.id === undefined || isString(obj.id)) &&
    (obj.feedback === undefined || 
      obj.feedback === null || 
      obj.feedback === 'good' || 
      obj.feedback === 'bad') &&
    (obj.timestamp === undefined || isNumber(obj.timestamp))
  );
}

/**
 * 检查值是否为有效的ChatSession对象
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为ChatSession类型
 */
export function isValidChatSession(value: unknown): value is ChatSession {
  if (!isObject(value)) return false;
  
  const obj = value as Record<string, unknown>;
  
  // 检查必需字段
  if (!hasProperties(obj, ['id', 'messages'])) {
    return false;
  }
  
  return (
    isString(obj.id) &&
    isArrayOf(obj.messages, isValidChatMessage) &&
    // title 可选
    (obj.title === undefined || isString(obj.title)) &&
    // createdAt 可选
    (obj.createdAt === undefined || isNumber(obj.createdAt)) &&
    // updatedAt 可选
    (obj.updatedAt === undefined || isNumber(obj.updatedAt))
  );
}

/**
 * 检查值是否为有效的Agent数组
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为Agent[]
 */
export function isValidAgentArray(value: unknown): value is Agent[] {
  return isArrayOf(value, isValidAgent);
}

/**
 * 检查值是否为有效的ChatMessage数组
 * 
 * @param value - 待检查的值
 * @returns 类型谓词，true时value被收窄为ChatMessage[]
 */
export function isValidChatMessageArray(value: unknown): value is ChatMessage[] {
  return isArrayOf(value, isValidChatMessage);
}

/**
 * 创建默认的Agent对象（用于降级处理）
 * 
 * @param partial - 部分Agent属性
 * @returns 完整的Agent对象
 */
export function createDefaultAgent(partial: Partial<Agent> = {}): Agent {
  return {
    id: partial.id || 'default',
    name: partial.name || 'Default Agent',
    description: partial.description || '',
    model: partial.model || 'gpt-3.5-turbo',
    status: partial.status || 'inactive',
    capabilities: partial.capabilities || [],
    provider: partial.provider || 'openai',
    ...partial,
  };
}

/**
 * 创建默认的ChatMessage对象
 * 
 * @param partial - 部分ChatMessage属性
 * @returns 完整的ChatMessage对象
 */
export function createDefaultChatMessage(partial: Partial<ChatMessage> = {}): ChatMessage {
  return {
    AI: partial.AI,
    HUMAN: partial.HUMAN,
    id: partial.id,
    feedback: partial.feedback || null,
    timestamp: partial.timestamp || Date.now(),
    ...partial,
  };
}

