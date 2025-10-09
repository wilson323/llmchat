/**
 * i18n国际化配置
 * 
 * 支持语言：
 * - zh-CN: 简体中文
 * - en-US: 英语
 * - ja-JP: 日语
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入翻译资源
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const resources = {
  'zh-CN': { translation: zhCN },
  'en-US': { translation: enUS },
};

i18n
  // 检测用户语言
  .use(LanguageDetector)
  // 传递i18n实例给react-i18next
  .use(initReactI18next)
  // 初始化i18next
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: import.meta.env.DEV,
    
    interpolation: {
      escapeValue: false, // React已经处理XSS
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;

