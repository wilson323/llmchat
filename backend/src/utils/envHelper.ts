/**
 * 环境变量处理工具
 * 提供安全的环境变量替换和验证功能
 */

/**
 * 替换字符串中的环境变量占位符
 * 支持 ${VARIABLE_NAME} 格式的占位符
 * @param input 包含环境变量占位符的字符串
 * @param defaultValue 当环境变量未定义时的默认值
 * @returns 替换后的字符串
 */
export function replaceEnvVariables(input: string, defaultValue?: string): string {
  return input.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    const value = process.env[envVar];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      // 如果没有默认值，返回原始占位符（保持向后兼容）
      console.warn(`环境变量未定义: ${envVar}`);
      return match;
    }
    return value;
  });
}

/**
 * 递归替换对象中的所有环境变量占位符
 * @param obj 需要处理的对象
 * @returns 处理后的对象
 */
export function deepReplaceEnvVariables<T>(obj: T): T {
  if (typeof obj === 'string') {
    return replaceEnvVariables(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepReplaceEnvVariables(item)) as T;
  }

  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplaceEnvVariables(value);
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
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
  }
}

/**
 * 安全获取环境变量
 * @param key 环境变量键
 * @param defaultValue 默认值
 * @returns 环境变量值或默认值
 */
export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value;
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