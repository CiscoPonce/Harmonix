import { useAuth } from '@/hooks/useAuth';
import { getPlural, getTranslation } from './i18n.dictionary';

export { TRANSLATIONS, getTranslation, getPlural } from './i18n.dictionary';
export type { LanguageCode } from './i18n.dictionary';

type Vars = Record<string, string | number>;

export function useTranslation() {
  const { user } = useAuth();
  const langCode = user?.native_language || 'en';

  const t = (key: string, vars?: Vars): string => {
    return getTranslation(key, langCode, vars);
  };
  const tp = (baseKey: string, n: number): string => getPlural(baseKey, n, langCode);

  return { t, tp, langCode };
}
