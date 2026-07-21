export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['value'];

export function languageLabel(code: string | undefined | null): string {
  if (!code) return '';
  return LANGUAGES.find((l) => l.value === code)?.label || code.toUpperCase();
}
