const assert = require('assert');
const db = require('../db');
const spotifyProfile = require('./spotifyProfileService');
const spotifyService = require('./spotifyService');

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

  it('stores taste when Spotify is connected', async () => {
    const userId = 'spotify-sync-user';
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      userId,
      'sync@test.com',
      'x',
    );
    const originalStatus = spotifyService.getConnectionStatus;
    const originalRequest = spotifyService.spotifyRequest;
    spotifyService.getConnectionStatus = () => ({ status: 'connected' });
    spotifyService.spotifyRequest = async (_userId, path) => {
      const href = String(path);
      if (href.includes('/me/top/artists')) {
        return { items: [{ name: 'Rosalia', genres: ['reggaeton'] }] };
      }
      if (href.includes('/me/top/tracks')) {
        return { items: [{ artists: [{ name: 'Bad Bunny' }] }] };
      }
      return { items: [] };
    };
    try {
      const result = await spotifyProfile.syncUserProfile(userId);
      assert.strictEqual(result.synced, true);
      assert.ok(result.top_artists.includes('Rosalia'));
      assert.ok(result.top_artists.includes('Bad Bunny'));
      assert.ok(result.last_synced_at);
      const cached = spotifyProfile.getUserMusicProfile(userId);
      assert.ok(cached.top_artists.includes('Rosalia'));
    } finally {
      spotifyService.getConnectionStatus = originalStatus;
      spotifyService.spotifyRequest = originalRequest;
    }
  });
});
