/**
 * CAD 快捷操作工具栏
 */

import React from 'react';
import {
  Plus,
  Circle,
  Minus,
  Move,
  Search,
  Download,
  Trash2,
  Copy,
  RotateCw,
} from 'lucide-react';

interface CadQuickActionsProps {
  onAddLine?: () => void;
  onAddCircle?: () => void;
  onAddArc?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onRotate?: () => void;
  onSearch?: () => void;
  onExport?: () => void;
  disabled?: boolean;
}

export const CadQuickActions: React.FC<CadQuickActionsProps> = ({
  onAddLine,
  onAddCircle,
  onAddArc,
  onMove,
  onDelete,
  onCopy,
  onRotate,
  onSearch,
  onExport,
  disabled = false,
}) => {
  const actions = [
    { icon: Plus, label: '添加直线', onClick: onAddLine, color: 'text-blue-500' },
    { icon: Circle, label: '添加圆形', onClick: onAddCircle, color: 'text-green-500' },
    { icon: Minus, label: '添加圆弧', onClick: onAddArc, color: 'text-purple-500' },
    { icon: Move, label: '移动', onClick: onMove, color: 'text-orange-500' },
    { icon: Copy, label: '复制', onClick: onCopy, color: 'text-cyan-500' },
    { icon: RotateCw, label: '旋转', onClick: onRotate, color: 'text-pink-500' },
    { icon: Trash2, label: '删除', onClick: onDelete, color: 'text-red-500' },
    { icon: Search, label: '搜索', onClick: onSearch, color: 'text-indigo-500' },
    { icon: Download, label: '导出', onClick: onExport, color: 'text-emerald-500' },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {actions.map(({ icon: Icon, label, onClick, color }) => (
        <button
          key={label}
          onClick={onClick}
          disabled={disabled || !onClick}
          className={`
            group relative flex items-center gap-2 px-3 py-2 rounded-lg
            transition-all duration-200
            ${disabled || !onClick
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-105 active:scale-95'
            }
          `}
          title={label}
        >
          <Icon className={`w-5 h-5 ${color} transition-transform group-hover:scale-110`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          
          {/* 悬停提示 */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {label}
          </div>
        </button>
      ))}
    </div>
  );
};
