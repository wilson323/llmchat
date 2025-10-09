"use client";
import { useState, useEffect, useCallback } from "react";
import { useResponsive } from "@/hooks/useResponsive";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  Archive,
  ArchiveRestore,
  Tag,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MessageSquare,
  Users,
  BarChart3,
  CheckCircle,
  Clock,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/i18n";
import { toast } from "@/components/ui/Toast";
import {
  getSessions,
  getSessionStats,
  deleteSession,
  archiveSession,
  unarchiveSession,
  batchDeleteSessions,
  batchArchiveSessions,
  exportSessions,
  exportSession,
  type Session,
  type SessionListParams,
  type SessionFilter,
  type SessionStats,
} from "@/services/sessionApi";
import { SessionDetailModal } from "./SessionDetailModal";
import { BatchTagModal } from "./BatchTagModal";
import { SessionStatsChart } from "./SessionStatsChart";

interface SessionManagementProps {
  className?: string;
}

export function SessionManagement({ className }: SessionManagementProps) {
  const { t } = useI18n();
  const { isMobile, isTablet } = useResponsive();

  // 状态管理
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [tagOperation, setTagOperation] = useState<'add' | 'remove'>('add');

  // 筛选状态
  const [filters, setFilters] = useState<SessionFilter>({});
  const [sortBy, setSortBy] = useState<SessionListParams['sortBy']>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params: SessionListParams = {
        page,
        pageSize,
        sortBy,
        sortOrder,
        filter: {
          ...filters,
          search: searchQuery || undefined,
        },
      };

      const response = await getSessions(params);
      setSessions(response.sessions);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast({ type: 'error', title: t('加载会话列表失败') });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, filters, searchQuery, t]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const statsData = await getSessionStats({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        agentId: filters.agentId,
      });
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast({ type: 'error', title: t('加载统计数据失败') });
    } finally {
      setStatsLoading(false);
    }
  }, [filters, t]);

  // 初始化加载
  useEffect(() => {
    loadSessions();
    loadStats();
  }, [loadSessions, loadStats]);

  // 处理搜索
  const handleSearch = useCallback(() => {
    setPage(1);
    loadSessions();
  }, [loadSessions]);

  // 处理筛选
  const handleFilter = useCallback((newFilters: SessionFilter) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  // 清空筛选
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery("");
    setPage(1);
  }, []);

  // 选择/取消选择会话
  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    }
  }, [selectedSessions.size, sessions]);

  // 单个会话操作
  const handleViewSession = useCallback((session: Session) => {
    setSelectedSession(session);
    setShowDetailModal(true);
  }, []);

  const handleDeleteSession = useCallback(async (session: Session) => {
    if (!confirm(t('确认删除选中的 {count} 个会话吗？此操作不可撤销。', { count: 1 }))) {
      return;
    }

    try {
      await deleteSession(session.id);
      toast({ type: 'success', title: t('操作成功') });
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast({ type: 'error', title: t('操作失败') });
    }
  }, [t, loadSessions, loadStats]);

  const handleArchiveSession = useCallback(async (session: Session) => {
    try {
      if (session.status === 'archived') {
        await unarchiveSession(session.id);
      } else {
        await archiveSession(session.id);
      }
      toast({ type: 'success', title: t('操作成功') });
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Failed to archive session:', error);
      toast({ type: 'error', title: t('操作失败') });
    }
  }, [t, loadSessions, loadStats]);

  // 批量操作
  const handleBatchDelete = useCallback(async () => {
    if (selectedSessions.size === 0) return;

    if (!confirm(t('确认删除选中的 {count} 个会话吗？此操作不可撤销。', { count: selectedSessions.size }))) {
      return;
    }

    try {
      const result = await batchDeleteSessions(Array.from(selectedSessions));
      if (result.failed === 0) {
        toast({ type: 'success', title: t('批量操作成功') });
      } else {
        toast({ type: 'warning', title: t('批量操作部分成功') + ' - ' + t('成功: {success}，失败: {failed}', { success: result.success, failed: result.failed }) });
      }
      setSelectedSessions(new Set());
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Failed to batch delete:', error);
      toast({ type: 'error', title: t('操作失败') });
    }
  }, [selectedSessions, t, loadSessions, loadStats]);

  const handleBatchArchive = useCallback(async () => {
    if (selectedSessions.size === 0) return;

    if (!confirm(t('确认归档选中的 {count} 个会话吗？', { count: selectedSessions.size }))) {
      return;
    }

    try {
      const result = await batchArchiveSessions(Array.from(selectedSessions));
      if (result.failed === 0) {
        toast({ type: 'success', title: t('批量操作成功') });
      } else {
        toast({ type: 'warning', title: t('批量操作部分成功') + ' - ' + t('成功: {success}，失败: {failed}', { success: result.success, failed: result.failed }) });
      }
      setSelectedSessions(new Set());
      loadSessions();
      loadStats();
    } catch (error) {
      console.error('Failed to batch archive:', error);
      toast({ type: 'error', title: t('操作失败') });
    }
  }, [selectedSessions, t, loadSessions, loadStats]);

  const handleBatchTags = useCallback((operation: 'add' | 'remove') => {
    if (selectedSessions.size === 0) return;
    setTagOperation(operation);
    setShowTagModal(true);
  }, [selectedSessions]);

  // 导出操作
  const handleExportSession = useCallback(async (session: Session, format: 'json' | 'csv' | 'txt' = 'json') => {
    try {
      const content = await exportSession(session.id, format);
      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : 'text/plain'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${session.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ type: 'success', title: t('导出成功') });
    } catch (error) {
      console.error('Failed to export session:', error);
      toast({ type: 'error', title: t('导出失败') });
    }
  }, [t]);

  const handleExportSelected = useCallback(async (format: 'json' | 'csv' | 'xlsx' = 'json') => {
    if (selectedSessions.size === 0) return;

    try {
      const params: SessionListParams = {
        filter: {
          ...filters,
          search: searchQuery || undefined,
        },
        sortBy,
        sortOrder,
      };

      const content = await exportSessions({ ...params, format });
      const blob = new Blob([content], {
        type: format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sessions-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ type: 'success', title: t('导出成功') });
    } catch (error) {
      console.error('Failed to export sessions:', error);
      toast({ type: 'error', title: t('导出失败') });
    }
  }, [selectedSessions, filters, searchQuery, sortBy, sortOrder, t]);

  // 格式化时间
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString();
  }, []);

  // 获取状态图标和颜色
  const getStatusIcon = useCallback((status: Session['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-yellow-500" />;
      case 'deleted':
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  }, []);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 统计卡片 */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`grid gap-4 ${
            isMobile ? 'grid-cols-1' :
            isTablet ? 'grid-cols-2 lg:grid-cols-3' :
            'grid-cols-2 lg:grid-cols-5'
          }`}
        >
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-brand-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('会话总数')}</p>
                <p className="text-2xl font-bold">{stats.totalSessions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('活跃会话')}</p>
                <p className="text-2xl font-bold">{stats.activeSessions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center space-x-2">
              <Archive className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('归档会话')}</p>
                <p className="text-2xl font-bold">{stats.archivedSessions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('总消息数')}</p>
                <p className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('平均消息数')}</p>
                <p className="text-2xl font-bold">{stats.averageMessagesPerSession.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 统计图表 */}
      {stats && <SessionStatsChart stats={stats} loading={statsLoading} />}

      {/* 操作栏 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col space-y-4"
      >
        {/* 搜索和筛选栏 */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('搜索会话')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="brand">
              <Search className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {t('筛选')}
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            <Button
              variant="outline"
              onClick={() => loadSessions()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            {selectedSessions.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-200 dark:border-brand-800">
                <span className="text-sm text-brand-700 dark:text-brand-300">
                  {t('选中 {count} 项', { count: selectedSessions.size })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 筛选面板 */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-lg p-4 space-y-4"
            >
              <SessionFilterPanel
                filters={filters}
                onFilterChange={handleFilter}
                onClear={clearFilters}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 批量操作栏 */}
        {selectedSessions.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 p-4 bg-card border border-border rounded-lg"
          >
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
            >
              <Trash2 className="w-4 h-4" />
              {t('删除')}
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={handleBatchArchive}
            >
              <Archive className="w-4 h-4" />
              {t('归档')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBatchTags('add')}
            >
              <Tag className="w-4 h-4" />
              {t('添加标签')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBatchTags('remove')}
            >
              <X className="w-4 h-4" />
              {t('移除标签')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportSelected('json')}
            >
              <Download className="w-4 h-4" />
              {t('导出')}
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* 会话列表 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-card border border-border rounded-lg overflow-hidden"
      >
        {/* 表头 */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="p-2"
              >
                {selectedSessions.size === sessions.length && sessions.length > 0 ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </Button>
              <span className="text-sm font-medium">
                {t('全选')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-border rounded px-2 py-1 bg-background"
              >
                <option value="updatedAt">{t('按更新时间排序')}</option>
                <option value="createdAt">{t('按创建时间排序')}</option>
                <option value="lastMessageAt">{t('最后消息')}</option>
                <option value="messageCount">{t('按消息数量排序')}</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2"
              >
                {sortOrder === 'asc' ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 列表内容 */}
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">{t('加载中...')}</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{t('没有找到匹配的会话')}</p>
              <p className="text-muted-foreground text-sm">
                {t('尝试调整搜索条件或筛选器')}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 hover:bg-muted/30 transition-colors ${
                    selectedSessions.has(session.id) ? 'bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* 选择框 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSessionSelection(session.id)}
                      className="p-2 mt-1"
                    >
                      {selectedSessions.has(session.id) ? (
                        <CheckSquare className="w-4 h-4 text-brand-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </Button>

                    {/* 主要内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(session.status)}
                            <h3 className="font-medium truncate">{session.title}</h3>
                            <span className="text-xs text-muted-foreground">
                              {t('会话ID')}: {session.id.slice(0, 8)}...
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span>{t('用户ID')}: {session.userId.slice(0, 8)}...</span>
                            <span>{t('智能体')}: {session.agentId}</span>
                            <span>{t('消息数量')}: {session.messageCount}</span>
                            <span>{t('创建时间')}: {formatDate(session.createdAt)}</span>
                          </div>

                          {/* 标签 */}
                          {session.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {session.tags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded"
                                >
                                  <Tag className="w-3 h-3 mr-1" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSession(session)}
                            className="p-2"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchiveSession(session)}
                            className="p-2"
                          >
                            {session.status === 'archived' ? (
                              <ArchiveRestore className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSession(session)}
                            className="p-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* 分页 */}
        {total > pageSize && (
          <div className="p-4 border-t border-border">
            <SessionPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </motion.div>

      {/* 详情模态框 */}
      <SessionDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        session={selectedSession}
        onExport={handleExportSession}
      />

      {/* 批量标签模态框 */}
      <BatchTagModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        sessionIds={Array.from(selectedSessions)}
        operation={tagOperation}
        onSuccess={() => {
          setSelectedSessions(new Set());
          loadSessions();
          loadStats();
        }}
      />
    </div>
  );
}

// 筛选面板组件
function SessionFilterPanel({
  filters,
  onFilterChange,
  onClear,
}: {
  filters: SessionFilter;
  onFilterChange: (filters: SessionFilter) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();

  const updateFilter = (key: keyof SessionFilter, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t('状态')}</label>
        <select
          value={filters.status || ''}
          onChange={(e) => updateFilter('status', e.target.value || undefined)}
          className="w-full border border-border rounded px-3 py-2 bg-background"
        >
          <option value="">{t('全部')}</option>
          <option value="active">{t('活跃')}</option>
          <option value="archived">{t('已归档')}</option>
          <option value="deleted">{t('已删除')}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t('开始日期')}</label>
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
          className="w-full border border-border rounded px-3 py-2 bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t('结束日期')}</label>
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
          className="w-full border border-border rounded px-3 py-2 bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t('智能体')}</label>
        <input
          type="text"
          value={filters.agentId || ''}
          onChange={(e) => updateFilter('agentId', e.target.value || undefined)}
          placeholder={t('智能体ID')}
          className="w-full border border-border rounded px-3 py-2 bg-background"
        />
      </div>

      <div className="lg:col-span-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClear}>
          {t('清空筛选')}
        </Button>
        <Button variant="brand" onClick={() => onFilterChange(filters)}>
          {t('应用筛选')}
        </Button>
      </div>
    </div>
  );
}

// 分页组件
function SessionPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const { t } = useI18n();
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t('第 {page} 页，共 {total} 条', { page, total })}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="text-sm border border-border rounded px-2 py-1 bg-background"
        >
          <option value={10}>10 {t('条')}</option>
          <option value={20}>20 {t('条')}</option>
          <option value={50}>50 {t('条')}</option>
          <option value={100}>100 {t('条')}</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          {t('上一页')}
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            return (
              <Button
                key={pageNum}
                variant={page === pageNum ? 'brand' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="min-w-[32px]"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('下一页')}
        </Button>
      </div>
    </div>
  );
}