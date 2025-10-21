import { v4 as uuidv4 } from 'uuid';

/**
 * 常用工具常量
 */
const CONSTANTS = {
  BYTES_IN_KB: 1024,
  FILE_SIZE_UNITS: ['Bytes', 'KB', 'MB', 'GB', 'TB'],
  ELLIPSIS: '...',
  MAX_ID_LENGTH: 16,
  TRUNCATE_SUFFIX_LENGTH: 3,
  TIMESTAMP_DIVISOR: 1000,
} as const;

/**
 * 生成唯一ID
 */
export const generateId = (): string => {
  return uuidv4();
};

/**
 * 生成时间戳
 */
export const generateTimestamp = (): number => {
  return Math.floor(Date.now() / CONSTANTS.TIMESTAMP_DIVISOR);
};

/**
 * 验证URL格式
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 安全地解析JSON
 */
export const safeJsonParse = <T>(jsonString: string, defaultValue: T): T => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

/**
 * 延迟函数
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 获取错误消息
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};

/**
 * 清理对象中的undefined值
 */
export const cleanObject = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      cleaned[key as keyof T] = value as T[keyof T];
    }
  }
  return cleaned;
};

/**
 * 深拷贝对象
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * 检查是否为空对象
 */
export const isEmpty = (obj: unknown): boolean => {
  if (obj === null) {
    return true;
  }
  if (Array.isArray(obj) || typeof obj === 'string') {
    return obj.length === 0;
  }
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }
  return false;
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const i = Math.floor(Math.log(bytes) / Math.log(CONSTANTS.BYTES_IN_KB));

  return parseFloat((bytes / Math.pow(CONSTANTS.BYTES_IN_KB, i)).toFixed(2)) + ' ' + CONSTANTS.FILE_SIZE_UNITS[i];
};

/**
 * 截断字符串
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - CONSTANTS.TRUNCATE_SUFFIX_LENGTH) + CONSTANTS.ELLIPSIS;
};

/**
 * 转换为驼峰命名
 */
export const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * 转换为下划线命名
 */
export const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};