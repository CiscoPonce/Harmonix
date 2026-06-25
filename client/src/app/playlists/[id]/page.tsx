'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

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

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    let active = true;

    async function fetchPlaylist() {
      try {
        const res = await apiFetch(`/playlists/${playlistId}`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setPlaylist(data);
        } else if (res.status === 404) {
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

    fetchPlaylist();
    return () => { active = false; };
  }, [user, authLoading, router, playlistId]);

  const handleRemoveSong = async (songId: string) => {
    try {
      const res = await apiFetch(`/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylist((prev) => prev ? { ...prev, songs: prev.songs.filter((s) => s.song_id !== songId) } : prev);
      }
    } catch {
      // Best effort
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
        <div className="text-center space-y-4">
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-4">{error}</p>
          <Button variant="secondary" onClick={() => router.push('/playlists')}>
            Back to Playlists
          </Button>
        </div>
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-10 p-6 flex items-center justify-between border-b border-zinc-900 bg-black/50 backdrop-blur-xl">
        <Link href="/playlists" className="text-sm text-zinc-500 hover:text-white underline-offset-4 hover:underline">
          &larr; Back
        </Link>
        <h1 className="text-lg font-black tracking-tighter uppercase italic truncate max-w-[200px]">{playlist.name}</h1>
        <div className="w-12" />
      </nav>

      <main className="flex-1 flex flex-col items-center px-6 py-12 max-w-2xl mx-auto w-full">
        {playlist.songs.length === 0 ? (
          <div className="text-center space-y-4 py-12">
            <p className="text-lg font-bold tracking-tighter uppercase">No songs here yet</p>
            <p className="text-sm text-zinc-500">Search and add songs from the player.</p>
            <Link href="/dashboard">
              <Button variant="secondary">Explore songs</Button>
            </Link>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {playlist.songs.map((entry) => {
              let trackData: { title?: string; artist?: string } = {};
              try { trackData = JSON.parse(entry.track_data); } catch {}
              return (
                <div key={entry.entry_id} className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-950 p-4 hover:border-zinc-800 transition-colors">
                  <Link href={`/player/${entry.song_id}`} className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{trackData.title || `Song ${entry.song_id}`}</p>
                    {trackData.artist && (
                      <p className="text-xs text-zinc-500 truncate">{trackData.artist}</p>
                    )}
                  </Link>
                  <button
                    onClick={() => handleRemoveSong(entry.song_id)}
                    className="text-xs text-zinc-600 hover:text-red-500 underline-offset-4 hover:underline ml-4 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
