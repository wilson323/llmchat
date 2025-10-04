/**
 * CAD 聊天界面集成示例
 * 
 * 展示如何在实际聊天界面中集成 CAD 编辑器
 */

import React, { useState } from 'react';
import { CadChatIntegration } from '@/components/cad/CadChatIntegration';
import { CadQuickActions } from '@/components/cad/CadQuickActions';
import { useCadKeyboardShortcuts } from '@/components/cad/CadKeyboardShortcuts';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ToastContainer, useToast } from '@/components/common/Toast';
import { cadChatService } from '@/services/cadChatService';

export const CadChatExample: React.FC = () => {
  const [currentAgent, _setCurrentAgent] = useState({ id: 'cad-editor-agent', name: 'CAD 编辑智能体' });
  const [hasContext, setHasContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error: showError, info } = useToast();

  // 处理上下文变化
  const handleContextChange = (hasCtx: boolean) => {
    setHasContext(hasCtx);
    if (hasCtx) {
      success('CAD 文件已加载');
    }
  };

  // 快捷操作处理
  const handleAddLine = async () => {
    if (!hasContext) {
      info('请先上传 CAD 文件');
      return;
    }
    
    try {
      setLoading(true);
      const result = await cadChatService.executeOperation('add_line', {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 100, y: 100, z: 0 },
      });
      success(result.message);
    } catch (err) {
      showError('添加直线失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCircle = async () => {
    if (!hasContext) {
      info('请先上传 CAD 文件');
      return;
    }
    
    try {
      setLoading(true);
      const result = await cadChatService.executeOperation('add_circle', {
        center: { x: 50, y: 50, z: 0 },
        radius: 25,
      });
      success(result.message);
    } catch (err) {
      showError('添加圆形失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const context = cadChatService.getContext();
    if (context.fileId) {
      window.open(`/api/cad/${context.fileId}/export`, '_blank');
      success('正在导出文件');
    } else {
      info('请先上传 CAD 文件');
    }
  };

  // 键盘快捷键
  useCadKeyboardShortcuts({
    onUndo: () => {
      // 撤销操作
      console.log('Undo');
    },
    onRedo: () => {
      // 重做操作
      console.log('Redo');
    },
    onSave: () => {
      // 保存操作
      handleExport();
    },
    onEscape: () => {
      // 取消选择
      console.log('Escape');
    },
    enabled: hasContext,
  });

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* 顶部导航 */}
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {currentAgent.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                通过自然语言修改 CAD 图纸
              </p>
            </div>
            
            {hasContext && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                  已连接
                </span>
              </div>
            )}
          </div>
        </header>

        {/* 主内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 聊天区域 */}
          <div className="flex-1 flex flex-col">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {/* 欢迎消息 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    👋 欢迎使用 CAD 编辑智能体
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    我可以帮你通过自然语言修改 CAD 图纸。先上传一个 DXF 文件，然后告诉我你想做什么修改。
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                    <p>💡 示例指令：</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>在坐标 (50, 50) 处画一个半径为 20 的圆</li>
                      <li>从 (0, 0) 到 (100, 100) 画一条直线</li>
                      <li>显示所有圆形的信息</li>
                    </ul>
                  </div>
                </div>

                {/* 这里可以添加聊天消息 */}
              </div>
            </div>

            {/* 快捷操作栏（可选） */}
            {hasContext && (
              <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
                <CadQuickActions
                  onAddLine={handleAddLine}
                  onAddCircle={handleAddCircle}
                  onExport={handleExport}
                  disabled={loading}
                />
              </div>
            )}

            {/* 输入框 */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={
                      hasContext
                        ? '输入自然语言指令，例如：在坐标 (50, 50) 处画一个半径为 20 的圆'
                        : '请先上传 CAD 文件'
                    }
                    disabled={!hasContext || loading}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
                  />
                  <button
                    disabled={!hasContext || loading}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {loading ? '处理中...' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CAD 编辑器侧边栏 */}
          <div className="w-[600px] border-l border-gray-200 dark:border-gray-700 overflow-hidden">
            <CadChatIntegration
              agentId={currentAgent.id}
              onContextChange={handleContextChange}
            />
          </div>
        </div>

        {/* Toast 通知容器 */}
        <ToastContainer />

        {/* 全局加载 */}
        {loading && <LoadingSpinner fullscreen text="处理中..." />}
      </div>
    </ErrorBoundary>
  );
};
