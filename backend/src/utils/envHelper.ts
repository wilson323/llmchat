/**
 * 环境变量处理工具
 * 提供安全的环境变量替换和验证功能
 *
 * 高可用特性:
 * - 使用EnvManager统一管理
 * - 支持降级默认值
 * - 敏感信息自动脱敏
 */

import logger from '@/utils/logger';
import { EnvManager } from '@/config/EnvManager';

/**
 * 替换字符串中的环境变量占位符
 * 支持 ${VARIABLE_NAME} 格式的占位符
 * @param input 包含环境变量占位符的字符串
 * @param defaultValue 当环境变量未定义时的默认值
 * @param silent 是否静默模式（不记录警告）
 * @returns 替换后的字符串
 */
export function replaceEnvVariables(input: string, defaultValue?: string, silent = false): string {
  const envManager = EnvManager.getInstance();

  return input.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    // 使用EnvManager获取环境变量
    const value = envManager.has(envVar) ? envManager.get(envVar) : undefined;

    if (value === undefined || value === '') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      // 如果没有默认值，返回原始占位符（保持向后兼容）
      // 只有非静默模式才记录警告
      if (!silent) {
        logger.warn('环境变量未定义，保留占位符', {
          envVar,
          placeholder: match,
          suggestion: `请在.env文件中设置 ${envVar}`,
        });
      }
      return match;
    }

    // 敏感信息脱敏日志
    if (!silent && !envManager.isDevelopment()) {
      const isSensitive = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'API_KEY'].some(
        pattern => envVar.toUpperCase().includes(pattern),
      );
      if (isSensitive) {
        logger.debug('环境变量已替换', { envVar, value: '***REDACTED***' });
      }
    }

    return value;
  });
}

/**
 * 递归替换对象中的所有环境变量占位符
 * @param obj 需要处理的对象
 * @param silent 是否静默模式（不记录警告）
 * @returns 处理后的对象
 */
export function deepReplaceEnvVariables<T>(obj: T, silent = false): T {
  if (typeof obj === 'string') {
    return replaceEnvVariables(obj, undefined, silent) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepReplaceEnvVariables(item, silent)) as T;
  }

  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplaceEnvVariables(value, silent);
    }
    return result;
  }

  return obj;
}

/**
 * 验证必需的环境变量
 * @param requiredVars 必需的环境变量列表
 * @throws 如果必需的环境变量未定义
 */
export function validateRequiredEnvVars(requiredVars: string[]): void {
  const envManager = EnvManager.getInstance();
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!envManager.has(varName)) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const error = new Error(
      `缺少必需的环境变量: ${missing.join(', ')}\n` +
      '请在根目录 .env 文件中设置这些变量，参考 .env.example',
    );
    logger.error('环境变量验证失败', { missing });
    throw error;
  }

  logger.info('环境变量验证通过', { checked: requiredVars.length });
}

/**
 * 安全获取环境变量 (兼容旧代码)
 * @param key 环境变量键
 * @param defaultValue 默认值
 * @returns 环境变量值或默认值
 * @deprecated 建议使用 EnvManager.getInstance().get(key, defaultValue)
 */
export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  const envManager = EnvManager.getInstance();
  return envManager.get(key, defaultValue ?? '');
}

/**
 * 检查字符串中是否包含未替换的环境变量占位符
 * @param str 要检查的字符串
 * @returns 是否包含未替换的占位符
 */
export function containsUnresolvedPlaceholders(str: string): boolean {
  return /\$\{[^}]+\}/.test(str);
}

/**
 * 获取字符串中的所有环境变量占位符
 * @param str 要分析的字符串
 * @returns 环境变量名数组
 */
export function extractEnvPlaceholders(str: string): string[] {
  const matches = str.match(/\$\{([^}]+)\}/g);
  return matches ? matches.map(match => match.slice(2, -1)) : [];
}