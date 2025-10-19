/**
 * 用户偏好 Store - 专注于用户设置
 *
 * 职责：
 * 1. 主题设置（亮/暗/自动）
 * 2. 语言设置
 * 3. 流式响应开关
 * 4. 自动主题schedule
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserPreferences } from '@/types';

interface PreferenceState {
  preferences: UserPreferences;

  // Actions
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  resetPreferences: () => void;

  // 辅助方法
  getThemeMode: () => string;
  isStreamingEnabled: () => boolean;
  getLanguage: () => string;

  // Zustand store methods
  getState: () => PreferenceState;
}

// 默认偏好设置
const defaultPreferences: UserPreferences = {
  theme: {
    mode: 'auto',
    isAutoMode: true,
    userPreference: 'auto',
  },
  streamingEnabled: true,
  autoThemeSchedule: {
    enabled: true,
    lightModeStart: '06:00',
    darkModeStart: '18:00',
  },
  language: 'zh-CN',
};

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set, get: () => any) => ({
      // 初始状态
      preferences: defaultPreferences,

      // 更新偏好设置
      updatePreferences: (newPreferences: Partial<UserPreferences>) =>
        set((state: any) => ({
          preferences: {
            ...state.preferences,
            ...newPreferences,
            // 深度合并theme对象
            theme: {
              ...state.preferences.theme,
              ...(newPreferences.theme || {}),
            },
            // 深度合并autoThemeSchedule对象
            autoThemeSchedule: {
              ...state.preferences.autoThemeSchedule,
              ...(newPreferences.autoThemeSchedule || {}),
            },
          },
        })),

      // 重置为默认设置
      resetPreferences: () => {
        set({ preferences: defaultPreferences });
      },

      // 获取当前主题模式
      getThemeMode: () => {
        return get().preferences.theme.mode;
      },

      // 检查是否启用流式响应
      isStreamingEnabled: () => {
        return get().preferences.streamingEnabled;
      },

      // 获取当前语言
      getLanguage: () => {
        return get().preferences.language;
      },

      // Zustand store method
      getState: () => get(),
    }),
    {
      name: 'preference-store',
    },
  ),
);

export default usePreferenceStore;
