import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from '../dates';
import { en } from './en';
import { nb, type TranslationKey } from './nb';

export type { TranslationKey } from './nb';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { nb, en };
const STORAGE_KEY = 'fos-locale';

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? nb[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/** Use for dynamic keys like `status.${status}`; falls back to the key itself. */
export function isTranslationKey(key: string): key is TranslationKey {
  return key in nb;
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'nb' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'nb';
}

export function I18nProvider({ children, locale: forced }: { children: ReactNode; locale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(forced ?? initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale === 'nb' ? 'nb' : 'en';
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback<TFunction>((key, vars) => translate(locale, key, vars), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
