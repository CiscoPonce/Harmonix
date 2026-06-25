'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface UndoDeleteToastProps {
  playlistName: string;
  onDone: () => void;
}

export function UndoDeleteToast({ playlistName, onDone }: UndoDeleteToastProps) {
  const [status, setStatus] = useState<'deleted' | 'restoring' | 'restored'>('deleted');

  useEffect(() => {
    if (status === 'deleted') {
      const timer = setTimeout(() => onDone(), 5000);
      return () => clearTimeout(timer);
    }
    if (status === 'restored') {
      const timer = setTimeout(() => onDone(), 2000);
      return () => clearTimeout(timer);
    }
  }, [status, onDone]);

  const handleUndo = async () => {
    setStatus('restoring');
    try {
      await apiFetch('/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playlistName }),
      });
      setStatus('restored');
    } catch {
      setStatus('deleted');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-800 bg-black text-white text-sm shadow-lg">
        {status === 'restoring' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Restoring...</span>
          </>
        ) : status === 'restored' ? (
          <span>Playlist restored.</span>
        ) : (
          <>
            <span>Playlist deleted.</span>
            <button
              onClick={handleUndo}
              className="text-white font-medium underline underline-offset-4 hover:no-underline"
            >
              Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
