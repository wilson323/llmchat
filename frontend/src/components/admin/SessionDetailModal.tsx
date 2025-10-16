'use client';
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
;
;
import { Bot, Calendar, Clock, Copy, Download, FileText, MessageCircle, MessageSquare, RefreshCw, Tag, User, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
;
;
;
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import {
  getSession,
  getSessionMessages,
  updateSession,
  type Session,
  type SessionMessage,
} from '@/services/sessionApi';

interface SessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onExport?: (session: Session, format: 'json' | 'csv' | 'txt') => void;
}

export function SessionDetailModal({
  isOpen,
  onClose,
  session,
  onExport,
}: SessionDetailModalProps) {
  const { t } = useI18n();

  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);
  const [messagePage, setMessagePage] = useState<number>(1);
  const [messagePageSize] = useState<number>(50);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const [tempTitle, setTempTitle] = useState<string>('');
  const [showExportOptions, setShowExportOptions] = useState<boolean>(false);

  // 加载会话消息
  const loadMessages = async (page: number = 1) => {
    if (!session) {
      return;
    }

    setMessagesLoading(true);
    try {
      const response = await getSessionMessages(session.id, page, messagePageSize);
      if (page === 1) {
        setMessages(response.messages);
      } else {
        setMessages((prev: SessionMessage[]) => [...prev, ...response.messages]);
      }
      setTotalMessages(response.total);
      setMessagePage(page);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast({ type: 'error', title: t('加载会话详情失败') });
    } finally {
      setMessagesLoading(false);
    }
  };

  // 当会话变化时重新加载数据
  useEffect(() => {
    if (isOpen && session) {
      loadMessages();
      setTempTitle(session.title);
    }
  }, [isOpen, session, loadMessages]);

  // 刷新会话信息
  const refreshSession = async () => {
    if (!session) {
      return;
    }

    setLoading(true);
    try {
      await getSession(session.id);
      // 这里需要通过回调更新父组件的session状态
    } catch (error) {
      console.error('Failed to refresh session:', error);
      toast({ type: 'error', title: t('加载会话详情失败') });
    } finally {
      setLoading(false);
    }
  };

  // 更新会话标题
  const updateSessionTitle = async () => {
    if (!session || !tempTitle.trim()) {
      return;
    }

    try {
      await updateSession(session.id, { title: tempTitle.trim() });
      toast({ type: 'success', title: t('操作成功') });
      setEditingTitle(false);
      // 这里需要通过回调更新父组件的session状态
    } catch (error) {
      console.error('Failed to update session title:', error);
      toast({ type: 'error', title: t('操作失败') });
    }
  };

  // 复制消息内容
  const copyMessageContent = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast({ type: 'success', title: t('复制成功') });
    }).catch(() => {
      toast({ type: 'error', title: t('复制失败') });
    });
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // 获取消息角色图标
  const getMessageIcon = (role: SessionMessage['role']) => {
    switch (role) {
      case 'user':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'assistant':
        return <Bot className="w-4 h-4 text-green-500" />;
      case 'system':
        return <FileText className="w-4 h-4 text-gray-500" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      case 'archived':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'deleted':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  if (!session) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {editingTitle ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={tempTitle}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempTitle(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') {
updateSessionTitle();
}
                          if (e.key === 'Escape') {
                            setTempTitle(session.title);
                            setEditingTitle(false);
                          }
                        }}
                        className="flex-1 text-lg font-medium bg-background border border-border rounded px-2 py-1"
                        autoFocus
                      />
                      <Button size="sm" variant="brand" onClick={updateSessionTitle}>
                        {t('确定')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTempTitle(session.title);
                          setEditingTitle(false);
                        }}
                      >
                        {t('取消')}
                      </Button>
                    </div>
                  ) : (
                    <h2
                      className="text-lg font-medium truncate cursor-pointer hover:text-brand-500"
                      onClick={() => setEditingTitle(true)}
                    >
                      {session.title}
                    </h2>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                    {t(session.status === 'active' ? '活跃' : session.status === 'archived' ? '已归档' : '已删除')}
                  </span>
                  <span>{t('会话ID')}: {session.id}</span>
                  <span>{t('消息数量')}: {session.messageCount}</span>
                  <span>{t('创建时间')}: {formatDate(session.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshSession}
                  disabled={loading}
                  className="p-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>

                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExportOptions(!showExportOptions)}
                    className="p-2"
                  >
                    <Download className="w-4 h-4" />
                  </Button>

                  {showExportOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-10"
                    >
                      <div className="p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onExport?.(session, 'json');
                            setShowExportOptions(false);
                          }}
                          className="w-full justify-start"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          JSON
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onExport?.(session, 'csv');
                            setShowExportOptions(false);
                          }}
                          className="w-full justify-start"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          CSV
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onExport?.(session, 'txt');
                            setShowExportOptions(false);
                          }}
                          className="w-full justify-start"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          TXT
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="p-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* 会话信息 */}
              <div className="p-6 border-b border-border bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('用户ID')}: {session.userId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('智能体')}: {session.agentId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('更新时间')}: {formatDate(session.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('消息数量')}: {session.messageCount}</span>
                  </div>
                </div>

                {/* 标签 */}
                {session.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {session.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 消息列表 */}
              <div className="flex-1 overflow-y-auto p-6">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    <span>{t('加载中...')}</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">{t('暂无消息')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message: SessionMessage, index: number) => (
                      <motion.div
                        key={message.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-2xl ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {getMessageIcon(message.role)}
                            <span className="text-sm font-medium">
                              {message.role === 'user' ? t('用户消息') :
                               message.role === 'assistant' ? t('AI回复') : t('系统消息')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {formatDate(message.timestamp)}
                            </span>
                          </div>

                          <div
                            className={`p-4 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-brand-500 text-white'
                                : message.role === 'assistant'
                                ? 'bg-muted border border-border'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className="whitespace-pre-wrap break-words">
                              {message.content}
                            </div>

                            <div className="flex items-center justify-between mt-2">
                              <div className="text-xs opacity-70">
                                ID: {message.id || index}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyMessageContent(message.content)}
                                className={`p-1 opacity-70 hover:opacity-100 ${
                                  message.role === 'user' ? 'text-white hover:bg-white/20' : ''
                                }`}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* 加载更多按钮 */}
                    {messages.length < totalMessages && (
                      <div className="flex justify-center mt-6">
                        <Button
                          variant="outline"
                          onClick={() => loadMessages(messagePage + 1)}
                          disabled={messagesLoading}
                        >
                          {messagesLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          {t('加载更多')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}