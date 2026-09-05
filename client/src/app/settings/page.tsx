'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SpotifyConnectionCard } from '@/components/SpotifyConnectionCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  apiFetch,
  disconnectSpotify,
  fetchSpotifyStatus,
  startSpotifyAuth,
} from '@/lib/api';
import { LANGUAGES, languageLabel } from '@/lib/languages';
import { useTranslation } from '@/lib/i18n';
import {
  parseSpotifyCallbackOutcome,
  type ConnectionState,
} from '@/lib/spotifyContracts';

const ERROR_COPY =
  'Spotify authorization didn’t complete. You can try connecting again.';
const PROVIDER_ERROR_COPY =
  'Spotify is unavailable right now. Your Harmonix library is still available. Try again.';

const selectClassName =
  'mt-1.5 flex h-10 w-full rounded-lg border border-[#E4EBE6] bg-[#F7F8F6] px-3 text-sm text-[#0C1210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B4D2E]/40 dark:border-[#2A3530] dark:bg-[#121A17] dark:text-[#F2F5F3] dark:focus-visible:ring-[#3DCF7A]/40';

const cardClassName =
  'rounded-2xl border border-[#E4EBE6] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B] sm:p-6';

const MUSIC_STYLES = [
  { value: 'any', label: 'Any' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'reggaeton', label: 'Reggaeton' },
] as const;

function normalizeGenre(value: string | undefined | null): string {
  const g = String(value || 'pop').toLowerCase();
  return MUSIC_STYLES.some((s) => s.value === g) ? g : 'pop';
}

function genreLabel(value: string | undefined | null): string {
  const g = normalizeGenre(value);
  return MUSIC_STYLES.find((s) => s.value === g)?.label || 'Pop';
}

function SettingsContent() {
  const { user, isLoading: authLoading, logout, refreshUser } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackOutcome = parseSpotifyCallbackOutcome(searchParams.get('spotify'));
  const clearedCallback = useRef(false);

  const [state, setState] = useState<ConnectionState>('connect');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [clientIdPrefix, setClientIdPrefix] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [statusTick, setStatusTick] = useState(0);
  const [copiedUri, setCopiedUri] = useState(false);

  const [nativeLanguage, setNativeLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [musicStyle, setMusicStyle] = useState('pop');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [langSaving, setLangSaving] = useState(false);
  const [langError, setLangError] = useState<string | null>(null);
  const [langSaved, setLangSaved] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNativeLanguage(user.native_language || '');
    setTargetLanguage(user.target_language || '');
    setMusicStyle(normalizeGenre(user.genre));
    setVoiceGender(user.voice_gender === 'male' ? 'male' : 'female');
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not change password');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPasswordBusy(false);
    }
  };

  const languagesDirty =
    nativeLanguage !== (user?.native_language || '') ||
    targetLanguage !== (user?.target_language || '') ||
    musicStyle !== normalizeGenre(user?.genre) ||
    voiceGender !== (user?.voice_gender === 'male' ? 'male' : 'female');

  useEffect(() => {
    if (!callbackOutcome || clearedCallback.current) return;
    clearedCallback.current = true;
    if (callbackOutcome === 'connected') {
      router.replace('/playlists?spotify=connected');
      return;
    }
    router.replace('/settings', { scroll: false });
  }, [callbackOutcome, router]);

  const recoveryMessage = callbackOutcome === 'error' ? ERROR_COPY : message;
  const cardState: ConnectionState =
    callbackOutcome === 'error'
      ? 'provider_error'
      : statusLoading
        ? 'connecting'
        : state;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const dto = await fetchSpotifyStatus();
        if (!active) return;
        setState(dto.state);
        setDisplayName(dto.display_name);
        setRedirectUri(dto.redirect_uri ?? null);
        setClientIdPrefix(dto.client_id_prefix ?? null);
        if (dto.state === 'reconnect') {
          setMessage('Your Spotify connection expired. Reconnect to continue.');
        } else if (dto.state === 'provider_error') {
          setMessage(PROVIDER_ERROR_COPY);
        } else if (callbackOutcome !== 'error') {
          setMessage(null);
        }
      } catch {
        if (!active) return;
        setState('provider_error');
        setMessage(PROVIDER_ERROR_COPY);
      } finally {
        if (active) setStatusLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user, authLoading, router, statusTick, callbackOutcome]);

  const reloadStatus = useCallback(() => {
    setStatusLoading(true);
    setStatusTick((n) => n + 1);
  }, []);

  const handleConnect = async () => {
    if (mutationBusy) return;
    setMutationBusy(true);
    setState('connecting');
    setMessage(null);
    try {
      const url = await startSpotifyAuth();
      const width = 600;
      const height = 720;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;
      const popup = window.open(
        url,
        'spotify_auth',
        `width=${width},height=${height},top=${top},left=${left}`
      );
      if (!popup || popup.closed) {
        window.location.assign(url);
      }
    } catch {
      setState('provider_error');
      setMessage(PROVIDER_ERROR_COPY);
      setMutationBusy(false);
    }
  };

  const handleDisconnectConfirm = async () => {
    if (mutationBusy) return;
    setMutationBusy(true);
    setConfirmDisconnect(false);
    setState('disconnecting');
    try {
      await disconnectSpotify();
      setState('disconnected');
      setDisplayName(null);
      setMessage(null);
      window.setTimeout(() => {
        setState('connect');
      }, 1600);
    } catch {
      setState('provider_error');
      setMessage(PROVIDER_ERROR_COPY);
      reloadStatus();
    } finally {
      setMutationBusy(false);
    }
  };

  const handleSaveProfilePrefs = async (override?: {
    nativeLanguage?: string;
    targetLanguage?: string;
    musicStyle?: string;
    voiceGender?: 'female' | 'male';
  }) => {
    if (langSaving) return;
    const nextNative = override?.nativeLanguage ?? nativeLanguage;
    const nextTarget = override?.targetLanguage ?? targetLanguage;
    const nextStyle = override?.musicStyle ?? musicStyle;
    const nextVoice = override?.voiceGender ?? voiceGender;
    if (!nextNative || !nextTarget) {
      setLangError('Select both your home language and the language you are learning.');
      return;
    }
    if (nextNative === nextTarget) {
      setLangError('Home and learning languages must be different.');
      return;
    }

    setLangSaving(true);
    setLangError(null);
    setLangSaved(false);
    try {
      const res = await apiFetch('/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          native_language: nextNative,
          target_language: nextTarget,
          genre: nextStyle,
          voice_gender: nextVoice,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save preferences');
      }
      await refreshUser();
      setLangSaved(true);
      window.setTimeout(() => setLangSaved(false), 2500);
    } catch (err) {
      setLangError(err instanceof Error ? err.message : 'Could not save preferences');
    } finally {
      setLangSaving(false);
    }
  };

  // Auto-save when languages / style / voice change (Save button is a visible backup).
  useEffect(() => {
    if (!user || !languagesDirty || langSaving) return;
    if (!nativeLanguage || !targetLanguage || nativeLanguage === targetLanguage) return;
    const timer = window.setTimeout(() => {
      void handleSaveProfilePrefs();
    }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save when dirty fields change
  }, [nativeLanguage, targetLanguage, musicStyle, voiceGender, languagesDirty]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7F5] text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5C6B62]" aria-label="Loading" />
      </div>
    );
  }

  return (
    <AppShell
      userEmail={user.email}
      onLogout={logout}
      pageTitle={t('settings_title')}
      searchPlaceholder={t('search_song_for_word')}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header>
          <h1 className="font-display text-3xl font-bold italic tracking-tight text-[#0B4D2E] dark:text-[#3DCF7A] sm:text-4xl">
            {t('settings_title')}
          </h1>
          <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
            {t('settings_subtitle')}
          </p>
        </header>

        <section aria-label="Profile" className={cardClassName}>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-lg font-bold text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
              {(user.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user.native_language ? (
                  <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                    Home · {languageLabel(user.native_language)}
                  </span>
                ) : null}
                {user.target_language ? (
                  <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                    Learning · {languageLabel(user.target_language)}
                  </span>
                ) : null}
                <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                  Style · {genreLabel(user.genre)}
                </span>
                <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                  {t('voice_label')} · {user.voice_gender === 'male' ? t('voice_male') : t('voice_female')}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Password" className={cardClassName}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
            {t('security')}
          </p>
          <h2 className="mt-1 text-base font-bold">{t('change_password')}</h2>
          <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
            {t('change_password_hint')}
          </p>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <div>
              <label htmlFor="current-password" className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]">
                {t('current_password')}
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]">
                {t('new_password')}
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]">
                {t('confirm_new_password')}
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1.5"
              />
            </div>
            {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            {passwordSaved ? (
              <p className="text-sm text-[#0B4D2E] dark:text-[#3DCF7A]">{t('password_updated')}</p>
            ) : null}
            <Button type="submit" variant="primary" disabled={passwordBusy}>
              {passwordBusy ? t('saving') : t('update_password')}
            </Button>
          </form>
        </section>

        <section aria-label="Languages and voice" className={cardClassName}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
            {t('learning_profile')}
          </p>
          <h2 className="mt-1 text-base font-bold">{t('languages_style_voice')}</h2>
          <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
            {t('learning_profile_hint')}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="settings-native-language"
                className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]"
              >
                {t('home_language_ui')}
              </label>
              <select
                id="settings-native-language"
                value={nativeLanguage}
                onChange={(e) => {
                  setNativeLanguage(e.target.value);
                  setLangError(null);
                  setLangSaved(false);
                }}
                className={selectClassName}
              >
                <option value="">{t('select_language')}</option>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="settings-target-language"
                className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]"
              >
                {t('target_language')}
              </label>
              <select
                id="settings-target-language"
                value={targetLanguage}
                onChange={(e) => {
                  setTargetLanguage(e.target.value);
                  setLangError(null);
                  setLangSaved(false);
                }}
                className={selectClassName}
              >
                <option value="">{t('select_language')}</option>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]">
              {t('music_genre')}
            </p>
            <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              {t('music_style_hint')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('music_genre')}>
              {MUSIC_STYLES.map((opt) => {
                const active = musicStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setMusicStyle(opt.value);
                      setLangError(null);
                      setLangSaved(false);
                    }}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                      active
                        ? 'border-[#0B4D2E] bg-[#E8F5EE] text-[#0B4D2E] dark:border-[#3DCF7A] dark:bg-[#0B4D2E]/35 dark:text-[#3DCF7A]'
                        : 'border-[#E4EBE6] bg-[#F7F8F6] text-[#5C6B62] hover:border-[#0B4D2E]/40 dark:border-[#2A3530] dark:bg-[#121A17] dark:text-[#9AABA0]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#5C6B62] dark:text-[#9AABA0]">
              {t('voice_gender')}
            </p>
            <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              {t('voice_gender_hint')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('voice_gender')}>
              {(
                [
                  { value: 'female', label: t('voice_female') },
                  { value: 'male', label: t('voice_male') },
                ] as const
              ).map((opt) => {
                const active = voiceGender === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setVoiceGender(opt.value);
                      setLangError(null);
                      setLangSaved(false);
                    }}
                    className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      active
                        ? 'border-[#0B4D2E] bg-[#E8F5EE] text-[#0B4D2E] dark:border-[#3DCF7A] dark:bg-[#0B4D2E]/35 dark:text-[#3DCF7A]'
                        : 'border-[#E4EBE6] bg-[#F7F8F6] text-[#5C6B62] hover:border-[#0B4D2E]/40 dark:border-[#2A3530] dark:bg-[#121A17] dark:text-[#9AABA0]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {langError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{langError}</p>
          )}
          {langSaved && !langError && (
            <p className="mt-3 text-sm font-medium text-[#0B4D2E] dark:text-[#3DCF7A]">
              {t('preferences_saved')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              className="bg-[#0B4D2E] text-white hover:bg-[#093d25] border-[#0B4D2E] disabled:opacity-60 dark:bg-[#3DCF7A] dark:text-[#0C1210] dark:border-[#3DCF7A] dark:hover:bg-[#2FB86A]"
              onClick={() => void handleSaveProfilePrefs()}
              disabled={langSaving || !languagesDirty}
            >
              {langSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('saving')}
                </>
              ) : languagesDirty ? (
                t('save_changes')
              ) : (
                t('saved')
              )}
            </Button>
            {languagesDirty && (
              <button
                type="button"
                className="text-sm font-medium text-[#5C6B62] underline-offset-4 hover:underline dark:text-[#9AABA0]"
                onClick={() => {
                  setNativeLanguage(user.native_language || '');
                  setTargetLanguage(user.target_language || '');
                  setMusicStyle(normalizeGenre(user.genre));
                  setVoiceGender(user.voice_gender === 'male' ? 'male' : 'female');
                  setLangError(null);
                  setLangSaved(false);
                }}
              >
                {t('reset')}
              </button>
            )}
            <p className="w-full text-xs text-[#5C6B62] dark:text-[#9AABA0]">
              {t('autosave_hint')}
            </p>
          </div>
        </section>

        <SpotifyConnectionCard
          state={cardState}
          displayName={displayName}
          message={recoveryMessage}
          onConnect={handleConnect}
          onReconnect={handleConnect}
          onDisconnect={() => setConfirmDisconnect(true)}
          confirmDisconnect={confirmDisconnect}
          onConfirmDisconnect={handleDisconnectConfirm}
          onCancelDisconnect={() => setConfirmDisconnect(false)}
        />

        <section aria-label="Appearance & Accessibility" className={cardClassName}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
            {t('appearance')}
          </p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold">{t('dark_mode')}</h2>
              <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                {t('dark_mode_hint')}
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="mt-5 border-t border-[#E4EBE6] pt-4 dark:border-[#2A3530]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold">{t('dyslexia_font')}</h2>
                <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                  {t('dyslexia_font_hint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !dyslexicFont;
                  setDyslexicFont(next);
                  if (typeof document !== 'undefined') {
                    document.documentElement.classList.toggle('font-dyslexic', next);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  dyslexicFont ? 'bg-[#0B4D2E] dark:bg-[#3DCF7A]' : 'bg-gray-300 dark:bg-gray-700'
                }`}
                aria-pressed={dyslexicFont}
                aria-label="Toggle dyslexia-friendly font"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    dyslexicFont ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {redirectUri ? (
          <details className="rounded-2xl border border-[#E4EBE6] bg-white open:pb-5 dark:border-[#2A3530] dark:bg-[#171E1B]">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-[#5C6B62] dark:text-[#9AABA0] sm:px-6">
              Advanced · Spotify redirect URI
            </summary>
            <div className="border-t border-[#E4EBE6] px-5 pt-4 dark:border-[#2A3530] sm:px-6">
              <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                If OAuth fails with a redirect mismatch, add this URI in the Spotify Dashboard for
                Client ID starting <strong>{clientIdPrefix || '56e75581'}</strong>, then Save.
              </p>
              <code className="mt-3 block break-all rounded-lg bg-[#F7F8F6] px-3 py-2 text-xs text-[#0C1210] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
                {redirectUri}
              </code>
              <button
                type="button"
                className="mt-3 text-sm font-bold text-[#0B4D2E] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(redirectUri);
                    setCopiedUri(true);
                    window.setTimeout(() => setCopiedUri(false), 2000);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copiedUri ? 'Copied' : 'Copy Redirect URI'}
              </button>
            </div>
          </details>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7F5] dark:bg-[#0C1210]">
          <Loader2 className="h-8 w-8 animate-spin text-[#5C6B62]" aria-label="Loading" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
