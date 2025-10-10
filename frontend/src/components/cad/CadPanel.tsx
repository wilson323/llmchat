/**
 * CAD 面板组件
 *
 * 集成文件上传、3D 查看器和操作界面
 */

import React, { useState } from 'react';
import { CadUpload } from './CadUpload';
import { CadViewer } from './CadViewer';
import type { CadFileInfo, DxfEntity } from '@llmchat/shared-types';
import { FileText, Download, Info, Layers } from 'lucide-react';
import axios from 'axios';

interface CadPanelProps {
  onFileLoaded?: (fileId: string, fileInfo: CadFileInfo) => void;
}

export const CadPanel: React.FC<CadPanelProps> = ({ onFileLoaded }) => {
  const [fileInfo, setFileInfo] = useState<CadFileInfo | null>(null);
  const [entities, setEntities] = useState<DxfEntity[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'viewer' | 'info' | 'layers'>('viewer');

  const handleUploadSuccess = (uploadedFileInfo: CadFileInfo, uploadedSummary: string) => {
    setFileInfo(uploadedFileInfo);
    setSummary(uploadedSummary);
    setError('');

    // 加载实体数据
    axios
      .get(`/api/cad/${uploadedFileInfo.id}`)
      .then((response) => {
        if (response.data.code === 'SUCCESS') {
          setEntities(response.data.data.entities);
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

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 上传区域 */}
      {!fileInfo && (
        <div className="flex-shrink-0">
          <CadUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      {/* CAD 查看器和信息 */}
      {fileInfo && (
        <>
          {/* 标签页 */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'viewer'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>查看器</span>
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>信息</span>
            </button>
            <button
              onClick={() => setActiveTab('layers')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'layers'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>图层</span>
            </button>

            <button
              onClick={handleExport}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>导出</span>
            </button>
          </div>

          {/* 标签页内容 */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'viewer' && (
              <div className="p-4">
                <CadViewer
                  entities={entities}
                  width={Math.min(window.innerWidth - 100, 800)}
                  height={600}
                />
              </div>
            )}

            {activeTab === 'info' && (
              <div className="p-4 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <h3 className="font-semibold text-lg mb-3">文件信息</h3>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">文件名:</dt>
                      <dd className="font-medium">{fileInfo.fileName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">文件大小:</dt>
                      <dd className="font-medium">
                        {(fileInfo.fileSize / 1024).toFixed(2)} KB
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">实体数量:</dt>
                      <dd className="font-medium">{fileInfo.entityCount}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">上传时间:</dt>
                      <dd className="font-medium">
                        {new Date(fileInfo.uploadedAt).toLocaleString('zh-CN')}
                      </dd>
                    </div>
                  </dl>
                </div>

                {fileInfo.bounds && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h3 className="font-semibold text-lg mb-3">图纸范围</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">X 范围:</dt>
                        <dd className="font-medium">
                          {fileInfo.bounds.minX.toFixed(2)} ~ {fileInfo.bounds.maxX.toFixed(2)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Y 范围:</dt>
                        <dd className="font-medium">
                          {fileInfo.bounds.minY.toFixed(2)} ~ {fileInfo.bounds.maxY.toFixed(2)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {summary && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                    <h3 className="font-semibold text-lg mb-3">图纸摘要</h3>
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {summary}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'layers' && (
              <div className="p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <h3 className="font-semibold text-lg mb-3">图层列表</h3>
                  <div className="space-y-2">
                    {fileInfo.layers.map((layer) => {
                      const layerEntityCount = entities.filter(
                        (e) => e.layer === layer,
                      ).length;
                      return (
                        <div
                          key={layer}
                          className="flex justify-between items-center p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <span className="font-medium">{layer}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {layerEntityCount} 个实体
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
