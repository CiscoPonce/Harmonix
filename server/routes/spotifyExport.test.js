const { expect } = require('chai');
const db = require('../db');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_EXPORT';

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

describe('spotify export route contracts', () => {
  beforeEach(() => {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'export-user-a',
      'export-user-a@test.com',
      'x'
    );
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'export-user-b',
      'export-user-b@test.com',
      'x'
    );
  });

  it('POST export requires req.user.id', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: export route missing`);
    }
    expect.fail(`${SENTINEL}: authenticated export route not green yet`);
  });

  it('returns non-disclosing 404 for another user\'s Harmonix playlist', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: export cross-user 404 missing`);
    }
    expect.fail(`${SENTINEL}: export cross-user ownership 404 not green yet`);
  });

  it('rejects SQL metacharacter playlist IDs', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: export parameterized ID handling missing`);
    }
    expect.fail(`${SENTINEL}: SQL metacharacter export ID contract not green yet`);
  });
});
