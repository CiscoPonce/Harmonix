import { useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { detectBrowserLanguage, getPlural, getTranslation, type LanguageCode } from './i18n.dictionary';

export { TRANSLATIONS, getTranslation, getPlural, detectBrowserLanguage, SUPPORTED_LANGUAGES } from './i18n.dictionary';
export type { LanguageCode } from './i18n.dictionary';

type Vars = Record<string, string | number>;

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('languagechange', callback);
  return () => window.removeEventListener('languagechange', callback);
}

function getBrowserLang(): LanguageCode {
  if (typeof navigator === 'undefined') return 'en';
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detectBrowserLanguage(list);
}

function getServerLang(): LanguageCode {
  return 'en';
}

export function useTranslation() {
  const { user } = useAuth();
  const browserLang = useSyncExternalStore(subscribe, getBrowserLang, getServerLang);
  const langCode = (user?.native_language as LanguageCode | undefined) || browserLang;

  const t = (key: string, vars?: Vars): string => {
    return getTranslation(key, langCode, vars);
  };
  const tp = (baseKey: string, n: number): string => getPlural(baseKey, n, langCode);

  return { t, tp, langCode };
}
