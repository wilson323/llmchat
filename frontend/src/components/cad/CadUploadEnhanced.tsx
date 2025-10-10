/**
 * CAD 增强型文件上传组件
 *
 * 功能增强：
 * - 拖拽预览
 * - 文件验证详情
 * - 上传动画
 * - 错误提示优化
 */

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  File,
  FileWarning,
  Loader2,
} from 'lucide-react';
import axios from 'axios';
import type { CadFileInfo } from '@llmchat/shared-types';

interface CadUploadEnhancedProps {
  onUploadSuccess: (fileInfo: CadFileInfo, summary: string) => void;
  onUploadError: (error: string) => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  fileName?: string;
  fileSize?: number;
  message?: string;
}

export const CadUploadEnhanced: React.FC<CadUploadEnhancedProps> = ({
  onUploadSuccess,
  onUploadError,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });

  const [dragCounter, setDragCounter] = useState(0);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // 检查文件扩展名
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      return { valid: false, error: '只支持 .dxf 文件格式' };
    }

    // 检查文件大小
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return { valid: false, error: '文件大小超过限制（最大 50MB）' };
    }

    // 检查文件是否为空
    if (file.size === 0) {
      return { valid: false, error: '文件为空，请选择有效的 DXF 文件' };
    }

    return { valid: true };
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: any[]) => {
      // 处理拒绝的文件
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles[0].errors.map((e: any) => e.message).join(', ');
        setUploadState({
          status: 'error',
          progress: 0,
          message: errors,
        });
        onUploadError(errors);
        setTimeout(() => setUploadState({ status: 'idle', progress: 0 }), 3000);
        return;
      }

      if (acceptedFiles.length === 0) {
        return;
      }

      const file = acceptedFiles[0];

      // 验证文件
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploadState({
          status: 'error',
          progress: 0,
          fileName: file.name,
          message: validation.error,
        });
        onUploadError(validation.error!);
        setTimeout(() => setUploadState({ status: 'idle', progress: 0 }), 3000);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      setUploadState({
        status: 'uploading',
        progress: 0,
        fileName: file.name,
        fileSize: file.size,
      });

      try {
        const response = await axios.post('/api/cad/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1),
            );
            setUploadState(prev => ({
              ...prev,
              progress: percentCompleted,
            }));
          },
        });

        if (response.data.code === 'SUCCESS') {
          setUploadState({
            status: 'success',
            progress: 100,
            fileName: file.name,
            message: '上传成功！',
          });

          setTimeout(() => {
            onUploadSuccess(response.data.data.fileInfo, response.data.data.summary);
          }, 500);
        } else {
          throw new Error(response.data.message || '上传失败');
        }
      } catch (error) {
        console.error('上传 DXF 文件失败', error);
        const errorMessage = axios.isAxiosError(error)
          ? error.response?.data?.message || error.message || '上传失败'
          : '未知错误';

        setUploadState({
          status: 'error',
          progress: 0,
          fileName: file.name,
          message: errorMessage,
        });
        onUploadError(errorMessage);
        setTimeout(() => setUploadState({ status: 'idle', progress: 0 }), 3000);
      }
    },
    [onUploadSuccess, onUploadError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/dxf': ['.dxf'],
      'application/x-dxf': ['.dxf'],
      'image/vnd.dxf': ['.dxf'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled: uploadState.status === 'uploading',
    onDragEnter: () => setDragCounter(prev => prev + 1),
    onDragLeave: () => setDragCounter(prev => prev - 1),
    onDropAccepted: () => setDragCounter(0),
    onDropRejected: () => setDragCounter(0),
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${
            uploadState.status === 'uploading'
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-wait'
              : uploadState.status === 'success'
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : uploadState.status === 'error'
              ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
              : isDragActive || dragCounter > 0
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-105 shadow-lg'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:scale-102'
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          {/* 状态图标 */}
          {uploadState.status === 'idle' && (
            <>
              {isDragActive || dragCounter > 0 ? (
                <div className="relative">
                  <FileText className="w-16 h-16 text-blue-500 animate-bounce" />
                  <div className="absolute -inset-2 bg-blue-500/20 rounded-full animate-ping" />
                </div>
              ) : (
                <Upload className="w-16 h-16 text-gray-400 transition-transform hover:scale-110" />
              )}
            </>
          )}

          {uploadState.status === 'uploading' && (
            <div className="relative">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
              <File className="absolute inset-0 m-auto w-8 h-8 text-blue-600" />
            </div>
          )}

          {uploadState.status === 'success' && (
            <div className="relative">
              <CheckCircle2 className="w-16 h-16 text-green-500 animate-in zoom-in duration-300" />
              <div className="absolute -inset-4 bg-green-500/20 rounded-full animate-ping" />
            </div>
          )}

          {uploadState.status === 'error' && (
            <div className="relative">
              <XCircle className="w-16 h-16 text-red-500 animate-in zoom-in duration-300" />
            </div>
          )}

          {/* 状态文本 */}
          <div className="space-y-2">
            {uploadState.status === 'idle' && (
              <>
                <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                  {isDragActive || dragCounter > 0 ? '松开鼠标上传文件' : '拖拽 DXF 文件到这里'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  或点击选择文件上传
                </p>
              </>
            )}

            {uploadState.status === 'uploading' && (
              <>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  上传中...
                </p>
                {uploadState.fileName && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-md">
                    {uploadState.fileName}
                  </p>
                )}
              </>
            )}

            {uploadState.status === 'success' && (
              <>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  上传成功！
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  正在解析文件...
                </p>
              </>
            )}

            {uploadState.status === 'error' && (
              <>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  上传失败
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {uploadState.message}
                </p>
              </>
            )}
          </div>

          {/* 进度条 */}
          {uploadState.status === 'uploading' && (
            <div className="w-full max-w-md space-y-2">
              <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${uploadState.progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                <span>{uploadState.progress}%</span>
                {uploadState.fileSize && (
                  <span>{formatFileSize(uploadState.fileSize)}</span>
                )}
              </div>
            </div>
          )}

          {/* 提示信息 */}
          {uploadState.status === 'idle' && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">
              <AlertCircle className="w-4 h-4" />
              <span>支持 .dxf 格式，最大 50MB</span>
            </div>
          )}
        </div>

        {/* 背景装饰 */}
        {(isDragActive || dragCounter > 0) && (
          <div className="absolute inset-0 bg-blue-500/5 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-blue-500/30 rounded-full animate-float"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 额外提示 */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
          <span>支持 AutoCAD R12 及以上版本的 DXF 文件</span>
        </div>
        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
          <FileWarning className="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
          <span>仅支持 ASCII 格式 DXF，不支持二进制格式</span>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          50% {
            transform: translateY(-20px) scale(1.2);
            opacity: 1;
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
