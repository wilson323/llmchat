/**
 * CAD 完整增强面板
 *
 * 集成所有功能：
 * - 文件上传和管理
 * - 3D 查看器
 * - 操作历史
 * - 图层管理
 * - 工具栏
 * - 帮助系统
 */

import React, { useState, useCallback } from 'react';
import CadUploadEnhanced from './CadUploadEnhanced';
import CadViewerEnhanced from './CadViewerEnhanced';
import { useCadHistory } from '@/hooks/useCadHistory';
import type { CadFileInfo, DxfEntity } from '@llmchat/shared-types';
import {
  FileText,
  Download,
  Info,
  Layers,
  History,
  Undo2,
  Redo2,
  HelpCircle,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Search,
  Trash2,
} from 'lucide-react';
import axios from 'axios';

interface CadPanelCompleteProps {
  onFileLoaded?: (fileId: string, fileInfo: CadFileInfo) => void;
}

export const CadPanelComplete: React.FC<CadPanelCompleteProps> = ({ onFileLoaded }) => {
  const [fileInfo, setFileInfo] = useState<CadFileInfo | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'viewer' | 'info' | 'layers' | 'history'>('viewer');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

  const {
    entities,
    setEntities: pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    goToHistory,
    clearHistory,
  } = useCadHistory([], {
    maxHistorySize: 100,
  });

  const handleUploadSuccess = (uploadedFileInfo: CadFileInfo, uploadedSummary: string) => {
    setFileInfo(uploadedFileInfo);
    setSummary(uploadedSummary);
    setError('');

    // 加载实体数据
    axios
      .get(`/api/cad/${uploadedFileInfo.id}`)
      .then((response) => {
        if (response.data.code === 'SUCCESS') {
          pushHistory('upload', '上传文件', response.data.data.entities);
          if (onFileLoaded) {
            onFileLoaded(uploadedFileInfo.id, uploadedFileInfo);
          }
        }
      })
      .catch((err) => {
        console.error('加载 CAD 实体失败', err);
        setError('加载 CAD 实体失败');
      });
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleExport = () => {
    if (!fileInfo) {
      return;
    }
    window.open(`/api/cad/${fileInfo.id}/export`, '_blank');
  };

  const handleEntityClick = useCallback((entity: DxfEntity) => {
    setSelectedEntityId(entity.handle);
    setActiveTab('info');
  }, []);

  const handleEntityHover = useCallback((_entity: DxfEntity | null) => {
    // 可以添加悬停效果
  }, []);

  const toggleLayer = (layer: string) => {
    setHiddenLayers(prev =>
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer],
    );
  };

  const toggleAllLayers = () => {
    if (hiddenLayers.length === 0 && fileInfo) {
      setHiddenLayers(fileInfo.layers);
    } else {
      setHiddenLayers([]);
    }
  };

  const toggleLayerExpanded = (layer: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  const filteredEntities = entities.filter(entity => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entity.type.toLowerCase().includes(query) ||
        entity.layer.toLowerCase().includes(query) ||
        entity.handle.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const selectedEntity = selectedEntityId
    ? entities.find(e => e.handle === selectedEntityId)
    : null;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* 顶部工具栏 */}
      {fileInfo && (
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* 左侧 - 文件信息 */}
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {fileInfo.fileName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {fileInfo.entityCount} 个实体 · {fileInfo.layers.length} 个图层
                </p>
              </div>
            </div>

            {/* 右侧 - 操作按钮 */}
            <div className="flex items-center gap-2">
              {/* 撤销/重做 */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-2 rounded hover:bg-white dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="撤销 (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-2 rounded hover:bg-white dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="重做 (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {/* 帮助 */}
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="帮助"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* 导出 */}
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">导出</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 上传区域 */}
        {!fileInfo && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <CadUploadEnhanced
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 animate-in slide-in-from-top duration-300">
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800 dark:text-red-300">上传失败</h4>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                  </div>
                  <button
                    onClick={() => setError('')}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CAD 查看器和侧边栏 */}
        {fileInfo && (
          <>
            {/* 主查看器 */}
            <div className="flex-1 p-4 overflow-auto">
              <CadViewerEnhanced
                entities={filteredEntities}
                width={Math.min(window.innerWidth - 400, 1200)}
                height={window.innerHeight - 200}
                onEntityClick={handleEntityClick}
                onEntityHover={handleEntityHover}
                selectedEntityId={selectedEntityId || undefined}
                hiddenLayers={hiddenLayers}
              />
            </div>

            {/* 右侧边栏 */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
              {/* 标签页 */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {[
                  { id: 'info', label: '信息', icon: Info },
                  { id: 'layers', label: '图层', icon: Layers },
                  { id: 'history', label: '历史', icon: History },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === id
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* 标签页内容 */}
              <div className="flex-1 overflow-auto p-4">
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    {selectedEntity ? (
                      <>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            已选中实体
                          </h4>
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">类型:</dt>
                              <dd className="font-medium">{selectedEntity.type}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">图层:</dt>
                              <dd className="font-medium">{selectedEntity.layer}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">ID:</dt>
                              <dd className="font-mono text-xs truncate">{selectedEntity.handle}</dd>
                            </div>
                          </dl>
                        </div>
                        <button
                          onClick={() => setSelectedEntityId(null)}
                          className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                        >
                          取消选择
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">点击实体查看详情</p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold mb-3">文件信息</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">文件名:</dt>
                          <dd className="font-medium truncate ml-2">{fileInfo.fileName}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">大小:</dt>
                          <dd className="font-medium">{(fileInfo.fileSize / 1024).toFixed(2)} KB</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">实体:</dt>
                          <dd className="font-medium">{fileInfo.entityCount}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">图层:</dt>
                          <dd className="font-medium">{fileInfo.layers.length}</dd>
                        </div>
                      </dl>
                    </div>

                    {summary && (
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold mb-2">摘要</h4>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded">
                          {summary}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'layers' && (
                  <div className="space-y-3">
                    {/* 搜索和操作 */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="搜索图层或实体..."
                          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={toggleAllLayers}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {hiddenLayers.length === 0 ? (
                            <><EyeOff className="w-3 h-3" /> 全部隐藏</>
                          ) : (
                            <><Eye className="w-3 h-3" /> 全部显示</>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 图层列表 */}
                    <div className="space-y-1">
                      {fileInfo.layers.map((layer) => {
                        const layerEntities = entities.filter(e => e.layer === layer);
                        const isHidden = hiddenLayers.includes(layer);
                        const isExpanded = expandedLayers.has(layer);

                        return (
                          <div key={layer} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div
                              className={`flex items-center gap-2 p-3 cursor-pointer transition-colors ${
                                isHidden
                                  ? 'bg-gray-50 dark:bg-gray-800 opacity-60'
                                  : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                              onClick={() => toggleLayerExpanded(layer)}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLayer(layer);
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                {isHidden ? (
                                  <EyeOff className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <Eye className="w-4 h-4 text-blue-500" />
                                )}
                              </button>

                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}

                              <Layers className="w-4 h-4 text-gray-400" />

                              <div className="flex-1">
                                <div className="font-medium text-sm">{layer}</div>
                                <div className="text-xs text-gray-500">
                                  {layerEntities.length} 个实体
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {layerEntities.map(entity => (
                                    <div
                                      key={entity.handle}
                                      onClick={() => setSelectedEntityId(entity.handle)}
                                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors text-xs ${
                                        selectedEntityId === entity.handle
                                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      <span className="font-medium">{entity.type}</span>
                                      <span className="text-gray-500 truncate flex-1 font-mono text-[10px]">
                                        {entity.handle}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-3">
                    {/* 历史操作栏 */}
                    <div className="flex gap-2">
                      <button
                        onClick={clearHistory}
                        disabled={history.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" />
                        清空历史
                      </button>
                    </div>

                    {/* 历史列表 */}
                    {history.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无操作历史</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {history.map((entry, index) => (
                          <button
                            key={entry.id}
                            onClick={() => goToHistory(index)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              entry.isCurrent
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                                entry.action === 'add' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                entry.action === 'delete' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                entry.action === 'move' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {entry.action}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(entry.timestamp).toLocaleTimeString('zh-CN')}
                              </span>
                            </div>
                            <div className="text-sm font-medium">{entry.description}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {entry.entities.length} 个实体
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 帮助对话框 */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-blue-500" />
                CAD 编辑器帮助
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-6">
                <section>
                  <h3 className="font-semibold text-lg mb-3">快捷键</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'Ctrl + Z', desc: '撤销' },
                      { key: 'Ctrl + Y', desc: '重做' },
                      { key: '鼠标滚轮', desc: '缩放视图' },
                      { key: '鼠标左键拖拽', desc: '旋转视图' },
                      { key: '鼠标右键拖拽', desc: '平移视图' },
                      { key: 'Esc', desc: '取消选择' },
                    ].map(({ key, desc }) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                          {key}
                        </kbd>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{desc}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-3">视图控制</h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>使用顶部视图按钮切换 3D、俯视、正视、侧视</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>点击 "适应视图" 自动调整视角以显示所有实体</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>点击 "重置视图" 恢复默认视角</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-3">图层管理</h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>点击眼睛图标显示/隐藏图层</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>展开图层查看该图层的所有实体</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>使用搜索框快速查找实体</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-lg mb-3">AI 对话操作</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      在聊天框中输入自然语言指令，例如：
                    </p>
                    <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <li>• "在坐标 (50, 50) 处画一个半径为 20 的圆"</li>
                      <li>• "从 (0, 0) 到 (100, 100) 画一条直线"</li>
                      <li>• "显示所有圆形的信息"</li>
                      <li>• "移动实体 abc123 向右 10 个单位"</li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
