import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recentSummaryToDailyPayload } from './recentWordPayload.ts';

describe('recentSummaryToDailyPayload', () => {
  it('maps a recent summary into a daily-word card payload', () => {
    const payload = recentSummaryToDailyPayload({
      id: 42,
      date: '2026-10-10',
      word: { text: 'anyone', translation: 'cualquiera', pronunciation: '/ˈɛniˌwən/' },
      phrase: 'If I lay here',
      lyric: {
        snippet: 'If I lay here',
        timestamp: '0:42',
        timestamp_ms: 42000,
        char_start: 3,
        char_end: 9,
      },
      song: { id: '999', title: 'Chasing Cars', artist: 'Snow Patrol' },
      audio: {
        preview_url: '/api/audio/preview/999',
        duration_seconds: 30,
        preview_offset: 30,
      },
    });

    assert.equal(payload?.word.text, 'anyone');
    assert.equal(payload?.lyric.snippet, 'If I lay here');
    assert.equal(payload?.audio.preview_url, '/api/audio/preview/999');
    assert.equal(payload?.song.id, '999');
  });

  it('returns null when song id is missing', () => {
    assert.equal(
      recentSummaryToDailyPayload({
        word: { text: 'test', translation: 'prueba' },
        song: null,
      }),
      null
    );
  });
});
