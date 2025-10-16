;
;
;
;
;
;
;
;
;
;
import { Calendar, Check, Clock, Edit3, MessageSquare, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useChatStore } from '@/store/chatStore';
import { ChatSession } from '@/types';

import { useI18n } from '@/i18n';
import { chatService } from '@/services/api';
import { mapHistoryDetailToMessages } from '@/lib/fastgpt';
import { PRODUCT_PREVIEW_AGENT_ID, VOICE_CALL_AGENT_ID } from '@/constants/agents';
import { toast } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { useOptimisticSessionSwitch } from '@/hooks/useOptimisticSessionSwitch';
import { SessionSwitchingFeedback } from '@/components/chat/SessionSwitchingFeedback';
import { useResponsive } from '@/hooks/useResponsive';

interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const {
    agentSessions,        // 新的数据结构
    currentAgent,         // 当前智能体
    currentSession,
    sidebarOpen,
    setSidebarOpen,
    createNewSession,
  } = useChatStore.getState();
  const { t, locale } = useI18n();
  const { isMobile, isTablet } = useResponsive();
  const navigate = useNavigate();

  // 乐观会话切换
  const {
    switchToSession: optimisticSwitchSession,
    isSessionCached,
  } = useOptimisticSessionSwitch({
    onSessionStartLoading: (sessionId) => {
      console.log('开始加载会话:', sessionId);
    },
    onSessionLoadComplete: (sessionId, success) => {
      console.log('会话加载完成:', sessionId, success);
    },
    enablePreloading: true,
    maxPreloadedSessions: 5,
  });

  // huihua.md 要求：根据当前智能体id从localStorage获取会话列表并显示
  const sessionsToDisplay = useMemo(() => {
    if (!currentAgent) {
      return [];
    }
    const sessions = agentSessions[currentAgent.id] ?? [];

    // 按最后访问时间排序，最近访问的在前面
    return sessions.sort((a: ChatSession, b: ChatSession) => {
      const aTime = a.lastAccessedAt ?? a.updatedAt;
      const bTime = b.lastAccessedAt ?? b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [currentAgent, agentSessions]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [sessionPendingDelete, setSessionPendingDelete] = useState<ChatSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(null);
  const [switchingSuccess, setSwitchingSuccess] = useState(false);
  const [switchingError, setSwitchingError] = useState(false);
  const sidebarRef = useRef(null);

  // 使用防抖搜索
  const { searchQuery, debouncedQuery, setSearchQuery, isDebouncing } = useDebouncedSearch('', 300);

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleNewChat = () => {
    createNewSession();
    // 更新URL，添加new=true参数
    if (currentAgent) {
      void navigate(`/chat/${currentAgent.id}?new=true`, { replace: true });
    }
  };

  const handleSwitchSession = async (session: ChatSession) => {
    setSwitchingSessionId(session.id);
    setSwitchingSuccess(false);
    setSwitchingError(false);

    try {
      // 使用乐观切换
      const success = await optimisticSwitchSession(session.id);

      if (success) {
        setSwitchingSuccess(true);

        // 更新URL以包含会话ID
        if (currentAgent) {
          void navigate(`/chat/${currentAgent.id}?session=${session.id}`, { replace: true });
        }

        // 异步加载详细历史（如果需要的话）
        if (!currentAgent) {
          return;
        }
        if (currentAgent.id === PRODUCT_PREVIEW_AGENT_ID || currentAgent.id === VOICE_CALL_AGENT_ID) {
          return;
        }
        if (session.messages && session.messages.length > 0) {
          return;
        }
        if (isSessionCached(session.id)) {
          return;
        }

        // 异步加载，不阻塞UI
        chatService.getHistoryDetail(currentAgent.id, session.id)
          .then(detail => {
            const mapped = mapHistoryDetailToMessages(detail);
            const { setSessionMessages } = useChatStore.getState();
            setSessionMessages(session.id, mapped);
          })
          .catch(error => {
            console.warn('加载聊天历史详情失败:', error);
            // 非关键错误，不显示toast
          });
      } else {
        setSwitchingError(true);
        toast({
          type: 'error',
          title: t('切换会话失败'),
          description: t('无法切换到指定会话，请稍后重试'),
        });
      }
    } catch (error) {
      console.error('切换会话失败:', error);
      setSwitchingError(true);
      toast({
        type: 'error',
        title: t('切换会话失败'),
        description: t('无法切换到指定会话，请稍后重试'),
      });
    } finally {
      // 延迟重置状态，让用户看到反馈
      setTimeout(() => {
        setSwitchingSessionId(null);
      }, 500);
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      const { renameSession, updateSessionTitleIntelligently } = useChatStore.getState();
      renameSession(editingId, editTitle.trim());

      // 在保存后触发智能标题优化（异步，不阻塞UI）
      setTimeout(() => {
        updateSessionTitleIntelligently(editingId);
      }, 100);
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleSmartTitleOptimization = (sessionId: string) => {
    // 触发智能标题优化
    const { updateSessionTitleIntelligently } = useChatStore.getState();
    updateSessionTitleIntelligently(sessionId);
  };

  const requestDeleteSession = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionPendingDelete(session);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }
    setSessionPendingDelete(null);
  };

  const confirmDeleteSession = async () => {
    if (!sessionPendingDelete || !currentAgent || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await chatService.deleteHistory(currentAgent.id, sessionPendingDelete.id);
      const { deleteSession } = useChatStore.getState();
      deleteSession(sessionPendingDelete.id);
      toast({ type: 'success', title: t('对话已删除') });
    } catch (error) {
      console.error('删除聊天历史失败:', error);
      toast({
        type: 'error',
        title: t('删除失败'),
        description: t('删除对话时出现错误，请稍后重试。'),
      });
    } finally {
      setIsDeleting(false);
      setSessionPendingDelete(null);
    }
  };

  // 处理手势滑动关闭侧边栏
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchStartTime(Date.now());
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || !touchStartTime) {
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const diffX = touchStartX - touch.clientX;
    const diffY = Math.abs(touchStartY - touch.clientY);
    const timeDiff = Date.now() - touchStartTime;

    // 增加灵敏度判断，避免误触
    const velocity = diffX / timeDiff;
    const isSwipeLeft = diffX > 80 && diffY < 100 && velocity > 0.3;

    if (isSwipeLeft) {
      setSidebarOpen(false);
      setTouchStartX(null);
      setTouchStartY(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchStartTime(null);
  };

  // 日期判断函数
  const isToday = (date: Date | number) => {
    const today = new Date();
    const targetDate = new Date(date);
    return targetDate.toDateString() === today.toDateString();
  };

  const isYesterday = (date: Date | number) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(date);
    return targetDate.toDateString() === yesterday.toDateString();
  };

  const isThisWeek = (date: Date | number) => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    const targetDate = new Date(date);
    return targetDate >= weekAgo && targetDate <= today;
  };

  const formatTime = (date: Date | number) => {
    return new Date(date).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 过滤和分组会话（只处理当前智能体的会话）
  const filteredSessions = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return sessionsToDisplay;
    }

    const query = debouncedQuery.toLowerCase();
    return sessionsToDisplay.filter((session: ChatSession) =>
      session.title.toLowerCase().includes(query),
    );
  }, [sessionsToDisplay, debouncedQuery]);

  const groupedSessions = useMemo(() => ({
    today: filteredSessions.filter((s: ChatSession) => isToday(s.updatedAt)),
    yesterday: filteredSessions.filter((s: ChatSession) => isYesterday(s.updatedAt)),
    thisWeek: filteredSessions.filter((s: ChatSession) => isThisWeek(s.updatedAt) && !isToday(s.updatedAt) && !isYesterday(s.updatedAt)),
    older: filteredSessions.filter((s: ChatSession) => !isThisWeek(s.updatedAt)),
  }), [filteredSessions]);

  const SessionGroup: React.FC<{ title: string; sessions: ChatSession[]; icon?: React.ReactNode }> = ({
    title,
    sessions,
    icon,
  }) => {
    if (sessions.length === 0) {
      return null;
    }

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <div className="space-y-1">
          {sessions.map((session: ChatSession) => (
            <div
              key={session.id}
              data-testid="session-item"
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                currentSession?.id === session.id
                  ? 'bg-brand/10 text-foreground'
                  : 'hover:bg-brand/10 text-foreground'
              } ${switchingSessionId === session.id ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={() => {
                void handleSwitchSession(session);
              }}
            >
              {/* 添加加载指示器 */}
              {switchingSessionId === session.id ? (
                <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
              )}

              {editingId === session.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm rounded bg-background text-foreground border border-input focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
handleSaveEdit();
}
                      if (e.key === 'Escape') {
handleCancelEdit();
}
                    }}
                  />
                  <Button
                    onClick={handleSaveEdit}
                    variant="ghost"
                    size="icon"
                    radius="md"
                    className="text-brand hover:text-brand-hover"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="ghost"
                    size="icon"
                    radius="md"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(session.updatedAt)}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 transition-opacity ${
                      currentSession?.id === session.id || editingId === session.id
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <IconButton
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleStartEdit(session);
                      }}
                      variant="ghost"
                      radius="md"
                      className="text-muted-foreground hover:text-foreground"
                      title="编辑标题"
                    >
                      <Edit3 className="h-3 w-3" />
                    </IconButton>
                    <IconButton
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleSmartTitleOptimization(session.id);
                      }}
                      variant="ghost"
                      radius="md"
                      className="text-brand hover:text-brand-hover"
                      title="智能优化标题"
                    >
                      <Sparkles className="h-3 w-3" />
                    </IconButton>
                    <IconButton
                      onClick={(e: React.MouseEvent) => requestDeleteSession(session, e)}
                      variant="destructive"
                      radius="md"
                      title="删除会话"
                    >
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 会话切换反馈 */}
      <SessionSwitchingFeedback
        isLoading={switchingSessionId !== null}
        success={switchingSuccess}
        error={switchingError}
        message={switchingSuccess ? t('会话切换成功') : switchingError ? t('会话切换失败') : undefined}
      />

      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-transparent z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭侧边栏"
        />
      )}

      {/* 侧边栏 - 响应式优化 */}
      <aside
        id="sidebar"
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full
          ${isMobile ? 'w-[85vw] max-w-[320px]' : isTablet ? 'w-72' : 'w-80'}
          bg-sidebar text-sidebar-foreground border-r border-sidebar-border
          transform transition-transform duration-300 ease-in-out z-50 flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:z-auto ${sidebarOpen ? 'lg:flex' : 'lg:hidden'} ${className}
          touch-pan-y
          select-none
          overscroll-y-contain`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="navigation"
        aria-label={t('会话列表')}
        >
        {/* 头部 - 移动端优化 */}
        <div className={`${isMobile ? 'p-2' : 'p-4'} border-b border-border/50`}>
          <Button
            onClick={handleNewChat}
            variant="brand"
            size={isMobile ? 'md' : 'lg'}
            radius="lg"
            data-testid="new-conversation-button"
            className="w-full flex items-center gap-3 font-medium"
          >
            <Plus className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            {t('新建对话')}
          </Button>

          {/* 隐藏清空对话按钮（业务要求不展示） */}
        </div>

        {/* 搜索 - 移动端优化 */}
        <div className={`${isMobile ? 'p-2' : 'p-4'} border-b border-border/50`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-muted-foreground`} />
            <input
              type="text"
              placeholder={t('搜索对话...')}
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              data-testid="session-search-input"
              className={`w-full ${isMobile ? 'pl-9 pr-3 py-1.5 text-sm' : 'pl-10 pr-4 py-2'} rounded-xl border border-input bg-background text-foreground placeholder-muted-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus:border-transparent`}
              aria-label={t('搜索对话')}
            />
            {/* 搜索状态指示器 */}
            {isDebouncing && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {/* 搜索结果统计 */}
          {debouncedQuery && (
            <div className="mt-2 text-xs text-muted-foreground">
              {filteredSessions.length === 0
                ? t('未找到匹配的对话')
                : t('找到 {count} 个对话', { count: filteredSessions.length })
              }
            </div>
          )}
        </div>

        {/* 会话列表 - 移动端优化 */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-2' : 'p-4'}`}>
          {sessionsToDisplay.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('还没有对话')}</p>
              <p className="text-sm">{t('点击“新建对话”开始聊天')}</p>
            </div>
          ) : (
            <div>
              <SessionGroup
                title={t('今天')}
                sessions={groupedSessions.today}
                icon={<Clock className="h-3 w-3" />}
              />
              <SessionGroup
                title={t('昨天')}
                sessions={groupedSessions.yesterday}
                icon={<Clock className="h-3 w-3" />}
              />
              <SessionGroup
                title={t('本周')}
                sessions={groupedSessions.thisWeek}
                icon={<Calendar className="h-3 w-3" />}
              />
              <SessionGroup
                title={t('更早')}
                sessions={groupedSessions.older}
                icon={<Calendar className="h-3 w-3" />}
              />
            </div>
          )}
        </div>
      </aside>

      <Dialog
        open={!!sessionPendingDelete}
        title={t('删除对话')}
        description={t('删除后将无法恢复该对话记录，是否继续？')}
        confirmText={isDeleting ? t('删除中…') : t('删除')}
        cancelText={t('取消')}
        destructive
        onClose={closeDeleteDialog}
        onConfirm={() => {
            void confirmDeleteSession();
          }}
      />
    </>
  );
};
