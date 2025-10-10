/**
 * 时间间隔常量 (毫秒)
 */

export const INTERVALS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,

  // 时间配置常量
  END_OF_DAY_HOUR: 23,
  END_OF_DAY_MINUTE: 59,
  END_OF_DAY_SECOND: 59,
  MILLISECOND_OF_DAY: 24 * 60 * 60 * 1000,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE_SIZE: 20,
  MIN_PASSWORD_LENGTH: 8,
  RANDOM_RANGE: 10000,
} as const;

export const TIME_CONSTANTS = INTERVALS;
export const TIME_UNITS = INTERVALS;

export const RATE_LIMITS = {
  WINDOW_MS: 15 * 60 * 1000, // 15分钟
  MAX_REQUESTS: 100,
} as const;

export const CACHE_TTL = {
  SHORT: 5 * 60 * 1000, // 5分钟
  MEDIUM: 30 * 60 * 1000, // 30分钟
  LONG: 2 * 60 * 60 * 1000, // 2小时
} as const;

// TIME_CONFIG 已合并到 INTERVALS 中，保持向后兼容
export const TIME_CONFIG = INTERVALS;