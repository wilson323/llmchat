/**
 * 虚拟化会话列表组件
 * 优化大量会话数据的渲染性能
 */

'use client';


import { Download, Eye, MessageSquare, RefreshCw, Search, Trash2 } from 'lucide-react';
import React, { useState, memo } from 'react';
import { VirtualScroll } from '@/components/ui/VirtualScroll';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';


import { useCallback } from 'react';
import { useI18n } from '@/i18n';

// 会话类型定义
export interface Session {
  id: string;
  title: string;
  agentId: string;
  agentName?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'archived';
  userId?: string;
  lastMessageAt?: string;
}

interface VirtualizedSessionListProps {
  sessions: Session[];
  loading?: boolean;
  hasMore?: boolean;
  onRefresh?: () => void;
  onView?: (session: Session) => void;
  onDelete?: (session: Session) => void;
  onExport?: (session: Session) => void;
  onLoadMore?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
  height?: number;
}

// 会话行组件
const SessionRow = memo(function SessionRow({
  item,
  onView,
  onDelete,
  onExport,
}: {
  item: { index: number; data: Session; key?: string; height: number };
  onView?: (session: Session) => void;
  onDelete?: (session: Session) => void;
  onExport?: (session: Session) => void;
}) {
  const { t } = useI18n();
  const { index, data: session } = item;

  const handleView = () => {
    onView?.(session);
  };

  const handleDelete = () => {
    if (window.confirm(t('确定要删除会话 "{0}" 吗？').replace('{0}', session.title))) {
      onDelete?.(session);
    }
  };

  const handleExport = () => {
    onExport?.(session);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'archived':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div
      className={`flex items-center border-b border-border/50 hover:bg-muted/20 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
      style={{ padding: '12px 16px' }}
      data-virtual-item
      >
      {/* 会话图标和基本信息 */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">
            {session.title || t('未命名会话')}
          </div>
          <div className="text-sm text-muted-foreground truncate flex items-center gap-2">
            <span>{session.agentName || t('未知智能体')}</span>
            <span>•</span>
            <span>{session.messageCount} {t('条消息')}</span>
          </div>
        </div>
      </div>

      {/* 状态和时间信息 */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="text-center">
          <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center ${getStatusColor(session.status)}`}>
            {t(session.status)}
          </div>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          <div>{t('创建时间')}</div>
          <div>{formatDate(session.createdAt)}</div>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          <div>{t('最后更新')}</div>
          <div>{session.lastMessageAt ? formatDate(session.lastMessageAt) : formatDate(session.updatedAt)}</div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleView}
            className="h-8 w-8 p-0"
            title={t('查看会话')}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="h-8 w-8 p-0"
            title={t('导出会话')}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            title={t('删除会话')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

SessionRow.displayName = 'SessionRow';

// 头部组件
const TableHeader = memo(function TableHeader({
  searchQuery,
  onSearch,
  onRefresh,
  loading,
  totalCount,
  totalMessages,
}: {
  searchQuery: string;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  loading: boolean;
  totalCount: number;
  totalMessages: number;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('搜索会话标题...')}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{t('共 {0} 个会话').replace('{0}', totalCount.toString())}</span>
          <span>•</span>
          <span>{t('{0} 条消息').replace('{0}', totalMessages.toString())}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('刷新')}
        </Button>
      </div>
    </div>
  );
});

TableHeader.displayName = 'TableHeader';

export const VirtualizedSessionList: React.FC<VirtualizedSessionListProps> = memo(function VirtualizedSessionList({
  sessions,
  loading = false,
  hasMore = true,
  onRefresh,
  onView,
  onDelete,
  onExport,
  onLoadMore,
  onSearch: _onSearch,
  className = '',
  height = 600,
}: VirtualizedSessionListProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤会话
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery) {
      return sessions;
    }

    const query = searchQuery.toLowerCase();
    return sessions.filter((session: Session) =>
      session.title.toLowerCase().includes(query) ||
      session.agentName?.toLowerCase().includes(query),
    );
  }, [sessions, searchQuery]);

  // 计算总消息数
  const totalMessages = React.useMemo(() => {
    return filteredSessions.reduce((sum: number, session: Session) => sum + session.messageCount, 0);
  }, [filteredSessions]);

  // 估算会话行高度
  const estimateSessionHeight = useCallback((session: unknown, _index: number) => {
    if (!session || typeof session !== 'object') {
      return 70;
    }
    const sessionObj = session as Session;
    let height = 70; // 基础高度

    // 根据标题长度估算
    const titleLength = sessionObj.title?.length || 0;
    if (titleLength > 30) {
      height += 10;
    }
    if (titleLength > 50) {
      height += 10;
    }

    return height;
  }, []);

  return (
    <div className={`border border-border/50 rounded-lg overflow-hidden bg-background ${className}`}>
      {/* 表头 */}
      <TableHeader
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onRefresh={onRefresh || (() => {})}
        loading={loading}
        totalCount={filteredSessions.length}
        totalMessages={totalMessages}
      />

      {/* 虚拟滚动列表 */}
      <VirtualScroll
        items={filteredSessions}
        height={height}
        itemKey={(session: any, index: number) => session?.id || index.toString()}
        itemHeight={estimateSessionHeight}
        renderItem={(item: any) => (
          <SessionRow
            item={{ ...item, data: item.data, height: item.height || 70 }}
            {...(onView && { onView })}
            {...(onDelete && { onDelete })}
            {...(onExport && { onExport })}
          />
        )}
        {...(onLoadMore && { onEndReached: onLoadMore })}
        hasMore={hasMore}
        loading={loading}
        loadingComponent={() => (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3" />
            <span className="text-sm text-muted-foreground">{t('加载中...')}</span>
          </div>
        )}
        emptyComponent={() => (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-lg font-medium text-foreground mb-2">
              {t('暂无会话数据')}
            </div>
            <div className="text-sm text-muted-foreground">
              {searchQuery ? t('没有找到匹配的会话') : t('系统中暂无会话')}
            </div>
          </div>
        )}
      />
    </div>
  );
});

VirtualizedSessionList.displayName = 'VirtualizedSessionList';