/**
 * CAD 聊天服务
 *
 * 处理 CAD 智能体与聊天界面的集成
 */

import axios from 'axios';
import type { DxfEntity, CadOperationResult } from '@llmchat/shared-types';

export interface CadChatContext {
  fileId: string | null;
  entities: DxfEntity[];
  selectedEntityId: string | null;
}

export class CadChatService {
  private context: CadChatContext = {
    fileId: null,
    entities: [],
    selectedEntityId: null,
  };

  /**
   * 设置 CAD 上下文
   */
  setContext(context: Partial<CadChatContext>) {
    this.context = { ...this.context, ...context };
  }

  /**
   * 获取当前上下文
   */
  getContext(): CadChatContext {
    return { ...this.context };
  }

  /**
   * 执行 CAD 操作
   */
  async executeOperation(
    operation: string,
    params: any,
  ): Promise<CadOperationResult> {
    if (!this.context.fileId) {
      throw new Error('请先上传 CAD 文件');
    }

    try {
      const response = await axios.post(
        `/api/cad/${this.context.fileId}/execute`,
        { operation, params },
      );

      if (response.data.code === 'SUCCESS') {
        // 更新本地实体列表
        if (response.data.data.entities) {
          this.context.entities = response.data.data.entities;
        }

        return response.data.data;
      } else {
        throw new Error(response.data.message || '操作失败');
      }
    } catch (error) {
      console.error('[CadChatService] 执行操作失败', error);
      throw error;
    }
  }

  /**
   * 解析 AI 响应中的 Function Call
   */
  parseFunctionCall(message: string): {
    function: string;
    params: any;
  } | null {
    try {
      // 尝试匹配 Function Call 格式
      const functionRegex = /\[Function Call: (\w+)\]\s*({[\s\S]*?})/;
      const match = message.match(functionRegex);

      if (match) {
        const [, functionName, paramsJson] = match;
        const params = JSON.parse(paramsJson);
        return { function: functionName, params };
      }

      // 尝试匹配 JSON 代码块
      const jsonRegex = /```json\s*({[\s\S]*?})\s*```/;
      const jsonMatch = message.match(jsonRegex);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        if (data.function && data.params) {
          return { function: data.function, params: data.params };
        }
      }

      return null;
    } catch (error) {
      console.error('[CadChatService] 解析 Function Call 失败', error);
      return null;
    }
  }

  /**
   * 生成 CAD 操作提示
   */
  generateOperationPrompt(): string {
    const { fileId, entities, selectedEntityId } = this.context;

    if (!fileId) {
      return '请先上传 CAD 文件后再进行操作。';
    }

    const entitySummary = this.generateEntitySummary(entities);
    let prompt = `当前 CAD 文件包含 ${entities.length} 个实体。\n\n${entitySummary}`;

    if (selectedEntityId) {
      const selectedEntity = entities.find(e => e.handle === selectedEntityId);
      if (selectedEntity) {
        prompt += `\n\n当前选中的实体：\n- 类型：${selectedEntity.type}\n- 图层：${selectedEntity.layer}\n- ID：${selectedEntity.handle}`;
      }
    }

    prompt += '\n\n你可以使用以下操作：\n';
    prompt += '- 添加实体（直线、圆形、圆弧）\n';
    prompt += '- 查询实体信息\n';
    prompt += '- 移动实体\n';
    prompt += '- 删除实体';

    return prompt;
  }

  /**
   * 生成实体摘要
   */
  private generateEntitySummary(entities: DxfEntity[]): string {
    const typeCount: Record<string, number> = {};
    const layerCount: Record<string, number> = {};

    entities.forEach(entity => {
      typeCount[entity.type] = (typeCount[entity.type] || 0) + 1;
      layerCount[entity.layer] = (layerCount[entity.layer] || 0) + 1;
    });

    const typeSummary = Object.entries(typeCount)
      .map(([type, count]) => `${type}(${count})`)
      .join(', ');

    const layerSummary = Object.entries(layerCount)
      .map(([layer, count]) => `${layer}(${count})`)
      .join(', ');

    return `实体类型：${typeSummary}\n图层分布：${layerSummary}`;
  }

  /**
   * 清空上下文
   */
  clear() {
    this.context = {
      fileId: null,
      entities: [],
      selectedEntityId: null,
    };
  }
}

// 导出单例实例
export const cadChatService = new CadChatService();
