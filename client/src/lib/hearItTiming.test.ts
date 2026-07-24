import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeDeezerHearWindow,
  computeSpotifyHearClip,
  estimateWordSongTimeSec,
  formatPreviewWindowLabel,
  resolvePreviewOffsetSec,
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

  it('centers Deezer seek on the sung word inside the preview', () => {
    // Preview [30, 60); line 0:52–0:56; "creep" near end of line → ~25s into preview
    const win = computeDeezerHearWindow({
      timestamp_ms: 52_000,
      line_end_ms: 56_000,
      snippet: 'But I am a creep',
      char_start: 11,
      char_end: 16,
      preview_offset: 30,
      preview_provider: 'deezer',
    });
    assert.equal(win.inWindow, true);
    assert.ok(win.seekTo >= 22 && win.seekTo <= 26, `seekTo=${win.seekTo}`);
    assert.ok(win.stopAt > win.relative, `stopAt=${win.stopAt} relative=${win.relative}`);
    assert.ok(win.stopAt - win.seekTo >= 5);
    assert.ok(win.seekTo < win.relative);
  });

  it('uses offset 0 for iTunes previews', () => {
    assert.equal(
      resolvePreviewOffsetSec({ preview_provider: 'itunes', preview_offset: 30, duration_seconds: 200 }),
      0
    );
    const win = computeDeezerHearWindow({
      timestamp_ms: 12_000,
      line_end_ms: 15_000,
      snippet: 'hola mundo',
      char_start: 0,
      char_end: 4,
      preview_offset: 30,
      preview_provider: 'itunes',
    });
    assert.equal(win.inWindow, true);
    assert.ok(win.seekTo < 12);
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
    assert.equal(win.shouldPlay, false);
  });

  it('keeps word estimate near line start when LRC gap is huge', () => {
    const t = estimateWordSongTimeSec({
      timestamp_ms: 40_000,
      snippet: 'hola mundo',
      char_start: 5,
      char_end: 10,
      line_end_ms: 80_000, // 40s sparse gap
    });
    assert.ok(t >= 40 && t <= 46, `t=${t}`);
  });

  it('builds a Spotify clip around the word', () => {
    const clip = computeSpotifyHearClip({
      timestamp_ms: 64_000,
      line_end_ms: 68_000,
      snippet: 'And it was called Yellow',
      char_start: 18,
      char_end: 24,
    });
    assert.ok(clip.positionMs >= 63_000 && clip.positionMs <= 68_000, `pos=${clip.positionMs}`);
    assert.ok(clip.stopAfterMs >= 5000 && clip.stopAfterMs <= 14000);
  });

  it('formats preview window labels', () => {
    assert.equal(formatPreviewWindowLabel(30), '0:30–1:00');
  });
});
