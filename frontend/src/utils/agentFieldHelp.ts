/**
 * 智能体字段帮助文档
 */

export const fieldHelp = {
  name: {
    title: '智能体名称',
    description: '为智能体设置一个易于识别的名称，建议使用描述性名称',
    examples: ['客服助手', 'FastGPT知识库', 'Dify聊天机器人'],
    tips: [
      '长度限制：1-120字符',
      '支持中英文',
      '建议包含功能描述',
    ],
  },

  provider: {
    title: '提供方类型',
    description: '选择智能体的后端服务提供商',
    options: [
      { value: 'fastgpt', label: 'FastGPT', description: '支持知识库、工作流的智能对话平台' },
      { value: 'dify', label: 'Dify', description: 'LLMOps平台，支持多种AI应用类型' },
      { value: 'openai', label: 'OpenAI', description: 'OpenAI官方API服务' },
      { value: 'anthropic', label: 'Anthropic', description: 'Claude AI服务' },
      { value: 'custom', label: '自定义', description: '兼容OpenAI API格式的自定义服务' },
    ],
    tips: [
      'FastGPT和Dify支持自动获取配置',
      '不同提供方的API格式可能不同',
      '选择后部分字段会自动调整',
    ],
  },

  endpoint: {
    title: '接口地址',
    description: 'AI服务的API端点URL',
    examples: [
      'https://api.fastgpt.in/api/v1/chat/completions',
      'https://api.dify.ai/v1/chat-messages',
      'https://api.openai.com/v1/chat/completions',
    ],
    tips: [
      '必须是完整的HTTP/HTTPS URL',
      '确保网络可达且端口开放',
      '失焦时会自动验证',
    ],
    warnings: [
      '部分API可能有CORS限制',
      '自动验证可能因网络策略失败',
    ],
  },

  apiKey: {
    title: 'API密钥',
    description: '访问AI服务的认证密钥',
    format: {
      openai: 'sk-开头，长度约40-50字符',
      anthropic: 'sk-ant-开头',
      fastgpt: '通常较长字符串',
      dify: 'app-开头',
    },
    tips: [
      '创建时必填，编辑时留空表示不修改',
      '保存后将加密存储',
      '建议定期轮换密钥',
    ],
    warnings: [
      '不要在公开场合分享API密钥',
      '注意密钥的使用额度限制',
    ],
  },

  appId: {
    title: '应用ID',
    description: 'FastGPT应用的唯一标识符',
    format: '24位十六进制字符串（MongoDB ObjectId格式）',
    examples: ['507f1f77bcf86cd799439011', '6123456789abcdef01234567'],
    tips: [
      'FastGPT智能体必填',
      '在FastGPT应用详情页获取',
      '格式：24位0-9a-f字符',
    ],
    howToGet: [
      '1. 登录FastGPT控制台',
      '2. 进入应用详情页',
      '3. 复制应用ID',
    ],
  },

  model: {
    title: '模型名称',
    description: '使用的AI模型标识',
    examples: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-sonnet',
    ],
    tips: [
      '长度：2-120字符',
      '区分大小写',
      '不同模型有不同的能力和定价',
    ],
    recommendations: [
      'gpt-4o-mini: 性价比高，适合大多数场景',
      'gpt-4o: 能力强，适合复杂任务',
      'claude-3-sonnet: 平衡性能与成本',
    ],
  },

  temperature: {
    title: '温度参数',
    description: '控制AI响应的随机性和创造性',
    range: '0-2',
    default: 0.7,
    tips: [
      '0: 确定性强，适合事实性任务',
      '0.7: 平衡创造性和准确性（推荐）',
      '1.5-2: 高创造性，适合创作任务',
    ],
    examples: [
      { value: 0, useCase: '数学计算、代码生成' },
      { value: 0.7, useCase: '通用对话、客服' },
      { value: 1.5, useCase: '创意写作、头脑风暴' },
    ],
  },

  maxTokens: {
    title: '最大Token数',
    description: '单次响应的最大长度限制',
    range: '1-32768',
    tips: [
      '1 token ≈ 0.75个英文单词',
      '1 token ≈ 0.5个中文字符',
      '设置过大会增加成本和响应时间',
    ],
    recommendations: [
      '简短对话: 512-1024',
      '常规对话: 2048-4096',
      '长文本生成: 8192+',
    ],
    warnings: [
      '不同模型有不同的最大限制',
      '超出限制会导致请求失败',
    ],
  },

  systemPrompt: {
    title: '系统提示词',
    description: '定义AI助手的角色、行为和约束',
    examples: [
      '你是一个专业的客服助手，请友好且专业地回答用户问题',
      '你是一个技术专家，请用简洁的语言解释复杂的技术概念',
    ],
    tips: [
      '清晰定义角色和目标',
      '设置必要的约束和规则',
      '可以包含示例对话',
    ],
    bestPractices: [
      '使用"你是..."句式定义角色',
      '明确禁止事项和边界',
      '提供具体的响应风格指导',
    ],
  },

  capabilities: {
    title: '能力标签',
    description: '标识智能体具备的特殊能力',
    examples: ['文档问答', '多模态', '快速响应', '代码生成', '联网搜索'],
    tips: [
      '用逗号分隔多个标签',
      '标签简洁明了',
      '反映实际功能',
    ],
    commonTags: [
      'chat', 'completion', 'file-upload', 'image', 'code',
      'search', 'workflow', 'realtime',
    ],
  },

  rateLimit: {
    title: '速率限制',
    description: '控制API调用频率，防止超额使用',
    fields: {
      requestsPerMinute: '每分钟请求次数上限',
      tokensPerMinute: '每分钟Token使用上限',
    },
    tips: [
      '根据API服务商的限制设置',
      '设置保守值避免超限',
      '可选配置，留空则无限制',
    ],
    examples: [
      { tier: 'Free', rpm: 60, tpm: 40000 },
      { tier: 'Basic', rpm: 200, tpm: 150000 },
      { tier: 'Pro', rpm: 1000, tpm: 1000000 },
    ],
  },

  features: {
    title: '功能特性',
    description: '配置智能体支持的高级功能',
    fields: {
      supportsChatId: '是否支持会话ID（多轮对话）',
      supportsStream: '是否支持流式响应',
      supportsDetail: '是否支持详细响应模式',
      supportsFiles: '是否支持文件上传',
      supportsImages: '是否支持图片处理',
    },
    tips: [
      'JSON格式配置',
      '根据provider能力设置',
      '错误配置可能导致功能异常',
    ],
  },

  isActive: {
    title: '启用状态',
    description: '控制智能体是否对用户可见',
    tips: [
      '停用后用户无法使用该智能体',
      '不影响已有会话',
      '可随时切换状态',
    ],
  },
};

/**
 * 获取字段帮助信息
 */
export function getFieldHelp(fieldName: keyof typeof fieldHelp) {
  return fieldHelp[fieldName];
}

/**
 * 获取字段的简短提示文本
 */
export function getFieldTooltip(fieldName: keyof typeof fieldHelp): string {
  const help = fieldHelp[fieldName];
  if (!help) return '';
  
  const parts: string[] = [help.description];
  
  if ('tips' in help && help.tips && help.tips.length > 0) {
    parts.push('\n提示：');
    parts.push(...help.tips.map(tip => `• ${tip}`));
  }
  
  if ('examples' in help && help.examples && help.examples.length > 0) {
    parts.push('\n示例：');
    parts.push(...help.examples.map(ex => `• ${ex}`));
  }
  
  return parts.join('\n');
}

