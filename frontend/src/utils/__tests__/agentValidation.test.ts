import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateEndpoint,
  validateApiKey,
  validateAppId,
  validateModel,
  validateTemperature,
  validateMaxTokens,
  validateAgentForm,
} from '../agentValidation';

describe('agentValidation', () => {
  describe('validateEndpoint', () => {
    it('应该拒绝空endpoint', async () => {
      const result = await validateEndpoint('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('应该拒绝无效的URL格式', async () => {
      const result = await validateEndpoint('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('格式不正确');
    });

    it('应该拒绝非HTTP/HTTPS协议', async () => {
      const result = await validateEndpoint('ftp://example.com');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('HTTP或HTTPS协议');
    });

    it('应该接受有效的HTTPS URL', async () => {
      // Mock fetch to avoid real network calls
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
        } as Response)
      );

      const result = await validateEndpoint('https://api.example.com/v1/chat');
      expect(result.valid).toBe(true);
    });

    it('应该处理AbortError（超时）', async () => {
      // Mock fetch to reject with an Error that has name 'AbortError'
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      global.fetch = vi.fn(() => Promise.reject(abortError));

      const result = await validateEndpoint('https://slow-api.example.com');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('超时');
    });

    it('应该处理网络错误（CORS）', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const result = await validateEndpoint('https://api.example.com');
      // 由于CORS，可能返回警告而非错误
      expect(result.valid).toBe(true);
      expect(result.message).toContain('⚠️');
    });
  });

  describe('validateApiKey', () => {
    it('应该拒绝空API Key', () => {
      const result = validateApiKey('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('应该验证OpenAI API Key格式', () => {
      const result = validateApiKey('invalid-key', 'openai');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('sk-');

      const result2 = validateApiKey('sk-', 'openai');
      expect(result2.valid).toBe(false);
      expect(result2.message).toContain('长度不足');

      const result3 = validateApiKey('sk-' + 'a'.repeat(40), 'openai');
      expect(result3.valid).toBe(true);
    });

    it('应该验证Anthropic API Key格式', () => {
      const result = validateApiKey('invalid-key', 'anthropic');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('sk-ant-');

      const result2 = validateApiKey('sk-ant-' + 'a'.repeat(20), 'anthropic');
      expect(result2.valid).toBe(true);
    });

    it('应该验证FastGPT API Key格式', () => {
      const result = validateApiKey('short', 'fastgpt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('长度');

      const result2 = validateApiKey('a'.repeat(25), 'fastgpt');
      expect(result2.valid).toBe(true);
    });

    it('应该验证Dify API Key格式', () => {
      const result = validateApiKey('short', 'dify');
      expect(result.valid).toBe(false);

      const result2 = validateApiKey('app-' + 'a'.repeat(20), 'dify');
      expect(result2.valid).toBe(true);
    });

    it('应该验证通用API Key长度', () => {
      const result = validateApiKey('short');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('过短');

      const result2 = validateApiKey('a'.repeat(15));
      expect(result2.valid).toBe(true);
    });
  });

  describe('validateAppId', () => {
    it('应该拒绝空App ID', () => {
      const result = validateAppId('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('应该验证24位十六进制格式', () => {
      const result = validateAppId('invalid');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('24位十六进制');

      const result2 = validateAppId('507f1f77bcf86cd799439011');
      expect(result2.valid).toBe(true);

      const result3 = validateAppId('6123456789abcdef01234567');
      expect(result3.valid).toBe(true);
    });

    it('应该拒绝非十六进制字符', () => {
      const result = validateAppId('507f1f77bcf86cd79943901g'); // 'g' is invalid
      expect(result.valid).toBe(false);
    });

    it('应该拒绝长度不正确的ID', () => {
      const result = validateAppId('507f1f77'); // Too short
      expect(result.valid).toBe(false);

      const result2 = validateAppId('507f1f77bcf86cd799439011abc'); // Too long
      expect(result2.valid).toBe(false);
    });
  });

  describe('validateModel', () => {
    it('应该拒绝空model', () => {
      const result = validateModel('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('应该拒绝过短的model名称', () => {
      const result = validateModel('a');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('过短');
    });

    it('应该拒绝过长的model名称', () => {
      const result = validateModel('a'.repeat(121));
      expect(result.valid).toBe(false);
      expect(result.message).toContain('过长');
    });

    it('应该接受有效的model名称', () => {
      expect(validateModel('gpt-4o').valid).toBe(true);
      expect(validateModel('gpt-4o-mini').valid).toBe(true);
      expect(validateModel('claude-3-opus').valid).toBe(true);
    });
  });

  describe('validateTemperature', () => {
    it('应该接受空值（可选字段）', () => {
      const result = validateTemperature('');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝非数字', () => {
      const result = validateTemperature('abc');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('数字');
    });

    it('应该拒绝超出范围的值', () => {
      const result = validateTemperature('-0.5');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('0-2');

      const result2 = validateTemperature('2.5');
      expect(result2.valid).toBe(false);
      expect(result2.message).toContain('0-2');
    });

    it('应该接受有效的温度值', () => {
      expect(validateTemperature('0').valid).toBe(true);
      expect(validateTemperature('0.7').valid).toBe(true);
      expect(validateTemperature('1.5').valid).toBe(true);
      expect(validateTemperature('2').valid).toBe(true);
    });
  });

  describe('validateMaxTokens', () => {
    it('应该接受空值（可选字段）', () => {
      const result = validateMaxTokens('');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝非数字', () => {
      const result = validateMaxTokens('abc');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('整数');
    });

    it('应该拒绝小数', () => {
      const result = validateMaxTokens('100.5');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('整数');
    });

    it('应该拒绝超出范围的值', () => {
      const result = validateMaxTokens('0');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('1-32768');

      const result2 = validateMaxTokens('40000');
      expect(result2.valid).toBe(false);
      expect(result2.message).toContain('1-32768');
    });

    it('应该接受有效的token值', () => {
      expect(validateMaxTokens('1').valid).toBe(true);
      expect(validateMaxTokens('512').valid).toBe(true);
      expect(validateMaxTokens('4096').valid).toBe(true);
      expect(validateMaxTokens('32768').valid).toBe(true);
    });
  });

  describe('validateAgentForm', () => {
    beforeEach(() => {
      // Mock fetch for endpoint validation
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
        } as Response)
      );
    });

    it('应该验证必填字段', async () => {
      const result = await validateAgentForm({
        name: '',
        provider: 'openai',
        endpoint: 'https://api.openai.com',
        apiKey: 'sk-test',
        model: 'gpt-4o',
      }, 'create');

      expect(result.valid).toBe(false);
      expect(result.errors.name).toBeDefined();
    });

    it('应该验证provider字段', async () => {
      const result = await validateAgentForm({
        name: 'Test Agent',
        provider: '',
        endpoint: 'https://api.openai.com',
        apiKey: 'sk-test',
        model: 'gpt-4o',
      }, 'create');

      expect(result.valid).toBe(false);
      expect(result.errors.provider).toBeDefined();
    });

    it('应该验证endpoint格式', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Invalid')));

      const result = await validateAgentForm({
        name: 'Test Agent',
        provider: 'openai',
        endpoint: 'not-a-url',
        apiKey: 'sk-test',
        model: 'gpt-4o',
      }, 'create');

      expect(result.valid).toBe(false);
      expect(result.errors.endpoint).toBeDefined();
    });

    it('应该在创建模式验证API Key', async () => {
      const result = await validateAgentForm({
        name: 'Test Agent',
        provider: 'openai',
        endpoint: 'https://api.openai.com',
        apiKey: '',
        model: 'gpt-4o',
      }, 'create');

      expect(result.valid).toBe(false);
      expect(result.errors.apiKey).toBeDefined();
    });

    it('应该在编辑模式允许空API Key', async () => {
      const result = await validateAgentForm({
        name: 'Test Agent',
        provider: 'openai',
        endpoint: 'https://api.openai.com',
        apiKey: '',
        model: 'gpt-4o',
      }, 'edit');

      expect(result.errors.apiKey).toBeUndefined();
    });

    it('应该验证FastGPT的appId', async () => {
      const result = await validateAgentForm({
        name: 'Test Agent',
        provider: 'fastgpt',
        endpoint: 'https://api.fastgpt.in',
        apiKey: 'test-key-long-enough',
        appId: '',
        model: 'gpt-4o',
      }, 'create');

      expect(result.valid).toBe(false);
      expect(result.errors.appId).toBeDefined();

      const result2 = await validateAgentForm({
        name: 'Test Agent',
        provider: 'fastgpt',
        endpoint: 'https://api.fastgpt.in',
        apiKey: 'test-key-long-enough',
        appId: '507f1f77bcf86cd799439011',
        model: 'gpt-4o',
      }, 'create');

      expect(result2.errors.appId).toBeUndefined();
    });

    it('应该验证所有字段并返回正确', async () => {
      const result = await validateAgentForm({
        name: 'Test Agent',
        provider: 'openai',
        endpoint: 'https://api.openai.com',
        apiKey: 'sk-' + 'a'.repeat(40),
        model: 'gpt-4o',
        temperature: '0.7',
        maxTokens: '2048',
      }, 'create');

      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });
  });
});

