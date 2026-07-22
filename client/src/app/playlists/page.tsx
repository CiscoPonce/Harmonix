'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Loader2, Music2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UndoDeleteToast } from '@/components/UndoDeleteToast';
import { AppShell } from '@/components/AppShell';
import { CoverArt } from '@/components/CoverArt';
import {
  apiFetch,
  fetchSpotifyPlaylists,
  fetchSpotifyStatus,
  startSpotifyAuth,
} from '@/lib/api';
import { PLAYLISTS_CHANGED_EVENT } from '@/lib/playlistEvents';
import {
  capSpotifyPlaylistShelf,
  mapSpotifyListError,
  parseSpotifyCallbackOutcome,
  providerStableId,
  safeSpotifyUrl,
  type SpotifyListErrorView,
} from '@/lib/spotifyContracts';

interface HarmonixPlaylist {
  id: string;
  name: string;
  song_count: number;
  artwork_url?: string | null;
  cover_urls?: string[];
}

interface SpotifyPlaylistCard {
  provider_id: string;
  stable_id: string;
  name: string;
  track_count: number | null;
  artwork_url: string | null;
  external_url: string | null;
}

interface RecentDiscovery {
  id: number | null;
  word: { text: string; translation: string | null };
  song: { id: string; title: string; artist: string } | null;
}

function ProviderBadge({ provider }: { provider: 'harmonix' | 'spotify' }) {
  if (provider === 'spotify') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-[#D7E0DA] bg-[#F4F7F5] px-1.5 py-0.5 text-[14px] font-bold text-[#121612] dark:border-[#2A3530] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
        <Image src="/spotify-logo.svg" alt="" width={14} height={14} className="h-3.5 w-3.5" unoptimized />
        Spotify
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-[#0B6B3A] px-1.5 py-0.5 text-[14px] font-bold text-[#0B6B3A] dark:border-[#3DCF7A] dark:text-[#3DCF7A]">
      Harmonix
    </span>
  );
}

function PlaylistCardSkeleton() {
  return (
    <div
      className="flex h-[88px] items-center gap-3 rounded-xl border border-[#D7E0DA] bg-white p-3 dark:border-[#2A3530] dark:bg-[#171E1B]"
      aria-hidden
    >
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-md bg-[#D7E0DA] dark:bg-[#2A3530]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[#D7E0DA] dark:bg-[#2A3530]" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-[#D7E0DA] dark:bg-[#2A3530]" />
      </div>
    </div>
  );
}

function LibraryContent() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackOutcome = parseSpotifyCallbackOutcome(searchParams.get('spotify'));
  const clearedSuccessQuery = useRef(false);
  const successBanner = callbackOutcome === 'connected';

  const [harmonix, setHarmonix] = useState<HarmonixPlaylist[]>([]);
  const [harmonixLoading, setHarmonixLoading] = useState(true);
  const [harmonixError, setHarmonixError] = useState<string | null>(null);

  const [spotify, setSpotify] = useState<SpotifyPlaylistCard[]>([]);
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [spotifyError, setSpotifyError] = useState<SpotifyListErrorView | null>(null);
  const [onwardUrl, setOnwardUrl] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyDisplayName, setSpotifyDisplayName] = useState<string | null>(null);
  const [spotifyLinkState, setSpotifyLinkState] = useState<
    'loading' | 'connected' | 'reconnect' | 'disconnected'
  >('loading');

  const [recent, setRecent] = useState<RecentDiscovery[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletedPlaylist, setDeletedPlaylist] = useState<{ name: string } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (callbackOutcome !== 'connected' || clearedSuccessQuery.current) return;
    clearedSuccessQuery.current = true;
    // Keep ?spotify=connected briefly for announcement, then clean the URL.
    const t = window.setTimeout(() => {
      router.replace('/playlists', { scroll: false });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [callbackOutcome, router]);

  useEffect(() => {
    const onPlaylistsChanged = () => {
      setHarmonixLoading(true);
      setRefreshTick((n) => n + 1);
    };
    window.addEventListener(PLAYLISTS_CHANGED_EVENT, onPlaylistsChanged);
    return () => window.removeEventListener(PLAYLISTS_CHANGED_EVENT, onPlaylistsChanged);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      // Independent settlement: Harmonix failure must not clear Spotify and vice versa.
      const loadHarmonix = async () => {
        try {
          const res = await apiFetch('/playlists');
          if (!active) return;
          if (res.ok) {
            const data = await res.json();
            setHarmonix(data.playlists || []);
            setHarmonixError(null);
          } else {
            setHarmonixError('Could not load your playlists. Try again.');
          }
        } catch {
          if (!active) return;
          setHarmonixError('Could not load your playlists. Try again.');
        } finally {
          if (active) setHarmonixLoading(false);
        }
      };

      const loadRecent = async () => {
        try {
          const res = await apiFetch('/daily-word/recent?days=7');
          if (!active) return;
          if (res.ok) {
            const data = await res.json();
            setRecent(data.recent || []);
          }
        } catch {
          /* Recent Discoveries remain optional; do not block Library. */
        } finally {
          if (active) setRecentLoading(false);
        }
      };

      const loadSpotify = async () => {
        try {
          const status = await fetchSpotifyStatus();
          if (!active) return;
          setSpotifyDisplayName(status.display_name || null);
          if (status.state === 'connect' || status.state === 'disconnected') {
            setSpotifyConnected(false);
            setSpotifyLinkState('disconnected');
            setSpotify([]);
            setSpotifyError({
              kind: 'disconnected',
              message: 'Connect Spotify from Settings to see your playlists.',
              retryAfterSeconds: null,
            });
            return;
          }
          if (status.state === 'reconnect') {
            setSpotifyConnected(false);
            setSpotifyLinkState('reconnect');
            setSpotify([]);
            setSpotifyError({
              kind: 'reconnect',
              message: 'Your Spotify connection expired. Reconnect to continue.',
              retryAfterSeconds: null,
            });
            return;
          }
          setSpotifyConnected(true);
          setSpotifyLinkState('connected');
          const list = await fetchSpotifyPlaylists();
          if (!active) return;
          setSpotify(
            list.playlists.map((p) => ({
              provider_id: p.provider_id,
              stable_id: p.stable_id,
              name: p.name,
              track_count: p.track_count,
              artwork_url: p.artwork_url,
              external_url: p.external_url,
            }))
          );
          setOnwardUrl(list.onward_url);
          setSpotifyError(null);
        } catch (err) {
          if (!active) return;
          const e = err as Error & { status?: number; body?: unknown };
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
          setSpotifyError(
            mapSpotifyListError({
              status: e.status,
              body: e.body,
              offline,
            })
          );
          // Preserve any previously loaded Spotify cards on transient failure.
        } finally {
          if (active) setSpotifyLoading(false);
        }
      };

      void loadHarmonix();
      void loadRecent();
      void loadSpotify();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user, authLoading, router, refreshTick]);

  const refreshAll = useCallback(() => {
    setHarmonixLoading(true);
    setSpotifyLoading(true);
    setRecentLoading(true);
    setRefreshTick((n) => n + 1);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setHarmonixError(null);
    try {
      const res = await apiFetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName('');
        setHarmonixLoading(true);
        setRefreshTick((n) => n + 1);
      } else {
        setHarmonixError('Could not save playlist. Try again.');
      }
    } catch {
      setHarmonixError('Could not save playlist. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await apiFetch(`/playlists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHarmonix((prev) => prev.filter((p) => p.id !== id));
        setDeletedPlaylist({ name });
      }
    } catch {
      setHarmonixError('Could not delete playlist. Try again.');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7F5] dark:bg-[#0C1210]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5C6B62]" aria-label="Loading" />
      </div>
    );
  }

  const spotifyShelf = capSpotifyPlaylistShelf(spotify, 20);
  const safeOnward = safeSpotifyUrl(onwardUrl);
  const fullyEmpty =
    !harmonixLoading &&
    !spotifyLoading &&
    harmonix.length === 0 &&
    spotify.length === 0 &&
    recent.length === 0;

  const openSpotifyAuth = async () => {
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
        window.location.href = '/settings';
      }
    } catch {
      window.location.href = '/settings';
    }
  };

  const spotifyHeaderExtra =
    spotifyLinkState === 'connected' ? (
      <Link
        href="/settings"
        className="hidden max-w-[16rem] items-center gap-2 rounded-full border border-[#1DB954]/40 bg-[#1DB954]/15 px-3 py-1.5 text-xs font-bold text-[#1DB954] hover:bg-[#1DB954]/25 sm:inline-flex"
        title="Manage Spotify in Settings"
      >
        <Image src="/spotify-logo.svg" alt="" width={14} height={14} className="h-3.5 w-3.5" unoptimized />
        <span className="truncate">
          {spotifyDisplayName ? `Spotify · ${spotifyDisplayName}` : 'Spotify connected'}
        </span>
      </Link>
    ) : spotifyLinkState === 'reconnect' ? (
      <button
        type="button"
        onClick={() => void openSpotifyAuth()}
        className="hidden rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 sm:inline-flex"
      >
        Reconnect Spotify
      </button>
    ) : spotifyLinkState === 'disconnected' ? (
      <button
        type="button"
        onClick={() => void openSpotifyAuth()}
        className="hidden rounded-full bg-[#0B4D2E] px-4 py-2 text-xs font-bold text-white hover:bg-[#093F25] sm:inline-flex"
      >
        Connect to Spotify
      </button>
    ) : null;

  return (
    <AppShell
      userEmail={user?.email}
      onLogout={logout}
      pageTitle="Library"
      searchPlaceholder="Search your collection"
      showBottomPlayer={Boolean(recent[0]?.song)}
      nowPlaying={
        recent[0]?.song
          ? { title: recent[0].song.title, artist: recent[0].song.artist }
          : null
      }
      headerExtra={spotifyHeaderExtra}
    >
      <div
        className="mx-auto flex w-full max-w-[1120px] flex-col gap-8"
        aria-busy={harmonixLoading || spotifyLoading || recentLoading}
      >
        {successBanner ? (
          <p
            role="status"
            className="rounded-lg border border-[#0B4D2E]/30 bg-white px-4 py-3 text-sm font-bold text-[#0B4D2E]"
          >
            Spotify connected
            {spotifyDisplayName ? ` as ${spotifyDisplayName}` : ''}. Loading your playlists.
          </p>
        ) : null}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A8A80]">
            Personal collection
          </p>
          <p className="mt-1 max-w-xl font-display text-xl font-bold italic text-[#0C1210] sm:text-2xl">
            Your resonance library brings together language and lyric in perfect harmony.
          </p>
        </div>

        {/* Create action */}
        <div className="flex w-full max-w-[800px] gap-2">
          <Input
            placeholder="Playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            maxLength={100}
            aria-label="New Harmonix playlist name"
          />
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="h-10 shrink-0 border border-[#0B6B3A] bg-[#0B6B3A] text-base font-bold text-white dark:border-[#3DCF7A] dark:bg-[#3DCF7A] dark:text-[#0C1210]"
          >
            {creating ? 'Creating…' : (
              <span className="inline-flex items-center gap-1">
                <Plus className="h-4 w-4" aria-hidden /> Create
              </span>
            )}
          </Button>
        </div>

        {harmonixError ? (
          <p className="max-w-[800px] rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            {harmonixError}
          </p>
        ) : null}

        {fullyEmpty ? (
          <div className="max-w-[800px] space-y-3 py-8 text-center">
            <h2 className="text-[22px] font-bold">Your library is ready for music</h2>
            <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Create a Harmonix playlist, or connect Spotify from Settings to see your playlists here.
            </p>
            <Link
              href="/settings"
              className="inline-block text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
            >
              Open Settings
            </Link>
          </div>
        ) : null}

        {/* HARMONIX PLAYLISTS */}
        <section aria-labelledby="harmonix-playlists-heading" className="space-y-4">
          <h2
            id="harmonix-playlists-heading"
            className="text-[14px] font-bold uppercase tracking-[0.14em] text-[#5C6B62] dark:text-[#9AABA0]"
          >
            Harmonix Playlists
          </h2>
          {harmonixLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
              {[1, 2, 3].map((i) => (
                <PlaylistCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {harmonix.map((p) => {
                const stable = providerStableId('harmonix', p.id);
                return (
                  <div
                    key={stable}
                    className="flex items-center gap-3 rounded-xl border border-[#D7E0DA] bg-white p-3 transition-colors hover:border-[#0B6B3A]/40 dark:border-[#2A3530] dark:bg-[#171E1B]"
                  >
                    <Link
                      href={`/playlists/${encodeURIComponent(p.id)}`}
                      className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B3A]"
                    >
                      <CoverArt
                        src={p.artwork_url}
                        covers={p.cover_urls}
                        alt={`${p.name} cover`}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold" title={p.name}>
                          {p.name}
                        </p>
                        <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                          {p.song_count} song{p.song_count !== 1 ? 's' : ''}
                        </p>
                        <div className="mt-1">
                          <ProviderBadge provider="harmonix" />
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#5C6B62]" aria-hidden />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.name)}
                      className="shrink-0 text-xs font-bold text-[#5C6B62] underline-offset-4 hover:text-[#D32F2F] hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SPOTIFY PLAYLISTS */}
        <section aria-labelledby="spotify-playlists-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="spotify-playlists-heading"
              className="text-[14px] font-bold uppercase tracking-[0.14em] text-[#5C6B62] dark:text-[#9AABA0]"
            >
              Spotify Playlists
            </h2>
            {spotifyConnected && !spotifyLoading ? (
              <button
                type="button"
                onClick={refreshAll}
                className="text-sm font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
              >
                Refresh playlists
              </button>
            ) : null}
          </div>
          {spotifyConnected && spotifyShelf.length > 0 ? (
            <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Open a playlist, then press ▶ on a track to play (Spotify Premium).
            </p>
          ) : null}

          {spotifyLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
              {[1, 2, 3].map((i) => (
                <PlaylistCardSkeleton key={i} />
              ))}
            </div>
          ) : spotifyError ? (
            <div
              className="max-w-[800px] rounded-2xl border-2 border-dashed border-[#0B4D2E]/30 bg-[#E8F5EE]/40 p-6 text-center dark:border-[#3DCF7A]/30 dark:bg-[#0B4D2E]/10"
              role={spotifyError.kind === 'provider_error' ? 'alert' : 'status'}
            >
              <h3 className="font-display text-xl font-bold text-[#0B4D2E] dark:text-[#3DCF7A]">
                Sync Your Spotify Library
              </h3>
              <p className="mt-1 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                {spotifyError.message}
              </p>
              {(spotifyError.kind === 'disconnected' || spotifyError.kind === 'reconnect') && (
                <button
                  type="button"
                  onClick={() => void openSpotifyAuth()}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0B4D2E] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#093F25] dark:bg-[#3DCF7A] dark:text-[#0C1210] dark:hover:bg-[#2FB86A]"
                >
                  <Image src="/spotify-logo.svg" alt="" width={16} height={16} className="h-4 w-4" unoptimized />
                  {spotifyError.kind === 'reconnect' ? 'Reconnect Spotify' : 'Connect Spotify'}
                </button>
              )}
              {spotifyError.kind === 'provider_error' || spotifyError.kind === 'offline' ? (
                <button
                  type="button"
                  onClick={refreshAll}
                  className="mt-3 text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                >
                  Retry sync
                </button>
              ) : null}
              {spotifyError.kind === 'rate_limited' ? (
                <p className="mt-2 text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                  Manual refresh is paused until Spotify is ready.
                </p>
              ) : null}
            </div>
          ) : spotifyShelf.length === 0 ? (
            <div className="max-w-[800px] space-y-2 rounded-xl border border-[#D7E0DA] bg-white p-4 dark:border-[#2A3530] dark:bg-[#171E1B]">
              <h3 className="text-base font-bold">No Spotify playlists found</h3>
              <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
                Create or save a playlist in Spotify, then refresh your Library.
              </p>
              <button
                type="button"
                onClick={refreshAll}
                className="text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
              >
                Refresh playlists
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spotifyShelf.map((p) => {
                  const href = `/playlists/spotify/${encodeURIComponent(p.provider_id)}`;
                  const countLabel =
                    p.track_count == null
                      ? 'Track count unavailable'
                      : `${p.track_count} track${p.track_count !== 1 ? 's' : ''}`;
                  return (
                    <Link
                      key={p.stable_id}
                      href={href}
                      className="flex items-center gap-3 rounded-xl border border-[#D7E0DA] bg-white p-3 transition-colors hover:border-[#0B6B3A]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B3A] dark:border-[#2A3530] dark:bg-[#171E1B]"
                    >
                      {p.artwork_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN artwork URLs vary by host
                        <img
                          src={p.artwork_url}
                          alt=""
                          width={64}
                          height={64}
                          className="h-16 w-16 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-[#D7E0DA] bg-[#F4F7F5] dark:border-[#2A3530] dark:bg-[#0C1210]">
                          <Music2 className="h-6 w-6 text-[#5C6B62]" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold" title={p.name}>
                          {p.name}
                        </p>
                        <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">{countLabel}</p>
                        <div className="mt-1">
                          <ProviderBadge provider="spotify" />
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#5C6B62]" aria-hidden />
                    </Link>
                  );
                })}
              </div>
              {spotify.length > 20 && safeOnward ? (
                <a
                  href={safeOnward}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-base font-bold text-[#0B6B3A] underline-offset-4 hover:underline dark:text-[#3DCF7A]"
                >
                  Open more playlists in Spotify
                </a>
              ) : null}
            </>
          )}
        </section>

        {/* RECENT DISCOVERIES */}
        <section aria-labelledby="recent-discoveries-heading" className="max-w-[800px] space-y-4">
          <h2
            id="recent-discoveries-heading"
            className="text-[14px] font-bold uppercase tracking-[0.14em] text-[#5C6B62] dark:text-[#9AABA0]"
          >
            Recent Discoveries
          </h2>
          {recentLoading ? (
            <div className="space-y-3" aria-hidden>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg border border-[#D7E0DA] bg-white dark:border-[#2A3530] dark:bg-[#171E1B]"
                />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-[#5C6B62] dark:text-[#9AABA0]">
              Words you discover while learning will show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((item, idx) => {
                const title = item.song?.title || item.word.text;
                const artist = item.song?.artist || item.word.translation || 'Artist Name';
                const key = item.id != null ? `rd-${item.id}` : `rd-${idx}-${title}`;
                const href = item.song?.id ? `/player/${encodeURIComponent(item.song.id)}` : null;
                const row = (
                  <div className="flex items-center gap-3 rounded-lg border border-[#D7E0DA] bg-white px-3 py-3 dark:border-[#2A3530] dark:bg-[#171E1B]">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0B6B3A] text-[#0B6B3A] dark:border-[#3DCF7A] dark:text-[#3DCF7A]"
                      aria-hidden
                    >
                      ▶
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold" title={title}>
                        {title}
                      </p>
                      <p className="truncate text-sm text-[#5C6B62] dark:text-[#9AABA0]" title={artist}>
                        {artist}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={key}>
                    {href ? (
                      <Link
                        href={href}
                        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6B3A]"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {deletedPlaylist && (
        <UndoDeleteToast
          playlistName={deletedPlaylist.name}
          onDone={() => {
            setDeletedPlaylist(null);
            setHarmonixLoading(true);
            setRefreshTick((n) => n + 1);
          }}
        />
      )}
    </AppShell>
  );
}

export default function PlaylistsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4F7F5] dark:bg-[#0C1210]">
          <Loader2 className="h-8 w-8 animate-spin text-[#5C6B62]" aria-label="Loading" />
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
