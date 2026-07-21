import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeDeezerHearWindow,
  computeSpotifyHearClip,
  estimateWordSongTimeSec,
  formatPreviewWindowLabel,
} from './hearItTiming.ts';

describe('hearItTiming', () => {
  it('estimates word later in the line than the LRC stamp', () => {
    const lineStart = estimateWordSongTimeSec({
      timestamp_ms: 55_000,
      snippet: 'I want you to notice',
      char_start: 0,
      char_end: 1,
    });
    const wordLater = estimateWordSongTimeSec({
      timestamp_ms: 55_000,
      snippet: 'I want you to notice',
      char_start: 14,
      char_end: 20,
    });
    assert.ok(wordLater > lineStart);
    assert.ok(wordLater - lineStart < 3);
  });

  it('seeks inside Deezer preview when lyric is in the cut', () => {
    // Preview [30, 60); word near 0:55
    const win = computeDeezerHearWindow({
      timestamp_ms: 55_000,
      snippet: 'But I am a creep',
      char_start: 11,
      char_end: 16,
      preview_offset: 30,
    });
    assert.equal(win.inWindow, true);
    assert.ok(win.seekTo < win.relative);
    assert.ok(win.stopAt > win.relative);
    assert.ok(win.seekTo >= 0 && win.stopAt <= 30);
  });

  it('plays the end of the preview when lyric is after the cut', () => {
    const win = computeDeezerHearWindow({
      timestamp_ms: 64_000,
      snippet: 'And it was called Yellow',
      char_start: 18,
      char_end: 24,
      preview_offset: 30,
    });
    assert.equal(win.inWindow, false);
    assert.ok(win.seekTo >= 15);
    assert.equal(win.stopAt, 30);
  });

  it('builds a short Spotify clip around the word', () => {
    const clip = computeSpotifyHearClip({
      timestamp_ms: 64_000,
      snippet: 'And it was called Yellow',
      char_start: 18,
      char_end: 24,
    });
    const wordMs = Math.round(clip.wordSongTimeSec * 1000);
    assert.ok(clip.positionMs < wordMs);
    assert.ok(clip.positionMs >= wordMs - 2000);
    assert.ok(clip.stopAfterMs >= 6000 && clip.stopAfterMs <= 8000);
  });

  it('formats preview window labels', () => {
    assert.equal(formatPreviewWindowLabel(30), '0:30–1:00');
  });
});
