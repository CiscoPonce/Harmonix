'use client';

import { useEffect, useId, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  exportProgressLabel,
  isExportJobActive,
  type SpotifyExportJobDto,
} from '@/lib/spotifyContracts';

export interface SpotifyExportDialogProps {
  open: boolean;
  playlistName: string;
  songCount: number;
  job: SpotifyExportJobDto | null;
  busy: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SpotifyExportDialog({
  open,
  playlistName,
  songCount,
  job,
  busy,
  errorMessage,
  onCancel,
  onConfirm,
}: SpotifyExportDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const active = job ? isExportJobActive(job.stage) : busy;
  const progressMax = job
    ? Math.max(job.total_count, job.matched_count, 1)
    : Math.max(songCount, 1);
  const progressValue = job
    ? job.stage === 'adding'
      ? job.exported_count
      : job.current_count
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-xl border border-[#D7E0DA] bg-white p-5 shadow-lg dark:border-[#2A3530] dark:bg-[#171E1B]"
      >
        <h2 id={titleId} className="text-lg font-bold text-[#121612] dark:text-[#F2F5F3]">
          Export to Spotify
        </h2>
        <p id={descId} className="mt-2 text-sm text-[#4A554E] dark:text-[#A8B5AE]">
          Harmonix will match tracks before creating anything in Spotify.
        </p>
        <dl className="mt-4 space-y-1 text-sm text-[#121612] dark:text-[#F2F5F3]">
          <div className="flex justify-between gap-3">
            <dt className="text-[#6B756F] dark:text-[#8A9690]">Playlist</dt>
            <dd className="truncate font-medium">{playlistName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#6B756F] dark:text-[#8A9690]">Songs</dt>
            <dd className="font-medium">{songCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#6B756F] dark:text-[#8A9690]">Destination</dt>
            <dd className="font-medium">Private Spotify playlist</dd>
          </div>
        </dl>

        {job || busy ? (
          <div className="mt-4 space-y-2" aria-live="polite">
            <div className="flex items-center gap-2 text-sm text-[#0B6B3A] dark:text-[#3DCF7A]">
              {active ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              <span>{job ? exportProgressLabel(job) : 'Starting export…'}</span>
            </div>
            <progress
              className="h-2 w-full overflow-hidden rounded accent-[#0B6B3A]"
              max={progressMax}
              value={progressValue}
              aria-label="Export progress"
            />
          </div>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={active}
          >
            Cancel export
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={active || Boolean(job && !isExportJobActive(job.stage))}
          >
            Start export
          </Button>
        </div>
      </div>
    </div>
  );
}
