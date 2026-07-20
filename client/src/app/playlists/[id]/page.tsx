'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { SpotifyExportDialog } from '@/components/SpotifyExportDialog';
import { SpotifyMatchReport } from '@/components/SpotifyMatchReport';
import {
  apiFetch,
  fetchLatestSpotifyExport,
  fetchSpotifyExportJob,
  fetchSpotifyStatus,
  startSpotifyExport,
} from '@/lib/api';
import {
  isExportJobActive,
  type ConnectionState,
  type SpotifyExportJobDto,
} from '@/lib/spotifyContracts';

interface SongEntry {
  entry_id: string;
  song_id: string;
  added_at: string;
  track_data: string;
}

interface PlaylistDetail {
  id: string;
  name: string;
  song_count?: number;
  songs: SongEntry[];
}

export default function PlaylistDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connect');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [job, setJob] = useState<SpotifyExportJobDto | null>(null);
  const pollRef = useRef<number | null>(null);
  const restoreFocusRef = useRef<HTMLButtonElement>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const next = await fetchSpotifyExportJob(jobId);
          setJob(next);
          if (!isExportJobActive(next.stage)) {
            stopPolling();
            setExportBusy(false);
            setDialogOpen(false);
            restoreFocusRef.current?.focus();
          }
        } catch {
          stopPolling();
          setExportBusy(false);
          setExportError('Could not refresh export status. Try again.');
        }
      }, 1500);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    let active = true;

    async function load() {
      try {
        const [playlistRes, status] = await Promise.all([
          apiFetch(`/playlists/${playlistId}`),
          fetchSpotifyStatus().catch(() => null),
        ]);
        if (!active) return;
        if (status) setConnectionState(status.state);

        if (playlistRes.ok) {
          const data = (await playlistRes.json()) as PlaylistDetail;
          setPlaylist(data);

          // Job identity lives on the backend — restore after refresh/route recreation.
          try {
            const latest = await fetchLatestSpotifyExport(playlistId);
            if (!active) return;
            if (latest) {
              const fresh = await fetchSpotifyExportJob(latest.id);
              if (!active) return;
              setJob(fresh);
              if (isExportJobActive(fresh.stage)) {
                setExportBusy(true);
                pollJob(fresh.id);
              }
            }
          } catch {
            // Non-blocking — detail still usable without export restore.
          }
        } else if (playlistRes.status === 404) {
          setError('Playlist not found.');
        } else {
          setError('Could not load playlist. Try again.');
        }
      } catch {
        if (active) setError('Could not load playlist. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user, authLoading, router, playlistId, pollJob]);

  const handleRemoveSong = async (songId: string) => {
    try {
      const res = await apiFetch(`/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylist((prev) =>
          prev ? { ...prev, songs: prev.songs.filter((s) => s.song_id !== songId) } : prev
        );
      }
    } catch {
      // Best effort
    }
  };

  const handleStartExport = async () => {
    if (!playlist || exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const started = await startSpotifyExport(
        playlist.id,
        `web-${playlist.id}-${Date.now()}`
      );
      setJob(started);
      if (isExportJobActive(started.stage)) {
        pollJob(started.id);
      } else {
        setExportBusy(false);
        setDialogOpen(false);
        restoreFocusRef.current?.focus();
      }
    } catch (err) {
      setExportBusy(false);
      const status = (err as { status?: number } | null)?.status;
      if (status === 409) {
        setExportError('Reconnect Spotify in Settings to export.');
      } else if (!navigator.onLine) {
        setExportError('You’re offline. Reconnect to sync Spotify playlists or export music.');
      } else {
        setExportError('The export couldn’t be completed. No new playlist was created. Try again.');
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7F5] text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0B6B3A] dark:text-[#3DCF7A]" />
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7F5] px-4 dark:bg-[#0C1210]">
        <div className="space-y-4 text-center">
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
            {error}
          </p>
          <Button variant="secondary" onClick={() => router.push('/playlists')}>
            Back to Playlists
          </Button>
        </div>
      </div>
    );
  }

  if (!playlist) return null;

  const songCount = playlist.songs.length;
  const connected = connectionState === 'connected';
  const needsReconnect =
    connectionState === 'reconnect' || connectionState === 'provider_error';
  const canExport = songCount > 0 && connected && !exportBusy;

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F7F5] text-[#121612] dark:bg-[#0C1210] dark:text-[#F2F5F3]">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D7E0DA] bg-[#F4F7F5]/90 p-6 backdrop-blur-xl dark:border-[#2A3530] dark:bg-[#0C1210]/90">
        <Link
          href="/playlists"
          className="text-sm text-[#6B756F] underline-offset-4 hover:underline dark:text-[#8A9690]"
        >
          &larr; Back
        </Link>
        <h1 className="max-w-[200px] truncate text-lg font-black uppercase italic tracking-tighter">
          {playlist.name}
        </h1>
        <div className="w-12" />
      </nav>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 py-10">
        <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#6B756F] dark:text-[#8A9690]">
            {songCount} {songCount === 1 ? 'song' : 'songs'}
          </p>
          {songCount === 0 ? (
            <p className="text-sm text-[#6B756F] dark:text-[#8A9690]">
              Add songs before exporting to Spotify.
            </p>
          ) : needsReconnect ? (
            <Link href="/settings">
              <Button variant="primary" type="button">
                Reconnect Spotify
              </Button>
            </Link>
          ) : !connected ? (
            <Link href="/settings">
              <Button variant="secondary" type="button">
                Connect Spotify
              </Button>
            </Link>
          ) : (
            <Button
              ref={restoreFocusRef}
              variant="primary"
              type="button"
              disabled={!canExport}
              onClick={() => {
                setExportError(null);
                setDialogOpen(true);
              }}
            >
              Export to Spotify
            </Button>
          )}
        </div>

        {job && !isExportJobActive(job.stage) ? (
          <div className="mb-8 w-full">
            <SpotifyMatchReport job={job} onFinish={() => setJob(null)} />
          </div>
        ) : null}

        {songCount === 0 ? (
          <div className="space-y-4 py-12 text-center">
            <p className="text-lg font-bold uppercase tracking-tighter">No songs here yet</p>
            <p className="text-sm text-[#6B756F] dark:text-[#8A9690]">
              Search and add songs from the player.
            </p>
            <Link href="/dashboard">
              <Button variant="secondary">Explore songs</Button>
            </Link>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {playlist.songs.map((entry) => {
              let trackData: { title?: string; artist?: string } = {};
              try {
                trackData = JSON.parse(entry.track_data);
              } catch {
                /* ignore */
              }
              return (
                <div
                  key={entry.entry_id}
                  className="flex items-center justify-between rounded-xl border border-[#D7E0DA] bg-white p-4 transition-colors hover:border-[#0B6B3A]/40 dark:border-[#2A3530] dark:bg-[#171E1B]"
                >
                  <Link href={`/player/${entry.song_id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {trackData.title || `Song ${entry.song_id}`}
                    </p>
                    {trackData.artist ? (
                      <p className="truncate text-xs text-[#6B756F] dark:text-[#8A9690]">
                        {trackData.artist}
                      </p>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemoveSong(entry.song_id)}
                    className="ml-4 shrink-0 text-xs text-[#6B756F] underline-offset-4 hover:text-red-500 hover:underline dark:text-[#8A9690]"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SpotifyExportDialog
        open={dialogOpen}
        playlistName={playlist.name}
        songCount={songCount}
        job={job && isExportJobActive(job.stage) ? job : null}
        busy={exportBusy}
        errorMessage={exportError}
        onCancel={() => {
          if (exportBusy) return;
          setDialogOpen(false);
          restoreFocusRef.current?.focus();
        }}
        onConfirm={handleStartExport}
      />
    </div>
  );
}
