/**
 * i18n Stub（存根实现）
 * 
 * 用途:
 * - 当react-i18next未安装时的降级实现
 * - 仅返回中文，保持核心功能可用
 */

import React from 'react';

// 简单的翻译函数（返回key作为默认值）
export const t = (key: string, defaultValue?: string) => {
  return defaultValue || key;
};

// Stub Provider
export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Stub Hook
export const useI18n = () => ({
  t,
  language: 'zh-CN',
  changeLanguage: (lng: string) => {
    console.info(`ℹ️  [i18n Stub] 语言切换请求: ${lng} (功能未启用)`);
  },
});

export default {
  t,
  language: 'zh-CN',
  changeLanguage: () => {},
};

