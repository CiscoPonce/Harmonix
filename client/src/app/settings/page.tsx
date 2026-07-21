'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SpotifyConnectionCard } from '@/components/SpotifyConnectionCard';
import {
  disconnectSpotify,
  fetchSpotifyStatus,
  startSpotifyAuth,
} from '@/lib/api';
import {
  parseSpotifyCallbackOutcome,
  type ConnectionState,
} from '@/lib/spotifyContracts';

const ERROR_COPY =
  'Spotify authorization didn’t complete. You can try connecting again.';
const PROVIDER_ERROR_COPY =
  'Spotify is unavailable right now. Your Harmonix library is still available. Try again.';

function SettingsContent() {
  const { user, isLoading: authLoading, logout } = useAuth();
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

  // Fixed allowlisted return only — never read code/state/tokens from the URL.
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
      window.location.assign(url);
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
      pageTitle="Account Settings"
      searchPlaceholder="Search terminology..."
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header>
          <h1 className="font-display text-3xl font-bold italic tracking-tight text-[#0B4D2E] dark:text-[#3DCF7A] sm:text-4xl">
            Account Settings
          </h1>
          <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
            Refine your resonance and track your linguistic growth.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section
              aria-label="Profile"
              className="rounded-2xl border border-[#E4EBE6] border-l-4 border-l-[#0B4D2E] bg-white p-5 dark:border-[#2A3530] dark:border-l-[#3DCF7A] dark:bg-[#171E1B] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-xl font-bold text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                  {(user.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{user.email}</p>
                  <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                    Capturing the rhythm of the world, one word at a time.
                  </p>
                  {(user.target_language || user.native_language) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {user.native_language ? (
                        <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                          {user.native_language}
                        </span>
                      ) : null}
                      {user.target_language ? (
                        <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0B4D2E] dark:bg-[#0B4D2E]/40 dark:text-[#3DCF7A]">
                          {user.target_language}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
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

            {redirectUri ? (
              <section
                aria-label="Spotify Dashboard setup"
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 dark:border-amber-400/30 dark:bg-amber-400/10"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300">
                  Spotify Dashboard — Redirect URI
                </p>
                <p className="mt-2 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                  If you see <code className="text-xs">redirect_uri: Not matching configuration</code>,
                  open the app with Client ID starting{' '}
                  <strong>{clientIdPrefix || '56e75581'}</strong>, add this URI exactly, then click{' '}
                  <strong>Add</strong> and <strong>Save</strong> at the bottom of Settings.
                </p>
                <code className="mt-3 block break-all rounded-lg bg-white px-3 py-2 text-xs text-[#0C1210] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
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
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <section
              aria-label="Appearance"
              className="rounded-2xl border border-[#E4EBE6] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B]"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80] dark:text-[#9AABA0]">
                Appearance
              </p>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold">Dark Resonance</h2>
                  <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                    Switch between light and dark themes.
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </section>

            <section className="rounded-2xl border border-[#E4EBE6] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B]">
              <Link
                href="/playlists"
                className="text-base font-bold text-[#0B4D2E] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
              >
                Open Library →
              </Link>
            </section>
          </div>
        </div>
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
