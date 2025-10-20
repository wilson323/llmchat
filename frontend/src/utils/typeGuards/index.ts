/**
 * 类型守卫工具库
 * 
 * 提供完整的TypeScript运行时类型检查能力
 * 用于实现类型安全的数据验证和处理
 * 
 * @module typeGuards
 */

// 基础类型守卫
export {
  isString,
  isNumber,
  isBoolean,
  isDefined,
  isNull,
  isUndefined,
  isFunction,
  isDate,
  isISODateString,
} from './primitives';

// 对象类型守卫
export {
  isObject,
  hasProperty,
  hasProperties,
  isRecord,
  getOrDefault,
  isEmptyObject,
  deepClone,
  safeMerge,
} from './objects';

// 数组类型守卫
export {
  isArray,
  isArrayOf,
  filterDefined,
  filterByType,
  isEmptyArray,
  isNonEmptyArray,
  first,
  last,
  unique,
  chunk,
} from './arrays';

// 实体类型守卫
export {
  isValidAgentStatus,
  isValidAgent,
  isValidChatMessage,
  isValidChatSession,
  isValidAgentArray,
  isValidChatMessageArray,
  createDefaultAgent,
  createDefaultChatMessage,
} from './entities';

