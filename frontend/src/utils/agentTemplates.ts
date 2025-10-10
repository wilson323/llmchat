/**
 * 智能体配置模板
 *
 * 提供常见的智能体配置模板，方便快速创建
 */

import type { AgentConfig } from '@/types';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'assistant' | 'chatbot' | 'knowledge' | 'custom';
  config: Partial<AgentConfig>;
}

export const agentTemplates: Array<AgentTemplate> = [
  {
    id: 'general-assistant',
    name: '通用助手',
    description: '适用于日常对话和问答的通用AI助手',
    category: 'assistant',
    config: {
      name: '通用助手',
      description: '一个多功能的AI助手，可以回答各种问题',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: '你是一个有用、诚实且无害的AI助手。请用简洁明了的方式回答用户的问题。',
      capabilities: ['问答', '对话', '分析'],
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: false,
        supportsFiles: false,
        supportsImages: false,
      },
    },
  },
  {
    id: 'code-assistant',
    name: '代码助手',
    description: '专门用于编程和代码相关问题',
    category: 'assistant',
    config: {
      name: '代码助手',
      description: '帮助你编写、调试和优化代码',
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 4096,
      systemPrompt: '你是一个专业的编程助手。请提供清晰、准确的代码示例和解释。遵循最佳实践和编码规范。',
      capabilities: ['代码生成', '代码审查', '调试', '重构'],
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: true,
        supportsFiles: true,
        supportsImages: false,
      },
    },
  },
  {
    id: 'knowledge-qa',
    name: '知识问答',
    description: 'FastGPT知识库问答模板',
    category: 'knowledge',
    config: {
      name: '知识问答机器人',
      description: '基于知识库的精准问答',
      provider: 'fastgpt',
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      maxTokens: 2048,
      systemPrompt: '你是一个基于知识库的问答机器人。请根据知识库内容准确回答用户问题。如果知识库中没有相关信息，请诚实告知。',
      capabilities: ['知识检索', '精准问答', '引用来源'],
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: true,
        supportsFiles: false,
        supportsImages: false,
      },
    },
  },
  {
    id: 'customer-service',
    name: '客服助手',
    description: '专业的客户服务机器人',
    category: 'chatbot',
    config: {
      name: '客服机器人',
      description: '提供专业、友好的客户服务',
      provider: 'dify',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: '你是一个专业的客服人员。请用礼貌、耐心的态度回答客户的问题。始终保持友好和乐于助人。',
      capabilities: ['客户服务', '问题解答', '投诉处理'],
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: false,
        supportsFiles: false,
        supportsImages: false,
      },
    },
  },
  {
    id: 'creative-writer',
    name: '创意写作',
    description: '帮助创作各类文本内容',
    category: 'assistant',
    config: {
      name: '创意写作助手',
      description: '协助你进行创意写作和内容创作',
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      temperature: 0.9,
      maxTokens: 4096,
      systemPrompt: '你是一个富有创造力的写作助手。请发挥想象力，帮助用户创作引人入胜的内容。',
      capabilities: ['文案创作', '故事编写', '诗歌创作', '内容润色'],
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: false,
        supportsFiles: false,
        supportsImages: false,
      },
    },
  },
  {
    id: 'translator',
    name: '翻译助手',
    description: '多语言翻译服务',
    category: 'assistant',
    config: {
      name: '翻译助手',
      description: '提供准确、流畅的多语言翻译',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 2048,
      systemPrompt: '你是一个专业的翻译助手。请提供准确、流畅、符合目标语言习惯的翻译。保持原文的语气和风格。',
      capabilities: ['中英互译', '多语言翻译', '术语翻译'],
      features: {
        supportsChatId: true,
        supportsStream: true,
        supportsDetail: false,
        supportsFiles: false,
        supportsImages: false,
      },
    },
  },
];

/**
 * 根据分类获取模板
 */
export function getTemplatesByCategory(category: AgentTemplate['category']): Array<AgentTemplate> {
  return agentTemplates.filter((t) => t.category === category);
}

/**
 * 根据ID获取模板
 */
export function getTemplateById(id: string): AgentTemplate | undefined {
  return agentTemplates.find((t) => t.id === id);
}

/**
 * 获取所有分类
 */
export function getAllCategories(): Array<{ value: AgentTemplate['category']; label: string }> {
  return [
    { value: 'assistant', label: '助手' },
    { value: 'chatbot', label: '聊天机器人' },
    { value: 'knowledge', label: '知识库' },
    { value: 'custom', label: '自定义' },
  ];
}
