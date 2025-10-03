import '@/styles/globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';

// Phase 5: 监控与性能
import { initSentry } from './lib/sentry';
import { initWebVitals, monitorResourcePerformance, monitorLongTasks } from './lib/webVitals';
import { analytics } from './lib/analytics';

// Phase 6: 国际化（已通过I18nProvider集成）
import './i18n/config';

// Phase 7: PWA - Service Worker注册
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('✅ Service Worker注册成功:', registration.scope);
      },
      (error) => {
        console.log('❌ Service Worker注册失败:', error);
      }
    );
  });
}

// 初始化Sentry错误追踪
initSentry();

// 初始化Web Vitals性能监控
initWebVitals();
monitorResourcePerformance();
monitorLongTasks();

// 初始化用户行为分析
analytics.init({
  enabled: import.meta.env.PROD || import.meta.env.VITE_ANALYTICS_ENABLED === 'true',
  debug: import.meta.env.DEV,
});

console.log('🚀 LLMChat启动完成');
console.log('📊 监控: Sentry + Web Vitals + Analytics');
console.log('🌍 国际化: i18next');
console.log('📱 PWA: Service Worker');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);