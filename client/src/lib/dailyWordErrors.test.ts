import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { friendlyDailyWordReason } from './dailyWordErrors.ts';

describe('friendlyDailyWordReason', () => {
  it('maps song_already_used to actionable copy', () => {
    const msg = friendlyDailyWordReason('song_already_used');
    assert.ok(msg.toLowerCase().includes('fresh') || msg.toLowerCase().includes('moment'));
    assert.equal(msg.includes('song_already_used'), false);
  });

  it('never returns raw snake_case codes', () => {
    for (const code of [
      'song_already_used',
      'deezer_not_found',
      'lyrics_not_found',
      'stale_preferences',
      'lyrics_wrong_language',
      'totally_unknown_reason_xyz',
    ]) {
      const msg = friendlyDailyWordReason(code);
      assert.equal(msg.includes(code), false, `leaked ${code}`);
    }
  });

  it('keeps cooldown retry seconds', () => {
    assert.match(friendlyDailyWordReason('cooldown_active', { retryAfterSec: 12 }), /12/);
  });
});
