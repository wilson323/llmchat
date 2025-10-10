import '@/styles/globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useAuthStore } from '@/store/authStore';

/**
 * 高可用 & 低延时设计:
 * - 可选功能延迟加载，不阻塞主渲染
 * - 功能降级，缺失依赖时使用Stub
 * - 异步初始化，提升首屏速度
 * - 应用启动时恢复认证状态
 */

// 🔐 恢复认证状态（在渲染前执行）
useAuthStore.getState().restore();

// 默认Provider（无i18n）
const DefaultI18nProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/**
 * 异步初始化可选功能（低延时：不阻塞主渲染）
 */
async function initOptionalFeatures() {
  // 1. Sentry错误追踪（可选）
  try {
    const { initSentry } = await import('./lib/sentry');
    await initSentry();
  } catch {
    console.info('ℹ️  Sentry未启用');
  }

  // 2. Web Vitals性能监控（可选）
  try {
    const { initWebVitals, monitorResourcePerformance, monitorLongTasks } = await import('./lib/webVitals');
    initWebVitals();
    monitorResourcePerformance();
    monitorLongTasks();
  } catch {
    console.info('ℹ️  Web Vitals未启用');
  }

  // 3. 用户行为分析（可选）
  try {
    const { analytics } = await import('./lib/analytics');
    analytics.init({
      enabled: import.meta.env.PROD || import.meta.env.VITE_ANALYTICS_ENABLED === 'true',
      debug: import.meta.env.DEV,
    });
  } catch {
    console.info('ℹ️  Analytics未启用');
  }
}

// 4. PWA - Service Worker注册（低延时：延迟到load事件）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('✅ Service Worker注册成功:', registration.scope);
      },
      (error) => {
        console.log('❌ Service Worker注册失败:', error);
      },
    );
  });
}

// 低延时：延迟初始化可选功能
requestIdleCallback(() => {
  initOptionalFeatures();
}, { timeout: 2000 });

console.log('🚀 LLMChat启动完成');
console.log('📊 监控: Sentry + Web Vitals + Analytics');
console.log('🌍 国际化: i18next');
console.log('📱 PWA: Service Worker');

// 立即渲染应用（低延时：最快首屏）
// 修复：确保只创建一次 root 实例
const rootElement = document.getElementById('root');
if (rootElement && !rootElement.hasAttribute('data-root-initialized')) {
  rootElement.setAttribute('data-root-initialized', 'true');
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <DefaultI18nProvider>
        <App />
      </DefaultI18nProvider>
    </React.StrictMode>,
  );

  console.log('⚡ 首屏渲染完成');
  console.log('📝 注意: 可选功能（Sentry/i18n等）后台异步加载中...');
}