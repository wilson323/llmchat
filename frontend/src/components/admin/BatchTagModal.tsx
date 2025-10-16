'use client';
;
;
;
;
import { Loader2, Plus, Tag, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/i18n';
import { toast } from '@/components/ui/Toast';
import {
  batchAddTags,
  batchRemoveTags,
  type BatchOperationResult,
} from '@/services/sessionApi';

interface BatchTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionIds: string[];
  operation: 'add' | 'remove';
  onSuccess?: () => void;
}

export function BatchTagModal({
  isOpen,
  onClose,
  sessionIds,
  operation,
  onSuccess,
}: BatchTagModalProps) {
  const { t } = useI18n();

  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setTags([]);
      setInputValue('');
    }
  }, [isOpen]);

  // 添加标签
  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setInputValue('');
    }
  };

  // 移除标签
  const removeTag = (tagToRemove: string) => {
    setTags((tags: string[]) => tags.filter((tag: string) => tag !== tagToRemove));
  };

  // 处理输入框回车
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // 执行批量操作
  const handleSubmit = async () => {
    if (tags.length === 0) {
      toast({ type: 'error', title: t('请至少添加一个标签') });
      return;
    }

    setLoading(true);
    try {
      let result: BatchOperationResult;

      if (operation === 'add') {
        result = await batchAddTags(sessionIds, tags);
      } else {
        result = await batchRemoveTags(sessionIds, tags);
      }

      if (result.failed === 0) {
        toast({ type: 'success', title: t('批量操作成功') });
        onSuccess?.();
        onClose();
      } else {
        toast({ type: 'warning', title: t('批量操作部分成功') + ' - ' + t('成功: {success}，失败: {failed}', { success: result.success, failed: result.failed }) });
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error('Failed to batch update tags:', error);
      toast({ type: 'error', title: t('操作失败') });
    } finally {
      setLoading(false);
    }
  };

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
            className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                {operation === 'add' ? (
                  <Tag className="w-5 h-5 text-brand-500" />
                ) : (
                  <X className="w-5 h-5 text-red-500" />
                )}
                <h2 className="text-lg font-medium">
                  {operation === 'add' ? t('添加标签') : t('移除标签')}
                </h2>
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

            {/* 内容 */}
            <div className="p-6 space-y-4">
              {/* 说明文字 */}
              <div className="text-sm text-muted-foreground">
                {operation === 'add' ? (
                  <p>
                    {t('将为 {count} 个会话添加以下标签', { count: sessionIds.length })}
                  </p>
                ) : (
                  <p>
                    {t('将从 {count} 个会话中移除以下标签', { count: sessionIds.length })}
                  </p>
                )}
              </div>

              {/* 输入框 */}
              <div className="flex gap-2">
                <Input
                  placeholder={t('输入标签名称')}
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  onClick={addTag}
                  disabled={!inputValue.trim() || loading}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* 标签列表 */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {operation === 'add' ? t('要添加的标签') : t('要移除的标签')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: string, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                          operation === 'add'
                            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                        }`}
                      >
                        {tag}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTag(tag)}
                          className="p-1 h-auto"
                          disabled={loading}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* 常用标签建议 */}
              <div className="space-y-2">
                <div className="text-sm font-medium">{t('常用标签')}</div>
                <div className="flex flex-wrap gap-2">
                  {(['重要', '待处理', '已完成', '需要跟进', '客户支持', '技术问题', '产品反馈'] as const).map((suggestion: string) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!tags.includes(suggestion)) {
                          setTags((tags: string[]) => [...tags, suggestion]);
                        }
                      }}
                      disabled={tags.includes(suggestion) || loading}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                {t('取消')}
              </Button>
              <Button
                variant={operation === 'add' ? 'brand' : 'destructive'}
                onClick={handleSubmit}
                disabled={tags.length === 0 || loading}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {operation === 'add' ? t('添加') : t('移除')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}