/**
 * CAD 文件上传组件
 */


import { AlertCircle, FileText, Upload } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios, { type AxiosProgressEvent } from 'axios';
import type { CadFileInfo } from '@llmchat/shared-types';

interface CadUploadProps {
  onUploadSuccess: (fileInfo: CadFileInfo, summary: string) => void;
  onUploadError: (error: string) => void;
}

export const CadUpload: React.FC<CadUploadProps> = ({
  onUploadSuccess,
  onUploadError,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      setUploading(true);
      setProgress(0);

      try {
        const response = await axios.post('/api/cad/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1),
            );
            setProgress(percentCompleted);
          },
        });

        if (response.data.code === 'SUCCESS') {
          onUploadSuccess(response.data.data.fileInfo, response.data.data.summary);
        } else {
          onUploadError(response.data.message || '上传失败');
        }
      } catch (error) {
        console.error('上传 DXF 文件失败', error);
        onUploadError(
          axios.isAxiosError(error)
            ? error.response?.data?.message || '上传失败'
            : '未知错误',
        );
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onUploadSuccess, onUploadError],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/dxf': ['.dxf'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading,
    multiple: false,
    onDragEnter: (): void => {},
    onDragLeave: (): void => {},
    onDragOver: (): void => {},
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
        `}
      >
        <input {...getInputProps()} type="file" />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <Upload className="w-12 h-12 text-blue-500 animate-pulse" />
              <div className="w-full max-w-xs">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  上传中... {progress}%
                </p>
              </div>
            </>
          ) : isDragActive ? (
            <>
              <FileText className="w-12 h-12 text-blue-500" />
              <p className="text-lg text-blue-600 dark:text-blue-400">
                松开鼠标上传文件
              </p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  拖拽 DXF 文件到这里
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  或点击选择文件上传
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <AlertCircle className="w-4 h-4" />
                <span>支持 .dxf 格式，最大 50MB</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
