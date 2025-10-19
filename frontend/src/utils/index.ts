/**
 * 类型守卫工具库统一导出
 *
 * 提供完整的类型守卫、验证器和性能优化工具的统一入口。
 * 确保LLMChat前端项目的类型安全和性能优化。
 *
 * @module type-guards
 * @version 2.0.0
 * @since 2025-10-18
 */

// ============================================================================
// 基础类型守卫
// ============================================================================

export {
  isDefined,
  isOfType,
  getOrDefault,
  filterDefined,
  isArrayOf,
  filterByType,
  assertDefined,
  assertType,
  isString,
  isNumber,
  isBoolean,
  isObject,
  hasProperty,
  safeJsonParse,
  createEnumGuard,
} from './type-guards';

// ============================================================================
// 高级类型守卫
// ============================================================================

export {
  createObjectGuard,
  createObjectValidator,
  createArrayGuard,
  createArrayValidator,
  createUnionGuard,
  createLiteralGuard,
  createNullableGuard,
  createRecordGuard,
  createConditionalGuard,
  createAsyncGuard,
  createAsyncValidator,
  createCachedGuard,
  createLazyGuard,
  isUUID,
  isEmail,
  isURL,
  isDateString,
  isTimestamp,
  isBase64,
} from './advanced-type-guards';

export type {
  ValidationResult,
  TypeValidator,
  SyncValidator,
  AsyncValidator,
  PropertyValidation,
  ObjectValidationConfig,
} from './advanced-type-guards';

// ============================================================================
// 运行时类型验证器
// ============================================================================

export {
  RuntimeTypeValidator,
  PathValidator,
  BatchValidator,
  stringValidator,
  numberValidator,
  booleanValidator,
  objectValidator,
  uuidValidator,
  emailValidator,
  urlValidator,
  dateStringValidator,
  timestampValidator,
  enumValidator,
  literalValidator,
  arrayValidator,
  createPathValidator,
  createBatchValidator,
} from './runtime-type-validator';

// ============================================================================
// API响应验证器
// ============================================================================

export {
  ApiResponseValidator,
  agentsListResponseValidator,
  agentDetailResponseValidator,
  agentConfigValidator,
  chatApiResponseValidator,
  chatHistoryResponseValidator,
  chatSessionResponseValidator,
  userPreferencesResponseValidator,
  statsResponseValidator,
  auditLogsResponseValidator,
  healthCheckResponseValidator,
  agentHealthStatusResponseValidator,
  apiErrorResponseValidator,
  createApiResponseValidator,
  createPaginatedDataValidator,
  createApiClientWrapper,
} from './api-type-validators';

// ============================================================================
// React组件Props验证器
// ============================================================================

export {
  PropsValidator,
  usePropsValidation,
  useSafeProps,
  createPropsValidator,
  propsValidatorBuilder,
  basePropsValidator,
  buttonPropsValidator,
  inputPropsValidator,
  dialogPropsValidator,
  tablePropsValidator,
} from './react-props-validator';

export type {
  PropValidationConfig,
  PropsValidatorConfig,
  PropsValidationResult,
} from './react-props-validator';

// ============================================================================
// Store状态验证器
// ============================================================================

export {
  StoreTypeValidator,
  useStoreValidation,
  createValidatedStore,
  validatePersistedState,
  createStateSnapshot,
  validateStateSnapshot,
  StateMigrationStrategy,
  createStateMigrationStrategy,
} from './store-type-validator';

export type {
  StoreValidationResult,
  StoreValidatorMiddlewareConfig,
} from './store-type-validator';

// ============================================================================
// 性能优化工具
// ============================================================================

export {
  LRUCache,
  CacheManager,
  PerformanceMetricsCollector,
  PerformanceMonitor,
  OptimizedTypeValidator,
  LazyValidatorFactory,
  BatchValidationProcessor,
  createOptimizedValidator,
  createLazyValidator,
  createBatchProcessor,
  getPerformanceMonitor,
  warmupValidatorCache,
} from './type-guards-performance';

export type {
  PerformanceConfig,
  PerformanceMetrics,
  PerformanceReport,
} from './type-guards-performance';

// ============================================================================
// 便捷组合导出
// ============================================================================

/**
 * 快速创建常用的验证器组合
 */
export const QuickValidators = {
  /**
   * 创建用户验证器
   */
  user: () => {
    const { createObjectValidator, isString, isEmail, isUUID, createArrayGuard } = require('./advanced-type-guards');

    return createObjectValidator({
      id: { validator: isUUID, required: true },
      name: { validator: isString, required: true },
      email: { validator: isEmail, required: true },
      roles: {
        validator: createArrayGuard(isString),
        required: false,
        defaultValue: []
      }
    });
  },

  /**
   * 创建API响应验证器
   */
  apiResponse: <T>(dataValidator: any) => {
    const { createApiResponseValidator } = require('./api-type-validators');
    return createApiResponseValidator(dataValidator);
  },

  /**
   * 创建分页数据验证器
   */
  paginatedData: <T>(itemValidator: any) => {
    const { createPaginatedDataValidator } = require('./api-type-validators');
    return createPaginatedDataValidator(itemValidator);
  },

  /**
   * 创建组件Props验证器
   */
  props: <T extends Record<string, any>>() => {
    const { createPropsValidator } = require('./react-props-validator');
    return createPropsValidator<T>();
  }
};

/**
 * 性能优化的验证器工厂
 */
export const PerformanceValidators = {
  /**
   * 创建缓存验证器
   */
  cached: <T>(validator: any, maxSize = 100) => {
    const { createCachedGuard } = require('./advanced-type-guards');
    return createCachedGuard(validator, maxSize);
  },

  /**
   * 创建惰性验证器
   */
  lazy: <T>(factory: () => any) => {
    const { createLazyGuard } = require('./advanced-type-guards');
    return createLazyGuard(factory);
  },

  /**
   * 创建优化的验证器
   */
  optimized: <T>(validator: any, config?: any) => {
    const { createOptimizedValidator } = require('./type-guards-performance');
    return createOptimizedValidator(validator, config);
  }
};

/**
 * 开发环境工具
 */
export const DevTools = {
  /**
   * 调试验证结果
   */
  debugValidation: <T>(result: any, context = 'Unknown') => {
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔍 Validation Debug [${context}]`);
      console.log('Valid:', result.isValid);
      if (!result.isValid) {
        console.error('Errors:', result.errors);
      }
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Warnings:', result.warnings);
      }
      console.log('Data:', result.data);
      console.groupEnd();
    }
    return result;
  },

  /**
   * 性能监控
   */
  performanceMonitor: () => {
    const { getPerformanceMonitor } = require('./type-guards-performance');
    return getPerformanceMonitor();
  },

  /**
   * 缓存统计
   */
  cacheStats: () => {
    const { CacheManager } = require('./type-guards-performance');
    return CacheManager.getInstance().getCacheStats();
  }
};

/**
 * 类型安全工具函数
 */
export const TypeSafety = {
  /**
   * 安全的类型转换
   */
  safeCast: <T>(value: unknown, validator: (val: unknown) => val is T): T | null => {
    return validator(value) ? value : null;
  },

  /**
   * 类型断言包装器
   */
  assert: <T>(value: unknown, validator: (val: unknown) => val is T, message?: string): asserts value is T => {
    if (!validator(value)) {
      throw new TypeError(message || `Type assertion failed`);
    }
  },

  /**
   * 条件类型守卫
   */
  conditional: <T, U>(
    condition: (val: unknown) => boolean,
    trueValidator: (val: unknown) => val is T,
    falseValidator: (val: unknown) => val is U
  ) => {
    return (val: unknown): val is T | U => {
      return condition(val) ? trueValidator(val) : falseValidator(val);
    };
  }
};

// ============================================================================
// 版本信息
// ============================================================================

export const VERSION = '2.0.0';

/**
 * 库信息
 */
export const LIB_INFO = {
  name: '@llmchat/type-guards',
  version: VERSION,
  description: 'LLMChat前端类型守卫工具库',
  author: 'LLMChat Team',
  repository: 'https://github.com/llmchat/frontend',
  license: 'MIT'
};

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 获取默认性能配置
 */
export const getDefaultPerformanceConfig = () => {
  const { DEFAULT_PERFORMANCE_CONFIG } = require('./type-guards-performance');
  return DEFAULT_PERFORMANCE_CONFIG;
};

/**
 * 获取缓存管理器实例
 */
export const getCacheManager = () => {
  const { CacheManager } = require('./type-guards-performance');
  return CacheManager.getInstance();
};

/**
 * 获取性能监控器实例
 */
export const getPerformanceMonitorInstance = () => {
  const { getPerformanceMonitor } = require('./type-guards-performance');
  return getPerformanceMonitor();
};

// ============================================================================
// 初始化函数
// ============================================================================

/**
 * 初始化类型守卫工具库
 */
export const initialize = (config?: {
  enablePerformanceMonitoring?: boolean;
  performanceConfig?: Partial<typeof getDefaultPerformanceConfig>;
  enableDevTools?: boolean;
}) => {
  const {
    enablePerformanceMonitoring = process.env.NODE_ENV === 'development',
    performanceConfig = {},
    enableDevTools = process.env.NODE_ENV === 'development'
  } = config || {};

  // 设置性能配置
  if (enablePerformanceMonitoring) {
    const monitor = getPerformanceMonitorInstance();
    monitor.startMonitoring();
  }

  // 更新缓存管理器配置
  const cacheManager = getCacheManager();
  cacheManager.updateConfig({
    ...getDefaultPerformanceConfig(),
    ...performanceConfig
  });

  // 开发环境工具
  if (enableDevTools) {
    // 在开发环境下，将工具挂载到全局对象以便调试
    if (typeof window !== 'undefined') {
      (window as any).__TYPE_GUARDS_DEVTOOLS__ = {
        DevTools,
        QuickValidators,
        PerformanceValidators,
        TypeSafety,
        getCacheManager: getCacheManager,
        getPerformanceMonitor: getPerformanceMonitorInstance
      };
    }
  }

  return {
    version: VERSION,
    performanceMonitoring: enablePerformanceMonitoring,
    devTools: enableDevTools
  };
};

// ============================================================================
// 类型守卫工具库完整导出
// ============================================================================

export default {
  // 基础工具
  ...require('./type-guards'),

  // 高级工具
  ...require('./advanced-type-guards'),

  // 运行时验证
  ...require('./runtime-type-validator'),

  // API验证
  ...require('./api-type-validators'),

  // React验证
  ...require('./react-props-validator'),

  // Store验证
  ...require('./store-type-validator'),

  // 性能优化
  ...require('./type-guards-performance'),

  // 便捷工具
  QuickValidators,
  PerformanceValidators,
  DevTools,
  TypeSafety,

  // 工具函数
  initialize,
  getDefaultPerformanceConfig,
  getCacheManager,
  getPerformanceMonitorInstance,

  // 元数据
  VERSION,
  LIB_INFO
};