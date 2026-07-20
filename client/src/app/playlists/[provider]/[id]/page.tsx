'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Music2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { fetchSpotifyPlaylistDetail } from '@/lib/api';
import {
  mapSpotifyDetailError,
  parseProviderStableId,
  providerStableId,
  safeSpotifyUrl,
  type SpotifyDetailErrorView,
  type SpotifyPlaylistDetailDto,
} from '@/lib/spotifyContracts';

function formatDuration(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function DetailSkeleton() {
  return (
    <div className="w-full max-w-[800px] space-y-6" aria-hidden>
      <div className="flex gap-4">
        <div className="h-40 w-40 shrink-0 animate-pulse rounded-lg bg-[#D7E0DA] dark:bg-[#2A3530]" />
        <div className="min-w-0 flex-1 space-y-3 pt-2">
          <div className="h-5 w-20 animate-pulse rounded bg-[#D7E0DA] dark:bg-[#2A3530]" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-[#D7E0DA] dark:bg-[#2A3530]" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-[#D7E0DA] dark:bg-[#2A3530]" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-[#D7E0DA] bg-white dark:border-[#2A3530] dark:bg-[#171E1B]"
          />
        ))}
      </div>
    </div>
  );
}

export default function ProviderPlaylistDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const provider = typeof params.provider === 'string' ? params.provider : '';
  const rawId = typeof params.id === 'string' ? params.id : '';
  const providerId = rawId ? decodeURIComponent(rawId) : '';

  const [detail, setDetail] = useState<SpotifyPlaylistDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SpotifyDetailErrorView | null>(null);
  const [providerRejected, setProviderRejected] = useState(false);

  const load = useCallback(async () => {
    if (provider !== 'spotify') {
      setProviderRejected(true);
      setLoading(false);
      return;
    }
    if (!providerId || providerId.includes(':')) {
      setError({
        kind: 'removed',
        message: 'This playlist is no longer available.',
        retryAfterSeconds: null,
      });
      setLoading(false);
      return;
    }

    // Stable identity must remain provider-aware — never treat as Harmonix local ID.
    try {
      parseProviderStableId(providerStableId('spotify', providerId));
    } catch {
      setError({
        kind: 'removed',
        message: 'This playlist is no longer available.',
        retryAfterSeconds: null,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchSpotifyPlaylistDetail(providerId);
      setDetail(data);
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'status' in err
          ? Number((err as { status?: number }).status)
          : undefined;
      const body =
        err && typeof err === 'object' && 'body' in err
          ? (err as { body?: unknown }).body
          : undefined;
      const offline =
        typeof navigator !== 'undefined' && navigator.onLine === false;
      setDetail(null);
      setError(mapSpotifyDetailError({ status, body, offline }));
    } finally {
      setLoading(false);
    }
  }, [provider, providerId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // Defer so load()'s setState is not synchronous inside the effect body.
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, authLoading, router, load]);

  if (authLoading || (loading && !detail && !error && !providerRejected)) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F4F7F5] text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
        <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D7E0DA] bg-[#F4F7F5]/90 px-6 py-4 backdrop-blur-xl dark:border-[#2A3530] dark:bg-[#0C1210]/90">
          <Link
            href="/playlists"
            className="text-sm font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
          >
            ← Back to Library
          </Link>
        </nav>
        <main className="flex flex-1 flex-col items-center px-6 py-10">
          <DetailSkeleton />
          <span className="sr-only">Loading playlist</span>
        </main>
      </div>
    );
  }

  if (!user) return null;

  if (providerRejected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7F5] px-4 text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
        <div className="max-w-md space-y-4 text-center">
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            Unknown playlist provider. Only Spotify playlists are supported on this route.
          </p>
          <Button variant="secondary" onClick={() => router.push('/playlists')}>
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  const openUrl = detail ? safeSpotifyUrl(detail.external_url) : null;
  const openLabel = detail
    ? `Open “${detail.name || 'playlist'}” in Spotify`
    : 'Open in Spotify';

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F7F5] text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D7E0DA] bg-[#F4F7F5]/90 px-6 py-4 backdrop-blur-xl dark:border-[#2A3530] dark:bg-[#0C1210]/90">
        <Link
          href="/playlists"
          className="text-sm font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
        >
          ← Back to Library
        </Link>
        <h1 className="max-w-[200px] truncate text-base font-bold sm:max-w-xs">
          {detail?.name || 'Playlist'}
        </h1>
        <div className="w-24" />
      </nav>

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-6 py-10">
        {error ? (
          <div
            className="space-y-4 rounded-xl border border-[#D7E0DA] bg-white p-6 dark:border-[#2A3530] dark:bg-[#171E1B]"
            role={error.kind === 'provider_error' ? 'alert' : 'status'}
          >
            <p className="text-base">{error.message}</p>
            <div className="flex flex-wrap gap-3">
              {error.kind === 'reconnect' ? (
                <Button onClick={() => router.push('/settings')}>Reconnect Spotify</Button>
              ) : error.kind !== 'removed' ? (
                <Button onClick={() => void load()}>Retry sync</Button>
              ) : null}
              <Button variant="secondary" onClick={() => router.push('/playlists')}>
                Back to Library
              </Button>
            </div>
          </div>
        ) : null}

        {detail && !error ? (
          <>
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
              {detail.artwork_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN artwork URLs vary by host
                <img
                  src={detail.artwork_url}
                  alt=""
                  width={160}
                  height={160}
                  className="h-40 w-40 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-[#D7E0DA] bg-white dark:border-[#2A3530] dark:bg-[#171E1B]">
                  <Music2 className="h-10 w-10 text-[#5C6B62]" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <span className="inline-flex items-center gap-1 rounded border border-[#D7E0DA] bg-white px-1.5 py-0.5 text-[14px] font-bold dark:border-[#2A3530] dark:bg-[#171E1B]">
                  <Image
                    src="/spotify-logo.svg"
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5"
                    unoptimized
                  />
                  Spotify
                </span>
                <h2 className="line-clamp-2 text-[32px] font-bold leading-tight tracking-tight">
                  {detail.name}
                </h2>
                <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                  {detail.track_count == null
                    ? 'Track count unavailable'
                    : `${detail.track_count} track${detail.track_count !== 1 ? 's' : ''}`}
                </p>
                {openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                    aria-label={openLabel}
                  >
                    {openLabel}
                  </a>
                ) : null}
              </div>
            </header>

            {detail.restricted || detail.detail_state === 'restricted' ? (
              <div
                className="mb-6 space-y-3 rounded-xl border border-[#D7E0DA] bg-white p-4 dark:border-[#2A3530] dark:bg-[#171E1B]"
                role="status"
              >
                <p className="text-base">
                  Spotify limits track details for this followed playlist.
                </p>
                {openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                  >
                    Open in Spotify
                  </a>
                ) : null}
              </div>
            ) : null}

            {!detail.restricted &&
            (detail.detail_state === 'empty' || detail.items.length === 0) ? (
              <div className="space-y-2 py-8 text-center">
                <h3 className="text-lg font-bold">No tracks in this playlist</h3>
                <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                  Add tracks in Spotify, then refresh this page.
                </p>
                {openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                  >
                    {openLabel}
                  </a>
                ) : null}
              </div>
            ) : null}

            {!detail.restricted && detail.items.length > 0 ? (
              <ol className="w-full space-y-2">
                {detail.items.map((item) => {
                  const unavailable = item.availability !== 'available';
                  const duration = formatDuration(item.duration_ms);
                  return (
                    <li
                      key={`${item.position}-${item.title}`}
                      className={`flex items-center gap-3 rounded-xl border border-[#D7E0DA] bg-white px-4 py-3 dark:border-[#2A3530] dark:bg-[#171E1B] ${
                        unavailable ? 'opacity-60' : ''
                      }`}
                      data-unavailable={unavailable ? 'true' : undefined}
                    >
                      <span className="w-6 shrink-0 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                        {item.position + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold">
                          {unavailable && !item.title
                            ? 'Unavailable on Spotify'
                            : item.title || 'Track'}
                        </p>
                        <p className="truncate text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                          {unavailable && item.title
                            ? 'Unavailable on Spotify'
                            : item.artists || (unavailable ? 'Unavailable on Spotify' : '')}
                        </p>
                      </div>
                      {duration ? (
                        <span className="shrink-0 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                          {duration}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {!detail.restricted && detail.items.length > 0 && openUrl ? (
              <div className="mt-6">
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                  aria-label={openLabel}
                >
                  {openLabel}
                </a>
              </div>
            ) : null}
          </>
        ) : null}

        {loading && detail ? (
          <div className="mt-4 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#5C6B62]" aria-label="Refreshing" />
          </div>
        ) : null}
      </main>
    </div>
  );
}
