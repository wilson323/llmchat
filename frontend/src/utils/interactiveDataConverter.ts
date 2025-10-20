/**
 * FastGPT交互数据转换工具
 * 
 * 用于将FastGPT返回的交互数据转换为前端统一格式
 */

/**
 * 转换FastGPT交互数据为前端格式
 * 
 * @param interactiveData - FastGPT返回的交互数据
 * @returns 转换后的前端格式数据，或null（如果数据无效）
 */
export function convertFastGPTInteractiveData(interactiveData: unknown): unknown | null {
  // 基础验证
  if (!interactiveData || typeof interactiveData !== 'object') {
    return null;
  }

  try {
    // 直接返回数据（假设FastGPT数据格式已经是前端可用的）
    // TODO: 如果需要特殊转换，在这里添加转换逻辑
    return interactiveData;
  } catch (error) {
    console.error('转换FastGPT交互数据失败:', error);
    return null;
  }
}

