const { expect } = require('chai');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_DETAIL';

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

describe('spotify playlist detail service contracts', () => {
  it('loads items via GET /playlists/{id}/items with defensive null/local track parsing', () => {
    const svc = loadService();
    if (!svc || typeof svc.getPlaylistItems !== 'function') {
      expect.fail(`${SENTINEL}: getPlaylistItems not implemented`);
    }
    expect.fail(`${SENTINEL}: /playlists/{id}/items detail contract not green yet`);
  });

  it('maps owner/collaborator restriction to safe detail_access without faking empty lists', () => {
    const svc = loadService();
    if (!svc || typeof svc.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: getPlaylistDetail restriction mapping missing`);
    }
    expect.fail(`${SENTINEL}: restricted playlist detail contract not green yet`);
  });

  it('revalidates stale membership before trusting cached detail metadata', () => {
    const svc = loadService();
    if (!svc || typeof svc.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: freshness revalidation missing`);
    }
    expect.fail(`${SENTINEL}: detail freshness/revalidation contract not green yet`);
  });

  it('returns 403-mapped provider restriction without leaking other users\' metadata', () => {
    const svc = loadService();
    if (!svc || typeof svc.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: 403 restriction mapping missing`);
    }
    expect.fail(`${SENTINEL}: owner/collaborator 403 mapping not green yet`);
  });
});
