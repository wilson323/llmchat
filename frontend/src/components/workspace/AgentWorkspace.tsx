/**
 * AgentWorkspace - 智能体工作区路由组件
 *
 * 根据智能体的 workspaceType 动态渲染不同的工作区界面：
 * - 'chat': 标准聊天界面（默认）
 * - 'product-preview': 产品现场预览工作区
 * - 'voice-call': 语音对话工作区
 * - 'custom': 自定义工作区（未来扩展）
 *
 * @version 1.0 - 2025-10-04
 */

import React, { useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentStore } from '@/store/agentStore';
import { useSessionStore } from '@/store/sessionStore';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useCodeSplitting } from '@/hooks/useCodeSplitting';
import type { WorkspaceType } from '@/types';

// 代码分割：动态导入工作区组件
const ProductPreviewWorkspace = lazy(() =>
  import('@/components/product/ProductPreviewWorkspace').then(module => ({
    default: module.ProductPreviewWorkspace
  }))
);

const VoiceCallWorkspace = lazy(() =>
  import('@/components/voice/VoiceCallWorkspace').then(module => ({
    default: module.VoiceCallWorkspace
  })
));

/**
 * 加载中组件
 */
const LoadingSpinner: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">{t('加载智能体中...')}</p>
      </div>
    </div>
  );
};

/**
 * 智能体未找到组件
 */
const AgentNotFound: React.FC<{ agentId: string }> = ({ agentId }) => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">{t('智能体未找到')}</h1>
          <p className="text-muted-foreground">
            {t('无法找到ID为')} <code className="px-2 py-1 bg-muted rounded">{agentId}</code> {t('的智能体')}
          </p>
        </div>

        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          {t('返回首页')}
        </button>
      </div>
    </div>
  );
};

/**
 * AgentWorkspace 主组件
 */
export const AgentWorkspace: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 获取智能体信息
  const currentAgent = useAgentStore((state) =>
    agentId ? state.getAgentById(agentId) : null,
  );
  const setCurrentAgent = useAgentStore((state) => state.setCurrentAgent);

  // 会话管理
  const switchToSession = useSessionStore((state) => state.switchToSession);
  const createNewSession = useSessionStore((state) => state.createNewSession);

  // 处理智能体变化
  useEffect(() => {
    if (!agentId) {
      navigate('/', { replace: true });
      return;
    }

    if (!currentAgent) {
      // 智能体未找到，等待加载或显示错误
      return;
    }

    // 设置当前智能体到全局状态
    setCurrentAgent(currentAgent);

    // 处理会话参数
    const sessionId = searchParams.get('session');
    const createNew = searchParams.get('new') === 'true';

    if (sessionId && agentId) {
      // 切换到指定会话
      switchToSession(agentId, sessionId);
    } else if (createNew && agentId) {
      // 创建新会话
      createNewSession(agentId);
    }
    // 否则使用默认会话（最近的会话）

  }, [agentId, currentAgent, setCurrentAgent, searchParams, navigate, switchToSession, createNewSession]);

  // 加载中状态
  if (!agentId) {
    return <LoadingSpinner />;
  }

  // 智能体未找到
  if (!currentAgent) {
    return <AgentNotFound agentId={agentId} />;
  }

  // 根据工作区类型渲染对应的工作区
  const workspaceType: WorkspaceType = currentAgent.workspaceType || 'chat';

  switch (workspaceType) {
    case 'product-preview':
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <ProductPreviewWorkspace agent={currentAgent} />
        </Suspense>
      );

    case 'voice-call':
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <VoiceCallWorkspace agent={currentAgent} />
        </Suspense>
      );

    case 'custom':
      // 未来可以扩展自定义工作区
      console.warn(`自定义工作区类型 '${workspaceType}' 暂未实现，使用默认聊天界面`);
      return <ChatContainer />;

    case 'chat':
    default:
      return <ChatContainer />;
  }
};

export default AgentWorkspace;
