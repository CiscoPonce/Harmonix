'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Music2, Pause, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useSpotifyInAppPlayer } from '@/components/SpotifyInAppPlayer';
import { fetchLyrics, fetchSpotifyPlaylistDetail } from '@/lib/api';
import {
  mapSpotifyDetailError,
  parseProviderStableId,
  providerStableId,
  safeSpotifyUrl,
  type SpotifyDetailErrorView,
  type SpotifyPlaylistDetailDto,
  type SpotifyPlaylistDetailItemDto,
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

function parseSyncedLyrics(raw: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split('\n')
    .map((line) => line.replace(/^\[[^\]]*\]\s*/, '').trim())
    .filter(Boolean);
}

export default function SpotifyPlaylistDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const providerId = rawId ? decodeURIComponent(rawId) : '';

  const [detail, setDetail] = useState<SpotifyPlaylistDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SpotifyDetailErrorView | null>(null);

  const [lyricsItem, setLyricsItem] = useState<SpotifyPlaylistDetailItemDto | null>(null);
  const [lyricsLines, setLyricsLines] = useState<string[] | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  const player = useSpotifyInAppPlayer();

  const load = useCallback(async () => {
    if (!providerId || providerId.includes(':')) {
      setError({
        kind: 'removed',
        message: 'This playlist is no longer available.',
        retryAfterSeconds: null,
      });
      setLoading(false);
      return;
    }

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
  }, [providerId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user, authLoading, router, load]);

  const openLyrics = useCallback(async (item: SpotifyPlaylistDetailItemDto) => {
    setLyricsItem(item);
    setLyricsLines(null);
    setLyricsError(null);
    setLyricsLoading(true);
    try {
      const firstArtist = (item.artists || '').split(',')[0]?.trim() || item.artists;
      const result = await fetchLyrics({
        artist_name: firstArtist,
        track_name: item.title,
        album_name: item.album_name,
        duration:
          item.duration_ms != null ? Math.round(item.duration_ms / 1000) : null,
      });
      const lines = parseSyncedLyrics(result.syncedLyrics);
      if (lines.length === 0) {
        setLyricsError(
          'No lyrics found for this track (via LRCLib). Spotify does not provide lyrics to third-party apps.'
        );
      } else {
        setLyricsLines(lines);
      }
    } catch {
      setLyricsError('Could not load lyrics right now.');
    } finally {
      setLyricsLoading(false);
    }
  }, []);

  if (authLoading || (loading && !detail && !error)) {
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

            {!detail.restricted && detail.items.length > 0 ? (
              <div
                className="mb-4 rounded-xl border border-[#D7E0DA] bg-white px-4 py-3 text-sm dark:border-[#2A3530] dark:bg-[#171E1B]"
                role="status"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {player.isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  <p className="text-[#5C6B62] dark:text-[#9AABA0]">
                    {player.message ||
                      'Spotify Premium required for in-app play. Press play on a track. Lyrics come from LRCLib (not Spotify).'}
                  </p>
                  {player.ui === 'reconnect' ? (
                    <Link
                      href="/settings"
                      className="font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                    >
                      Open Settings
                    </Link>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                  Content from Spotify · Harmonix does not host Spotify audio.
                </p>
              </div>
            ) : null}

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
                  const canPlay = !unavailable && Boolean(item.uri);
                  const isActive =
                    item.uri &&
                    player.activeUri === item.uri &&
                    (player.ui === 'playing' || player.ui === 'paused');
                  const Icon = isActive && player.ui === 'playing' ? Pause : Play;
                  return (
                    <li
                      key={`${item.position}-${item.title}`}
                      className={`flex items-center gap-3 rounded-xl border border-[#D7E0DA] bg-white px-4 py-3 dark:border-[#2A3530] dark:bg-[#171E1B] ${
                        unavailable ? 'opacity-60' : ''
                      }`}
                      data-unavailable={unavailable ? 'true' : undefined}
                    >
                      <button
                        type="button"
                        disabled={!canPlay || player.isBusy}
                        aria-label={
                          isActive && player.ui === 'playing'
                            ? `Pause ${item.title}`
                            : `Play ${item.title || 'track'}`
                        }
                        onClick={() => {
                          if (item.uri) void player.playTrack(item.uri);
                        }}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B4D2E] text-white transition hover:bg-[#0B6B3A] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </button>
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
                      {!unavailable && item.title ? (
                        <button
                          type="button"
                          className="shrink-0 text-sm font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                          onClick={() => void openLyrics(item)}
                        >
                          Lyrics
                        </button>
                      ) : null}
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

            {lyricsItem ? (
              <section
                className="mt-6 rounded-xl border border-[#D7E0DA] bg-white p-5 dark:border-[#2A3530] dark:bg-[#171E1B]"
                aria-label="Lyrics"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{lyricsItem.title}</h3>
                    <p className="truncate text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                      {lyricsItem.artists}
                    </p>
                    <p className="mt-1 text-xs text-[#5C6B62] dark:text-[#9AABA0]">
                      Lyrics via LRCLib · not provided by Spotify API
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-bold text-[#5C6B62] underline-offset-4 hover:underline dark:text-[#9AABA0]"
                    onClick={() => {
                      setLyricsItem(null);
                      setLyricsLines(null);
                      setLyricsError(null);
                    }}
                  >
                    Close
                  </button>
                </div>
                {lyricsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#5C6B62]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading lyrics…
                  </div>
                ) : null}
                {lyricsError ? <p className="text-sm">{lyricsError}</p> : null}
                {lyricsLines && lyricsLines.length > 0 ? (
                  <div className="max-h-80 space-y-2 overflow-y-auto text-base leading-relaxed">
                    {lyricsLines.map((line, i) => (
                      <p key={`${i}-${line.slice(0, 24)}`}>{line}</p>
                    ))}
                  </div>
                ) : null}
              </section>
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
