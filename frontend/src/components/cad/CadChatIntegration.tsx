/**
 * CAD 聊天集成组件
 *
 * 在聊天界面中嵌入 CAD 编辑器
 */

import React, { useState, useEffect } from 'react';
import { CadPanelComplete } from './CadPanelComplete';
import { cadChatService } from '@/services/cadChatService';
import type { CadFileInfo } from '@llmchat/shared-types';
import { FileText, X, Maximize2, Minimize2 } from 'lucide-react';

interface CadChatIntegrationProps {
  agentId: string;
  onContextChange?: (hasContext: boolean) => void;
}

export const CadChatIntegration: React.FC<CadChatIntegrationProps> = ({
  agentId,
  onContextChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fileInfo, setFileInfo] = useState<CadFileInfo | null>(null);

  const handleFileLoaded = (fileId: string, loadedFileInfo: CadFileInfo) => {
    setFileInfo(loadedFileInfo);
    cadChatService.setContext({ fileId });
    onContextChange?.(true);
  };

  const handleClose = () => {
    cadChatService.clear();
    setFileInfo(null);
    setIsExpanded(false);
    onContextChange?.(false);
  };

  // 当智能体改变时，清空上下文
  useEffect(() => {
    return () => {
      cadChatService.clear();
    };
  }, [agentId]);

  if (!isExpanded && !fileInfo) {
    return null;
  }

  return (
    <div
      className={`
        transition-all duration-300 ease-in-out
        ${isFullscreen
          ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900'
          : 'relative'
        }
      `}
      >
      {/* 头部工具栏 */}
      {fileInfo && !isFullscreen && (
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <div>
              <h3 className="font-semibold text-sm">CAD 编辑器</h3>
              <p className="text-xs opacity-90">{fileInfo.fileName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 hover:bg-white/20 rounded transition-colors"
              title="全屏"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 全屏模式头部 */}
      {isFullscreen && (
        <div className="absolute top-0 right-0 z-10 m-4">
          <button
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="text-sm font-medium">退出全屏</span>
          </button>
        </div>
      )}

      {/* CAD 面板 */}
      <div
        className={`
          ${isFullscreen ? 'h-screen' : 'h-[600px]'}
          border-t border-gray-200 dark:border-gray-700
        `}
      >
        <CadPanelComplete onFileLoaded={handleFileLoaded} />
      </div>

      {/* 提示信息 */}
      {!fileInfo && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
          <div className="text-center max-w-md p-8">
            <FileText className="w-16 h-16 mx-auto mb-4 text-blue-500 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">开始使用 CAD 编辑器</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              上传 DXF 文件，通过自然语言与 AI 对话来修改您的 CAD 图纸
            </p>
            <div className="space-y-2 text-xs text-gray-500 dark:text-gray-500 text-left">
              <p>💡 支持的操作：</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>添加几何图形（直线、圆形、圆弧）</li>
                <li>查询和分析图纸内容</li>
                <li>移动和删除实体</li>
                <li>图层管理和可视化</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
