/**
 * Hear-it timing helpers — map lyric lines into Deezer preview / Spotify seek.
 * Pure (no DOM) so it can be unit-tested.
 *
 * Strategy: center the clip on the *word* (not just the LRC line start) so
 * Hear-it plays the sung word in sync with the highlighted phrase — language-agnostic.
 */

/** Cap sparse LRC gaps so word estimates stay near the stamped line start. */
const MAX_LINE_DUR_FOR_WORD_EST_SEC = 5;

export function lineBoundsSec(input: {
  timestamp_ms: number;
  line_end_ms?: number | null;
}): { lineStartSec: number; lineEndSec: number; lineDurSec: number } {
  const lineStartSec = Math.max(0, Number(input.timestamp_ms) / 1000 || 0);
  const rawEnd = input.line_end_ms != null ? Number(input.line_end_ms) / 1000 : NaN;
  const lineEndSec =
    Number.isFinite(rawEnd) && rawEnd > lineStartSec + 0.35
      ? rawEnd
      : lineStartSec + 4;
  return {
    lineStartSec,
    lineEndSec,
    lineDurSec: Math.max(0.4, lineEndSec - lineStartSec),
  };
}

/**
 * Estimate when the highlighted word is sung inside the LRC line.
 * Uses Unicode code points so accented / non-Latin scripts stay accurate.
 * Line duration is capped so sparse LRC (long instrumental gaps) cannot shove
 * the seek many seconds past the real sung moment.
 */
export function estimateWordSongTimeSec(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  line_end_ms?: number | null;
}): number {
  const { lineStartSec, lineDurSec } = lineBoundsSec(input);
  const effectiveDur = Math.min(lineDurSec, MAX_LINE_DUR_FOR_WORD_EST_SEC);
  const chars = Array.from(String(input.snippet || ''));
  const len = Math.max(1, chars.length);
  // Alignment may be UTF-16 indices; clamp into code-point space.
  const start = Math.max(0, Math.min(Number(input.char_start) || 0, len));
  const end = Math.max(start, Math.min(Number(input.char_end) || start, len));
  const mid = (start + end) / 2;
  const frac = Math.min(1, Math.max(0, mid / len));
  // Bias toward line start: small char fraction on a capped window.
  return lineStartSec + frac * effectiveDur;
}

export function formatPreviewWindowLabel(offsetSec: number, lengthSec = 30): string {
  const start = Math.max(0, Math.floor(offsetSec));
  const end = start + lengthSec;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}

/** Deezer: 30–60s for long tracks. iTunes: usually from 0 (or unknown). */
export function resolvePreviewOffsetSec(input: {
  preview_offset?: number | null;
  preview_provider?: string | null;
  duration_seconds?: number | null;
}): number {
  const provider = String(input.preview_provider || 'deezer').toLowerCase();
  if (provider === 'itunes' || provider.startsWith('itunes')) {
    // Apple clips are usually the opening ~30s unless we know otherwise.
    return 0;
  }
  if (typeof input.preview_offset === 'number' && Number.isFinite(input.preview_offset)) {
    return Math.max(0, input.preview_offset);
  }
  const dur = Number(input.duration_seconds) || 0;
  if (dur > 60) return 30;
  if (dur > 30) return dur - 30;
  return 0;
}

export type DeezerHearWindow = {
  seekTo: number;
  stopAt: number;
  inWindow: boolean;
  /** False when the preview bytes cannot contain the lyric — do not play a misleading edge clip. */
  shouldPlay: boolean;
  relative: number;
  wordSongTimeSec: number;
};

/**
 * Map full-song lyric time into the 30s preview element timeline.
 * Word-centered: start ~1s before the word so the sung word matches the phrase.
 */
export function computeDeezerHearWindow(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  preview_offset?: number;
  preview_provider?: string | null;
  duration_seconds?: number | null;
  preview_len?: number;
  line_end_ms?: number | null;
}): DeezerHearWindow {
  const PREVIEW_LEN = input.preview_len ?? 30;
  const WORD_LEAD = 1.0; // seconds before the sung word
  const WORD_TAIL = 5.5;
  const TARGET_CLIP = 8;
  const MIN_CLIP = 5;

  const wordSongTimeSec = estimateWordSongTimeSec(input);
  const offset = resolvePreviewOffsetSec(input);
  const relativeWord = wordSongTimeSec - offset;
  const inWindow = relativeWord >= 0.4 && relativeWord <= PREVIEW_LEN - 0.8;

  if (inWindow) {
    let seekTo = Math.max(0, relativeWord - WORD_LEAD);
    let stopAt = Math.min(PREVIEW_LEN, relativeWord + WORD_TAIL);
    if (stopAt - seekTo < TARGET_CLIP) {
      stopAt = Math.min(PREVIEW_LEN, seekTo + TARGET_CLIP);
    }
    if (stopAt - seekTo < MIN_CLIP) {
      seekTo = Math.max(0, stopAt - MIN_CLIP);
    }
    // Keep the word inside the clip with a small margin.
    if (seekTo > relativeWord - 0.35) {
      seekTo = Math.max(0, relativeWord - WORD_LEAD);
    }
    if (stopAt < relativeWord + 1.5) {
      stopAt = Math.min(PREVIEW_LEN, relativeWord + WORD_TAIL);
    }
    stopAt = Math.max(stopAt, Math.min(PREVIEW_LEN, seekTo + MIN_CLIP));
    return {
      seekTo: Math.round(seekTo * 100) / 100,
      stopAt: Math.round(stopAt * 100) / 100,
      inWindow: true,
      shouldPlay: true,
      relative: relativeWord,
      wordSongTimeSec,
    };
  }

  // Outside the preview cut — do not play a random edge (that lied to users).
  return {
    seekTo: 0,
    stopAt: 0,
    inWindow: false,
    shouldPlay: false,
    relative: relativeWord,
    wordSongTimeSec,
  };
}

/** Spotify full-track seek: start just before the word, play a short context clip. */
export function computeSpotifyHearClip(input: {
  timestamp_ms: number;
  snippet: string;
  char_start: number;
  char_end: number;
  line_end_ms?: number | null;
}): { positionMs: number; stopAfterMs: number; wordSongTimeSec: number } {
  const WORD_LEAD_MS = 1000;
  const WORD_TAIL_MS = 5500;
  const TARGET_MS = 8000;
  const MIN_MS = 5000;
  const MAX_MS = 14000;

  const wordSongTimeSec = estimateWordSongTimeSec(input);
  const wordMs = Math.round(wordSongTimeSec * 1000);
  const positionMs = Math.max(0, wordMs - WORD_LEAD_MS);
  let stopAfterMs = WORD_LEAD_MS + WORD_TAIL_MS;
  if (stopAfterMs < TARGET_MS) stopAfterMs = TARGET_MS;
  if (stopAfterMs < MIN_MS) stopAfterMs = MIN_MS;
  stopAfterMs = Math.min(MAX_MS, stopAfterMs);

  return {
    positionMs,
    stopAfterMs,
    wordSongTimeSec,
  };
}
