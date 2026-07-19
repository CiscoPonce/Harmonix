const { expect } = require('chai');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_FOUNDATION_ROUTE';

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

function requireImpl(name) {
  const svc = loadService();
  if (!svc || typeof svc[name] !== 'function') {
    expect.fail(`${SENTINEL}: spotifyService.${name} not implemented`);
  }
  return svc;
}

describe('spotifyService foundation contracts', () => {
  it('serializes pre-expiry refresh and retains or rotates refresh tokens atomically', async () => {
    const svc = requireImpl('getValidAccessToken');
    expect(svc.getValidAccessToken).to.be.a('function');
    expect.fail(`${SENTINEL}: pre-expiry refresh serialization contract not green yet`);
  });

  it('deletes credentials on invalid_grant without retry', async () => {
    const svc = requireImpl('refreshAccessToken');
    expect(svc.refreshAccessToken).to.be.a('function');
    expect.fail(`${SENTINEL}: invalid_grant credential deletion contract not green yet`);
  });

  it('waits exact Retry-After seconds on 429 with capped retries and per-user admission', async () => {
    const svc = requireImpl('spotifyRequest');
    expect(svc.spotifyRequest).to.be.a('function');
    expect.fail(`${SENTINEL}: 429 Retry-After and per-user admission contract not green yet`);
  });

  it('never searches more than ten tracks and never adds more than 100 uris per request', async () => {
    const svc = requireImpl('searchTracks');
    expect(svc.searchTracks).to.be.a('function');
    expect.fail(`${SENTINEL}: search limit=10 and add batch<=100 contract not green yet`);
  });

  it('uses current /me/playlists and /playlists/{id}/items endpoints only', async () => {
    const svc = requireImpl('listCurrentUserPlaylists');
    expect(svc.listCurrentUserPlaylists).to.be.a('function');
    expect.fail(`${SENTINEL}: /me/playlists and /playlists/{id}/items contract not green yet`);
  });

  it('enforces six-month authorization expiry as reconnect_required', async () => {
    const svc = requireImpl('getConnectionStatus');
    expect(svc.getConnectionStatus).to.be.a('function');
    expect.fail(`${SENTINEL}: six-month authorized_at expiry contract not green yet`);
  });

  it('supports injected fetch, fake clock, and fake sleep seams', () => {
    const svc = loadService();
    if (!svc) {
      expect.fail(`${SENTINEL}: spotifyService module missing`);
    }
    expect(svc).to.have.property('createSpotifyClient');
    expect.fail(`${SENTINEL}: injectable fetch/clock/sleep seams not green yet`);
  });
});
