/**
 * 动态加载可选模块的工具函数
 */

import { createErrorFromUnknown } from '@/types/errors';

/**
 * 安全地加载可选模块
 * @param moduleName 模块名称
 * @returns 模块实例或null
 */
export async function loadOptionalModule<T>(moduleName: string): Promise<T | null> {
  try {
    const module = await import(moduleName);
    return module.default || module;
  } catch (unknownError: unknown) {
    const _error = createErrorFromUnknown(unknownError, {
      component: 'loadOptionalModule',
      operation: 'loadOptionalModule',
    });
    return null;
  }
}
