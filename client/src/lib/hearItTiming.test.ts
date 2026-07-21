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
      line_end_ms: 58_500,
    });
    const wordLater = estimateWordSongTimeSec({
      timestamp_ms: 55_000,
      snippet: 'I want you to notice',
      char_start: 14,
      char_end: 20,
      line_end_ms: 58_500,
    });
    assert.ok(wordLater > lineStart);
    assert.ok(wordLater - 55 < 4);
  });

  it('plays a long clip around the lyric line inside Deezer preview', () => {
    // Preview [30, 60); line at 0:52–0:56
    const win = computeDeezerHearWindow({
      timestamp_ms: 52_000,
      line_end_ms: 56_000,
      snippet: 'But I am a creep',
      char_start: 11,
      char_end: 16,
      preview_offset: 30,
    });
    assert.equal(win.inWindow, true);
    assert.ok(win.stopAt - win.seekTo >= 8, `clip too short: ${win.stopAt - win.seekTo}`);
    // Should start before the line (line relative = 22s)
    assert.ok(win.seekTo <= 22);
    assert.ok(win.stopAt >= 26);
    assert.ok(win.seekTo >= 0 && win.stopAt <= 30);
  });

  it('plays the end of the preview when lyric is after the cut', () => {
    const win = computeDeezerHearWindow({
      timestamp_ms: 64_000,
      line_end_ms: 68_000,
      snippet: 'And it was called Yellow',
      char_start: 18,
      char_end: 24,
      preview_offset: 30,
    });
    assert.equal(win.inWindow, false);
    assert.ok(win.seekTo >= 15);
    assert.equal(win.stopAt, 30);
    assert.ok(win.stopAt - win.seekTo >= 10);
  });

  it('builds a longer Spotify clip from the line start', () => {
    const clip = computeSpotifyHearClip({
      timestamp_ms: 64_000,
      line_end_ms: 68_000,
      snippet: 'And it was called Yellow',
      char_start: 18,
      char_end: 24,
    });
    assert.ok(clip.positionMs <= 64_000 - 2000);
    assert.ok(clip.stopAfterMs >= 8000 && clip.stopAfterMs <= 18000);
  });

  it('formats preview window labels', () => {
    assert.equal(formatPreviewWindowLabel(30), '0:30–1:00');
  });
});
