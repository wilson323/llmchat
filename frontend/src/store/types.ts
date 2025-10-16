/**
 * Store 类型定义文件
 *
 * 提供统一的Store基础类型和工具函数
 * 确保所有Store的类型安全性和一致性
 */

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * Store基础状态类型
 */
export interface BaseStoreState {
  id: string;
  version: string;
  lastUpdated: number;
}

/**
 * Store基础Action类型
 */
export interface BaseStoreActions {
  reset: () => void;
  getState: () => any;
  setState: (state: any) => void;
}

/**
 * 完整的Store类型
 */
export type BaseStore<TState = any, TActions = any> = TState & TActions;

// ============================================================================
// Zustand类型辅助
// ============================================================================

/**
 * 类型安全的SetState函数
 */
export type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean
) => void;

/**
 * 类型安全的GetState函数
 */
export type GetState<T> = () => T;

/**
 * Store创建函数类型
 */
export type StoreCreator<TState, TActions> = (
  set: SetState<TState & TActions>,
  get: GetState<TState & TActions>
) => TState & TActions;

// ============================================================================
// 持久化类型
// ============================================================================

/**
 * 持久化配置接口
 */
export interface PersistConfig<T> {
  name: string;
  version?: number;
  partialize?: (state: T) => Partial<T>;
  onRehydrateStorage?: () => (state: T | undefined) => void;
  migrate?: (persistedState: any, version: number) => T | Promise<T>;
}

/**
 * 持久化Store类型
 */
export type PersistedStore<T> = T & {
  persist: {
    rehydrate: () => Promise<void>;
    hasHydrated: () => boolean;
    onHydrate: (fn: (state: T) => void) => void;
    onFinishHydration: (fn: (state: T) => void) => void;
  };
}

// ============================================================================
// 错误处理类型
// ============================================================================

/**
 * Store错误类型
 */
export interface StoreError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Store状态类型
 */
export type StoreStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// 通用工具类型
// ============================================================================

/**
 * 提取Store状态类型
 */
export type ExtractState<T> = T extends BaseStore<infer S, any> ? S : never;

/**
 * 提取Store Actions类型
 */
export type ExtractActions<T> = T extends BaseStore<any, infer A> ? A : never;

/**
 * 创建Store类型
 */
export type CreateStoreType<TState, TActions> = BaseStore<TState, TActions>;

/**
 * 持久化Store类型
 */
export type CreatePersistedStoreType<TState, TActions> = PersistedStore<BaseStore<TState, TActions>>;

// ============================================================================
// Store工厂函数类型
// ============================================================================

/**
 * Store工厂配置
 */
export interface StoreFactoryConfig<TState, TActions> {
  name: string;
  initialState: TState;
  actions: (set: SetState<TState & TActions>, get: GetState<TState & TActions>) => TActions;
  persist?: PersistConfig<TState & TActions>;
}

/**
 * Store工厂函数类型
 */
export type StoreFactory = <TState, TActions>(
  config: StoreFactoryConfig<TState, TActions>
) => BaseStore<TState, TActions>;

// ============================================================================
// 常用Store状态
// ============================================================================

/**
 * 异步操作状态
 */
export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: StoreError | null;
  status: StoreStatus;
}

/**
 * 异步操作Actions
 */
export interface AsyncActions<T = any> {
  setLoading: (loading: boolean) => void;
  setError: (error: StoreError | null) => void;
  setData: (data: T) => void;
  reset: () => void;
}

/**
 * 异步Store类型
 */
export type AsyncStore<T = any> = BaseStore<AsyncState<T>, AsyncActions<T>>;

// ============================================================================
// 中间件类型
// ============================================================================

/**
 * Store中间件类型
 */
export type StoreMiddleware<T> = (
  config: any,
  options?: any
) => (stateCreator: StoreCreator<any, any>) => T;

/**
 * 开发工具中间件配置
 */
export interface DevtoolsOptions {
  name?: string;
  enabled?: boolean;
  serialize?: boolean;
  trace?: boolean;
}

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 检查是否为Store
 */
export function isStore<T>(obj: any): obj is BaseStore<T> {
  return obj && typeof obj === 'object' && typeof obj.getState === 'function';
}

/**
 * 检查是否为持久化Store
 */
export function isPersistedStore<T>(obj: any): obj is PersistedStore<T> {
  return isStore(obj) && obj.persist && typeof obj.persist.rehydrate === 'function';
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * 默认持久化配置
 */
export const DEFAULT_PERSIST_CONFIG: Partial<PersistConfig<any>> = {
  version: 1,
  partialize: (state) => state,
};

/**
 * 默认开发工具配置
 */
export const DEFAULT_DEVTOOLS_CONFIG: DevtoolsOptions = {
  name: 'Store',
  enabled: process.env.NODE_ENV === 'development',
  serialize: true,
  trace: false,
};