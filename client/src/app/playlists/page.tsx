'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { UndoDeleteToast } from '@/components/UndoDeleteToast';
import { Loader2 } from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  song_count: number;
}

export default function PlaylistsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletedPlaylist, setDeletedPlaylist] = useState<{ name: string } | null>(null);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await apiFetch('/playlists');
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists || []);
      } else {
        setError('Could not load your playlists. Try again.');
      }
    } catch {
      setError('Could not load your playlists. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchPlaylists();
  }, [user, authLoading, router, fetchPlaylists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName('');
        await fetchPlaylists();
      } else {
        setError('Could not save playlist. Try again.');
      }
    } catch {
      setError('Could not save playlist. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await apiFetch(`/playlists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        setDeletedPlaylist({ name });
      }
    } catch {
      setError('Could not delete playlist. Try again.');
    }
  };

  const handleUndoDone = () => {
    setDeletedPlaylist(null);
    fetchPlaylists();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-10 p-6 flex items-center justify-between border-b border-zinc-900 bg-black/50 backdrop-blur-xl">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-white underline-offset-4 hover:underline">
          &larr; Back
        </Link>
        <h1 className="text-lg font-black tracking-tighter uppercase italic">Playlists</h1>
        <div className="w-12" />
      </nav>

      <main className="flex-1 flex flex-col items-center px-6 py-12 max-w-2xl mx-auto w-full">
        {/* Create form */}
        <div className="w-full flex gap-2 mb-8">
          <Input
            placeholder="Playlist name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            maxLength={100}
          />
          <Button variant="primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-4 w-full mb-4">{error}</p>
        )}

        {/* Playlist list */}
        {loading ? (
          <div className="w-full space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl border border-zinc-900 bg-zinc-950 animate-pulse" />
            ))}
          </div>
        ) : playlists.length === 0 ? (
          <div className="text-center space-y-4 py-12">
            <p className="text-lg font-bold tracking-tighter uppercase">Your collection is empty</p>
            <p className="text-sm text-zinc-500">Find songs in the player and save them to build your library.</p>
            <Link href="/dashboard">
              <Button variant="secondary">Explore songs</Button>
            </Link>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {playlists.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-950 p-4 hover:border-zinc-800 transition-colors">
                <Link href={`/playlists/${p.id}`} className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.song_count} song{p.song_count !== 1 ? 's' : ''}</p>
                </Link>
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="text-xs text-zinc-600 hover:text-red-500 underline-offset-4 hover:underline ml-4 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {deletedPlaylist && (
        <UndoDeleteToast playlistName={deletedPlaylist.name} onDone={handleUndoDone} />
      )}
    </div>
  );
}
