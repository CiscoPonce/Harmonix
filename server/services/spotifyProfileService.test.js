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

  it('does not overwrite a profile when both Spotify requests fail', async () => {
    const userId = 'spotify-fail-user';
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      userId,
      'fail@test.com',
      'x',
    );
    const originalStatus = spotifyService.getConnectionStatus;
    const originalRequest = spotifyService.spotifyRequest;
    spotifyService.getConnectionStatus = () => ({ status: 'connected' });
    spotifyService.spotifyRequest = async () => {
      throw new Error('spotify down');
    };
    try {
      const result = await spotifyProfile.syncUserProfile(userId);
      assert.strictEqual(result.synced, false);
      assert.strictEqual(result.reason, 'spotify_error');
      assert.strictEqual(spotifyProfile.getUserMusicProfile(userId), null);
    } finally {
      spotifyService.getConnectionStatus = originalStatus;
      spotifyService.spotifyRequest = originalRequest;
    }
  });

  it('refreshes taste at most once an hour unless forced past the stale window', async () => {
    spotifyProfile._resetRefreshAttemptsForTests();
    const userId = 'spotify-refresh-user';
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      userId,
      'refresh@test.com',
      'x',
    );
    const originalStatus = spotifyService.getConnectionStatus;
    const originalRequest = spotifyService.spotifyRequest;
    spotifyService.getConnectionStatus = () => ({ status: 'connected' });
    spotifyService.spotifyRequest = async () => ({ items: [] });
    try {
      assert.strictEqual(spotifyProfile.refreshInBackground(userId, { force: true, now: 1_000 }), true);
      assert.strictEqual(spotifyProfile.refreshInBackground(userId, { force: true, now: 1_001 }), false);
      spotifyProfile._resetRefreshAttemptsForTests();
      await spotifyProfile.syncUserProfile(userId);
      assert.strictEqual(spotifyProfile.refreshInBackground(userId, { force: false, now: Date.now() }), false);
    } finally {
      spotifyService.getConnectionStatus = originalStatus;
      spotifyService.spotifyRequest = originalRequest;
      spotifyProfile._resetRefreshAttemptsForTests();
    }
  });
});
