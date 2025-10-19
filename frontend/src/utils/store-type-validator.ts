/**
 * Store状态类型验证工具
 *
 * 专门为Zustand等状态管理库设计的状态验证工具。
 * 确保Store状态的结构完整性、类型一致性和数据有效性。
 *
 * @module store-type-validator
 * @version 2.0.0
 * @since 2025-10-18
 */

import React from 'react';
import { RuntimeTypeValidator, objectValidatorFactory, createBatchValidator } from './runtime-type-validator';
import { BaseStoreState, BaseStoreActions, StoreError, StoreStatus } from '@/store/types';

// ============================================================================
// Store验证配置类型
// ============================================================================

/**
 * Store状态验证配置
 */
export interface StoreStateValidationConfig<T extends Record<string, any>> {
  displayName?: string;
  strict?: boolean;
  onValidationError?: (errors: string[], state: unknown) => void;
  onValidationWarning?: (warnings: string[], state: unknown) => void;
  enableAutoFix?: boolean;
  migrationStrategies?: Array<{
    version: string;
    migrate: (state: unknown) => T;
  }>;
}

/**
 * Store验证结果
 */
export interface StoreValidationResult<T = unknown> {
  isValid: boolean;
  validatedState?: T;
  errors: string[];
  warnings: string[];
  migrated?: boolean;
  migrationVersion?: string;
}

/**
 * Store中间件配置
 */
export interface StoreValidatorMiddlewareConfig<T extends Record<string, unknown>> {
  stateValidator: RuntimeTypeValidator<T>;
  actionsValidator?: RuntimeTypeValidator<unknown>;
  onStateChange?: (newState: T, oldState: T) => void;
  onError?: (error: Error, context: string) => void;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

// ============================================================================
// Store验证器核心类
// ============================================================================

/**
 * Store状态验证器类
 */
export class StoreTypeValidator<T extends Record<string, any> = Record<string, any>> {
  private stateValidator: RuntimeTypeValidator<T>;
  private config: StoreStateValidationConfig<T>;
  private migrationHistory: string[] = [];

  constructor(
    stateValidator: RuntimeTypeValidator<T>,
    config: StoreStateValidationConfig<T> = {}
  ) {
    this.stateValidator = stateValidator;
    this.config = {
      strict: false,
      enableAutoFix: false,
      ...config
    };
  }

  /**
   * 验证Store状态
   */
  validate(state: unknown): StoreValidationResult<T> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 尝试状态迁移
    let processedState = state;
    let migrated = false;
    let migrationVersion: string | undefined;

    if (this.config.migrationStrategies) {
      for (const strategy of this.config.migrationStrategies) {
        try {
          // 检查是否需要迁移
          if (this.needsMigration(processedState, strategy.version)) {
            processedState = strategy.migrate(processedState);
            migrated = true;
            migrationVersion = strategy.version;
            this.migrationHistory.push(strategy.version);
            warnings.push(`State migrated to version ${strategy.version}`);
          }
        } catch (error) {
          errors.push(
            `Migration to version ${strategy.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    // 验证最终状态
    const validationResult = this.stateValidator.test(processedState);

    if (!validationResult.isValid) {
      errors.push(...(validationResult.errors || []));

      // 尝试自动修复
      if (this.config.enableAutoFix) {
        try {
          const fixedState = this.attemptAutoFix(processedState, errors);
          const fixedValidation = this.stateValidator.test(fixedState);

          if (fixedValidation.isValid) {
            processedState = fixedState;
            warnings.push('State auto-fixed');
          }
        } catch (fixError) {
          errors.push(`Auto-fix failed: ${fixError instanceof Error ? fixError.message : 'Unknown error'}`);
        }
      }
    }

    // 处理验证结果
    if (errors.length > 0 && this.config.onValidationError) {
      this.config.onValidationError(errors, processedState);
    }

    if (warnings.length > 0 && this.config.onValidationWarning) {
      this.config.onValidationWarning(warnings, processedState);
    }

    return {
      isValid: errors.length === 0,
      validatedState: errors.length === 0 ? processedState as T : undefined,
      errors,
      warnings,
      migrated,
      migrationVersion
    };
  }

  /**
   * 检查是否需要迁移
   */
  private needsMigration(state: unknown, targetVersion: string): boolean {
    // 简单的版本检查逻辑，可以根据实际需求调整
    if (state && typeof state === 'object' && '_version' in state) {
      const currentVersion = (state as { _version?: string })._version || '0.0.0';
      return currentVersion !== targetVersion;
    }
    return true; // 没有版本信息时需要迁移
  }

  /**
   * 尝试自动修复状态
   */
  private attemptAutoFix(state: unknown, errors: string[]): T {
    // 这是一个示例实现，实际项目中需要根据具体的数据结构来实现
    if (!state || typeof state !== 'object') {
      return {} as T;
    }
    
    const fixedState = { ...(state as object) };

    // 示例：修复缺失的必需属性
    for (const error of errors) {
      if (error.includes('missing') || error.includes('required')) {
        // 可以根据错误信息来推断缺失的属性并设置默认值
      }
    }

    return fixedState as T;
  }

  /**
   * 创建Store中间件
   */
  createMiddleware(config: StoreValidatorMiddlewareConfig<T>) {
    const history: T[] = [];
    const maxHistorySize = config.maxHistorySize || 50;

    type SetFn = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
    type GetFn = () => T;
    
    return (set: SetFn, get: GetFn) => (args: unknown) => {
      const originalSet = set;
      const originalGet = get;

      const wrappedSet = (...setArgs: unknown[]) => {
        const newState = setArgs[0];
        const oldState = originalGet();

        // 验证新状态
        if (typeof newState === 'object' && newState !== null) {
          const validation = this.validate(newState);

          if (!validation.isValid) {
            const error = new Error(
              `Store state validation failed: ${validation.errors.join(', ')}`
            );

            if (config.onError) {
              config.onError(error, 'state_update');
            } else {
              console.error(error);
            }

            // 在严格模式下阻止无效状态更新
            if (this.config.strict) {
              throw error;
            }
          }

          // 使用验证后的状态
          if (validation.validatedState) {
            setArgs[0] = validation.validatedState;
          }
        }

        // 执行原始set
        const result = originalSet(...setArgs);

        // 记录历史
        if (config.enableHistory) {
          const currentState = originalGet();
          history.push(currentState);

          // 限制历史记录大小
          if (history.length > maxHistorySize) {
            history.shift();
          }
        }

        // 触发状态变化回调
        if (config.onStateChange) {
          const finalState = originalGet();
          config.onStateChange(finalState, oldState);
        }

        return result;
      };

      // 返回包装后的参数
      if (typeof args === 'function') {
        return args(wrappedSet, originalGet);
      } else {
        return wrappedSet;
      }
    };
  }

  /**
   * 获取迁移历史
   */
  getMigrationHistory(): string[] {
    return [...this.migrationHistory];
  }

  /**
   * 清除迁移历史
   */
  clearMigrationHistory(): void {
    this.migrationHistory = [];
  }
}

// ============================================================================
// Store状态验证工具函数
// ============================================================================

/**
 * 创建Store状态验证器
 */
export const createStoreValidator = <T extends Record<string, any>>(
  stateValidator: RuntimeTypeValidator<T>,
  config?: StoreStateValidationConfig<T>
): StoreTypeValidator<T> => {
  return new StoreTypeValidator(stateValidator, config);
};

/**
 * 验证持久化状态
 */
export const validatePersistedState = <T>(
  persistedState: unknown,
  validator: StoreTypeValidator<T>
): StoreValidationResult<T> => {
  try {
    // 解析JSON字符串（如果需要）
    const state = typeof persistedState === 'string'
      ? JSON.parse(persistedState)
      : persistedState;

    return validator.validate(state);
  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to parse persisted state: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      migrated: false
    };
  }
};

/**
 * 创建状态快照
 */
export const createStateSnapshot = <T extends Record<string, any>>(state: T): {
  timestamp: number;
  version: string;
  state: T;
  checksum: string;
} => {
  const timestamp = Date.now();
  const version = state._version || '1.0.0';
  const checksum = btoa(JSON.stringify(state)).slice(0, 16);

  return {
    timestamp,
    version,
    state,
    checksum
  };
};

/**
 * 验证状态快照
 */
export const validateStateSnapshot = <T>(
  snapshot: unknown,
  validator: StoreTypeValidator<T>
): StoreValidationResult<T> => {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid snapshot format'],
      warnings: [],
      migrated: false
    };
  }

  const snapshotObj = snapshot as any;
  const { state, timestamp, version, checksum } = snapshotObj;

  // 验证快照结构
  if (!state || typeof timestamp !== 'number' || typeof version !== 'string') {
    return {
      isValid: false,
      errors: ['Invalid snapshot structure'],
      warnings: [],
      migrated: false
    };
  }

  // 验证状态
  const stateValidation = validator.validate(state);

  if (!stateValidation.isValid) {
    return stateValidation;
  }

  // 验证校验和（可选）
  const expectedChecksum = btoa(JSON.stringify(state)).slice(0, 16);
  if (checksum !== expectedChecksum) {
    return {
      isValid: false,
      errors: ['Snapshot checksum mismatch'],
      warnings: [],
      migrated: false
    };
  }

  return {
    isValid: true,
    validatedState: state,
    errors: [],
    warnings: [],
    migrated: false
  };
};

// ============================================================================
// Zustand专用工具
// ============================================================================

/**
 * Zustand状态验证Hook
 */
export const useStoreValidation = <T extends Record<string, any>>(
  store: { getState: () => T },
  validator: StoreTypeValidator<T>,
  options: {
    validateOnMount?: boolean;
    validateOnChange?: boolean;
    onError?: (errors: string[]) => void;
  } = {}
) => {
  const { validateOnMount = true, validateOnChange = true, onError } = options;

  // 验证状态
  const validateState = (state: T) => {
    const result = validator.validate(state);

    if (!result.isValid && onError) {
      onError(result.errors);
    }

    return result;
  };

  // 组件挂载时验证
  React.useEffect(() => {
    if (validateOnMount) {
      const currentState = store.getState();
      validateState(currentState);
    }
  }, [validateOnMount, store]);

  // 监听状态变化
  React.useEffect(() => {
    if (!validateOnChange) return;

    const unsubscribe = store.subscribe(() => {
      const currentState = store.getState();
      validateState(currentState);
    });

    return unsubscribe;
  }, [validateOnChange, store]);
};

/**
 * 创建带有验证的Zustand store
 */
export const createValidatedStore = <T extends Record<string, unknown>, A extends Record<string, unknown>>(
  initialState: T,
  actions: (set: (partial: Partial<T & A> | ((state: T & A) => Partial<T & A>)) => void, get: () => T & A) => A,
  validator: StoreTypeValidator<T>,
  options: {
    name?: string;
    persist?: unknown;
    devtools?: unknown;
  } = {}
) => {
  const { name = 'ValidatedStore', persist, devtools } = options;

  // 创建验证中间件
  const validationMiddleware = validator.createMiddleware({
    stateValidator: validator['stateValidator'],
    onError: (error, context) => {
      console.error(`[${name}] ${context}:`, error);
    }
  });

  // 创建store
  const createStore = require('zustand').default;
  const create = createStore;

  // 组合中间件
  let middlewareArray = [validationMiddleware];

  if (devtools) {
    const devtoolsMiddleware = require('zustand/middleware').devtools;
    middlewareArray.push(devtoolsMiddleware({ name }));
  }

  if (persist) {
    const persistMiddleware = require('zustand/middleware').persist;
    const persistConfig = {
      name: name.toLowerCase(),
      ...persist,
      onRehydrateStorage: () => (state: T | undefined) => {
        if (state) {
          const validation = validator.validate(state);
          if (!validation.isValid) {
            console.error(`[${name}] Rehydrated state validation failed:`, validation.errors);
          }
        }
      }
    };
    middlewareArray.push(persistMiddleware(persistConfig));
  }

  // 组合所有中间件
  type SetFn = (partial: Partial<T & A> | ((state: T & A) => Partial<T & A>)) => void;
  type GetFn = () => T & A;
  
  const combinedMiddleware = (set: SetFn, get: GetFn) => {
    let result = actions(set, get);

    for (const middleware of middlewareArray) {
      const middlewareResult = middleware(set, get);
      if (middlewareResult) {
        set = middlewareResult.set || set;
        get = middlewareResult.get || get;
      }
    }

    return { ...initialState, ...result };
  };

  return create(combinedMiddleware);
};

// ============================================================================
// 状态迁移工具
// ============================================================================

/**
 * 状态迁移策略
 */
export class StateMigrationStrategy<T> {
  private strategies: Map<string, (state: unknown) => T> = new Map();

  /**
   * 添加迁移策略
   */
  addMigration(version: string, migrateFn: (state: unknown) => T): this {
    this.strategies.set(version, migrateFn);
    return this;
  }

  /**
   * 执行迁移
   */
  migrate(state: unknown, targetVersion: string): T {
    let currentState = state;
    let migrated = false;

    // 按版本顺序执行迁移
    for (const [version, migrateFn] of this.strategies) {
      if (this.compareVersions(version, targetVersion) <= 0) {
        try {
          currentState = migrateFn(currentState);
          migrated = true;
        } catch (error) {
          throw new Error(
            `Migration to version ${version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    if (migrated) {
      // 更新版本号
      (currentState as any)._version = targetVersion;
    }

    return currentState as T;
  }

  /**
   * 比较版本号
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }
}

/**
 * 创建状态迁移策略
 */
export const createStateMigrationStrategy = <T>(): StateMigrationStrategy<T> => {
  return new StateMigrationStrategy<T>();
};

