/**
 * 智能体批量导入组件
 * 
 * 功能：
 * - JSON文件导入
 * - 批量验证
 * - 导入预览
 * - 错误处理
 */

import { useState } from 'react';
import { Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { AgentConfig } from '@/types';

interface ImportResult {
  success: Array<AgentConfig>;
  failed: Array<{ agent: Partial<AgentConfig>; error: string }>;
}

export function AgentBatchImport({ onImport }: { onImport: (agents: Array<AgentConfig>) => Promise<void> }) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 验证数据格式
      const agents = Array.isArray(data) ? data : [data];
      const validationResult: ImportResult = {
        success: [],
        failed: [],
      };

      // 逐个验证
      for (const agent of agents) {
        try {
          validateAgent(agent);
          validationResult.success.push(agent as AgentConfig);
        } catch (error) {
          validationResult.failed.push({
            agent,
            error: error instanceof Error ? error.message : '验证失败',
          });
        }
      }

      setResult(validationResult);

      // 如果有成功的，询问是否导入
      if (validationResult.success.length > 0) {
        if (confirm(`发现${validationResult.success.length}个有效智能体，是否导入？`)) {
          await onImport(validationResult.success);
          alert('导入成功！');
        }
      }
    } catch (error) {
      alert('文件格式错误：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setImporting(false);
      e.target.value = ''; // 重置文件输入
    }
  };

  const validateAgent = (agent: any) => {
    if (!agent.name) throw new Error('缺少name字段');
    if (!agent.provider) throw new Error('缺少provider字段');
    if (!agent.endpoint) throw new Error('缺少endpoint字段');
    if (!agent.model) throw new Error('缺少model字段');
    
    // 验证provider
    const validProviders = ['fastgpt', 'dify', 'openai', 'anthropic', 'custom'];
    if (!validProviders.includes(agent.provider)) {
      throw new Error(`无效的provider: ${agent.provider}`);
    }
  };

  const downloadTemplate = () => {
    const template = [{
      name: '示例智能体',
      description: '这是一个示例智能体配置',
      provider: 'fastgpt',
      endpoint: 'https://api.example.com',
      apiKey: 'your-api-key',
      appId: 'your-app-id',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: '你是一个有用的助手',
      isActive: true,
    }];

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agent-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label
          htmlFor="batch-import"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors"
        >
          <Upload className="w-4 h-4" />
          {importing ? '导入中...' : '批量导入'}
          <input
            id="batch-import"
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={importing}
            className="hidden"
          />
        </label>

        <button
          onClick={downloadTemplate}
          className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          下载模板
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          {result.success.length > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
                <CheckCircle className="w-5 h-5" />
                成功验证 {result.success.length} 个智能体
              </div>
              <ul className="text-sm space-y-1 text-green-600 dark:text-green-300">
                {result.success.map((agent, i) => (
                  <li key={i}>✓ {agent.name}</li>
                ))}
              </ul>
            </div>
          )}

          {result.failed.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                <XCircle className="w-5 h-5" />
                验证失败 {result.failed.length} 个智能体
              </div>
              <ul className="text-sm space-y-2 text-red-600 dark:text-red-300">
                {result.failed.map((item, i) => (
                  <li key={i}>
                    <strong>{item.agent.name || '未命名'}</strong>: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">使用说明：</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>支持单个或多个智能体的JSON文件</li>
              <li>必填字段：name, provider, endpoint, model</li>
              <li>可选字段：description, apiKey, appId, temperature等</li>
              <li>点击"下载模板"获取标准格式</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

