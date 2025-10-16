/**
 * CAD 操作历史管理 Hook
 *
 * 支持撤销/重做功能
 */

import { useState, useCallback, useRef } from 'react';
import type { DxfEntity } from '@llmchat/shared-types';

export interface CadHistoryEntry {
  id: string;
  timestamp: number;
  action: 'add' | 'delete' | 'move' | 'modify' | 'upload';
  description: string;
  entities: DxfEntity[];
}

interface UseCadHistoryOptions {
  maxHistorySize?: number;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export const useCadHistory = (
  initialEntities: DxfEntity[],
  options: UseCadHistoryOptions = {},
) => {
  const { maxHistorySize = 50, onHistoryChange } = options;

  const [entities, setEntities] = useState(initialEntities);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const historyRef = useRef<CadHistoryEntry[]>([]);

  // 添加历史记录
  const pushHistory = useCallback((
    action: CadHistoryEntry['action'],
    description: string,
    newEntities: DxfEntity[],
  ) => {
    const entry: CadHistoryEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      action,
      description,
      entities: JSON.parse(JSON.stringify(newEntities)), // 深拷贝
    };

    // 移除当前索引之后的历史
    historyRef.current = historyRef.current.slice(0, currentIndex + 1);

    // 添加新记录
    historyRef.current.push(entry);

    // 限制历史记录大小
    if (historyRef.current.length > maxHistorySize) {
      historyRef.current.shift();
    } else {
      setCurrentIndex((prev: number) => prev + 1);
    }

    setEntities(newEntities);

    // 通知历史变化
    onHistoryChange?.(true, false);
  }, [currentIndex, maxHistorySize, onHistoryChange]);

  // 撤销
  const undo = useCallback(() => {
    if (currentIndex <= 0) {
      return false;
    }

    const newIndex = currentIndex - 1;
    const entry = historyRef.current[newIndex];
    if (!entry) {
      return false;
    }

    setCurrentIndex(newIndex);
    setEntities(JSON.parse(JSON.stringify(entry.entities)));

    onHistoryChange?.(newIndex > 0, true);
    return true;
  }, [currentIndex, onHistoryChange]);

  // 重做
  const redo = useCallback(() => {
    if (currentIndex >= historyRef.current.length - 1) {
      return false;
    }

    const newIndex = currentIndex + 1;
    const entry = historyRef.current[newIndex];
    if (!entry) {
      return false;
    }

    setCurrentIndex(newIndex);
    setEntities(JSON.parse(JSON.stringify(entry.entities)));

    onHistoryChange?.(true, newIndex < historyRef.current.length - 1);
    return true;
  }, [currentIndex, onHistoryChange]);

  // 获取历史记录
  const getHistory = useCallback(() => {
    return historyRef.current.map((entry: CadHistoryEntry, index: number) => ({
      ...entry,
      isCurrent: index === currentIndex,
    }));
  }, [currentIndex]);

  // 跳转到特定历史
  const goToHistory = useCallback((index: number) => {
    if (index < 0 || index >= historyRef.current.length) {
      return false;
    }

    const entry = historyRef.current[index];
    if (!entry) {
      return false;
    }

    setCurrentIndex(index);
    setEntities(JSON.parse(JSON.stringify(entry.entities)));

    onHistoryChange?.(
      index > 0,
      index < historyRef.current.length - 1,
    );
    return true;
  }, [onHistoryChange]);

  // 清空历史
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setCurrentIndex(-1);
    onHistoryChange?.(false, false);
  }, [onHistoryChange]);

  return {
    entities,
    setEntities: pushHistory,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < historyRef.current.length - 1,
    history: getHistory(),
    goToHistory,
    clearHistory,
  };
};
