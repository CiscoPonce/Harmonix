/**
 * Hear-it timing helpers — map lyric word position into Deezer preview / Spotify seek.
 * Pure (no DOM) so it can be unit-tested.
 */

export function estimateWordSongTimeSec(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
}): number {
  const lineStartSec = Number(input.timestamp_ms) / 1000;
  if (!Number.isFinite(lineStartSec) || lineStartSec < 0) return 0;

  const len = Math.max(1, String(input.snippet || '').length);
  const start = Math.max(0, Number(input.char_start) || 0);
  const end = Math.max(start, Number(input.char_end) || start);
  const mid = (start + end) / 2;
  const frac = Math.min(1, Math.max(0, mid / len));

  // LRC stamps the line start; estimate where the highlighted word is sung.
  const EST_LINE_DUR_SEC = 2.8;
  return lineStartSec + frac * EST_LINE_DUR_SEC * 0.9;
}

export function formatPreviewWindowLabel(offsetSec: number, lengthSec = 30): string {
  const start = Math.max(0, Math.floor(offsetSec));
  const end = start + lengthSec;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}

export type DeezerHearWindow = {
  seekTo: number;
  stopAt: number;
  inWindow: boolean;
  relative: number;
  wordSongTimeSec: number;
};

/** Map full-song word time into the Deezer 30s preview element timeline. */
export function computeDeezerHearWindow(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  preview_offset: number;
  preview_len?: number;
}): DeezerHearWindow {
  const PREVIEW_LEN = input.preview_len ?? 30;
  // ~1.5s before the word + ~5.5s after ≈ 7s of context
  const LEAD_IN = 1.5;
  const PLAY_AFTER = 5.5;
  const MIN_CLIP = 5;

  const wordSongTimeSec = estimateWordSongTimeSec(input);
  const offset = Number(input.preview_offset) || 0;
  const relative = wordSongTimeSec - offset;
  const inWindow = relative >= 0.35 && relative <= PREVIEW_LEN - 0.75;

  if (inWindow) {
    const seekTo = Math.max(0, Math.min(PREVIEW_LEN - MIN_CLIP, relative - LEAD_IN));
    const stopAt = Math.min(
      PREVIEW_LEN,
      Math.max(seekTo + MIN_CLIP, relative + PLAY_AFTER)
    );
    return { seekTo, stopAt, inWindow: true, relative, wordSongTimeSec };
  }

  // Outside the Deezer cut — play a longer edge closest to the lyric.
  if (relative < 0.35) {
    return {
      seekTo: 0,
      stopAt: Math.min(12, PREVIEW_LEN),
      inWindow: false,
      relative,
      wordSongTimeSec,
    };
  }
  return {
    seekTo: Math.max(0, PREVIEW_LEN - 12),
    stopAt: PREVIEW_LEN,
    inWindow: false,
    relative,
    wordSongTimeSec,
  };
}

/** Spotify full-track seek around the estimated word time. */
export function computeSpotifyHearClip(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
}): { positionMs: number; stopAfterMs: number; wordSongTimeSec: number } {
  const LEAD_IN_MS = 1500;
  const PLAY_AFTER_MS = 5500;
  const wordSongTimeSec = estimateWordSongTimeSec(input);
  const wordMs = Math.round(wordSongTimeSec * 1000);
  return {
    positionMs: Math.max(0, wordMs - LEAD_IN_MS),
    stopAfterMs: LEAD_IN_MS + PLAY_AFTER_MS,
    wordSongTimeSec,
  };
}
