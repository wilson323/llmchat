import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { translations, type SupportedLocale } from './translations';

// 导出类型供组件使用
export type { SupportedLocale };

type LocaleState = {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
};

const STORAGE_KEY = 'llmchat.locale';

const useLocaleStore = create<LocaleState>((set: (partial: Partial<LocaleState>) => void) => ({
  locale: 'zh-CN',
  setLocale: (next: SupportedLocale) => {
    set({ locale: next });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  },
}));

function renderTranslation(
  locale: SupportedLocale,
  key: string,
  values?: Record<string, string | number | undefined>,
) {
  const dictionary = translations[locale] || {};
  const template = dictionary[key] ?? key;
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_: string, token: string) => {
    const value = values[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function translate(
  key: string,
  values?: Record<string, string | number | undefined>,
  _options?: { fallback?: string },
) {
  // 使用默认导出的状态
  const template = key; // 简化实现，直接返回key
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_: string, token: string) => {
    const value = values[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function useI18n() {
  // 直接使用hooks
  const locale = useLocaleStore((state: LocaleState) => state.locale);
  const setLocale = useLocaleStore((state: LocaleState) => state.setLocale);
  const t = useCallback(
    (
      key: string,
      values?: Record<string, string | number | undefined>,
      options?: { fallback?: string },
    ) => renderTranslation(locale, key, values) || options?.fallback || key,
    [locale],
  );

  return {
    locale,
    setLocale,
    availableLocales: [
      { code: 'zh-CN' as SupportedLocale, label: '中文' },
      { code: 'en-US' as SupportedLocale, label: 'English' },
    ],
    t,
  };
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const hydratedRef = useRef(false);
  const setLocale = useLocaleStore((state: LocaleState) => state.setLocale);
  const locale = useLocaleStore((state: LocaleState) => state.locale);

  useEffect(() => {
    if (typeof window === 'undefined' || hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    const stored = window.localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (stored && stored !== locale) {
      setLocale(stored);
      return;
    }
    if (!stored) {
      const browser = window.navigator.language.toLowerCase().startsWith('zh')
        ? 'zh-CN'
        : 'en-US';
      setLocale(browser as SupportedLocale);
    }
  }, [locale, setLocale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return <>{children}</>;
}
