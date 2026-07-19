'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppHeader } from '@/components/AppHeader';
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
  const [statusLoading, setStatusLoading] = useState(true);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [statusTick, setStatusTick] = useState(0);

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
    <div className="flex min-h-screen flex-col bg-[#F4F7F5] text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
      <AppHeader userEmail={user.email} onLogout={logout} homeHref="/dashboard" />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <header>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
            Manage your account and connected services.
          </p>
        </header>

        <section
          aria-label="Profile"
          className="rounded-xl border border-[#D7E0DA] bg-white p-4 dark:border-[#2A3530] dark:bg-[#171E1B] sm:p-5"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-[#5C6B62] dark:text-[#9AABA0]">
            Profile
          </p>
          <p className="mt-2 truncate text-base font-bold">{user.email}</p>
          {(user.target_language || user.native_language) && (
            <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              {[user.native_language, user.target_language].filter(Boolean).join(' → ')}
            </p>
          )}
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

        <section
          aria-label="Appearance"
          className="rounded-xl border border-[#D7E0DA] bg-white p-4 dark:border-[#2A3530] dark:bg-[#171E1B] sm:p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold">Appearance</h2>
              <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                Switch between light and dark themes.
              </p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/playlists"
            className="text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B3A] dark:text-[#3DCF7A]"
          >
            Open Library
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="h-10 rounded-md border border-[#D7E0DA] bg-white px-4 text-base font-bold text-[#121612] hover:bg-[#F4F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B3A] dark:border-[#2A3530] dark:bg-[#171E1B] dark:text-[#F2F5F3] dark:hover:bg-[#0C1210]"
          >
            Log out
          </button>
        </section>
      </main>
    </div>
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
