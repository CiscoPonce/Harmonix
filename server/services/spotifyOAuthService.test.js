const { expect } = require('chai');
const crypto = require('crypto');
const db = require('../db');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

describe('spotifyOAuthService', () => {
  let oauth;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_WEB_SUCCESS_URL = 'https://example.test/playlists?spotify=connected';
    process.env.SPOTIFY_WEB_ERROR_URL = 'https://example.test/settings?spotify=error';
    process.env.SPOTIFY_ANDROID_SUCCESS_URL = 'https://example.test/app/library?spotify=connected';
    process.env.SPOTIFY_ANDROID_ERROR_URL = 'https://example.test/app/settings?spotify=error';
    delete require.cache[require.resolve('./spotifyOAuthService')];
    oauth = require('./spotifyOAuthService');
  });

  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      id,
      `${id}@test.com`,
      'x'
    );
  }

  beforeEach(() => {
    ensureUser('oauth-user-a');
    ensureUser('oauth-user-b');
    db.prepare('DELETE FROM spotify_oauth_transactions').run();
  });

  it('generatePkce returns a 43–128 char verifier and S256 base64url challenge', () => {
    const { verifier, challenge } = oauth.generatePkce();
    expect(verifier.length).to.be.at.least(43).and.at.most(128);
    expect(verifier).to.match(/^[A-Za-z0-9_-]+$/);
    const expected = crypto.createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).to.equal(expected);
  });

  it('createOAuthTransaction returns state once and stores only SHA-256(state)', () => {
    const tx = oauth.createOAuthTransaction({ userId: 'oauth-user-a', clientKind: 'web' });
    expect(tx.state).to.be.a('string').and.have.length.of.at.least(43);
    expect(Buffer.from(tx.state, 'base64url').length).to.be.at.least(32);
    expect(tx.verifier).to.be.a('string');
    expect(tx.challenge).to.be.a('string');
    expect(tx.clientKind).to.equal('web');

    const stateHash = crypto.createHash('sha256').update(tx.state).digest('hex');
    const row = db.prepare('SELECT * FROM spotify_oauth_transactions WHERE state_hash = ?').get(stateHash);
    expect(row).to.exist;
    expect(row.user_id).to.equal('oauth-user-a');
    expect(row.pkce_verifier).to.equal(tx.verifier);
    expect(row.client_kind).to.equal('web');
    expect(row.consumed_at).to.equal(null);
    const raw = JSON.stringify(row);
    expect(raw).to.not.include(tx.state);
  });

  it('rejects unknown client kinds and caller-supplied return URLs', () => {
    expect(() => oauth.createOAuthTransaction({ userId: 'oauth-user-a', clientKind: 'ios' }))
      .to.throw(/client.?kind|web|android/i);
    expect(() => oauth.createOAuthTransaction({
      userId: 'oauth-user-a',
      clientKind: 'web',
      returnUrl: 'https://evil.example/phish',
    })).to.throw(/return/i);
    expect(oauth.resolveReturnUrl('web', 'success')).to.equal(process.env.SPOTIFY_WEB_SUCCESS_URL);
    expect(oauth.resolveReturnUrl('android', 'error')).to.equal(process.env.SPOTIFY_ANDROID_ERROR_URL);
  });

  it('consumeOAuthTransaction succeeds once and rejects missing, expired, consumed, and mismatched states', () => {
    const tx = oauth.createOAuthTransaction({ userId: 'oauth-user-a', clientKind: 'android' });
    const first = oauth.consumeOAuthTransaction({ state: tx.state });
    expect(first.userId).to.equal('oauth-user-a');
    expect(first.pkceVerifier).to.equal(tx.verifier);
    expect(first.clientKind).to.equal('android');

    expect(() => oauth.consumeOAuthTransaction({ state: tx.state })).to.throw(/consumed|replay|invalid/i);
    expect(() => oauth.consumeOAuthTransaction({ state: 'missing-state-value' })).to.throw(/invalid|missing|state/i);

    const expired = oauth.createOAuthTransaction({
      userId: 'oauth-user-a',
      clientKind: 'web',
      ttlSeconds: 1,
      now: new Date(Date.now() - 60_000),
    });
    expect(() => oauth.consumeOAuthTransaction({ state: expired.state, now: new Date() }))
      .to.throw(/expir/i);

    const bound = oauth.createOAuthTransaction({ userId: 'oauth-user-a', clientKind: 'web' });
    expect(() => oauth.consumeOAuthTransaction({ state: bound.state, expectedUserId: 'oauth-user-b' }))
      .to.throw(/user|bind|mismatch|invalid/i);
  });

  it('invalidateOAuthTransactionsForUser clears outstanding transactions for that user only', () => {
    const a = oauth.createOAuthTransaction({ userId: 'oauth-user-a', clientKind: 'web' });
    const b = oauth.createOAuthTransaction({ userId: 'oauth-user-b', clientKind: 'web' });
    const removed = oauth.invalidateOAuthTransactionsForUser('oauth-user-a');
    expect(removed).to.be.at.least(1);
    expect(() => oauth.consumeOAuthTransaction({ state: a.state })).to.throw(/invalid|missing|state/i);
    const still = oauth.consumeOAuthTransaction({ state: b.state });
    expect(still.userId).to.equal('oauth-user-b');
  });

  it('does not log callback query values or token material', () => {
    const logs = [];
    const original = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    try {
      const tx = oauth.createOAuthTransaction({ userId: 'oauth-user-a', clientKind: 'web' });
      oauth.consumeOAuthTransaction({ state: tx.state });
    } finally {
      console.log = original;
    }
    const joined = logs.join('\n');
    expect(joined).to.not.match(/code=|access_token|refresh_token|verifier=/i);
  });
});
