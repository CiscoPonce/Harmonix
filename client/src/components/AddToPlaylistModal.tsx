'use client';

import React, { useEffect, useState } from 'react';
import { Check, FolderPlus, Plus, X } from 'lucide-react';
import { apiFetch, parseJsonResponse } from '@/lib/api';
import { notifyPlaylistsChanged } from '@/lib/playlistEvents';
import { Button } from './ui/Button';

interface Playlist {
  id: string;
  name: string;
  song_count: number;
}

interface TrackInfo {
  id: number | string;
  title: string;
  artist: string;
  preview?: string;
  duration?: number;
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackInfo;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    setAddedMap({});
    setError(null);
    setSuccess(null);
    setNewPlaylistName('');
    setAddingId(null);

    async function loadPlaylists() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch('/playlists');
        if (res.ok) {
          const data = await parseJsonResponse<{ playlists?: Playlist[] }>(res);
          if (active) setPlaylists(data.playlists || []);
        } else if (active) {
          setError('Could not load playlists');
        }
      } catch {
        if (active) setError('Could not load playlists');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPlaylists();
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Close the picker quickly; keep the bottom toast a moment longer.
  useEffect(() => {
    if (!success) return;
    const closeTimer = window.setTimeout(() => onClose(), 700);
    const clearTimer = window.setTimeout(() => setSuccess(null), 3500);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [success, onClose]);

  if (!isOpen && !success) return null;

  const songId =
    track?.id != null && String(track.id).trim() !== ''
      ? String(track.id).trim()
      : '';

  const markAdded = (playlistId: string, playlistName: string, alreadyThere: boolean) => {
    setAddedMap((prev) => ({ ...prev, [playlistId]: true }));
    if (!alreadyThere) {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, song_count: (p.song_count || 0) + 1 }
            : p
        )
      );
    }
    setSuccess(
      alreadyThere
        ? `Already in “${playlistName}”`
        : `Added “${track.title}” to “${playlistName}”`
    );
    notifyPlaylistsChanged({ playlistId, songId });
  };

  const handleAddSong = async (playlistId: string) => {
    if (!songId) {
      setError('song_id is required');
      return;
    }
    const playlist = playlists.find((p) => p.id === playlistId);
    const playlistName = playlist?.name || 'playlist';

    try {
      setError(null);
      setAddingId(playlistId);
      const res = await apiFetch(`/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: songId,
          track: {
            id: songId,
            title: track.title,
            artist: track.artist,
            preview: track.preview || '',
            duration: track.duration || 0,
          },
        }),
      });

      if (res.ok) {
        markAdded(playlistId, playlistName, false);
      } else if (res.status === 409) {
        markAdded(playlistId, playlistName, true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to add song');
      }
    } catch {
      setError('Failed to add song to playlist');
    } finally {
      setAddingId(null);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || creating) return;

    try {
      setCreating(true);
      setError(null);
      const res = await apiFetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      });

      if (res.ok) {
        const data = await parseJsonResponse<{ playlist: Playlist }>(res);
        const created = data.playlist;
        setPlaylists((prev) => [created, ...prev]);
        setNewPlaylistName('');
        notifyPlaylistsChanged({ playlistId: created.id });
        await handleAddSong(created.id);
      } else {
        setError('Failed to create playlist');
      }
    } catch {
      setError('Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const dismissSuccess = () => {
    setSuccess(null);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-white shadow-2xl flex flex-col gap-4 relative">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div>
                <h3 className="text-lg font-black tracking-tight uppercase italic">
                  Add to Playlist
                </h3>
                <p className="text-xs text-zinc-400 font-medium truncate max-w-xs mt-0.5">
                  {track.title} · {track.artist}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 bg-red-950/50 border border-red-900/50 rounded-lg text-xs text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="p-2.5 bg-emerald-950/50 border border-emerald-900/50 rounded-lg text-xs text-emerald-300 flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlaylist} className="flex gap-2">
              <input
                type="text"
                placeholder="New playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={!newPlaylistName.trim() || creating}
                className="shrink-0 text-xs font-bold"
              >
                <FolderPlus className="w-4 h-4 mr-1" />
                Create
              </Button>
            </form>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 py-2">
              {loading ? (
                <div className="text-center py-8 text-xs text-zinc-500 font-medium uppercase tracking-widest">
                  Loading playlists...
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500 font-medium uppercase tracking-widest">
                  No playlists found. Create one above!
                </div>
              ) : (
                playlists.map((pl) => {
                  const isAdded = Boolean(addedMap[pl.id]);
                  const isBusy = addingId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-900 hover:border-zinc-800 transition-colors"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{pl.name}</h4>
                        <p className="text-[10px] text-zinc-500">
                          {pl.song_count || 0} track{(pl.song_count || 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Button
                        variant={isAdded ? 'ghost' : 'primary'}
                        size="sm"
                        disabled={isAdded || isBusy}
                        onClick={() => void handleAddSong(pl.id)}
                        className={
                          isAdded
                            ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 text-xs'
                            : 'text-xs'
                        }
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {isBusy ? 'Adding…' : 'Add'}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            role="status"
            className="flex items-center gap-3 rounded-lg border border-emerald-900/60 bg-zinc-950 px-4 py-3 text-sm text-emerald-300 shadow-lg"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="max-w-xs truncate sm:max-w-sm">{success}</span>
            <button
              type="button"
              onClick={dismissSuccess}
              className="text-xs font-bold uppercase tracking-wider text-zinc-400 underline underline-offset-2 hover:text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
