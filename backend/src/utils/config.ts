import fs from 'fs/promises';
import path from 'path';

/**
 * 读取带注释的 JSONC 配置文件并解析为对象
 * 支持环境变量占位符 ${VAR_NAME}
 */
export async function readJsonc<T = any>(configRelativePath: string): Promise<T> {
  const fullPath = path.isAbsolute(configRelativePath)
    ? configRelativePath
    : path.join(__dirname, '../../../', configRelativePath);
  const raw = await fs.readFile(fullPath, 'utf-8');
  const stripped = stripJsonComments(raw);

  // 替换环境变量占位符 "${VAR_NAME}" 或 ${VAR_NAME}
  const replaced = stripped.replace(/"?\$\{([^}]+)\}"?/g, (match, varName) => {
    // 清理变量名中的空白字符（包括换行符）
    const cleanVarName = varName.trim().replace(/\s+/g, '');
    const value = process.env[cleanVarName];
    if (value === undefined) {
      // 使用logger而非console.warn
      return match;
    }

    // 检查原始匹配是否包含引号
    const hasQuotes = match.startsWith('"') && match.endsWith('"');

    // 如果值看起来像数字或布尔值
    if (value === 'true' || value === 'false' || /^\d+$/.test(value)) {
      // 如果原本有引号，移除它们（因为数字和布尔值不需要引号）
      return value;
    }

    // 字符串值
    if (hasQuotes) {
      // 已经有引号，只替换值
      return `"${value.replace(/"/g, '\\"')}"`;
    } else {
      // 没有引号，直接返回值（通常不会发生）
      return value;
    }
  });

  return JSON.parse(replaced) as T;
}

/**
 * 简单去除 // 和 /* *\/ 样式注释
 * 注意：该实现针对配置文件足够，勿用于复杂 JS 代码解析
 */
export function stripJsonComments(input: string): string {
  // 去除多行注释 /* ... */
  let output = input.replace(/\/\*[\s\S]*?\*\//g, '');
  // 去除单行注释 //...
  output = output.replace(/^\s*\/\/.*$/gm, '');
  return output;
}
