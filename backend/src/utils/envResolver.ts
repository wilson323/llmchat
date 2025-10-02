import logger from '@/utils/logger';

/**
 * 环境变量解析工具
 * 
 * 用于解析配置文件中的环境变量占位符，如 ${ENV_VAR}
 */

/**
 * 解析字符串中的环境变量占位符
 * 
 * @param value 包含占位符的字符串，如 "${DB_HOST}"
 * @param defaultValue 如果环境变量未设置，使用的默认值
 * @returns 解析后的值
 */
export function resolveEnvString(value: string, defaultValue?: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  // 匹配 ${VAR_NAME} 格式
  const envVarPattern = /\$\{([^}]+)\}/g;
  
  return value.replace(envVarPattern, (match, envVarName) => {
    const envValue = process.env[envVarName];
    
    if (envValue !== undefined) {
      return envValue;
    }
    
    if (defaultValue !== undefined) {
      logger.warn(`Environment variable ${envVarName} not set, using default`, {
        component: 'envResolver',
        envVarName,
        defaultValue,
      });
      return defaultValue;
    }
    
    logger.warn(`Environment variable ${envVarName} not set, keeping placeholder`, {
      component: 'envResolver',
      envVarName,
    });
    return match; // 保持原样
  });
}

/**
 * 解析对象中的所有环境变量占位符（递归）
 * 
 * @param obj 需要解析的对象
 * @returns 解析后的对象
 */
export function resolveEnvInObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return resolveEnvString(obj) as unknown as T;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveEnvInObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const resolved: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveEnvInObject(value);
    }
    
    return resolved as T;
  }

  return obj;
}

/**
 * 解析 JSONC 配置文件中的环境变量
 * 
 * 处理特殊的 JSONC 格式，如数字/布尔值的占位符：
 * - "port": ${DB_PORT}  -> 解析为数字
 * - "ssl": ${DB_SSL}    -> 解析为布尔值
 * 
 * @param configText JSONC 配置文件文本
 * @returns 解析后的配置文本
 */
export function resolveEnvInJsonc(configText: string): string {
  // 匹配 ${VAR_NAME} 格式
  const envVarPattern = /\$\{([^}]+)\}/g;
  
  return configText.replace(envVarPattern, (match, envVarName) => {
    const envValue = process.env[envVarName];
    
    if (envValue !== undefined) {
      // 检查上下文，判断是否应该返回原始值（不带引号）
      // 这适用于数字和布尔值的情况
      return envValue;
    }
    
    logger.warn(`Environment variable ${envVarName} not set, keeping placeholder`, {
      component: 'envResolver',
      envVarName,
    });
    return `"${match}"`; // 保持为字符串格式
  });
}

/**
 * 从环境变量解析数字
 * 
 * @param envVar 环境变量名
 * @param defaultValue 默认值
 * @returns 解析后的数字
 */
export function getEnvNumber(envVar: string, defaultValue: number): number {
  const value = process.env[envVar];
  if (!value) {
    return defaultValue;
  }
  
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    logger.warn(`Invalid number in environment variable ${envVar}, using default`, {
      component: 'envResolver',
      envVar,
      value,
      defaultValue,
    });
    return defaultValue;
  }
  
  return parsed;
}

/**
 * 从环境变量解析布尔值
 * 
 * @param envVar 环境变量名
 * @param defaultValue 默认值
 * @returns 解析后的布尔值
 */
export function getEnvBoolean(envVar: string, defaultValue: boolean): boolean {
  const value = process.env[envVar];
  if (!value) {
    return defaultValue;
  }
  
  const lowerValue = value.toLowerCase().trim();
  
  if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
    return true;
  }
  
  if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
    return false;
  }
  
  logger.warn(`Invalid boolean in environment variable ${envVar}, using default`, {
    component: 'envResolver',
    envVar,
    value,
    defaultValue,
  });
  return defaultValue;
}

/**
 * 从环境变量获取字符串
 * 
 * @param envVar 环境变量名
 * @param defaultValue 默认值
 * @returns 环境变量值或默认值
 */
export function getEnvString(envVar: string, defaultValue: string): string {
  return process.env[envVar] || defaultValue;
}

