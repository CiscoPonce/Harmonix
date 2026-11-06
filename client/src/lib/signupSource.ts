const STORAGE_KEY = 'harmonix_signup_source';

export function normalizeSignupSource(raw: string | null): string | null {
  if (raw == null) return null;
  const value = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(value) ? value : null;
}

export function rememberSignupSource(raw: string | null): void {
  if (typeof window === 'undefined') return;
  const value = normalizeSignupSource(raw);
  if (!value) return;
  window.sessionStorage.setItem(STORAGE_KEY, value);
}

export function readSignupSource(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeSignupSource(window.sessionStorage.getItem(STORAGE_KEY));
}
