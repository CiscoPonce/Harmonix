const { expect } = require('chai');
const db = require('../db');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_LIST';

function loadRouter() {
  try {
    return require('./spotify');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /spotify/.test(err.message)) {
      return null;
    }
    throw err;
  }
}

describe('spotify playlist list route contracts', () => {
  beforeEach(() => {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'list-user-a',
      'list-user-a@test.com',
      'x'
    );
  });

  it('GET /api/spotify/playlists requires req.user.id', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: GET /api/spotify/playlists route missing`);
    }
    expect.fail(`${SENTINEL}: authenticated playlist list route not green yet`);
  });

  it('returns provider, provider_id, stable_id, external_url, ownership, and detail_access fields', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: playlist list response shape missing`);
    }
    expect.fail(`${SENTINEL}: normalized playlist list fields not green yet`);
  });

  it('rejects SQL metacharacter query inputs with parameterized statements', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: list route parameterized queries missing`);
    }
    expect.fail(`${SENTINEL}: SQL metacharacter list ID contract not green yet`);
  });
});
