/**
 * FastGPT 交互数据转换工具
 *
 * 将 SSE 事件中的 FastGPTInteractiveData 转换为前端 InteractiveData 格式
 */

import type { InteractiveData, InteractiveSelectParams, InteractiveInputParams } from '@/types';
import type { FastGPTInteractiveData } from '@/types/sse';

/**
 * 将 FastGPT 交互数据转换为前端 InteractiveData 格式
 *
 * @param fastgptData - 来自 SSE 事件的 FastGPT 交互数据
 * @returns 前端 InteractiveData 格式，如果无法转换则返回 null
 */
export function convertFastGPTInteractiveData(
  fastgptData: FastGPTInteractiveData,
): InteractiveData | null {
  // 根据 FastGPT 的交互类型映射到前端类型
  const { prompt, description, options, defaultValue } = fastgptData;

  // 如果有选项列表，映射为 userSelect 类型
  if (options && options.length > 0) {
    const selectParams: InteractiveSelectParams = {
      description: description || prompt,
      varKey: 'userSelect',
      userSelectOptions: options.map(opt => ({
        value: opt.value,
        label: opt.label,
      })),
    };

    return {
      type: 'userSelect',
      origin: 'chat',
      params: selectParams,
    };
  }

  // 否则映射为 userInput 类型
  const inputForm = [
    {
      type: 'input' as const,
      key: 'userInput',
      label: prompt,
      ...(defaultValue !== undefined && { defaultValue }),
    },
  ];

  const inputParams: InteractiveInputParams = {
    description: description || prompt,
    inputForm,
  };

  return {
    type: 'userInput',
    origin: 'chat',
    params: inputParams,
  };
}

/**
 * 类型守卫：检查是否为 FastGPT 交互数据
 */
export function isFastGPTInteractiveData(data: unknown): data is FastGPTInteractiveData {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    typeof obj.prompt === 'string'
  );
}
