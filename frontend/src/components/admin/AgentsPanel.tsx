/**
 * 智能体管理面板
 * 完整的智能体列表展示和管理功能
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { listAgents, type AgentItem } from '@/services/agentsApi';
import { RefreshCw, Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react';

/**
 * 智能体管理面板组件
 */
export default memo(function AgentsPanel() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                onClick={() => {
                  toast('智能体创建功能即将推出', { icon: '🚧' });
                }}
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
                        onClick={() => {
                          toast('智能体编辑功能即将推出', { icon: '🚧' });
                        }}
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          toast('智能体启用/禁用功能即将推出', { icon: '🚧' });
                        }}
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
                        onClick={() => {
                          toast('智能体删除功能即将推出', { icon: '🚧' });
                        }}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
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
              <p className="text-sm text-muted-foreground">暂无智能体</p>
              <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
                刷新列表
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
});
