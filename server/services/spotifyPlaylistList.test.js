const { expect } = require('chai');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_LIST';

function loadService() {
  try {
    return require('./spotifyService');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /spotifyService/.test(err.message)) {
      return null;
    }
    throw err;
  }
}

describe('spotify playlist list service contracts', () => {
  it('paginates GET /me/playlists for the authenticated user only', () => {
    const svc = loadService();
    if (!svc || typeof svc.listCurrentUserPlaylists !== 'function') {
      expect.fail(`${SENTINEL}: listCurrentUserPlaylists not implemented`);
    }
    expect.fail(`${SENTINEL}: /me/playlists pagination contract not green yet`);
  });

  it('atomically upserts and prunes only after a complete sync; partial failure preserves rows', () => {
    const svc = loadService();
    if (!svc || typeof svc.syncUserPlaylists !== 'function') {
      expect.fail(`${SENTINEL}: syncUserPlaylists not implemented`);
    }
    expect.fail(`${SENTINEL}: complete-sync upsert/prune contract not green yet`);
  });

  it('isolates equal provider playlist IDs across users', () => {
    const svc = loadService();
    if (!svc || typeof svc.syncUserPlaylists !== 'function') {
      expect.fail(`${SENTINEL}: per-user playlist snapshot isolation missing`);
    }
    expect.fail(`${SENTINEL}: cross-user provider ID isolation not green yet`);
  });

  it('honors rate-limit and timeout failures without pruning', () => {
    const svc = loadService();
    if (!svc || typeof svc.syncUserPlaylists !== 'function') {
      expect.fail(`${SENTINEL}: rate/timeout safe sync missing`);
    }
    expect.fail(`${SENTINEL}: 429/timeout non-prune list contract not green yet`);
  });
});
