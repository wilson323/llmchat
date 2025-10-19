/**
 * 虚拟化用户列表组件
 * 优化大量用户数据的渲染性能
 */

'use client';


import { Edit, Filter, RefreshCw, Search, Shield, ShieldAlert, Trash2, User } from 'lucide-react';
import React, { useState, memo, useCallback } from 'react';
import { VirtualScroll } from '@/components/ui/VirtualScroll';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n';

// 用户类型定义
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  last_login?: string;
  avatar?: string;
}

interface VirtualizedUsersListProps {
  users: User[];
  loading?: boolean;
  hasMore?: boolean;
  onRefresh?: () => void;
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
  onToggleStatus?: (user: User) => void;
  onLoadMore?: () => void;
  onSearch?: (query: string) => void;
  className?: string;
  height?: number;
}

// 用户行组件
const UserRow = memo(function UserRow({
  item,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  item: { index: number; data: User; key?: string; height: number };
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
  onToggleStatus?: (user: User) => void;
}) {
  const { t } = useI18n();
  const { index, data: user } = item;

  const handleEdit = () => {
    onEdit?.(user);
  };

  const handleDelete = () => {
    if (window.confirm(t('确定要删除用户 {0} 吗？').replace('{0}', user.username))) {
      onDelete?.(user);
    }
  };

  const handleToggleStatus = () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    onToggleStatus?.({ ...user, status: newStatus });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div
      className={`flex items-center border-b border-border/50 hover:bg-muted/20 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
      style={{ padding: '12px 16px' }}
      data-virtual-item
      >
      {/* 用户头像和基本信息 */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-medium">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground truncate">
            {user.username}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {user.email}
          </div>
        </div>
      </div>

      {/* 角色和状态 */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">
            {user.role || '-'}
          </div>
          <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center ${
            user.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : user.status === 'inactive'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
          }`}>
            {user.status === 'active' && <Shield className="w-3 h-3 inline mr-1" />}
            {user.status === 'inactive' && <ShieldAlert className="w-3 h-3 inline mr-1" />}
            {t(user.status)}
          </div>
        </div>

        <div className="text-sm text-muted-foreground text-center">
          <div>{t('创建时间')}</div>
          <div>{formatDate(user.created_at)}</div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-8 w-8 p-0"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleStatus}
            className={`h-8 w-8 p-0 ${
              user.status === 'active' ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
            }`}
          >
            {user.status === 'active' ? (
              <ShieldAlert className="w-4 h-4" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

UserRow.displayName = 'UserRow';

// 头部组件
const TableHeader = memo(function TableHeader({
  searchQuery,
  onSearch,
  onRefresh,
  loading,
  totalCount,
}: {
  searchQuery: string;
  onSearch?: (query: string) => void;
  onRefresh: () => void;
  loading: boolean;
  totalCount: number;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('搜索用户名或邮箱...')}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearch?.(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('共 {0} 个用户').replace('{0}', totalCount.toString())}</span>
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

export const VirtualizedUsersList: React.FC<VirtualizedUsersListProps> = memo(function VirtualizedUsersList({
  users,
  loading = false,
  hasMore = true,
  onRefresh,
  onEdit,
  onDelete,
  onToggleStatus,
  onLoadMore,
  onSearch: _onSearch,
  className = '',
  height = 600,
}: VirtualizedUsersListProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤用户
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery) {
      return users;
    }

    const query = searchQuery.toLowerCase();
    return users.filter((user: User) =>
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  // 估算用户行高度
  const estimateUserHeight = useCallback((user: unknown, _index: number) => {
    if (!user || typeof user !== 'object') {
      return 60;
    }
    const userObj = user as User;
    let height = 60; // 基础高度

    // 根据用户名长度估算
    const usernameLength = userObj.username?.length || 0;
    if (usernameLength > 20) {
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
        onRefresh={onRefresh || (() => undefined)}
        loading={loading}
        totalCount={filteredUsers.length}
      />

      {/* 虚拟滚动列表 */}
      <VirtualScroll
        items={filteredUsers}
        height={height}
        itemKey={(user: any, index: number) => user?.id || index.toString()}
        itemHeight={estimateUserHeight}
        renderItem={(item: any) => (
          <UserRow
            item={{ ...item, data: item.data, height: item.height || 60 }}
            {...(onEdit && { onEdit })}
            {...(onDelete && { onDelete })}
            {...(onToggleStatus && { onToggleStatus })}
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
              <Filter className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-lg font-medium text-foreground mb-2">
              {t('暂无用户数据')}
            </div>
            <div className="text-sm text-muted-foreground">
              {searchQuery ? t('没有找到匹配的用户') : t('系统中暂无用户')}
            </div>
          </div>
        )}
      />
    </div>
  );
});

VirtualizedUsersList.displayName = 'VirtualizedUsersList';