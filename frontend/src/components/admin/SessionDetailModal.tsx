/**
 * 会话详情模态框组件
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Session } from '@/services/sessionApi';

interface SessionDetailModalProps {
  isOpen: boolean;
  session: Session | null;
  onClose: () => void;
}

/**
 * 会话详情模态框
 * @param isOpen - 是否显示
 * @param session - 会话数据
 * @param onClose - 关闭回调
 */
export function SessionDetailModal({ isOpen, session, onClose }: SessionDetailModalProps) {
  if (!isOpen || !session) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">会话详情</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">会话ID</label>
            <p className="text-sm text-foreground">{session.id}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">标题</label>
            <p className="text-sm text-foreground">{session.title}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">智能体</label>
            <p className="text-sm text-foreground">{session.agentId}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">创建时间</label>
            <p className="text-sm text-foreground">{new Date(session.createdAt).toLocaleString('zh-CN')}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">更新时间</label>
            <p className="text-sm text-foreground">{new Date(session.updatedAt).toLocaleString('zh-CN')}</p>
          </div>

          {session.tags && session.tags.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-600">标签</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {session.tags.map((tag, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-600">消息数量</label>
            <p className="text-sm text-foreground">{session.messageCount ?? 0}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">状态</label>
            <p className="text-sm text-foreground">
              {session.status === 'archived' ? '已归档' : session.status === 'deleted' ? '已删除' : '活跃'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  );
}

