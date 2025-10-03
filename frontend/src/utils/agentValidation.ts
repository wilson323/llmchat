/**
 * 智能体字段验证工具
 */

/**
 * 验证endpoint格式和可达性
 */
export async function validateEndpoint(endpoint: string): Promise<{ valid: boolean; message?: string }> {
  // 基本格式验证
  if (!endpoint.trim()) {
    return { valid: false, message: '接口地址不能为空' };
  }

  // URL格式验证
  try {
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, message: '接口地址必须是HTTP或HTTPS协议' };
    }
  } catch {
    return { valid: false, message: '接口地址格式不正确' };
  }

  // 可达性检查（可选，通过OPTIONS预检）
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

    // 注意：由于CORS限制，这可能在浏览器中失败
    // 建议后端提供专门的验证接口
    await fetch(endpoint, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors', // 避免CORS阻止
    });

    clearTimeout(timeoutId);
    
    // no-cors模式下无法获取状态码，但能检测网络可达性
    return { valid: true };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { valid: false, message: '接口地址连接超时（3秒）' };
    }
    // 网络错误不一定是问题（可能是CORS），返回警告而非错误
    return { valid: true, message: '⚠️ 无法验证可达性（CORS限制），请确保地址正确' };
  }
}

/**
 * 验证API Key格式
 */
export function validateApiKey(apiKey: string, provider?: string): { valid: boolean; message?: string } {
  if (!apiKey.trim()) {
    return { valid: false, message: 'API密钥不能为空' };
  }

  const key = apiKey.trim();

  // 根据provider验证格式
  switch (provider) {
    case 'openai':
      if (!key.startsWith('sk-')) {
        return { valid: false, message: 'OpenAI API密钥应该以"sk-"开头' };
      }
      if (key.length < 40) {
        return { valid: false, message: 'OpenAI API密钥长度不足' };
      }
      break;

    case 'anthropic':
      if (!key.startsWith('sk-ant-')) {
        return { valid: false, message: 'Anthropic API密钥应该以"sk-ant-"开头' };
      }
      break;

    case 'fastgpt':
      // FastGPT没有特定格式要求，但通常较长
      if (key.length < 20) {
        return { valid: false, message: 'FastGPT API密钥长度可能不足' };
      }
      break;

    case 'dify':
      // Dify API密钥通常是app-开头
      if (!key.startsWith('app-') && key.length < 20) {
        return { valid: false, message: 'Dify API密钥格式可能不正确' };
      }
      break;

    default:
      // 通用验证：长度至少10个字符
      if (key.length < 10) {
        return { valid: false, message: 'API密钥长度过短' };
      }
  }

  return { valid: true };
}

/**
 * 验证FastGPT的appId格式
 */
export function validateAppId(appId: string): { valid: boolean; message?: string } {
  if (!appId.trim()) {
    return { valid: false, message: 'App ID不能为空' };
  }

  const id = appId.trim();

  // FastGPT的appId是24位十六进制字符串（MongoDB ObjectId格式）
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return { valid: false, message: 'FastGPT App ID应该是24位十六进制字符串' };
  }

  return { valid: true };
}

/**
 * 验证model名称
 */
export function validateModel(model: string): { valid: boolean; message?: string } {
  if (!model.trim()) {
    return { valid: false, message: '模型名称不能为空' };
  }

  const modelName = model.trim();

  // 长度检查
  if (modelName.length < 2) {
    return { valid: false, message: '模型名称过短' };
  }

  if (modelName.length > 120) {
    return { valid: false, message: '模型名称过长（最多120字符）' };
  }

  return { valid: true };
}

/**
 * 验证temperature范围
 */
export function validateTemperature(temperature: string): { valid: boolean; message?: string } {
  if (!temperature.trim()) {
    return { valid: true }; // 可选字段
  }

  const temp = Number(temperature);

  if (isNaN(temp)) {
    return { valid: false, message: '温度必须是数字' };
  }

  if (temp < 0 || temp > 2) {
    return { valid: false, message: '温度范围应该在0-2之间' };
  }

  return { valid: true };
}

/**
 * 验证maxTokens范围
 */
export function validateMaxTokens(maxTokens: string): { valid: boolean; message?: string } {
  if (!maxTokens.trim()) {
    return { valid: true }; // 可选字段
  }

  const tokens = Number(maxTokens);

  if (isNaN(tokens) || !Number.isInteger(tokens)) {
    return { valid: false, message: '最大Token必须是整数' };
  }

  if (tokens < 1 || tokens > 32768) {
    return { valid: false, message: '最大Token范围应该在1-32768之间' };
  }

  return { valid: true };
}

/**
 * 综合验证智能体表单
 */
export async function validateAgentForm(form: {
  name: string;
  provider: string;
  endpoint: string;
  apiKey: string;
  appId?: string;
  model: string;
  temperature?: string;
  maxTokens?: string;
}, mode: 'create' | 'edit'): Promise<{
  valid: boolean;
  errors: Record<string, string>;
}> {
  const errors: Record<string, string> = {};

  // 名称验证
  if (!form.name.trim()) {
    errors.name = '名称不能为空';
  } else if (form.name.length > 120) {
    errors.name = '名称过长（最多120字符）';
  }

  // Provider验证
  if (!form.provider.trim()) {
    errors.provider = '提供方不能为空';
  }

  // Endpoint验证
  const endpointResult = await validateEndpoint(form.endpoint);
  if (!endpointResult.valid) {
    errors.endpoint = endpointResult.message || '接口地址无效';
  }

  // API Key验证（创建模式必填，编辑模式可选）
  if (mode === 'create') {
    if (!form.apiKey.trim()) {
      errors.apiKey = 'API密钥不能为空';
    } else {
      const apiKeyResult = validateApiKey(form.apiKey, form.provider);
      if (!apiKeyResult.valid) {
        errors.apiKey = apiKeyResult.message || 'API密钥格式不正确';
      }
    }
  } else if (form.apiKey.trim()) {
    // 编辑模式如果填写了，则验证格式
    const apiKeyResult = validateApiKey(form.apiKey, form.provider);
    if (!apiKeyResult.valid) {
      errors.apiKey = apiKeyResult.message || 'API密钥格式不正确';
    }
  }

  // FastGPT的appId验证
  if (form.provider === 'fastgpt') {
    if (!form.appId?.trim()) {
      errors.appId = 'FastGPT必须提供App ID';
    } else {
      const appIdResult = validateAppId(form.appId);
      if (!appIdResult.valid) {
        errors.appId = appIdResult.message || 'App ID格式不正确';
      }
    }
  }

  // Model验证
  const modelResult = validateModel(form.model);
  if (!modelResult.valid) {
    errors.model = modelResult.message || '模型名称无效';
  }

  // Temperature验证
  if (form.temperature) {
    const tempResult = validateTemperature(form.temperature);
    if (!tempResult.valid) {
      errors.temperature = tempResult.message || '温度值无效';
    }
  }

  // MaxTokens验证
  if (form.maxTokens) {
    const tokensResult = validateMaxTokens(form.maxTokens);
    if (!tokensResult.valid) {
      errors.maxTokens = tokensResult.message || '最大Token无效';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

