/**
 * 批量标签模态框组件
 */

'use client';

import React, { useState } from 'react';
import { X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface BatchTagModalProps {
  isOpen: boolean;
  selectedCount?: number;
  sessionIds?: string[];
  operation?: 'add' | 'remove';
  onClose: () => void;
  onConfirm?: (tags: string[]) => void;
  onSuccess?: () => void;
}

/**
 * 批量标签模态框
 * @param isOpen - 是否显示
 * @param selectedCount - 选中的会话数量
 * @param sessionIds - 选中的会话ID列表
 * @param operation - 操作类型
 * @param onClose - 关闭回调
 * @param onConfirm - 确认回调
 * @param onSuccess - 成功回调
 */
export function BatchTagModal({ isOpen, selectedCount, sessionIds, operation, onClose, onConfirm, onSuccess }: BatchTagModalProps) {
  if (!isOpen) {
    return null;
  }

  const count = selectedCount ?? sessionIds?.length ?? 0;
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleConfirm = () => {
    if (tags.length > 0) {
      if (onConfirm) {
        onConfirm(tags);
      }
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-background rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">批量添加标签</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          将为 <strong>{count}</strong> 个会话{operation === 'remove' ? '移除' : '添加'}标签
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-2 block">添加标签</label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    handleAddTag();
                  }
                }}
                placeholder="输入标签名称"
                className="flex-1"
              />
              <Button onClick={handleAddTag} size="sm">
                <Tag className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {tags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">已添加的标签</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-600"
                      aria-label={`删除标签 ${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={tags.length === 0}>
            确认添加
          </Button>
        </div>
      </div>
    </div>
  );
}

