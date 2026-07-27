const assert = require('assert');
const spotifyProfile = require('./spotifyProfileService');

describe('Spotify Profile Service', () => {
  it('handles disconnected user profile sync gracefully', async () => {
    const result = await spotifyProfile.syncUserProfile('unknown-user-id');
    assert.strictEqual(result.synced, false);
    assert.strictEqual(result.reason, 'not_connected');
  });

  it('returns null for uncached user music profile', () => {
    const profile = spotifyProfile.getUserMusicProfile('unknown-user-id');
    assert.strictEqual(profile, null);
  });
});
