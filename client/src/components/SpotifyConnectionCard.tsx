'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';
import type { ConnectionState } from '@/lib/spotifyContracts';

export interface SpotifyConnectionCardProps {
  state: ConnectionState;
  displayName?: string | null;
  message?: string | null;
  onConnect?: () => void;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  confirmDisconnect?: boolean;
  onConfirmDisconnect?: () => void;
  onCancelDisconnect?: () => void;
}

export function SpotifyConnectionCard({
  state,
  displayName,
  message,
  onConnect,
  onReconnect,
  onDisconnect,
  confirmDisconnect = false,
  onConfirmDisconnect,
  onCancelDisconnect,
}: SpotifyConnectionCardProps) {
  const { t } = useTranslation();
  const busy = state === 'connecting' || state === 'disconnecting';
  const showDisconnect =
    (state === 'connected' || state === 'reconnect' || state === 'provider_error') &&
    !busy;

  let title: string = t('nav_connect_spotify');
  let body: string = t('spotify_connect_body');
  let primaryLabel: string | null = t('nav_connect_spotify');
  let primaryAction: (() => void) | undefined = onConnect;
  let statusIcon: ReactNode = null;

  if (state === 'connecting') {
    title = t('spotify_connecting');
    body = t('spotify_connect_body');
    primaryLabel = null;
    statusIcon = <Loader2 className="h-5 w-5 animate-spin text-[#0B6B3A] dark:text-[#3DCF7A]" aria-hidden />;
  } else if (state === 'disconnecting') {
    title = t('spotify_disconnecting');
    body = t('spotify_confirm_disconnect');
    primaryLabel = null;
    statusIcon = <Loader2 className="h-5 w-5 animate-spin text-[#0B6B3A] dark:text-[#3DCF7A]" aria-hidden />;
  } else if (state === 'connected') {
    title = t('spotify_connected');
    body = displayName
      ? t('spotify_connected_browse', { name: displayName })
      : t('spotify_playlists_available');
    primaryLabel = t('view_library');
    primaryAction = undefined;
    statusIcon = <CheckCircle2 className="h-5 w-5 text-[#0B6B3A] dark:text-[#3DCF7A]" aria-hidden />;
  } else if (state === 'reconnect') {
    title = t('reconnect_spotify');
    body = message || t('spotify_reconnect_body');
    primaryLabel = t('reconnect_spotify');
    primaryAction = onReconnect ?? onConnect;
    statusIcon = <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />;
  } else if (state === 'provider_error') {
    title = t('spotify_connection_issue');
    body = message || t('spotify_provider_error');
    primaryLabel = t('reconnect_spotify');
    primaryAction = onReconnect ?? onConnect;
    statusIcon = <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />;
  } else if (state === 'disconnected') {
    title = t('spotify_disconnected');
    body = t('spotify_can_reconnect');
    primaryLabel = t('nav_connect_spotify');
    primaryAction = onConnect;
  }

  return (
    <section
      aria-label="Spotify connection"
      className="w-full rounded-xl border border-[#D7E0DA] bg-white p-4 dark:border-[#2A3530] dark:bg-[#171E1B] sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <Image
            src="/spotify-logo.svg"
            alt="Spotify"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0"
            unoptimized
          />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {statusIcon}
              <h2 className="text-base font-bold text-[#121612] dark:text-[#F2F5F3]">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-[#5C6B62] dark:text-[#9AABA0]">{body}</p>
            {displayName && state === 'connected' ? (
              <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">{displayName}</p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[11rem] sm:items-stretch">
          {state === 'connected' ? (
            <Link
              href="/playlists"
              className="inline-flex h-10 items-center justify-center rounded-md border border-[#0B6B3A] bg-[#0B6B3A] px-4 text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B3A] focus-visible:ring-offset-2 dark:border-[#3DCF7A] dark:bg-[#3DCF7A] dark:text-[#0C1210]"
            >
              {t('view_library')}
            </Link>
          ) : primaryLabel && primaryAction ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={primaryAction}
              className="h-10 border border-[#0B6B3A] bg-[#0B6B3A] text-base font-bold text-white hover:bg-[#095a31] dark:border-[#3DCF7A] dark:bg-[#3DCF7A] dark:text-[#0C1210] dark:hover:bg-[#35b86c]"
            >
              {primaryLabel}
            </Button>
          ) : null}

          {showDisconnect && !confirmDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              className="h-10 text-base font-bold text-[#D32F2F] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D32F2F] disabled:opacity-50"
            >
              {t('spotify_disconnect')}
            </button>
          ) : null}
        </div>
      </div>

      {confirmDisconnect ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="spotify-disconnect-title"
          className="mt-4 rounded-lg border border-[#D7E0DA] bg-[#F4F7F5] p-4 dark:border-[#2A3530] dark:bg-[#0C1210]"
        >
          <p id="spotify-disconnect-title" className="text-sm text-[#121612] dark:text-[#F2F5F3]">
            {t('spotify_confirm_disconnect')}
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              autoFocus
              onClick={onCancelDisconnect}
              className="h-10 border border-[#D7E0DA] bg-white text-base font-bold text-[#121612] dark:border-[#2A3530] dark:bg-[#171E1B] dark:text-[#F2F5F3]"
            >
              {t('spotify_keep_connected')}
            </Button>
            <Button
              type="button"
              onClick={onConfirmDisconnect}
              className="h-10 border border-[#D32F2F] bg-[#D32F2F] text-base font-bold text-white hover:bg-[#b71c1c]"
            >
              {t('spotify_disconnect')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
