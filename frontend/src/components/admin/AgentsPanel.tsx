/**
 * 智能体管理面板
 * 完整的智能体CRUD功能：列表展示、创建、编辑、删除
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { 
  listAgents, 
  createAgent, 
  updateAgent, 
  deleteAgent,
  type AgentItem,
  type AgentPayload 
} from '@/services/agentsApi';
import type { AgentProvider } from '@/services/types/api-common';
import { RefreshCw, Plus, Edit, Trash2, Power, PowerOff, X, Save } from 'lucide-react';

/**
 * 智能体编辑模态框
 */
function AgentEditModal({ 
  agent, 
  onClose, 
  onSuccess 
}: { 
  agent: AgentItem | null; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!agent;
  const [formData, setFormData] = useState<Partial<AgentPayload>>({
    name: agent?.name || '',
    description: agent?.description || '',
    provider: (agent?.provider as AgentProvider) || 'openai',
    endpoint: agent?.endpoint || '',
    apiKey: '', // apiKey不从AgentItem获取（安全原因）
    model: agent?.model || '',
    maxTokens: agent?.maxTokens || 4096,
    temperature: agent?.temperature || 0.7,
    systemPrompt: agent?.systemPrompt || '',
    isActive: agent?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.provider || !formData.endpoint || !formData.apiKey || !formData.model) {
      toast.error('请填写所有必填字段');
      return;
    }

    try {
      setSaving(true);
      if (isEdit && agent) {
        await updateAgent(agent.id, formData);
        toast.success('智能体更新成功');
      } else {
        await createAgent(formData as AgentPayload);
        toast.success('智能体创建成功');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      let message = isEdit ? '更新失败' : '创建失败';
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b border-border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{isEdit ? '编辑智能体' : '创建智能体'}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">名称 *</label>
            <Input
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：GPT-4 助手"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">描述</label>
            <Input
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
              placeholder="智能体功能描述"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">提供商 *</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                required
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="fastgpt">FastGPT</option>
                <option value="dify">Dify</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">模型 *</label>
              <Input
                value={formData.model}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, model: e.target.value })}
                placeholder="例如：gpt-4"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">API端点 *</label>
            <Input
              value={formData.endpoint}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="https://api.openai.com/v1/chat/completions"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">API密钥 *</label>
            <Input
              type="password"
              value={formData.apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">最大Token</label>
              <Input
                type="number"
                value={formData.maxTokens}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                min="1"
                max="32768"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">温度</label>
              <Input
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                min="0"
                max="2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">系统提示词</label>
            <textarea
              className="w-full px-3 py-2 border border-border rounded-lg bg-background min-h-[100px]"
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              placeholder="你是一个有帮助的AI助手..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="isActive" className="text-sm font-medium">启用此智能体</label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : (isEdit ? '更新' : '创建')}
              <Save className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 智能体管理面板组件
 */
export default memo(function AgentsPanel() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * 加载智能体列表
   */
  const loadAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listAgents({ includeInactive: true });
      setAgents(data);
    } catch (err: unknown) {
      let message = t('加载智能体列表失败');
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始加载
   */
  useEffect(() => {
    void loadAgents();
  }, []);

  /**
   * 刷新列表
   */
  const handleRefresh = () => {
    void loadAgents();
  };

  /**
   * 删除智能体
   */
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`确定要删除智能体 "${name}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteAgent(id);
      toast.success('智能体删除成功');
      await loadAgents();
    } catch (err: unknown) {
      let message = '删除失败';
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * 切换智能体启用状态
   */
  const handleToggleActive = async (agent: AgentItem) => {
    try {
      await updateAgent(agent.id, { isActive: !agent.isActive });
      toast.success(agent.isActive ? '已禁用' : '已启用');
      await loadAgents();
    } catch (err: unknown) {
      let message = '状态切换失败';
      if (err && typeof err === 'object' && 'message' in err) {
        message = String(err.message);
      }
      toast.error(message);
    }
  };

  return (
    <main className="transition-all duration-300 lg:ml-64">
      <div className="p-6">
        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('智能体管理')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                管理所有可用的AI智能体配置
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                新增智能体
              </Button>
            </div>
          </div>

          {/* 加载状态 */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-muted-foreground mt-4">{t('加载中...')}</p>
            </div>
          )}

          {/* 错误状态 */}
          {error && !loading && (
            <div className="text-center py-12">
              <div className="text-red-500 mb-2">⚠️</div>
              <p className="text-sm text-red-600">{error}</p>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
                重试
              </Button>
            </div>
          )}

          {/* 智能体列表 */}
          {!loading && !error && agents.length > 0 && (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors bg-background/50"
                >
                  <div className="flex items-start justify-between">
                    {/* 左侧：智能体信息 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-base font-semibold text-foreground">
                          {agent.name}
                        </h4>
                        <Badge variant={agent.isActive ? 'success' : 'secondary'}>
                          {agent.isActive ? '已启用' : '已禁用'}
                        </Badge>
                        <Badge variant="outline">
                          {agent.provider}
                        </Badge>
                      </div>

                      {agent.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {agent.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>ID: {agent.id}</span>
                        {agent.model && <span>模型: {agent.model}</span>}
                        {agent.endpoint && (
                          <span className="max-w-xs truncate">
                            端点: {agent.endpoint}
                          </span>
                        )}
                      </div>

                      {/* 能力标签 */}
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {agent.capabilities.map((cap, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 右侧：操作按钮 */}
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAgent(agent)}
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(agent)}
                        title={agent.isActive ? '禁用' : '启用'}
                      >
                        {agent.isActive ? (
                          <PowerOff className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Power className="w-4 h-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(agent.id, agent.name)}
                        disabled={deletingId === agent.id}
                        title="删除"
                      >
                        {deletingId === agent.id ? (
                          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!loading && !error && agents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">📝</div>
              <p className="text-sm text-muted-foreground mb-4">暂无智能体</p>
              <Button onClick={() => setShowCreateModal(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                创建第一个智能体
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 编辑模态框 */}
      {editingAgent && (
        <AgentEditModal
          agent={editingAgent}
          onClose={() => setEditingAgent(null)}
          onSuccess={loadAgents}
        />
      )}

      {/* 创建模态框 */}
      {showCreateModal && (
        <AgentEditModal
          agent={null}
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadAgents}
        />
      )}
    </main>
  );
});
