/**
 * Hear-it timing helpers — map lyric lines into Deezer preview / Spotify seek.
 * Pure (no DOM) so it can be unit-tested.
 *
 * Strategy: anchor to the LRC line start (reliable), cover the full line using
 * line_end_ms when present, and play a longer ~12s clip of context.
 */

export function lineBoundsSec(input: {
  timestamp_ms: number;
  line_end_ms?: number | null;
}): { lineStartSec: number; lineEndSec: number; lineDurSec: number } {
  const lineStartSec = Math.max(0, Number(input.timestamp_ms) / 1000 || 0);
  const rawEnd = input.line_end_ms != null ? Number(input.line_end_ms) / 1000 : NaN;
  const lineEndSec =
    Number.isFinite(rawEnd) && rawEnd > lineStartSec + 0.4
      ? rawEnd
      : lineStartSec + 4;
  return {
    lineStartSec,
    lineEndSec,
    lineDurSec: Math.max(0.5, lineEndSec - lineStartSec),
  };
}

/** Estimate when the highlighted word is sung inside the LRC line. */
export function estimateWordSongTimeSec(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  line_end_ms?: number | null;
}): number {
  const { lineStartSec, lineDurSec } = lineBoundsSec(input);
  const len = Math.max(1, String(input.snippet || '').length);
  const start = Math.max(0, Number(input.char_start) || 0);
  const end = Math.max(start, Number(input.char_end) || start);
  const mid = (start + end) / 2;
  const frac = Math.min(1, Math.max(0, mid / len));
  // Bias slightly early so we don't start after the word.
  return lineStartSec + frac * lineDurSec * 0.75;
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

/**
 * Map full-song lyric time into the Deezer 30s preview element timeline.
 * Clip is line-anchored and longer (~12s) so the word is clearly heard in context.
 */
export function computeDeezerHearWindow(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  preview_offset: number;
  preview_len?: number;
  line_end_ms?: number | null;
}): DeezerHearWindow {
  const PREVIEW_LEN = input.preview_len ?? 30;
  const LEAD_IN = 2.5; // start well before the line
  const TAIL = 5; // keep playing after the line ends
  const TARGET_CLIP = 12;
  const MIN_CLIP = 8;

  const { lineStartSec, lineEndSec } = lineBoundsSec(input);
  const wordSongTimeSec = estimateWordSongTimeSec(input);
  const offset = Number(input.preview_offset) || 0;

  // Anchor seek to the line start (LRC), not the estimated mid-word (more reliable).
  const relativeLine = lineStartSec - offset;
  const relativeWord = wordSongTimeSec - offset;
  const relativeEnd = lineEndSec - offset;
  const inWindow = relativeLine >= -0.5 && relativeLine <= PREVIEW_LEN - 1.5;

  if (inWindow) {
    let seekTo = Math.max(0, relativeLine - LEAD_IN);
    let stopAt = Math.min(PREVIEW_LEN, Math.max(relativeEnd + TAIL, relativeWord + 4));
    // Prefer a ~12s clip when the preview allows it.
    if (stopAt - seekTo < TARGET_CLIP) {
      stopAt = Math.min(PREVIEW_LEN, seekTo + TARGET_CLIP);
    }
    if (stopAt - seekTo < MIN_CLIP) {
      seekTo = Math.max(0, stopAt - MIN_CLIP);
    }
    // Never start after the word if we can help it.
    if (seekTo > relativeWord - 0.3 && relativeWord > 0.5) {
      seekTo = Math.max(0, relativeWord - 1.2);
    }
    stopAt = Math.max(stopAt, Math.min(PREVIEW_LEN, seekTo + MIN_CLIP));
    return {
      seekTo,
      stopAt,
      inWindow: true,
      relative: relativeWord,
      wordSongTimeSec,
    };
  }

  // Outside the Deezer cut — play a longer edge closest to the lyric.
  if (relativeLine < 0) {
    return {
      seekTo: 0,
      stopAt: Math.min(TARGET_CLIP, PREVIEW_LEN),
      inWindow: false,
      relative: relativeWord,
      wordSongTimeSec,
    };
  }
  return {
    seekTo: Math.max(0, PREVIEW_LEN - TARGET_CLIP),
    stopAt: PREVIEW_LEN,
    inWindow: false,
    relative: relativeWord,
    wordSongTimeSec,
  };
}

/** Spotify full-track seek: start before the line, play ~12s of context. */
export function computeSpotifyHearClip(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  line_end_ms?: number | null;
}): { positionMs: number; stopAfterMs: number; wordSongTimeSec: number } {
  const LEAD_IN_MS = 2500;
  const TAIL_MS = 5000;
  const TARGET_MS = 12000;
  const MIN_MS = 8000;

  const { lineStartSec, lineEndSec } = lineBoundsSec(input);
  const wordSongTimeSec = estimateWordSongTimeSec(input);
  const positionMs = Math.max(0, Math.round(lineStartSec * 1000) - LEAD_IN_MS);
  const endMs = Math.round(lineEndSec * 1000) + TAIL_MS;
  let stopAfterMs = endMs - positionMs;
  if (stopAfterMs < TARGET_MS) stopAfterMs = TARGET_MS;
  if (stopAfterMs < MIN_MS) stopAfterMs = MIN_MS;
  // Cap so Hear-it doesn't stream the whole track.
  stopAfterMs = Math.min(18000, stopAfterMs);

  return {
    positionMs,
    stopAfterMs,
    wordSongTimeSec,
  };
}
